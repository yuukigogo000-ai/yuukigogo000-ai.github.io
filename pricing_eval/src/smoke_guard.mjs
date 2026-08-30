// 実費 smoke 直前の安全ゲート(read-only・fail closed)。
//
// 1つでも確認できなければ blocker を返し、呼び出し側は実行してはならない。
// 判定は純関数 checkSmokeGuard() に隔離してあり、テストが各条件を変異させて
// 「必ず fail closed になる」ことを機械検査する。
//
// 使い方:
//   node pricing_eval/src/smoke_guard.mjs --models=<カンマ区切りallowlist> --usd-jpy=160 --max-budget-jpy=100

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadConfig, parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logError } from './lib/log.mjs';
import { runPreflight } from './retention_preflight.mjs';
import { loadPricing } from './calculate_cost.mjs';

export const SMOKE_CASES = 5;

/**
 * 全条件を検査し { ok, blockers, facts } を返す。推測で通さない。
 * input:
 *   preflight: retention_preflight の結果
 *   env: プロセス環境(資格情報の「存在」だけ見る。値は読まない)
 *   awsProfile / expectedProfile / region
 *   allowlist: 発注者が許可したモデルIDの配列(完全一致)
 *   candidates: discovery の candidates(allowlist で絞る前の全件)
 *   pricing: loadPricing() の結果
 *   stage / usdJpy / maxBudgetJpy / maxBudgetUsd / outputMaxTokens / maxAutoRetries / retryTransientOnly
 *   casesShaHead / casesShaDisk: コミット済み cases.json と作業ツリーの sha256
 */
export function checkSmokeGuard(input) {
  const b = [];
  const f = {};
  const pf = input.preflight || {};

  // --- AWS 環境 ---
  if (!String(pf.identity?.arnTail || '').endsWith('user/replier-eval-cli')) {
    b.push(`STS identity が replier-eval-cli でない (${pf.identity?.arnTail ?? 'なし'})`);
  }
  if (pf.identity?.credentialSource !== `profile:${input.expectedProfile}`) {
    b.push(`資格情報源が profile:${input.expectedProfile} でない (${pf.identity?.credentialSource ?? 'なし'})`);
  }
  if (pf.region !== 'ap-northeast-1') b.push(`region が東京でない (${pf.region})`);
  if (input.region !== 'ap-northeast-1') b.push(`実行 config の region が東京でない (${input.region})`);
  if (pf.retention?.mode !== 'none' || pf.retention?.ok !== true) {
    b.push(`account data retention が none でない (${pf.retention?.mode ?? '不明'})`);
  }
  if (pf.allowModelEvaluation !== true) b.push('preflight が allowModelEvaluation=true でない');

  // 偽の資格情報環境変数・想定外 profile が居座っていないこと(値は見ない)
  for (const k of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_BEARER_TOKEN_BEDROCK']) {
    if (input.env?.[k]) b.push(`環境変数 ${k} が存在する(named profile 以外の資格情報経路は禁止)`);
  }
  if (input.env?.AWS_PROFILE !== input.expectedProfile) {
    b.push(`AWS_PROFILE が ${input.expectedProfile} でない (${input.env?.AWS_PROFILE ?? '未設定'})`);
  }

  // --- allowlist と呼び出し経路 ---
  const allow = input.allowlist || [];
  if (!allow.length) b.push('allowlist が空');
  if (allow.some((id) => /anthropic|claude/i.test(id))) b.push('allowlist に Claude/Anthropic が混入(今回のGO対象外)');
  const byId = new Map((input.candidates || []).map((c) => [c.modelId, c]));
  const targets = [];
  for (const id of allow) {
    const c = byId.get(id);
    if (!c) { b.push(`allowlist の ${id} が discovery に存在しない`); continue; }
    if (c.domesticPath !== 'direct_in_region_tokyo') b.push(`${id} が direct In-Region Tokyo 経路でない (${c.domesticPath ?? 'なし'})`);
    if (c.invocationTarget !== id) b.push(`${id} の呼び出し先が base model ID でない (${c.invocationTarget})`);
    if (/^(global|apac|jp|us|eu|au)\./.test(String(c.invocationTarget || ''))) b.push(`${id} が inference profile 経由になっている`);
    if (!c.evaluable) b.push(`${id} は Hard Gate 違反で実行不可 (${(c.fails || []).join(',')})`);
    targets.push(c.invocationTarget);
  }
  f.targets = targets;

  // --- stage ---
  // full は発注者の明示GO時のみ呼び出し側が指定できる。それ以外の stage は常に拒否。
  if (input.stage !== 'smoke' && input.stage !== 'full') b.push(`stage が smoke/full でない (${input.stage})`);
  if (input.stage === 'full' && !(input.caseCount > 0)) b.push('full なのに caseCount が不明(worst-case を見積れない)');

  // --- 価格・予算(worst-case・再試行込み・価格不明は呼び出し禁止) ---
  const usdJpy = input.usdJpy;
  if (!(usdJpy > 0)) b.push('USD/JPY が未指定');
  const perCallInTok = 16000;
  const outTok = input.outputMaxTokens;
  const caseCount = input.stage === 'full' ? (input.caseCount || 0) : SMOKE_CASES;
  const calls = caseCount * (1 + (input.maxAutoRetries ?? 1));
  let worstUsd = 0;
  for (const id of allow) {
    // run_eval と同じ解決順: invocationTarget/modelId → 表示名(Price List のキーは表示名)
    const c = byId.get(id);
    const p = input.pricing?.models?.[id]
      ?? (c?.invocationTarget ? input.pricing?.models?.[c.invocationTarget] : null)
      ?? (c?.modelName ? input.pricing?.models?.[c.modelName] : null)
      ?? null;
    if (!p || p.inputPerMTokUsd == null || p.outputPerMTokUsd == null) {
      b.push(`${id} の official_exact 価格が無い(価格不明モデルは呼び出し禁止)`);
      continue;
    }
    if (p.kind === 'derived_estimate') b.push(`${id} の価格が derived_estimate(official_exact 以外は使用禁止)`);
    worstUsd += calls * ((perCallInTok / 1e6) * p.inputPerMTokUsd + (outTok / 1e6) * p.outputPerMTokUsd);
  }
  // 既発生費用を累計予算へ算入する(worst-case + 既発生 ≤ 上限)
  const prior = Number(input.priorSpentUsd) || 0;
  f.priorSpentUsd = prior;
  f.worstUsd = worstUsd + prior;
  f.worstJpy = usdJpy > 0 ? f.worstUsd * usdJpy : null;
  // 予算枠の天井: smoke=100円(2026-08-31 GO)/ full=10,000円(当初指示の総予算)。それ以上は拒否。
  const capJpy = input.stage === 'full' ? 10000 : 100;
  if (input.maxBudgetJpy > capJpy) b.push(`予算上限が ${capJpy} 円を超えている (${input.maxBudgetJpy})`);
  if (f.worstJpy === null || f.worstJpy > input.maxBudgetJpy) {
    b.push(`worst-case 費用(既発生込み) ${f.worstJpy === null ? '不明' : Math.ceil(f.worstJpy) + '円'} が予算 ${input.maxBudgetJpy} 円以内と確認できない`);
  }
  if (input.maxBudgetUsd != null && f.worstUsd > input.maxBudgetUsd) {
    b.push(`worst-case $${f.worstUsd.toFixed(4)}(既発生込み)が USD 上限 $${input.maxBudgetUsd} を超える`);
  }
  if (!input.retryTransientOnly) b.push('再試行が 429/一時的5xx に限定されていない(--retry-transient-only 必須)');

  // --- 合成データの完全一致 ---
  if (!input.casesShaHead || input.casesShaHead !== input.casesShaDisk) {
    b.push(`cases.json がコミット済み合成データと一致しない (HEAD=${input.casesShaHead?.slice(0, 12) ?? '取得不能'} / disk=${input.casesShaDisk?.slice(0, 12) ?? '取得不能'})`);
  }
  if (input.screenshotCountExpected != null && input.screenshotCountActual !== input.screenshotCountExpected) {
    b.push(`スクリーンショット数が manifest と一致しない (期待 ${input.screenshotCountExpected} / 実際 ${input.screenshotCountActual})`);
  }

  return { ok: b.length === 0, blockers: b, facts: f };
}

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const allowlist = args.models ? String(args.models).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const discovery = JSON.parse(readFileSync(args.discovery || 'pricing_eval/runs/_discovery/candidate_discovery.json', 'utf8'));
  const pricing = loadPricing();
  const pf = await runPreflight(cfg);

  const sha = (buf) => createHash('sha256').update(buf).digest('hex');
  let casesShaHead = null;
  try { casesShaHead = sha(execFileSync('git', ['show', 'HEAD:pricing_eval/cases.json'], { maxBuffer: 64 * 1024 * 1024 })); } catch { /* blockerになる */ }
  const casesDisk = readFileSync('pricing_eval/cases.json');
  const casesJson = JSON.parse(casesDisk.toString('utf8'));
  const expectedShots = casesJson.cases.reduce((s, c) => s + c.images.length, 0);
  let actualShots = 0;
  for (const c of casesJson.cases) for (const img of c.images) {
    if (existsSync(`pricing_eval/screenshots/${img}`)) actualShots++;
  }

  const result = checkSmokeGuard({
    preflight: pf,
    env: process.env,
    expectedProfile: 'replier-eval',
    region: cfg.region,
    allowlist,
    candidates: discovery.candidates || [],
    pricing,
    stage: args.stage || 'smoke',
    caseCount: casesJson.cases.length,
    usdJpy: cfg.usdJpy,
    maxBudgetJpy: cfg.maxBudgetJpy,
    // USD 上限は smoke=GO固定($0.625)。full は予算枠の USD 換算。
    maxBudgetUsd: (args.stage || 'smoke') === 'full'
      ? (cfg.usdJpy > 0 ? cfg.maxBudgetJpy / cfg.usdJpy : 0)
      : 0.625,
    outputMaxTokens: cfg.outputMaxTokens,
    maxAutoRetries: cfg.maxAutoRetries,
    retryTransientOnly: cfg.retryTransientOnly,
    priorSpentUsd: Number(args['prior-spent-usd']) || 0,
    casesShaHead,
    casesShaDisk: sha(casesDisk),
    screenshotCountExpected: expectedShots,
    screenshotCountActual: actualShots,
  });

  logInfo('smoke guard 判定', { ok: result.ok, blockers: result.blockers.length, worstJpy: result.facts.worstJpy == null ? null : Math.ceil(result.facts.worstJpy) });
  for (const x of result.blockers) logError(` blocker: ${x}`);
  if (!result.ok) { logError('確認できない条件があるため smoke を実行してはいけません(fail closed)'); process.exit(2); }
  logInfo('全条件PASS。smoke 実行を許可できます', { targets: result.facts.targets });
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => { logError(e.message); process.exit(1); });
}
