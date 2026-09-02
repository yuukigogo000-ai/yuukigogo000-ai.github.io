// 保存済みの候補(rawCandidates)から、最終3案を今の検査器で選び直す。**モデルは呼ばない。**
//
// run のときの検査器では通っていた候補が、その後の修正で hard になることがある。
// 人間確認には「今のシステムなら何を出すか」を見せたいので、候補はそのままに選抜だけやり直す。
//
// 使い方: node pricing_eval/src/reselect_finals.mjs --experiment=cmp20260902c

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntry, parseArgs } from './lib/config.mjs';
import { finalizeReplies, CANDIDATE_COUNT } from '../../reply-ai-app/src/lib/candidate_select.mjs';
import { contextFor } from './compare_candidates_eval.mjs';

const DIR = 'pricing_eval/runs/_summary';

/** 保存された平坦な候補列を、生成パスごとに戻す(6件ずつ) */
export function splitPasses(rawCandidates) {
  const out = [];
  for (let i = 0; i < rawCandidates.length; i += CANDIDATE_COUNT) out.push(rawCandidates.slice(i, i + CANDIDATE_COUNT));
  return out.filter((p) => p.length);
}

/** 1行ぶんを選び直す */
export function reselectRow(row, ctx) {
  const passes = splitPasses(row.rawCandidates || []);
  if (!passes.length) return null;
  const final = finalizeReplies({ firstPass: passes[0], secondPass: passes[1] ?? null, ctx });
  return {
    replies: final.replies,
    picked: final.picked.map((p) => ({ lane: p.lane, source: p.source, verdict: p.verdict, text: p.text })),
    fallbackCount: final.picked.filter((p) => p.source === 'fallback').length,
    softRiskCount: final.picked.filter((p) => p.verdict === 'soft_risk').length,
    changed: JSON.stringify(final.replies) !== JSON.stringify(row.replies),
  };
}

if (isCliEntry(import.meta.url)) {
  const args = parseArgs();
  const exp = String(args.experiment || 'cmp20260902c');
  const compare = JSON.parse(readFileSync(join(DIR, `compare_${exp}.json`), 'utf8'));
  const facts = compare.config?.selfFacts?.path && existsSync(compare.config.selfFacts.path)
    ? JSON.parse(readFileSync(compare.config.selfFacts.path, 'utf8')).byCase || {}
    : {};
  const cases = JSON.parse(readFileSync(compare.dataset.path, 'utf8')).cases;
  const byId = new Map(cases.map((c) => [c.id, c]));

  const out = { ...compare, reselectedAt: new Date().toISOString(), reselectNote: '候補は run のまま。最終3案の選抜だけ、その後に直した検査器でやり直した(モデル呼び出しゼロ)' };
  const repliesByModel = {};
  let changed = 0; let total = 0; const diffs = [];
  for (const m of Object.keys(compare.repliesByModel)) {
    const runId = compare.runIds[m];
    const rows = readFileSync(join('pricing_eval/runs', runId, 'results.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    repliesByModel[m] = {};
    for (const row of rows) {
      if (!row.success) continue;
      const enabled = (facts[row.caseId] || []).map((f) => ({ ...f, enabledForRequest: true, source: 'explicit' }));
      const ctx = contextFor(byId.get(row.caseId), compare.experimentId, enabled);
      const r = reselectRow(row, ctx);
      if (!r) continue;
      total++;
      repliesByModel[m][row.caseId] = r.replies;
      if (r.changed) {
        changed++;
        diffs.push({ modelId: m, caseId: row.caseId, before: row.replies, after: r.replies, fallbackBefore: row.final.fallbackCount, fallbackAfter: r.fallbackCount });
      }
    }
  }
  out.repliesByModel = repliesByModel;
  out.reselect = { total, changed, diffs };
  writeFileSync(join(DIR, `compare_${exp}_reselected.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(`選び直し: ${total} 件中 ${changed} 件が変わった`);
  for (const d of diffs) {
    console.log(`  ${d.modelId.split('.')[0]} / ${d.caseId}(fallback ${d.fallbackBefore}→${d.fallbackAfter})`);
    d.before.forEach((b, i) => { if (b !== d.after[i]) console.log(`    - 前: ${b}\n    + 後: ${d.after[i]}`); });
  }
  console.log(`書き出し: ${join(DIR, `compare_${exp}_reselected.json`)}`);
}
