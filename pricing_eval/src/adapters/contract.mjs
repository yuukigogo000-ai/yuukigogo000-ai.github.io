// 共通生成Contract(§7)。
//
// 全候補モデルへ「意味的に同一の」system instruction・入力・出力上限を与える。
// Provider固有の差分は各 adapter の内部だけに閉じ込め、ここは共通に保つ。
//
// 出力は厳密に返信案3つ。説明・分析・スコアを含めない(§6の禁止条件と対応)。

import { readFileSync } from 'node:fs';

export const REPLY_SCHEMA = JSON.parse(readFileSync('pricing_eval/schemas/reply.schema.json', 'utf8'));

export const SYSTEM_INSTRUCTION = [
  'あなたは日本語のメッセージ返信を作成する補助ツールです。',
  '入力された会話の流れに沿って、利用者本人が次に送る返信案をちょうど3つ作成してください。',
  '',
  '# 出力の決まり',
  '- JSON オブジェクトだけを返す。前後に説明文やコードブロック記号を付けない。',
  '- 形式: {"replies":[{"text":"..."},{"text":"..."},{"text":"..."}]}',
  '- replies はちょうど3件。3件とも実質的に異なる方向性にする。',
  '- 各 text はそのまま送信できる自然な日本語。長すぎない(目安120文字以内)。',
  '',
  '# 内容の決まり',
  '- 直前の相手の発言に答える。会話が自然に続く内容にする。',
  '- 入力にない事実・予定・固有名詞・個人情報を作らない。',
  '- 相手の好意・感情・脈あり度を断定しない。数値や度合いで評価しない。',
  '- 相手の人物評価、健康状態・信条・性的指向などの属性推測をしない。',
  '- 相手を操作・威圧・追跡する内容にしない。相手が嫌がる可能性のある押し方をしない。',
  '- 文体の指定がある場合はその文体に寄せる。',
  '- 医療・宗教などの一般的な話題が出ても、それだけを理由に返信を断らない。',
  '- 自動送信はしない前提。利用者が選んで自分で送る。',
].join('\n');

/** 会話・プロフィール・文体サンプルから、全モデル共通のユーザー入力テキストを組む */
export function buildUserText(c) {
  const parts = [];
  parts.push(`# 今回の狙い\n${c.goal}`);
  if (c.partner_profile) {
    parts.push(`# 相手のプロフィール(架空)\n${c.partner_profile.nickname}: ${c.partner_profile.note}`);
  }
  if (c.style_sample) {
    parts.push(`# 自分の文体サンプル\n${c.style_sample}`);
  }
  if (c.images && c.images.length) {
    parts.push(
      `# 会話\n添付した${c.images.length}枚のトーク画面を古い順に読み、会話の流れを把握してください。` +
        '画面の右側が自分、左側が相手です。',
    );
  }
  if (!c.images || !c.images.length) {
    const lines = c.conversation.map((t) => `${t.from === 'self' ? '自分' : '相手'}: ${t.text}`).join('\n');
    parts.push(`# 会話\n${lines}`);
  }
  parts.push('上の会話に続けて、自分が送る返信案をちょうど3つ、JSONで出力してください。');
  return parts.join('\n\n');
}

/** 応答テキストから replies を取り出す。失敗は失敗として返す(成功扱いしない) */
export function parseReplies(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, failureKind: 'empty_response', error: '応答が空' };
  }
  let jsonText = text.trim();
  // ```json ... ``` を剥がす(モデルによっては付く)
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonText = fence[1].trim();
  // 先頭の { から末尾の } までを取る
  const s = jsonText.indexOf('{');
  const e = jsonText.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) {
    return { ok: false, failureKind: 'json_parse_failure', error: 'JSON が見つからない' };
  }
  let obj;
  try {
    obj = JSON.parse(jsonText.slice(s, e + 1));
  } catch (err) {
    return { ok: false, failureKind: 'json_parse_failure', error: 'JSON として解釈できない' };
  }
  if (!obj || !Array.isArray(obj.replies)) {
    return { ok: false, failureKind: 'schema_failure', error: 'replies 配列が無い' };
  }
  const replies = obj.replies.map((r) => (r && typeof r === 'object' ? r.text : r));
  if (replies.some((t) => typeof t !== 'string')) {
    return { ok: false, failureKind: 'schema_failure', error: 'replies の要素が文字列でない' };
  }
  // ちょうど3件でなければ失敗。2件を成功扱いしない(§13)。
  if (replies.length !== 3) {
    return { ok: false, failureKind: 'wrong_reply_count', error: `replies が ${replies.length} 件`, replies };
  }
  return { ok: true, replies };
}
