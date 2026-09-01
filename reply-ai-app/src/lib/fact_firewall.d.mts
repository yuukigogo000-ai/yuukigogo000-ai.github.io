// fact_firewall.mjs の型宣言(実装は本番UIと pricing_eval 評価器で共有する単一ソース)
export type FirewallLevel = 'hard_reject' | 'soft_risk';
export type FirewallVerdict = 'ok' | 'soft_risk' | 'hard_reject';

export type FirewallReason = {
  code: string;
  level: FirewallLevel;
  detail: string;
  clause?: string;
  token?: string;
};

export type FirewallContext = {
  /** 入力側の全文(会話・プロフィール・文体サンプル・狙い)。固有名詞の根拠照合に使う */
  conversationText?: string;
  /** 会話中の「自分」の発言(自分の過去発言は個人事実の根拠になる) */
  selfMessages?: string[];
  /** この要求で有効化された自分情報の本文 */
  enabledFactTexts?: string[];
};

export const PLACEHOLDER_RE: RegExp;
export const MANIPULATION_RE: RegExp;
export function normalizeForCheck(text: string): string;
export function splitClauses(text: string): { text: string; isQuestion: boolean }[];
export function findPersonalFacts(text: string, ctx?: FirewallContext): FirewallReason[];
export function findProperNounRisks(text: string, ctx?: FirewallContext): FirewallReason[];
export function checkFactFirewall(text: string, ctx?: FirewallContext): { verdict: FirewallVerdict; reasons: FirewallReason[] };
export function isAllowedConversationalMove(text: string): boolean;
