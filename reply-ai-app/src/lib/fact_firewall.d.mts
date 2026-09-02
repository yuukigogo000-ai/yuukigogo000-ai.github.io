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
  /** この要求で有効化され、かつ候補が申告した自分情報の本文(根拠として使えるもの) */
  enabledFactTexts?: string[];
  /** この要求で有効な自分情報すべて(矛盾の検査に使う。申告の有無を問わない) */
  allFactTexts?: string[];
};

export const PLACEHOLDER_RE: RegExp;
export const MANIPULATION_RE: RegExp;
export function normalizeForCheck(text: string): string;
export function splitClauses(text: string): { text: string; isQuestion: boolean }[];
export function findPersonalFacts(text: string, ctx?: FirewallContext): FirewallReason[];
export function findProperNounRisks(text: string, ctx?: FirewallContext): FirewallReason[];
export function checkFactFirewall(text: string, ctx?: FirewallContext): { verdict: FirewallVerdict; reasons: FirewallReason[] };
export function findFactContradictions(text: string, factTexts?: string[]): FirewallReason[];
export function findFactNegationConflicts(text: string, factTexts?: string[]): FirewallReason[];
export function findTextGlitches(text: string): FirewallReason[];
export function findQuotedTitles(text: string): string[];
export function isAllowedConversationalMove(text: string): boolean;
