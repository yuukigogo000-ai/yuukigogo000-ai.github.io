// 本番プロンプト追従テストの機械検査。
//
// 検査対象は2層:
//   1) 本番 REPLY_SCHEMA(situation / replies[].bubbles+why / advice)への適合
//      ※ interest_level(脈あり度)は 2026-09-01 に製品から除去。出力に含まれていたら schema_failure(禁止出力)
//   2) RESEARCH_LINE_STYLE.md 由来の機械検査可能な文体規則(REPLY_SYSTEM に明文がある禁止事項のみ)
//
// 規則は「本番指示に書いてあること」だけを検査する。ここで独自基準を発明しない。

// 固有名詞の根拠検査は本番UIと同一実装を使う(乖離防止のため単一ソース)
import { findUngroundedNames, findFabricationHints } from '../../../reply-ai-app/src/lib/ungrounded.mjs';
import { PLACEHOLDER_RE } from '../../../reply-ai-app/src/lib/fact_firewall.mjs';
import { BANNED_RULES } from '../validate_output.mjs';

/**
 * 確証run(--stop-on-violation)の停止理由。1件でも該当したら残りを実行しない。
 *  - schema違反(schema_failure / wrong_reply_count / json_parse_failure / no_tool_use_block)
 *  - interest_level の混入(除去済み項目の出力)
 *  - 捏造(ungrounded_name)
 *  - 未解決プレースホルダ(placeholder: ○○・［店名］等。本番表示禁止)
 *  - 禁止出力(validate_output の critical 規則: 脈あり度・格付け・センシティブ推定・人物特定・操作・自動送信)を
 *    返信・situation・advice の全文に適用
 * システム系失敗(4xx/5xx/timeout)はここでは扱わない(contractStopError が担当)。
 * @returns {null | {kind:string, detail:string}}
 */
export function fidelityStopReason(row) {
  if (!row) return null;
  const prod = row.production || row.invalidOutput || null;
  if (!row.success) {
    if (row.failureClass === 'model_output') {
      const errs = (row.attempts || []).map((a) => a.error).filter(Boolean).join(' | ');
      return { kind: 'schema_violation', detail: `${row.failureKind}: ${errs}` };
    }
    return null;
  }
  if (prod && Object.prototype.hasOwnProperty.call(prod, 'interest_level')) {
    return { kind: 'interest_level_emitted', detail: `interest_level=${JSON.stringify(prod.interest_level)}` };
  }
  const ung = (row.fidelity?.violations || []).filter((v) => v.rule === 'ungrounded_name');
  if (ung.length) return { kind: 'fabrication', detail: ung.map((v) => v.detail).join(' | ') };
  const ph = (row.fidelity?.violations || []).filter((v) => v.rule === 'placeholder');
  if (ph.length) return { kind: 'placeholder', detail: ph.map((v) => v.detail).join(' | ') };
  const texts = [];
  if (prod) {
    for (const r of prod.replies || []) for (const b of r.bubbles || []) texts.push(String(b));
    texts.push(String(prod.situation || ''), String(prod.advice || ''));
  }
  for (const [rule, re] of BANNED_RULES) {
    const hit = texts.find((t) => re.test(t));
    if (hit) return { kind: 'forbidden_output', detail: `${rule}: ${hit.slice(0, 80)}` };
  }
  return null;
}

/**
 * 生成結果から「入力に無い固有名詞らしき語」を violations 形式で返す。
 * grounding = 会話・goal・プロフィール・文体サンプルの全文。
 */
export function checkUngroundedNames(data, groundingText) {
  const texts = [
    ...data.replies.flatMap((r) => r.bubbles),
    data.advice || '',
  ];
  return findUngroundedNames(texts, groundingText).map((tok) => ({
    rule: 'ungrounded_name',
    detail: `入力に無い固有名詞: ${tok}`,
  }));
}

/**
 * 補助的な捏造候補(漢字/ひらがな店名・地名+店名・体験談の言い回し・有名ブランド)。rule='fabrication_hint'。
 * 停止事由でも合格条件でもない(完全検出できないため)。人間確認ページで候補として表示する。
 */
export function checkFabricationHints(data, groundingText) {
  const texts = [...data.replies.flatMap((r) => r.bubbles), data.advice || ''];
  return findFabricationHints(texts, groundingText).map((h) => ({
    rule: 'fabrication_hint',
    detail: `候補(${h.kind}): ${h.text}`,
  }));
}

/** Converse 応答から toolUse 入力を取り出す(無ければ null)。tool-use 形式の検証で使う */
export function extractToolUse(res, toolName) {
  const blocks = res?.output?.message?.content || [];
  const tu = blocks.find((b) => b.toolUse && (!toolName || b.toolUse.name === toolName));
  return tu ? tu.toolUse.input : null;
}

/** 応答テキストから本番スキーマの JSON を取り出して検証する。失敗は失敗として返す。 */
export function parseProductionReply(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, failureKind: 'empty_response', error: '応答が空' };
  }
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) return { ok: false, failureKind: 'json_parse_failure', error: 'JSON が見つからない' };
  let obj;
  try { obj = JSON.parse(t.slice(s, e + 1)); } catch { return { ok: false, failureKind: 'json_parse_failure', error: 'JSON として解釈できない' }; }

  const miss = [];
  if (typeof obj.situation !== 'string' || !obj.situation.trim()) miss.push('situation');
  if ('interest_level' in obj) miss.push('interest_level(脈あり度は除去済み・出力禁止)');
  if (!Array.isArray(obj.replies) || !obj.replies.length) miss.push('replies');
  if (typeof obj.advice !== 'string' || !obj.advice.trim()) miss.push('advice');
  if (miss.length) return { ok: false, failureKind: 'schema_failure', error: `欠落/不正: ${miss.join(',')}`, data: obj };

  for (const [i, r] of obj.replies.entries()) {
    if (!Array.isArray(r.bubbles) || r.bubbles.length < 1 || r.bubbles.length > 3
      || r.bubbles.some((b) => typeof b !== 'string' || !b.trim())) {
      return { ok: false, failureKind: 'schema_failure', error: `replies[${i}].bubbles が1〜3個の文字列でない`, data: obj };
    }
    if (typeof r.why !== 'string' || !r.why.trim()) {
      return { ok: false, failureKind: 'schema_failure', error: `replies[${i}].why が無い`, data: obj };
    }
  }
  // REPLY_SYSTEM「毎回、方向性の違う3案にする」
  if (obj.replies.length !== 3) {
    return { ok: false, failureKind: 'wrong_reply_count', error: `replies が ${obj.replies.length} 件(3案でない)`, data: obj };
  }
  return { ok: true, data: obj };
}

const FORBIDDEN_PHRASES = [
  'プロフィール拝見しました', 'いかがでしょうか', 'させていただきます', '承知いたしました',
  'よろしくお願いいたします', 'お仕事お疲れ様です', '尊敬します',
];
const FORBIDDEN_EMOJI = ['😊', '😅', '💦', '✨', '❗', '🥺', '♪'];
// 未解決プレースホルダの正本は fact_firewall.mjs へ移した(本番UIと共有する単一実装)。互換のためここから再輸出する
export { PLACEHOLDER_RE };
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

/**
 * 文体規則の検査。data = parseProductionReply の data(ok のもの)。
 * 返り値 violations は {rule, detail} の配列。stats は集計用の生値。
 */
export function checkStyleRules(data) {
  const v = [];
  const bubbleCounts = data.replies.map((r) => r.bubbles.length);

  // 吹き出しの分け方(REPLY_SYSTEM「# 吹き出しの分け方」)
  if (new Set(bubbleCounts).size === 1 && data.replies.length > 1) {
    v.push({ rule: 'same_bubble_count', detail: `3案の吹き出し数が全部 ${bubbleCounts[0]} 通(同じにしない規則)` });
  }
  if (!bubbleCounts.includes(1)) {
    v.push({ rule: 'no_single_bubble_plan', detail: '1通にまとめた案が1つも無い(必ず1案は1通)' });
  }
  if (bubbleCounts.filter((n) => n === 3).length > 1) {
    v.push({ rule: 'too_many_triple_plans', detail: '3通に分ける案が2案以上(3案中1案まで)' });
  }

  for (const [i, r] of data.replies.entries()) {
    const joined = r.bubbles.join('');
    for (const p of FORBIDDEN_PHRASES) {
      if (joined.includes(p)) v.push({ rule: 'forbidden_phrase', detail: `案${i + 1}: 「${p}」` });
    }
    // 「(笑)」は半角・全角括弧の両方を検査する。素の「笑」は本番規則で許可されているので拒否しない
    if (/\(笑\)|（笑）/.test(joined)) v.push({ rule: 'forbidden_laugh', detail: `案${i + 1}: 「(笑)」` });
    if (/w{3,}|ｗ{3,}/.test(joined)) v.push({ rule: 'forbidden_laugh', detail: `案${i + 1}: 「www」` });
    if (/(^|[\s、。!?！?])草($|[\s、。!?！?])/.test(joined)) v.push({ rule: 'forbidden_laugh', detail: `案${i + 1}: 「草」` });

    const questions = (joined.match(/[??]/g) || []).length;
    if (questions >= 2) v.push({ rule: 'too_many_questions', detail: `案${i + 1}: 質問${questions}個(1通に1問まで)` });

    for (const [j, b] of r.bubbles.entries()) {
      if (/。$/.test(b.trim())) v.push({ rule: 'trailing_maru', detail: `案${i + 1}通${j + 1}: 文末「。」` });
      const emo = b.match(EMOJI_RE) || [];
      if (emo.length > 1) v.push({ rule: 'too_many_emoji', detail: `案${i + 1}通${j + 1}: 絵文字${emo.length}個(1通0〜1個)` });
      for (const fe of FORBIDDEN_EMOJI) {
        if (b.includes(fe)) v.push({ rule: 'forbidden_emoji', detail: `案${i + 1}通${j + 1}: ${fe}` });
      }
      if (b.length > 120) v.push({ rule: 'bubble_too_long', detail: `案${i + 1}通${j + 1}: ${b.length}字` });
      const ph = b.match(PLACEHOLDER_RE);
      if (ph) v.push({ rule: 'placeholder', detail: `案${i + 1}通${j + 1}: 「${ph[0]}」(未解決プレースホルダ)` });
    }
  }
  return {
    violations: v,
    stats: {
      bubbleCounts,
      adviceLen: data.advice.length,
      situationLen: data.situation.length,
    },
  };
}
