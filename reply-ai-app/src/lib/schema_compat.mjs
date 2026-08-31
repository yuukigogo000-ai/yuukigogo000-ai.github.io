// Anthropic Messages API の構造化出力(output_config.format=json_schema)へ渡せる形に JSON Schema を落とす。
//
// 公式仕様: 配列制約は `minItems` の 0/1 のみ対応、`maxItems` は未対応(未対応の機能は 400)。
// 2026-08-31 実射で `output_config.format.schema: For 'array' type, 'minItems' values other than 0 or 1 are not supported`
// を確認した(REPLY_SCHEMA.replies の minItems/maxItems=3 が原因。3案固定の変更以降、本番アプリの全リクエストが 400 になる状態だった)。
//
// 正本 REPLY_SCHEMA(minItems/maxItems=3)は Bedrock tool-use とサーバー側検証で使うので変えない。
// 件数の縛りは description+プロンプト+受信側の検査(3件に切り詰め / 3件未満は再生成)で担保する。
//
// このファイルは reply-ai-app(本番 api.ts)と pricing_eval(評価器)の両方から import される単一実装(ungrounded.mjs と同じ方針)。

/**
 * @template T
 * @param {T} schema
 * @returns {T} 深いコピー(minItems>1 → 1、maxItems 削除。入れ子も同様)
 */
export function toStructuredOutputSchema(schema) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === 'maxItems') continue;
        if (k === 'minItems') { out[k] = typeof v === 'number' && v > 1 ? 1 : v; continue; }
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  return walk(schema);
}
