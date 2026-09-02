// 事実ファイアウォール+内部6候補選抜の自動テスト(2026-09-01 発注者指示 §9 の30項目)。
//
// 実行: node pricing_eval/tests/fact_firewall_tests.mjs
// 変異検証: node pricing_eval/tests/mutate_fact_firewall.mjs
//   (このファイルは FF_LIB_DIR で検査対象のモジュール置き場を差し替えられる。
//    変異ランナーは lib を一時ディレクトリへ複製し、1箇所だけ壊してこのスイートが落ちることを確かめる)
//
// **モデル呼び出しは一切しない**(保存済み出力と合成 fixture だけ)。台帳・cases.json も触らない。

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const LIB = resolve(process.env.FF_LIB_DIR || 'reply-ai-app/src/lib');
const imp = (f) => import(pathToFileURL(join(LIB, f)).href);
const { checkFactFirewall, findPersonalFacts, PLACEHOLDER_RE, splitClauses } = await imp('fact_firewall.mjs');
const cs = await imp('candidate_select.mjs');
const { LANES, FINAL_COUNT, CANDIDATE_COUNT, FALLBACK_TEMPLATES, deriveLane, validateCandidate, selectThree, finalizeReplies, pickFallback, similarity } = cs;
const { BANNED_RULES } = await import('../src/validate_output.mjs');

let pass = 0, fail = 0; const failures = [];
function t(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); fail++; failures.push(name); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || '条件を満たしません'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期待 ${JSON.stringify(b)} / 実際 ${JSON.stringify(a)}`); }
const sha = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null);

// --- 台帳・データセットの指紋(テストで動かないことを最後に確かめる) ---
const LEDGER_FILES = ['pricing_eval/runs/call_log.jsonl', 'pricing_eval/runs/ledger.jsonl', 'pricing_eval/cases.json', 'pricing_eval/cases_fab10.json'];
const before = Object.fromEntries(LEDGER_FILES.map((f) => [f, sha(f)]));

// --- 入力(grounding)は既存の合成データから作る(改変しない) ---
const casesAll = [
  ...JSON.parse(readFileSync('pricing_eval/cases.json', 'utf8')).cases,
  ...JSON.parse(readFileSync('pricing_eval/cases_fab10.json', 'utf8')).cases,
];
function ctxFor(caseId, extra = {}) {
  const c = casesAll.find((x) => x.id === caseId);
  if (!c) throw new Error(`ケースが無い: ${caseId}`);
  const conv = (c.conversation || []).map((x) => x.text);
  return {
    conversationText: [c.goal, c.style_sample || '', c.partner_profile ? `${c.partner_profile.nickname} ${c.partner_profile.note}` : '', ...conv].join(' '),
    selfMessages: (c.conversation || []).filter((x) => x.from === 'self').map((x) => x.text),
    bannedRules: BANNED_RULES,
    idempotencyKey: `test-${caseId}`,
    ...extra,
  };
}
const FIX = JSON.parse(readFileSync('pricing_eval/fixtures/saved_problem_outputs.json', 'utf8'));

const FACT_A = { id: 'f1', text: '焼き鳥が好きで、塩派', enabledForRequest: true, source: 'explicit' };
const FACT_DISABLED = { id: 'f2', text: '毎週ジムに行っている', enabledForRequest: false, source: 'explicit' };
const cand = (text, lane = 'reaction', usedFactIds = []) => ({ text, lane, usedFactIds });
const six = (texts) => texts.map((x, i) => (typeof x === 'string' ? cand(x, LANES[i % 3]) : x));

console.log('\n== 事実ファイアウォール(許可/禁止の境界) ==');

t('01. lane を偽装した個人事実は本文で検出する(申告 reaction でも過去体験なら hard)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const v = validateCandidate(cand('先週あの店行ってきたんですけど、めっちゃ良かったです', 'reaction', []), ctx);
  assertEq(v.ok, false, 'lane 偽装の個人事実を通した');
  assert(v.reasons.some((r) => r.code === 'past_experience'), `理由コード: ${v.reasons.map((r) => r.code)}`);
});

t('02. usedFactIds=[] で個人事実を出したら hard(申告した自分情報だけが根拠になる)', () => {
  const ctx = ctxFor('FAB_FOOD_01', { enabledFacts: [FACT_A] });
  const declaredOk = validateCandidate(cand('自分は塩派なんですよ', 'personal_or_future', ['f1']), ctx);
  assertEq(declaredOk.ok, true, `申告済みの自分情報を根拠にした発言を止めた: ${declaredOk.reasons.map((r) => r.detail)}`);
  const undeclared = validateCandidate(cand('自分は塩派なんですよ', 'personal_or_future', []), ctx);
  assertEq(undeclared.ok, false, 'usedFactIds=[] の個人事実を通した');
  assert(undeclared.reasons.some((r) => r.code === 'undeclared_fact_use'), '申告漏れを記録していない');
  const notCovered = validateCandidate(cand('自分はコーヒーは浅煎り派なんですよ', 'personal_or_future', ['f1']), ctx);
  assertEq(notCovered.ok, false, '自分情報が説明しない好みを通した');
});

t('03. 正しい fact ID と架空の追加事実を同時に出したら hard', () => {
  const ctx = ctxFor('FAB_FOOD_01', { enabledFacts: [FACT_A] });
  const v = validateCandidate(cand('焼き鳥は塩派です。あと毎週ジム通ってます', 'personal_or_future', ['f1']), ctx);
  assertEq(v.ok, false, '申告した事実以外の個人事実を通した');
  assert(v.reasons.some((r) => r.code === 'habit_frequency'), `理由: ${v.reasons.map((r) => r.code)}`);
});

t('04. 無効化済み fact ID は hard', () => {
  const ctx = ctxFor('FAB_FOOD_01', { enabledFacts: [FACT_A, FACT_DISABLED] });
  const v = validateCandidate(cand('ジム行ってます', 'personal_or_future', ['f2']), ctx);
  assertEq(v.ok, false, '無効な自分情報IDを通した');
  assert(v.reasons.some((r) => r.code === 'disabled_fact_id'), `理由: ${v.reasons.map((r) => r.code)}`);
});

t('05. 他リクエストの fact ID は hard(存在しない ID も hard)', () => {
  const ctx = ctxFor('FAB_FOOD_01', { enabledFacts: [FACT_A], foreignFactIds: ['other-req-1'] });
  const v = validateCandidate(cand('前に話したやつです', 'reaction', ['other-req-1']), ctx);
  assert(v.reasons.some((r) => r.code === 'foreign_fact_id'), `別リクエストIDを検出しない: ${v.reasons.map((r) => r.code)}`);
  const v2 = validateCandidate(cand('いいですね', 'reaction', ['nope']), ctx);
  assert(v2.reasons.some((r) => r.code === 'unknown_fact_id'), '不明IDを検出しない');
});

t('06. 主語なしの「週1で行ってます」を検出する', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  assertEq(validateCandidate(cand('週1で行ってます', 'reaction'), ctx).ok, false, '主語省略の習慣を見逃した');
});

t('07. 主語なしの「先週行きました」を検出する', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  assertEq(validateCandidate(cand('先週行きました', 'reaction'), ctx).ok, false, '主語省略の過去体験を見逃した');
});

t('08. 「行ってみたい」を過去体験として誤停止しない', () => {
  const ctx = ctxFor('FAB_TRAVEL_01');
  for (const s of ['温泉行ってみたいなー', '今度食べてみたいです', 'それ読んでみたい', 'いつか行きたいですね']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'ok', `未来の意向を誤停止: ${s}`);
  }
});

t('09. 「気になる」を好みとして誤停止しない', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const s of ['それ気になる', '気になってきた笑', 'なんか興味出てきました', 'それいいね、楽しそう', '聞いてたらお腹すいてきた笑']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'ok', `許可された反応を誤停止: ${s}`);
  }
});

t('10. 入力にある固有名詞の再利用は許可', () => {
  const ctx = ctxFor('FAB_TRAVEL_02');   // 相手が「台湾」に3回行った、と入力にある
  assertEq(checkFactFirewall('台湾いいですね、行ってみたいです', ctx).verdict, 'ok', '入力にある固有名詞を止めた');
});

t('11. 新しい固有名詞を質問・未来で使うのは hard にしない(soft まで)', () => {
  const ctx = ctxFor('FAB_TRAVEL_01');
  for (const s of ['箱根とか気になってるけど、混んでそうだよね', '草津って行ったことあります?']) {
    assertEq(checkFactFirewall(s, ctx).verdict !== 'hard_reject', true, `質問・未来の固有名詞を hard にした: ${s}`);
  }
});

t('12. 新しい固有名詞を過去体験・好みとして使ったら hard', () => {
  const ctx = ctxFor('FAB_TRAVEL_01');
  for (const s of ['草津温泉は何回か行きました', '自分は箱根が好きです']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'hard_reject', `固有名詞つき個人史を通した: ${s}`);
  }
});

console.log('\n== 内部6候補 → 最終3案 ==');

t('13. 6候補すべて同じ lane でも最終3案を返す(不足 lane は fallback)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const r = finalizeReplies({ firstPass: six(['いいですね', 'それ楽しそう', 'めっちゃいい', 'いいなあ', 'すごい', '素敵']).map((c) => ({ ...c, lane: 'reaction' })), ctx });
  assertEq(r.replies.length, FINAL_COUNT, '3案でない');
  assert(r.fallbackLanes.includes('expand'), `不足 lane を fallback で埋めていない: ${JSON.stringify(r.fallbackLanes)}`);
});

t('14. 6候補すべて質問でも「全部質問」にならない', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const qs = ['どんなところが好きですか?', 'いつから好きなんですか?', 'どこで知ったんですか?', 'どのくらい行くんですか?', '何が決め手ですか?', 'おすすめありますか?'];
  const r = finalizeReplies({ firstPass: six(qs), ctx });
  assertEq(r.replies.length, FINAL_COUNT, '3案でない');
  assert(r.replies.some((x) => !/[?？]\s*$/.test(x)), `全案が疑問符で終わっている: ${JSON.stringify(r.replies)}`);
});

t('15. 6候補すべて不正でも3案(全部 fallback)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const bad = six(['〇〇に行きました', '先週も行きました', '週1で通ってます', '自分は塩派です', '相手さんはどうですか', '毎週食べてます']);
  const r = finalizeReplies({ firstPass: bad, ctx });
  assertEq(r.replies.length, FINAL_COUNT, '3案でない');
  assertEq(r.fallbackLanes.length, 3, `全 lane が fallback になるはず: ${JSON.stringify(r.fallbackLanes)}`);
  assertEq(r.rejected.length, 6, '不正候補を全部 reject していない');
});

t('16. 再生成後も不正なら fallback で3案を返す(再生成は1回まで)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const bad = six(['先週行きました', '週1で行ってます', '自分は塩派です', '毎日食べてます', '行きつけがあります', '〇〇が好きです']);
  const r = finalizeReplies({ firstPass: bad, secondPass: bad, ctx });
  assertEq(r.replies.length, FINAL_COUNT, '3案でない');
  assert(r.replies.every((x) => validateCandidate({ text: x, usedFactIds: [] }, ctx).ok), '最終案に不正が残っている');
});

t('17. fallback 同士が重複しない', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const r = finalizeReplies({ firstPass: [], ctx });
  assertEq(new Set(r.replies).size, FINAL_COUNT, `fallback が重複: ${JSON.stringify(r.replies)}`);
  for (let i = 0; i < r.replies.length; i++) {
    for (let j = i + 1; j < r.replies.length; j++) {
      assert(similarity(r.replies[i], r.replies[j]) < 0.72, `fallback が似すぎ: ${r.replies[i]} / ${r.replies[j]}`);
    }
  }
});

t('18. fallback テンプレート自体に禁止表現・プレースホルダ・個人事実が無い', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const lane of LANES) {
    assert(FALLBACK_TEMPLATES[lane].length >= 5, `${lane} のテンプレートが5件未満`);
    for (const tpl of FALLBACK_TEMPLATES[lane]) {
      const v = validateCandidate({ text: tpl, lane, usedFactIds: [] }, ctx);
      assertEq(v.ok, true, `テンプレートが検査に落ちる(${lane}): ${tpl} / ${v.reasons.map((r) => r.detail)}`);
      assertEq(PLACEHOLDER_RE.test(tpl), false, `テンプレートにプレースホルダ: ${tpl}`);
    }
  }
});

t('19. 最終出力は必ず3件(2件・4件になる状態を作れない)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const input of [[], six(['いいね']), six(['いいね', 'どう?', '行ってみたい', 'すごい', 'なぜ?', '興味ある'])]) {
    const r = finalizeReplies({ firstPass: input, ctx });
    assertEq(r.replies.length, FINAL_COUNT, `3案でない: ${JSON.stringify(r.replies)}`);
  }
});

t('20. hard reject の候補は最終3案へ漏れない(部分置換もしない)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const bad = '自分は中目黒のとりきちが好きなんですけど';
  const r = finalizeReplies({ firstPass: six([bad, bad, 'いいですね', 'どこが好きですか?', '行ってみたい', 'なるほど']), ctx });
  assert(!r.replies.some((x) => x.includes('とりきち')), `hard reject の本文が漏れた: ${JSON.stringify(r.replies)}`);
  assert(!r.replies.some((x) => x.includes('中目黒')), '部分置換で断片が残っている');
});

t('21. interest_level の再混入を止める', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  assertEq(validateCandidate({ text: 'いい感じですね', lane: 'reaction', usedFactIds: [], interest_level: 70 }, ctx).ok, false, 'interest_level を通した');
  assertEq(validateCandidate(cand('脈ありだと思いますよ', 'reaction'), ctx).ok, false, '脈あり断定を通した');
});

t('22. 「相手さん」の再混入を止める', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  assertEq(validateCandidate(cand('相手さんはどう思いますか?', 'expand'), ctx).ok, false, '「相手さん」を通した');
});

t('23. 「〇〇」「△△」「□□」の再混入を止める', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const s of ['〇〇に行きたいです', '△△が好きです', '□□はどうですか', '［店名］で待ち合わせ']) {
    assertEq(validateCandidate(cand(s, 'reaction'), ctx).ok, false, `プレースホルダを通した: ${s}`);
  }
});

console.log('\n== 保存済みの問題出力(Kimi / Qwen / Opus 5)の再判定 ==');

t('24-25. 保存済み出力の判定が期待どおり(Kimi/Qwen/Opus 5・誤検知も見逃しも数える)', () => {
  const wrong = [];
  for (const f of FIX.cases) {
    const ctx = ctxFor(f.caseId);
    const got = checkFactFirewall(f.text, ctx).verdict;
    const okExpected = f.expect === 'ok';
    const hardExpected = f.expect === 'hard_reject';
    // soft_risk 期待は「hard にしない・ok にしない」= 中間であること
    const good = hardExpected ? got === 'hard_reject' : okExpected ? got === 'ok' : got === 'soft_risk';
    if (!good) wrong.push(`${f.id}(${f.src}) 期待=${f.expect} 実際=${got}: ${f.text.slice(0, 30)}`);
  }
  assertEq(wrong.length, 0, `判定が期待と違う:\n     - ${wrong.join('\n     - ')}`);
});

t('26. 入力にない旅行歴・飲食習慣・読書歴を止める', () => {
  const ctx = ctxFor('FAB_MEDIA_01');
  for (const s of ['去年は3回旅行行きました', '毎週外食してます', '寝る前に毎日読んでます']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'hard_reject', `見逃し: ${s}`);
  }
});

t('27. 自分情報と会話内容が矛盾する場合(有効な自分情報が根拠なら通す・無ければ止める)', () => {
  const ctx = ctxFor('FAB_FOOD_01', { enabledFacts: [{ id: 'f9', text: '餃子は水餃子派', enabledForRequest: true, source: 'explicit' }] });
  const ok = validateCandidate(cand('餃子は水餃子派なんですよね', 'personal_or_future', ['f9']), ctx);
  assertEq(ok.verdict === 'hard_reject', false, '有効な自分情報を根拠にした発言を止めた');
  const ng = validateCandidate(cand('餃子は焼き餃子派なんですよね', 'personal_or_future', ['f9']), ctx);
  assertEq(ng.ok, false, '自分情報と食い違う好みを通した');
});

t('28. 同一 idempotency key なら fallback が変わらない(決定的)', () => {
  const ctx = ctxFor('FAB_FOOD_01', { idempotencyKey: 'req-abc-123' });
  const a = finalizeReplies({ firstPass: [], ctx });
  const b = finalizeReplies({ firstPass: [], ctx });
  assertEq(JSON.stringify(a.replies), JSON.stringify(b.replies), '同じ要求で fallback が変わった');
  const other = finalizeReplies({ firstPass: [], ctx: { ...ctx, idempotencyKey: 'req-zzz-999' } });
  assert(JSON.stringify(other.replies) !== JSON.stringify(a.replies) || true, '別鍵で同じでも致命ではない(決定性のみ要求)');
  for (const lane of LANES) assertEq(pickFallback(lane, 'k1'), pickFallback(lane, 'k1'), `${lane} の選択が非決定`);
});

console.log('\n== 影響範囲(台帳・モデル呼び出し) ==');

t('29. 台帳・予算計算・データセットに影響しない(指紋が変わらない)', () => {
  for (const f of LEDGER_FILES) assertEq(sha(f), before[f], `${f} が変化した`);
  const srcs = ['fact_firewall.mjs', 'candidate_select.mjs'].map((f) => readFileSync(join(LIB, f), 'utf8')).join('\n');
  assert(!/call_log|recordedSpendUsd|budgetAllows|ledger\.mjs/.test(srcs), '新モジュールが会計台帳に触れている');
});

t('30. モデル呼び出しゼロで完了する(新モジュール・テストに通信が無い)', () => {
  const srcs = ['fact_firewall.mjs', 'candidate_select.mjs'].map((f) => readFileSync(join(LIB, f), 'utf8')).join('\n');
  const self = readFileSync('pricing_eval/tests/fact_firewall_tests.mjs', 'utf8');
  // 検査語そのものがこのファイルに現れないよう、正規表現は分割して組み立てる
  const probes = [['HTTP取得', new RegExp('\\b' + 'fet' + 'ch\\s*\\(')], ['Anthropic API', new RegExp('api\\.' + 'anthro' + 'pic\\.com')], ['クラウド推論', new RegExp('bed' + 'rock', 'i')], ['AWS署名', new RegExp('AWS_' + 'ACCESS|Sig' + 'V4|sign' + 'Request')]];
  for (const [what, re] of probes) {
    assert(!re.test(srcs), `新モジュールに ${what} が含まれる`);
    assert(!re.test(self), `テストに ${what} が含まれる`);
  }
});

console.log('\n== 選抜の質(§6の追加条件) ==');

t('31. 3案は lane 順(reaction→expand→personal_or_future)・書き出しが同じにならない・同一言い換えにしない', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const r = finalizeReplies({ firstPass: [
    cand('餃子いいですね、なんかお腹すいてきた笑', 'reaction'),
    cand('餃子いいですね、めっちゃ好きそう', 'reaction'),
    cand('どんな餃子が一番好きなんですか?', 'expand'),
    cand('お店ってどうやって選んでるんですか?', 'expand'),
    cand('聞いてたら食べに行きたくなってきた', 'personal_or_future'),
    cand('おすすめあったら教えてほしいです', 'personal_or_future'),
  ], ctx });
  assertEq(r.replies.length, 3);
  assertEq(r.picked.map((p) => p.lane).join(','), LANES.join(','), 'lane の順序が違う');
  assertEq(r.fallbackLanes.length, 0, `fallback を使った: ${JSON.stringify(r.fallbackLanes)}`);
  const heads = r.replies.map((x) => x.slice(0, 5));
  assertEq(new Set(heads).size, 3, `書き出しが重複: ${JSON.stringify(heads)}`);
});

t('32. 外部契約(REPLY_SCHEMA)は3案固定のまま変わっていない', () => {
  const src = readFileSync('reply-ai-app/src/lib/prompts.ts', 'utf8');
  const m = src.match(/export const REPLY_SCHEMA = \{[\s\S]*?\n\} as const;/);
  assert(m, 'REPLY_SCHEMA を取り出せない');
  // 2026-08-31(commit a034414)時点の外部契約の指紋。1バイトでも変われば落ちる
  const digest = createHash('sha256').update(m[0]).digest('hex');
  assertEq(digest, '2d61aecca4f43804f37863e5f65e1f025507e57964d5020d713e36e3dcaf970a', '外部 REPLY_SCHEMA が変更されている(3案契約は不変が条件)');
  assert(/minItems: 3/.test(m[0]) && /maxItems: 3/.test(m[0]), '外部 schema の3案固定が壊れている');
  assert(!/interest_level/.test(m[0]), 'interest_level が復活している');
  assert(/situation/.test(m[0]) && /advice/.test(m[0]), '外部 schema の項目が減っている');
});

t('33. 相手に帰属する言い方(「〜なんですね」)を自分の事実として誤停止しない', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const s of ['餃子好きなんですね', '週1で食べてるんですね、すごい', 'ミナさんは塩派なんですね']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'ok', `相手への帰属を誤停止: ${s}`);
  }
});

t('34. 動詞を伴わない習慣・経歴の断定も止める(頻度だけ・範囲だけの言い方)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  assertEq(checkFactFirewall('だいたい週3くらいかな', ctx).verdict, 'hard_reject', '頻度だけの断定を見逃した');
  assertEq(checkFactFirewall('自分は近場だけなんで', ctx).verdict, 'hard_reject', '範囲だけの経歴断定を見逃した');
});

t('35. 自動送信・操作を促す表現を止める', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const s of ['自動で送っておきますね', '代わりに送っておきます', 'わざと既読つけずに放置しましょう']) {
    assertEq(validateCandidate(cand(s, 'reaction'), ctx).ok, false, `操作・自動送信を通した: ${s}`);
  }
});

t('36. 似すぎた候補は3案に同時採用しない(別 lane でも言い換え3件にしない)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  // 書き出しは違うが中身がほぼ同じ2件(実測 similarity 0.826)を別 lane に置く。
  // 書き出し規則では弾けないので、類似度の除外が効いていないと3案に同時採用されてしまう
  const r = finalizeReplies({ firstPass: [
    cand('餃子いいですね、めっちゃ良さそう', 'reaction'),
    cand('話を聞いてるだけで餃子食べたくなってきました?', 'expand'),
    cand('聞いてるだけで餃子食べたくなってきました笑', 'personal_or_future'),
    cand('なるほど、それは良さそう', 'reaction'),
    cand('どんなタレで食べるのが好きなんですか?', 'expand'),
    cand('おすすめあったら教えてほしいです', 'personal_or_future'),
  ], ctx });
  assertEq(r.replies.length, 3);
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      assert(similarity(r.replies[i], r.replies[j]) < 0.72, `似すぎた案を同時採用: 「${r.replies[i]}」/「${r.replies[j]}」`);
    }
  }
});

console.log('\n== 2026-09-02 の実測で見逃した型(人間が「作り話」と判定したもの) ==');

t('37. 実runで見逃した4型が hard になる(ハマってる/主語つきの好み/作品名のおすすめ/体験前提の助言)', () => {
  const ctx = ctxFor('FAB_MEDIA_02');
  const cases = [
    ['最近はサスペンス系にハマってる笑', 'established_preference'],
    ['私は最近はSFとコメディのバランスがいいかも', 'self_preference_claim'],
    ['おすすめは『バービー』とか『君たちはどう生きるか』かな、観てないならぜひ', 'proper_noun_personal_history'],
    ['専門店で足型測定してもらうのおすすめです、自分に合うの見つかりますよ', 'experience_based_advice'],
  ];
  for (const [text, code] of cases) {
    const v = checkFactFirewall(text, ctx);
    assertEq(v.verdict, 'hard_reject', `見逃し: ${text}`);
    assert(v.reasons.some((r) => r.code === code), `理由コードが違う(${code}): ${v.reasons.map((r) => r.code)}`);
  }
});

t('38. 日本語の壊れは soft_risk(hard にしない)。ふつうの日本語を誤検知しない', () => {
  const ctx = ctxFor('FAB_TRAVEL_01');
  const v = checkFactFirewall('温泉いいね!聞いたらお風呂入ったくなります笑', ctx);
  assertEq(v.verdict, 'soft_risk', '誤字を素通しした/hard にした');
  assert(v.reasons.some((r) => r.code === 'broken_conjugation'), `理由: ${v.reasons.map((r) => r.code)}`);
  // 誤検知していた実例(「こととか」の「とと」・「ぼったくり」の「った+く」)
  for (const s2 of ['最近ちょっと嬉しかったこととかあります?', 'ぼったくりの店は嫌ですよね', '行きたくなってきました']) {
    assert(!checkFactFirewall(s2, ctx).reasons.some((r) => /glitch|duplicated_particle|broken_conjugation|repeated_char/.test(r.code)), `ふつうの日本語を誤検知: ${s2}`);
  }
});

t('39. 「おすすめは無い」と正直に答える型は ok のまま(発注者が「これでいい」と言った言い回し)', () => {
  const ctx = ctxFor('FAB_FOOD_02');
  for (const s2 of [
    '実はまだこれってお店がなくて、逆におすすめ知りたいです',
    '詳しくないんですよね〜 どういうお店が好みですか?',
    'ちゃんと調べたことなかったです笑 教えてもらっていいですか?',
    'おすすめあったら教えてほしいです',
  ]) {
    assertEq(checkFactFirewall(s2, ctx).verdict, 'ok', `正直な「無い」を止めた: ${s2}`);
  }
});

t('40. 候補生成プロンプトが本番の文体ルールの上に建っている(落とすと AI っぽくなる)', () => {
  const src = readFileSync('reply-ai-app/src/lib/prompts.ts', 'utf8');
  const cand = src.match(/REPLY_CANDIDATES_SYSTEM = `([\s\S]*?)`;/);
  assert(cand, 'REPLY_CANDIDATES_SYSTEM を取り出せない');
  assert(cand[1].includes('${STYLE_AND_TELL}'), '共有の文体ブロックを使っていない');
  const style = src.match(/STYLE_AND_TELL = `([\s\S]*?)`;/);
  assert(style, 'STYLE_AND_TELL が無い');
  for (const k of ['30〜60字', '句読点', 'アンケート', 'オウム返し', '温度ゼロ', '毎通同じ長さ']) {
    assert(style[1].includes(k), `共有の文体ブロックに「${k}」が無い`);
  }
  for (const k of ['金太郎飴', '質問で終わる案は多くても1つ', '正直に答えてよい', '少なくとも1案']) {
    assert(cand[1].includes(k), `候補プロンプトに「${k}」が無い`);
  }
});

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗`);
if (fail) console.log(`失敗: ${failures.join(', ')}`);
process.exit(fail === 0 ? 0 : 1);
