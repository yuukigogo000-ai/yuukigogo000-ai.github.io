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
  // 根拠にできるのは申告した事実だけ。ただし**矛盾の検査だけは有効な事実すべて**と突き合わせる
  const strict = checkFactFirewall(text, { ...base, enabledFactTexts: declared.map((f) => f.text), allFactTexts: enabled.map((f) => f.text) });
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

  for (const lane of LANES) {
    const pool = valid.filter((r) => !usedIdx.has(r.index) && r.derivedLane === lane);
    // ok を soft_risk より優先し、同点なら元の順
    pool.sort((a, b) => (a.verdict === b.verdict ? a.index - b.index : a.verdict === 'ok' ? -1 : 1));
    const chosen = pool.find((r) => picks.every((p) => !sameOpening(p.text, r.text) && similarity(p.text, r.text) < SIMILARITY_LIMIT));
    if (chosen) { picks.push({ lane, text: chosen.text, source: 'model', index: chosen.index, verdict: chosen.verdict, reasons: chosen.reasons }); usedIdx.add(chosen.index); }
    else picks.push({ lane, text: null, source: 'missing', index: null, verdict: null, reasons: [] });
  }

  // 全3案が質問だけにならない(1案は疑問符で終わらない)
  const filled = picks.filter((p) => p.text);
  if (filled.length === FINAL_COUNT && filled.every((p) => isQuestionText(p.text))) {
    const alt = valid.find((r) => !usedIdx.has(r.index) && !isQuestionText(r.text)
      && picks.every((p) => !p.text || (!sameOpening(p.text, r.text) && similarity(p.text, r.text) < SIMILARITY_LIMIT)));
    const slot = picks.find((p) => p.lane === 'reaction');
    if (alt) { usedIdx.delete(slot.index); slot.text = alt.text; slot.source = 'model'; slot.index = alt.index; slot.verdict = alt.verdict; slot.reasons = alt.reasons; usedIdx.add(alt.index); }
    else { slot.text = null; slot.source = 'missing'; slot.index = null; }   // fallback(reaction は疑問符で終わらない)へ回す
  }

  return {
    picks,
    results,
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
export function finalizeReplies({ firstPass, secondPass = null, ctx = {} }) {
  const key = ctx.idempotencyKey || 'no-key';
  let sel = selectThree(firstPass, ctx);
  let regenerated = false;
  if (sel.missingLanes.length && secondPass) {
    const merged = [...(firstPass || []), ...secondPass];
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

  return {
    replies,                                   // 利用者へ返すのはこれだけ
    picked: out,                               // 内部情報(レスポンスに載せない)
    regenerated,
    fallbackLanes,
    softRisks: sel.softRisks,
    rejected: sel.rejected,
    needsRegeneration: sel.missingLanes.length > 0 && !secondPass,
  };
}
