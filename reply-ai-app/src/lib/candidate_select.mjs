// 内部6候補 → 最終3案の選抜(2026-09-01 発注者指示で新設)。
//
// 外部(利用者へ返す)契約は従来どおり **必ず3案**(REPLY_SCHEMA は変更しない)。
// 内部では 3lane × 2候補 = 6候補を作り、検査して3案を選ぶ。
//   reaction            … 反応・感情・軽いユーモア
//   expand              … 話題を広げる質問・深掘り
//   personal_or_future  … 有効な自分情報があれば使用。無ければ未来の興味・意向
//
// 重要な契約:
//   - モデルが返した lane と usedFactIds は信用しない。本文から独立に判定する
//   - hard reject の候補は**部分置換せず候補ごと破棄**する(文字列を削って再利用しない)
//   - 有効候補が足りなければ最大1回だけ再生成。それでも足りない lane は決定的テンプレートで補う
//   - 同じ要求(同じ idempotency key)なら fallback の文面は必ず同じ
//   - 内部候補情報・リスク判定は利用者向けレスポンスに出さない(呼び出し側が replies だけを返す)

import { checkFactFirewall, PLACEHOLDER_RE, MANIPULATION_RE, splitClauses } from './fact_firewall.mjs';

export const LANES = ['reaction', 'expand', 'personal_or_future'];
export const CANDIDATES_PER_LANE = 2;
export const CANDIDATE_COUNT = LANES.length * CANDIDATES_PER_LANE; // 6
export const FINAL_COUNT = 3;
export const MAX_TEXT_LEN = 120;   // 1案の上限(既存の吹き出し規則に合わせる)
export const MIN_TEXT_LEN = 2;
export const SIMILARITY_LIMIT = 0.72;  // これ以上似ていれば同一内容の言い換えとみなす
// §4(2026-09-01 FIX_REQUIRED): 最終3案の優先順位は ok > soft_risk > fallback。
// soft_risk は最終3案で最大1件。2件以上必要になる場合は1回だけ再生成し、それでも足りなければ fallback を使う。
export const MAX_SOFT_RISK_IN_FINAL = 1;
// 生成は最初の1回 + 再生成1回まで(= 最大2パス)。3回目を渡したら例外にする(呼び出し回数を勝手に増やさない)
export const MAX_GENERATION_PASSES = 2;

// 不足 lane を埋める決定的テンプレート(各5種類)。固有名詞・個人事実・プレースホルダを含めない。
export const FALLBACK_TEMPLATES = {
  reaction: [
    'それいいね、もう少し聞いてみたい笑',
    'いいなあ、なんか楽しそう',
    'それ気になる、聞いてるだけでちょっとワクワクする',
    'いいですね、想像したらちょっと羨ましくなってきた笑',
    'めっちゃいいじゃないですか、テンション上がるやつだ',
  ],
  expand: [
    'ちなみに、どんなところが一番好きなんですか?',
    'それって、どういうきっかけで始めたんですか?',
    'もう少し聞きたいんですけど、どんな感じなんですか?',
    'よかったら教えてほしいです、どのあたりが好みですか?',
    'そこ気になります、どんなところがおすすめですか?',
  ],
  personal_or_future: [
    '気になる。おすすめがあったら教えてほしい!',
    'それ行ってみたいな、今度おすすめ聞かせてください',
    'なんか興味出てきた、今度試してみたいです',
    'いいな、自分もそのうちやってみたいです',
    '聞いてたら気になってきた笑 次の機会に試してみたいです',
  ],
};

// ---------------------------------------------------------------------------
/** 文字bigram Jaccard 類似度(3案が実質同じ言い換えでないかを見る) */
export function similarity(a, b) {
  const g = (s) => { const set = new Set(); const t = String(s); for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2)); return set; };
  const A = g(a), B = g(b);
  if (!A.size || !B.size) return a === b ? 1 : 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 決定的な32bitハッシュ(FNV-1a)。ブラウザでも同じ値になるよう node:crypto を使わない */
export function stableHash(s) {
  let h = 0x811c9dc5;
  const t = String(s);
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 同じ要求・同じ lane なら必ず同じ文面を返す(再処理で文面が変わらないこと) */
export function pickFallback(lane, idempotencyKey, { avoid = [] } = {}) {
  const pool = FALLBACK_TEMPLATES[lane];
  if (!pool) throw new Error(`未知の lane: ${lane}`);
  const start = stableHash(`${idempotencyKey}|${lane}`) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const text = pool[(start + i) % pool.length];
    if (!avoid.some((a) => a === text || similarity(a, text) >= SIMILARITY_LIMIT)) return text;
  }
  return pool[start]; // 全部衝突するときは決定的に先頭候補(3案固定を壊さない)
}

// ---------------------------------------------------------------------------
const QUESTION_RE = /[?？]\s*$|(?:です|ます|でしょう)か[?？]?\s*$/;
const FUTURE_OR_INTEREST_RE = /(?:てみ|て)?たい|たくなっ|興味|気にな|知りたい|聞きたい|教えて|おすすめ|next|次(?:は|に)/;

/** 本文から lane を導出する(モデルの申告は信用しない) */
export function deriveLane(text) {
  const t = String(text ?? '').trim();
  const clauses = splitClauses(t);
  const hasQuestion = QUESTION_RE.test(t) || clauses.some((c) => c.isQuestion);
  if (hasQuestion) return 'expand';
  if (FUTURE_OR_INTEREST_RE.test(t)) return 'personal_or_future';
  return 'reaction';
}

/**
 * 候補1件の検査。§5の順序で見る:
 * 1 形式 → 2 プレースホルダ → 3 個人事実 → 4 factId → 5 申告外の個人事実 → (6 重複は集合側)
 * 7 lane整合 → 8 既存の禁止出力 → 9 interest_level → 10 自動送信・操作
 */
export function validateCandidate(cand, ctx = {}) {
  const reasons = [];
  const hard = (code, detail) => reasons.push({ code, level: 'hard_reject', detail });
  const soft = (code, detail) => reasons.push({ code, level: 'soft_risk', detail });

  // 1. 形式
  if (!cand || typeof cand !== 'object') { hard('shape', '候補がオブジェクトでない'); return { ok: false, verdict: 'hard_reject', reasons, derivedLane: null }; }
  const text = typeof cand.text === 'string' ? cand.text.trim() : '';
  if (!text) hard('shape', 'text が空');
  else if (text.length < MIN_TEXT_LEN) hard('shape', `text が短すぎる(${text.length}文字)`);
  else if (text.length > MAX_TEXT_LEN) hard('shape', `text が長すぎる(${text.length}文字 > ${MAX_TEXT_LEN})`);
  if (cand.lane !== undefined && !LANES.includes(cand.lane)) hard('shape', `未知の lane: ${JSON.stringify(cand.lane)}`);
  if (cand.usedFactIds !== undefined && (!Array.isArray(cand.usedFactIds) || cand.usedFactIds.some((x) => typeof x !== 'string'))) {
    hard('shape', 'usedFactIds が文字列配列でない');
  }
  // 9. interest_level(除去済み項目)の混入
  if (Object.prototype.hasOwnProperty.call(cand, 'interest_level')) hard('interest_level_emitted', 'interest_level が混入している');
  if (/脈あり|脈なし|好感度[0-9０-９]|好意度/.test(text)) hard('interest_level_emitted', '脈あり度・好意度の断定');
  if (reasons.some((r) => r.code === 'shape')) return { ok: false, verdict: 'hard_reject', reasons, derivedLane: null };

  // 4. usedFactIds の存在・有効性・別リクエスト混入
  const enabled = (ctx.enabledFacts || []).filter((f) => f && f.enabledForRequest === true);
  const byId = new Map(enabled.map((f) => [f.id, f]));
  const foreign = new Set(ctx.foreignFactIds || []);
  const declared = [];
  for (const id of cand.usedFactIds || []) {
    if (foreign.has(id)) { hard('foreign_fact_id', `別リクエストの自分情報IDを使用: ${id}`); continue; }
    const all = (ctx.enabledFacts || []).find((f) => f && f.id === id);
    if (!all) { hard('unknown_fact_id', `存在しない自分情報ID: ${id}`); continue; }
    if (all.enabledForRequest !== true) { hard('disabled_fact_id', `この要求で有効化されていない自分情報ID: ${id}`); continue; }
    declared.push(all);
  }

  // 2,3,5,10. 事実ファイアウォール(申告した事実だけを根拠にする)
  const base = { conversationText: ctx.conversationText || '', selfMessages: ctx.selfMessages || [] };
  // 根拠にできるのは「この要求で有効化され、かつ候補が申告した」自分情報だけ(§5.5)。
  // 申告の無い自分情報で個人事実を書いたら、たとえ本当でも破棄する(モデルの申告を信用しないため)
  const strict = checkFactFirewall(text, { ...base, enabledFactTexts: declared.map((f) => f.text) });
  reasons.push(...strict.reasons);
  if (strict.verdict === 'hard_reject' && enabled.length > declared.length) {
    const lenient = checkFactFirewall(text, { ...base, enabledFactTexts: enabled.map((f) => f.text) });
    if (lenient.verdict !== 'hard_reject') soft('undeclared_fact_use', '有効な自分情報で説明はつくが usedFactIds に申告が無い(破棄する)');
  }

  // 7. lane 整合(申告と導出が違えば導出を採用し、記録だけ残す)
  const derivedLane = deriveLane(text);
  if (cand.lane && cand.lane !== derivedLane) soft('lane_mismatch', `申告 lane=${cand.lane} だが本文からは ${derivedLane}`);

  // 8. 既存の禁止出力(呼び出し側が注入する。評価器は validate_output の BANNED_RULES を渡す)
  for (const [name, re] of ctx.bannedRules || []) {
    if (re.test(text)) hard('forbidden_output', `禁止出力(${name})`);
  }
  // 10. 自動送信・操作(ファイアウォール側でも見るが、契約として明示)
  if (MANIPULATION_RE.test(text) && !reasons.some((r) => r.code === 'manipulation_or_autosend')) {
    hard('manipulation_or_autosend', '自動送信・操作を促す表現');
  }
  if (PLACEHOLDER_RE.test(text) && !reasons.some((r) => r.code === 'placeholder')) {
    hard('placeholder', '未解決のプレースホルダ');
  }

  const verdict = reasons.some((r) => r.level === 'hard_reject') ? 'hard_reject'
    : reasons.some((r) => r.level === 'soft_risk') ? 'soft_risk' : 'ok';
  return { ok: verdict !== 'hard_reject', verdict, reasons, derivedLane, text };
}

/** 6候補まとめて検査。件数・lane構成の逸脱も記録する(モデル出力を信用しない) */
export function validateCandidates(candidates, ctx = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const results = list.map((c, i) => ({ index: i, candidate: c, ...validateCandidate(c, ctx) }));
  const notes = [];
  if (list.length !== CANDIDATE_COUNT) notes.push(`候補数が ${list.length} 件(期待 ${CANDIDATE_COUNT} 件)`);
  for (const lane of LANES) {
    const n = results.filter((r) => r.ok && r.derivedLane === lane).length;
    if (n < 1) notes.push(`lane ${lane} の有効候補が 0 件`);
  }
  return { results, notes };
}

// ---------------------------------------------------------------------------
/** 先頭が同じ書き出しか(全3案が同じ入りにならないようにする) */
function sameOpening(a, b) {
  const head = (s) => String(s).replace(/[\s、。!！?？]/g, '').slice(0, 5);
  return head(a) === head(b);
}
function isQuestionText(t) { return QUESTION_RE.test(String(t).trim()); }

/**
 * 有効候補から3案を選ぶ。lane順(reaction → expand → personal_or_future)に1件ずつ。
 * 足りない lane は fallbackLanes に載せる(呼び出し側が再生成 or テンプレートを決める)。
 */
export function selectThree(candidates, ctx = {}) {
  const { results } = validateCandidates(candidates, ctx);
  const valid = results.filter((r) => r.ok);
  const picks = [];
  const usedIdx = new Set();
  let softUsed = 0;
  /** 既に選んだ案と書き出し・内容が被らないか */
  const fits = (r, list) => list.every((p) => !p.text || (!sameOpening(p.text, r.text) && similarity(p.text, r.text) < SIMILARITY_LIMIT));

  for (const lane of LANES) {
    const pool = valid.filter((r) => !usedIdx.has(r.index) && r.derivedLane === lane);
    // ok を soft_risk より優先し、同点なら元の順
    pool.sort((a, b) => (a.verdict === b.verdict ? a.index - b.index : a.verdict === 'ok' ? -1 : 1));
    // §4: soft_risk は最終3案で最大 MAX_SOFT_RISK_IN_FINAL 件。超える分は採用せず fallback へ回す
    const chosen = pool.find((r) => (r.verdict === 'ok' || softUsed < MAX_SOFT_RISK_IN_FINAL) && fits(r, picks));
    if (chosen) {
      if (chosen.verdict === 'soft_risk') softUsed++;
      picks.push({ lane, text: chosen.text, source: 'model', index: chosen.index, verdict: chosen.verdict, reasons: chosen.reasons });
      usedIdx.add(chosen.index);
    } else picks.push({ lane, text: null, source: 'missing', index: null, verdict: null, reasons: [] });
  }

  // §4: ok 候補が余っているなら soft_risk は採用しない(lane の並びより ok を優先して差し替える)
  for (const p of picks) {
    if (p.verdict !== 'soft_risk') continue;
    const alt = valid.find((r) => r.verdict === 'ok' && !usedIdx.has(r.index) && fits(r, picks.filter((x) => x !== p)));
    if (!alt) continue;
    usedIdx.delete(p.index);
    usedIdx.add(alt.index);
    p.text = alt.text; p.source = 'model'; p.index = alt.index; p.verdict = 'ok'; p.reasons = alt.reasons;
    // lane 選抜の段階で ok を選べていれば差し替えは起きない。起きたこと自体を記録する(優先順位の逆転を観測できるように)
    p.upgradedFromSoft = true;
    softUsed--;
  }

  // 全3案が質問だけにならない(1案は疑問符で終わらない)
  const filled = picks.filter((p) => p.text);
  if (filled.length === FINAL_COUNT && filled.every((p) => isQuestionText(p.text))) {
    const alt = valid.find((r) => !usedIdx.has(r.index) && !isQuestionText(r.text)
      && (r.verdict === 'ok' || softUsed < MAX_SOFT_RISK_IN_FINAL)
      && picks.every((p) => !p.text || (!sameOpening(p.text, r.text) && similarity(p.text, r.text) < SIMILARITY_LIMIT)));
    const slot = picks.find((p) => p.lane === 'reaction');
    if (alt) {
      usedIdx.delete(slot.index);
      if (slot.verdict === 'soft_risk') softUsed--;
      if (alt.verdict === 'soft_risk') softUsed++;
      slot.text = alt.text; slot.source = 'model'; slot.index = alt.index; slot.verdict = alt.verdict; slot.reasons = alt.reasons; usedIdx.add(alt.index);
    } else {
      if (slot.verdict === 'soft_risk') softUsed--;
      slot.text = null; slot.source = 'missing'; slot.index = null; slot.verdict = null;   // fallback(reaction は疑問符で終わらない)へ回す
    }
  }

  return {
    picks,
    results,
    softPicked: softUsed,
    missingLanes: picks.filter((p) => !p.text).map((p) => p.lane),
    softRisks: results.filter((r) => r.ok && r.verdict === 'soft_risk'),
    rejected: results.filter((r) => !r.ok),
  };
}

/**
 * 1回だけの再生成を含む最終選抜。**戻り値の replies は必ず3件**。
 * @param {{firstPass:any[], secondPass?:any[]|null, ctx:object}} args
 *   secondPass = 再生成の候補(不要なら null)。ctx.idempotencyKey で fallback が決定的になる
 */
export function finalizeReplies({ firstPass, secondPass = null, passes = null, ctx = {} }) {
  const key = ctx.idempotencyKey || 'no-key';
  // 生成パス(最初の1回 + 再生成1回まで)。3回目以降を渡したら例外(呼び出し回数を勝手に増やさない)
  const list = passes ?? [Array.isArray(firstPass) ? firstPass : [], ...(secondPass ? [secondPass] : [])];
  if (!Array.isArray(list) || list.length === 0) throw new Error('生成結果(passes)が空');
  if (list.length > MAX_GENERATION_PASSES) throw new Error(`生成は最大 ${MAX_GENERATION_PASSES} 回まで(渡されたのは ${list.length} 回ぶん)`);
  let sel = selectThree(list[0], ctx);
  let regenerated = false;
  if (sel.missingLanes.length && list.length > 1) {
    const merged = [...list[0], ...list[1]];
    const sel2 = selectThree(merged, ctx);
    if (sel2.missingLanes.length <= sel.missingLanes.length) { sel = sel2; regenerated = true; }
  }

  const out = [];
  const fallbackLanes = [];
  for (const p of sel.picks) {
    if (p.text) { out.push({ ...p }); continue; }
    const text = pickFallback(p.lane, key, { avoid: out.map((o) => o.text) });
    fallbackLanes.push(p.lane);
    out.push({ lane: p.lane, text, source: 'fallback', index: null, verdict: 'ok', reasons: [] });
  }

  // 最終防衛: テンプレートも同じ検査器を通す。落ちたら次のテンプレートへ(それでも駄目なら例外)
  for (const o of out) {
    if (o.source !== 'fallback') continue;
    const v = validateCandidate({ text: o.text, lane: o.lane, usedFactIds: [] }, ctx);
    if (!v.ok) {
      const alt = FALLBACK_TEMPLATES[o.lane].find((t) => validateCandidate({ text: t, lane: o.lane, usedFactIds: [] }, ctx).ok && !out.some((x) => x !== o && x.text === t));
      if (!alt) throw new Error(`fallback テンプレートが検査を通らない(lane=${o.lane})`);
      o.text = alt;
    }
  }

  const replies = out.map((o) => o.text);
  // 3案固定の不変条件(ここを壊す変更はテストで落ちる)
  if (replies.length !== FINAL_COUNT) throw new Error(`最終案が ${replies.length} 件(必ず ${FINAL_COUNT} 件)`);
  if (replies.some((t) => typeof t !== 'string' || !t.trim())) throw new Error('最終案に空の返信がある');
  if (new Set(replies).size !== FINAL_COUNT) throw new Error('最終案に重複がある');
  if (replies.every((t) => isQuestionText(t))) throw new Error('最終案が全て質問になっている');
  const selectedSoftRiskCount = out.filter((o) => o.verdict === 'soft_risk').length;
  if (selectedSoftRiskCount > MAX_SOFT_RISK_IN_FINAL) {
    throw new Error(`最終3案の soft_risk が ${selectedSoftRiskCount} 件(上限 ${MAX_SOFT_RISK_IN_FINAL} 件)`);
  }
  if (out.some((o) => o.verdict === 'hard_reject')) throw new Error('hard reject の候補が最終3案に混ざっている');

  // §5 集計指標(1リクエストぶん)。渡された候補は全て「生成された」ものとして数える
  const allCandidates = list.flat();
  const graded = validateCandidates(allCandidates, ctx).results;
  const stats = {
    generatedCandidateCount: allCandidates.length,
    okCandidateCount: graded.filter((r) => r.verdict === 'ok').length,
    softRiskCandidateCount: graded.filter((r) => r.verdict === 'soft_risk').length,
    hardRejectCandidateCount: graded.filter((r) => r.verdict === 'hard_reject').length,
    selectedOkCount: out.filter((o) => o.source !== 'fallback' && o.verdict === 'ok').length,
    selectedSoftRiskCount,
    selectedFallbackCount: out.filter((o) => o.source === 'fallback').length,
    regenerationCount: list.length - 1,        // 実際に追加生成した回数(0 or 1)
    finalReplyCount: replies.length,
  };

  return {
    replies,                                   // 利用者へ返すのはこれだけ
    picked: out,                               // 内部情報(レスポンスに載せない)
    regenerated,
    fallbackLanes,
    softRisks: sel.softRisks,
    rejected: sel.rejected,
    needsRegeneration: sel.missingLanes.length > 0 && list.length < MAX_GENERATION_PASSES,
    stats,
  };
}

/**
 * §5 集計指標。複数リクエスト(finalizeReplies の戻り値)をまとめる。
 * 率の分母は「返信総数」と「リクエスト数」を取り違えないこと。分母0のときは null(0除算を作らない)。
 */
export function selectionMetrics(finalized = []) {
  const sum = (f) => finalized.reduce((n, x) => n + (Number(f(x)) || 0), 0);
  const requestCount = finalized.length;
  const finalReplyCount = sum((x) => (x.replies || []).length);
  const selectedFallbackCount = sum((x) => x.stats?.selectedFallbackCount);
  const selectedSoftRiskCount = sum((x) => x.stats?.selectedSoftRiskCount);
  const regenerationCount = sum((x) => x.stats?.regenerationCount);
  const requestsWithFallback = finalized.filter((x) => (x.stats?.selectedFallbackCount || 0) > 0).length;
  const requestsWithSoftRisk = finalized.filter((x) => (x.stats?.selectedSoftRiskCount || 0) > 0).length;
  const rate = (num, den) => (den > 0 ? num / den : null);
  return {
    requestCount,
    generatedCandidateCount: sum((x) => x.stats?.generatedCandidateCount),
    okCandidateCount: sum((x) => x.stats?.okCandidateCount),
    softRiskCandidateCount: sum((x) => x.stats?.softRiskCandidateCount),
    hardRejectCandidateCount: sum((x) => x.stats?.hardRejectCandidateCount),
    selectedOkCount: sum((x) => x.stats?.selectedOkCount),
    selectedSoftRiskCount,
    selectedFallbackCount,
    requestsWithFallback,
    requestsWithSoftRisk,
    regenerationCount,
    finalReplyCount,
    // 率(分母を取り違えない: reply 系は返信総数、request 系はリクエスト数)
    fallbackReplyRate: rate(selectedFallbackCount, finalReplyCount),
    fallbackRequestRate: rate(requestsWithFallback, requestCount),
    softRiskReplyRate: rate(selectedSoftRiskCount, finalReplyCount),
    regenerationRate: rate(regenerationCount, requestCount),
  };
}
