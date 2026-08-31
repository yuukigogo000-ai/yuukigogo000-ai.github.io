// 評価の実行(§8)。stage: dryrun / smoke / full。resume 対応。
//
// 守る不変条件:
//   - Hard Gate 違反(FAIL)のモデルは Full Run しない
//   - smoke のエラー率が 10% を超えたモデルは Full Run へ進めない
//   - 自動再試行は最大1回。初回と再試行の usage / latency / 原価を別々に記録する
//   - 失敗を成功扱いしない(3案でないもの、JSON崩れは失敗)
//   - resume 時に成功済みケースを二重実行しない
//   - 予算上限を超えそうなら実行しない
//   - 会話本文・画像・応答本文を「ログ」に出さない(結果ファイルには保存する。合成データのため)
//
// 使い方:
//   node src/run_eval.mjs --stage=dryrun
//   node src/run_eval.mjs --stage=smoke  --adapter=mock --fault=none
//   node src/run_eval.mjs --stage=full   --run-id=<既存ID>   (resume)

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logWarn, logError } from './lib/log.mjs';
import { SYSTEM_INSTRUCTION, buildUserText, parseReplies } from './adapters/contract.mjs';
import { createMockClient } from './adapters/mock.mjs';
import { createBedrockClient, resolveCredentials, buildConverseBody, extractConverse, sanitizeAwsMessage } from './adapters/bedrock.mjs';
import { validateReplies } from './validate_output.mjs';
import { costUsdForAttempt, loadPricing, toJpy, bucketOf, formatUsd } from './calculate_cost.mjs';
import { runPreflight } from './retention_preflight.mjs';
import { callStarted, callEnded } from './lib/call_log.mjs';
import { LEDGER_PATH, datasetHashOf, promptHashOf, configHashOf, ledgerKey, loadLedger, appendLedger } from './lib/ledger.mjs';

const CASES_PATH = 'pricing_eval/cases.json';
const RUNS_DIR = 'pricing_eval/runs';
const SMOKE_ERROR_THRESHOLD = 0.10;

// smoke の代表5ケース: テキスト・1枚・6枚・文体・境界を最低1件ずつ(§8 Stage1)
export function pickSmokeCases(cases) {
  const byId = (id) => cases.find((c) => c.id === id);
  const first = (fn) => cases.find(fn);
  const picks = [
    first((c) => c.category === 'text_short'),
    first((c) => c.category === 'screenshot_1_3' && c.images.length === 1),
    first((c) => c.category === 'screenshot_4_6' && c.images.length === 6),
    first((c) => c.category === 'style'),
    first((c) => c.category === 'edge'),
  ].filter(Boolean);
  return picks;
}

function newRunId(stage) {
  const t = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  return `${stage}_${t}`;
}

/** results.jsonl を読む。末尾が途中で切れていても壊れず、壊れた行は無視する(§13)。 */
export function readResults(path) {
  if (!existsSync(path)) return { rows: [], truncated: 0 };
  const lines = readFileSync(path, 'utf8').split('\n');
  const rows = []; let truncated = 0;
  for (const ln of lines) {
    const s = ln.trim();
    if (!s) continue;
    try { rows.push(JSON.parse(s)); } catch { truncated++; }
  }
  return { rows, truncated };
}

const keyOf = (modelKey, caseId) => `${modelKey}::${caseId}`;

/** 1試行。例外は投げず結果として返す。 */
async function attemptOnce({ client, cfg, model, testCase, attemptNo, price = null }) {
  const t0 = Date.now();
  const startedAt = new Date(t0).toISOString();
  let callId = null;
  try {
    let text, usage, stopReason, requestId = null, httpStatus = null;
    if (client.synthetic) {
      const r = await client.invoke({ caseId: testCase.id, imageCount: testCase.images.length });
      text = r.text; usage = r.usage; stopReason = r.stopReason;
    } else {
      const body = buildConverseBody({
        system: SYSTEM_INSTRUCTION,
        userText: buildUserText(testCase),
        imagePaths: testCase.images.map((f) => join('pricing_eval/screenshots', f)),
        maxTokens: cfg.outputMaxTokens,
        temperature: cfg.temperature,
      });
      // 呼び出し直前に STARTED を永続化(台帳外の呼び出しをなくす)。price 無しの実呼び出しは禁止
      if (!price) throw new Error('official 価格が無いモデルは呼び出さない');
      const worst = (16000 / 1e6) * price.inputPerMTokUsd + (cfg.outputMaxTokens / 1e6) * price.outputPerMTokUsd;
      callId = callStarted({ runId: cfg.runId || 'run_eval', caseId: testCase.id, modelId: model.modelId, attemptNo, worstCaseUsd: worst });
      const res = await client.converse(model.invocationTarget || model.inferenceProfileId || model.modelId, body);
      const ex = extractConverse(res);
      text = ex.text; usage = ex.usage; stopReason = ex.stopReason;
      callEnded({ callId, status: 'SUCCEEDED', costUsd: costUsdForAttempt(usage, price), requestId: res.$requestId ?? null, httpStatus: res.$httpStatus ?? null });
      callId = null;
      // 成功時も requestId / HTTP status を記録する。取得できなければ null(捏造しない)
      requestId = res.$requestId ?? null;
      httpStatus = res.$httpStatus ?? null;
    }
    const parsed = parseReplies(text);
    return {
      attemptNo,
      latencyMs: Date.now() - t0,
      startedAt,
      completedAt: new Date().toISOString(),
      requestId,
      httpStatus,
      apiOperation: client.synthetic ? 'MockInvoke' : 'Converse',
      usage: usage ?? null,
      stopReason: stopReason ?? null,
      ok: parsed.ok,
      failureKind: parsed.ok ? null : parsed.failureKind,
      error: parsed.ok ? null : parsed.error,
      replies: parsed.ok ? parsed.replies : (parsed.replies ?? null),
      // 失敗の種類を「システム障害」と「モデル出力の問題」で区別する(§8 Stage2)
      failureClass: parsed.ok ? null : 'model_output',
    };
  } catch (e) {
    // 終端レコードの追記に失敗したら握りつぶさず停止(STARTED が残るのは「中断・不明」のときだけ、という意味を守る)
    if (callId) callEnded({ callId, status: 'FAILED', costUsd: null, requestId: e.requestId ?? null, httpStatus: e.status ?? null, failureKind: e.code ?? e.name ?? null });
    return {
      attemptNo,
      latencyMs: Date.now() - t0,
      startedAt,
      completedAt: new Date().toISOString(),
      usage: null,
      stopReason: null,
      ok: false,
      failureKind: e.code === 'Timeout' ? 'timeout' : `http_${e.status || 'error'}`,
      error: `${e.code || e.name}`,
      // AccessDenied 等の診断に必要な情報を自動保存する(秘密はサニタイズ済み)
      errorCode: e.code ?? e.name ?? null,
      sanitizedErrorMessage: sanitizeAwsMessage(e.message),
      httpStatus: e.status ?? null,
      requestId: e.requestId ?? null,
      apiOperation: e.operation ?? (client.synthetic ? 'MockInvoke' : 'Converse'),
      replies: null,
      failureClass: 'system',
    };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 契約・権限・購読・モデルアクセス・検証系のエラー。再試行も継続もせず即停止(人間操作が必要)
const CONTRACT_ERROR_RE = /AccessDenied|NotAuthorized|Unauthorized|Subscription|Marketplace|EULA|ModelAccess|ValidationException/i;

/**
 * 1ケースの結果行から「即停止すべき契約系エラー」を判定し、停止メッセージか null を返す。
 * 純関数。main のループはこれが非 null なら throw して残りの呼び出しを行わない。
 */
// モデル側の画像枚数上限(例: "At most 3 image(s) may be provided")。アカウント/契約系の異常ではなく
// 「6画像非対応」= 候補単位の FAIL。全 smoke 停止にせず、証拠は結果行として残す。
const IMAGE_LIMIT_RE = /at most \d+ image|image\(s\) may be provided|too many images/i;

export function contractStopError(row) {
  if (row.success || row.failureClass !== 'system') return null;
  const capabilityImageLimit = (row.attempts || []).some(
    (x) => /ValidationException/i.test(x.errorCode || '') && IMAGE_LIMIT_RE.test(x.sanitizedErrorMessage || ''),
  );
  if (capabilityImageLimit) return null;
  const errText = (row.attempts || [])
    .map((x) => [x.errorCode, x.error, x.sanitizedErrorMessage].filter(Boolean).join(' '))
    .join(' ');
  // 429(スロットリング)以外の 4xx は原因を問わず全 smoke 停止(候補単位で握りつぶさない)
  const abnormal4xx = (row.attempts || []).some(
    (x) => typeof x.httpStatus === 'number' && x.httpStatus >= 400 && x.httpStatus < 500 && x.httpStatus !== 429,
  );
  if (!CONTRACT_ERROR_RE.test(errText) && !abnormal4xx) return null;
  const ids = (row.attempts || []).map((x) => x.requestId).filter(Boolean).join(',');
  return `契約/権限/検証系または4xxエラーのため ${row.modelKey} の実行を停止します(再試行しません): ${errText || row.failureKind}${ids ? ` [requestId: ${ids}]` : ''}`;
}

/** 1ケースを実行(自動再試行は最大1回) */
export async function runCase({ client, cfg, model, testCase, price }) {
  const attempts = [];
  let a = await attemptOnce({ client, cfg, model, testCase, attemptNo: 1, price });
  attempts.push(a);

  // 再試行してよいのは 429 / 一時的5xx / タイムアウトのみ(各最大1回)
  const transient = /^(http_(429|5\d\d)|timeout)$/.test(a.failureKind || '');
  // retryTransientOnly: 上記以外(AccessDenied・その他4xx・Validation・契約系・JSON崩れ等)は再試行しない
  const retryAllowed = cfg.retryTransientOnly ? transient : true;
  if (!a.ok && cfg.maxAutoRetries >= 1 && retryAllowed) {
    // rate limit / 5xx は指数backoff を挟む
    if (transient) await sleep(cfg.backoffMs ?? 1000);
    const b = await attemptOnce({ client, cfg, model, testCase, attemptNo: 2, price });
    attempts.push(b);
    a = b;
  }

  const validation = a.ok ? validateReplies(a.replies, testCase) : null;
  // 試行ごとの原価を別々に出し、実効原価は合算(再試行の課金も落とさない)
  const attemptCosts = attempts.map((x) => costUsdForAttempt(x.usage, price));
  const effectiveUsd = attemptCosts.some((v) => v === null) ? null : attemptCosts.reduce((s, v) => s + v, 0);

  return {
    caseId: testCase.id,
    category: testCase.category,
    bucket: bucketOf(testCase),
    imageCount: testCase.images.length,
    modelKey: model.key,
    modelId: model.modelId,
    inferenceProfileId: model.inferenceProfileId ?? null,
    invocationTarget: model.invocationTarget ?? null,
    domesticPath: model.domesticPath ?? null,
    synthetic: !!client.synthetic,
    success: a.ok,
    failureKind: a.failureKind,
    failureClass: a.failureClass,
    retried: attempts.length > 1,
    attempts: attempts.map((x, i) => ({
      attemptNo: x.attemptNo, latencyMs: x.latencyMs, usage: x.usage,
      ok: x.ok, failureKind: x.failureKind, failureClass: x.failureClass,
      // エラーコード(AccessDeniedException 等)。これが無いと契約系エラーの即停止判定が空振りする
      error: x.error ?? null,
      // 診断用の詳細(サニタイズ済み)。requestId は成功・失敗とも保存(AWSサポート照会用)
      errorCode: x.errorCode ?? null,
      sanitizedErrorMessage: x.sanitizedErrorMessage ?? null,
      httpStatus: x.httpStatus ?? null,
      requestId: x.requestId ?? null,
      modelId: model.modelId,
      caseId: testCase.id,
      apiOperation: x.apiOperation ?? null,
      startedAt: x.startedAt ?? null,
      completedAt: x.completedAt ?? null,
      inputTokens: x.usage?.inputTokens ?? null,
      outputTokens: x.usage?.outputTokens ?? null,
      costUsd: attemptCosts[i],
      // 表示用の正確な10進文字列(浮動小数点の見かけ誤差を除去。不明は null であり 0 でない)
      calculatedCostUsd: formatUsd(attemptCosts[i]),
    })),
    totalLatencyMs: attempts.reduce((s, x) => s + x.latencyMs, 0),
    effectiveCostUsd: effectiveUsd,
    replies: a.ok ? a.replies : null,
    validation,
    at: new Date().toISOString(),
  };
}

/** smoke の Full Run 可否。results.jsonl の全行(resume 前の確定失敗を含む)を正本として判定する。 */
export function computeSmokeGate(rows, threshold = SMOKE_ERROR_THRESHOLD) {
  const byModel = new Map();
  for (const r of rows) {
    const s = byModel.get(r.modelKey) || { total: 0, errors: 0 };
    s.total++;
    if (!r.success) s.errors++;
    byModel.set(r.modelKey, s);
  }
  const gate = {};
  for (const [k, s] of byModel) {
    const errorRate = s.total ? s.errors / s.total : 0;
    gate[k] = { ...s, errorRate, passed: errorRate <= threshold };
  }
  return gate;
}

/** 並列実行。1ケースを2つのworkerが取らないよう、共有インデックスから取り出す。 */
async function runQueue(items, concurrency, worker) {
  let idx = 0;
  const taken = new Set();
  const runOne = async () => {
    for (;;) {
      const i = idx++;
      if (i >= items.length) return;
      if (taken.has(i)) continue; // 二重取得の保険
      taken.add(i);
      await worker(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, runOne));
}

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const stage = args.stage || 'dryrun';
  if (!['dryrun', 'smoke', 'full'].includes(stage)) throw new Error(`未知の stage: ${stage}`);

  const casesRaw = readFileSync(CASES_PATH, 'utf8');
  const data = JSON.parse(casesRaw);
  const cases = data.cases;
  const datasetHash = datasetHashOf(casesRaw);

  // 候補の読み込み(探索結果から。コードにモデル名を持たない)
  const discoveryPath = args.discovery || 'pricing_eval/runs/_discovery/candidate_discovery.json';
  let candidates = [];
  if (existsSync(discoveryPath)) {
    const d = JSON.parse(readFileSync(discoveryPath, 'utf8'));
    candidates = (d.candidates || []).map((c) => ({
      // 呼び出し先は探索が決めた invocationTarget(direct 経路 = base model ID / jp geo 経路 = jp profile ID)。
      // global profile を黙って使わない。
      key: c.invocationTarget || c.inferenceProfileId || c.modelId,
      modelId: c.modelId,
      modelName: c.modelName ?? null,
      inferenceProfileId: c.inferenceProfileId,
      invocationTarget: c.invocationTarget ?? null,
      domesticPath: c.domesticPath ?? null,
      evaluable: c.evaluable,
      adoptionBlocked: c.adoptionBlocked,
      benchmarkOnly: c.benchmarkOnly ?? false,
      fails: c.fails,
    }));
  }
  // モック実行時は器の検査が目的なので、仮想候補を1つ立てる
  if (cfg.adapter === 'mock') {
    candidates = [{ key: `mock:${args.fault || 'none'}`, modelId: 'MOCK', inferenceProfileId: null, evaluable: true, adoptionBlocked: true, fails: [] }];
  }
  if (cfg.modelsFilter) candidates = candidates.filter((c) => cfg.modelsFilter.includes(c.key));

  // Hard Gate 違反は Full Run させない
  const runnable = candidates.filter((c) => c.evaluable);
  const blocked = candidates.filter((c) => !c.evaluable);
  for (const b of blocked) logWarn(`Hard Gate 違反のため実行しません: ${b.key} (${b.fails.join(',')})`);

  let targetCases = stage === 'smoke' ? pickSmokeCases(cases) : cases;
  // 診断用: 1ケースだけに絞る(合成データの実在IDのみ。full の抜け道にはならない)
  if (args['case-id']) {
    const one = cases.find((c) => c.id === args['case-id']);
    if (!one) throw new Error(`--case-id=${args['case-id']} が cases.json に存在しません`);
    targetCases = [one];
  }

  // 価格
  const pricing = loadPricing();
  // 価格表のキーは表示名(例: "Nova Lite")なので、profile ID / model ID / 表示名の順に引く
  const priceFor = (m) => pricing.models[m.key] || pricing.models[m.modelId] || (m.modelName ? pricing.models[m.modelName] : null) || null;
  const priceKnown = runnable.filter((m) => priceFor(m));

  // --- dryrun: 実行せず見積りだけ ---
  const estimate = estimateBudget({ runnable, targetCases, pricing, priceFor, cfg, stage });

  if (stage === 'dryrun') {
    const out = { at: new Date().toISOString(), stage, cases: targetCases.length, candidates: candidates.length, runnable: runnable.length, blocked: blocked.map((b) => ({ key: b.key, fails: b.fails })), estimate };
    const dir = join(RUNS_DIR, '_discovery'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'dryrun.json'), JSON.stringify(out, null, 2));
    logInfo('dry-run 見積り', { cases: targetCases.length, runnable: runnable.length, blocked: blocked.length });
    logInfo(estimate.note);
    return;
  }

  // --- 実行前ゲート ---
  if (cfg.adapter !== 'mock') {
    const pf = await runPreflight(cfg);
    if (!pf.allowModelEvaluation) {
      logError('preflight 未通過のため実行しません:');
      for (const b of pf.blockers) logError(` - ${b}`);
      process.exitCode = 2;
      return;
    }
  }
  if (!runnable.length) { logError('実行可能な候補がありません'); process.exitCode = 2; return; }

  if (estimate.maxJpy !== null && estimate.maxJpy > cfg.maxBudgetJpy) {
    logError(`見積り上限 ${Math.round(estimate.maxJpy)} 円が予算 ${cfg.maxBudgetJpy} 円を超えるため実行しません`);
    process.exitCode = 2;
    return;
  }

  // --- run ディレクトリ / resume ---
  const runId = args['run-id'] || newRunId(stage);
  cfg.runId = runId; // call_log の STARTED に run を刻む
  const dir = join(RUNS_DIR, runId);
  mkdirSync(dir, { recursive: true });
  const resultsPath = join(dir, 'results.jsonl');
  const { rows: done, truncated } = readResults(resultsPath);
  if (truncated) logWarn(`results.jsonl の壊れた行を ${truncated} 行無視しました(resume の安全側)`);
  const doneKeys = new Set(done.filter((r) => r.success || r.finalFailure).map((r) => keyOf(r.modelKey, r.caseId)));
  if (done.length) logInfo(`resume: 済み ${doneKeys.size} 件をスキップします`, { runId });

  const manifestPath = join(dir, 'run_manifest.json');
  if (!existsSync(manifestPath)) {
    writeFileSync(manifestPath, JSON.stringify({
      runId, stage, at: new Date().toISOString(),
      datasetSeed: data.seed, caseCount: targetCases.length,
      caseIds: targetCases.map((c) => c.id),
      candidates: runnable.map((m) => ({ key: m.key, modelId: m.modelId, inferenceProfileId: m.inferenceProfileId, adoptionBlocked: m.adoptionBlocked })),
      blocked: blocked.map((b) => ({ key: b.key, fails: b.fails })),
      config: { region: cfg.region, adapter: cfg.adapter, outputMaxTokens: cfg.outputMaxTokens, temperature: cfg.temperature, maxAutoRetries: cfg.maxAutoRetries, usdJpy: cfg.usdJpy, maxBudgetJpy: cfg.maxBudgetJpy, priorSpentUsd: Number(args['prior-spent-usd']) || 0 },
      estimate,
    }, null, 2));
  }

  // --- 実行 ---
  const creds = cfg.adapter === 'mock' ? null : (resolveCredentials()?.credentials ?? null);
  // 既発生費用を累計予算へ算入する(--prior-spent-usd)。今回runの支出はこの上に積む。
  const priorSpentUsd = Number(args['prior-spent-usd']) || 0;
  let spentUsd = priorSpentUsd;
  if (priorSpentUsd > 0) logInfo('既発生費用を予算へ算入します', { priorSpentUsd: formatUsd(priorSpentUsd) });
  let unknownCostRows = 0; // 原価不明の件数。0円と混同しないため別に数える。
  const smokeStats = new Map();
  // 実行台帳: 同一 (modelId, caseId, datasetHash, promptHash, configHash) の成功は再実行しない
  const ledger = cfg.adapter === 'mock' ? new Map() : loadLedger();

  for (const model of runnable) {
    const client = cfg.adapter === 'mock'
      ? createMockClient({ fault: args.fault || 'none' })
      : createBedrockClient({ region: cfg.region, credentials: creds });
    const price = priceFor(model);
    const hashesFor = (c) => ({
      modelId: model.modelId,
      caseId: c.id,
      datasetHash,
      promptHash: promptHashOf({ system: SYSTEM_INSTRUCTION, userText: buildUserText(c), imageFiles: c.images }),
      configHash: configHashOf({
        region: cfg.region,
        invocationTarget: model.invocationTarget || model.inferenceProfileId || model.modelId,
        outputMaxTokens: cfg.outputMaxTokens, temperature: cfg.temperature, maxImages: cfg.maxImages,
      }),
    });
    const reused = [];
    const todo = [];
    for (const c of targetCases) {
      if (doneKeys.has(keyOf(model.key, c.id))) continue;
      if (cfg.adapter !== 'mock') {
        const prev = ledger.get(ledgerKey(hashesFor(c)));
        if (prev) { reused.push({ caseId: c.id, fromRunId: prev.runId ?? null }); continue; }
      }
      todo.push(c);
    }
    if (reused.length) logInfo(`台帳の成功済みケースを再利用します(全ハッシュ一致・再実行しない): ${model.key}`, { reused });
    logInfo(`実行開始 ${model.key}`, { todo: todo.length, reused: reused.length, skipped: targetCases.length - todo.length - reused.length });

    let errors = 0, total = 0;
    // --slow-ms はテストで「実行途中に kill する」状況を作るためだけの遅延。本番では使わない。
    const slowMs = Number(args['slow-ms']) || 0;
    await runQueue(todo, cfg.concurrency, async (testCase) => {
      if (slowMs) await sleep(slowMs);
      // 予算不足は呼び出し「前」に止める: 次の1ケースの worst-case(最大入力+最大出力×再試行込み)を先取り検査
      if (price && cfg.usdJpy) {
        const perCallWorstUsd = ((16000 / 1e6) * price.inputPerMTokUsd + (cfg.outputMaxTokens / 1e6) * price.outputPerMTokUsd) * (1 + cfg.maxAutoRetries);
        if ((spentUsd + perCallWorstUsd) * cfg.usdJpy > cfg.maxBudgetJpy) {
          throw new Error(`次の呼び出しの worst-case で予算上限 ${cfg.maxBudgetJpy} 円を超えうるため、呼び出し前に停止します(既発生費用 ${formatUsd(priorSpentUsd)} USD を含む)`);
        }
      }
      const row = await runCase({ client, cfg, model, testCase, price });
      row.runId = runId; row.stage = stage;
      row.finalFailure = !row.success; // 再試行後も失敗 = 確定失敗。resume で再実行しない。
      appendFileSync(resultsPath, JSON.stringify(row) + '\n');
      // 成功は実行台帳へ記録(生応答は書かない。usage・費用・requestId のみ)
      if (row.success && cfg.adapter !== 'mock') {
        const okAttempt = row.attempts.find((x) => x.ok);
        appendLedger({
          ...hashesFor(testCase), success: true, runId, at: row.at,
          requestId: okAttempt?.requestId ?? null,
          inputTokens: okAttempt?.inputTokens ?? null,
          outputTokens: okAttempt?.outputTokens ?? null,
          calculatedCostUsd: formatUsd(row.effectiveCostUsd),
        });
      }
      // 契約・権限・購読・モデルアクセス系のエラーは再試行も継続もせず即停止(人間操作が必要)
      const stopMsg = contractStopError(row);
      if (stopMsg) throw new Error(stopMsg);
      total++; if (!row.success) errors++;
      if (row.effectiveCostUsd == null) unknownCostRows++;
      if (row.effectiveCostUsd != null) {
        spentUsd += row.effectiveCostUsd;
        if (cfg.usdJpy && spentUsd * cfg.usdJpy > cfg.maxBudgetJpy) {
          throw new Error(`予算上限 ${cfg.maxBudgetJpy} 円に到達したため中断します`);
        }
      }
    });
    smokeStats.set(model.key, { total, errors, errorRate: total ? errors / total : 0 });
  }

  // --- smoke の合否 ---
  // 判定は「この起動で実行した分」でなく results.jsonl の全行(resume 前の失敗を含む)から出す。
  if (stage === 'smoke') {
    const { rows: allRows } = readResults(resultsPath);
    const gate = computeSmokeGate(allRows, SMOKE_ERROR_THRESHOLD);
    for (const [k, g] of Object.entries(gate)) {
      logInfo(`smoke ${k}: エラー率 ${(g.errorRate * 100).toFixed(1)}% (全${g.total}件) → ${g.passed ? 'Full Run 可' : 'Full Run 不可'}`);
    }
    writeFileSync(join(dir, 'smoke_gate.json'), JSON.stringify({ threshold: SMOKE_ERROR_THRESHOLD, gate }, null, 2));
  }

  logInfo('実行完了', {
    runId, dir,
    // 原価不明を 0 円と表示しない。表示は formatUsd で正確な10進(浮動小数点の見かけ誤差を出さない)
    thisRunUsd: unknownCostRows ? `${formatUsd(spentUsd - priorSpentUsd)} (+原価不明 ${unknownCostRows} 件)` : formatUsd(spentUsd - priorSpentUsd),
    cumulativeUsd: formatUsd(spentUsd),
  });
  if (unknownCostRows) logWarn(`原価不明が ${unknownCostRows} 件あります。価格を pricing_override.json に転記するまで実費は確定しません(0円ではありません)。`);
  logInfo(`レポート生成: node pricing_eval/src/report.mjs --run-id=${runId}` + (cfg.usdJpy ? ` --usd-jpy=${cfg.usdJpy}` : ''));
}

function estimateBudget({ runnable, targetCases, pricing, priceFor, cfg, stage }) {
  const withPrice = runnable.filter((m) => priceFor(m));
  const without = runnable.filter((m) => !priceFor(m));
  if (!runnable.length) return { maxUsd: null, maxJpy: null, note: '候補が無いため見積れません', unknownPriceModels: [] };
  if (without.length) {
    return {
      maxUsd: null, maxJpy: null,
      unknownPriceModels: without.map((m) => m.key),
      note: `価格不明のモデルが ${without.length} 件あるため上限費用を見積れません。` +
            'pricing_override.json に公式価格を転記するまで、費用を 0 とはみなしません。',
    };
  }
  // 上限見積り: 全ケースが最大入力 + 再試行1回。候補別の smoke / full 上限も出す(§6)。
  const fullCalls = targetCases.length * (1 + cfg.maxAutoRetries);
  const smokeCalls = pickSmokeCases(targetCases).length * (1 + cfg.maxAutoRetries);
  const inTok = 16000, outTok = cfg.outputMaxTokens;
  const jpyOrNull = (usd) => { try { return toJpy(usd, cfg); } catch { return null; } };
  let maxUsd = 0;
  const perModel = [];
  for (const m of withPrice) {
    const p = priceFor(m);
    const perCall = (inTok / 1e6) * p.inputPerMTokUsd + (outTok / 1e6) * p.outputPerMTokUsd;
    const fullUsd = fullCalls * perCall;
    const smokeUsd = smokeCalls * perCall;
    maxUsd += stage === 'smoke' ? smokeUsd : fullUsd;
    perModel.push({
      key: m.key, modelId: m.modelId,
      smokeMaxUsd: Number(smokeUsd.toFixed(4)), smokeMaxJpy: jpyOrNull(smokeUsd) === null ? null : Math.round(jpyOrNull(smokeUsd)),
      fullMaxUsd: Number(fullUsd.toFixed(4)), fullMaxJpy: jpyOrNull(fullUsd) === null ? null : Math.round(jpyOrNull(fullUsd)),
    });
  }
  const maxJpy = jpyOrNull(maxUsd);
  return {
    maxUsd, maxJpy, unknownPriceModels: [], perModel,
    note: maxJpy === null
      ? `上限 $${maxUsd.toFixed(2)}。USD/JPY 未指定のため円は出しません(--usd-jpy で明示)。`
      : `上限 $${maxUsd.toFixed(2)} = 約 ${Math.round(maxJpy)} 円(予算 ${cfg.maxBudgetJpy} 円)`,
  };
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { logError(e.message); process.exit(1); });
}
