// 検証用モックアダプタ。
//
// ⚠️ このアダプタの出力は「合成された偽の応答」であり、モデルの品質・原価の結論には使えない。
//    結果には synthetic:true を必ず付け、report 側で実測と混同しないようにしている(§13の器の検査用)。
//
// 目的は器(harness)の破壊的検証: 障害注入・再試行・resume・予算・禁止語検出が正しく動くかを確かめる。

const FAULTS = new Set([
  'none',
  'http_429',            // rate limit
  'http_500',            // 5xx
  'timeout',             // タイムアウト(Provider側では完了しているケースを模す)
  'broken_json',         // schema対応表記があるのに壊れたJSONを返す
  'two_replies',         // HTTP成功だが返信案が2つ
  'empty',               // 空応答
  'interest_score',      // 脈あり度・感情スコアが混入
  'false_refusal',       // 普通の医療語・宗教語で拒否
  'fabrication',         // 入力にない固有名詞・日付を捏造
  'six_images_fail',     // 6枚入力のときだけ失敗
  'usage_missing',       // usage が返らない(原価不明)
  'flaky_first_only',    // 1回目だけ失敗し再試行で成功
]);

export function createMockClient({ fault = 'none', seed = 1 } = {}) {
  if (!FAULTS.has(fault)) throw new Error(`未知の fault: ${fault}`);
  const attempts = new Map();

  return {
    synthetic: true,
    fault,
    async invoke({ caseId, imageCount }) {
      const n = (attempts.get(caseId) || 0) + 1;
      attempts.set(caseId, n);

      const f = fault === 'six_images_fail' && imageCount < 6 ? 'none'
        : fault === 'flaky_first_only' && n > 1 ? 'none'
        : fault;

      switch (f) {
        case 'http_429': throw Object.assign(new Error('Too many requests'), { status: 429, code: 'ThrottlingException' });
        case 'http_500': throw Object.assign(new Error('Internal error'), { status: 500, code: 'InternalServerException' });
        case 'timeout': throw Object.assign(new Error('timed out'), { code: 'Timeout' });
        case 'flaky_first_only': // 1回目だけ失敗(再試行で成功する経路の検査)
          throw Object.assign(new Error('transient'), { status: 503, code: 'ServiceUnavailable' });
        case 'six_images_fail': throw Object.assign(new Error('image limit'), { status: 400, code: 'ValidationException' });
        case 'broken_json': return resp('{"replies":[{"text":"あ', usage());
        case 'empty': return resp('', usage());
        case 'two_replies':
          return resp(JSON.stringify({ replies: [{ text: 'そうなんですね!' }, { text: 'いいですね〜' }] }), usage());
        case 'interest_score':
          return resp(JSON.stringify({
            replies: three(['脈あり度は80%です。まずは', 'いい感じですね、好意度高めです', '相手はあなたに好意があります']),
          }), usage());
        case 'false_refusal':
          return resp(JSON.stringify({
            replies: three(['申し訳ありませんが、医療に関する話題にはお答えできません', 'この内容にはお答えできません', 'ご要望にはお応えできません']),
          }), usage());
        case 'fabrication':
          return resp(JSON.stringify({
            replies: three(['来週の水曜19時に新宿の田中さんの店でどうですか', '03-1234-5678に連絡しますね', '渋谷のカフェ「星屋」で12月3日に'],
            )}), usage());
        case 'usage_missing':
          return resp(JSON.stringify({ replies: three(['そうなんですね', 'いいですね', 'わかります']) }), null);
        default:
          return resp(JSON.stringify({
            replies: three([
              'そうなんですね!それは大変でしたね、ゆっくり休めてますか?',
              'お疲れさまです〜 落ち着いたらまたお話し聞かせてください',
              'なるほど、そういう時期ってありますよね。無理しないでくださいね',
            ]),
          }), usage(imageCount));
      }
    },
  };

  function three(texts) { return texts.slice(0, 3).map((t) => ({ text: t })); }
  function usage(imageCount = 0) {
    // それらしい値だが実測ではない。synthetic フラグで区別する。
    return {
      inputTokens: 900 + imageCount * 1200 + (seed % 50),
      outputTokens: 260 + (seed % 30),
      reasoningTokens: null, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: null,
    };
  }
  function resp(text, u) { return { text, usage: u, stopReason: 'end_turn', synthetic: true }; }
}

export const MOCK_FAULTS = [...FAULTS];
