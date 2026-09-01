// 比較ハーネスの変異検証(§11)。**ソースを1箇所ずつ実際に壊し**、compare_harness_tests.mjs が落ちることを確かめる。
//
// 実行: node pricing_eval/tests/mutate_compare_harness.mjs
//   - 対象ツリーを一時ディレクトリへ**同じ相対配置で**複製し、複製側だけを壊す(作業ツリーは触らない)
//   - 変異の元文字列が1箇所に存在することを毎回確認する(何も壊さない変異=常に緑、を防ぐ)
//   - **実モデルは呼ばない**(テストは偽クライアント)

import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const MIRROR_DIRS = ['reply-ai-app/src/lib', 'pricing_eval/src'];
const EVAL = 'pricing_eval/src';
const SUITE = 'pricing_eval/tests/compare_harness_tests.mjs';
const H = `${EVAL}/lib/compare_harness.mjs`;
const BP = `${EVAL}/blind_compare_page.mjs`;

const MUTATIONS = [
  // §11 の指定分
  ['① 2モデルで別々の dataset を使う(指紋から dataset を外す)', H,
    "return [datasetHash, caseId, promptHash, schemaHash,", 'return [caseId, promptHash, schemaHash,'],
  ['② 片方だけ temperature を変えられるようにする(指紋から temperature を外す)', H,
    "imageHashes.join('+'), String(temperature),", "imageHashes.join('+'),"],
  ['③ 片方だけ max token を変えられるようにする(指紋から外す)', H,
    "String(outputMaxTokens), detectorHash].join('|')", "detectorHash].join('|')"],
  ['④ 片方だけ検出器を緩められるようにする(指紋から検出器を外す)', H,
    ", detectorHash].join('|')", "].join('|')"],
  ['⑤ ブラインドページにモデル名を出す', BP,
    '<div class="col"><h4>${label}</h4>', '<div class="col"><h4>${label} (${modelId})</h4>'],
  ['⑥ A を常に同じモデルにする', BP,
    'const first = (stableHash(seed) + i) % 2 === 0;', 'const first = true;'],
  ['⑦ raw の hard reject を最終3案へ混入させる', H,
    'const trial = finalizeReplies({ firstPass: passes[0], secondPass: passes[1] ?? null, ctx });',
    "const trial = { replies: passes.flat().slice(0, 3).map((x) => x.text), picked: passes.flat().slice(0, 3).map((x) => ({ lane: x.lane, source: 'model', verdict: 'hard_reject', text: x.text })), needsRegeneration: false };"],
  ['⑧ fallback をモデル生成の成功として数える', H,
    'modelReplyCount: modelReplies,', 'modelReplyCount: replies,'],
  ['⑨ 片方のモデルの費用を合計から除外する', H,
    'return summaries.reduce((s, x) => s + x.costUsd, 0);', 'return summaries.slice(0, 1).reduce((s, x) => s + x.costUsd, 0);'],
  ['⑩ 3回目の呼び出しを許す(attempt 上限を 3 にする)', H,
    'export const MAX_ATTEMPTS_PER_CASE = 2;', 'export const MAX_ATTEMPTS_PER_CASE = 3;'],
  ['⑪ 並列実行できるようにする(計画を並列グループにする)', H,
    'for (const modelId of order) plan.push({ caseNo, caseId, modelId });',
    'plan.push(order.map((modelId) => ({ caseNo, caseId, modelId })));'],
  ['⑫ 一方の AccessDenied で他方の結果まで消す', H,
    'const next = { ...state, stopped: new Set(state.stopped), rows: { ...state.rows } };',
    'const next = { ...state, stopped: new Set(state.stopped), rows: Object.fromEntries(Object.keys(state.rows).map((k) => [k, []])) };'],
  ['⑬ 共通安全条件の違反でも他方を継続する', H,
    'for (const id of Object.keys(next.rows)) next.stopped.add(id);', 'next.stopped.add(modelId);'],
  ['⑭ 失敗した呼び出しの STARTED を台帳へ残さない', H,
    'const callId = ledger.started({ runId, caseId: caseObj.id, modelId: model.modelId, attemptNo, worstCaseUsd });',
    'let callId = null;'],
  ['⑮ UNKNOWN(費用不明)を 0 円扱いにする', H,
    'return Number(priorSpentUsd) + Number(unknownWorstCaseUsd);', 'return Number(priorSpentUsd);'],
  ['⑯ 人間確認の前に採用モデルを確定する', H,
    "  return { decided: false, model: null, reason: '自動では決めない(発注者がブラインド結果を返した後に人間が決定する)' };",
    "  return { decided: true, model: 'moonshotai.kimi-k2.5', reason: '自動で決めた' };"],

  ['㉑ finalizeReplies へ候補を渡さない(全部 fallback になる実害の型)', H,
    'const trial = finalizeReplies({ firstPass: passes[0], secondPass: passes[1] ?? null, ctx });',
    'const trial = finalizeReplies({ passes: [...passes], ctx });'],

  // 追加(費用計算と停止規則の骨格)
  ['⑰ 入力単価と出力単価を同一単価として計算する', H,
    'return (inputTokenCap / 1e6) * price.inputPerMTokUsd + (outputTokenCap / 1e6) * price.outputPerMTokUsd;',
    'return (inputTokenCap / 1e6) * price.inputPerMTokUsd + (outputTokenCap / 1e6) * price.inputPerMTokUsd;'],
  ['⑱ 価格不明を 0 円として見積もる', H,
    'if (!price || price.inputPerMTokUsd == null || price.outputPerMTokUsd == null) return null;',
    'if (!price || price.inputPerMTokUsd == null || price.outputPerMTokUsd == null) return 0;'],
  ['⑲ 未知の失敗を再試行扱いにする(安全側に倒さない)', H,
    "  return 'stop_model'; // 未知の失敗は安全側(そのモデルを止める)", "  return 'retry';"],
  ['⑳ worst-case から attempt 上限を外す(1回ぶんで見積もる)', H,
    'return cases * one * maxAttempts;', 'return cases * one;'],
];

let caught = 0; const missed = [];
for (const [name, relPath, from, to] of MUTATIONS) {
  const root = mkdtempSync(join(tmpdir(), 'replier-cmp-mutate-'));
  try {
    for (const d of MIRROR_DIRS) {
      mkdirSync(join(root, dirname(d)), { recursive: true });
      cpSync(d, join(root, d), { recursive: true });
    }
    const target = join(root, relPath);
    const src = readFileSync(target, 'utf8');
    const n = src.split(from).length - 1;
    if (n !== 1) { missed.push(`${name}(変異の元文字列が ${n} 箇所・変異が成立していない)`); console.log(`  ❌ MISSED  ${name}(元文字列 ${n} 箇所)`); continue; }
    writeFileSync(target, src.replace(from, to));
    let failed = false;
    try {
      execFileSync(process.execPath, [SUITE], { env: { ...process.env, CMP_SRC_DIR: join(root, EVAL) }, stdio: 'pipe' });
    } catch { failed = true; }
    if (failed) { caught++; console.log(`  ✅ CAUGHT  ${name}`); }
    else { missed.push(name); console.log(`  ❌ MISSED  ${name}`); }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(`\n${missed.length === 0 ? '✅' : '❌'} 変異 ${MUTATIONS.length} 件中 ${caught} 件を検出`);
if (missed.length) console.log(`検出できなかった変異(= その規則を検査していない):\n - ${missed.join('\n - ')}`);
process.exit(missed.length === 0 ? 0 : 1);
