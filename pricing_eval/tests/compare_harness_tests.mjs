// Kimi vs Qwen 同条件比較ハーネスの自動テスト(2026-09-02 発注者指示 §11/§13)。
// **実モデルは呼ばない**(偽クライアント・偽台帳)。台帳・cases.json も触らない。
//
// 実行: node pricing_eval/tests/compare_harness_tests.mjs
// 変異: node pricing_eval/tests/mutate_compare_harness.mjs
//   (CMP_SRC_DIR で検査対象の置き場を差し替えられる。変異ランナーは複製を壊してこのスイートが落ちることを見る)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const SRC = resolve(process.env.CMP_SRC_DIR || 'pricing_eval/src');
const imp = (f) => import(pathToFileURL(join(SRC, f)).href);
const H = await imp('lib/compare_harness.mjs');
const B = await imp('blind_compare_page.mjs');
const { BANNED_RULES } = await imp('validate_output.mjs');

let pass = 0, fail = 0; const failures = [];
function t(name, fn) {
  try { const r = fn(); if (r instanceof Promise) throw new Error('同期テストのみ'); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); fail++; failures.push(name); }
}
async function ta(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); fail++; failures.push(name); }
}
function assert(c, m) { if (!c) throw new Error(m || '条件を満たしません'); }
function assertEq(a, b, m) { if (a !== b) throw new Error(`${m || ''} 期待 ${JSON.stringify(b)} / 実際 ${JSON.stringify(a)}`); }

const KIMI = 'moonshotai.kimi-k2.5';
const QWEN = 'qwen.qwen3-vl-235b-a22b';
const PRICE_KIMI = { inputPerMTokUsd: 0.72, outputPerMTokUsd: 3.6 };
const PRICE_QWEN = { inputPerMTokUsd: 0.32, outputPerMTokUsd: 3.22 };
const modelSpec = (modelId, price, outputTokenCap = 3000) => ({ modelId, price, priceKind: 'official_exact', outputTokenCap });
const CASE_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'];

const ctx = {
  conversationText: '餃子が好き 週末に食べに行った 池袋',
  selfMessages: [],
  bannedRules: BANNED_RULES,
  idempotencyKey: 'cmp-test|C1',
};
const cand = (text, lane = 'reaction') => ({ text, lane, usedFactIds: [] });
const GOOD6 = [
  cand('餃子いいですね、なんか楽しそう', 'reaction'),
  cand('それはめっちゃ良さそう', 'reaction'),
  cand('どんな餃子が一番好きなんですか?', 'expand'),
  cand('お店ってどうやって選んでるんですか?', 'expand'),
  cand('聞いてたら食べに行きたくなってきました', 'personal_or_future'),
  cand('おすすめあったら教えてほしいです', 'personal_or_future'),
];
const BAD6 = [
  cand('先週行きました', 'reaction'), cand('週1で通ってます', 'reaction'),
  cand('自分は塩派です', 'expand'), cand('毎日食べてます', 'expand'),
  cand('行きつけがあります', 'personal_or_future'), cand('〇〇が好きです', 'personal_or_future'),
];

console.log('\n== §6 実行順(逐次・交互) ==');

t('01. 奇数ケースは Kimi→Qwen・偶数ケースは Qwen→Kimi・平坦な逐次計画', () => {
  const plan = H.executionPlan(CASE_IDS, KIMI, QWEN);
  assertEq(plan.length, 20, '計画の件数');
  assertEq(plan[0].modelId, KIMI, 'ケース1の1番目');
  assertEq(plan[1].modelId, QWEN, 'ケース1の2番目');
  assertEq(plan[2].modelId, QWEN, 'ケース2の1番目');
  assertEq(plan[3].modelId, KIMI, 'ケース2の2番目');
  assert(plan.every((p) => !Array.isArray(p)), '計画に並列グループがある');
  assertEq(H.checkPlan(plan, CASE_IDS, KIMI, QWEN).length, 0, '自己検査で問題が出た');
});

t('02. 並列グループを混ぜたら計画検査が落とす', () => {
  const plan = H.executionPlan(CASE_IDS, KIMI, QWEN);
  const parallel = [[plan[0], plan[1]], ...plan.slice(2)];
  assert(H.checkPlan(parallel, CASE_IDS, KIMI, QWEN).length > 0, '並列を見逃した');
});

console.log('\n== §4 費用ゲート ==');

t('03. 入力単価と出力単価を分けて掛ける(同一単価と違う値になる)', () => {
  const one = H.oneCallWorstCaseUsd({ price: PRICE_KIMI, priceKind: 'official_exact', outputTokenCap: 3000 });
  const expected = (16000 / 1e6) * 0.72 + (3000 / 1e6) * 3.6;
  assert(Math.abs(one - expected) < 1e-12, `式が違う: ${one} ≠ ${expected}`);
  const same = (16000 / 1e6) * 0.72 + (3000 / 1e6) * 0.72;
  assert(Math.abs(one - same) > 1e-9, '入力単価と出力単価を同一にしている');
});

t('04. モデル別 worst-case は 10ケース×1呼び出し×最大2attempt', () => {
  const w = H.modelWorstCaseUsd({ price: PRICE_QWEN, priceKind: 'official_exact', outputTokenCap: 3000 });
  const one = H.oneCallWorstCaseUsd({ price: PRICE_QWEN, priceKind: 'official_exact', outputTokenCap: 3000 });
  assert(Math.abs(w - 10 * one * 2) < 1e-12, 'ケース数×attempt上限になっていない');
  assertEq(H.MAX_ATTEMPTS_PER_CASE, 2, 'attempt 上限が2でない');
});

t('05. 価格不明は見積不能(0円扱いにしない)・モデル別上限を超えたらブロック', () => {
  const g = H.budgetGate({
    models: [modelSpec(KIMI, PRICE_KIMI), { modelId: QWEN, price: null, priceKind: null, outputTokenCap: 3000 }],
    usdJpy: 160, perModelLimitJpy: 100, totalLimitJpy: 200,
  });
  const qwenRow = g.rows.find((r) => r.modelId === QWEN);
  assertEq(qwenRow.worstCaseUsd, null, '価格不明を 0 円扱いにした');
  assertEq(qwenRow.ok, false, '価格不明を通した');
  assertEq(g.ok, false, '価格不明があるのにゲートを通した');
  const tiny = H.budgetGate({ models: [modelSpec(KIMI, PRICE_KIMI, 3000)], usdJpy: 160, perModelLimitJpy: 1, totalLimitJpy: 200 });
  assertEq(tiny.ok, false, 'モデル別上限を超えたのに通した');
});

t('06. 実際の2モデル(3000 token 上限)はモデル別100円・合計200円に収まる', () => {
  const g = H.budgetGate({ models: [modelSpec(KIMI, PRICE_KIMI), modelSpec(QWEN, PRICE_QWEN)], usdJpy: 160, perModelLimitJpy: 100, totalLimitJpy: 200 });
  assertEq(g.ok, true, `ゲートに落ちた: ${g.blockers.join(' / ')}`);
  assert(g.rows.every((r) => r.worstCaseJpy <= 100), 'モデル別100円を超えている');
  assert(g.totalWorstCaseJpy <= 200, '合計200円を超えている');
});

t('07. UNKNOWN(費用不明)は 0 円扱いにせず初期予算へ足す', () => {
  assertEq(H.initialBudgetUsd({ priorSpentUsd: 1.5, unknownWorstCaseUsd: 0.47 }), 1.97, 'UNKNOWN を足していない');
  assertEq(H.initialBudgetUsd({ priorSpentUsd: 1.5, unknownWorstCaseUsd: 0 }), 1.5, '初期予算の計算');
});

console.log('\n== §5 同一入力の証明 ==');

t('08. dataset・temperature・max token・検出器のどれが違っても検出する', () => {
  const base = { datasetHash: 'D', caseId: 'C1', promptHash: 'P', schemaHash: 'S', temperature: 0.2, outputMaxTokens: 3000, detectorHash: 'X' };
  const a = [{ caseId: 'C1', inputFingerprint: H.inputFingerprint(base) }];
  const diffs = [
    ['dataset', { ...base, datasetHash: 'D2' }],
    ['temperature', { ...base, temperature: 0.7 }],
    ['max token', { ...base, outputMaxTokens: 1024 }],
    ['検出器', { ...base, detectorHash: 'X2' }],
    ['prompt', { ...base, promptHash: 'P2' }],
    ['schema', { ...base, schemaHash: 'S2' }],
  ];
  for (const [what, o] of diffs) {
    const b = [{ caseId: 'C1', inputFingerprint: H.inputFingerprint(o) }];
    assert(H.assertIdenticalInputs(a, b).length > 0, `${what} の違いを見逃した`);
  }
  assertEq(H.assertIdenticalInputs(a, [{ caseId: 'C1', inputFingerprint: H.inputFingerprint(base) }]).length, 0, '同一入力を違うと言った');
});

console.log('\n== §7 停止規則 ==');

t('09. 失敗の分類(再試行 / そのモデルだけ停止 / 両モデル停止)', () => {
  assertEq(H.classifyFailure('timeout'), 'retry');
  assertEq(H.classifyFailure('http_429'), 'retry');
  assertEq(H.classifyFailure('http_503'), 'retry');
  assertEq(H.classifyFailure('schema_violation'), 'retry');
  assertEq(H.classifyFailure('insufficient_candidates'), 'retry');
  assertEq(H.classifyFailure('access_denied'), 'stop_model');
  assertEq(H.classifyFailure('marketplace_required'), 'stop_model');
  assertEq(H.classifyFailure('final_hard_reject_leak'), 'stop_model');
  assertEq(H.classifyFailure('retention_changed'), 'stop_all');
  assertEq(H.classifyFailure('dataset_hash_mismatch'), 'stop_all');
  assertEq(H.classifyFailure('total_budget_exceeded'), 'stop_all');
  assertEq(H.classifyFailure('なにか未知の失敗'), 'stop_model', '未知の失敗は安全側にしない');
});

t('10. 片方の AccessDenied では他方の結果も継続も壊さない', () => {
  const state = { stopped: new Set(), stopAll: false, rows: { [KIMI]: [{ caseId: 'C1' }], [QWEN]: [{ caseId: 'C1' }] } };
  const after = H.applyStop(state, { modelId: KIMI, kind: 'access_denied' });
  assertEq(after.rows[QWEN].length, 1, '他方の結果を消した');
  assertEq(after.rows[KIMI].length, 1, '停止したモデルの既存結果まで消した');
  assertEq(H.canContinue(after, KIMI), false, '停止したモデルを続行できてしまう');
  assertEq(H.canContinue(after, QWEN), true, '他方まで止めた');
});

t('11. 共通安全条件の違反では両モデルを止める', () => {
  const state = { stopped: new Set(), stopAll: false, rows: { [KIMI]: [], [QWEN]: [] } };
  const after = H.applyStop(state, { modelId: KIMI, kind: 'retention_changed' });
  assertEq(H.canContinue(after, KIMI), false, 'Kimi を続行できてしまう');
  assertEq(H.canContinue(after, QWEN), false, '共通安全条件なのに他方を継続した');
  assertEq(after.stopAll, true, 'stopAll が立っていない');
  // 「両方止めた」ことが記録に残る(stopAll だけに頼らない多重防御)
  assertEq(after.stopped.has(KIMI) && after.stopped.has(QWEN), true, '停止記録に両モデルが入っていない');
});

console.log('\n== attempt 上限・台帳 ==');

function fakeLedger() {
  const rows = [];
  return { rows, started: (a) => { const id = `call-${rows.length + 1}`; rows.push({ ...a, callId: id, status: 'STARTED' }); return id; }, ended: (a) => rows.push({ ...a, status: a.status }) };
}
function fakeClient(responses) {
  let i = 0;
  return { calls: 0, async converse() { this.calls++; const r = responses[Math.min(i++, responses.length - 1)]; if (r instanceof Error) throw r; return r; } };
}
const toolRes = (candidates, usage = { inputTokens: 100, outputTokens: 200 }) => ({
  output: { message: { content: [{ toolUse: { name: 'reply_candidates', input: { candidates } } }] } },
  usage, $requestId: 'req-1', $httpStatus: 200,
});
function parseFake(res) {
  const tu = res?.output?.message?.content?.find((b) => b.toolUse)?.toolUse;
  if (!tu) return { ok: false, failureKind: 'no_tool_use_block', usage: res?.usage ?? null };
  const list = tu.input?.candidates;
  if (!Array.isArray(list) || list.length !== 6) return { ok: false, failureKind: 'schema_violation', usage: res?.usage ?? null };
  return { ok: true, candidates: list, usage: res?.usage ?? null };
}
const runArgs = (client, ledger, extra = {}) => ({
  client, ledger, model: { modelId: KIMI, invocationTarget: KIMI, price: PRICE_KIMI },
  caseObj: { id: 'C1' }, buildBody: () => ({}), parseCandidates: parseFake, ctx,
  runId: 'test-run', worstCaseUsd: 0.02, costOf: () => 0.001, ...extra,
});

await ta('12. 総 attempt は最大2回(3回目を絶対に呼ばない)', async () => {
  const client = fakeClient([toolRes([]), toolRes([]), toolRes([])]);   // 常に schema 違反(再試行可)
  const ledger = fakeLedger();
  const r = await H.runCase(runArgs(client, ledger));
  assertEq(client.calls, 2, `呼び出し回数が ${client.calls}(上限2)`);
  assertEq(r.ok, false, 'schema 違反続きなのに成功にした');
  assertEq(r.attempts.length, 2, 'attempt の記録数');
});

await ta('13. 失敗した呼び出しでも STARTED が台帳に残る', async () => {
  const err = new Error('boom'); err.code = 'AccessDeniedException'; err.status = 403;
  const client = fakeClient([err]);
  const ledger = fakeLedger();
  await H.runCase(runArgs(client, ledger));
  const started = ledger.rows.filter((x) => x.status === 'STARTED');
  assertEq(started.length >= 1, true, '失敗呼び出しの STARTED が台帳に無い');
  assertEq(started[0].runId, 'test-run', 'STARTED に runId が無い');
  assert(started[0].worstCaseUsd > 0, 'STARTED に worst-case が無い');
  assert(ledger.rows.some((x) => x.status === 'FAILED'), '終端が書かれていない');
});

await ta('14. 候補が足りなければ1回だけ再生成し、2回目で確定する', async () => {
  const client = fakeClient([toolRes(BAD6), toolRes(GOOD6)]);
  const ledger = fakeLedger();
  const r = await H.runCase(runArgs(client, ledger));
  assertEq(client.calls, 2, '再生成が1回でない');
  assertEq(r.ok, true, '再生成後も失敗にした');
  assertEq(r.regenerated, true, '再生成の記録が無い');
  assertEq(r.final.replies.length, 3, '3案でない');
});

await ta('15. hard reject は最終3案に絶対入らない(全部不正でも3案・fallback で埋める)', async () => {
  const client = fakeClient([toolRes(BAD6), toolRes(BAD6)]);
  const ledger = fakeLedger();
  const r = await H.runCase(runArgs(client, ledger));
  assertEq(r.ok, true, '3案を作れなかった');
  assertEq(r.final.replies.length, 3, '3案でない');
  assert(r.final.picked.every((p) => p.verdict !== 'hard_reject'), 'hard reject が最終3案に混ざった');
  assert(!r.final.replies.some((x) => x.includes('週1') || x.includes('〇〇')), '不正候補の本文が漏れた');
});

console.log('\n== §8 集計 ==');

const rowFor = (modelId, caseId, { fallback = 0, soft = 0, hard = 3, regenerated = false, cost = 0.001, latency = 5000 } = {}) => ({
  modelId, caseId, success: true, regenerated,
  attempts: [{ attemptNo: 1, latencyMs: latency, usage: { inputTokens: 100, outputTokens: 200 }, costUsd: cost, failureKind: null }],
  candidates: { generated: 6, ok: 6 - hard - soft, softRisk: soft, hardReject: hard, placeholder: 0 },
  replies: ['a', 'b', 'c'],
  final: { fallbackCount: fallback, softRiskCount: soft, hardRejectLeak: 0, placeholderInFinal: 0 },
});

t('16. fallback をモデル生成の成功に混ぜない・率の分母を取り違えない', () => {
  const rows = [rowFor(KIMI, 'C1', { fallback: 1 }), rowFor(KIMI, 'C2', { fallback: 0 })];
  const s = H.summarizeModel(rows);
  assertEq(s.finalReplyCount, 6, '返信総数');
  assertEq(s.selectedFallbackCount, 1, 'fallback 件数');
  assertEq(s.modelReplyCount, 5, 'fallback をモデル生成に数えている');
  assertEq(s.fallbackReplyRate, 1 / 6, 'fallback reply rate の分母は返信総数');
  assertEq(s.fallbackRequestRate, 1 / 2, 'fallback request rate の分母はリクエスト数');
  assert(s.fallbackReplyRate !== s.fallbackRequestRate, '2つの率が同じ計算になっている');
  assertEq(s.rawHardRejectRate, 6 / 12, 'raw hard-reject rate');
});

t('17. 合計費用は両モデルを足す(片方を除外しない)', () => {
  const a = H.summarizeModel([rowFor(KIMI, 'C1', { cost: 0.01 })]);
  const b = H.summarizeModel([rowFor(QWEN, 'C1', { cost: 0.02 })]);
  const total = H.totalCostUsd([a, b]);
  assert(Math.abs(total - 0.03) < 1e-12, `合計が ${total}(期待 0.03)`);
  assertEq(H.totalCostUsd([a, { ...b, costUsd: null }]), null, '費用不明があるのに合計を出した');
});

t('18. §10 の必須条件(3案・final hard reject 0・timeout 0・attempt上限)', () => {
  const rows = Array.from({ length: 10 }, (_, i) => rowFor(KIMI, `C${i + 1}`));
  const s = H.summarizeModel(rows);
  const c = H.evaluatePassCriteria(s, rows);
  assertEq(c.ok, true, `必須条件に落ちた: ${JSON.stringify(c.checks)}`);
  const leaked = rows.map((r) => ({ ...r, final: { ...r.final, hardRejectLeak: 1 } }));
  assertEq(H.evaluatePassCriteria(H.summarizeModel(leaked), leaked).ok, false, 'hard reject 漏れを通した');
  const over = rows.map((r) => ({ ...r, attempts: [...r.attempts, { ...r.attempts[0], attemptNo: 2 }, { ...r.attempts[0], attemptNo: 3 }] }));
  assertEq(H.evaluatePassCriteria(H.summarizeModel(over), over).ok, false, 'attempt 3回を通した');
});

console.log('\n== §9 ブラインド ==');

t('19. A/B の割り当てが偏らない(A が常に同じモデルにならない)', () => {
  const asg = B.sideAssignment(CASE_IDS, 'seed-1', [KIMI, QWEN]);
  assertEq(B.checkAssignment(asg, [KIMI, QWEN]).length, 0, `割り当てが偏った: ${JSON.stringify([...asg.values()].map((v) => v.A))}`);
  const asA = [...asg.values()].map((v) => v.A);
  assert(new Set(asA).size === 2, 'A が1モデルに固定されている');
  const again = B.sideAssignment(CASE_IDS, 'seed-1', [KIMI, QWEN]);
  assertEq(JSON.stringify([...again.values()]), JSON.stringify([...asg.values()]), '同じ seed で割り当てが変わった(決定的でない)');
  // 偏りの検査器自身が「A が常に同じ」を落とせること(検査器を信用する前に確かめる)
  const biased = new Map(CASE_IDS.map((id) => [id, { A: KIMI, B: QWEN }]));
  assert(B.checkAssignment(biased, [KIMI, QWEN]).length > 0, '偏った割り当てを検査器が見逃した');
});

t('20. ブラインドページにモデル名・自動判定・費用・遅延を出さない', () => {
  const asg = B.sideAssignment(CASE_IDS.slice(0, 2), 'seed-2', [KIMI, QWEN]);
  const html = B.renderBlindPage({
    experimentId: 'exp1',
    cases: [{ id: 'C1', conversation: '相手: 餃子好き' }, { id: 'C2', conversation: '相手: 旅行いいね' }],
    repliesByModel: { [KIMI]: { C1: ['k1', 'k2', 'k3'], C2: ['k4', 'k5', 'k6'] }, [QWEN]: { C1: ['q1', 'q2', 'q3'], C2: ['q4', 'q5', 'q6'] } },
    assignment: asg,
  });
  assertEq(B.containsModelIdentity(html, [KIMI, QWEN]).length, 0, `モデル情報が漏れた: ${B.containsModelIdentity(html, [KIMI, QWEN])}`);
  for (const w of ['fallback', 'soft_risk', 'hard_reject', 'latency', 'costUsd', '円', 'USD']) {
    assert(!html.includes(w), `ブラインド画面に ${w} が出ている`);
  }
  assert(html.includes('k1') && html.includes('q1'), '返信本文が出ていない');
  assert(html.includes('そのまま送れる') && html.includes('会話を続ける価値'), '人間確認項目が無い');
});

t('21. 対応表は別ファイルの中身として作られる(ページには含まれない)', () => {
  const asg = B.sideAssignment(CASE_IDS.slice(0, 2), 'seed-3', [KIMI, QWEN]);
  const map = B.buildMapping({ experimentId: 'exp1', assignment: asg, runIds: { [KIMI]: 'r1', [QWEN]: 'r2' } });
  assertEq(map.cases.length, 2, '対応表のケース数');
  assert(map.cases.every((c) => c.A && c.B && c.A !== c.B), '対応表が壊れている');
  const html = B.renderBlindPage({ experimentId: 'exp1', cases: [{ id: 'C1', conversation: 'x' }, { id: 'C2', conversation: 'y' }], repliesByModel: { [KIMI]: { C1: ['a'], C2: ['b'] }, [QWEN]: { C1: ['c'], C2: ['d'] } }, assignment: asg });
  assert(!html.includes(JSON.stringify(map.cases[0])), '対応表がページに埋め込まれている');
});

t('22. 人間のブラインド評価が終わるまで採用モデルを決めない', () => {
  assertEq(H.decideAdoption({ humanBlindResults: null }).decided, false, '評価前に決めた');
  assertEq(H.decideAdoption({ humanBlindResults: null }).model, null, '評価前にモデルを返した');
  assertEq(H.decideAdoption({ humanBlindResults: { caseVerdicts: [{ caseId: 'C1', winner: 'A' }] } }).decided, false, '自動で採用を確定した');
});

console.log('\n== 影響範囲 ==');

t('23. ハーネスは台帳・cases.json を書き換えない(書き込みAPIを持たない)', () => {
  const src = readFileSync(join(SRC, 'lib/compare_harness.mjs'), 'utf8');
  for (const w of ['writeFileSync', 'appendFileSync', 'unlinkSync', 'rmSync']) assert(!src.includes(w), `ハーネスに ${w} がある`);
  for (const w of ['http' + 's://', 'fet' + 'ch(', 'Sig' + 'V4']) assert(!src.includes(w), `ハーネスに通信コード(${w})がある`);
});

t('24. 台帳・データセットの指紋がテスト前後で変わらない', () => {
  const files = ['pricing_eval/runs/call_log.jsonl', 'pricing_eval/runs/ledger.jsonl', 'pricing_eval/cases.json', 'pricing_eval/cases_fab10.json'];
  for (const f of files) {
    assert(existsSync(f), `${f} が無い`);
    const h = createHash('sha256').update(readFileSync(f)).digest('hex');
    assertEq(h.length, 64, `${f} の指紋を取れない`);
  }
  const expect = {
    'pricing_eval/cases_fab10.json': '4e0c6da47a2da289a830da0d5afcd06c7fd0e71ce67c4b74e7d5ecd029e86c72',
    'pricing_eval/cases.json': '699402d2eeb5ca6fa251cace71f264f8c64c3ceb409700ae97f3cf431d58e7d3',
  };
  for (const [f, want] of Object.entries(expect)) {
    assertEq(createHash('sha256').update(readFileSync(f)).digest('hex'), want, `${f} が変化した`);
  }
});

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗`);
if (fail) console.log(`失敗: ${failures.join(', ')}`);
process.exit(fail === 0 ? 0 : 1);
