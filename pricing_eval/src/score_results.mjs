// 機械評価の集計(§9)。
//
// ここで出るのは provisional(暫定)ランキングのみ。人間の blind review が終わるまで
// selected(採用)にしてはいけない。LLM 採点だけで採用を決めることも禁止。

import { readResults } from './run_eval.mjs';
import { summarize, monthlyCost } from './calculate_cost.mjs';

/** 機械評価の点数(100点満点)。critical があるモデルは採用対象外なので別扱い。 */
export function machineScore(rows) {
  const n = rows.length;
  if (!n) return null;
  const ok = rows.filter((r) => r.success);
  const successRate = ok.length / n;
  const criticalRows = rows.filter((r) => r.validation && r.validation.critical.length);
  const criticalRate = criticalRows.length / n;
  const minorRate = rows.filter((r) => r.validation && r.validation.minor.length).length / n;
  const distinctRate = ok.length ? ok.filter((r) => r.validation?.flags?.distinct).length / ok.length : 0;
  const refusalRate = ok.length ? ok.reduce((s, r) => s + (r.validation?.flags?.refusalRate ?? 0), 0) / ok.length : 0;
  const falseRefusals = rows.filter((r) => r.validation?.critical.some((c) => c.rule === 'false_refusal')).length;
  const fabrications = rows.filter((r) => r.validation?.critical.some((c) => c.rule === 'fabricated_detail')).length;

  // 配点(機械で測れるものだけ。自然さ・文体の納得感は人間評価に残す)
  const score =
    successRate * 40 +
    (1 - criticalRate) * 30 +
    distinctRate * 15 +
    (1 - minorRate) * 10 +
    (1 - refusalRate) * 5;

  return {
    n, successRate, criticalRate, minorRate, distinctRate, refusalRate,
    falseRefusals, fabrications,
    schemaFailures: rows.filter((r) => ['json_parse_failure', 'schema_failure', 'wrong_reply_count'].includes(r.failureKind)).length,
    systemFailures: rows.filter((r) => r.failureClass === 'system').length,
    retryRate: rows.filter((r) => r.retried).length / n,
    score: Number(score.toFixed(1)),
    hasCriticalFailure: criticalRows.length > 0,
  };
}

/** 原価・latency の集計。unknown は unknown のまま伝える。 */
export function costStats(rows) {
  const all = rows.map((r) => r.effectiveCostUsd);
  const byBucket = {};
  for (const b of ['text_only', 'image_1_3', 'image_4_6']) {
    byBucket[b] = summarize(rows.filter((r) => r.bucket === b).map((r) => r.effectiveCostUsd));
  }
  // 初回のみ(再試行を含まない)の原価。再試行込みとの差を見るため。
  const firstOnly = rows.map((r) => r.attempts?.[0]?.costUsd ?? null);
  return {
    effective: summarize(all),          // 再試行込み実効原価
    firstAttemptOnly: summarize(firstOnly),
    byBucket,
    latencyMs: summarize(rows.map((r) => r.totalLatencyMs)),
    monthly: monthlyCost(summarize(all).mean, [60, 120]),
  };
}

/** モデル別に集計 */
export function scoreRun(resultsPath) {
  const { rows, truncated } = readResults(resultsPath);
  const byModel = new Map();
  for (const r of rows) {
    if (!byModel.has(r.modelKey)) byModel.set(r.modelKey, []);
    byModel.get(r.modelKey).push(r);
  }
  const models = [];
  for (const [key, rs] of byModel) {
    models.push({
      modelKey: key,
      modelId: rs[0].modelId,
      synthetic: rs.some((r) => r.synthetic),
      quality: machineScore(rs),
      cost: costStats(rs),
    });
  }
  // provisional ランキング(機械評価のみ)。critical があるモデルは下に落とす。
  models.sort((a, b) => {
    if (a.quality?.hasCriticalFailure !== b.quality?.hasCriticalFailure) return a.quality?.hasCriticalFailure ? 1 : -1;
    return (b.quality?.score ?? -1) - (a.quality?.score ?? -1);
  });
  return { truncatedLines: truncated, rowCount: rows.length, models };
}

/**
 * 「安いモデルを採るのは品質差が3点以内のときだけ」(§9)の判定。
 * 人間評価が未了なら判定自体をブロックする。
 */
export function cheaperModelAllowed({ best, cheaper, humanReviewDone }) {
  if (!humanReviewDone) {
    return { allowed: false, reason: '人間 blind review が未了のため、この判定はできません' };
  }
  if (cheaper.quality.hasCriticalFailure) return { allowed: false, reason: 'critical failure があるため不採用' };
  const diff = best.quality.score - cheaper.quality.score;
  if (diff > 3) return { allowed: false, reason: `品質差 ${diff.toFixed(1)} 点 > 3 点。安さだけで品質を落とさない` };
  const bc = best.cost.effective.mean, cc = cheaper.cost.effective.mean;
  if (bc === null || cc === null) return { allowed: false, reason: '原価が unknown のため比較できない' };
  return { allowed: cc < bc, reason: `品質差 ${diff.toFixed(1)} 点(3点以内)、原価 ${cc < bc ? '安い' : '安くない'}` };
}
