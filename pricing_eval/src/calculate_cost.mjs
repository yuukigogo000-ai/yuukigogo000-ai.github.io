// 原価計算(§10)。
//
// 絶対の約束:
//   - 価格が取得できないモデルの原価を 0 円にしない。unknown のまま伝える。
//   - USD/JPY が未指定なら円を一切出さない。
//   - キャッシュ込みの数字を料金決定の基準にしない(基準はキャッシュなし)。
//
// 価格の入手経路:
//   1) AWS Price List API(機械取得)… 失敗したら捏造せず unknown
//   2) pricing_override.json … 人間が公式値を転記したもの。出典URL・取得日時が必須。

import { existsSync, readFileSync } from 'node:fs';
import { requireUsdJpy } from './lib/config.mjs';

export const PRICE_LIST_URL =
  'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/index.json';

export const UNKNOWN = null;

/**
 * 価格表を読む。返り値の各モデルは
 *   { inputPerMTokUsd, outputPerMTokUsd, imageUnitUsd?, source, fetchedAt, region, tier }
 * 取得できない項目は null。null を 0 と解釈してはならない。
 */
export const DEFAULT_SNAPSHOT_PATH = 'pricing_eval/evidence/price_snapshot.json';

export function loadPricing({
  overridePath = 'pricing_eval/pricing_override.json',
  snapshotPath = DEFAULT_SNAPSHOT_PATH,
  snapshot = null,
} = {}) {
  const out = { models: {}, sources: [], missing: [] };
  // 機械取得した snapshot を先に入れ、override で上書きする(人が確認した値を優先)
  if (!snapshot && snapshotPath && existsSync(snapshotPath)) {
    const snap = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    if (snap.ok) {
      Object.assign(out.models, snap.models || {});
      out.sources.push({ kind: 'price_list_api', url: snap.url, fetchedAt: snap.fetchedAt, region: snap.region, tier: 'on-demand' });
    }
  }
  if (snapshot) {
    Object.assign(out.models, snapshot.models || {});
    out.sources.push(...(snapshot.sources || []));
  }
  // 推定価格(derived_estimate)は official と混ぜない。原価計算に使うのは official_exact だけ。
  out.derivedEstimates = {};
  if (existsSync(overridePath)) {
    const ov = JSON.parse(readFileSync(overridePath, 'utf8'));
    for (const [id, p] of Object.entries(ov.models || {})) {
      if (!p.source || !p.fetchedAt) {
        throw new Error(`pricing_override.json の ${id} に source / fetchedAt がありません(出典なしの価格は使えません)`);
      }
      const kind = p.kind ?? 'official_exact';
      if (kind === 'derived_estimate') {
        // 参考表示専用。AWS公式実価格として扱わない(モデル一覧にも入れない)。
        out.derivedEstimates[id] = p;
        continue;
      }
      if (kind !== 'official_exact') {
        throw new Error(`pricing_override.json の ${id} の kind '${kind}' は不正(official_exact / derived_estimate のみ)`);
      }
      out.models[id] = p;
    }
    out.sources.push({ kind: 'override', path: overridePath, note: ov.note || null });
  }
  return out;
}

/** AWS Price List API から機械取得を試みる。失敗しても例外にせず理由を返す。 */
export async function tryFetchPricing({ fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(PRICE_LIST_URL, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, url: PRICE_LIST_URL };
    const json = await res.json();
    return { ok: true, url: PRICE_LIST_URL, fetchedAt: new Date().toISOString(), raw: json };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : e.message, url: PRICE_LIST_URL };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 1回の呼び出しの USD 原価。価格 or usage が欠けたら null(0 にしない)。
 * usage は「1試行ぶん」。再試行は呼び出し側で合算する。
 */
export function costUsdForAttempt(usage, price) {
  if (!price || price.inputPerMTokUsd == null || price.outputPerMTokUsd == null) return UNKNOWN;
  if (!usage || usage.inputTokens == null || usage.outputTokens == null) return UNKNOWN;
  const inTok = usage.inputTokens;
  // reasoning は出力として課金される前提で加算(取得できなければ 0 ではなく未計上として扱う)
  const outTok = usage.outputTokens + (usage.reasoningTokens ?? 0);
  let usd = (inTok / 1e6) * price.inputPerMTokUsd + (outTok / 1e6) * price.outputPerMTokUsd;
  // 画像が token ではなく固定課金のモデル向け
  if (price.imageUnitUsd != null && usage.imageUnits != null) usd += usage.imageUnits * price.imageUnitUsd;
  // prompt caching(Anthropic 第一者API: input_tokens はキャッシュ分を含まないので別計上)。cache 単価が無い価格表では加算しない
  if (price.cacheWritePerMTokUsd != null && usage.cacheWriteTokens != null) usd += (usage.cacheWriteTokens / 1e6) * price.cacheWritePerMTokUsd;
  if (price.cacheReadPerMTokUsd != null && usage.cacheReadTokens != null) usd += (usage.cacheReadTokens / 1e6) * price.cacheReadPerMTokUsd;
  return usd;
}

/** 1ケースぶん(初回+再試行)の実効原価 */
export function effectiveCostUsd(attempts, price) {
  const each = attempts.map((a) => costUsdForAttempt(a.usage, price));
  if (each.some((v) => v === UNKNOWN)) return UNKNOWN;
  return each.reduce((s, v) => s + v, 0);
}

/**
 * USD金額の表示用整形。浮動小数点の見かけ誤差(例: 0.0004939200000000001)を
 * 桁丸めで除去した正確な10進文字列を返す。
 * NaN / 空文字 / null / undefined / 数値でないものは null(0 にも '' にもしない)。
 */
export function formatUsd(v, digits = 8) {
  if (typeof v === 'string') {
    if (v.trim() === '') return null;
    v = Number(v);
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function toJpy(usd, cfg) {
  if (usd === UNKNOWN) return UNKNOWN;
  const rate = requireUsdJpy(cfg); // 未指定なら例外。円を勝手に作らない。
  return usd * rate;
}

// --- 集計 ---
export function percentile(sorted, p) {
  if (!sorted.length) return UNKNOWN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function summarize(values) {
  const v = values.filter((x) => x !== UNKNOWN && Number.isFinite(x)).sort((a, b) => a - b);
  const unknownCount = values.length - v.length;
  if (!v.length) return { n: 0, unknownCount, mean: UNKNOWN, median: UNKNOWN, p90: UNKNOWN, p95: UNKNOWN, max: UNKNOWN };
  return {
    n: v.length,
    unknownCount,
    mean: v.reduce((s, x) => s + x, 0) / v.length,
    median: percentile(v, 50),
    p90: percentile(v, 90),
    p95: percentile(v, 95),
    max: v[v.length - 1],
  };
}

/** 画像枚数の区分 */
export function bucketOf(testCase) {
  const n = testCase.images ? testCase.images.length : 0;
  if (n === 0) return 'text_only';
  if (n <= 3) return 'image_1_3';
  return 'image_4_6';
}

/**
 * 月間 AI 原価。回数はここでは決め打ちせず呼び出し側から渡す(公開回数を勝手に固定しない)。
 * 平均原価が unknown なら月間も unknown。
 */
export function monthlyCost(meanCostPerCall, counts = [60, 120]) {
  const out = {};
  for (const n of counts) out[n] = meanCostPerCall === UNKNOWN ? UNKNOWN : meanCostPerCall * n;
  return out;
}
