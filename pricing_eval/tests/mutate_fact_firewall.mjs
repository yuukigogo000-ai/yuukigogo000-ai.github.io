// 変異検証(本物の変異): 事実ファイアウォール/候補選抜の**ソースを1箇所ずつ実際に壊し**、
// fact_firewall_tests.mjs が落ちることを確かめる。落ちなければ「検査していない規則」なので MISSED として報告する。
//
// 実行: node pricing_eval/tests/mutate_fact_firewall.mjs
//   - lib を一時ディレクトリへ複製し、複製側だけを壊す(作業ツリーのソースは触らない)
//   - 変異の元文字列が1箇所に存在することを毎回確認する(無言で何も壊さない変異を防ぐ)
//   - モデル呼び出し・台帳・cases.json には一切触れない

import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC_LIB = 'reply-ai-app/src/lib';
const SUITE = 'pricing_eval/tests/fact_firewall_tests.mjs';

const MUTATIONS = [
  // --- 事実ファイアウォール ---
  ['プレースホルダ「相手さん」を外す', 'fact_firewall.mjs', "|相手さん|お相手さん", ''],
  ['否定の判定を無効化(「行ったことない」を捏造扱いにする)', 'fact_firewall.mjs', 'if (isNegated(c, m.index + m[0].length)) continue;', 'if (false) continue;'],
  ['質問文の除外を無効化(相手への質問を自分の事実にする)', 'fact_firewall.mjs', 'if (clause.isQuestion) continue;        // 質問は自分の事実ではない', 'if (false) continue;'],
  ['相手への帰属の除外を無効化', 'fact_firewall.mjs', 'if (isAttributedToPartner(c)) continue; // 相手のことは自分の事実ではない', 'if (false) continue;'],
  ['過去体験の語幹から「行っ」を外す', 'fact_firewall.mjs', '/(?:行っ|来|寄っ|訪れ|泊まっ|食べ', '/(?:来|寄っ|訪れ|泊まっ|食べ'],
  ['過去体験のます形(行きました等)を外す', 'fact_firewall.mjs', '|(?:行き|来|寄り|訪れ|泊まり|食べ|飲み|読み|観|見|買い|作り|通い|回り|開拓し|参加し|体験し|履き|着|使い|住み|やり)ました(?!ら)', ''],
  ['習慣の「週1」を外す', 'fact_firewall.mjs', '/週[0-9０-９一二三四五]|', '/'],
  ['好みの「〜派」を外す', 'fact_firewall.mjs', '/派(?:です|だ|な(?:ん|の)|かな|で[、。]|$)|', '/'],
  ['「自分は〜だけ/ばっかり」の経歴断定を外す', 'fact_firewall.mjs', '(?:だけ(?:です|な(?:ん|の)|で)|ばっか(?:り|りです)|ばかりです|中心です)', '(?!)'],
  ['固有名詞の個人史を hard から soft へ下げる', 'fact_firewall.mjs', "level: 'hard_reject', token: tok, detail: `入力に無い固有名詞を自分の事実として断定", "level: 'soft_risk', token: tok, detail: `入力に無い固有名詞を自分の事実として断定"],
  ['根拠照合を常に真にする(何でも根拠ありにする)', 'fact_firewall.mjs', 'if (c.includes(tok)) return true;', 'return true;'],
  ['自分情報との矛盾検出を無効化', 'fact_firewall.mjs', 'if (mp === fp || out.some', 'if (true || out.some'],
  ['自動送信・操作の検出を無効化', 'fact_firewall.mjs', 'export const MANIPULATION_RE = /自動(?:で|的に)?(?:送信|返信|送っ)|代わりに送(?:り|っ)|勝手に送|既読(?:を)?つけ(?:ず|ない)|相手を(?:焦らせ|試す|煽)|わざと(?:既読|未読|返さ)|返信を予約/;', 'export const MANIPULATION_RE = /(?!)/;'],
  ['節の分割から空白を外す(「〜です笑 相手さんは〜」を1節にする)', 'fact_firewall.mjs', '[。．！!？?、，\\n\\s]', '[。．！!？?、，\\n]'],

  // --- 2026-09-02 の実測で見逃した型 ---
  ['「ハマってる」を好みの断定から外す', 'fact_firewall.mjs', '|ハマ(?:って|り(?:ま|に))', ''],
  ['主語つきの好み申告(「私は最近は〜がいいかも」)の検出を外す', 'fact_firewall.mjs', "  ['self_preference_claim',", "  ['self_preference_claim_disabled', /(?!)/], ['unused_self_preference',"],
  ['体験前提の助言(「〜のがおすすめです」)の検出を外す', 'fact_firewall.mjs', "  ['experience_based_advice',", "  ['experience_based_advice_disabled', /(?!)/], ['unused_advice',"],
  ['『』で囲んだ作品名を固有名詞として拾わない', 'fact_firewall.mjs', '  for (const q of findQuotedTitles(text)) if (!groundingText.includes(q)) tokens.add(q);', ''],
  ['日本語の壊れの検査を無効化する', 'fact_firewall.mjs', '  reasons.push(...findTextGlitches(t));', ''],
  ['日本語の壊れを hard へ上げる(人間確認に回さず落とす)', 'fact_firewall.mjs', "out.push({ code, level: 'soft_risk', detail: `日本語が壊れて見える", "out.push({ code, level: 'hard_reject', detail: `日本語が壊れて見える"],
  ['誤字検査の対象を広げて普通の日本語まで止める', 'fact_firewall.mjs', "  ['broken_conjugation', /っ[たた]く(?:な|て)/],", "  ['broken_conjugation', /た(?:く|かっ)/],"],

  ['登録した事実の否定(矛盾)の検出を無効化', 'fact_firewall.mjs', '  reasons.push(...findFactNegationConflicts(t, ctx.allFactTexts || ctx.enabledFactTexts || []));', ''],
  ['矛盾検出を事実が否定形でも動かす(誤検知させる)', 'fact_firewall.mjs', 'if (!FACT_POSITIVE_RE.test(fact) || FACT_NEGATIVE_RE.test(fact)) continue;', 'if (false) continue;'],

  // --- 候補選抜 ---
  ['最終案を2件にする', 'candidate_select.mjs', 'export const FINAL_COUNT = 3;', 'export const FINAL_COUNT = 2;'],
  ['hard reject の候補を選抜対象に混ぜる', 'candidate_select.mjs', 'const valid = results.filter((r) => r.ok);', 'const valid = results;'],
  ['fallback を非決定的にする', 'candidate_select.mjs', 'const start = stableHash(`${idempotencyKey}|${lane}`) % pool.length;', 'const start = Math.floor(Math.random() * pool.length);'],
  ['存在しない fact ID の検査を無効化', 'candidate_select.mjs', "if (!all) { hard('unknown_fact_id'", "if (false) { hard('unknown_fact_id'"],
  ['無効化済み fact ID の検査を無効化', 'candidate_select.mjs', "if (all.enabledForRequest !== true) { hard('disabled_fact_id'", "if (false) { hard('disabled_fact_id'"],
  ['別リクエストの fact ID の検査を無効化', 'candidate_select.mjs', "if (foreign.has(id)) { hard('foreign_fact_id'", "if (false) { hard('foreign_fact_id'"],
  ['interest_level の混入検査を無効化', 'candidate_select.mjs', "if (Object.prototype.hasOwnProperty.call(cand, 'interest_level'))", 'if (false)'],
  ['類似候補の除外を無効化', 'candidate_select.mjs', 'export const SIMILARITY_LIMIT = 0.72;', 'export const SIMILARITY_LIMIT = 1.1;'],
  // 注: 「全案が質問」は deriveLane の構造上(質問文は expand へ回り reaction 枠には入らない)到達しないため、
  // 代わりに lane 導出そのものを壊す変異で選抜の骨格を検査する(全案質問の防御は多重防御として残す)
  ['lane 導出を常に expand にする', 'candidate_select.mjs', "  if (hasQuestion) return 'expand';", "  if (true) return 'expand';"],
  ['fallback テンプレートに個人事実を混ぜる', 'candidate_select.mjs', "'いいなあ、なんか楽しそう',", "'先週行ってきたんですけど、めっちゃ良かったです',"],
];

let caught = 0; const missed = [];
for (const [name, file, from, to] of MUTATIONS) {
  const dir = mkdtempSync(join(tmpdir(), 'replier-mutate-'));
  try {
    cpSync(SRC_LIB, dir, { recursive: true });
    const target = join(dir, file);
    const src = readFileSync(target, 'utf8');
    const n = src.split(from).length - 1;
    if (n !== 1) { missed.push(`${name}(変異の元文字列が ${n} 箇所・変異が成立していない)`); continue; }
    writeFileSync(target, src.replace(from, to));
    let failed = false;
    try {
      execFileSync(process.execPath, [SUITE], { env: { ...process.env, FF_LIB_DIR: dir }, stdio: 'pipe' });
    } catch { failed = true; }
    if (failed) { caught++; console.log(`  ✅ CAUGHT  ${name}`); }
    else { missed.push(name); console.log(`  ❌ MISSED  ${name}`); }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n${missed.length === 0 ? '✅' : '❌'} 変異 ${MUTATIONS.length} 件中 ${caught} 件を検出`);
if (missed.length) console.log(`検出できなかった変異(= その規則を検査していない):\n - ${missed.join('\n - ')}`);
process.exit(missed.length === 0 ? 0 : 1);
