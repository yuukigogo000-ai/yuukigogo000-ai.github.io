// schema_compat.mjs の型宣言(実装は本番 api.ts と pricing_eval 評価器で共有する単一ソース)
export function toStructuredOutputSchema<T>(schema: T): T;
