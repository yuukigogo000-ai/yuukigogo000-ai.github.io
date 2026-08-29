// レポート生成(§11)。raw results(results.jsonl)からのみ再生成できる。
//
// 使い方: node pricing_eval/src/report.mjs --run-id=<ID> [--usd-jpy=160]
//
// 出力: summary.csv / blind_review.csv / MODEL_COST_QUALITY_REPORT.md

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, parseArgs, ConfigError } from './lib/config.mjs';
import { logInfo, logWarn } from './lib/log.mjs';
import { readResults } from './run_eval.mjs';
import { scoreRun } from './score_results.mjs';
import { toJpy } from './calculate_cost.mjs';

const RUNS_DIR = 'pricing_eval/runs';
const BLIND_REVIEW_CASES = 30;

const fmtUsd = (v) => (v === null || v === undefined ? 'unknown' : `$${v.toFixed(6)}`);
function fmtJpy(v, cfg) {
  if (v === null || v === undefined) return 'unknown';
  try { return `${toJpy(v, cfg).toFixed(2)}円`; } catch { return '(USD/JPY 未指定)'; }
}

function csvEscape(s) {
  const t = String(s ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** blind review 用: モデル名を伏せ、重要30ケースを取り出す */
export function buildBlindReview(rows, limit = BLIND_REVIEW_CASES) {
  // 重要 = 各区分から均等に、成功した応答のみ(比較できないものは載せない)
  const ok = rows.filter((r) => r.success && r.replies);
  const cats = [...new Set(ok.map((r) => r.category))];
  const perCat = Math.max(1, Math.ceil(limit / Math.max(1, cats.length)));
  const picked = [];
  for (const c of cats) {
    picked.push(...ok.filter((r) => r.category === c).slice(0, perCat));
  }
  const sel = picked.slice(0, limit);
  // モデル名 → 匿名ラベル(A, B, C...)。対応表は別ファイルにしない(採点者に見せない)
  const models = [...new Set(sel.map((r) => r.modelKey))].sort();
  const label = new Map(models.map((m, i) => [m, String.fromCharCode(65 + i)]));
  return sel.map((r) => ({
    case_id: r.caseId,
    category: r.category,
    model_label: label.get(r.modelKey),
    reply_1: r.replies[0], reply_2: r.replies[1], reply_3: r.replies[2],
  }));
}

function main() {
  const args = parseArgs();
  const cfg = loadConfig(args);
  const runId = args['run-id'];
  if (!runId) throw new Error('--run-id を指定してください');
  const dir = join(RUNS_DIR, runId);
  const resultsPath = join(dir, 'results.jsonl');
  if (!existsSync(resultsPath)) throw new Error(`results.jsonl がありません: ${resultsPath}`);

  const { rows } = readResults(resultsPath);
  const scored = scoreRun(resultsPath);
  const manifest = existsSync(join(dir, 'run_manifest.json'))
    ? JSON.parse(readFileSync(join(dir, 'run_manifest.json'), 'utf8')) : null;
  const synthetic = scored.models.some((m) => m.synthetic);

  // --- summary.csv ---
  const head = ['model_key', 'model_id', 'synthetic', 'n', 'success_rate', 'critical_rate', 'machine_score',
    'mean_cost_usd', 'p95_cost_usd', 'max_cost_usd', 'mean_latency_ms', 'monthly_60_usd', 'monthly_120_usd'];
  const lines = [head.join(',')];
  for (const m of scored.models) {
    lines.push([
      m.modelKey, m.modelId, m.synthetic, m.quality?.n ?? 0,
      pct(m.quality?.successRate), pct(m.quality?.criticalRate), m.quality?.score ?? 'unknown',
      numOrUnknown(m.cost.effective.mean), numOrUnknown(m.cost.effective.p95), numOrUnknown(m.cost.effective.max),
      numOrUnknown(m.cost.latencyMs.mean), numOrUnknown(m.cost.monthly[60]), numOrUnknown(m.cost.monthly[120]),
    ].map(csvEscape).join(','));
  }
  writeFileSync(join(dir, 'summary.csv'), lines.join('\n') + '\n');

  // --- blind_review.csv ---
  const br = buildBlindReview(rows);
  const brHead = ['case_id', 'category', 'model_label', 'reply_1', 'reply_2', 'reply_3',
    'score_natural_25', 'score_context_25', 'score_style_20', 'score_diversity_10', 'score_no_fabrication_10', 'score_no_false_refusal_10', 'comment'];
  const brLines = [brHead.join(',')];
  for (const r of br) {
    brLines.push([r.case_id, r.category, r.model_label, r.reply_1, r.reply_2, r.reply_3, '', '', '', '', '', '', ''].map(csvEscape).join(','));
  }
  writeFileSync(join(dir, 'blind_review.csv'), brLines.join('\n') + '\n');

  // --- MODEL_COST_QUALITY_REPORT.md ---
  const md = [];
  md.push(`# Replier モデル×原価 レポート — ${runId}`);
  md.push('');
  md.push(`生成日時: ${new Date().toISOString()} / 元データ: \`results.jsonl\`(${rows.length} 行)`);
  md.push('');
  if (synthetic) {
    md.push('> ⚠️ **このランはモックアダプタによる合成応答を含みます。**');
    md.push('> 器(harness)の検査用であり、**モデルの品質・原価の結論には使えません**。');
    md.push('');
  }
  md.push('> このレポートの順位は **provisional(機械評価のみ)**です。');
  md.push('> 人間の blind review と unit economics が終わるまで、採用モデル・価格・月間回数を確定しません。');
  md.push('');
  md.push('## 機械評価(provisional)');
  md.push('');
  md.push('| モデル | 合成 | 件数 | 成功率 | critical率 | 機械点 | 誤拒否 | 捏造 | schema失敗 | 再試行率 |');
  md.push('|---|---|--:|--:|--:|--:|--:|--:|--:|--:|');
  for (const m of scored.models) {
    const q = m.quality;
    md.push(`| ${m.modelKey} | ${m.synthetic ? 'はい' : 'いいえ'} | ${q?.n ?? 0} | ${pct(q?.successRate)} | ${pct(q?.criticalRate)} | ${q?.score ?? 'unknown'} | ${q?.falseRefusals ?? '-'} | ${q?.fabrications ?? '-'} | ${q?.schemaFailures ?? '-'} | ${pct(q?.retryRate)} |`);
  }
  md.push('');
  md.push('## 原価(再試行込み実効原価)');
  md.push('');
  md.push('| モデル | 平均 | median | p90 | p95 | max | 原価不明 |');
  md.push('|---|--:|--:|--:|--:|--:|--:|');
  for (const m of scored.models) {
    const e = m.cost.effective;
    md.push(`| ${m.modelKey} | ${fmtUsd(e.mean)} | ${fmtUsd(e.median)} | ${fmtUsd(e.p90)} | ${fmtUsd(e.p95)} | ${fmtUsd(e.max)} | ${e.unknownCount} 件 |`);
  }
  md.push('');
  md.push('### 入力区分別(平均)');
  md.push('');
  md.push('| モデル | テキストのみ | 画像1〜3枚 | 画像4〜6枚 |');
  md.push('|---|--:|--:|--:|');
  for (const m of scored.models) {
    const b = m.cost.byBucket;
    md.push(`| ${m.modelKey} | ${fmtUsd(b.text_only.mean)} | ${fmtUsd(b.image_1_3.mean)} | ${fmtUsd(b.image_4_6.mean)} |`);
  }
  md.push('');
  md.push('### 月間 AI 推論原価(仮の回数。公開回数ではない)');
  md.push('');
  md.push(`為替前提: ${cfg.usdJpy ? `${cfg.usdJpy} 円/$(明示指定)` : '**未指定 — 円換算は出しません**'}`);
  md.push('');
  md.push('| モデル | 60回/月 | 120回/月 |');
  md.push('|---|--:|--:|');
  for (const m of scored.models) {
    md.push(`| ${m.modelKey} | ${fmtUsd(m.cost.monthly[60])} / ${fmtJpy(m.cost.monthly[60], cfg)} | ${fmtUsd(m.cost.monthly[120])} / ${fmtJpy(m.cost.monthly[120], cfg)} |`);
  }
  md.push('');
  md.push('> AI 原価だけで料金は決まりません。Stripe・Apple/Google・AWS周辺費・税・無料利用・返金/不正利用・');
  md.push('> サポート余力を加えた unit economics が別途必要です。');
  md.push('');
  md.push('## 採用可否');
  md.push('');
  md.push('| 判定 | 状態 |');
  md.push('|---|---|');
  md.push('| 機械評価 | 完了(provisional) |');
  md.push('| 人間 blind review | **未了** — `blind_review.csv` を採点してください |');
  md.push('| Hard Gate | ' + (manifest?.candidates?.some((c) => c.adoptionBlocked) ? '**採用保留あり**(unknown 項目が残っている)' : '要確認') + ' |');
  md.push('| 最終採用 | **確定しない**(この工程では決めない) |');
  md.push('');
  if (manifest?.blocked?.length) {
    md.push('### Hard Gate 違反で実行しなかったモデル');
    md.push('');
    for (const b of manifest.blocked) md.push(`- \`${b.key}\`: ${b.fails.join(', ')}`);
    md.push('');
  }
  md.push('## 次に人間が行うこと');
  md.push('');
  md.push('1. `blind_review.csv` を採点する(モデル名は伏せてある)');
  md.push('2. 価格が unknown のモデルは `pricing_override.json` に公式値を転記する');
  md.push('3. Provider 規約(用途可否・入出力の共有有無)を確認する');
  md.push('4. unit economics を足して、料金と月間回数を別工程で決める');
  md.push('');
  writeFileSync(join(dir, 'MODEL_COST_QUALITY_REPORT.md'), md.join('\n'));

  logInfo('レポートを生成しました', { dir, models: scored.models.length, blindReviewRows: br.length });
  if (synthetic) logWarn('このランは合成応答を含みます。モデルの結論には使えません。');
}

function pct(v) { return v === null || v === undefined ? 'unknown' : `${(v * 100).toFixed(1)}%`; }
function numOrUnknown(v) { return v === null || v === undefined ? 'unknown' : v; }

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (e) {
    if (e instanceof ConfigError) { console.error('[error]', e.message); process.exit(2); }
    console.error('[error]', e.message); process.exit(1);
  }
}
