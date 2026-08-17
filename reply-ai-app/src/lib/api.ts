// Anthropic Messages API をブラウザから直接呼ぶ(MVP)。
// Phase 2 で自前バックエンドに向ける時は、この 1 ファイルの向き先を変えるだけで済むようにしておく。

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

const MODEL = 'claude-opus-5';
const DEFAULT_TIMEOUT_MS = 120_000;

/** 通常は120秒。テスト時のみ localStorage 'reply_ai_timeout_ms' で短くできる */
function timeoutMs(): number {
  try {
    const v = Number(localStorage.getItem('reply_ai_timeout_ms'));
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_TIMEOUT_MS;
}

/** 呼び出し側が意図的に打ち切った場合。エラーとしては表示しない */
export class CanceledError extends Error {
  constructor() {
    super('canceled');
    this.name = 'CanceledError';
  }
}

export async function callClaude<T>(
  key: string,
  system: string,
  schema: unknown,
  content: ContentBlock[],
  external?: AbortSignal,
): Promise<T> {
  if (external?.aborted) throw new CanceledError();

  // 入力が変わった時などに呼び出し側から止められるようにする(止めないとボタンが待たされ続ける)
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(new DOMException('timeout', 'TimeoutError')),
    timeoutMs(),
  );
  const onExternalAbort = () => controller.abort(new DOMException('canceled', 'AbortError'));
  external?.addEventListener('abort', onExternalAbort, { once: true });

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      signal: controller.signal,
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
  } catch (err) {
    if (external?.aborted) throw new CanceledError();
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(
        '応答がありませんでした(時間切れ)。通信環境を確認して、もう一度お試しください。',
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }

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
