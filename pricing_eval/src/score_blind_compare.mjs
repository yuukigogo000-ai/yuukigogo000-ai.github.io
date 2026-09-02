// ブラインド評価の集計(§10 の順で比較する)。対応表を開いてよいのは、人間の評価を受け取った後だけ。
//
// 使い方: node pricing_eval/src/score_blind_compare.mjs --experiment=cmp20260902b
//
// 比較の順序(発注者指示 §10):
//   1 人間のケース別勝数 → 2 そのまま送れる返信数 → 3 不整合・捏造件数 → 4 fallback率
//   → 5 再生成率 → 6 p95 latency → 7 実費
// 価格だけで品質差を逆転させない。品質が実質同等なら低費用・低遅延を優先する。

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntry, parseArgs } from './lib/config.mjs';

const DIR = 'pricing_eval/runs/_summary';

/** A/B を実際のモデルへ戻す(対応表はここでだけ開く) */
export function resolveSides({ mapping, compare }) {
  const byNo = new Map(compare.cases.map((c, i) => [i + 1, c.id]));
  const byCaseId = new Map(mapping.cases.map((c) => [c.caseId, c]));
  return { sideOf: (no, side) => byCaseId.get(byNo.get(no))[side], caseIdOf: (no) => byNo.get(no) };
}

/** 人間評価をモデル別に畳む */
export function foldHuman({ human, sideOf }) {
  const perModel = {};
  const bump = (m) => (perModel[m] = perModel[m] || { wins: 0, send: 0, fake: 0, stiff: 0, offtopic: 0, clean: 0, rates: [], replies: 0 });
  for (const r of human.replies) {
    const m = sideOf(r.no, r.side);
    const p = perModel[m] || bump(m);
    p.replies++;
    if (r.flags.includes('send')) p.send++;
    if (r.flags.includes('fake')) p.fake++;
    if (r.flags.includes('stiff')) p.stiff++;
    if (r.flags.includes('offtopic')) p.offtopic++;
    if (r.flags.length === 0) p.clean++;
    if (typeof r.rate === 'number') p.rates.push(r.rate);
  }
  const verdicts = { draw: 0, none: 0 };
  for (const v of human.caseVerdicts) {
    if (v.winner === 'A' || v.winner === 'B') { const m = sideOf(v.no, v.winner); bump(m); perModel[m].wins++; }
    else verdicts[v.winner]++;
  }
  for (const p of Object.values(perModel)) {
    p.rateMean = p.rates.length ? p.rates.reduce((s, x) => s + x, 0) / p.rates.length : null;
    p.sendRate = p.replies ? p.send / p.replies : null;
  }
  return { perModel, draws: verdicts.draw, bothBad: verdicts.none };
}

/** §10 の順で勝敗を決める。差が無い項目は次の項目へ送る */
export function rankModels({ human, auto }) {
  const ids = Object.keys(human.perModel);
  const steps = [
    ['1 人間のケース別勝数', (m) => human.perModel[m].wins, 'desc'],
    ['2 そのまま送れる返信数', (m) => human.perModel[m].send, 'desc'],
    ['3 不整合・捏造の指摘件数', (m) => human.perModel[m].fake + human.perModel[m].offtopic, 'asc'],
    ['4 fallback 率', (m) => auto[m].fallbackReplyRate, 'asc'],
    ['5 再生成率', (m) => auto[m].regenerationRate, 'asc'],
    ['6 p95 latency', (m) => auto[m].latencyP95, 'asc'],
    ['7 実費', (m) => auto[m].costUsd, 'asc'],
  ];
  const trail = [];
  let winner = null;
  for (const [label, get, dir] of steps) {
    const vals = ids.map((m) => [m, get(m)]);
    const sorted = [...vals].sort((a, b) => (dir === 'desc' ? b[1] - a[1] : a[1] - b[1]));
    const decided = sorted[0][1] !== sorted[1][1];
    trail.push({ step: label, values: Object.fromEntries(vals), decided, leader: decided ? sorted[0][0] : null });
    if (decided && !winner) winner = sorted[0][0];
    if (winner) break;
  }
  return { winner, trail };
}

if (isCliEntry(import.meta.url)) {
  const args = parseArgs();
  const exp = String(args.experiment || 'cmp20260902b');
  const compare = JSON.parse(readFileSync(join(DIR, `compare_${exp}.json`), 'utf8'));
  const mapping = JSON.parse(readFileSync(join(DIR, `blind_mapping_${exp}.json`), 'utf8'));
  // 人間評価は runs/(gitignore)ではなく fixtures/ の写しを正本にする(消えると再現できないため)
  const humanPath = existsSync(join('pricing_eval/fixtures', `human_blind_results_${exp}.json`))
    ? join('pricing_eval/fixtures', `human_blind_results_${exp}.json`)
    : join(DIR, `human_blind_results_${exp}.json`);
  const human = JSON.parse(readFileSync(humanPath, 'utf8'));
  const { sideOf, caseIdOf } = resolveSides({ mapping, compare });
  const folded = foldHuman({ human, sideOf });
  const auto = Object.fromEntries(compare.summaries.map((s) => [s.modelId, s]));

  console.log(`# ブラインド評価の集計(${exp})`);
  console.log(`ケース判定: ${Object.entries(folded.perModel).map(([m, p]) => `${m} 勝ち ${p.wins}`).join(' / ')} / 引き分け ${folded.draws} / 両方だめ ${folded.bothBad}`);
  console.log('');
  console.log('モデル | 勝ち | 送れる/30 | 作り話 | 不自然 | 噛み合わない | 指摘なし | 続く度平均 | fallback | 再生成 | p95 | 実費');
  for (const [m, p] of Object.entries(folded.perModel)) {
    const a = auto[m];
    console.log([m, p.wins, `${p.send}/${p.replies}`, p.fake, p.stiff, p.offtopic, p.clean,
      p.rateMean == null ? '-' : p.rateMean.toFixed(2),
      `${(a.fallbackReplyRate * 100).toFixed(1)}%`, `${(a.regenerationRate * 100).toFixed(0)}%`,
      `${a.latencyP95}ms`, `$${a.costUsd.toFixed(5)}`].join(' | '));
  }
  const rank = rankModels({ human: folded, auto });
  console.log('');
  console.log('§10 の順で比較:');
  for (const t of rank.trail) console.log(`  ${t.step}: ${JSON.stringify(t.values)} → ${t.decided ? `${t.leader} が上` : '差なし(次へ)'}`);
  console.log(`\n機械的な順位づけの結果: ${rank.winner ?? '決まらない'}`);
  console.log('※ これは順位づけであって採用決定ではない(採用は人間が決める)');

  console.log('\nケース別(人間の判定 → 実際のモデル):');
  for (const v of human.caseVerdicts) {
    const w = v.winner === 'A' || v.winner === 'B' ? sideOf(v.no, v.winner) : v.winner === 'draw' ? '引き分け' : '両方だめ';
    console.log(`  ${String(v.no).padStart(2)}. ${caseIdOf(v.no)}: ${w}${v.note ? ` / ${v.note.slice(0, 60)}` : ''}`);
  }
}
