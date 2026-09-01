// Kimi K2.5 vs Qwen3 VL 235B の同条件比較(内部6候補 → 事実ファイアウォール → 最終3案)。
//
// 実行例(GO 必須):
//   node pricing_eval/src/compare_candidates_eval.mjs --experiment-id=cmp20260902 \
//     --dataset=pricing_eval/cases_fab10.json --dataset-hash=4e0c…  --confirm-run \
//     --prior-spent-usd=<recordedSpendUsd()> --per-model-budget-jpy=100 --total-budget-jpy=200 \
//     --usd-jpy=160 --output-max-tokens=3000
//
// 規律(発注者指示 2026-09-02):
//   - 両モデルへ完全同一入力。逐次交互実行・並列禁止・意図的 sleep なし
//   - 1ケース最大2attempt(再生成・再試行を含む)。3回目は呼ばない
//   - モデル固有失敗はそのモデルだけ停止 / 共通安全条件は両モデル停止
//   - 予算はモデル別に見る。公式価格が無ければ呼ばない(0円扱いにしない)
//   - AWS設定・IAM・Marketplace/EULA は一切触らない(読み取りのみ)

import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logWarn, logError } from './lib/log.mjs';
import { createBedrockClient, resolveCredentials, buildConverseBody, sanitizeAwsMessage } from './adapters/bedrock.mjs';
import { extractToolUse } from './lib/fidelity_checks.mjs';
import { loadPricing, costUsdForAttempt, formatUsd } from './calculate_cost.mjs';
import { resolveModelPrice, buildProductionUserPrompt, ANTHROPIC_PRICING_PATH } from './fidelity_eval.mjs';
import { datasetHashOf, promptHashOf } from './lib/ledger.mjs';
import { callStarted, callEnded, loadCallLog, unaccountedCalls, unaccountedWorstCaseUsd, recordedSpendUsd } from './lib/call_log.mjs';
import { runPreflight } from './retention_preflight.mjs';
import { BANNED_RULES } from './validate_output.mjs';
import { spendByRun, explainDelta } from './reconcile_spend.mjs';
import {
  MAX_ATTEMPTS_PER_CASE, INPUT_TOKEN_CAP, COMPARE_CASES,
  executionPlan, checkPlan, budgetGate, oneCallWorstCaseUsd,
  inputFingerprint, assertIdenticalInputs, classifyFailure, applyStop, canContinue,
  runCase, classifyCandidates, summarizeModel, totalCostUsd, evaluatePassCriteria, initialBudgetUsd,
} from './lib/compare_harness.mjs';
import { CANDIDATE_COUNT, FINAL_COUNT } from '../../reply-ai-app/src/lib/candidate_select.mjs';
import { PLACEHOLDER_RE } from '../../reply-ai-app/src/lib/fact_firewall.mjs';

const RUNS_DIR = 'pricing_eval/runs';
const PROMPTS_TS = 'reply-ai-app/src/lib/prompts.ts';
const LIB_FILES = ['reply-ai-app/src/lib/fact_firewall.mjs', 'reply-ai-app/src/lib/candidate_select.mjs'];
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** prompts.ts から候補生成用のプロンプトと schema を取り出す(手写ししない) */
export async function loadCandidatePrompts(tsPath = PROMPTS_TS) {
  const src = readFileSync(tsPath, 'utf8');
  const tmpDir = join(RUNS_DIR, '_summary');
  mkdirSync(tmpDir, { recursive: true });
  const tmp = join(tmpDir, '_prompts_candidates_extracted.mjs');
  writeFileSync(tmp, src.replace(/ as const/g, ''));
  const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
  const sys = mod.REPLY_CANDIDATES_SYSTEM;
  const schema = mod.INTERNAL_CANDIDATE_SCHEMA;
  if (!sys || sys.length < 500) throw new Error('REPLY_CANDIDATES_SYSTEM の抽出に失敗');
  if (schema?.properties?.candidates?.minItems !== CANDIDATE_COUNT || schema?.properties?.candidates?.maxItems !== CANDIDATE_COUNT) {
    throw new Error(`INTERNAL_CANDIDATE_SCHEMA が ${CANDIDATE_COUNT} 件固定でない`);
  }
  const ext = mod.REPLY_SCHEMA;
  if (ext?.properties?.replies?.minItems !== FINAL_COUNT || ext?.properties?.replies?.maxItems !== FINAL_COUNT) {
    throw new Error('外部 REPLY_SCHEMA の3案固定が壊れている(比較の前提)');
  }
  const externalSchemaSha = sha(JSON.stringify(ext));
  return { sys, schema, externalSchemaSha };
}

/** 応答から候補6件を取り出す。取り出せない形は schema_violation として扱う(捏造しない) */
export function parseCandidateResponse(res, { toolName = 'reply_candidates' } = {}) {
  const usage = res?.usage ? { inputTokens: res.usage.inputTokens ?? null, outputTokens: res.usage.outputTokens ?? null } : null;
  if (res?.stopReason === 'max_tokens') return { ok: false, failureKind: 'max_tokens_truncated', error: '出力が max tokens で途中切れ', usage };
  const input = extractToolUse(res, toolName);
  if (!input) return { ok: false, failureKind: 'no_tool_use_block', error: 'toolUse ブロックが無い', usage };
  const list = input.candidates;
  if (!Array.isArray(list)) return { ok: false, failureKind: 'schema_violation', error: 'candidates が配列でない', usage };
  if (list.length !== CANDIDATE_COUNT) return { ok: false, failureKind: 'schema_violation', error: `candidates が ${list.length} 件(期待 ${CANDIDATE_COUNT} 件)`, usage };
  for (const c of list) {
    if (typeof c?.text !== 'string' || typeof c?.lane !== 'string' || !Array.isArray(c?.usedFactIds)) {
      return { ok: false, failureKind: 'schema_violation', error: '候補の形が違う(text/lane/usedFactIds)', usage };
    }
  }
  return { ok: true, candidates: list, usage };
}

/** ケースから検査用の文脈を作る(両モデルで完全に同じ) */
export function contextFor(c, experimentId) {
  const conv = (c.conversation || []).map((x) => x.text);
  return {
    conversationText: [c.goal, c.style_sample || '', c.partner_profile ? `${c.partner_profile.nickname} ${c.partner_profile.note}` : '', ...conv].join(' '),
    selfMessages: (c.conversation || []).filter((x) => x.from === 'self').map((x) => x.text),
    bannedRules: BANNED_RULES,
    idempotencyKey: `${experimentId}|${c.id}`,   // モデル名を入れない = fallback 文面も両モデルで同一
  };
}

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const experimentId = String(args['experiment-id'] || '');
  if (!experimentId) throw new Error('--experiment-id が必要');
  const datasetPath = String(args.dataset || 'pricing_eval/cases_fab10.json');
  const datasetHashArg = String(args['dataset-hash'] || '');
  const usdJpy = Number(args['usd-jpy'] || 160);
  const perModelLimitJpy = Number(args['per-model-budget-jpy'] || 100);
  const totalLimitJpy = Number(args['total-budget-jpy'] || 200);
  const outputMaxTokens = Number(args['output-max-tokens'] || cfg.outputMaxTokens);
  const dryRun = args['dry-run'] === true;
  const priorSpentGiven = args['prior-spent-usd'] !== undefined;
  const priorSpentUsd = Number(args['prior-spent-usd'] || 0);
  const modelIds = String(args.models || 'moonshotai.kimi-k2.5,qwen.qwen3-vl-235b-a22b').split(',').map((s) => s.trim()).filter(Boolean);
  if (modelIds.length !== 2) throw new Error('--models は2件(比較のため)');
  const summaryDir = join(RUNS_DIR, '_summary');
  mkdirSync(summaryDir, { recursive: true });
  const gateOut = join(summaryDir, `compare_gate_${experimentId}.json`);
  const gate = { experimentId, at: new Date().toISOString(), blockers: [], steps: {} };
  const stop = (msg) => { gate.blockers.push(msg); writeFileSync(gateOut, JSON.stringify(gate, null, 2) + '\n'); throw new Error(msg); };

  // ---------------- §5 dataset(内容・順序・画像を変えない)
  const casesRaw = readFileSync(datasetPath, 'utf8');
  const datasetHash = datasetHashOf(casesRaw);
  if (!datasetHashArg || datasetHash !== datasetHashArg) stop(`dataset hash 不一致(実物 ${datasetHash.slice(0, 12)}… / 指定 ${datasetHashArg.slice(0, 12)}…)`);
  const parsedDs = JSON.parse(casesRaw);
  const cases = parsedDs.cases;
  if (cases.length !== COMPARE_CASES) stop(`dataset のケース数が ${cases.length}(期待 ${COMPARE_CASES})`);
  gate.steps.dataset = { path: datasetPath, datasetHash, cases: cases.map((c) => c.id), generatedBy: parsedDs.generated_by };

  // ---------------- プロンプト・schema・検出器の指紋(両モデル共通)
  const { sys: candidateSystem, schema: candidateSchema, externalSchemaSha } = await loadCandidatePrompts();
  const schemaHash = sha(JSON.stringify(candidateSchema));
  const detectorHash = sha(LIB_FILES.map((f) => readFileSync(f, 'utf8')).join('\n'));
  gate.steps.fingerprints = { candidateSystemSha: sha(candidateSystem), schemaHash, detectorHash, externalReplySchemaSha: externalSchemaSha };

  // ---------------- §3 会計差額の突合(読み取り専用)
  const callLog = loadCallLog();
  if (callLog.broken) stop(`call_log に壊れた行が ${callLog.broken} 件`);
  const spendRuns = spendByRun(RUNS_DIR, callLog.rows);
  const recorded = recordedSpendUsd(RUNS_DIR, callLog.rows);
  const from = Number(args['reconcile-from'] || 1.18292785);
  const to = Number(args['reconcile-to'] || 1.61834135);
  // この監査の対象は「$1.18292785 → $1.61834135 の履歴」。今回の比較 run(compare_ で始まる)は対象外にして、
  // 履歴側の合計が to と一致することも併せて確かめる(自分の run で帳尻が合ってしまうのを防ぐ)
  const historical = spendRuns.filter((r) => !String(r.runId).startsWith("compare_"));
  const historicalSum = historical.reduce((s, r) => s + r.usageCostUsd, 0);
  if (Math.abs(historicalSum - to) > 1e-6) stop(`履歴側の合計 ${historicalSum} が ${to} と一致しない`);
  const ex = explainDelta(historical, to - from);
  gate.steps.reconcile = {
    from, to, delta: to - from, explained: ex.sum, diff: ex.diff, ok: ex.ok, historicalSum,
    excludedRuns: spendRuns.filter((r) => String(r.runId).startsWith("compare_")).map((r) => ({ runId: r.runId, usageCostUsd: r.usageCostUsd })),
    runs: ex.picked.map((r) => ({ runId: r.runId, models: r.models, calls: r.calls, succeeded: r.succeeded, failed: r.failed, unknown: r.unknown, usageCostUsd: r.usageCostUsd, worstCaseUsd: r.worstCaseUsd })),
    recordedSpendUsd: recorded.sum,
  };
  if (!ex.ok) stop(`会計差額が成果物と一致しない(差 ${ex.diff})`);
  if (priorSpentGiven && Math.abs(priorSpentUsd - recorded.sum) > 1e-6) stop(`--prior-spent-usd(${priorSpentUsd})が recordedSpendUsd(${recorded.sum})と一致しない`);
  const unknownUsd = unaccountedWorstCaseUsd(callLog.rows);
  const unknowns = unaccountedCalls(callLog.rows);
  gate.steps.unknownOutcomes = { count: unknowns.length, worstCaseUsd: unknownUsd };

  // ---------------- §2 preflight(読み取り専用)
  const preflight = await runPreflight(cfg);
  gate.steps.preflight = { region: preflight.region, identity: preflight.identity, retention: preflight.retention, blockers: preflight.blockers, allowModelEvaluation: preflight.allowModelEvaluation };
  const basePre = JSON.parse(readFileSync(join(RUNS_DIR, '_discovery', 'preflight.json'), 'utf8'));
  if (!preflight.allowModelEvaluation) stop(`preflight 不合格: ${preflight.blockers.join(' / ')}`);
  if (preflight.region !== 'ap-northeast-1') stop(`region が ${preflight.region}`);
  if (preflight.retention?.mode !== 'none') stop(`retention が ${preflight.retention?.mode}`);
  if (preflight.identity?.arnTail !== basePre?.identity?.arnTail) stop('IAM 主体が基準と違う');
  if (preflight.identity?.credentialSource !== 'profile:replier-eval') stop(`profile が ${preflight.identity?.credentialSource}`);
  if (cfg.temperature !== 0.2) stop(`temperature が ${cfg.temperature}(0.2 固定)`);

  // ---------------- モデル(discovery + 公式価格)
  const discovery = JSON.parse(readFileSync(join(RUNS_DIR, '_discovery', 'candidate_discovery.json'), 'utf8'));
  const pricing = loadPricing();
  const models = modelIds.map((id) => {
    const c = (discovery.candidates || []).find((x) => x.modelId === id);
    if (!c) stop(`${id} が discovery に無い`);
    const { price, priceKind } = resolveModelPrice({ pricing, id, invocationTarget: c.invocationTarget, modelName: c.modelName });
    if (!price || priceKind !== 'official_exact') stop(`${id} の公式価格が無い(見積不能・0円扱いにしない)`);
    return { modelId: id, invocationTarget: c.invocationTarget || id, price, priceKind, destinations: c.destinations || null, domesticPath: c.domesticPath ?? null, outputTokenCap: outputMaxTokens, inputTokenCap: INPUT_TOKEN_CAP };
  });
  gate.steps.models = models.map((m) => ({ modelId: m.modelId, invocationTarget: m.invocationTarget, priceKind: m.priceKind, inputPerMTokUsd: m.price.inputPerMTokUsd, outputPerMTokUsd: m.price.outputPerMTokUsd, destinations: m.destinations, domesticPath: m.domesticPath }));

  // ---------------- §4 モデル別費用ゲート
  const budget = budgetGate({ models, usdJpy, perModelLimitJpy, totalLimitJpy });
  gate.steps.budget = budget;
  if (!budget.ok) stop(`費用ゲート不合格(呼び出しゼロ): ${budget.blockers.join(' / ')}`);

  // ---------------- 実行計画(§6)
  const caseIds = cases.map((c) => c.id);
  const plan = executionPlan(caseIds, models[0].modelId, models[1].modelId);
  const planProblems = checkPlan(plan, caseIds, models[0].modelId, models[1].modelId);
  if (planProblems.length) stop(`実行計画が不正: ${planProblems.join(' / ')}`);
  gate.steps.plan = plan.map((p) => `${p.caseNo}:${p.modelId}`);

  writeFileSync(gateOut, JSON.stringify(gate, null, 2) + '\n');
  logInfo('実行前ゲート PASS', { dataset: datasetHash.slice(0, 12), reconcileDiff: ex.diff, budgetJpy: budget.totalWorstCaseJpy?.toFixed(1), models: modelIds.join(' / ') });
  if (dryRun) { logInfo('--dry-run のため呼び出さずに終了'); return; }

  // ---------------- 実行
  const runIds = Object.fromEntries(models.map((m) => [m.modelId, `compare_${experimentId}_${m.modelId.split('.').pop().replace(/[^a-z0-9]/gi, '')}`]));
  for (const m of models) mkdirSync(join(RUNS_DIR, runIds[m.modelId]), { recursive: true });
  const creds = resolveCredentials()?.credentials ?? null;
  if (!creds) stop('資格情報を解決できない');
  const client = createBedrockClient({ region: cfg.region, credentials: creds });
  const ledger = {
    started: (a) => callStarted(a),
    ended: (a) => callEnded(a),
  };

  let state = { stopped: new Set(), stopAll: false, rows: Object.fromEntries(models.map((m) => [m.modelId, []])) };
  const spentByModel = Object.fromEntries(models.map((m) => [m.modelId, 0]));
  let spentTotalUsd = initialBudgetUsd({ priorSpentUsd, unknownWorstCaseUsd: unknownUsd });   // 既発生+UNKNOWN は全体予算にだけ効かせる(モデル別上限とは別枠)
  const casesById = new Map(cases.map((c) => [c.id, c]));

  for (const step of plan) {
    if (!canContinue(state, step.modelId)) continue;
    const model = models.find((m) => m.modelId === step.modelId);
    const c = casesById.get(step.caseId);
    const ctx = contextFor(c, experimentId);
    const oneWorst = oneCallWorstCaseUsd(model);
    // モデル別の上限(§4)と全体予算の両方を、呼び出しの前に見る
    const modelWorstAfter = (spentByModel[model.modelId] + oneWorst * MAX_ATTEMPTS_PER_CASE) * usdJpy;
    if (modelWorstAfter > perModelLimitJpy) {
      logWarn(`${model.modelId}: モデル別上限に到達 → このモデルだけ停止`, { spentUsd: spentByModel[model.modelId], perModelLimitJpy });
      state = applyStop(state, { modelId: model.modelId, kind: 'model_budget_exceeded' });
      continue;
    }
    if ((spentTotalUsd + oneWorst * MAX_ATTEMPTS_PER_CASE) * usdJpy > cfg.maxBudgetJpy) {
      state = applyStop(state, { modelId: model.modelId, kind: 'total_budget_exceeded' });
      logError('全体予算に到達 → 両モデル停止');
      break;
    }

    const userText = buildProductionUserPrompt(c, null);
    const imagePaths = (c.images || []).map((f) => join('pricing_eval/screenshots', f));
    const fp = inputFingerprint({
      datasetHash, caseId: c.id, schemaHash, detectorHash, temperature: cfg.temperature, outputMaxTokens,
      promptHash: promptHashOf({ system: 'CANDIDATES ' + candidateSystem, userText, imageFiles: c.images || [] }),
      imageHashes: (c.images || []).map((f) => (existsSync(join('pricing_eval/screenshots', f)) ? sha(readFileSync(join('pricing_eval/screenshots', f))) : 'missing')),
    });

    const buildBody = () => {
      const body = buildConverseBody({ system: candidateSystem, userText, imagePaths, maxTokens: outputMaxTokens, temperature: cfg.temperature });
      body.toolConfig = {
        tools: [{ toolSpec: { name: 'reply_candidates', description: `返信候補の出力。候補は必ずちょうど ${CANDIDATE_COUNT} 件(reaction 2件・expand 2件・personal_or_future 2件)`, inputSchema: { json: candidateSchema } } }],
        toolChoice: { tool: { name: 'reply_candidates' } },
      };
      return body;
    };

    let r;
    try {
      r = await runCase({
        client, ledger, model, caseObj: c, buildBody, parseCandidates: parseCandidateResponse, ctx,
        runId: runIds[model.modelId], worstCaseUsd: oneWorst, maxAttempts: MAX_ATTEMPTS_PER_CASE,
        costOf: (usage) => costUsdForAttempt(usage, model.price),
      });
    } catch (e) {
      // finalizeReplies の不変条件違反(hard reject 漏れ等)を含む
      logError(`${model.modelId} / ${c.id} で停止`, { error: sanitizeAwsMessage(e.message).slice(0, 200) });
      state = applyStop(state, { modelId: model.modelId, kind: /hard reject/.test(e.message) ? 'final_hard_reject_leak' : 'model_error' });
      state.rows[model.modelId].push({ caseId: c.id, success: false, error: sanitizeAwsMessage(e.message).slice(0, 200), attempts: [], inputFingerprint: fp });
      continue;
    }

    const attemptCost = r.attempts.map((a) => a.costUsd);
    const spentHere = attemptCost.reduce((s, x) => s + (x == null ? oneWorst : x), 0);
    spentByModel[model.modelId] += spentHere;
    spentTotalUsd += spentHere;

    const flat = r.passes.flat();
    const cand = flat.length ? classifyCandidates(flat, ctx) : { generated: 0, byLane: {}, ok: 0, softRisk: 0, hardReject: 0, hardRejectReasons: [], placeholder: 0, personalFactCandidates: 0, usedFactIds: [], duplicates: 0 };
    const row = {
      experimentId, runId: runIds[model.modelId], modelId: model.modelId, caseId: c.id, caseNo: step.caseNo,
      category: c.category, imageCount: (c.images || []).length, inputFingerprint: fp,
      success: !!(r.ok && r.final), attempts: r.attempts, regenerated: r.regenerated, lastFailure: r.lastFailure,
      candidates: cand,
      rawCandidates: flat.map((x) => ({ text: x.text, lane: x.lane, usedFactIds: x.usedFactIds })),
      replies: r.final ? r.final.replies : [],
      final: r.final ? {
        picked: r.final.picked.map((p) => ({ lane: p.lane, source: p.source, verdict: p.verdict, text: p.text })),
        fallbackCount: r.final.picked.filter((p) => p.source === 'fallback').length,
        softRiskCount: r.final.picked.filter((p) => p.verdict === 'soft_risk').length,
        hardRejectLeak: r.final.picked.filter((p) => p.verdict === 'hard_reject').length,
        placeholderInFinal: r.final.replies.filter((t) => PLACEHOLDER_RE.test(t)).length,
        allQuestions: r.final.replies.every((t) => /[?？]\s*$/.test(t)),
        duplicates: r.final.replies.length - new Set(r.final.replies).size,
        schemaOk: r.final.replies.length === FINAL_COUNT,
      } : null,
      at: new Date().toISOString(),
    };
    state.rows[model.modelId].push(row);
    appendFileSync(join(RUNS_DIR, runIds[model.modelId], 'results.jsonl'), JSON.stringify(row) + '\n');
    logInfo(`${step.caseNo}. ${model.modelId} / ${c.id}`, {
      ok: row.success, attempts: r.attempts.length, hard: cand.hardReject, fallback: row.final?.fallbackCount ?? null,
      latencyMs: r.attempts.reduce((s, a) => s + a.latencyMs, 0), costUsd: formatUsd(spentHere),
    });

    if (!row.success) {
      const kind = r.lastFailure || 'model_error';
      const level = classifyFailure(kind);
      if (level !== 'retry') { state = applyStop(state, { modelId: model.modelId, kind }); logWarn(`${model.modelId} を停止(${kind})`); }
    }
    if (row.final && row.final.hardRejectLeak > 0) {
      state = applyStop(state, { modelId: model.modelId, kind: 'final_hard_reject_leak' });
      logError(`${model.modelId}: 最終3案へ hard reject が漏れた → 停止`);
    }
  }

  // ---------------- 集計・保存
  const summaries = models.map((m) => ({ modelId: m.modelId, ...summarizeModel(state.rows[m.modelId]) }));
  const identical = assertIdenticalInputs(state.rows[models[0].modelId], state.rows[models[1].modelId]);
  const criteria = Object.fromEntries(models.map((m, i) => [m.modelId, evaluatePassCriteria(summaries[i], state.rows[m.modelId])]));
  const out = {
    experimentId, at: new Date().toISOString(), blindSeed: `${experimentId}-blind`,
    dataset: { path: datasetPath, datasetHash }, fingerprints: gate.steps.fingerprints,
    config: { temperature: cfg.temperature, outputMaxTokens, usdJpy, perModelLimitJpy, totalLimitJpy, maxAttempts: MAX_ATTEMPTS_PER_CASE, region: cfg.region },
    models: gate.steps.models, runIds,
    plan: gate.steps.plan,
    identicalInputProblems: identical,
    summaries, totalCostUsd: totalCostUsd(summaries), criteria,
    stopped: [...state.stopped], stopAll: state.stopAll,
    cases: cases.map((c) => ({ id: c.id, goal: c.goal, conversation: (c.conversation || []).map((x) => `${x.from === 'self' ? '自分' : '相手'}: ${x.text}`).join('\n') })),
    repliesByModel: Object.fromEntries(models.map((m) => [m.modelId, Object.fromEntries(state.rows[m.modelId].filter((r) => r.success).map((r) => [r.caseId, r.replies]))])),
  };
  writeFileSync(join(summaryDir, `compare_${experimentId}.json`), JSON.stringify(out, null, 2) + '\n');
  logInfo('比較 run 完了', {
    out: join(summaryDir, `compare_${experimentId}.json`),
    cost: summaries.map((s) => `${s.modelId}=${formatUsd(s.costUsd)}`).join(' / '),
    identicalInputProblems: identical.length,
  });
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { logError(e.message); process.exit(1); });
}
