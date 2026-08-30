// 設定読み込み。
//
// 重要な約束:
//  - モデル名をコードに埋め込まない。候補は discover_models の結果から作る。
//  - USD/JPY は暗黙値を使わない。未指定なら円換算を一切出さない(例示のみ)。
//  - 予算上限 EVAL_MAX_BUDGET_JPY の既定は 10,000 円。

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFAULT_MAX_BUDGET_JPY = 10000;
export const SUGGESTED_CONSERVATIVE_USDJPY = 160; // 例示のみ。既定値として使わない。

export class ConfigError extends Error {}

/**
 * CLI として直接起動されたかの判定。
 * `file://${process.argv[1]}` との文字列比較は Windows のバックスラッシュパスでは
 * 決して一致せず、main() が無言でスキップされる(exit 0)ため使わない。
 */
export function isCliEntry(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try { return pathToFileURL(argv1).href === metaUrl; } catch { return false; }
}

/** CLI引数を --key=value / --flag 形式で読む */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, ...rest] = a.slice(2).split('=');
      out[k] = rest.length ? rest.join('=') : true;
    } else out._.push(a);
  }
  return out;
}

export function loadConfig(args = parseArgs()) {
  const path = args.config || process.env.PRICING_EVAL_CONFIG || 'pricing_eval/config.json';
  let file = {};
  if (existsSync(path)) file = JSON.parse(readFileSync(path, 'utf8'));

  const cfg = {
    configPath: existsSync(path) ? path : null,
    region: args.region || file.region || process.env.AWS_REGION || 'ap-northeast-1',
    // 国内とみなす destination。既定は東京・大阪のみ(§4-5)。
    allowedDestinations: file.allowedDestinations || ['ap-northeast-1', 'ap-northeast-3'],
    maxBudgetJpy: num(args['max-budget-jpy'] ?? file.maxBudgetJpy ?? process.env.EVAL_MAX_BUDGET_JPY) ?? DEFAULT_MAX_BUDGET_JPY,
    // 未指定なら null のまま。円換算はブロックされる。
    usdJpy: num(args['usd-jpy'] ?? file.usdJpy ?? process.env.EVAL_USD_JPY) ?? null,
    // 呼び出し先。'bedrock' = 実AWS / 'mock' = ローカル検証用(品質・原価の結論には使わない)
    adapter: args.adapter || file.adapter || 'bedrock',
    // 本番と分離された評価環境であることの人間による宣言。config ファイルの true のみ有効。
    evalEnvironmentDeclared: file.evalEnvironmentDeclared === true,
    mockEndpoint: args['mock-endpoint'] || file.mockEndpoint || null,
    maxImages: 6,
    maxAutoRetries: 1, // §7: 自動再試行は最大1回。増やさない。
    // EOL 猶予の最低日数。黙って固定しない(設定・CLIで変更可)。推奨比較は 90 日。
    minimumEolHeadroomDays: num(args['min-eol-headroom-days'] ?? file.minimumEolHeadroomDays) ?? 90,
    outputMaxTokens: num(file.outputMaxTokens) ?? 1024,
    temperature: file.temperature ?? 0.7,
    concurrency: num(args.concurrency ?? file.concurrency) ?? 2,
    // 明示的に候補を絞りたい場合のみ。既定は探索結果すべて。
    modelsFilter: args.models ? String(args.models).split(',').map((s) => s.trim()).filter(Boolean) : null,
  };
  return cfg;
}

function num(v) {
  if (v === undefined || v === null || v === true || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 円換算が許されるか。未指定なら理由つきで拒否する。
 * 呼び出し側は必ずこれを通し、失敗時は円を出力しない(0円扱いも禁止)。
 */
export function requireUsdJpy(cfg) {
  if (cfg.usdJpy === null || !(cfg.usdJpy > 0)) {
    throw new ConfigError(
      'USD/JPY が未指定のため円換算を出せません。--usd-jpy=<レート> か config の usdJpy、' +
        `環境変数 EVAL_USD_JPY で明示してください(例: 保守的に ${SUGGESTED_CONSERVATIVE_USDJPY})。` +
        ' 暗黙の既定値は使いません。',
    );
  }
  return cfg.usdJpy;
}
