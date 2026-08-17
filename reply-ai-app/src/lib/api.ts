// Anthropic Messages API をブラウザから直接呼ぶ(MVP)。
// Phase 2 で自前バックエンドに向ける時は、この 1 ファイルの向き先を変えるだけで済むようにしておく。

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

const MODEL = 'claude-opus-5';

export async function callClaude<T>(
  key: string,
  system: string,
  schema: unknown,
  content: ContentBlock[],
): Promise<T> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      output_config: { format: { type: 'json_schema', schema } },
      // 指示書は毎回同じなのでキャッシュさせる(5分以内の連続利用で入力トークン代が下がる)
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `APIエラー (${res.status})`);
  if (data.stop_reason === 'refusal') {
    throw new Error('この内容にはAIが回答できませんでした。入力内容を変えてお試しください。');
  }

  const textBlock = (data.content as { type: string; text?: string }[] | undefined)?.find(
    (b) => b.type === 'text',
  );
  if (!textBlock?.text) throw new Error('AIから結果を取得できませんでした。もう一度お試しください。');

  try {
    return JSON.parse(textBlock.text) as T;
  } catch {
    throw new Error(
      data.stop_reason === 'max_tokens'
        ? '応答が長すぎて途中で切れました。スクショの枚数や会話の長さを減らしてもう一度お試しください。'
        : 'AIの応答を解析できませんでした。もう一度お試しください。',
    );
  }
}

export type ReplyResult = {
  situation: string;
  interest_level: number;
  replies: { bubbles?: string[]; text?: string; why: string }[];
  advice: string;
};

export type ProfileResult = {
  score: number;
  first_impression: string;
  strengths: string[];
  weaknesses: string[];
  improved_bios: { text: string; why: string }[];
  photo_advice: string;
};
