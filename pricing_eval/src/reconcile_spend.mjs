// 会計差額の突合(読み取り専用)。台帳・run 成果物は一切書き換えない。
//
// 目的: 「以前報告した recordedSpendUsd」から「今の recordedSpendUsd」までの増分が、
//       どの run のどの呼び出しで発生したかを、call_log.jsonl と runs/*/results.jsonl から復元する。
//       増分が指定値と 1e-6 以内で一致しなければ FAIL(終了コード 1)。
//
// 使い方:
//   node pricing_eval/src/reconcile_spend.mjs --from=1.18292785 --to=1.61834135
//
// 計上規則は recordedSpendUsd() と同じ:
//   1. call_log の終端(SUCCEEDED/FAILED)で costUsd が数値のものを callId ごとに1件(重複は大きい方)
//   2. results.jsonl / probe_results.jsonl の試行のうち、1 で数えていないものだけ
// run への割り当ては call_log 側は STARTED の runId、成果物側はディレクトリ名。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadCallLog, unaccountedCalls, recordedSpendUsd } from './lib/call_log.mjs';
import { isCliEntry, parseArgs } from './lib/config.mjs';

const TERMINAL = new Set(['SUCCEEDED', 'FAILED']);
const round8 = (n) => Number(n.toFixed(8));

/** run 単位の内訳を作る(recordedSpendUsd と同じ計上規則) */
export function spendByRun(runsDir = 'pricing_eval/runs', callLogRows = loadCallLog().rows) {
  const startedById = new Map(callLogRows.filter((r) => r.status === 'STARTED' || r.status === 'UNKNOWN_OUTCOME').map((r) => [r.callId, r]));

  const termByCallId = new Map();
  for (const r of callLogRows) {
    if (!TERMINAL.has(r.status) || typeof r.costUsd !== 'number' || !Number.isFinite(r.costUsd)) continue;
    const prev = termByCallId.get(r.callId);
    if (!prev || r.costUsd > prev.costUsd) termByCallId.set(r.callId, r);
  }
  const termCallIds = new Set(termByCallId.keys());
  const termReqToModel = new Map();
  for (const [cid, r] of termByCallId) {
    const mid = startedById.get(cid)?.modelId ?? null;
    if (!r.requestId || mid == null) continue;
    if (termReqToModel.has(r.requestId) && termReqToModel.get(r.requestId) !== mid) termReqToModel.set(r.requestId, '__AMBIGUOUS__');
    else if (!termReqToModel.has(r.requestId)) termReqToModel.set(r.requestId, mid);
  }

  /** @type {Map<string, any>} */
  const runs = new Map();
  const ensure = (runId) => {
    if (!runs.has(runId)) {
      runs.set(runId, {
        runId, models: new Set(), calls: 0, succeeded: 0, failed: 0, unknown: 0,
        usageCostUsd: 0, worstCaseUsd: 0, firstAt: null, lastAt: null, fromLedger: 0, fromArtifacts: 0,
      });
    }
    return runs.get(runId);
  };
  const stamp = (rec, iso) => {
    if (!iso) return;
    if (!rec.firstAt || iso < rec.firstAt) rec.firstAt = iso;
    if (!rec.lastAt || iso > rec.lastAt) rec.lastAt = iso;
  };

  // 1. 台帳から
  for (const r of callLogRows) {
    if (r.status !== 'STARTED' && r.status !== 'UNKNOWN_OUTCOME') continue;
    const rec = ensure(r.runId || '(runId無し)');
    rec.calls++;
    if (r.modelId) rec.models.add(r.modelId);
    stamp(rec, r.startedAt);
  }
  for (const [cid, r] of termByCallId) {
    const st = startedById.get(cid);
    const rec = ensure(st?.runId || '(runId無し)');
    rec.usageCostUsd += r.costUsd;
    rec.fromLedger += r.costUsd;
    if (r.status === 'SUCCEEDED') rec.succeeded++; else rec.failed++;
    stamp(rec, r.endedAt);
  }
  // 終端はあるが costUsd が null のもの(失敗で usage 無し)も成否だけ数える
  const counted = new Set(termByCallId.keys());
  const seenNullTerm = new Set();
  for (const r of callLogRows) {
    if (!TERMINAL.has(r.status) || r.costUsd != null) continue;
    if (counted.has(r.callId) || seenNullTerm.has(r.callId)) continue;
    seenNullTerm.add(r.callId);
    const st = startedById.get(r.callId);
    const rec = ensure(st?.runId || '(runId無し)');
    if (r.status === 'SUCCEEDED') rec.succeeded++; else rec.failed++;
    stamp(rec, r.endedAt);
  }
  // 費用不明(UNKNOWN_OUTCOME / 終端 costUsd=null)の worst-case
  for (const u of unaccountedCalls(callLogRows)) {
    const rec = ensure(u.runId || '(runId無し)');
    rec.worstCaseUsd += Number(u.worstCaseUsd) || 0;
    if (u.reason === 'UNKNOWN_OUTCOME') rec.unknown++;
  }

  // 2. 成果物から(台帳で数えていない試行だけ)
  for (const d of readdirSync(runsDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of ['results.jsonl', 'probe_results.jsonl']) {
      const p = join(runsDir, d.name, f);
      if (!existsSync(p)) continue;
      for (const ln of readFileSync(p, 'utf8').split('\n')) {
        const s = ln.trim(); if (!s) continue;
        let r; try { r = JSON.parse(s); } catch { continue; }
        const rec = ensure(r.runId || d.name);
        if (r.modelId) rec.models.add(r.modelId);
        if (Array.isArray(r.attempts) && r.attempts.length) {
          for (const a of r.attempts) {
            const reqModel = a.requestId ? termReqToModel.get(a.requestId) : undefined;
            const attemptModel = a.modelId ?? r.modelId ?? null;
            const matchedByReq = reqModel !== undefined && reqModel !== '__AMBIGUOUS__' && attemptModel != null && reqModel === attemptModel;
            if ((a.callId && termCallIds.has(a.callId)) || matchedByReq) continue;
            const c = a.costUsd ?? (a.calculatedCostUsd != null ? Number(a.calculatedCostUsd) : null);
            if (typeof c === 'number' && Number.isFinite(c)) { rec.usageCostUsd += c; rec.fromArtifacts += c; }
          }
          continue;
        }
        const v = r.effectiveCostUsd ?? (r.calculatedCostUsd != null ? Number(r.calculatedCostUsd) : null);
        if (typeof v === 'number' && Number.isFinite(v)) { rec.usageCostUsd += v; rec.fromArtifacts += v; }
      }
    }
  }

  return [...runs.values()]
    .map((r) => ({ ...r, models: [...r.models] }))
    .sort((a, b) => String(a.firstAt || '9999').localeCompare(String(b.firstAt || '9999')));
}

/**
 * 差額 delta を「新しい run から順に足していく」ことで説明する。
 * 端数の一致は 1e-6 以内。説明できなければ ok:false。
 */
export function explainDelta(runs, deltaUsd, tolerance = 1e-6) {
  const newestFirst = [...runs].sort((a, b) => String(b.firstAt || '').localeCompare(String(a.firstAt || '')));
  const picked = [];
  let acc = 0;
  for (const r of newestFirst) {
    if (r.usageCostUsd === 0) continue;
    if (Math.abs(acc - deltaUsd) <= tolerance) break;
    picked.push(r);
    acc += r.usageCostUsd;
  }
  return { picked, sum: acc, ok: Math.abs(acc - deltaUsd) <= tolerance, diff: acc - deltaUsd };
}

if (isCliEntry(import.meta.url)) {
  const args = parseArgs();
  const from = Number(args.from ?? 1.18292785);
  const to = Number(args.to ?? 1.61834135);
  const runsDir = args['runs-dir'] || 'pricing_eval/runs';
  const delta = to - from;

  const { rows } = loadCallLog();
  const runs = spendByRun(runsDir, rows);
  const total = runs.reduce((s, r) => s + r.usageCostUsd, 0);
  const live = recordedSpendUsd(runsDir, rows);

  console.log('run別の内訳(recordedSpendUsd と同じ計上規則・読み取り専用)');
  console.log('run | モデル | 呼び出し | 成功 | 失敗 | UNKNOWN | usage確定費用USD | worst-caseUSD');
  for (const r of runs) {
    if (r.calls === 0 && r.usageCostUsd === 0 && r.worstCaseUsd === 0) continue;
    console.log([
      r.runId, r.models.join('+') || '-', r.calls, r.succeeded, r.failed, r.unknown,
      round8(r.usageCostUsd), round8(r.worstCaseUsd),
    ].join(' | '));
  }
  console.log(`合計(この内訳) = ${total}`);
  console.log(`recordedSpendUsd()  = ${live.sum}`);
  const totalsMatch = Math.abs(total - live.sum) <= 1e-6;
  console.log(`内訳合計 vs recordedSpendUsd: ${totalsMatch ? 'OK' : 'NG'} (差 ${total - live.sum})`);

  const ex = explainDelta(runs, delta);
  console.log('');
  console.log(`差額 ${from} → ${to} = ${round8(delta)} を新しい run から説明する:`);
  for (const r of ex.picked) {
    console.log(`  ${r.runId} | ${r.models.join('+')} | 呼び出し${r.calls} 成功${r.succeeded} 失敗${r.failed} UNKNOWN${r.unknown} | ${round8(r.usageCostUsd)}`);
  }
  console.log(`  合計 = ${ex.sum} / 差額 = ${delta} / 差 = ${ex.diff}`);

  const ok = totalsMatch && ex.ok;
  console.log(ok ? 'PASS: 差額は成果物と 1e-6 以内で一致' : 'FAIL: 差額が成果物と一致しない');
  process.exit(ok ? 0 : 1);
}
