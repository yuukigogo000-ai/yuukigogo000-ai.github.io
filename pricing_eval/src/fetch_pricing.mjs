// AWS Price List API から Bedrock の公式価格を機械取得する(§10)。
//
// 取れたものだけを snapshot に残し、取れないものは書かない(unknown のままにする)。
// 出典URL・取得日時・リージョン・service tier を必ず添える。
//
// 使い方: node pricing_eval/src/fetch_pricing.mjs [--region=ap-northeast-1]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs, loadConfig } from './lib/config.mjs';
import { logInfo, logWarn } from './lib/log.mjs';

export const priceListUrl = (region) =>
  `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/${region}/index.json`;

// 料金決定の基準は on-demand。flex / priority / batch は別条件なので混ぜない。
const INPUT_TYPES = new Set(['input tokens', 'text input tokens']);
const OUTPUT_TYPES = new Set(['output tokens']);
const EXCLUDE = /(flex|priority|batch|cache)/i;

/** 単位を per-1M tokens の USD に正規化 */
function toPerMTok(pricePerUnit, unit) {
  const usd = Number(pricePerUnit);
  if (!Number.isFinite(usd)) return null;
  const u = String(unit || '').toLowerCase();
  if (u.includes('1k')) return usd * 1000;
  if (u.includes('1m')) return usd;
  if (u === 'tokens' || u.includes('per token')) return usd * 1e6;
  return null; // 未知の単位は推測しない
}

/** Price List の JSON から { modelName: {inputPerMTokUsd, outputPerMTokUsd, ...} } を作る */
export function parsePriceList(doc, region) {
  const models = {};
  const skipped = [];
  // どの Provider が価格表に載っているかを証拠として残す。
  // 「載っていない = 使えない」ではない(利用可否は ListFoundationModels でしか確認できない)が、
  // 「価格を機械取得できるか」の判定には必要。
  const providersPresent = new Set();
  for (const [sku, p] of Object.entries(doc.products || {})) {
    const a = p.attributes || {};
    if (a.regionCode && a.regionCode !== region) continue;
    const kind = String(a.inferenceType || '').toLowerCase();
    if (!kind || EXCLUDE.test(kind)) continue;
    const isIn = INPUT_TYPES.has(kind);
    const isOut = OUTPUT_TYPES.has(kind);
    if (!isIn && !isOut) continue;
    const modelName = a.model;
    if (!modelName) continue;
    providersPresent.add(a.provider || '(Amazon/未記載)');

    const term = Object.values(doc.terms?.OnDemand?.[sku] || {})[0];
    const dim = Object.values(term?.priceDimensions || {})[0];
    if (!dim) { skipped.push(`${modelName}: OnDemand 条件なし`); continue; }
    const perM = toPerMTok(dim.pricePerUnit?.USD, dim.unit);
    if (perM === null) { skipped.push(`${modelName}: 単位 ${dim.unit} を解釈できない`); continue; }

    models[modelName] ??= {
      modelName, provider: a.provider || null, region,
      inputPerMTokUsd: null, outputPerMTokUsd: null,
      tier: 'on-demand', source: priceListUrl(region), fetchedAt: null,
    };
    if (isIn) models[modelName].inputPerMTokUsd = perM;
    if (isOut) models[modelName].outputPerMTokUsd = perM;
  }
  // 入力と出力が揃わないものは不完全として落とす(片方だけで原価は出せない)
  const complete = {}, incomplete = [];
  for (const [k, v] of Object.entries(models)) {
    if (v.inputPerMTokUsd != null && v.outputPerMTokUsd != null) complete[k] = v;
    else incomplete.push(k);
  }
  return { models: complete, incomplete, skipped, providersPresent: [...providersPresent].sort() };
}

export async function fetchPricing({ region, fetchImpl = globalThis.fetch, timeoutMs = 180000 }) {
  const url = priceListUrl(region);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, url };
    const doc = await res.json();
    const fetchedAt = new Date().toISOString();
    const parsed = parsePriceList(doc, region);
    for (const v of Object.values(parsed.models)) v.fetchedAt = fetchedAt;
    return {
      ok: true, url, fetchedAt, region,
      publicationDate: doc.publicationDate ?? null,
      version: doc.version ?? null,
      ...parsed,
    };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : e.message, url };
  } finally {
    clearTimeout(timer);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const out = args.out || 'pricing_eval/evidence/price_snapshot.json';
  fetchPricing({ region: cfg.region }).then((r) => {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(r, null, 2));
    if (!r.ok) {
      logWarn(`価格を機械取得できませんでした: ${r.reason}`);
      logWarn('pricing_override.json に公式値を転記してください(0 円扱いにはしません)');
      process.exitCode = 2;
      return;
    }
    logInfo('価格 snapshot を書き出しました', {
      out, region: r.region, models: Object.keys(r.models).length,
      incomplete: r.incomplete.length, publicationDate: r.publicationDate,
    });
  });
}
