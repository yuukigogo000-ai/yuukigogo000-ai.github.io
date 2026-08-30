// 自動テスト(§12)。node pricing_eval/tests/run_tests.mjs
//
// 検査対象は「書いたつもり」ではなく実際のモジュールの振る舞い。
// --mutate を付けると、わざと壊した条件で「テストが実際に落ちること」を確認する。

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
const { buildConverseBody, extractConverse, resolveCredentials, AwsError, sanitizeAwsMessage } = await import('../src/adapters/bedrock.mjs');
const { judgeAvailability } = await import('../src/check_availability.mjs');
const { signRequest, canonicalUriPath } = await import('../src/lib/sigv4.mjs');
const { evaluateGates, gate, judgeDestinations, judgeEol, PASS, FAIL, UNKNOWN } = await import('../src/lib/hardgate.mjs');
const cost = await import('../src/calculate_cost.mjs');
const { loadConfig, parseArgs, ConfigError, isCliEntry } = await import('../src/lib/config.mjs');
const { redact, maskAccount } = await import('../src/lib/log.mjs');
const { runCase, readResults, pickSmokeCases, contractStopError } = await import('../src/run_eval.mjs');
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
t("SigV4 canonical path: ':' を含むパスを二重エンコードする(GetInferenceProfile/Converse 回帰)", () => {
  assertEq(canonicalUriPath('/model/jp.provider.model-v1%3A0/converse'), '/model/jp.provider.model-v1%253A0/converse');
  assertEq(canonicalUriPath('/inference-profiles/jp.x-v1%3A0'), '/inference-profiles/jp.x-v1%253A0');
  assertEq(canonicalUriPath('/foundation-models'), '/foundation-models', '素のパスを変えてしまっている');
  assertEq(canonicalUriPath('/'), '/');
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

console.log('\n== CLI 起動・設定・資格情報(2026-08-30 回帰) ==');
t('17. CLI エントリ判定が Windows パスでも効く(無言スキップ回帰の防止)', () => {
  const p = resolve('pricing_eval/src/validate_dataset.mjs');
  assert(isCliEntry(pathToFileURL(p).href, p), '直接起動を検出できない');
  assert(!isCliEntry(pathToFileURL(p).href, resolve('pricing_eval/src/run_eval.mjs')), 'import なのに CLI 扱い');
  // 旧実装の壊れ方: バックスラッシュ入り argv では file:// 連結が一致しない
  assert(!(`file://${p}` === pathToFileURL(p).href) || process.platform !== 'win32', '前提が変わった(このテストを見直す)');
  // 実際に子プロセスとして起動し、main() が走って出力が出ること(exit 0 の無言スキップを検出)
  const out = execFileSync(process.execPath, ['pricing_eval/src/validate_dataset.mjs'], { encoding: 'utf8' });
  assert(out.includes('dataset OK') || out.includes('件の問題'), `CLI の main() が実行されていない(出力: ${out.slice(0, 80)})`);
});
t('18. config の evalEnvironmentDeclared を preflight が読める', () => {
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, 'cfg_declared.json');
  writeFileSync(p, JSON.stringify({ evalEnvironmentDeclared: true }));
  assertEq(loadConfig({ config: p }).evalEnvironmentDeclared, true, 'true 宣言が読まれない(preflight が永久にブロックされる)');
  const p2 = join(TMP, 'cfg_undeclared.json');
  writeFileSync(p2, JSON.stringify({}));
  assertEq(loadConfig({ config: p2 }).evalEnvironmentDeclared, false, '未宣言が true になっている');
  writeFileSync(p2, JSON.stringify({ evalEnvironmentDeclared: 'true' }));
  assertEq(loadConfig({ config: p2 }).evalEnvironmentDeclared, false, '文字列 "true" を宣言扱いしている');
});
t('19. 資格情報解決: 環境変数キーを外した子プロセスでは named profile が使われる', () => {
  const fakeExport = () => JSON.stringify({ AccessKeyId: 'AKIDTESTPROFILE', SecretAccessKey: 'S', SessionToken: null });
  // 偽の環境変数キーが居る限り env が勝つ(AWS の慣例)→ 呼び出し側がキーを外して分離する
  const withFake = resolveCredentials(
    { AWS_ACCESS_KEY_ID: 'proxFAKE', AWS_SECRET_ACCESS_KEY: 'x', AWS_PROFILE: 'replier-eval' },
    { execImpl: fakeExport },
  );
  assertEq(withFake.source, 'env', '優先順の前提が変わった(このテストと起動手順を見直す)');
  // キーを外した状態(= 評価コマンドを包む子プロセスの状態)では profile が解決される
  const cleaned = resolveCredentials({ AWS_PROFILE: 'replier-eval' }, { execImpl: fakeExport });
  assertEq(cleaned.source, 'profile:replier-eval', 'profile 解決が効かない');
  assertEq(cleaned.credentials.accessKeyId, 'AKIDTESTPROFILE');
  // aws CLI 不在・失敗時は null(推測で資格情報を作らない)
  assertEq(resolveCredentials({ AWS_PROFILE: 'x' }, { execImpl: () => { throw new Error('no aws'); } }), null);
  assertEq(resolveCredentials({}, { execImpl: fakeExport }), null, 'profile 未指定なのに解決している');
});

console.log('\n== 国内処理・EOL・共有ゲート(2026-08-31 回帰。変異は --mutate で検出確認) ==');
const { assessModel, loadEvidenceFiles } = await import('../src/discover_models.mjs');
const { judgeDirectTokyo, JAPAN_REGIONS } = await import('../src/lib/hardgate.mjs');
const FIX = JSON.parse(readFileSync('pricing_eval/tests/fixtures/discovery_snapshot.json', 'utf8'));
const EVID = loadEvidenceFiles();
const NOW = new Date('2026-08-30T12:00:00Z'); // 指示の基準日で固定
const fixModel = (id) => FIX.models.find((m) => m.modelId === id);
const fixProfile = (id) => FIX.profiles.find((p) => p.inferenceProfileId === id) ?? null;
const fixDetail = (id) => FIX.profileDetails[id] ?? null;
const assess = (modelId, profileId) => assessModel({
  model: fixModel(modelId),
  profile: profileId ? fixProfile(profileId) : null,
  profileDetail: profileId ? fixDetail(profileId) : null,
  retention: { gate: gate(PASS, { mode: 'none' }) },
  pricingKnown: null,
  allowedDestinations: ['ap-northeast-1', 'ap-northeast-3'],
  card: EVID.cards[modelId] ?? null, policy: EVID.policy, terms: EVID.terms,
  region: 'ap-northeast-1', now: NOW, minEolHeadroomDays: 90,
});

t('20. direct In-Region Tokyo 4件が国内処理PASS(変異: 国外扱いに戻すと落ちる)', () => {
  for (const id of ['moonshotai.kimi-k2.5', 'mistral.mistral-large-3-675b-instruct',
    'mistral.ministral-3-14b-instruct', 'qwen.qwen3-vl-235b-a22b']) {
    const a = assess(id, null);
    assertEq(a.gates.destinations_japan.status, MUTATE ? FAIL : PASS, `${id} destinations_japan`);
    assertEq(a.domesticPath, 'direct_in_region_tokyo', `${id} 経路`);
    assertEq(a.invocationTarget, id, `${id} は base model ID を直接指定する`);
    assert(a.gates.destinations_japan.evidence?.endpoint === 'bedrock-runtime.ap-northeast-1.amazonaws.com', `${id} endpoint証拠`);
  }
});
t('21. 東京モデルをglobal profileへ置換しても国内PASSにならない(変異検出)', () => {
  // ON_DEMAND の無い Claude を global profile で評価 → 国内 PASS してはいけない
  const a = assessModel({
    model: fixModel('anthropic.claude-opus-5'),
    profile: { inferenceProfileId: 'global.anthropic.claude-opus-5' },
    profileDetail: { models: [{ modelArn: 'arn:aws:bedrock:::foundation-model/x' }, { modelArn: 'arn:aws:bedrock:us-east-1::x' }] },
    retention: { gate: gate(PASS, {}) }, pricingKnown: null,
    allowedDestinations: ['ap-northeast-1', 'ap-northeast-3'],
    card: null, policy: EVID.policy, terms: EVID.terms, region: 'ap-northeast-1', now: NOW, minEolHeadroomDays: 90,
  });
  const notDomestic = a.gates.destinations_japan.status !== PASS && a.domesticPath === null;
  assertEq(notDomestic, MUTATE ? false : true, 'global profile が国内扱いされている');
});
t('22. jp geo profile 5件が国内処理PASS / 国外destination追加やSeoulで落ちる(変異検出)', () => {
  const jp5 = [
    ['anthropic.claude-haiku-4-5-20251001-v1:0', 'jp.anthropic.claude-haiku-4-5-20251001-v1:0'],
    ['anthropic.claude-sonnet-4-5-20250929-v1:0', 'jp.anthropic.claude-sonnet-4-5-20250929-v1:0'],
    ['anthropic.claude-sonnet-4-6', 'jp.anthropic.claude-sonnet-4-6'],
    ['anthropic.claude-opus-4-7', 'jp.anthropic.claude-opus-4-7'],
    ['anthropic.claude-opus-4-8', 'jp.anthropic.claude-opus-4-8'],
  ];
  for (const [mid, pid] of jp5) {
    const a = assess(mid, pid);
    assertEq(a.gates.destinations_japan.status, PASS, `${mid} destinations_japan`);
    assertEq(a.domesticPath, 'jp_geo_profile', `${mid} 経路`);
    assertEq(a.invocationTarget, pid, `${mid} は jp profile を指定する`);
  }
  // jp. profile に国外 destination が混ざったら FAIL(名前では判定しない)
  const tampered = judgeDestinations(['ap-northeast-1', 'ap-northeast-3', 'us-east-1'], JAPAN_REGIONS);
  assertEq(tampered.destinations_japan.status, MUTATE ? PASS : FAIL, '国外destination追加を見逃した');
  // ap-northeast-2(ソウル)は前方一致では通ってしまう。国内リスト厳格判定で落とす
  assertEq(judgeDestinations(['ap-northeast-1', 'ap-northeast-2'], JAPAN_REGIONS).destinations_japan.status, FAIL, 'Seoulを日本扱いしている');
  // 空集合は PASS にしない
  assert(judgeDestinations([], JAPAN_REGIONS).destinations_japan.status !== PASS, '空destinationをPASSにしている');
});
t('23. EOL: Haiku4.5/Sonnet4.5 は 2026-08-30 基準・猶予90日で production candidate から外れる(変異: EOL欠落/未来改ざんで落ちる)', () => {
  const h = assess('anthropic.claude-haiku-4-5-20251001-v1:0', 'jp.anthropic.claude-haiku-4-5-20251001-v1:0');
  const s = assess('anthropic.claude-sonnet-4-5-20250929-v1:0', 'jp.anthropic.claude-sonnet-4-5-20250929-v1:0');
  for (const [a, floor] of [[h, '2026-10-01'], [s, '2026-09-29']]) {
    assertEq(a.gates.eol_not_near.status, MUTATE ? PASS : FAIL, `${a.modelId} eol gate`);
    assertEq(a.productionCandidate, MUTATE ? true : false, `${a.modelId} production除外`);
    assertEq(a.benchmarkOnly, true, `${a.modelId} は benchmark-only 表示`);
    assertEq(a.gates.eol_not_near.evidence.eolDate, floor, `${a.modelId} EOL floor`);
  }
  // 変異「EOLを欠落させる」→ UNKNOWN になり FAIL(=production除外)ではなくなることを検出できる
  assertEq(judgeEol(null, NOW, 90).status, UNKNOWN);
  // 変異「EOLを未来へ改ざん」→ PASS になる = このテストの FAIL 期待が落ちる
  assertEq(judgeEol('2027-12-31', NOW, 90).status, PASS);
  // 猶予基準は設定値で、黙って固定されない
  assertEq(judgeEol('2026-10-01', NOW, 10).status, PASS, 'minimumEolHeadroomDays が効いていない');
});
t('24. retention: provider_data_share 要求モデル(Fable 5)は none のまま候補から除外(変異検出)', () => {
  const a = assess('anthropic.claude-fable-5', null);
  assertEq(a.gates.retention_none.status, MUTATE ? PASS : FAIL, 'opt-in保持要求を見逃した');
  assertEq(a.gates.no_prompt_output_sharing_with_model_provider.status, FAIL, '共有opt-in要求モデルの共有ゲートがFAILでない');
  assertEq(a.evaluable, false, 'Fable 5 が実行可能になっている');
  assert(String(a.gates.retention_none.evidence?.modelCard?.url || '').includes('model-card-anthropic-claude-fable-5'), '公式カードの証拠が無い');
});
t('25. 共有ゲート分割: none+公式仕様でプロンプト/出力非共有はPASS、非コンテンツ共有は決してPASSしない(変異検出)', () => {
  const a = assess('moonshotai.kimi-k2.5', null);
  assertEq(a.gates.no_prompt_output_sharing_with_model_provider.status, PASS, 'retention none の証拠付きPASSが効かない');
  assert((a.gates.no_prompt_output_sharing_with_model_provider.evidence?.sources || []).some((s) => s.includes('data-retention')), '公式仕様の出典が無い');
  assertEq(a.gates.no_noncontent_usage_metadata_sharing.status, MUTATE ? PASS : UNKNOWN, '非コンテンツ共有を自動PASSしている');
  assertEq(a.gates.no_noncontent_usage_metadata_sharing.evidence?.resolution, 'HUMAN_REQUIRED');
});
t('26. 6枚ゲート分離: structural は公式仕様でPASS可、runtime は smoke まで UNKNOWN(変異: 混同で落ちる)', () => {
  const a = assess('moonshotai.kimi-k2.5', null);
  assertEq(a.gates.six_image_structural.status, PASS, 'Image+Converse+上限20の構造的PASSが効かない');
  assertEq(a.gates.six_image_structural.evidence?.converseImageLimit, 20);
  assertEq(a.gates.six_image_runtime_verified.status, MUTATE ? PASS : UNKNOWN, 'runtime verified を smoke 前にPASSしている(structuralとの混同)');
});
t('27. terms_allow_usecase を証拠なしでPASSしない(変異検出)', () => {
  const a = assess('anthropic.claude-haiku-4-5-20251001-v1:0', 'jp.anthropic.claude-haiku-4-5-20251001-v1:0');
  assertEq(a.gates.terms_allow_usecase.status, MUTATE ? PASS : UNKNOWN, '規約を自動PASSしている');
  assert(['HUMAN_REQUIRED', 'LEGAL_REVIEW_REQUIRED'].includes(a.gates.terms_allow_usecase.evidence?.resolution), 'resolution が人間判断になっていない');
  assert(Array.isArray(a.gates.terms_allow_usecase.evidence?.checklist), 'Replier固有チェックリストが添付されていない');
});
t('28. derived_estimate 価格を official として扱わない(変異検出)', () => {
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, 'override_derived.json');
  writeFileSync(p, JSON.stringify({ models: {
    'x.official': { kind: 'official_exact', inputPerMTokUsd: 1, outputPerMTokUsd: 2, source: 'https://aws.amazon.com/bedrock/pricing/', fetchedAt: 'now' },
    'x.derived': { kind: 'derived_estimate', inputPerMTokUsd: 9, outputPerMTokUsd: 9, basis: 'global流用', source: 'url', fetchedAt: 'now' },
  } }));
  const pr = cost.loadPricing({ overridePath: p, snapshotPath: null });
  assertEq(!!pr.models['x.official'], true, 'official が読まれない');
  assertEq(!!pr.models['x.derived'], MUTATE ? true : false, 'derived が official 扱いになっている');
  assertEq(!!pr.derivedEstimates['x.derived'], true, 'derived が参考一覧に無い');
});
t('29. dry-run は実モデル呼び出し経路を通らない(資格情報ゼロでも成功する。変異: 有効化で落ちる)', () => {
  const env = { ...process.env };
  delete env.AWS_ACCESS_KEY_ID; delete env.AWS_SECRET_ACCESS_KEY; delete env.AWS_SESSION_TOKEN; delete env.AWS_PROFILE;
  const out = execFileSync(process.execPath,
    ['pricing_eval/src/run_eval.mjs', '--stage=dryrun', '--usd-jpy=160', '--max-budget-jpy=10000'],
    { encoding: 'utf8', env });
  assert(out.includes('dry-run'), 'dryrun が実行されていない');
  assertEq(out.includes('実行開始'), MUTATE ? true : false, 'dry-run 中に実行経路へ入っている');
});

console.log('\n== smoke 前提(2026-08-31 GO対応: EOL意味論・安全ガード・再試行制限) ==');
t('30. EOL=N/A は PASS でなく UNKNOWN(smoke可・production=CONDITIONAL)。無期限保証と表示しない(変異検出)', () => {
  const g = judgeEol('none_announced', new Date('2026-08-30T12:00:00Z'), 90);
  assertEq(g.status, MUTATE ? PASS : UNKNOWN, 'N/A を PASS(90日保証)扱いしている');
  assertEq(g.evidence.eligible_for_smoke, true);
  assertEq(g.evidence.eligible_for_production, 'CONDITIONAL');
  assert(!/無期限|保証/.test(g.note.replace('無期限保証ではない', '')), 'N/A を保証として表示している');
  assert(g.note.includes('リスク受容'), '人間のリスク受容が明示されていない');
  // assessModel 側にも同じ意味論が出る
  const a = assess('moonshotai.kimi-k2.5', null);
  assertEq(a.eolAssessment.eol_headroom_verified, UNKNOWN);
  assertEq(a.eolAssessment.eligible_for_smoke, true);
  assertEq(a.eolAssessment.eligible_for_production, 'CONDITIONAL');
  assertEq(a.evaluable, true, 'EOL未公表で smoke まで塞いでいる');
  // 公表EOLが90日以上先なら PASS / 90日未満は FAIL(production除外)のまま
  assertEq(judgeEol('2027-01-01', new Date('2026-08-30T12:00:00Z'), 90).status, PASS);
  assertEq(judgeEol('2026-10-01', new Date('2026-08-30T12:00:00Z'), 90).status, FAIL);
});
const { checkSmokeGuard } = await import('../src/smoke_guard.mjs');
const SMOKE_ALLOW = ['mistral.ministral-3-14b-instruct', 'qwen.qwen3-vl-235b-a22b', 'mistral.mistral-large-3-675b-instruct', 'moonshotai.kimi-k2.5'];
function guardBase() {
  return {
    preflight: {
      identity: { arnTail: '...711901:user/replier-eval-cli', credentialSource: 'profile:replier-eval' },
      region: 'ap-northeast-1', retention: { mode: 'none', ok: true }, allowModelEvaluation: true,
    },
    env: { AWS_PROFILE: 'replier-eval' },
    expectedProfile: 'replier-eval',
    region: 'ap-northeast-1',
    allowlist: [...SMOKE_ALLOW],
    candidates: SMOKE_ALLOW.map((id) => ({ modelId: id, invocationTarget: id, domesticPath: 'direct_in_region_tokyo', evaluable: true, fails: [] })),
    pricing: { models: {
      'mistral.ministral-3-14b-instruct': { inputPerMTokUsd: 0.24, outputPerMTokUsd: 0.12 },
      'qwen.qwen3-vl-235b-a22b': { inputPerMTokUsd: 0.32, outputPerMTokUsd: 3.22 },
      'mistral.mistral-large-3-675b-instruct': { inputPerMTokUsd: 0.61, outputPerMTokUsd: 1.82 },
      'moonshotai.kimi-k2.5': { inputPerMTokUsd: 0.72, outputPerMTokUsd: 3.6 },
    } },
    stage: 'smoke', usdJpy: 160, maxBudgetJpy: 100, maxBudgetUsd: 0.625,
    outputMaxTokens: 1024, maxAutoRetries: 1, retryTransientOnly: true,
    casesShaHead: 'abc', casesShaDisk: 'abc',
    screenshotCountExpected: 138, screenshotCountActual: 138,
  };
}
t('31. smoke guard: 正常条件はPASSし、12種の変異すべてで fail closed になる(変異検出)', () => {
  const ok = checkSmokeGuard(guardBase());
  assertEq(ok.ok, MUTATE ? false : true, `正常条件がPASSしない: ${ok.blockers.join(' / ')}`);
  assert(ok.facts.worstJpy < 100 && ok.facts.worstUsd < 0.625, 'worst-case計算が異常');
  const mutants = {
    'allowlist外モデル追加': (i) => { i.allowlist.push('evil.model'); },
    'Claudeモデル混入': (i) => { i.allowlist.push('anthropic.claude-opus-5'); },
    'global profileへ置換': (i) => { i.candidates[0].invocationTarget = 'global.' + i.candidates[0].modelId; },
    'jp profileへ置換': (i) => { i.candidates[1].invocationTarget = 'jp.' + i.candidates[1].modelId; i.candidates[1].domesticPath = 'jp_geo_profile'; },
    'regionを東京以外へ': (i) => { i.preflight.region = 'us-east-1'; },
    'retentionをnone以外へ': (i) => { i.preflight.retention = { mode: 'default', ok: false }; },
    'invocation logging有効': (i) => { i.preflight.retention = { mode: 'logging_enabled', ok: false }; },
    '合成データhash不一致': (i) => { i.casesShaDisk = 'tampered'; },
    '予算100円超過(上限緩和)': (i) => { i.maxBudgetJpy = 101; },
    '予算100円超過(worst-case超え)': (i) => { i.pricing.models['moonshotai.kimi-k2.5'].outputPerMTokUsd = 9999; },
    '価格不明': (i) => { delete i.pricing.models['qwen.qwen3-vl-235b-a22b']; },
    'fullモード有効': (i) => { i.stage = 'full'; },
    '偽のAWS環境変数': (i) => { i.env.AWS_ACCESS_KEY_ID = 'proxFAKE'; },
    '再試行制限なし': (i) => { i.retryTransientOnly = false; },
    'derived価格の使用': (i) => { i.pricing.models['qwen.qwen3-vl-235b-a22b'].kind = 'derived_estimate'; },
  };
  const leaks = [];
  for (const [name, fn] of Object.entries(mutants)) {
    const inp = guardBase(); fn(inp);
    const r = checkSmokeGuard(inp);
    if (r.ok) leaks.push(name);
  }
  assertEq(leaks.length, MUTATE ? 99 : 0, `fail closed にならなかった変異: ${leaks.join(', ')}`);
});
await (async () => {
  const rtCfg = { maxAutoRetries: 1, outputMaxTokens: 512, temperature: 0.7, backoffMs: 1, retryTransientOnly: true };
  const rowA = await runCase({ client: createMockClient({ fault: 'broken_json' }), cfg: rtCfg, model, testCase: cases[0], price });
  const rowB = await runCase({ client: createMockClient({ fault: 'http_429' }), cfg: rtCfg, model, testCase: cases[0], price });
  t('32. --retry-transient-only: 429/5xx以外(JSON崩れ等)は再試行しない(変異検出)', () => {
    assertEq(rowA.attempts.length, MUTATE ? 2 : 1, 'JSON崩れを再試行している(予算ゲート違反)');
    assertEq(rowB.attempts.length, 2, '429 の1回再試行が効かない');
  });
  t('32b. attempts にエラーコードが残る(契約系エラー即停止の判定材料)', () => {
    assert(typeof rowB.attempts[0].error === 'string' && rowB.attempts[0].error.length > 0, 'error コードが保存されていない');
  });

  // 33. AccessDenied で attempts に診断6項目が自動保存され、1回目で即停止できる
  const deniedClient = {
    synthetic: true,
    invoke: async () => {
      throw new AwsError("You don't have access to the model with the specified model ID.", {
        status: 403, code: 'AccessDeniedException', operation: 'Converse', requestId: 'req-test-0001',
      });
    },
  };
  const rowDenied = await runCase({ client: deniedClient, cfg: rtCfg, model, testCase: cases[0], price });
  t('33. AccessDenied: attempts へ errorCode/message/httpStatus/requestId/modelId/apiOperation を自動保存し再試行しない(変異検出)', () => {
    assertEq(rowDenied.attempts.length, MUTATE ? 2 : 1, 'AccessDenied を再試行している(禁止)');
    const a = rowDenied.attempts[0];
    assertEq(a.errorCode, 'AccessDeniedException', 'errorCode');
    assert(typeof a.sanitizedErrorMessage === 'string' && a.sanitizedErrorMessage.includes('access'), 'sanitizedErrorMessage');
    assertEq(a.httpStatus, 403, 'httpStatus');
    assertEq(a.requestId, 'req-test-0001', 'requestId');
    assertEq(a.modelId, model.modelId, 'modelId');
    assertEq(a.apiOperation, 'Converse', 'apiOperation');
  });
  t('33b. contractStopError: AccessDenied 行は停止・429/モデル出力不良の行は停止しない(変異検出)', () => {
    const stop = contractStopError(rowDenied);
    assertEq(stop === null, MUTATE ? true : false, 'AccessDenied 行で停止メッセージが出ない');
    if (stop) {
      assert(stop.includes('AccessDeniedException'), '停止メッセージにエラーコードが無い');
      assert(stop.includes('req-test-0001'), '停止メッセージに requestId が無い');
    }
    assertEq(contractStopError(rowB), null, '429(一時的)で誤停止する');
    assertEq(contractStopError(rowA), null, 'モデル出力不良(model_output)で誤停止する');
  });
})();

t('34. --max-retries は 0 を許可し、1 超は 1 に丸める(増やせない)(変異検出)', () => {
  const zero = loadConfig(parseArgs(['--max-retries=0'])).maxAutoRetries;
  assertEq(zero, MUTATE ? 1 : 0, '--max-retries=0 が効かない');
  assertEq(loadConfig(parseArgs(['--max-retries=5'])).maxAutoRetries, 1, '1 超が丸められない');
  assertEq(loadConfig(parseArgs([])).maxAutoRetries, 1, '既定値');
});

t('35. sanitizeAwsMessage: 資格情報・署名様の文字列を落とし長さを制限する(変異検出)', () => {
  const dirty = 'Credential=AKIAIOSFODNN7EXAMPLE/20260831, SignedHeaders=host;x-amz-date, ' +
    'Signature=deadbeefdeadbeefdeadbeef secret=wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEYAB end';
  const s = sanitizeAwsMessage(dirty);
  assertEq(/AKIA|deadbeef|wJalrXUtnFEMIK7MDENG/.test(s), MUTATE ? true : false, `秘密様の文字列が残っている: ${s}`);
  assert(s.includes('[REDACTED'), 'REDACTED マークが無い');
  const long = sanitizeAwsMessage('x'.repeat(2000));
  assert(long.length < 600 && long.includes('[truncated]'), '長文が切られていない');
});

t('36. judgeAvailability: 全項目 AVAILABLE/AUTHORIZED のみ ok(変異検出)', () => {
  const good = judgeAvailability({
    agreementAvailability: { status: 'AVAILABLE' }, authorizationStatus: 'AUTHORIZED',
    entitlementAvailability: 'AVAILABLE', regionAvailability: 'AVAILABLE',
  });
  assertEq(good.ok, MUTATE ? false : true, '正常系が ok にならない');
  for (const bad of [
    { agreementAvailability: { status: 'NOT_AVAILABLE' }, authorizationStatus: 'AUTHORIZED', entitlementAvailability: 'AVAILABLE', regionAvailability: 'AVAILABLE' },
    { agreementAvailability: { status: 'AVAILABLE' }, authorizationStatus: 'NOT_AUTHORIZED', entitlementAvailability: 'AVAILABLE', regionAvailability: 'AVAILABLE' },
    { agreementAvailability: { status: 'AVAILABLE' }, authorizationStatus: 'AUTHORIZED', entitlementAvailability: 'NOT_AVAILABLE', regionAvailability: 'AVAILABLE' },
    {},
  ]) assertEq(judgeAvailability(bad).ok, false, '不可の状態を ok にしている');
});

function allPass() {
  const g = {};
  for (const id of ['bedrock_available', 'lifecycle_active', 'callable_from_tokyo', 'destinations_japan',
    'destinations_allowed', 'multimodal', 'six_image_structural', 'six_image_runtime_verified',
    'retention_none', 'no_prompt_output_sharing_with_model_provider', 'no_noncontent_usage_metadata_sharing',
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
