// smoke 集計。results.jsonl と実行台帳を「正本」として集計する。
// 報告書の数字は必ずここの出力から取る(報告文の手集計を正としない)。
//
// 使い方:
//   node pricing_eval/src/smoke_summary.mjs --runs=<runId,runId,...> --usd-jpy=160 --prior-spent-usd=0.00065792

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logError } from './lib/log.mjs';
import { readResults } from './run_eval.mjs';
import { formatUsd } from './calculate_cost.mjs';
import { LEDGER_PATH } from './lib/ledger.mjs';

const RUNS_DIR = 'pricing_eval/runs';

/** 実行行(results.jsonl)からモデル別の集計を作る。rows が正本。 */
export function summarizeSmoke(rows, { usdJpy = null } = {}) {
  const byModel = new Map();
  for (const r of rows) {
    if (!byModel.has(r.modelId)) {
      byModel.set(r.modelId, {
        modelId: r.modelId, invocationTarget: r.invocationTarget ?? null,
        casesExecuted: 0, successes: 0, failures: 0, retries: 0, calls: 0,
        perCase: [],
        sixImageExecuted: false, sixImageSuccess: false,
        threeReplies: 0, japaneseOk: 0,
        criticalRows: 0, criticalByRule: {},
        latencies: [], inputTokens: 0, outputTokens: 0,
        costUsd: 0, unknownCostRows: 0,
      });
    }
    const m = byModel.get(r.modelId);
    m.casesExecuted++;
    m.calls += (r.attempts || []).length;
    m.retries += Math.max(0, (r.attempts || []).length - 1);
    if (r.success) m.successes++; else m.failures++;
    if (r.imageCount === 6) {
      m.sixImageExecuted = true;
      if (r.success) m.sixImageSuccess = true;
    }
    if (r.success && Array.isArray(r.replies) && r.replies.length === 3) m.threeReplies++;
    if (r.success && (r.replies || []).every((t) => /[぀-ヿ一-鿿]/.test(t))) m.japaneseOk++;
    const crit = r.validation?.critical || [];
    if (crit.length) m.criticalRows++;
    for (const c of crit) m.criticalByRule[c.rule] = (m.criticalByRule[c.rule] || 0) + 1;
    m.latencies.push(r.totalLatencyMs ?? null);
    for (const a of r.attempts || []) {
      if (a.usage?.inputTokens != null) m.inputTokens += a.usage.inputTokens;
      if (a.usage?.outputTokens != null) m.outputTokens += a.usage.outputTokens;
    }
    if (r.effectiveCostUsd == null) m.unknownCostRows++; else m.costUsd += r.effectiveCostUsd;
    m.perCase.push({
      caseId: r.caseId, imageCount: r.imageCount, success: r.success,
      failureKind: r.failureKind ?? null, attempts: (r.attempts || []).length,
      latencyMs: r.totalLatencyMs ?? null,
      httpStatuses: (r.attempts || []).map((a) => a.httpStatus ?? null),
      requestIds: (r.attempts || []).map((a) => a.requestId ?? null),
      inputTokens: (r.attempts || []).reduce((s, a) => s + (a.usage?.inputTokens ?? 0), 0),
      outputTokens: (r.attempts || []).reduce((s, a) => s + (a.usage?.outputTokens ?? 0), 0),
      calculatedCostUsd: formatUsd(r.effectiveCostUsd),
      criticalRules: crit.map((c) => c.rule),
    });
  }

  const models = [];
  for (const m of byModel.values()) {
    const lat = m.latencies.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    models.push({
      ...m,
      errorRate: m.casesExecuted ? m.failures / m.casesExecuted : null,
      schemaRate: m.casesExecuted ? m.successes / m.casesExecuted : null,
      threeRepliesRate: m.casesExecuted ? m.threeReplies / m.casesExecuted : null,
      six_image_runtime_verified: m.sixImageExecuted ? (m.sixImageSuccess ? 'PASS' : 'FAIL') : 'UNKNOWN',
      latencyMeanMs: lat.length ? Math.round(lat.reduce((s, x) => s + x, 0) / lat.length) : null,
      latencyMaxMs: lat.length ? lat[lat.length - 1] : null,
      calculatedCostUsd: formatUsd(m.costUsd),
      costJpy: usdJpy ? Number((m.costUsd * usdJpy).toFixed(4)) : null,
      latencies: undefined,
    });
  }
  // smoke 順位: エラー少 → critical 少 → 原価安い、の順
  models.sort((a, b) => (a.failures - b.failures) || (a.criticalRows - b.criticalRows) || (a.costUsd - b.costUsd));
  models.forEach((m, i) => { m.smokeRank = i + 1; });
  return models;
}

async function main() {
  const args = parseArgs();
  const runIds = String(args.runs || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!runIds.length) throw new Error('--runs=<runId,...> を指定してください');
  const usdJpy = Number(args['usd-jpy']) || null;
  const priorSpentUsd = Number(args['prior-spent-usd']) || 0;
  // 予算枠の表示。既定は smoke GO の 100 円。full 集計では --budget-jpy=10000 を明示する。
  const budgetJpy = Number(args['budget-jpy']) || 100;

  const rows = [];
  for (const id of runIds) {
    const p = join(RUNS_DIR, id, 'results.jsonl');
    if (!existsSync(p)) throw new Error(`results.jsonl が無い: ${p}`);
    const { rows: r, truncated } = readResults(p);
    if (truncated) logError(`${id}: 壊れた行 ${truncated} 行を無視`);
    rows.push(...r.map((x) => ({ ...x, runId: x.runId ?? id })));
  }

  // 台帳との突合(成功行の実効費用合計が台帳の記録合計と一致すること)
  const ledgerRows = existsSync(LEDGER_PATH)
    ? readFileSync(LEDGER_PATH, 'utf8').split('\n').filter((s) => s.trim()).map((s) => JSON.parse(s))
    : [];
  const successCost = rows.filter((r) => r.success && r.effectiveCostUsd != null)
    .reduce((s, r) => s + r.effectiveCostUsd, 0);
  const ledgerCost = ledgerRows.filter((e) => runIds.includes(e.runId))
    .reduce((s, e) => s + (Number(e.calculatedCostUsd) || 0), 0);
  const reconciled = Math.abs(successCost - ledgerCost) < 1e-9;

  const models = summarizeSmoke(rows, { usdJpy });
  const totalUsd = rows.reduce((s, r) => s + (r.effectiveCostUsd ?? 0), 0);
  const out = {
    at: new Date().toISOString(),
    runs: runIds,
    models,
    totals: {
      casesExecuted: rows.length,
      calls: rows.reduce((s, r) => s + (r.attempts || []).length, 0),
      thisRunsUsd: formatUsd(totalUsd),
      priorSpentUsd: formatUsd(priorSpentUsd),
      cumulativeUsd: formatUsd(totalUsd + priorSpentUsd),
      cumulativeJpy: usdJpy ? Number(((totalUsd + priorSpentUsd) * usdJpy).toFixed(4)) : null,
      budgetJpy,
      budgetRemainderJpy: usdJpy ? Number((budgetJpy - (totalUsd + priorSpentUsd) * usdJpy).toFixed(4)) : null,
      unknownCostRows: rows.filter((r) => r.effectiveCostUsd == null).length,
    },
    ledgerReconciliation: {
      resultsSuccessCostUsd: formatUsd(successCost),
      ledgerCostUsd: formatUsd(ledgerCost),
      reconciled,
    },
  };
  const dir = join(RUNS_DIR, '_summary');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'smoke_summary.json'), JSON.stringify(out, null, 2));
  logInfo('集計完了(正本 = results.jsonl + ledger.jsonl)', {
    models: models.map((m) => ({ rank: m.smokeRank, modelId: m.modelId, failures: m.failures, cost: m.calculatedCostUsd })),
    totals: out.totals, reconciled,
  });
  if (!reconciled) { logError('results と台帳の費用が一致しません'); process.exit(2); }
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { logError(e.message); process.exit(1); });
}
