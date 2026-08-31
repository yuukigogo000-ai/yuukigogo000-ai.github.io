// 次の10ケースrunの費用見積り(§7・2026-09-01 FIX_REQUIRED)。読み取り専用・モデル呼び出しなし。
//
// 「10ケース100〜300円」という一括表現は撤回する。候補モデルごとに、
//   oneCallCost = inputTokens × inputPrice + outputTokens6Candidates × outputPrice
//   worstCase10 = 10 × oneCallCost × 2            (2倍 = 全10ケースで1回ずつ再生成した場合)
// で計算する。入力料金と出力料金は必ず別単価で掛ける(混ぜない)。
//
// 使うトークン数の出どころ:
//   inputTokens / outputTokens は各モデルの**実runの実測平均**(runs/*/results.jsonl)。
//   outputTokens6Candidates は「3案ぶんの実測出力 × 2」= **仮定**であって実測ではない
//   (内部6候補で本当に何トークン出るかは、新方式でのrunをするまで分からない)。
//
// 価格が official_exact で無いモデルは **見積不能**(null)。0円として扱わない。
// 実行可能扱いにする条件: 対象モデル・モデルID・呼び出し経路・国内destination・公式価格が揃い、かつ人間の GO。
//
// 使い方: node pricing_eval/src/estimate_next_run.mjs

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPricing } from './calculate_cost.mjs';
import { isCliEntry, parseArgs } from './lib/config.mjs';

// Anthropic 第一者APIの公式価格表(fidelity_eval.mjs と同じパス定数。
// ここでは推論経路のモジュール(adapters 等)を読み込まないよう、意図的に import しないで持つ)
export const ANTHROPIC_PRICING_PATH = 'pricing_eval/pricing_anthropic.json';

/** official_exact の価格だけを引く(derived_estimate は使わない = §7「価格不明は見積不能」) */
export function officialPriceFor(pricing, id, modelName = null) {
  const p = pricing.models[id] || (modelName ? pricing.models[modelName] : null);
  if (!p || p.inputPerMTokUsd == null || p.outputPerMTokUsd == null) return { price: null, priceKind: null };
  return { price: p, priceKind: 'official_exact' };
}

export const NEXT_RUN_CASES = 10;
/** 全10ケースで1回ずつ再生成した場合の worst-case 係数 */
export const REGENERATION_FACTOR = 2;
/** 3案 → 内部6候補の出力トークン倍率(**仮定**。実測は新方式のrun後) */
export const CANDIDATE_OUTPUT_MULTIPLIER = 2;

/** 候補モデル。usageRun = トークン実測に使う既存run(読み取り専用) */
export const CANDIDATE_MODELS = [
  {
    key: 'claude-opus-5',
    modelId: 'claude-opus-5',
    label: 'Claude Opus 5(Anthropic API 直接)',
    route: 'Anthropic Messages API(第一者・POST /v1/messages)',
    destination: 'Anthropic 側(米国)。国内リージョンでの処理ではない(合成データ限定・retention 明示受諾が前提)',
    priceSource: 'anthropic',
    usageRun: 'fidelity_anthropic_opus5_fab10_r4',
    status: '採用候補(未決定)',
  },
  {
    key: 'anthropic.claude-opus-5',
    modelId: 'anthropic.claude-opus-5',
    label: 'Claude Opus 5(Bedrock 経由)',
    route: 'Bedrock Converse(ap-northeast-1)',
    destination: 'ap-northeast-1(国内)',
    priceSource: 'bedrock',
    usageRun: null,                 // 403 AccessDenied で1件も成功していない = 実測トークンが無い
    status: '未実行(403 AccessDenied・IAM は変更しない)',
  },
  {
    key: 'qwen.qwen3-vl-235b-a22b',
    modelId: 'qwen.qwen3-vl-235b-a22b',
    modelName: 'Qwen3 VL 235B A22B',
    label: 'Qwen3 VL 235B A22B(Bedrock)',
    route: 'Bedrock Converse(ap-northeast-1)',
    destination: 'ap-northeast-1(国内)',
    priceSource: 'bedrock',
    usageRun: 'fidelity_tooluse_qwen_fab10',
    status: '不合格(人間確認で捏造)',
  },
  {
    key: 'moonshotai.kimi-k2.5',
    modelId: 'moonshotai.kimi-k2.5',
    modelName: 'Kimi K2.5',
    label: 'Kimi K2.5(Bedrock)',
    route: 'Bedrock Converse(ap-northeast-1)',
    destination: 'ap-northeast-1(国内)',
    priceSource: 'bedrock',
    usageRun: 'fidelity_tooluse_kimi_t02_07x5',
    status: '不採用(人間確認で捏造)',
  },
];

/** run の実測トークン(平均)。成功した試行の usage だけを見る。無ければ null */
export function measuredUsage(runId, runsDir = 'pricing_eval/runs') {
  if (!runId) return null;
  const p = join(runsDir, runId, 'results.jsonl');
  if (!existsSync(p)) return null;
  const inTok = []; const outTok = []; const cacheRead = [];
  for (const ln of readFileSync(p, 'utf8').split('\n')) {
    const s = ln.trim(); if (!s) continue;
    let r; try { r = JSON.parse(s); } catch { continue; }
    for (const a of r.attempts || []) {
      const u = a.usage || {};
      if (u.inputTokens == null || u.outputTokens == null) continue;
      inTok.push(u.inputTokens);
      outTok.push(u.outputTokens + (u.reasoningTokens ?? 0));
      cacheRead.push(u.cacheReadTokens ?? 0);
    }
  }
  if (!inTok.length) return null;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return {
    runId, calls: inTok.length,
    inputTokensMean: mean(inTok),
    outputTokens3RepliesMean: mean(outTok),
    cacheReadTokensMean: mean(cacheRead),
    inputTokensMax: Math.max(...inTok),
    outputTokens3RepliesMax: Math.max(...outTok),
  };
}

/**
 * 1モデルぶんの見積り。price が official_exact でない / 実測が無い場合は estimable=false(費用は null)。
 * 入力単価と出力単価は別物として掛ける。
 */
export function estimateOne({ usage, price, priceKind, cases = NEXT_RUN_CASES, regenerationFactor = REGENERATION_FACTOR, outputMultiplier = CANDIDATE_OUTPUT_MULTIPLIER }) {
  const missing = [];
  if (!usage) missing.push('実測トークン(成功したrunが無い)');
  if (!price || price.inputPerMTokUsd == null || price.outputPerMTokUsd == null) missing.push('公式価格');
  else if (priceKind !== 'official_exact') missing.push(`公式価格(現状 ${priceKind})`);
  if (missing.length) {
    return { estimable: false, reason: `見積不能: ${missing.join(' / ')}`, oneCallCostUsd: null, worstCase10Usd: null };
  }
  const inputTokens = usage.inputTokensMean;
  const outputTokens6Candidates = usage.outputTokens3RepliesMean * outputMultiplier;
  const inputCostUsd = (inputTokens / 1e6) * price.inputPerMTokUsd;
  const outputCostUsd = (outputTokens6Candidates / 1e6) * price.outputPerMTokUsd;
  const oneCallCostUsd = inputCostUsd + outputCostUsd;
  // プロンプトキャッシュ読み出しは上の式には含まれない(実測では発生している)。別枠で出す
  const cacheReadCostUsd = price.cacheReadPerMTokUsd != null && usage.cacheReadTokensMean
    ? (usage.cacheReadTokensMean / 1e6) * price.cacheReadPerMTokUsd : 0;
  return {
    estimable: true,
    reason: null,
    inputTokens,
    outputTokens6Candidates,
    outputTokensAssumed: true,           // 実測ではなく「3案の実測 × 倍率」
    inputCostUsd,
    outputCostUsd,
    oneCallCostUsd,
    cacheReadCostUsd,
    oneCallCostWithCacheUsd: oneCallCostUsd + cacheReadCostUsd,
    worstCase10Usd: cases * oneCallCostUsd * regenerationFactor,
    worstCase10WithCacheUsd: cases * (oneCallCostUsd + cacheReadCostUsd) * regenerationFactor,
  };
}

/** 候補モデル全部の見積り */
export function estimateNextRun({ models = CANDIDATE_MODELS, runsDir = 'pricing_eval/runs', pricing = null, anthropicPricing = null } = {}) {
  const bedrock = pricing ?? loadPricing({});
  const anthropic = anthropicPricing ?? (existsSync(ANTHROPIC_PRICING_PATH) ? JSON.parse(readFileSync(ANTHROPIC_PRICING_PATH, 'utf8')) : { models: {} });
  const rows = models.map((m) => {
    let price = null; let priceKind = null; let priceRef = null;
    if (m.priceSource === 'anthropic') {
      const p = (anthropic.models || {})[m.modelId] || null;
      if (p && p.kind === 'official_exact') { price = p; priceKind = 'official_exact'; priceRef = p.source; }
      else if (p) { price = p; priceKind = p.kind || 'unknown'; priceRef = p.source; }
    } else {
      const r = officialPriceFor(bedrock, m.modelId, m.modelName ?? null);
      price = r.price; priceKind = r.priceKind; priceRef = r.price?.source ?? null;
    }
    const usage = measuredUsage(m.usageRun, runsDir);
    const est = estimateOne({ usage, price, priceKind });
    // 実行可能扱いにする条件(全部そろって、かつ人間の GO)
    const requirements = {
      対象モデル: !!m.label, モデルID: !!m.modelId, 呼び出し経路: !!m.route,
      国内destination: !!m.destination, 公式価格: priceKind === 'official_exact',
    };
    return {
      ...m, priceKind, priceRef,
      inputPerMTokUsd: price?.inputPerMTokUsd ?? null,
      outputPerMTokUsd: price?.outputPerMTokUsd ?? null,
      usage, ...est,
      requirements,
      readyToRun: false,   // 人間の GO が無い限り常に false
      readyToRunBlockers: [
        ...Object.entries(requirements).filter(([, v]) => !v).map(([k]) => `${k}が未確定`),
        ...(est.estimable ? [] : [est.reason]),
        '人間の GO(この見積りだけでは実行しない)',
      ],
    };
  });
  return {
    at: new Date().toISOString(),
    cases: NEXT_RUN_CASES,
    regenerationFactor: REGENERATION_FACTOR,
    outputMultiplier: CANDIDATE_OUTPUT_MULTIPLIER,
    formula: 'oneCallCost = inputTokens×inputPrice + outputTokens6Candidates×outputPrice / worstCase10 = 10 × oneCallCost × 2',
    notes: [
      'outputTokens6Candidates は「3案ぶんの実測出力 × 2」= 仮定。実測ではない',
      '円換算は出さない(config.usdJpy=null: 為替は暗黙値を使わないという既存契約)',
      'プロンプトキャッシュ読み出しは §7 の式には含まれないが実測では発生している(別列で出す)',
      '価格が official_exact でないモデルは見積不能。0円ではない',
    ],
    rows,
  };
}

const usd = (v, d = 6) => (v == null ? '見積不能' : `$${v.toFixed(d)}`);

if (isCliEntry(import.meta.url)) {
  const args = parseArgs();
  const out = estimateNextRun({});
  console.log(`次の ${out.cases} ケースrunの費用見積り(${out.formula})`);
  console.log('モデル | モデルID | 経路 | destination | 価格種別 | in$/MTok | out$/MTok | 実測in | 出力(6候補・仮定) | 1呼び出し | worst-case10 | 状態');
  for (const r of out.rows) {
    console.log([
      r.label, r.modelId, r.route, r.destination, r.priceKind ?? '無し',
      r.inputPerMTokUsd ?? '-', r.outputPerMTokUsd ?? '-',
      r.usage ? Math.round(r.usage.inputTokensMean) : '実測なし',
      r.outputTokens6Candidates ? Math.round(r.outputTokens6Candidates) : '実測なし',
      usd(r.oneCallCostUsd), usd(r.worstCase10Usd, 4), r.status,
    ].join(' | '));
    if (!r.estimable) console.log(`    → ${r.reason}`);
    else console.log(`    → キャッシュ読み出しを含めると 1呼び出し ${usd(r.oneCallCostWithCacheUsd)} / worst-case10 ${usd(r.worstCase10WithCacheUsd, 4)}`);
    console.log(`    → 実行可能扱いにできない理由: ${r.readyToRunBlockers.join(' / ')}`);
  }
  for (const n of out.notes) console.log(`※ ${n}`);
  const dir = 'pricing_eval/runs/_summary';
  if (args.write !== 'false') {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'next_run_estimate.json'), JSON.stringify(out, null, 2) + '\n');
    console.log(`\n書き出し: ${join(dir, 'next_run_estimate.json')}`);
  }
}
