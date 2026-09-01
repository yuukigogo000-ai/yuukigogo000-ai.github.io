// candidate_select.mjs の型宣言(内部6候補 → 最終3案)。
// 外部(利用者へ返す)契約は REPLY_SCHEMA のまま = 必ず3案。以下は内部だけで使う型。
import type { FirewallReason, FirewallVerdict } from './fact_firewall.d.mts';

export type ReplyLane = 'reaction' | 'expand' | 'personal_or_future';

export type ReplyCandidate = {
  text: string;
  lane: ReplyLane;
  usedFactIds: string[];
};

export type EnabledSelfFact = {
  id: string;
  text: string;
  enabledForRequest: boolean;
  source: 'explicit' | 'verified_user_message';
};

export type SelectionContext = {
  conversationText?: string;
  selfMessages?: string[];
  /** この要求で提示された自分情報(既定は無効。enabledForRequest=true のものだけ使える) */
  enabledFacts?: EnabledSelfFact[];
  /** 別リクエスト由来と分かっている fact ID(混入検出用) */
  foreignFactIds?: string[];
  /** 既存の禁止出力ルール([name, RegExp] の配列。評価器は validate_output の BANNED_RULES を渡す) */
  bannedRules?: [string, RegExp][];
  /** fallback を決定的にする鍵(同じ要求なら同じ文面) */
  idempotencyKey?: string;
};

export type CandidateValidation = {
  ok: boolean;
  verdict: FirewallVerdict;
  reasons: FirewallReason[];
  derivedLane: ReplyLane | null;
  text?: string;
};

export type PickedReply = {
  lane: ReplyLane;
  text: string;
  source: 'model' | 'fallback';
  index: number | null;
  verdict: FirewallVerdict | null;
  reasons: FirewallReason[];
};

export const LANES: ReplyLane[];
export const CANDIDATES_PER_LANE: number;
export const CANDIDATE_COUNT: number;
export const FINAL_COUNT: number;
export const MAX_TEXT_LEN: number;
export const MIN_TEXT_LEN: number;
export const SIMILARITY_LIMIT: number;
export const FALLBACK_TEMPLATES: Record<ReplyLane, string[]>;

export function similarity(a: string, b: string): number;
export function stableHash(s: string): number;
export function pickFallback(lane: ReplyLane, idempotencyKey: string, opts?: { avoid?: string[] }): string;
export function deriveLane(text: string): ReplyLane;
export function validateCandidate(cand: unknown, ctx?: SelectionContext): CandidateValidation;
export function validateCandidates(candidates: unknown[], ctx?: SelectionContext): { results: (CandidateValidation & { index: number; candidate: unknown })[]; notes: string[] };
export function selectThree(candidates: unknown[], ctx?: SelectionContext): {
  picks: { lane: ReplyLane; text: string | null; source: string; index: number | null; verdict: FirewallVerdict | null; reasons: FirewallReason[] }[];
  results: (CandidateValidation & { index: number; candidate: unknown })[];
  missingLanes: ReplyLane[];
  softRisks: unknown[];
  rejected: unknown[];
};
export function finalizeReplies(args: { firstPass: unknown[]; secondPass?: unknown[] | null; ctx?: SelectionContext }): {
  replies: [string, string, string];
  picked: PickedReply[];
  regenerated: boolean;
  fallbackLanes: ReplyLane[];
  softRisks: unknown[];
  rejected: unknown[];
  needsRegeneration: boolean;
};
