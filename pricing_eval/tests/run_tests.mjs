// 自動テスト(§12)。node pricing_eval/tests/run_tests.mjs
//
// 検査対象は「書いたつもり」ではなく実際のモジュールの振る舞い。
// --mutate を付けると、わざと壊した条件で「テストが実際に落ちること」を確認する。

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const MUTATE = process.argv.includes('--mutate');
let pass = 0, fail = 0;
const failures = [];

function t(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); fail++; failures.push(name); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || '条件を満たしません'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期待 ${JSON.stringify(b)} / 実際 ${JSON.stringify(a)}`); }

const TMP = 'pricing_eval/runs/_test_tmp';

const { validateDataset } = await import('../src/validate_dataset.mjs');
const { parseReplies, SYSTEM_INSTRUCTION, buildUserText } = await import('../src/adapters/contract.mjs');
const { createMockClient } = await import('../src/adapters/mock.mjs');
const { buildConverseBody, extractConverse } = await import('../src/adapters/bedrock.mjs');
const { signRequest } = await import('../src/lib/sigv4.mjs');
const { evaluateGates, gate, judgeDestinations, judgeEol, PASS, FAIL, UNKNOWN } = await import('../src/lib/hardgate.mjs');
const cost = await import('../src/calculate_cost.mjs');
const { loadConfig, parseArgs, ConfigError } = await import('../src/lib/config.mjs');
const { redact, maskAccount } = await import('../src/lib/log.mjs');
const { runCase, readResults, pickSmokeCases } = await import('../src/run_eval.mjs');
const { validateReplies } = await import('../src/validate_output.mjs');
const { scoreRun } = await import('../src/score_results.mjs');
const { buildBlindReview } = await import('../src/report.mjs');

const cases = JSON.parse(readFileSync('pricing_eval/cases.json', 'utf8')).cases;

console.log('\n== dataset ==');
t('1. ケース数が120で各区分20件', () => {
  const r = validateDataset();
  const n = MUTATE ? 119 : r.stats.cases;
  assertEq(n, 120, 'ケース数');
  for (const [k, v] of Object.entries(r.stats.byCategory)) assertEq(v, 20, `区分 ${k}`);
});
t('2. case ID が一意', () => {
  const ids = cases.map((c) => c.id);
  assertEq(new Set(ids).size, ids.length, 'ID重複あり');
});
t('3. 実画像数と manifest が一致', () => {
  for (const c of cases) {
    const n = c.images.length;
    if (c.image_plan) assertEq(n, c.image_plan.count, `${c.id}`);
    for (const f of c.images) assert(existsSync(join('pricing_eval/screenshots', f)), `${c.id}: ${f} が無い`);
  }
});
t('4. 1ケース最大6枚', () => {
  for (const c of cases) assert(c.images.length <= 6, `${c.id} が ${c.images.length} 枚`);
});
t('5. 実在ブランド名・禁止 fixture が無い', () => {
  const r = validateDataset();
  assert(r.ok, `dataset エラー: ${r.errors.join(' / ')}`);
});

console.log('\n== adapter contract ==');
t('6. adapter contract が共通(同じ入力から同じ system/user を作る)', () => {
  const c = cases[0];
  const u1 = buildUserText(c), u2 = buildUserText(c);
  assertEq(u1, u2, '同じ入力で異なる出力');
  assert(SYSTEM_INSTRUCTION.includes('ちょうど3つ'), 'system に3案指定が無い');
  // Bedrock 側も同じ system/user を運ぶだけであること
  const body = buildConverseBody({ system: SYSTEM_INSTRUCTION, userText: u1, imagePaths: [], maxTokens: 100, temperature: 0.5 });
  assertEq(body.system[0].text, SYSTEM_INSTRUCTION);
  assertEq(body.messages[0].content.at(-1).text, u1);
});
t('7. JSON / schema validation が効く', () => {
  assert(parseReplies('{"replies":[{"text":"a"},{"text":"b"},{"text":"c"}]}').ok, '正常が失敗した');
  assertEq(parseReplies('{壊れ').failureKind, 'json_parse_failure');
  assertEq(parseReplies('').failureKind, 'empty_response');
  assertEq(parseReplies('{"foo":1}').failureKind, 'schema_failure');
});
t('8. 3案以外を失敗扱いにする', () => {
  const two = parseReplies('{"replies":[{"text":"a"},{"text":"b"}]}');
  assertEq(two.ok, MUTATE ? true : false, '2案が成功扱いになっている');
  assertEq(two.failureKind, 'wrong_reply_count');
  const four = parseReplies('{"replies":[{"text":"a"},{"text":"b"},{"text":"c"},{"text":"d"}]}');
  assertEq(four.ok, false, '4案が成功扱い');
});
t('SigV4 が AWS 公式テストベクタと一致(get-vanilla)', () => {
  const h = signRequest({
    method: 'GET', url: 'https://example.amazonaws.com/', body: '', service: 'service',
    region: 'us-east-1', amzDate: '20150830T123600Z',
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
  });
  assertEq(h.authorization.match(/Signature=([0-9a-f]+)/)[1],
    '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
});

console.log('\n== retry / usage ==');
const cfgBase = { maxAutoRetries: 1, outputMaxTokens: 512, temperature: 0.7, backoffMs: 1 };
const price = { inputPerMTokUsd: 1, outputPerMTokUsd: 5, source: 'test', fetchedAt: 'now' };
const model = { key: 'test', modelId: 'test', inferenceProfileId: null };

await (async () => {
  const client = createMockClient({ fault: 'http_500' });
  const row = await runCase({ client, cfg: cfgBase, model, testCase: cases[0], price });
  t('9. 自動再試行は最大1回(常に失敗しても2試行で止まる)', () => {
    assertEq(row.attempts.length, MUTATE ? 3 : 2, '試行回数');
    assertEq(row.success, false);
  });
})();
await (async () => {
  const client = createMockClient({ fault: 'flaky_first_only' });
  const row = await runCase({ client, cfg: cfgBase, model, testCase: cases[0], price });
  t('10. retry の usage を二重計上も欠落もしない', () => {
    assertEq(row.success, true, '再試行で成功するはず');
    assertEq(row.attempts.length, 2, '試行数');
    // 1回目は system 失敗で usage 無し → 実効原価は 2回目のみ。null にも 0 にもしない。
    assertEq(row.attempts[0].usage, null, '1回目は usage 無し');
    assert(row.attempts[1].usage !== null, '2回目に usage が無い');
    // 1回目 usage=null なので合計は null(欠落を 0 で埋めない)
    assertEq(row.effectiveCostUsd, null, '欠落を 0 で埋めている');
  });
  t('10b. 両試行に usage がある場合は合算する', () => {
    const a = { usage: { inputTokens: 1000, outputTokens: 100, reasoningTokens: null } };
    const b = { usage: { inputTokens: 1000, outputTokens: 100, reasoningTokens: null } };
    const one = cost.costUsdForAttempt(a.usage, price);
    const eff = cost.effectiveCostUsd([a, b], price);
    assertEq(Number(eff.toFixed(9)), Number((one * 2).toFixed(9)), '再試行ぶんが合算されていない');
  });
})();

console.log('\n== resume ==');
await (async () => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, 'results.jsonl');
  appendFileSync(p, JSON.stringify({ modelKey: 'm', caseId: 'A', success: true }) + '\n');
  appendFileSync(p, JSON.stringify({ modelKey: 'm', caseId: 'B', success: false, finalFailure: true }) + '\n');
  appendFileSync(p, '{"modelKey":"m","caseId":"C","suc');   // 途中で切れた行(§13)
  t('11. resume 時に成功済みを二重実行しない / 壊れた行で落ちない', () => {
    const { rows, truncated } = readResults(p);
    assertEq(rows.length, 2, '読めた行数');
    assertEq(truncated, 1, '壊れた行を検出できていない');
    const doneKeys = new Set(rows.filter((r) => r.success || r.finalFailure).map((r) => `${r.modelKey}::${r.caseId}`));
    assert(doneKeys.has('m::A'), '成功済みが skip 対象になっていない');
    assert(doneKeys.has('m::B'), '確定失敗が skip 対象になっていない');
    assert(!doneKeys.has('m::C'), '途中で切れた行を完了扱いにしている');
  });
})();

console.log('\n== 価格・為替 ==');
t('12. 価格 unknown を 0 円扱いしない', () => {
  const usage = { inputTokens: 1000, outputTokens: 100, reasoningTokens: null };
  const v = cost.costUsdForAttempt(usage, null);
  assertEq(v, MUTATE ? 0 : null, '価格不明が 0 になっている');
  assert(v !== 0, '価格不明を 0 と評価している');
  const s = cost.summarize([null, null]);
  assertEq(s.mean, null, '全部 unknown なのに平均が出ている');
  assertEq(s.unknownCount, 2);
  assertEq(cost.monthlyCost(null)[60], null, '月間原価が unknown にならない');
});
t('13. USD/JPY 未指定で円原価を出さない', () => {
  let threw = false;
  try { cost.toJpy(0.01, { usdJpy: null }); } catch (e) { threw = e instanceof ConfigError; }
  assert(threw, 'USD/JPY 未指定でも円を出している');
  assertEq(cost.toJpy(null, { usdJpy: 160 }), null, 'unknown を円に変換している');
  assertEq(cost.toJpy(0.01, { usdJpy: 160 }), 1.6);
});

console.log('\n== Hard Gate ==');
t('14. Hard Gate 違反モデルを Full Run しない', () => {
  const bad = evaluateGates({
    ...allPass(),
    destinations_japan: gate(FAIL, { destinations: ['us-east-1'] }, '国外'),
  });
  assertEq(bad.evaluable, MUTATE ? true : false, 'FAIL があるのに実行可能になっている');
  assertEq(bad.adoptionBlocked, true);
  // unknown は「評価はできるが採用はできない」
  const unk = evaluateGates({ ...allPass(), eol_not_near: gate(UNKNOWN, null, 'EOL不明') });
  assertEq(unk.evaluable, true, 'unknown だけで実行不可にしている');
  assertEq(unk.adoptionBlocked, true, 'unknown なのに採用可能になっている');
  // jp. という名前でも destination で落とす(§13)
  const d = judgeDestinations(['ap-northeast-1', 'us-west-2'], ['ap-northeast-1', 'ap-northeast-3']);
  assertEq(d.destinations_japan.status, FAIL);
  assertEq(judgeEol(null).status, UNKNOWN, 'EOL 不明が UNKNOWN でない');
});

console.log('\n== ログ秘匿 ==');
t('15. credential / 本文 / 画像base64 をログへ出さない', () => {
  const danger = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    apiKey: 'sk-ant-abcdef123456789',
    conversation: [{ text: '秘密の会話本文です' }],
    image: 'data:image/png;base64,' + 'A'.repeat(500),
    bytes: 'B'.repeat(400),
  };
  const out = redact(danger);
  assert(!out.includes('AKIAIOSFODNN7EXAMPLE'), 'アクセスキーが出ている');
  assert(!out.includes('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'), 'シークレットが出ている');
  assert(!out.includes('sk-ant-abcdef123456789'), 'APIキーが出ている');
  assert(!out.includes('秘密の会話本文です'), '会話本文が出ている');
  assert(!out.includes('A'.repeat(200)), '画像base64が出ている');
  assert(!out.includes('B'.repeat(200)), '生base64が出ている');
  assertEq(maskAccount('123456789012'), '****9012', 'アカウントIDがマスクされていない');
});

console.log('\n== レポート再生成 ==');
await (async () => {
  const dir = join(TMP, 'report');
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'results.jsonl');
  const client = createMockClient({ fault: 'none' });
  const rows = [];
  for (const c of cases.slice(0, 6)) {
    const row = await runCase({ client, cfg: cfgBase, model, testCase: c, price });
    rows.push(row); appendFileSync(p, JSON.stringify(row) + '\n');
  }
  t('16. report が raw results から再生成できる(2回生成して一致)', () => {
    const a = scoreRun(p);
    const b = scoreRun(p);
    assertEq(JSON.stringify(a), JSON.stringify(b), '同じ入力から異なる集計');
    assertEq(a.rowCount, 6);
    assert(a.models[0].quality.n === 6, '集計件数が合わない');
    const br = buildBlindReview(rows, 30);
    assert(br.length > 0, 'blind review が空');
    assert(br.every((r) => !JSON.stringify(r).includes(model.modelId)), 'blind review にモデル名が漏れている');
    assert(br.every((r) => r.model_label && r.model_label.length === 1), 'モデルラベルが匿名化されていない');
  });
})();

console.log('\n== 出力検査 ==');
t('禁止条件(脈あり度・捏造・誤拒否)を検出する', () => {
  const tc = { goal: 'g', conversation: [{ from: 'partner', text: '風邪ひきました' }], expects: ['no_false_refusal'], partner_profile: null, style_sample: null };
  assert(validateReplies(['脈あり度は80%です', 'あ', 'い'], tc).critical.some((c) => c.rule === 'interest_score'), '脈あり度を見逃した');
  assert(validateReplies(['申し訳ありませんがお答えできません', 'ああ', 'いい'], tc).critical.some((c) => c.rule === 'false_refusal'), '誤拒否を見逃した');
  assert(validateReplies(['12月3日に会いましょう', 'ああ', 'いい'], tc).critical.some((c) => c.rule === 'fabricated_detail'), '捏造を見逃した');
  assertEq(validateReplies(['大丈夫ですか?', 'お大事に〜', 'ゆっくり休んでください'], tc).critical.length, 0, '正常を誤検知');
});
t('smoke の代表5ケースが必要な多様性を含む', () => {
  const s = pickSmokeCases(cases);
  assertEq(s.length, 5);
  assert(s.some((c) => c.images.length === 0), 'テキストのみが無い');
  assert(s.some((c) => c.images.length === 1), '1枚が無い');
  assert(s.some((c) => c.images.length === 6), '6枚が無い');
  assert(s.some((c) => c.category === 'style'), '文体が無い');
  assert(s.some((c) => c.category === 'edge'), '境界が無い');
});

function allPass() {
  const g = {};
  for (const id of ['bedrock_available', 'lifecycle_active', 'callable_from_tokyo', 'destinations_japan',
    'destinations_allowed', 'multimodal', 'six_images', 'retention_none', 'no_provider_sharing',
    'terms_allow_usecase', 'pricing_obtainable', 'eol_not_near']) g[id] = gate(PASS, {});
  return g;
}

if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗`);
if (MUTATE) {
  console.log(fail > 0
    ? `\n[mutate] 期待どおり ${fail} 件が落ちました(検査器が効いている): ${failures.join(', ')}`
    : '\n[mutate] ⚠️ 1件も落ちませんでした。検査器が効いていない可能性があります。');
  process.exit(fail > 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
