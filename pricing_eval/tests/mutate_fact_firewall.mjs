// 変異検証(本物の変異): 事実ファイアウォール/候補選抜/会計突合/費用見積りの**ソースを1箇所ずつ実際に壊し**、
// fact_firewall_tests.mjs が落ちることを確かめる。落ちなければ「検査していない規則」なので MISSED として報告する。
//
// 実行: node pricing_eval/tests/mutate_fact_firewall.mjs
//   - 対象ツリー(reply-ai-app/src/lib と pricing_eval/src)を一時ディレクトリへ**同じ相対配置で**複製し、複製側だけを壊す
//     (作業ツリーのソースは触らない。相対 import が壊れないよう配置を保つ)
//   - 変異の元文字列が1箇所に存在することを毎回確認する(無言で何も壊さない変異を防ぐ)
//   - モデル呼び出し・台帳・cases.json には一切触れない(複製先を読むだけ。データは実リポジトリを読み取り専用で参照)

import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const MIRROR_DIRS = ['reply-ai-app/src/lib', 'pricing_eval/src'];
const LIB = 'reply-ai-app/src/lib';
const EVAL = 'pricing_eval/src';
const SUITE = 'pricing_eval/tests/fact_firewall_tests.mjs';

const MUTATIONS = [
  // --- 事実ファイアウォール(初版) ---
  ['プレースホルダ「相手さん」を外す', `${LIB}/fact_firewall.mjs`, "|相手さん|お相手さん", ''],
  ['質問文の除外を無効化(相手への質問を自分の事実にする)', `${LIB}/fact_firewall.mjs`, 'if (clause.isQuestion) continue;        // 質問は自分の事実ではない', 'if (false) continue;'],
  ['相手への帰属の除外を無効化', `${LIB}/fact_firewall.mjs`, 'if (isAttributedToPartner(c)) continue; // 相手のことは自分の事実ではない', 'if (false) continue;'],
  ['過去体験の語幹から「行っ」を外す', `${LIB}/fact_firewall.mjs`, '/(?:行っ|来|寄っ|訪れ|泊まっ|食べ', '/(?:来|寄っ|訪れ|泊まっ|食べ'],
  ['過去体験のます形(行きました等)を外す', `${LIB}/fact_firewall.mjs`, '|(?:行き|来|寄り|訪れ|泊まり|食べ|飲み|読み|観|見|買い|作り|通い|回り|開拓し|参加し|体験し|経験し|履き|着|使い|住み|やり)ました(?!ら)', ''],
  ['習慣の「週1」を外す', `${LIB}/fact_firewall.mjs`, '/週[0-9０-９一二三四五]|', '/'],
  ['好みの「〜派」を外す', `${LIB}/fact_firewall.mjs`, '/派(?:です|だ|な(?:ん|の)|かな|で[、。]|$)|', '/'],
  ['「自分は〜だけ/ばっかり」の経歴断定を外す', `${LIB}/fact_firewall.mjs`, '(?:だけ(?:です|な(?:ん|の)|で)|ばっか(?:り|りです)|ばかりです|中心です)', '(?!)'],
  ['固有名詞の個人史を hard から soft へ下げる', `${LIB}/fact_firewall.mjs`, "level: 'hard_reject', token: tok, detail: `入力に無い固有名詞を自分の事実として断定", "level: 'soft_risk', token: tok, detail: `入力に無い固有名詞を自分の事実として断定"],
  ['根拠照合を常に真にする(何でも根拠ありにする)', `${LIB}/fact_firewall.mjs`, 'if (c.includes(tok)) return true;', 'return true;'],
  ['自分情報との矛盾検出を無効化', `${LIB}/fact_firewall.mjs`, 'if (mp === fp || out.some', 'if (true || out.some'],
  ['自動送信・操作の検出を無効化', `${LIB}/fact_firewall.mjs`, 'export const MANIPULATION_RE = /自動(?:で|的に)?(?:送信|返信|送っ)|代わりに送(?:り|っ)|勝手に送|既読(?:を)?つけ(?:ず|ない)|相手を(?:焦らせ|試す|煽)|わざと(?:既読|未読|返さ)|返信を予約/;', 'export const MANIPULATION_RE = /(?!)/;'],
  ['節の分割から空白を外す(「〜です笑 相手さんは〜」を1節にする)', `${LIB}/fact_firewall.mjs`, '[。．！!？?、，\\n\\s]', '[。．！!？?、，\\n]'],

  // --- §1 否定形の個人事実 / §2 謙遜 / §3 日常行動(2026-09-01 FIX_REQUIRED) ---
  ['否定形を一律 ok へ戻す(「行ったことない」を通す)', `${LIB}/fact_firewall.mjs`, 'const negated = isNegated(c, m.index + m[0].length);', 'const negated = isNegated(c, m.index + m[0].length); if (negated) continue;'],
  ['「行ったことない」だけ通す(1表現だけの抜け道を作る)', `${LIB}/fact_firewall.mjs`, '    for (const [code, re] of HARD_PATTERNS) {', '    for (const [code, re] of HARD_PATTERNS) { if (/行ったこと(?:が)?な/.test(c)) continue;'],
  ['「持っていない」を所有の事実から外す', `${LIB}/fact_firewall.mjs`, '持って(?:る|ます|い(?:る|ます|ない|ません)|ない|ませ)', '持って(?:る|ます|います)'],
  ['謙遜(「詳しくない」)を soft から ok へ下げる', `${LIB}/fact_firewall.mjs`, "found.push({ code: 'modesty_claim', level: 'soft_risk'", "if (false) found.push({ code: 'modesty_claim', level: 'soft_risk'"],
  ['謙遜の判定を広げて「詳しく知りたい」まで止める', `${LIB}/fact_firewall.mjs`, '詳しく(?:な(?:い|く|かっ)|ありませ|なさ)', '詳しく'],
  ['日常行動の捏造を hard から soft へ戻す', `${LIB}/fact_firewall.mjs`, "found.push({ code: 'daily_action_claim', level: 'hard_reject'", "found.push({ code: 'daily_action_claim', level: 'soft_risk'"],
  ['日常行動の検出語から「洗濯・料理・買い物」を外す', `${LIB}/fact_firewall.mjs`, '/洗濯|掃除|皿洗い|洗い物|片付け|料理|自炊|買い物|買い出し|仕事', '/掃除|皿洗い|洗い物|片付け|自炊|買い出し|仕事'],
  ['疑問文の印を付けない(相手への質問を自己行動として誤停止させる)', `${LIB}/fact_firewall.mjs`, "const isQ = ch === '?';", 'const isQ = false;'],

  // --- 候補選抜(初版) ---
  ['最終案を2件にする', `${LIB}/candidate_select.mjs`, 'export const FINAL_COUNT = 3;', 'export const FINAL_COUNT = 2;'],
  ['hard reject の候補を選抜対象に混ぜる', `${LIB}/candidate_select.mjs`, 'const valid = results.filter((r) => r.ok);', 'const valid = results;'],
  ['fallback を非決定的にする', `${LIB}/candidate_select.mjs`, 'const start = stableHash(`${idempotencyKey}|${lane}`) % pool.length;', 'const start = Math.floor(Math.random() * pool.length);'],
  ['存在しない fact ID の検査を無効化', `${LIB}/candidate_select.mjs`, "if (!all) { hard('unknown_fact_id'", "if (false) { hard('unknown_fact_id'"],
  ['無効化済み fact ID の検査を無効化', `${LIB}/candidate_select.mjs`, "if (all.enabledForRequest !== true) { hard('disabled_fact_id'", "if (false) { hard('disabled_fact_id'"],
  ['別リクエストの fact ID の検査を無効化', `${LIB}/candidate_select.mjs`, "if (foreign.has(id)) { hard('foreign_fact_id'", "if (false) { hard('foreign_fact_id'"],
  ['interest_level の混入検査を無効化', `${LIB}/candidate_select.mjs`, "if (Object.prototype.hasOwnProperty.call(cand, 'interest_level'))", 'if (false)'],
  ['類似候補の除外を無効化', `${LIB}/candidate_select.mjs`, 'export const SIMILARITY_LIMIT = 0.72;', 'export const SIMILARITY_LIMIT = 1.1;'],
  // 注: 「全案が質問」は deriveLane の構造上(質問文は expand へ回り reaction 枠には入らない)到達しないため、
  // 代わりに lane 導出そのものを壊す変異で選抜の骨格を検査する(全案質問の防御は多重防御として残す)
  ['lane 導出を常に expand にする', `${LIB}/candidate_select.mjs`, "  if (hasQuestion) return 'expand';", "  if (true) return 'expand';"],
  ['fallback テンプレートに個人事実を混ぜる', `${LIB}/candidate_select.mjs`, "'いいなあ、なんか楽しそう',", "'先週行ってきたんですけど、めっちゃ良かったです',"],

  // --- §4 soft_risk の選抜規則 / §5 集計指標(2026-09-01 FIX_REQUIRED) ---
  ['soft_risk を3件とも最終採用できるようにする', `${LIB}/candidate_select.mjs`, 'export const MAX_SOFT_RISK_IN_FINAL = 1;', 'export const MAX_SOFT_RISK_IN_FINAL = 3;'],
  ['ok 候補があるのに fallback を優先する', `${LIB}/candidate_select.mjs`, 'const chosen = pool.find((r) => (r.verdict === \'ok\' || softUsed < MAX_SOFT_RISK_IN_FINAL) && fits(r, picks));', 'const chosen = undefined;'],
  ['soft_risk を ok より優先して選ぶ', `${LIB}/candidate_select.mjs`, "pool.sort((a, b) => (a.verdict === b.verdict ? a.index - b.index : a.verdict === 'ok' ? -1 : 1));", "pool.sort((a, b) => (a.verdict === b.verdict ? a.index - b.index : a.verdict === 'ok' ? 1 : -1));"],
  ['再生成を2回追加して3呼び出しにできるようにする', `${LIB}/candidate_select.mjs`, 'export const MAX_GENERATION_PASSES = 2;', 'export const MAX_GENERATION_PASSES = 3;'],
  ['率の分母を返信数から候補数へ取り違える', `${LIB}/candidate_select.mjs`, 'fallbackReplyRate: rate(selectedFallbackCount, finalReplyCount),', 'fallbackReplyRate: rate(selectedFallbackCount, sum((x) => x.stats?.generatedCandidateCount)),'],
  ['分母0のとき null ではなく 0 を返す(0除算を隠す)', `${LIB}/candidate_select.mjs`, 'const rate = (num, den) => (den > 0 ? num / den : null);', 'const rate = (num, den) => (den > 0 ? num / den : 0);'],

  // --- §6 会計差額の突合 / §7 次回費用の見積り ---
  ['会計差額から一部の run を除外する', `${EVAL}/reconcile_spend.mjs`, '    picked.push(r);\n    acc += r.usageCostUsd;', "    if (r.runId.endsWith('_r3')) continue;\n    picked.push(r);\n    acc += r.usageCostUsd;"],
  ['台帳側の費用を数えない(成果物だけで突合する)', `${EVAL}/reconcile_spend.mjs`, 'rec.usageCostUsd += r.costUsd;', 'rec.usageCostUsd += 0;'],
  ['入力単価と出力単価を同一単価として計算する', `${EVAL}/estimate_next_run.mjs`, 'const outputCostUsd = (outputTokens6Candidates / 1e6) * price.outputPerMTokUsd;', 'const outputCostUsd = (outputTokens6Candidates / 1e6) * price.inputPerMTokUsd;'],
  ['価格不明モデルを 0 円扱いにする', `${EVAL}/estimate_next_run.mjs`, "return { estimable: false, reason: `見積不能: ${missing.join(' / ')}`, oneCallCostUsd: null, worstCase10Usd: null };", "return { estimable: false, reason: `見積不能: ${missing.join(' / ')}`, oneCallCostUsd: 0, worstCase10Usd: 0 };"],
  ['worst-case の再生成係数を1にする(再生成ぶんを見ない)', `${EVAL}/estimate_next_run.mjs`, 'export const REGENERATION_FACTOR = 2;', 'export const REGENERATION_FACTOR = 1;'],
  ['6候補の出力トークンを3案ぶんのまま見積もる', `${EVAL}/estimate_next_run.mjs`, 'export const CANDIDATE_OUTPUT_MULTIPLIER = 2;', 'export const CANDIDATE_OUTPUT_MULTIPLIER = 1;'],
];

let caught = 0; const missed = [];
for (const [name, relPath, from, to] of MUTATIONS) {
  const root = mkdtempSync(join(tmpdir(), 'replier-mutate-'));
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
      execFileSync(process.execPath, [SUITE], {
        env: { ...process.env, FF_LIB_DIR: join(root, LIB), FF_EVAL_SRC_DIR: join(root, EVAL) },
        stdio: 'pipe',
      });
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
