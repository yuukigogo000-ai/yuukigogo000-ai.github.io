// 呼び出し台帳(call_log)。Bedrock 呼び出しの「直前」に STARTED を永続化し、応答後に SUCCEEDED/FAILED で確定する。
//
// 目的: 強制終了・クラッシュで「実際には呼んだかもしれないが台帳に無い」呼び出しをなくす。
// STARTED のまま終端レコードが無い呼び出しは UNKNOWN_OUTCOME として扱い、予算計算では worst-case 費用を加算する
// (2026-09-01 の b2 run で kill 時の進行中1呼び出しが台帳外になった事故への恒久対策)。
//
// 本文(プロンプト・応答)は書かない。書くのは識別子・時刻・費用・requestId のみ。

import { appendFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const DEFAULT_CALL_LOG_PATH = 'pricing_eval/runs/call_log.jsonl';
/** 台帳の場所。テストは PRICING_EVAL_CALL_LOG で一時ファイルへ向ける(本番台帳を汚さない。Codex r6 MEDIUM) */
export function callLogPath() { return process.env.PRICING_EVAL_CALL_LOG || DEFAULT_CALL_LOG_PATH; }
export const CALL_LOG_PATH = DEFAULT_CALL_LOG_PATH;
const TERMINAL = new Set(['SUCCEEDED', 'FAILED']);

/** 呼び出し直前に呼ぶ。追記が完了してから network を叩くこと(戻り値の callId を callEnded に渡す) */
export function callStarted({ runId, caseId, modelId, attemptNo, worstCaseUsd, apiOperation = 'Converse' }, path = callLogPath()) {
  for (const [k, v] of Object.entries({ runId, caseId, modelId })) {
    if (!v) throw new Error(`callStarted: ${k} が無い(台帳外の呼び出しは禁止)`);
  }
  if (!(Number(worstCaseUsd) > 0)) throw new Error('callStarted: worstCaseUsd が正の数でない');
  const callId = randomUUID();
  appendFileSync(path, JSON.stringify({
    callId, status: 'STARTED', runId, caseId, modelId, attemptNo: attemptNo ?? 1,
    worstCaseUsd: Number(worstCaseUsd), apiOperation, startedAt: new Date().toISOString(),
  }) + '\n');
  return callId;
}

/** 応答(成功・失敗・例外)の直後に呼ぶ。costUsd は分かった範囲(null = usage 無し) */
export function callEnded({ callId, status, costUsd = null, requestId = null, httpStatus = null, failureKind = null }, path = callLogPath()) {
  if (!callId) throw new Error('callEnded: callId が無い');
  if (!TERMINAL.has(status)) throw new Error(`callEnded: status は SUCCEEDED|FAILED(${status})`);
  appendFileSync(path, JSON.stringify({
    callId, status, costUsd: costUsd == null ? null : Number(costUsd), requestId, httpStatus, failureKind, endedAt: new Date().toISOString(),
  }) + '\n');
}

/** 壊れた行は読み飛ばす(数は返す) */
export function loadCallLog(path = callLogPath()) {
  if (!existsSync(path)) return { rows: [], broken: 0 };
  const rows = []; let broken = 0;
  for (const ln of readFileSync(path, 'utf8').split('\n')) {
    const s = ln.trim();
    if (!s) continue;
    try { rows.push(JSON.parse(s)); } catch { broken++; }
  }
  return { rows, broken };
}

/** STARTED に終端レコードが無い呼び出し = UNKNOWN_OUTCOME(手動の UNKNOWN_OUTCOME 行もそのまま含める) */
export function unknownOutcomes(rows) {
  const ended = new Set(rows.filter((r) => TERMINAL.has(r.status)).map((r) => r.callId));
  return rows
    .filter((r) => (r.status === 'STARTED' && !ended.has(r.callId)) || r.status === 'UNKNOWN_OUTCOME')
    .map((r) => ({ ...r, status: 'UNKNOWN_OUTCOME' }));
}

/**
 * 台帳に「記録された」費用の合計(USD)。全 run の results.jsonl(effectiveCostUsd)と probe_results.jsonl(calculatedCostUsd)。
 * 契約: `--prior-spent-usd` はこの「記録済み費用」だけを指す。UNKNOWN_OUTCOME の worst-case はツールが別枠で加える
 * (二重計上の防止。Codex r4 HIGH 指摘)。
 */
export function recordedSpendUsd(runsDir = 'pricing_eval/runs', callLogRows = loadCallLog().rows) {
  // 台帳(call_log)に費用つき終端がある呼び出しは台帳から数える。results.jsonl の試行は台帳に無いものだけ数える
  // (クラッシュで終端は書けたが results に届かなかった呼び出しを落とさない。Codex r6 HIGH)。同一呼び出しは callId か requestId で突合し1回だけ数える
  // 終端は callId ごとに1件に畳む(重複行は費用の大きい方=保守的)。requestId での突合は STARTED の modelId が一致するときだけ
  const startedById = new Map(callLogRows.filter((r) => r.status === 'STARTED' || r.status === 'UNKNOWN_OUTCOME').map((r) => [r.callId, r]));
  const termByCallId = new Map();
  for (const r of callLogRows) {
    if (!TERMINAL.has(r.status) || typeof r.costUsd !== 'number' || !Number.isFinite(r.costUsd)) continue;
    const prev = termByCallId.get(r.callId);
    if (!prev || r.costUsd > prev.costUsd) termByCallId.set(r.callId, r);
  }
  const termCallIds = new Set(termByCallId.keys());
  const termReqToModel = new Map(); let fromCallLog = 0;
  for (const [cid, r] of termByCallId) {
    fromCallLog += r.costUsd;
    const mid = startedById.get(cid)?.modelId ?? null;
    if (!r.requestId || mid == null) continue; // STARTED が無く modelId 不明の終端は requestId 突合に使わない(緩い一致を作らない)
    if (termReqToModel.has(r.requestId) && termReqToModel.get(r.requestId) !== mid) termReqToModel.set(r.requestId, '__AMBIGUOUS__');
    else if (!termReqToModel.has(r.requestId)) termReqToModel.set(r.requestId, mid);
  }
  let sum = fromCallLog; let rows = 0;
  for (const d of readdirSync(runsDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of ['results.jsonl', 'probe_results.jsonl']) {
      const p = join(runsDir, d.name, f);
      if (!existsSync(p)) continue;
      for (const ln of readFileSync(p, 'utf8').split('\n')) {
        const s = ln.trim(); if (!s) continue;
        let r; try { r = JSON.parse(s); } catch { continue; }
        rows++;
        // 試行単位で数える(ケースの effectiveCostUsd は「どれか1試行の費用が不明」で null になり、判明している試行の費用まで落ちる)
        if (Array.isArray(r.attempts) && r.attempts.length) {
          for (const a of r.attempts) {
            const reqModel = a.requestId ? termReqToModel.get(a.requestId) : undefined;
            const attemptModel = a.modelId ?? r.modelId ?? null;
            const matchedByReq = reqModel !== undefined && reqModel !== '__AMBIGUOUS__' && attemptModel != null && reqModel === attemptModel;
            if ((a.callId && termCallIds.has(a.callId)) || matchedByReq) continue; // 台帳側で計上済み
            const c = a.costUsd ?? (a.calculatedCostUsd != null ? Number(a.calculatedCostUsd) : null);
            if (typeof c === 'number' && Number.isFinite(c)) sum += c;
          }
          continue;
        }
        const v = r.effectiveCostUsd ?? (r.calculatedCostUsd != null ? Number(r.calculatedCostUsd) : null);
        if (typeof v === 'number' && Number.isFinite(v)) sum += v;
      }
    }
  }
  return { sum, rows, fromCallLog };
}

/**
 * 予算ガード(純関数)。呼び出し前に worst-case を「予約」してから dispatch し、並行ワーカーが同じ spent を見て同時に通るのを防ぐ
 * (Codex r6 HIGH: concurrency=2 の競合)。allows() が true を返したときだけ reserve() すること。
 */
export function budgetAllows({ spentUsd, reservedUsd = 0, nextWorstUsd, usdJpy, maxBudgetJpy }) {
  if (!(usdJpy > 0) || !(maxBudgetJpy > 0)) return false;
  return (spentUsd + reservedUsd + nextWorstUsd) * usdJpy <= maxBudgetJpy;
}

/**
 * 予算計上すべき「費用不明」呼び出し = UNKNOWN_OUTCOME + 終端はあるが costUsd が null の呼び出し(usage 無しの失敗・パース不能な応答)。
 * どちらも STARTED の worstCaseUsd で数える(再起動後も消えない。Codex r5 HIGH 指摘)。
 */
export function unaccountedCalls(rows) {
  const started = new Map(rows.filter((r) => r.status === 'STARTED' || r.status === 'UNKNOWN_OUTCOME').map((r) => [r.callId, r]));
  const out = unknownOutcomes(rows).map((u) => ({ ...u, reason: 'UNKNOWN_OUTCOME' }));
  // 費用つき終端がある callId は recordedSpendUsd 側で数える(同じ呼び出しを null 終端で二重計上しない。Codex r8 HIGH)
  const hasNumeric = new Set(rows.filter((r) => TERMINAL.has(r.status) && typeof r.costUsd === 'number' && Number.isFinite(r.costUsd)).map((r) => r.callId));
  const seenNull = new Set();
  for (const r of rows) {
    if (!TERMINAL.has(r.status) || r.costUsd != null) continue;
    if (hasNumeric.has(r.callId) || seenNull.has(r.callId)) continue; // 費用判明済み / 同一 callId の null 終端は1回だけ
    seenNull.add(r.callId);
    const st = started.get(r.callId);
    out.push({ ...(st || {}), callId: r.callId, status: r.status, costUsd: null, reason: 'TERMINAL_COST_UNKNOWN', worstCaseUsd: st?.worstCaseUsd });
  }
  return out;
}

/** 費用不明呼び出しの予算計上額(worst-case の合計)。1件でも worstCaseUsd が無ければ例外(甘く見積もらない) */
export function unaccountedWorstCaseUsd(rows) {
  let sum = 0;
  for (const u of unaccountedCalls(rows)) {
    if (!(Number(u.worstCaseUsd) > 0)) throw new Error(`費用不明の呼び出しに worstCaseUsd が無い(callId=${u.callId}, ${u.reason})`);
    sum += Number(u.worstCaseUsd);
  }
  return sum;
}

/** UNKNOWN_OUTCOME の予算計上額(worst-case の合計)。1件でも worstCaseUsd が無ければ例外(甘く見積もらない) */
export function unknownOutcomeWorstCaseUsd(rows) {
  let sum = 0;
  for (const u of unknownOutcomes(rows)) {
    if (!(Number(u.worstCaseUsd) > 0)) throw new Error(`UNKNOWN_OUTCOME に worstCaseUsd が無い(callId=${u.callId})`);
    sum += Number(u.worstCaseUsd);
  }
  return sum;
}
