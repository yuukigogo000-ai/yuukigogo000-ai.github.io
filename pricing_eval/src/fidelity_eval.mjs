// 本番プロンプト追従テスト(fidelity eval)。
//
// 目的: 料金評価(中立contract)では測っていない「本番 REPLY_SYSTEM / REPLY_SCHEMA への追従性」を
// 上位候補モデルで実測する。本番コード(reply-ai-app/)は一切変更しない。
//
// 忠実性の担保:
//  - system = reply-ai-app/src/lib/prompts.ts の REPLY_SYSTEM を実行時に無劣化抽出(手写ししない)
//  - user   = ReplyTab.tsx と同じ組み立て(相手プロフィール/文体サンプル/会話/ゴール/トーン/吹き出しの分け方)
//  - 唯一の相違 = 本番は Anthropic tool-use で REPLY_SCHEMA を強制するが、汎用モデルには
//    テキストで schema を渡す(この相違はレポートに明記する。テキストschemaへの追従も測定対象)
//
// 安全: 読み取り+Converse のみ。予算は呼び出し前に既発生費用込みで検査。
// 再試行は 429/5xx/timeout のみ1回。契約系/その他4xx は即停止(contractStopError を共用)。
//
// 使い方:
//   node pricing_eval/src/fidelity_eval.mjs --models=<id> --usd-jpy=160 --max-budget-jpy=10000 \
//     --prior-spent-usd=<usd> --run-id=<id> [--tool-use] [--case-offset=5]
//
// --tool-use: 本番採用構成(Converse toolConfig で REPLY_SCHEMA を強制・schemaテキストは付けない)。
//             省略時は従来どおりテキストで schema を渡す。

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logWarn, logError } from './lib/log.mjs';
import { createBedrockClient, resolveCredentials, buildConverseBody, extractConverse, sanitizeAwsMessage } from './adapters/bedrock.mjs';
import { costUsdForAttempt, loadPricing, formatUsd } from './calculate_cost.mjs';
import { contractStopError, readResults } from './run_eval.mjs';
import { parseProductionReply, checkStyleRules, checkUngroundedNames, checkFabricationHints, extractToolUse } from './lib/fidelity_checks.mjs';
import { datasetHashOf, promptHashOf, configHashOf, ledgerKey, loadLedger, appendLedger } from './lib/ledger.mjs';
import { fidelityStopReason } from './lib/fidelity_checks.mjs';
import { runPreflight } from './retention_preflight.mjs';
import { callStarted, callEnded, loadCallLog, unaccountedCalls, unaccountedWorstCaseUsd, recordedSpendUsd } from './lib/call_log.mjs';

/**
 * 実行前の fail-closed 再確認(--confirm-run)。1つでも満たさなければ呼び出しゼロで停止。
 *  expected = { arnTail, accountMask, datasetHash }(前回確証runと保存済み preflight から機械的に取る)
 */
export function assertRunPreconditions({ preflight, cfg, datasetHash, expected, priorSpentUsd, priorSpentGiven, callLogBroken = 0 }) {
  const blockers = [];
  if (callLogBroken > 0) blockers.push(`call_log.jsonl に壊れた行が ${callLogBroken} 件(STARTED が失われている可能性)。修復するまで確証runを実行しない`);
  if (cfg.region !== 'ap-northeast-1') blockers.push(`region が東京でない(${cfg.region})`);
  if (!preflight?.allowModelEvaluation) blockers.push(`preflight 不合格: ${(preflight?.blockers || ['report無し']).join(' / ')}`);
  if (preflight?.retention?.mode !== 'none' || preflight?.retention?.ok !== true) blockers.push(`retention が none でない(${preflight?.retention?.mode})`);
  if (preflight?.region !== 'ap-northeast-1') blockers.push(`preflight の region が東京でない(${preflight?.region})`);
  if (!expected?.arnTail || preflight?.identity?.arnTail !== expected.arnTail) blockers.push(`IAM主体が期待と異なる(${preflight?.identity?.arnTail} ≠ ${expected?.arnTail})`);
  if (!expected?.accountMask || preflight?.identity?.account !== expected.accountMask) blockers.push('AWSアカウント(マスク)が期待と異なる');
  if (!expected?.datasetHash || datasetHash !== expected.datasetHash) blockers.push(`cases.json のハッシュが前回確証runと異なる(${String(datasetHash).slice(0, 12)}… ≠ ${String(expected?.datasetHash).slice(0, 12)}…)`);
  if (!(cfg.maxBudgetJpy > 0) || cfg.maxBudgetJpy > 10000) blockers.push(`予算上限が不正(${cfg.maxBudgetJpy}円。上限10,000円)`);
  if (!priorSpentGiven || !(priorSpentUsd > 0)) blockers.push('--prior-spent-usd(既発生費用)が未指定。累計を0から数える実行は禁止');
  // 契約: prior は「記録済み費用」のみ(UNKNOWN の worst-case はツールが別枠で加える)。成果物の合計と一致しなければ停止(二重計上・過少申告の両方を防ぐ)
  if (expected?.recordedSpendUsd != null && Math.abs(priorSpentUsd - expected.recordedSpendUsd) > 1e-6) blockers.push(`--prior-spent-usd(${priorSpentUsd})が成果物の記録済み費用合計(${expected.recordedSpendUsd})と一致しない。UNKNOWN の worst-case を含めていないか/最新か確認`);
  if (!(cfg.usdJpy > 0)) blockers.push('usdJpy 未設定');
  return blockers;
}

const RUNS_DIR = 'pricing_eval/runs';
const PROMPTS_TS = 'reply-ai-app/src/lib/prompts.ts';
export const CASES_PER_CATEGORY = 5;
export const DEFAULT_DATASET = 'pricing_eval/cases.json';
// 合成データの生成器(これ以外の generated_by は実データ扱いで実行禁止)
export const SYNTHETIC_GENERATORS = new Set(['generate_cases.mjs', 'generate_cases_fab10.mjs']);

/** 合格条件セット。confirm30 = 30件・再生成≤3(2026-09-01 A+C)/ confirm10 = 10件・再生成≤1(Qwen 限定評価) */
export function parsePassCriteria(name) {
  if (name == null) return null;
  const table = { confirm30: { expectedCases: 30, maxRegenerated: 3 }, confirm10: { expectedCases: 10, maxRegenerated: 1 } };
  if (!table[name]) throw new Error(`未知の pass-criteria: ${name}(confirm30 / confirm10)`);
  return { name, ...table[name] };
}

/**
 * 確証runで照合する dataset ハッシュの期待値。既定 dataset は前回確証runの台帳から機械的に取る。
 * 別 dataset(cases_fab10.json 等)は --dataset-hash(生成器が表示した sha256 の転記)が必須。無ければ実行しない。
 */
export function expectedDatasetHashFor({ datasetPath, datasetHashArg, prevLedgerHash }) {
  if (datasetHashArg != null) {
    const h = String(datasetHashArg).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(h)) throw new Error('--dataset-hash は sha256(16進64桁)で指定する');
    return h;
  }
  if (datasetPath !== DEFAULT_DATASET) throw new Error(`既定以外の dataset(${datasetPath})の確証runには --dataset-hash が必須(生成器が表示した sha256 を転記)`);
  return prevLedgerHash ?? null;
}

/** 同じケースを n 回並べる(repeatNo 1..n)。確証run「TXT_SHORT_07 を5回」用。台帳再利用は fresh で切ること */
export function expandRepeats(cases, n = 1) {
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error(`repeat は 1〜10(${n})`);
  const out = [];
  for (const c of cases) for (let r = 1; r <= n; r++) out.push({ ...c, repeatNo: r });
  return out;
}

/** nearest-rank 法の分位点(ms)。空なら null */
export function percentiles(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0, p50: null, p90: null, p95: null, max: null };
  const at = (p) => v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))];
  return { n: v.length, p50: at(0.5), p90: at(0.9), p95: at(0.95), max: v[v.length - 1] };
}

/**
 * 確証run(30件)の合格条件(2026-09-01 発注者決定): 最終成功 30/30・最終schema違反 0・placeholder 0・捏造 0・
 * 初回違反→再生成 ≤3・120秒タイムアウト 0。latency は全モデル呼び出し(試行)単位で p50/p90/p95/max。
 */
export function evaluateConfirmCriteria(rows, { expectedCases = 30, maxRegenerated = 3, timeoutMs = 120000 } = {}) {
  const finalViol = (r, rule) => (r.fidelity?.violations || []).some((v) => v.rule === rule);
  const attempts = rows.flatMap((r) => r.attempts || []);
  const timeouts = attempts.filter((a) => a.failureKind === 'timeout' || (typeof a.latencyMs === 'number' && a.latencyMs >= timeoutMs)).length;
  const c = {
    cases: rows.length,
    finalSuccess: rows.filter((r) => r.success).length,
    finalSchemaViolations: rows.filter((r) => !r.success && r.failureClass === 'model_output').length,
    finalSystemFailures: rows.filter((r) => !r.success && r.failureClass !== 'model_output').length,
    placeholder: rows.filter((r) => r.success && finalViol(r, 'placeholder')).length,
    fabrication: rows.filter((r) => r.success && finalViol(r, 'ungrounded_name')).length,
    // 補助検出器の候補(漢字/ひらがな店名・地名+店名・体験談の言い回し)。合格条件ではない=人間確認の入口
    fabricationHints: rows.filter((r) => r.success && finalViol(r, 'fabrication_hint')).length,
    interestLevelEmitted: rows.filter((r) => r.production && Object.prototype.hasOwnProperty.call(r.production, 'interest_level')).length,
    firstAttemptViolations: rows.filter((r) => r.firstAttemptViolation).length,
    regenerated: rows.filter((r) => r.regenerated).length,
    timeouts,
    modelCalls: attempts.length,
    latency: percentiles(attempts.map((a) => a.latencyMs)),
  };
  const failed = [];
  if (c.cases !== expectedCases) failed.push(`件数 ${c.cases}/${expectedCases}`);
  if (c.finalSuccess !== expectedCases) failed.push(`最終成功 ${c.finalSuccess}/${expectedCases}`);
  if (c.finalSchemaViolations) failed.push(`最終schema違反 ${c.finalSchemaViolations}`);
  if (c.placeholder) failed.push(`placeholder ${c.placeholder}`);
  if (c.fabrication) failed.push(`捏造候補 ${c.fabrication}`);
  if (c.interestLevelEmitted) failed.push(`interest_level 混入 ${c.interestLevelEmitted}`);
  if (c.regenerated > maxRegenerated) failed.push(`再生成 ${c.regenerated} > ${maxRegenerated}`);
  if (c.timeouts) failed.push(`120秒タイムアウト ${c.timeouts}`);
  return { ...c, pass: failed.length === 0, failedConditions: failed, note: '自動評価の「捏造候補 0」は検出器の範囲内の話で、捏造ゼロの断定ではない(漢字・ひらがなの固有名詞・体験談は補助候補 fabricationHints で提示するだけで完全検出はできない)。人間確認ページで全件を見ること' };
}

/** prompts.ts(TypeScript)から REPLY_SYSTEM / REPLY_SCHEMA を無劣化で取り出す */
export async function loadProductionPrompts(tsPath = PROMPTS_TS, tmpDir = join(RUNS_DIR, '_summary')) {
  const src = readFileSync(tsPath, 'utf8');
  const js = src.replace(/ as const/g, '');
  mkdirSync(tmpDir, { recursive: true });
  const tmp = join(tmpDir, '_prompts_extracted.mjs');
  writeFileSync(tmp, js);
  const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
  if (!mod.REPLY_SYSTEM || mod.REPLY_SYSTEM.length < 3000) throw new Error('REPLY_SYSTEM の抽出に失敗(短すぎる)');
  if (!mod.REPLY_SCHEMA?.properties?.replies || !mod.REPLY_SCHEMA?.properties?.situation) throw new Error('REPLY_SCHEMA の抽出に失敗');
  if (mod.REPLY_SCHEMA.properties.interest_level || (mod.REPLY_SCHEMA.required || []).includes('interest_level')) throw new Error('REPLY_SCHEMA に除去済みの interest_level が残っている');
  const rep = mod.REPLY_SCHEMA.properties.replies;
  if (rep?.minItems !== 3 || rep?.maxItems !== 3) throw new Error('REPLY_SCHEMA.replies に minItems/maxItems=3 が無い(6案事故の対策・2026-09-01 決定)');
  return { REPLY_SYSTEM: mod.REPLY_SYSTEM, REPLY_SCHEMA: mod.REPLY_SCHEMA };
}

// ReplyTab.tsx の SPLIT_PROMPT.auto / トーン auto と同一文言(出典: reply-ai-app/src/components/ReplyTab.tsx)
const TONE_AUTO = '指定なし。「自分」の過去メッセージの文体・テンションから本人らしさを最優先で再現する';
const SPLIT_AUTO = '会話の場(LINEかアプリ内か)と相手の吹き出し数から判断する';

/** ReplyTab.tsx と同じ形の user prompt を評価ケースから組む */
export function buildProductionUserPrompt(c, schema) {
  let p = `## 相手のプロフィール\n${c.partner_profile ? `${c.partner_profile.nickname}: ${c.partner_profile.note}` : '(情報なし)'}\n\n`;
  if (c.style_sample) p += `## 本人の普段の文体サンプル(文体抽出の最優先材料にすること)\n${c.style_sample}\n\n`;
  if (c.images && c.images.length) {
    p += `## 会話(添付スクショ${c.images.length}枚を時系列順に読み取ること)\n`;
  }
  if (!c.images || !c.images.length) {
    const lines = c.conversation.map((t) => `${t.from === 'self' ? '自分' : '相手'}: ${t.text}`).join('\n');
    p += `## 会話(テキスト)\n${lines}\n\n`;
  }
  p += `## 今回のゴール\n${c.goal}\n\n`;
  p += `## トーン\n${TONE_AUTO}\n`;
  p += `\n## 吹き出しの分け方\n${SPLIT_AUTO}\n`;
  p += `\nこの状況に最適な返信を3案提案してください。`;
  // 本番は tool-use で schema を強制する。汎用モデルにはテキストで渡す(相違点・レポート明記)。
  // toolConfig 検証時は schema を渡さない(本番と同じく tool 側で強制するため)。
  if (schema) {
    p += `\n\n## 出力形式(厳守)\n次の JSON Schema に適合する JSON オブジェクトだけを出力する。説明文やコードブロック記号を前後に付けない。\n${JSON.stringify(schema)}`;
  }
  return p;
}

/** 各区分の先頭 N 件(決定的な選定。ランダム抽出しない)。offset=区分ごとに読み飛ばす件数(追加30ケース=offset 5 で前回30件と重複しない次の5件/区分) */
export function pickFidelityCases(cases, perCategory = CASES_PER_CATEGORY, offset = 0) {
  if (!Number.isInteger(offset) || offset < 0) throw new Error(`case-offset は0以上の整数(${offset})`);
  const byCat = new Map();
  const out = [];
  for (const c of cases) {
    const n = byCat.get(c.category) || 0;
    if (n >= offset && n < offset + perCategory) out.push(c);
    byCat.set(c.category, n + 1);
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  if (!cfg.retryTransientOnly) throw new Error('--retry-transient-only が必須です');
  const runId = args['run-id'] || `fidelity_${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}`;
  const priorSpentGiven = args['prior-spent-usd'] !== undefined;
  const priorSpentUsd = Number(args['prior-spent-usd']) || 0;
  const toolUse = args['tool-use'] === true;
  const stopOnViolation = args['stop-on-violation'] === true;
  const confirmRun = args['confirm-run'] === true; // 確証run: 実行前 fail-closed 再確認+1件目の違反で停止
  const fresh = confirmRun || args.fresh === true; // 台帳の成功済みを再利用しない(確証runは独立した30件として数える)
  const regenerateOnce = args['regenerate-once'] === true; // 本番同様: 初回応答に違反があれば1回だけ再生成(初回違反は独立に記録)
  const repeat = args.repeat === undefined ? 1 : Number(args.repeat);
  const maxFirstViolations = args['max-first-violations'] === undefined ? null : Number(args['max-first-violations']);
  if (maxFirstViolations != null && (!Number.isInteger(maxFirstViolations) || maxFirstViolations < 0)) throw new Error('max-first-violations は0以上の整数');
  const passCriteria = args['pass-criteria'] ? String(args['pass-criteria']) : null;
  const criteriaSpec = parsePassCriteria(passCriteria);
  const datasetPath = args.dataset ? String(args.dataset) : DEFAULT_DATASET;
  const perCategory = args['per-category'] === undefined ? CASES_PER_CATEGORY : Number(args['per-category']);
  if (!Number.isInteger(perCategory) || perCategory < 1) throw new Error('per-category は1以上の整数');
  const expectedCases = args['expected-cases'] === undefined ? 6 * CASES_PER_CATEGORY : Number(args['expected-cases']);
  if (!Number.isInteger(expectedCases) || expectedCases < 1) throw new Error('expected-cases は1以上の整数');
  if (criteriaSpec && criteriaSpec.expectedCases !== expectedCases && !args.cases && (args.repeat === undefined)) throw new Error(`pass-criteria ${passCriteria} は ${criteriaSpec.expectedCases} 件用。--expected-cases=${expectedCases} と食い違う`);

  const { REPLY_SYSTEM, REPLY_SCHEMA } = await loadProductionPrompts();
  const casesRaw = readFileSync(datasetPath, 'utf8');
  // 違反時の出力本文(invalidOutput)を保存してよいのは合成評価データだけ。本番コードでは保存禁止(発注者決定 2026-09-01)
  const syntheticDataset = SYNTHETIC_GENERATORS.has(JSON.parse(casesRaw).generated_by);
  if (!syntheticDataset) throw new Error(`${datasetPath} が合成データ(${[...SYNTHETIC_GENERATORS].join('/')})でない。実データに対する fidelity 実行は禁止`);
  const caseOffset = args['case-offset'] === undefined ? 0 : Number(args['case-offset']);
  let cases = pickFidelityCases(JSON.parse(casesRaw).cases, perCategory, caseOffset);
  if (cases.length !== expectedCases) throw new Error(`選定件数が${expectedCases}件でない(${cases.length}件・per-category=${perCategory}・case-offset=${caseOffset})`);
  // スポット検証用: 指定ケースだけに絞る(選定30ケースの範囲内のみ)
  if (args.cases) {
    const want = String(args.cases).split(',').map((s) => s.trim()).filter(Boolean);
    cases = cases.filter((c) => want.includes(c.id));
    if (cases.length !== want.length) throw new Error(`--cases に選定外/不明なIDが含まれています(${cases.length}/${want.length}件のみ一致)`);
  }
  cases = expandRepeats(cases, repeat);
  const datasetHash = datasetHashOf(casesRaw);

  let preflightReport = null;
  if (confirmRun) {
    if (!toolUse || !stopOnViolation) throw new Error('--confirm-run は --tool-use と --stop-on-violation が必須');
    // 期待値は前回の確証run(fidelity_tooluse_kimi)の台帳と保存済み preflight から取る(手打ちしない)
    const prevLedger = readFileSync(join(RUNS_DIR, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .find((r) => r && r.runId === 'fidelity_tooluse_kimi' && r.success);
    const prevPre = JSON.parse(readFileSync(join(RUNS_DIR, '_discovery', 'preflight.json'), 'utf8'));
    const expected = { arnTail: prevPre?.identity?.arnTail, accountMask: prevPre?.identity?.account, datasetHash: expectedDatasetHashFor({ datasetPath, datasetHashArg: args['dataset-hash'], prevLedgerHash: prevLedger?.datasetHash }), recordedSpendUsd: recordedSpendUsd(RUNS_DIR).sum };
    preflightReport = await runPreflight(cfg);
    const blockers = assertRunPreconditions({ preflight: preflightReport, cfg, datasetHash, expected, priorSpentUsd, priorSpentGiven, callLogBroken: loadCallLog().broken });
    mkdirSync(join(RUNS_DIR, runId), { recursive: true });
    writeFileSync(join(RUNS_DIR, runId, 'preflight_recheck.json'), JSON.stringify({ at: new Date().toISOString(), preflight: preflightReport, expected, datasetHash, blockers, passed: blockers.length === 0 }, null, 2));
    if (blockers.length) throw new Error(`実行前再確認に不合格(呼び出しゼロで停止): ${blockers.join(' / ')}`);
    logInfo('実行前再確認 PASS', { region: cfg.region, retention: preflightReport.retention.mode, identity: preflightReport.identity.arnTail, datasetHash: datasetHash.slice(0, 12), maxBudgetJpy: cfg.maxBudgetJpy, priorSpentUsd });
  }

  // 候補は discovery から(モデル名をコードに書かない)。価格必須。
  const discovery = JSON.parse(readFileSync(join(RUNS_DIR, '_discovery', 'candidate_discovery.json'), 'utf8'));
  const wanted = String(args.models || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!wanted.length) throw new Error('--models=<modelId,...> を指定してください');
  const pricing = loadPricing();
  const models = wanted.map((id) => {
    const c = (discovery.candidates || []).find((x) => x.modelId === id);
    if (!c) throw new Error(`${id} が discovery に無い`);
    if (!c.evaluable) throw new Error(`${id} は Hard Gate 違反(${(c.fails || []).join(',')})`);
    const price = pricing.models[id] || pricing.models[c.invocationTarget] || (c.modelName ? pricing.models[c.modelName] : null);
    if (!price || price.inputPerMTokUsd == null) throw new Error(`${id} の official 価格が無い(呼び出し禁止)`);
    return { key: c.invocationTarget || id, modelId: id, invocationTarget: c.invocationTarget || id, price };
  });

  const dir = join(RUNS_DIR, runId);
  mkdirSync(dir, { recursive: true });
  const resultsPath = join(dir, 'results.jsonl');
  const { rows: done } = readResults(resultsPath);
  const doneKeys = new Set(done.map((r) => `${r.modelId}::${r.caseId}#${r.repeatNo ?? 1}`));

  writeFileSync(join(dir, 'run_manifest.json'), JSON.stringify({
    runId, kind: 'production_prompt_fidelity', at: new Date().toISOString(), caseOffset, fresh, confirmRun, stopOnViolation, syntheticDataset,
    dataset: datasetPath, datasetHash, perCategory, expectedCases,
    regenerateOnce, repeat, maxFirstViolations, passCriteria,
    systemSource: PROMPTS_TS, systemLength: REPLY_SYSTEM.length,
    schemaDelivery: toolUse ? 'tool-use(Converse toolConfig=本番採用構成)' : 'text(本番はtool-use。相違点として明記)',
    cases: cases.map((c) => c.id),
    models: models.map((m) => m.modelId),
    config: { region: cfg.region, outputMaxTokens: cfg.outputMaxTokens, temperature: cfg.temperature, maxAutoRetries: cfg.maxAutoRetries, usdJpy: cfg.usdJpy, maxBudgetJpy: cfg.maxBudgetJpy, priorSpentUsd },
  }, null, 2));

  const creds = resolveCredentials()?.credentials ?? null;
  const ledger = loadLedger();
  let spentUsd = priorSpentUsd;
  let firstViolationCount = 0; // 初回応答の違反件数(再生成で救えても数える)
  // 台帳外の呼び出しをなくす: 終端の無い STARTED(=UNKNOWN_OUTCOME)は worst-case で先に計上する
  const callLog = loadCallLog();
  const unknowns = unaccountedCalls(callLog.rows);
  const unknownUsd = unaccountedWorstCaseUsd(callLog.rows);
  spentUsd += unknownUsd;
  if (unknowns.length) logWarn('費用不明の呼び出し(UNKNOWN_OUTCOME / 終端あり費用null)を worst-case で予算に計上', { count: unknowns.length, worstCaseUsd: formatUsd(unknownUsd), callIds: unknowns.map((u) => `${u.callId}:${u.reason}`) });
  if (callLog.broken) throw new Error(`call_log に壊れた行が ${callLog.broken} 件。予算契約の一部なので修復するまで実行しない`);

  for (const model of models) {
    const client = createBedrockClient({ region: cfg.region, credentials: creds });
    const hashesFor = (c) => ({
      modelId: model.modelId, caseId: c.id, datasetHash,
      promptHash: promptHashOf({
        // tool-use 時は schema テキスト無し+toolConfig 強制なので別プロンプト扱い(接頭辞で区別)
        system: (toolUse ? 'TOOL_USE ' : '') + REPLY_SYSTEM,
        userText: buildProductionUserPrompt(c, toolUse ? null : REPLY_SCHEMA),
        imageFiles: c.images,
      }),
      configHash: configHashOf({ region: cfg.region, invocationTarget: model.invocationTarget, outputMaxTokens: cfg.outputMaxTokens, temperature: cfg.temperature, maxImages: cfg.maxImages }),
    });
    const todo = [];
    let reused = 0;
    for (const c of cases) {
      if (doneKeys.has(`${model.modelId}::${c.id}#${c.repeatNo ?? 1}`)) continue;
      if (!fresh && ledger.get(ledgerKey(hashesFor(c)))) { reused++; continue; }
      todo.push(c);
    }
    logInfo(`fidelity 実行開始 ${model.modelId}`, { todo: todo.length, reused, skipped: cases.length - todo.length - reused });

    for (const c of todo) {
      // 呼び出し前の予算検査(worst-case・再試行込み・再生成込み・既発生費用込み)
      const perCallWorst = ((16000 / 1e6) * model.price.inputPerMTokUsd + (cfg.outputMaxTokens / 1e6) * model.price.outputPerMTokUsd) * (1 + cfg.maxAutoRetries) * (regenerateOnce ? 2 : 1);
      if (cfg.usdJpy && (spentUsd + perCallWorst) * cfg.usdJpy > cfg.maxBudgetJpy) {
        throw new Error(`予算上限 ${cfg.maxBudgetJpy} 円に達するため呼び出し前に停止します`);
      }
      const allAttempts = [];
      const generations = [];
      let attempts = [];
      let final = null;
      let fidelity = null;
      for (let generation = 1; generation <= (regenerateOnce ? 2 : 1); generation++) {
      attempts = [];
      final = null;
      fidelity = null;
      for (let attemptNo = 1; attemptNo <= 1 + cfg.maxAutoRetries; attemptNo++) {
        const t0 = Date.now();
        let a;
        let callId = null;
        let resReceived = null; // converse が返した応答(パース例外でも課金済みとして扱うため保持)
        try {
          const body = buildConverseBody({
            system: REPLY_SYSTEM,
            // tool-use 時は本番と同じく schema テキストを付けない(tool 側で強制)
            userText: buildProductionUserPrompt(c, toolUse ? null : REPLY_SCHEMA),
            imagePaths: c.images.map((f) => join('pricing_eval/screenshots', f)),
            maxTokens: cfg.outputMaxTokens,
            temperature: cfg.temperature,
          });
          if (toolUse) {
            body.toolConfig = {
              tools: [{ toolSpec: { name: 'reply_result', description: '状況分析・返信案・アドバイスの出力。返信案(replies)は必ずちょうど3件(4件以上・2件以下は禁止)', inputSchema: { json: REPLY_SCHEMA } } }],
              toolChoice: { tool: { name: 'reply_result' } },
            };
          }
          const perAttemptWorst = (16000 / 1e6) * model.price.inputPerMTokUsd + (cfg.outputMaxTokens / 1e6) * model.price.outputPerMTokUsd;
          callId = callStarted({ runId, caseId: c.id, modelId: model.modelId, attemptNo, worstCaseUsd: perAttemptWorst });
          const res = await client.converse(model.invocationTarget, body);
          resReceived = res;
          let parsed;
          if (toolUse) {
            const input = extractToolUse(res, 'reply_result');
            parsed = input
              ? parseProductionReply(JSON.stringify(input))
              : { ok: false, failureKind: 'no_tool_use_block', error: 'toolUse ブロックが無い' };
          } else {
            parsed = parseProductionReply(extractConverse(res).text);
          }
          const ex = extractConverse(res);
          a = {
            attemptNo, latencyMs: Date.now() - t0, usage: ex.usage, httpStatus: res.$httpStatus ?? null,
            requestId: res.$requestId ?? null, apiOperation: 'Converse',
            ok: parsed.ok, failureKind: parsed.ok ? null : parsed.failureKind,
            error: parsed.ok ? null : parsed.error, failureClass: parsed.ok ? null : 'model_output',
            parsed, callId,
          };
        } catch (e) {
          let usageAfterResponse = null;
          if (resReceived) { try { usageAfterResponse = extractConverse(resReceived).usage ?? null; } catch { usageAfterResponse = null; } }
          a = {
            attemptNo, latencyMs: Date.now() - t0, usage: usageAfterResponse,
            ok: false, failureKind: resReceived ? 'response_parse_error' : (e.code === 'Timeout' ? 'timeout' : `http_${e.status || 'error'}`),
            error: `${e.code || e.name}`, errorCode: e.code ?? e.name ?? null,
            sanitizedErrorMessage: sanitizeAwsMessage(e.message), httpStatus: e.status ?? null,
            requestId: e.requestId ?? null, apiOperation: e.operation ?? 'Converse', failureClass: 'system', callId,
          };
        }
        // 呼び出し台帳を確定(応答があれば SUCCEEDED=課金対象、例外なら FAILED。費用は usage から)
        if (callId) {
          const gotResponse = resReceived != null || a.usage != null || (typeof a.httpStatus === 'number' && a.httpStatus < 400);
          callEnded({ callId, status: gotResponse ? 'SUCCEEDED' : 'FAILED', costUsd: costUsdForAttempt(a.usage, model.price), requestId: a.requestId ?? null, httpStatus: a.httpStatus ?? null, failureKind: a.failureKind ?? null });
        }
        attempts.push(a);
        final = a;
        const transient = /^(http_(429|5\d\d)|timeout)$/.test(a.failureKind || '');
        if (a.ok || !transient || attemptNo > cfg.maxAutoRetries) break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (final.ok) {
        fidelity = checkStyleRules(final.parsed.data);
        // 捏造検査: 入力(goal・プロフィール・文体・会話)に無い固有名詞。スクショケースも
        // 会話テキスト(スクショの描画元)が cases.json にあるので照合できる
        const grounding = [
          c.goal,
          c.partner_profile ? `${c.partner_profile.nickname} ${c.partner_profile.note}` : '',
          c.style_sample || '',
          ...(c.conversation || []).map((t) => t.text),
        ].join(' ');
        fidelity.violations.push(...checkUngroundedNames(final.parsed.data, grounding));
        // 補助候補(停止事由・合格条件にしない。人間確認ページに並べる)
        fidelity.violations.push(...checkFabricationHints(final.parsed.data, grounding));
      }
      for (const x of attempts) { x.generation = generation; allAttempts.push(x); }
      const genViolation = fidelityStopReason({ success: final.ok, failureKind: final.failureKind, failureClass: final.failureClass ?? null, attempts, production: final.ok ? final.parsed.data : null, invalidOutput: !final.ok ? (final.parsed?.data ?? null) : null, fidelity });
      generations.push({ generation, ok: final.ok, violation: genViolation, latencyMs: attempts.reduce((s, x) => s + x.latencyMs, 0), requestIds: attempts.map((x) => x.requestId).filter(Boolean) });
      if (!genViolation || !regenerateOnce || generation === 2) break;
      logInfo(`初回応答に違反 → 1回だけ再生成 ${c.id}`, { kind: genViolation.kind, detail: String(genViolation.detail).slice(0, 120) });
      } // generation loop
      const firstAttemptViolation = generations[0]?.violation ?? null;
      const finalViolation = generations[generations.length - 1]?.violation ?? null;
      if (firstAttemptViolation) firstViolationCount++;
      const costs = allAttempts.map((x) => costUsdForAttempt(x.usage, model.price));
      const effective = costs.some((x) => x === null) ? null : costs.reduce((s, x) => s + x, 0);
      // 予算計上: 費用が分からない試行(usage 無し)は worst-case で数える(甘く見積もらない)
      const perAttemptWorstUsd = (16000 / 1e6) * model.price.inputPerMTokUsd + (cfg.outputMaxTokens / 1e6) * model.price.outputPerMTokUsd;
      spentUsd += costs.reduce((s, x) => s + (x == null ? perAttemptWorstUsd : x), 0);

      const row = {
        runId, kind: 'fidelity', caseId: c.id, category: c.category, imageCount: c.images.length,
        modelKey: model.key, modelId: model.modelId, invocationTarget: model.invocationTarget,
        success: final.ok, failureKind: final.failureKind, failureClass: final.failureClass ?? null,
        retried: allAttempts.some((x) => x.attemptNo > 1),
        attempts: allAttempts.map((x, i) => ({
          attemptNo: x.attemptNo, generation: x.generation ?? 1, latencyMs: x.latencyMs, usage: x.usage, ok: x.ok, callId: x.callId ?? null,
          failureKind: x.failureKind, error: x.error ?? null, errorCode: x.errorCode ?? null,
          sanitizedErrorMessage: x.sanitizedErrorMessage ?? null, httpStatus: x.httpStatus ?? null,
          requestId: x.requestId ?? null, modelId: model.modelId, caseId: c.id, apiOperation: x.apiOperation ?? null,
          inputTokens: x.usage?.inputTokens ?? null, outputTokens: x.usage?.outputTokens ?? null,
          costUsd: costs[i], calculatedCostUsd: formatUsd(costs[i]),
        })),
        totalLatencyMs: allAttempts.reduce((s, x) => s + x.latencyMs, 0),
        effectiveCostUsd: effective,
        production: final.ok ? final.parsed.data : null,
        // 違反時の出力本文(schema違反の原因調査用。成功時は production に入る)
        invalidOutput: (!final.ok && syntheticDataset) ? (final.parsed?.data ?? null) : null,
        fidelity,
        // 再生成の記録(本番同様1回まで)。初回違反は最終結果と独立に残す
        repeatNo: c.repeatNo ?? 1, regenerated: generations.length > 1, firstAttemptViolation, finalViolation, generations,
        timeoutCount: allAttempts.filter((x) => x.failureKind === 'timeout').length,
        at: new Date().toISOString(),
      };
      appendFileSync(resultsPath, JSON.stringify(row) + '\n');
      if (row.success) {
        appendLedger({
          ...hashesFor(c), success: true, runId, at: row.at,
          requestId: attempts.find((x) => x.ok)?.requestId ?? null,
          inputTokens: attempts.find((x) => x.ok)?.usage?.inputTokens ?? null,
          outputTokens: attempts.find((x) => x.ok)?.usage?.outputTokens ?? null,
          calculatedCostUsd: formatUsd(effective),
        });
      }
      const stop = contractStopError(row);
      if (stop) throw new Error(stop);
      if (stopOnViolation) {
        const why = fidelityStopReason(row);
        if (why) {
          const saved = {
            at: row.at, runId, caseId: c.id, category: c.category, imageCount: c.images.length, modelId: model.modelId,
            kind: why.kind, detail: why.detail,
            requestId: attempts.find((x) => x.requestId)?.requestId ?? null, failureKind: row.failureKind,
            violations: row.fidelity?.violations ?? null,
            production: row.production ?? attempts.find((x) => x.parsed?.data)?.parsed?.data ?? null,
            completedBeforeStop: readResults(resultsPath).rows.length, cumulativeUsd: formatUsd(spentUsd),
          };
          writeFileSync(join(dir, 'stop_reason.json'), JSON.stringify(saved, null, 2));
          throw new Error(`確証run停止(1件目の違反): ${c.id} ${why.kind} — ${why.detail}(原因を stop_reason.json に保存)`);
        }
      }
      if (maxFirstViolations != null && firstViolationCount > maxFirstViolations) {
        const saved = { at: row.at, runId, caseId: c.id, kind: 'first_violation_limit', detail: `初回違反 ${firstViolationCount} 件 > 上限 ${maxFirstViolations}`, firstAttemptViolation, completedBeforeStop: readResults(resultsPath).rows.length, cumulativeUsd: formatUsd(spentUsd) };
        writeFileSync(join(dir, 'stop_reason.json'), JSON.stringify(saved, null, 2));
        throw new Error(`確証run停止(初回違反の上限超過): ${saved.detail}(原因を stop_reason.json に保存)`);
      }
    }
  }

  // --- モデル別集計(正本 = results.jsonl) ---
  const { rows } = readResults(resultsPath);
  const summary = {};
  for (const r of rows) {
    const s = summary[r.modelId] ||= {
      cases: 0, schemaOk: 0, threeReplies: 0, structureViolations: 0, styleViolations: 0,
      violationsByRule: {}, interestLevels: [], retries: 0, costUsd: 0, unknownCost: 0, latencies: [],
    };
    s.cases++;
    if (r.success) { s.schemaOk++; s.threeReplies++; }
    if (r.retried) s.retries++;
    if (r.effectiveCostUsd == null) s.unknownCost++; else s.costUsd += r.effectiveCostUsd;
    s.latencies.push(r.totalLatencyMs);
    if (r.fidelity) {
      for (const v of r.fidelity.violations) {
        s.violationsByRule[v.rule] = (s.violationsByRule[v.rule] || 0) + 1;
        if (['same_bubble_count', 'no_single_bubble_plan', 'too_many_triple_plans'].includes(v.rule)) s.structureViolations++;
        else if (v.rule === 'fabrication_hint') s.fabricationHints = (s.fabricationHints || 0) + 1;
        else s.styleViolations++;
      }
      s.interestLevels.push(r.fidelity.stats.interestLevel);
    }
  }
  for (const [id, s] of Object.entries(summary)) {
    s.schemaRate = s.cases ? s.schemaOk / s.cases : null;
    s.calculatedCostUsd = formatUsd(s.costUsd);
    s.latencyMeanMs = s.latencies.length ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length) : null;
    delete s.latencies;
    logInfo(`fidelity ${id}`, { cases: s.cases, schemaRate: s.schemaRate, style: s.styleViolations, structure: s.structureViolations, cost: s.calculatedCostUsd });
  }
  const criteria = evaluateConfirmCriteria(rows, criteriaSpec ? { expectedCases: criteriaSpec.expectedCases, maxRegenerated: criteriaSpec.maxRegenerated } : { expectedCases: rows.length });
  logInfo('確証指標', { finalSuccess: `${criteria.finalSuccess}/${criteria.cases}`, firstAttemptViolations: criteria.firstAttemptViolations, regenerated: criteria.regenerated, placeholder: criteria.placeholder, fabrication: criteria.fabrication, fabricationHints: criteria.fabricationHints, timeouts: criteria.timeouts, latency: criteria.latency });
  if (passCriteria) logInfo(`合格判定(${passCriteria})`, { pass: criteria.pass, failedConditions: criteria.failedConditions });
  writeFileSync(join(dir, 'fidelity_summary.json'), JSON.stringify({ at: new Date().toISOString(), runId, summary, criteria, passCriteria, cumulativeUsd: formatUsd(spentUsd) }, null, 2));
  logInfo('fidelity 完了', { runId, thisRunUsd: formatUsd(spentUsd - priorSpentUsd), cumulativeUsd: formatUsd(spentUsd) });
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { logError(e.message); process.exit(1); });
}
