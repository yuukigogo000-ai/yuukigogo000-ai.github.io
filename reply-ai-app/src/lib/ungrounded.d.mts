// ungrounded.mjs の型宣言(実装は本番UIと pricing_eval 評価器で共有する単一ソース)
export const PROMPT_EXAMPLE_NAMES: string[];
export function extractNameTokens(text: string): Set<string>;
export function findUngroundedNames(replyTexts: string[], groundingText: string): string[];
