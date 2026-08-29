// 破壊的検証(§13)。node pricing_eval/tests/destructive.mjs
//
// 壊した結果として、次の5つが「起きないこと」を確認する:
//   誤ったモデル採用 / 国外処理 / 保持あり実行 / 0円原価 / 二重実行

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

let pass = 0, fail = 0;
function t(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  ✅ ${name}`); pass++; })
    .catch((e) => { console.log(`  ❌ ${name}\n     ${e.message}`); fail++; });
}
function assert(c, m) { if (!c) throw new Error(m || '条件を満たしません'); }
function assertEq(a, b, m) { if (a !== b) throw new Error(`${m || ''} 期待 ${JSON.stringify(b)} / 実際 ${JSON.stringify(a)}`); }

const TMP = 'pricing_eval/runs/_destructive_tmp';
const { evaluateGates, gate, judgeDestinations, judgeEol, PASS, FAIL, UNKNOWN } = await import('../src/lib/hardgate.mjs');
const { assessModel } = await import('../src/discover_models.mjs');
const { effectiveRetention } = await import('../src/retention_preflight.mjs');
const { createMockClient } = await import('../src/adapters/mock.mjs');
const { runCase, readResults } = await import('../src/run_eval.mjs');
const { validateReplies } = await import('../src/validate_output.mjs');
const cost = await import('../src/calculate_cost.mjs');
const { scoreRun, cheaperModelAllowed } = await import('../src/score_results.mjs');

const cases = JSON.parse(readFileSync('pricing_eval/cases.json', 'utf8')).cases;
const ALLOWED = ['ap-northeast-1', 'ap-northeast-3'];
const cfg = { maxAutoRetries: 1, outputMaxTokens: 512, temperature: 0.7, backoffMs: 1 };
const price = { inputPerMTokUsd: 1, outputPerMTokUsd: 5, source: 'test', fetchedAt: 'now' };
const model = { key: 'k', modelId: 'm', inferenceProfileId: null };
const activeModel = { modelId: 'p.m', inputModalities: ['TEXT', 'IMAGE'], outputModalities: ['TEXT'], modelLifecycle: { status: 'ACTIVE' } };

console.log('\n== 国外処理・保持 ==');
await t('1. 同じ model ID でも profile の destination に国外が混ざれば FAIL', () => {
  const a = assessModel({
    model: activeModel, profile: { inferenceProfileId: 'p1' },
    profileDetail: { models: [{ modelArn: 'arn:aws:bedrock:ap-northeast-1::x' }, { modelArn: 'arn:aws:bedrock:us-east-1::x' }] },
    retention: { gate: gate(PASS, {}) }, pricingKnown: { source: 't' }, allowedDestinations: ALLOWED,
  });
  assertEq(a.evaluable, false, '国外混入なのに実行可能');
  assert(a.fails.includes('destinations_japan'), 'destination を落としていない');
});
await t('2. jp. という名前でも destination 検証に失敗すれば通さない', () => {
  const a = assessModel({
    model: activeModel, profile: { inferenceProfileId: 'jp.p.m' },
    profileDetail: null, // 詳細が取れない = 検証できない
    retention: { gate: gate(PASS, {}) }, pricingKnown: { source: 't' }, allowedDestinations: ALLOWED,
  });
  assert(a.adoptionBlocked, 'destination 未検証なのに採用可能');
  assert(a.unknowns.includes('destinations_japan'), '名前から国内と推測している');
});
await t('3. retention が default へ戻ったら実行不可', () => {
  const r = effectiveRetention({ loggingConfig: { s3Config: { bucketName: 'b' }, textDataDeliveryEnabled: true } });
  assertEq(r.ok, false, 'ログ有効なのに実行可能');
  const a = assessModel({
    model: activeModel, profile: { inferenceProfileId: 'p' },
    profileDetail: { models: [{ modelArn: 'arn:aws:bedrock:ap-northeast-1::x' }] },
    retention: { gate: gate(FAIL, {}, 'ログ有効') }, pricingKnown: { source: 't' }, allowedDestinations: ALLOWED,
  });
  assertEq(a.evaluable, false, '保持ありなのに Full Run 可能');
});
await t('4. モデルが Legacy / EOL へ移ったら落とす', () => {
  const legacy = { ...activeModel, modelLifecycle: { status: 'LEGACY' } };
  const a = assessModel({ model: legacy, profile: null, profileDetail: null, retention: { gate: gate(PASS, {}) }, pricingKnown: { source: 't' }, allowedDestinations: ALLOWED });
  assertEq(a.evaluable, false, 'LEGACY なのに実行可能');
  assertEq(judgeEol('2026-09-30').status, FAIL, '近い EOL を通している');
  assertEq(judgeEol(null).status, UNKNOWN, 'EOL 不明を PASS にしている');
});

console.log('\n== 価格 ==');
await t('5. 価格取得に失敗しても 0 円にしない', () => {
  assertEq(cost.costUsdForAttempt({ inputTokens: 1000, outputTokens: 100 }, null), null, '0 円扱い');
  const s = cost.summarize([null, null, null]);
  assertEq(s.mean, null); assertEq(s.unknownCount, 3);
  assertEq(cost.monthlyCost(null)[120], null, '月間原価を 0 にしている');
});
await t('6. 料金単位が token から画像固定課金へ変わっても計上できる', () => {
  const p = { inputPerMTokUsd: 1, outputPerMTokUsd: 5, imageUnitUsd: 0.01 };
  const withImg = cost.costUsdForAttempt({ inputTokens: 1000, outputTokens: 100, imageUnits: 6 }, p);
  const noImg = cost.costUsdForAttempt({ inputTokens: 1000, outputTokens: 100, imageUnits: 0 }, p);
  assert(withImg > noImg, '画像固定課金が計上されていない');
  assertEq(Number((withImg - noImg).toFixed(6)), 0.06, '画像課金額が合わない');
});

console.log('\n== 応答の壊れ方 ==');
// costExpect: 'null' = usage が取れない system 障害 / 'billed' = HTTP 成功でトークンを消費した失敗
for (const [fault, expectKind, costExpect, label] of [
  ['six_images_fail', 'http_400', 'null', '7. 6枚入力だけ失敗する'],
  ['broken_json', 'json_parse_failure', 'billed', '8. schema対応表記があるが実レスポンスが壊れる'],
  ['two_replies', 'wrong_reply_count', 'billed', '9. HTTP成功だが返信案が2つ'],
  ['timeout', 'timeout', 'null', '10. timeout(Provider側は完了しているケース)'],
  ['http_429', 'http_429', 'null', '11a. rate limit 429'],
  ['http_500', 'http_500', 'null', '11b. 5xx'],
]) {
  await t(label, async () => {
    const six = cases.find((c) => c.images.length === 6);
    const tc = fault === 'six_images_fail' ? six : cases[0];
    const client = createMockClient({ fault });
    const row = await runCase({ client, cfg, model, testCase: tc, price });
    assertEq(row.success, false, '失敗が成功扱いになっている');
    assertEq(row.failureKind, expectKind, 'failureKind');
    assert(row.attempts.length <= 2, '再試行が2回を超えている');
    // 失敗ケースの原価:
    //   system 障害(timeout/429/5xx)は usage が返らない → null。0 円にはしない。
    //   モデル出力の失敗(JSON崩れ・2案)は HTTP 成功でトークンを消費している → 課金として計上する。
    //   これを 0 や null にすると「失敗ぶんの実費」が帳簿から消える。
    if (costExpect === 'null') {
      assertEq(row.effectiveCostUsd, null, '失敗の原価を 0 円扱いしている');
    } else {
      assert(row.effectiveCostUsd > 0, '課金された失敗の原価が計上されていない');
      // 再試行ぶんも合算されていること(2試行とも課金)
      assertEq(row.attempts.filter((a) => a.costUsd > 0).length, 2, '再試行ぶんの原価が欠落している');
    }
  });
}
await t('7b. 6枚以外は成功する(6枚だけ失敗を切り分けられる)', async () => {
  const client = createMockClient({ fault: 'six_images_fail' });
  const row = await runCase({ client, cfg, model, testCase: cases[0], price });
  assertEq(row.success, true, '6枚以外まで失敗している');
});

console.log('\n== 中断・resume・並列 ==');
await t('12/13. run 途中でプロセス終了 → 末尾が切れても resume が二重実行しない', async () => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, 'results.jsonl');
  // 正常2行 + 途中で切れた1行(プロセスを kill された状態を再現)
  appendFileSync(p, JSON.stringify({ modelKey: 'k', caseId: cases[0].id, success: true }) + '\n');
  appendFileSync(p, JSON.stringify({ modelKey: 'k', caseId: cases[1].id, success: false, finalFailure: true }) + '\n');
  appendFileSync(p, '{"modelKey":"k","caseId":"' + cases[2].id + '","succ');
  const { rows, truncated } = readResults(p);
  assertEq(truncated, 1, '切れた行を検出できていない');
  const done = new Set(rows.filter((r) => r.success || r.finalFailure).map((r) => `${r.modelKey}::${r.caseId}`));
  assert(done.has(`k::${cases[0].id}`) && done.has(`k::${cases[1].id}`), '完了分が skip されない');
  assert(!done.has(`k::${cases[2].id}`), '切れた行を完了扱いにしている(結果が失われる)');
});
await t('12b. 実際にプロセスを kill しても results.jsonl が壊れず resume できる', async () => {
  const dir = 'pricing_eval/runs/_kill_test';
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  const child = spawn('node', ['pricing_eval/src/run_eval.mjs', '--stage=full', '--adapter=mock',
    '--fault=none', '--run-id=_kill_test', '--concurrency=1', '--slow-ms=25'], { stdio: 'ignore' });
  // exit を取り逃さないよう、待つ前に promise を作る(子が先に終わっても解決する)
  const exited = new Promise((r) => child.on('exit', r));
  await new Promise((r) => setTimeout(r, 800));
  child.kill('SIGKILL');
  await exited;
  const p = join(dir, 'results.jsonl');
  assert(existsSync(p), '途中結果が残っていない');
  const { rows } = readResults(p);
  assert(rows.length > 0, '1件も書けていない');
  const ids = rows.map((r) => `${r.modelKey}::${r.caseId}`);
  assertEq(new Set(ids).size, ids.length, 'kill 前の時点で既に重複がある');
  // resume して重複が生まれないこと
  await new Promise((res, rej) => {
    const c2 = spawn('node', ['pricing_eval/src/run_eval.mjs', '--stage=full', '--adapter=mock',
      '--fault=none', '--run-id=_kill_test', '--concurrency=4'], { stdio: 'ignore' });
    c2.on('exit', (code) => (code === 0 ? res() : rej(new Error(`resume が異常終了 (${code})`))));
  });
  const after = readResults(p).rows;
  const ids2 = after.map((r) => `${r.modelKey}::${r.caseId}`);
  assertEq(new Set(ids2).size, ids2.length, `resume 後に二重実行が発生 (${ids2.length} 行 / ユニーク ${new Set(ids2).size})`);
  assertEq(new Set(ids2).size, 120, '全120ケースが揃っていない');
  rmSync(dir, { recursive: true, force: true });
});
await t('14. 並列 worker が同一 case を二重取得しない', async () => {
  const dir = 'pricing_eval/runs/_par_test';
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  await new Promise((res, rej) => {
    const c = spawn('node', ['pricing_eval/src/run_eval.mjs', '--stage=full', '--adapter=mock',
      '--fault=none', '--run-id=_par_test', '--concurrency=8'], { stdio: 'ignore' });
    c.on('exit', (code) => (code === 0 ? res() : rej(new Error(`異常終了 (${code})`))));
  });
  const rows = readResults(join(dir, 'results.jsonl')).rows;
  const ids = rows.map((r) => r.caseId);
  assertEq(new Set(ids).size, ids.length, `並列で二重実行 (${ids.length} 行 / ユニーク ${new Set(ids).size})`);
  assertEq(ids.length, 120, '件数が 120 でない');
  rmSync(dir, { recursive: true, force: true });
});

console.log('\n== 出力内容 ==');
const tcEdge = { goal: 'g', conversation: [{ from: 'partner', text: '先週風邪ひいて病院行きました' }], expects: ['no_false_refusal'], partner_profile: null, style_sample: null };
await t('15. 脈あり度・感情推測の混入を検出する', async () => {
  const client = createMockClient({ fault: 'interest_score' });
  const row = await runCase({ client, cfg, model, testCase: cases[0], price });
  assert(row.success, 'JSON としては成功するはず');
  assert(row.validation.critical.some((c) => c.rule === 'interest_score'), '脈あり度を見逃した');
});
await t('16. 普通の医療語・宗教語での過剰拒否を検出する', async () => {
  const v = validateReplies(['申し訳ありませんが、医療に関する話題にはお答えできません', 'お答えできません', 'お応えできません'], tcEdge);
  assert(v.critical.some((c) => c.rule === 'false_refusal'), '誤拒否を見逃した');
  const ok = validateReplies(['大丈夫ですか?お大事に', 'ゆっくり休んでくださいね', '無理しないでください'], tcEdge);
  assertEq(ok.critical.length, 0, '正常な返信を誤検知している');
});
await t('17. 入力にない予定・個人情報の捏造を検出する', async () => {
  const client = createMockClient({ fault: 'fabrication' });
  const row = await runCase({ client, cfg, model, testCase: cases[0], price });
  assert(row.validation.critical.some((c) => c.rule === 'fabricated_detail'), '捏造を見逃した');
});

console.log('\n== 予算・採用判断 ==');
await t('18. 予算上限を超えそうなら実行しない', async () => {
  const out = await new Promise((res) => {
    const c = spawn('node', ['pricing_eval/src/run_eval.mjs', '--stage=full', '--usd-jpy=160',
      '--max-budget-jpy=1'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let s = ''; c.stdout.on('data', (d) => (s += d)); c.stderr.on('data', (d) => (s += d));
    c.on('exit', (code) => res({ code, s }));
  });
  // 候補が無い/予算超過のいずれでも、実行はされない(exit 0 で結果を書かない)
  assert(!existsSync('pricing_eval/runs/full_budget_overrun'), '予算超過なのに run が作られた');
  assert(out.code !== 0 || /候補が無い|予算/.test(out.s), `実行前に止まっていない: ${out.s.slice(0, 200)}`);
});
await t('誤ったモデル採用が起きない(人間評価前は採用判定自体をブロック)', () => {
  const best = { quality: { score: 90, hasCriticalFailure: false }, cost: { effective: { mean: 0.02 } } };
  const cheap = { quality: { score: 89, hasCriticalFailure: false }, cost: { effective: { mean: 0.005 } } };
  assertEq(cheaperModelAllowed({ best, cheaper: cheap, humanReviewDone: false }).allowed, false, '人間評価前に採用を許している');
  assertEq(cheaperModelAllowed({ best, cheaper: cheap, humanReviewDone: true }).allowed, true, '3点以内の安価モデルを採れない');
  const far = { quality: { score: 80, hasCriticalFailure: false }, cost: { effective: { mean: 0.001 } } };
  assertEq(cheaperModelAllowed({ best, cheaper: far, humanReviewDone: true }).allowed, false, '品質差 10 点でも安さで採っている');
  const crit = { quality: { score: 90, hasCriticalFailure: true }, cost: { effective: { mean: 0.001 } } };
  assertEq(cheaperModelAllowed({ best, cheaper: crit, humanReviewDone: true }).allowed, false, 'critical failure を採用している');
});

if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail === 0 ? 0 : 1);
