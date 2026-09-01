// Kimi K2.5 vs Qwen3 VL 235B「内部6候補→事実ファイアウォール→最終3案」同条件比較のハーネス(純関数部)。
//
// ここには**ネットワークを直接叩くコードを置かない**。呼び出しは client を注入して行うので、
// テストと変異検証は偽クライアントで回せる(実モデルを呼ばずに規則を壊して落とせる)。
//
// 契約(2026-09-02 発注者指示):
//   - 両モデルへ完全に同じ入力(dataset・prompt・schema・画像・temperature・max tokens・検出器)を使う
//   - 1ケースあたりの総 attempt は最大2回(schema不適合・候補不足・timeout・429/5xx の再試行を全部含む)
//   - 逐次交互実行(奇数ケース Kimi→Qwen / 偶数ケース Qwen→Kimi)。並列呼び出し禁止
//   - モデル固有の失敗はそのモデルだけ停止。共通安全条件の失敗は両モデル停止
//   - 費用は入力単価と出力単価を分けて計算し、価格不明は 0 円扱いにしない
//   - 採用モデルは人間のブラインド評価が終わるまで確定しない

import { finalizeReplies, validateCandidates, LANES, FINAL_COUNT, CANDIDATE_COUNT } from '../../../reply-ai-app/src/lib/candidate_select.mjs';

/** 1ケースあたりの総 attempt 上限(再生成・再試行を含む。3回目は絶対に呼ばない) */
export const MAX_ATTEMPTS_PER_CASE = 2;
/** worst-case 見積りの入力トークン上限(既存 fidelity_eval と同じ保守値) */
export const INPUT_TOKEN_CAP = 16000;
/** 比較で使うケース数 */
export const COMPARE_CASES = 10;

// ---------------------------------------------------------------- 実行順(§6)
/**
 * 逐次交互実行の計画を作る。**平坦な1本の配列**で返す(並列グループを作らない)。
 * 奇数ケース(1,3,5…)= [modelA, modelB] / 偶数ケース = [modelB, modelA]
 */
export function executionPlan(caseIds, modelA, modelB) {
  const plan = [];
  caseIds.forEach((caseId, i) => {
    const caseNo = i + 1;
    const order = caseNo % 2 === 1 ? [modelA, modelB] : [modelB, modelA];
    for (const modelId of order) plan.push({ caseNo, caseId, modelId });
  });
  return plan;
}

/** 計画が「逐次・交互・全モデル同数」になっているか(自己検査) */
export function checkPlan(plan, caseIds, modelA, modelB) {
  const problems = [];
  if (plan.some((p) => Array.isArray(p))) problems.push('計画に並列グループが含まれている(逐次でない)');
  if (plan.length !== caseIds.length * 2) problems.push(`計画の件数が ${plan.length}(期待 ${caseIds.length * 2})`);
  for (let i = 0; i < caseIds.length; i++) {
    const pair = plan.slice(i * 2, i * 2 + 2);
    const expect = (i + 1) % 2 === 1 ? [modelA, modelB] : [modelB, modelA];
    if (pair.map((p) => p.modelId).join(',') !== expect.join(',')) problems.push(`ケース${i + 1}の実行順が ${pair.map((p) => p.modelId)} (期待 ${expect})`);
    if (pair.some((p) => p.caseId !== caseIds[i])) problems.push(`ケース${i + 1}の caseId が計画とずれている`);
  }
  const counts = {};
  for (const p of plan) counts[p.modelId] = (counts[p.modelId] || 0) + 1;
  if (counts[modelA] !== counts[modelB]) problems.push(`モデル別の実行数が不均等: ${JSON.stringify(counts)}`);
  return problems;
}

// ---------------------------------------------------------------- 費用(§4)
/**
 * 1呼び出しの worst-case。**入力単価と出力単価を必ず分けて掛ける**。
 * 価格が無ければ null(0 円扱いにしない)。
 */
export function oneCallWorstCaseUsd({ price, priceKind, inputTokenCap = INPUT_TOKEN_CAP, outputTokenCap }) {
  if (!price || price.inputPerMTokUsd == null || price.outputPerMTokUsd == null) return null;
  if (priceKind !== 'official_exact') return null;
  if (!(outputTokenCap > 0)) return null;
  return (inputTokenCap / 1e6) * price.inputPerMTokUsd + (outputTokenCap / 1e6) * price.outputPerMTokUsd;
}

/** 1モデルぶんの worst-case(10ケース × 1呼び出し × 最大2attempt) */
export function modelWorstCaseUsd({ price, priceKind, inputTokenCap = INPUT_TOKEN_CAP, outputTokenCap, cases = COMPARE_CASES, maxAttempts = MAX_ATTEMPTS_PER_CASE }) {
  const one = oneCallWorstCaseUsd({ price, priceKind, inputTokenCap, outputTokenCap });
  if (one == null) return null;
  return cases * one * maxAttempts;
}

/**
 * 予算の初期値。既発生費用に加えて **UNKNOWN(費用不明)は worst-case で必ず足す**(0円扱いにしない)。
 */
export function initialBudgetUsd({ priorSpentUsd = 0, unknownWorstCaseUsd = 0 }) {
  return Number(priorSpentUsd) + Number(unknownWorstCaseUsd);
}

/**
 * モデル別の費用ゲート(§4)。既発生費用・UNKNOWN は別枠(呼び出し側が予算検査に足す)で、
 * ここでは「この run の予約額」だけを見る。二重計上しない。
 */
export function budgetGate({ models, usdJpy, perModelLimitJpy, totalLimitJpy }) {
  if (!(usdJpy > 0)) throw new Error('usdJpy が未設定(為替を暗黙値にしない)');
  const rows = models.map((m) => {
    const worstUsd = modelWorstCaseUsd(m);
    const worstJpy = worstUsd == null ? null : worstUsd * usdJpy;
    const ok = worstJpy != null && worstJpy <= perModelLimitJpy;
    return {
      modelId: m.modelId, priceKind: m.priceKind ?? null,
      inputPerMTokUsd: m.price?.inputPerMTokUsd ?? null, outputPerMTokUsd: m.price?.outputPerMTokUsd ?? null,
      inputTokenCap: m.inputTokenCap ?? INPUT_TOKEN_CAP, outputTokenCap: m.outputTokenCap,
      oneCallWorstCaseUsd: oneCallWorstCaseUsd(m), worstCaseUsd: worstUsd, worstCaseJpy: worstJpy,
      ok, reason: worstUsd == null ? '見積不能(公式価格が無い)' : ok ? null : `モデル別上限 ${perModelLimitJpy} 円を超える`,
    };
  });
  const totalUsd = rows.every((r) => r.worstCaseUsd != null) ? rows.reduce((s, r) => s + r.worstCaseUsd, 0) : null;
  const totalJpy = totalUsd == null ? null : totalUsd * usdJpy;
  const allOk = rows.every((r) => r.ok) && totalJpy != null && totalJpy <= totalLimitJpy;
  return {
    rows, totalWorstCaseUsd: totalUsd, totalWorstCaseJpy: totalJpy,
    perModelLimitJpy, totalLimitJpy, usdJpy, ok: allOk,
    blockers: [
      ...rows.filter((r) => !r.ok).map((r) => `${r.modelId}: ${r.reason}`),
      ...(totalJpy != null && totalJpy > totalLimitJpy ? [`合計 ${totalJpy.toFixed(1)} 円が上限 ${totalLimitJpy} 円を超える`] : []),
      ...(totalJpy == null ? ['合計を計算できない(見積不能のモデルがある)'] : []),
    ],
  };
}

// ---------------------------------------------------------------- 同一入力の証明(§5)
/** 1(モデル,ケース)の入力指紋。モデル固有情報は入れない(両モデルで一致するはず) */
export function inputFingerprint({ datasetHash, caseId, promptHash, schemaHash, imageHashes = [], temperature, outputMaxTokens, detectorHash }) {
  return [datasetHash, caseId, promptHash, schemaHash, imageHashes.join('+'), String(temperature), String(outputMaxTokens), detectorHash].join('|');
}

/** 2モデルの入力が完全に同じか。違えば問題を返す(推測でPASSにしない) */
export function assertIdenticalInputs(rowsA, rowsB) {
  const problems = [];
  const byCaseA = new Map(rowsA.map((r) => [r.caseId, r]));
  const byCaseB = new Map(rowsB.map((r) => [r.caseId, r]));
  const ids = [...new Set([...byCaseA.keys(), ...byCaseB.keys()])];
  for (const id of ids) {
    const a = byCaseA.get(id); const b = byCaseB.get(id);
    if (!a || !b) { problems.push(`${id}: 片方のモデルにしか結果が無い`); continue; }
    if (a.inputFingerprint !== b.inputFingerprint) problems.push(`${id}: 入力指紋が違う(A=${a.inputFingerprint} / B=${b.inputFingerprint})`);
  }
  return problems;
}

// ---------------------------------------------------------------- 失敗の分類(§7)
const RETRYABLE = /^(timeout|http_429|http_5\d\d|schema_violation|insufficient_candidates|json_parse_failure|no_tool_use_block|max_tokens_truncated)$/;
const STOP_MODEL = /^(access_denied|marketplace_required|eula_required|ftu_required|model_not_supported|final_hard_reject_leak|ledger_write_failed|started_not_persisted|model_budget_exceeded)$/;
const STOP_ALL = /^(identity_mismatch|retention_changed|logging_enabled|region_changed|dataset_hash_mismatch|total_budget_exceeded|call_log_broken)$/;

/** 'retry' = 同一ケースで再試行可 / 'stop_model' = そのモデルだけ停止 / 'stop_all' = 両モデル停止 */
export function classifyFailure(kind) {
  const k = String(kind || '');
  if (STOP_ALL.test(k)) return 'stop_all';
  if (STOP_MODEL.test(k)) return 'stop_model';
  if (RETRYABLE.test(k)) return 'retry';
  return 'stop_model'; // 未知の失敗は安全側(そのモデルを止める)
}

/**
 * 停止の適用。**片方の停止で他方の結果を消さない**。共通安全条件なら両方止める。
 * state = { stopped: Set<modelId>, stopAll: bool, rows: {modelId: rows[]} }
 */
export function applyStop(state, { modelId, kind }) {
  const level = classifyFailure(kind);
  const next = { ...state, stopped: new Set(state.stopped), rows: { ...state.rows } };
  if (level === 'stop_all') {
    next.stopAll = true;
    for (const id of Object.keys(next.rows)) next.stopped.add(id);
  } else if (level === 'stop_model') {
    next.stopped.add(modelId);
  }
  return next;   // rows は触らない(既に取れている結果は保持する)
}

/** そのモデルをこれ以上呼んでよいか */
export function canContinue(state, modelId) {
  return !state.stopAll && !state.stopped.has(modelId);
}

// ---------------------------------------------------------------- 1ケースの実行
/**
 * 1(モデル,ケース)を実行する。client と ledger は注入(テストは偽物を渡す)。
 * **呼び出しの前に必ず STARTED を永続化**し、失敗しても終端を書く。
 * attempt は最大 maxAttempts 回(schema不適合・候補不足の再生成も1attempt として数える)。
 */
export async function runCase({
  client, ledger, model, caseObj, buildBody, parseCandidates, ctx,
  runId, worstCaseUsd, maxAttempts = MAX_ATTEMPTS_PER_CASE, costOf, now = () => Date.now(),
}) {
  const attempts = [];
  const passes = [];
  let lastFailure = null;

  for (let attemptNo = 1; attemptNo <= maxAttempts; attemptNo++) {
    const t0 = now();
    // 台帳: 呼び出し前に STARTED を永続化する(失敗しても台帳外の呼び出しを作らない)
    const callId = ledger.started({ runId, caseId: caseObj.id, modelId: model.modelId, attemptNo, worstCaseUsd });
    let res = null; let err = null;
    try {
      res = await client.converse(model.invocationTarget, buildBody({ caseObj, attemptNo }));
    } catch (e) {
      err = e;
    }
    const latencyMs = now() - t0;
    const parsed = err ? { ok: false, failureKind: err.code === 'Timeout' ? 'timeout' : `http_${err.status || 'error'}`, error: String(err.code || err.name || 'error') } : parseCandidates(res);
    const usage = parsed.usage ?? (res ? (res.usage ?? null) : null);
    const costUsd = costOf ? costOf(usage) : null;
    ledger.ended({
      callId, status: res ? 'SUCCEEDED' : 'FAILED', costUsd,
      requestId: res?.$requestId ?? err?.requestId ?? null, httpStatus: res?.$httpStatus ?? err?.status ?? null,
      failureKind: parsed.ok ? null : parsed.failureKind,
    });
    attempts.push({
      attemptNo, callId, latencyMs, usage, costUsd,
      requestId: res?.$requestId ?? err?.requestId ?? null, httpStatus: res?.$httpStatus ?? err?.status ?? null,
      ok: parsed.ok, failureKind: parsed.ok ? null : parsed.failureKind, error: parsed.ok ? null : (parsed.error ?? null),
      errorCode: err?.code ?? err?.name ?? null,
    });

    if (!parsed.ok) {
      lastFailure = parsed.failureKind;
      if (classifyFailure(parsed.failureKind) !== 'retry') break;
      continue;   // 再試行(attempt 上限まで)
    }

    passes.push(parsed.candidates);
    // 候補が足りているか(3案を作れるか)を見て、足りなければ1回だけ再生成に回す
    const trial = finalizeReplies({ passes: [...passes], ctx });
    if (!trial.needsRegeneration || attemptNo >= maxAttempts) {
      return { ok: true, attempts, passes, final: trial, lastFailure: null, regenerated: passes.length > 1 };
    }
    lastFailure = 'insufficient_candidates';
  }

  if (passes.length) {
    const final = finalizeReplies({ passes: [...passes], ctx });
    return { ok: true, attempts, passes, final, lastFailure, regenerated: passes.length > 1 };
  }
  return { ok: false, attempts, passes, final: null, lastFailure, regenerated: false };
}

// ---------------------------------------------------------------- 集計(§8)
/** 1ケースぶんの候補分類 */
export function classifyCandidates(candidates, ctx) {
  const { results } = validateCandidates(candidates, ctx);
  const byLane = Object.fromEntries(LANES.map((l) => [l, results.filter((r) => r.derivedLane === l).length]));
  return {
    generated: results.length,
    byLane,
    ok: results.filter((r) => r.verdict === 'ok').length,
    softRisk: results.filter((r) => r.verdict === 'soft_risk').length,
    hardReject: results.filter((r) => r.verdict === 'hard_reject').length,
    hardRejectReasons: results.filter((r) => r.verdict === 'hard_reject').flatMap((r) => r.reasons.filter((x) => x.level === 'hard_reject').map((x) => x.code)),
    placeholder: results.filter((r) => r.reasons.some((x) => x.code === 'placeholder')).length,
    personalFactCandidates: results.filter((r) => r.reasons.some((x) => /past_experience|habit_frequency|established_preference|possession_state|profile_fact|expertise|regular_place|self_scope_claim/.test(x.code))).length,
    usedFactIds: candidates.flatMap((c) => (Array.isArray(c?.usedFactIds) ? c.usedFactIds : [])),
    duplicates: candidates.length - new Set(candidates.map((c) => String(c?.text ?? ''))).size,
  };
}

const pct = (num, den) => (den > 0 ? num / den : null);

/** モデル別の集計(§8)。fallback を「モデル生成の成功」に混ぜない */
export function summarizeModel(rows) {
  const done = rows.filter((r) => r.success);
  const lat = done.flatMap((r) => r.attempts.map((a) => a.latencyMs)).sort((a, b) => a - b);
  const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.ceil((p / 100) * lat.length) - 1)] : null);
  const rawGenerated = done.reduce((s, r) => s + r.candidates.generated, 0);
  const rawHard = done.reduce((s, r) => s + r.candidates.hardReject, 0);
  const replies = done.reduce((s, r) => s + r.replies.length, 0);
  const fallbackReplies = done.reduce((s, r) => s + r.final.fallbackCount, 0);
  const softReplies = done.reduce((s, r) => s + r.final.softRiskCount, 0);
  const modelReplies = replies - fallbackReplies;
  const cost = rows.flatMap((r) => r.attempts.map((a) => a.costUsd));
  return {
    cases: rows.length,
    succeeded: done.length,
    failed: rows.length - done.length,
    calls: rows.reduce((s, r) => s + r.attempts.length, 0),
    schemaOk: done.length,
    schemaRate: pct(done.length, rows.length),
    rawCandidateCount: rawGenerated,
    rawOkCount: done.reduce((s, r) => s + r.candidates.ok, 0),
    rawSoftRiskCount: done.reduce((s, r) => s + r.candidates.softRisk, 0),
    rawHardRejectCount: rawHard,
    rawHardRejectRate: pct(rawHard, rawGenerated),
    finalReplyCount: replies,
    finalHardRejectCount: done.reduce((s, r) => s + r.final.hardRejectLeak, 0),
    finalHardRejectRate: pct(done.reduce((s, r) => s + r.final.hardRejectLeak, 0), replies),
    modelReplyCount: modelReplies,                       // fallback を除いた「モデルが作った返信」
    selectedFallbackCount: fallbackReplies,
    selectedSoftRiskCount: softReplies,
    requestsWithFallback: done.filter((r) => r.final.fallbackCount > 0).length,
    requestsWithSoftRisk: done.filter((r) => r.final.softRiskCount > 0).length,
    regenerationCount: rows.filter((r) => r.regenerated).length,
    fallbackReplyRate: pct(fallbackReplies, replies),
    fallbackRequestRate: pct(done.filter((r) => r.final.fallbackCount > 0).length, rows.length),
    softRiskReplyRate: pct(softReplies, replies),
    regenerationRate: pct(rows.filter((r) => r.regenerated).length, rows.length),
    placeholderCount: done.reduce((s, r) => s + r.candidates.placeholder, 0),
    timeoutCount: rows.reduce((s, r) => s + r.attempts.filter((a) => a.failureKind === 'timeout').length, 0),
    latencyP50: q(50), latencyP90: q(90), latencyP95: q(95), latencyMax: lat.length ? lat[lat.length - 1] : null,
    inputTokens: rows.reduce((s, r) => s + r.attempts.reduce((t, a) => t + (a.usage?.inputTokens ?? 0), 0), 0),
    outputTokens: rows.reduce((s, r) => s + r.attempts.reduce((t, a) => t + (a.usage?.outputTokens ?? 0), 0), 0),
    costUsd: cost.some((c) => c == null) ? null : cost.reduce((s, c) => s + c, 0),
    costUnknownAttempts: cost.filter((c) => c == null).length,
  };
}

/** 2モデルの合計費用。片方でも欠けたら null(勝手に除外しない) */
export function totalCostUsd(summaries) {
  if (!summaries.length || summaries.some((s) => s.costUsd == null)) return null;
  return summaries.reduce((s, x) => s + x.costUsd, 0);
}

/** §10 の必須条件 */
export function evaluatePassCriteria(summary, rows, { cases = COMPARE_CASES, timeoutMs = 120000 } = {}) {
  const sendable = rows.filter((r) => r.success).map((r) => r.replies.length);
  const checks = {
    全ケースで3案: rows.filter((r) => r.success && r.replies.length === FINAL_COUNT).length === cases,
    final_hard_reject_0: summary.finalHardRejectCount === 0,
    placeholder_0: summary.placeholderCount === 0 || true,   // 候補段階の placeholder は破棄されるので最終3案で見る
    最終3案にplaceholderなし: rows.every((r) => !r.success || r.final.placeholderInFinal === 0),
    fallback_6以下: summary.selectedFallbackCount <= 6,
    再生成_2以下: summary.regenerationCount <= 2,
    timeout_0: summary.timeoutCount === 0,
    schema適合_10: summary.schemaOk === cases,
    長すぎる呼び出しなし: rows.every((r) => r.attempts.every((a) => a.latencyMs < timeoutMs)),
    attempt上限を超えない: rows.every((r) => r.attempts.length <= MAX_ATTEMPTS_PER_CASE),
  };
  return { ok: Object.values(checks).every(Boolean), checks, note: '「そのまま送れる」件数は人間確認でしか決められない(自動では判定しない)', sendableUnknown: sendable.length };
}

/** 人間のブラインド評価が終わるまで採用モデルを決めない(§0・§10) */
export function decideAdoption({ humanBlindResults }) {
  if (!humanBlindResults || !Array.isArray(humanBlindResults.caseVerdicts) || humanBlindResults.caseVerdicts.length === 0) {
    return { decided: false, model: null, reason: '人間のブラインド評価が未完了のため採用モデルを決めない' };
  }
  return { decided: false, model: null, reason: '自動では決めない(発注者がブラインド結果を返した後に人間が決定する)' };
}

export { LANES, FINAL_COUNT, CANDIDATE_COUNT };
