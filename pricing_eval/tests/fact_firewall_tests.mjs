// 事実ファイアウォール+内部6候補選抜の自動テスト。
// 2026-09-01 発注者指示(初版 §9 の30項目)+ 同日の FIX_REQUIRED
// (否定形の個人事実・謙遜・日常行動の捏造・soft_risk の選抜規則・集計指標・会計差額の突合・次回費用の見積り)。
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
// 評価器側(会計突合・費用見積り)も差し替え可能にする(変異ランナーが複製先を指す)
const EVAL_SRC = resolve(process.env.FF_EVAL_SRC_DIR || 'pricing_eval/src');
const impEval = (f) => import(pathToFileURL(join(EVAL_SRC, f)).href);
const { spendByRun, explainDelta } = await impEval('reconcile_spend.mjs');
const { estimateNextRun } = await impEval('estimate_next_run.mjs');
const { loadCallLog, recordedSpendUsd } = await impEval('lib/call_log.mjs');

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

console.log('\n== §1 否定形の個人事実(2026-09-01 FIX_REQUIRED) ==');

t('37. 根拠のない否定形の個人事実は hard(肯定・否定にかかわらず個人事実として扱う)', () => {
  const ctx = ctxFor('FAB_TRAVEL_01');
  const ng = [
    '行ったことがないです', '食べたことがないんですよね', '観たことがないです', '読んだことがないです',
    '買ったことがないんです', '持っていないんですよ', '飼っていないです', '住んだことがないです', '経験したことがないです',
  ];
  for (const s of ng) assertEq(checkFactFirewall(s, ctx).verdict, 'hard_reject', `否定形の個人事実を通した: ${s}`);
});

t('38. 「台湾は行ったことないです」は hard・未来の意向は誤停止しない', () => {
  const ctx = ctxFor('FAB_TRAVEL_02');   // 会話に「台湾」はあるが、自分の渡航歴は入力に無い
  assertEq(checkFactFirewall('台湾は行ったことないです', ctx).verdict, 'hard_reject', '否定形の渡航歴を通した');
  assertEq(checkFactFirewall('台湾は行ったことないんですよね、3回行くくらいハマったきっかけ何だったんですか?', ctx).verdict, 'hard_reject', '否定形+質問でも個人事実は残る');
  for (const s of ['台湾行ってみたいです', 'いつか行きたいですね', '今度食べてみたいです']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'ok', `未来の意向を誤停止: ${s}`);
  }
});

console.log('\n== §2 謙遜(soft・hard にはしない) ==');

t('39. 「詳しくない」「よく知らない」は ok でも hard でもなく soft_risk', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const s of ['お店はそこまで詳しくないんですけど', '詳しくないので教えてほしいです', 'よく知らないんですよね', 'あんまり詳しくなくて']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'soft_risk', `謙遜の判定が違う: ${s}`);
  }
});

t('40. 非事実表現(詳しく知りたい・もう少し知りたい・教えてほしい・気になる)は ok のまま', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  for (const s of ['詳しく知りたいので教えてほしいです', 'もう少し知りたいです', '教えてほしいです', '気になる', 'もっと詳しく聞きたいです']) {
    assertEq(checkFactFirewall(s, ctx).verdict, 'ok', `非事実表現を誤停止: ${s}`);
  }
});

console.log('\n== §3 日常行動の捏造 ==');

t('41. 根拠のない自分の行動は hard(主語が無くても検出する)', () => {
  const ctx = ctxFor('FAB_EXP_02');
  const ng = ['洗濯して終わりました', '仕事が終わりました', '今帰ってきました', '料理してました', 'ジムに行ってました', 'さっき買い物してきました', '家で映画を見てました'];
  for (const s of ng) assertEq(checkFactFirewall(s, ctx).verdict, 'hard_reject', `日常行動の捏造を通した: ${s}`);
});

t('42. 相手への質問は日常行動として誤停止しない', () => {
  const ctx = ctxFor('FAB_EXP_02');
  for (const s of ['仕事終わりました?', '今日は何してました?', '最近ジム行ってます?']) {
    assertEq(checkFactFirewall(s, ctx).verdict !== 'hard_reject', true, `相手への質問を止めた: ${s}`);
  }
});

console.log('\n== §4 soft_risk の選抜規則(ok > soft_risk > fallback) ==');

t('43. soft_risk は最終3案で最大1件(全部 soft でも1件まで)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  // lane 申告と本文が食い違う = lane_mismatch(soft)。全候補を soft にする
  const soft6 = [
    cand('いいですね、なんか楽しそう', 'expand'),
    cand('めっちゃ良さそうですね', 'expand'),
    cand('どんなところが好きなんですか?', 'personal_or_future'),
    cand('どこで知ったんですか?', 'personal_or_future'),
    cand('今度食べてみたいです', 'reaction'),
    cand('おすすめ聞きたいです', 'reaction'),
  ];
  const r = finalizeReplies({ firstPass: soft6, ctx });
  assertEq(r.replies.length, FINAL_COUNT, '3案でない');
  assert(soft6.every((c) => validateCandidate(c, ctx).verdict === 'soft_risk'), '前提: 6件とも soft_risk であること');
  assertEq(r.stats.selectedSoftRiskCount <= 1, true, `soft_risk を ${r.stats.selectedSoftRiskCount} 件採用した(上限1件)`);
  assertEq(r.stats.selectedFallbackCount, FINAL_COUNT - r.stats.selectedSoftRiskCount - r.stats.selectedOkCount, 'fallback の件数が合わない');
});

t('44. ok 候補が3件あるなら soft_risk は選ばない', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const r = finalizeReplies({ firstPass: [
    cand('いいですね、楽しそう', 'expand'),                       // soft(lane 不一致)
    cand('どんなところが好きなんですか?', 'expand'),               // ok
    cand('お店ってどうやって選んでるんですか?', 'expand'),          // ok
    cand('聞いてたら食べたくなってきました', 'personal_or_future'),  // ok
    cand('なるほど、そういうのいいな', 'reaction'),                 // ok
    cand('おすすめあったら教えてほしいです', 'personal_or_future'),  // ok
  ], ctx });
  assertEq(r.replies.length, FINAL_COUNT, '3案でない');
  assertEq(r.stats.selectedSoftRiskCount, 0, `ok 候補があるのに soft_risk を採用した: ${JSON.stringify(r.replies)}`);
  assertEq(r.stats.selectedFallbackCount, 0, 'ok 候補があるのに fallback を使った');
  // lane 選抜の段階で ok を選べていること(soft を選んでから差し替える動きになっていない)
  assert(r.picked.every((p) => !p.upgradedFromSoft), 'lane 選抜が soft_risk を先に選んでいる(優先順位が ok > soft になっていない)');
});

t('45. hard reject は最終3案に絶対入らない(判定ベースでも確認)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const r = finalizeReplies({ firstPass: six(['先週行きました', '週1で通ってます', '自分は塩派です', '〇〇が好きです', '毎日食べてます', '行きつけがあります']), ctx });
  assert(r.picked.every((p) => p.verdict !== 'hard_reject'), 'hard reject が最終3案に混ざった');
  assert(r.replies.every((x) => validateCandidate({ text: x, usedFactIds: [] }, ctx).verdict !== 'hard_reject'), '最終案が hard 判定になる');
});

t('46. soft_risk が2件以上必要なら再生成 → それでも足りなければ2件目の soft ではなく fallback', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const softPass = [
    cand('いいですね、楽しそう', 'expand'),                 // soft(lane 不一致)
    cand('なんか良さそうですね', 'expand'),                 // soft
    cand('どんなところが好きなんですか?', 'personal_or_future'), // soft
    cand('どこのお店が多いんですか?', 'personal_or_future'),     // soft
    cand('今度食べてみたいです', 'reaction'),               // soft
    cand('おすすめ聞きたいです', 'reaction'),               // soft
  ];
  const single = finalizeReplies({ firstPass: softPass, ctx });
  assertEq(single.stats.selectedSoftRiskCount <= 1, true, '再生成なしでも soft は1件まで');
  const withRegen = finalizeReplies({ firstPass: softPass, secondPass: softPass.map((c) => ({ ...c })), ctx });
  assertEq(withRegen.replies.length, FINAL_COUNT, '3案でない');
  assertEq(withRegen.stats.selectedSoftRiskCount <= 1, true, `再生成後も soft は1件まで(実際 ${withRegen.stats.selectedSoftRiskCount})`);
  assert(withRegen.stats.selectedFallbackCount >= 1, '不足ぶんを fallback で埋めていない');
  assertEq(withRegen.stats.regenerationCount, 1, '再生成の回数が1でない');
});

t('47. 生成は最大2パス(3パス目を渡したら例外・呼び出しを勝手に増やさない)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const bad = six(['先週行きました', '週1で通ってます', '自分は塩派です', '毎日食べてます', '行きつけがあります', '〇〇が好きです']);
  assertEq(cs.MAX_GENERATION_PASSES, 2, '生成パスの上限が2でない');
  let threw = false;
  try { finalizeReplies({ passes: [bad, bad, bad], ctx }); } catch { threw = true; }
  assertEq(threw, true, '3パス目(=3回目の呼び出し)を受け付けてしまった');
  const two = finalizeReplies({ passes: [bad, bad], ctx });
  assertEq(two.replies.length, FINAL_COUNT, '2パスで3案にならない');
  assertEq(two.stats.regenerationCount, 1, '再生成回数の数え方が違う');
});

console.log('\n== §5 集計指標 ==');

t('48. 集計指標の件数と率(率の分母を候補数と返信数で取り違えない)', () => {
  const ctx = ctxFor('FAB_FOOD_01');
  const good = [
    cand('いいですね、なんか楽しそう', 'reaction'),
    cand('それめっちゃ良さそう', 'reaction'),
    cand('どんなところが好きなんですか?', 'expand'),
    cand('お店ってどうやって選んでるんですか?', 'expand'),
    cand('聞いてたら食べたくなってきました', 'personal_or_future'),
    cand('おすすめあったら教えてほしいです', 'personal_or_future'),
  ];
  const bad = six(['先週行きました', '週1で通ってます', '自分は塩派です', '毎日食べてます', '行きつけがあります', '〇〇が好きです']);
  const a = finalizeReplies({ firstPass: good, ctx });
  const b = finalizeReplies({ firstPass: bad, ctx });
  const m = cs.selectionMetrics([a, b]);
  assertEq(m.requestCount, 2, 'requestCount');
  assertEq(m.generatedCandidateCount, 12, 'generatedCandidateCount');
  assertEq(m.finalReplyCount, 6, 'finalReplyCount');
  assertEq(m.hardRejectCandidateCount, 6, 'hardRejectCandidateCount');
  assertEq(m.okCandidateCount, 6, 'okCandidateCount');
  assertEq(m.selectedFallbackCount, 3, 'selectedFallbackCount');
  assertEq(m.selectedOkCount, 3, 'selectedOkCount');
  assertEq(m.requestsWithFallback, 1, 'requestsWithFallback');
  assertEq(m.regenerationCount, 0, 'regenerationCount');
  // 返信総数(6)が分母。候補数(12)を分母にすると 0.25 になるので取り違えを検出できる
  assertEq(m.fallbackReplyRate, 3 / 6, 'fallback reply rate の分母は返信総数');
  assert(m.fallbackReplyRate !== m.selectedFallbackCount / m.generatedCandidateCount, '分母に候補数を使っている');
  assertEq(m.fallbackRequestRate, 1 / 2, 'fallback request rate の分母はリクエスト数');
  assertEq(m.softRiskReplyRate, m.selectedSoftRiskCount / 6, 'soft-risk reply rate の分母は返信総数');
  assertEq(m.regenerationRate, 0 / 2, 'regeneration rate の分母はリクエスト数');
});

t('49. 分母0でも安全(0除算・NaN を作らない)', () => {
  const m = cs.selectionMetrics([]);
  assertEq(m.requestCount, 0, 'requestCount');
  for (const k of ['fallbackReplyRate', 'fallbackRequestRate', 'softRiskReplyRate', 'regenerationRate']) {
    assertEq(m[k], null, `${k} は分母0のとき null(NaN や 0 にしない)`);
  }
});

console.log('\n== §6 会計差額の突合 / §7 次回費用の見積り ==');

t('50. 会計差額 $0.43541350 が call_log と run 成果物で説明できる(読み取り専用)', () => {
  const { rows } = loadCallLog();
  const runs = spendByRun('pricing_eval/runs', rows);
  const total = runs.reduce((s, r) => s + r.usageCostUsd, 0);
  const live = recordedSpendUsd('pricing_eval/runs', rows);
  assert(Math.abs(total - live.sum) <= 1e-6, `内訳合計 ${total} が recordedSpendUsd ${live.sum} と一致しない`);
  const delta = 1.61834135 - 1.18292785;
  const ex = explainDelta(runs, delta);
  assertEq(ex.ok, true, `差額 ${delta} を run 内訳で説明できない(差 ${ex.diff})`);
  assert(Math.abs(ex.diff) <= 1e-6, `差 ${ex.diff} が 1e-6 を超える`);
  const names = ex.picked.map((r) => r.runId).sort();
  assertEq(JSON.stringify(names), JSON.stringify(['fidelity_anthropic_opus5_fab10_r3', 'fidelity_anthropic_opus5_fab10_r4']), `差額の内訳 run が違う: ${names}`);
  const calls = ex.picked.reduce((s, r) => s + r.calls, 0);
  assertEq(calls, 14, `差額ぶんの呼び出し数が違う: ${calls}`);
});

t('51. 次回費用の見積り(価格不明は 0 円にせず見積不能・入力単価と出力単価を別に掛ける)', () => {
  const est = estimateNextRun({});
  const cloudRouteOpus = est.rows.find((r) => r.modelId === 'anthropic.claude-opus-5');
  assertEq(cloudRouteOpus.estimable, false, '公式価格の無いモデルを見積可能にした');
  assertEq(cloudRouteOpus.oneCallCostUsd, null, '見積不能のモデルを 0 円扱いにした');
  assertEq(cloudRouteOpus.worstCase10Usd, null, '見積不能のモデルの worst-case を 0 円扱いにした');
  assertEq(cloudRouteOpus.readyToRun, false, '人間の GO 無しに実行可能扱いにした');

  const opus = est.rows.find((r) => r.modelId === 'claude-opus-5');
  assertEq(opus.estimable, true, `Opus 5 の見積りができない: ${opus.reason}`);
  assertEq(opus.priceKind, 'official_exact', '公式価格でない値で見積もっている');
  const inTok = opus.usage.inputTokensMean;
  const outTok6 = opus.usage.outputTokens3RepliesMean * est.outputMultiplier;
  const expected = (inTok / 1e6) * opus.inputPerMTokUsd + (outTok6 / 1e6) * opus.outputPerMTokUsd;
  assert(Math.abs(opus.oneCallCostUsd - expected) < 1e-12, `1呼び出しの式が違う: ${opus.oneCallCostUsd} ≠ ${expected}`);
  // 入力単価と出力単価を同じにすると別の値になる = 単価を混ぜていないことの確認
  const sameRate = (inTok / 1e6) * opus.inputPerMTokUsd + (outTok6 / 1e6) * opus.inputPerMTokUsd;
  assert(Math.abs(opus.oneCallCostUsd - sameRate) > 1e-9, '入力単価と出力単価を同一単価として計算している');
  assert(Math.abs(opus.worstCase10Usd - est.cases * opus.oneCallCostUsd * est.regenerationFactor) < 1e-12, 'worst-case10 = 10 × 1呼び出し × 2 になっていない');
  assertEq(opus.outputTokensAssumed, true, '6候補の出力トークンを実測と偽っている');
  assertEq(est.outputMultiplier, 2, '6候補ぶんの出力トークン倍率が2でない(3案ぶんのまま見積もっている)');
  assert(Math.abs(outTok6 - opus.usage.outputTokens3RepliesMean * 2) < 1e-9, '6候補の出力トークンが「3案の実測 × 2」になっていない');
  assertEq(est.regenerationFactor, 2, 'worst-case の再生成係数が2でない');
  assertEq(est.cases, 10, '見積りのケース数が10でない');
});

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗`);
if (fail) console.log(`失敗: ${failures.join(', ')}`);
process.exit(fail === 0 ? 0 : 1);
