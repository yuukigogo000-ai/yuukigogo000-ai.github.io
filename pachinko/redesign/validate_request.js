#!/usr/bin/env node
/**
 * CHATGPT_DESIGN_REQUEST 自己検証
 *  - 必須ファイルの存在
 *  - Function Truth カバレッジ(F-ID / S-ID / CAP の相互参照整合)
 *  - 現行ビジュアルの漏洩がないこと(スクリーンショット/CSS/色/構成語)
 *  - 必須コピーの同梱
 *  - バインディングの有効性
 * 使い方: node validate_request.js <requestDir>
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = process.argv[2] || path.join(__dirname, "request");
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  << " + detail : ""}`); }
};

const REQUIRED = [
  "PRODUCT_TRUTH.json", "FUNCTION_FREEZE.json", "SCREEN_STATE_INVENTORY.json",
  "REQUIRED_COPY.json", "TECHNICAL_CONSTRAINTS.json", "TRUST_AND_SAFETY_FACTS.json",
  "BLIND_DESIGN_BRIEF.md", "FUNCTION_PRESENCE_CONTRACT.json",
  "DESIGN_RETURN_SCHEMA.json", "DESIGN_RETURN_BINDING.json", "CHATGPT_INSTRUCTIONS.md",
];

console.log("=== 1. 必須ファイル ===");
const files = fs.readdirSync(DIR);
for (const f of REQUIRED) ok(`必須ファイル ${f}`, files.includes(f));
const extras = files.filter(f => !REQUIRED.includes(f));
ok("想定外ファイルなし", extras.length === 0, extras.join(","));

const read = f => fs.readFileSync(path.join(DIR, f), "utf8");
const json = f => JSON.parse(read(f));

console.log("=== 2. Visual Sanitization(現行UI漏洩の検査) ===");
// 画像・スタイルシートの同梱がないこと
const binary = files.filter(f => /\.(png|jpe?g|gif|webp|svg|bmp|pdf|css|scss)$/i.test(f));
ok("スクリーンショット/画像/スタイルシートの同梱なし", binary.length === 0, binary.join(","));

const LEAK_PATTERNS = [
  [/#[0-9a-fA-F]{3,8}\b/, "色コード"],
  [/\brgba?\s*\(/, "色関数"],
  [/\bhsla?\s*\(/, "色関数"],
  [/var\(--/, "CSS変数"],
  [/border-radius|box-shadow|font-family|linear-gradient|backdrop-filter|letter-spacing|line-height\s*:/, "CSSプロパティ"],
  [/\b(タブ|カード|ヒーロー|グリッド|サイドバー|モーダル|トースト|パネル|バナー)\b/, "構成要素語"],
  [/横並び|縦並び|左寄せ|右寄せ|中央揃え|上部に配置|直下に/, "配置指示"],
  [/ネオン|グラデーション|グラデ|角丸|ドロップシャドウ|ダークテーマ|ダークモード|レトロ調/, "装飾/雰囲気の形容"],
  [/\b(hero|card|tabbar|tab-bar|sidebar|modal|toast|navbar)\b/i, "構成要素語(英)"],
  [/現行(UI|デザイン|画面)|既存の見た目|今の配色/, "現行UIへの参照"],
];
// 技術制約として許可される寸法表現(対応幅・アイコン寸法)
const ALLOWED_NUMERIC = /(360|390|430|1080|192|512)\s*px/g;

let leaks = [];
for (const f of REQUIRED) {
  if (!files.includes(f)) continue;
  const body = read(f).replace(ALLOWED_NUMERIC, "");
  for (const [re, label] of LEAK_PATTERNS) {
    const m = body.match(re);
    if (m) leaks.push(`${f}: ${label} "${m[0]}"`);
  }
}
ok("視覚アンカーの漏洩なし", leaks.length === 0, leaks.slice(0, 5).join(" / "));

// px指定(許可された寸法以外)が残っていないこと
let pxLeaks = [];
for (const f of REQUIRED) {
  if (!files.includes(f)) continue;
  const body = read(f).replace(ALLOWED_NUMERIC, "");
  const m = body.match(/\b\d+\s*px\b/);
  if (m) pxLeaks.push(`${f}: ${m[0]}`);
}
ok("スタイル寸法(px)の指定なし", pxLeaks.length === 0, pxLeaks.join(" / "));

console.log("=== 3. Function Truth カバレッジ ===");
const ff = json("FUNCTION_FREEZE.json");
const inv = json("SCREEN_STATE_INVENTORY.json");
const pt = json("PRODUCT_TRUTH.json");
const fpc = json("FUNCTION_PRESENCE_CONTRACT.json");
const copy = json("REQUIRED_COPY.json");

const fids = ff.functions.map(f => f.id);
ok("F-IDが45件", fids.length === 45, String(fids.length));
ok("F-IDが一意", new Set(fids).size === fids.length);
ok("F-IDが連番 F-001..F-045", fids.every((id, i) => id === "F-" + String(i + 1).padStart(3, "0")));

const requiredFields = ["purpose", "source", "trigger", "input", "output", "state_dependencies", "visible_behavior", "test"];
const missingFields = ff.functions.filter(f => requiredFields.some(k => !f[k] || (Array.isArray(f[k]) && !f[k].length)));
ok("全F-IDに必須項目が揃っている", missingFields.length === 0, missingFields.map(f => f.id).join(","));

const sids = inv.states.map(s => s.id);
ok("S-IDが一意", new Set(sids).size === sids.length);
const baseStates = ["S-IDLE", "S-SELECTED", "S-PROCESSING", "S-RESULT", "S-SUCCESS", "S-WARNING", "S-DISABLED", "S-EMPTY", "S-DEAD"];
const missingBase = baseStates.filter(s => !sids.includes(s));
ok("基本状態(idle/選択/処理中/結果/成功/警告/実行不可/空/終局)を網羅", missingBase.length === 0, missingBase.join(","));

// F-ID の state_dependencies が S-ID に解決できる
const normalize = s => s.replace(/\(.*\)$/, "").trim();
const unresolved = [];
for (const f of ff.functions) {
  for (const s of f.state_dependencies) {
    if (!sids.includes(normalize(s))) unresolved.push(`${f.id}->${s}`);
  }
}
ok("F-IDの依存状態がすべてS-IDに解決できる", unresolved.length === 0, unresolved.join(","));

// screen が参照する F-ID がすべて実在
const badScreenFn = [];
for (const sc of inv.screens) {
  for (const fid of sc.functions) if (!fids.includes(fid)) badScreenFn.push(`${sc.id}->${fid}`);
  for (const sid of sc.states) if (!sids.includes(normalize(sid))) badScreenFn.push(`${sc.id}->${sid}`);
}
ok("画面文脈の参照するF-ID/S-IDがすべて実在", badScreenFn.length === 0, badScreenFn.join(","));

// すべての F-ID が少なくとも1つの screen から参照されている
const referenced = new Set(inv.screens.flatMap(s => s.functions));
const platformFns = new Set(ff.functions.filter(f => f.visual_presence === "platform").map(f => f.id));
const orphanF = fids.filter(id => !referenced.has(id) && !platformFns.has(id));
ok("すべてのF-IDがいずれかの文脈に紐づく(配布基盤レベルの機能を除く)", orphanF.length === 0, orphanF.join(","));
ok("配布基盤レベルの機能が明示されている", platformFns.size > 0 && !!ff.visual_presence_note);

// PRODUCT_TRUTH の capability が FUNCTION_PRESENCE_CONTRACT に存在
const ptCaps = [...pt.primary_capabilities, ...pt.secondary_capabilities].map(c => c.split(":")[0].trim());
const fpcCaps = fpc.capabilities.map(c => c.id);
const missingCaps = ptCaps.filter(c => !fpcCaps.includes(c));
ok("Product Truthの全能力が存在契約に定義されている", missingCaps.length === 0, missingCaps.join(","));
const importanceOk = fpc.capabilities.every(c => ["primary", "secondary", "tertiary"].includes(c.importance)
  && typeof c.recognizable_at_home === "boolean" && typeof c.required_at_task === "boolean" && typeof c.must_be_reachable === "boolean");
ok("存在契約の各能力に重要度と3つの存在要件がある", importanceOk);
ok("存在契約に表示方法の指定が含まれない",
  !JSON.stringify(fpc).match(/(上部|下部|一覧で|並べ|表示形式|レイアウト)/));

console.log("=== 4. 必須コピー ===");
const copyStr = JSON.stringify(copy);
const copyIds = copyStr.match(/"C-\d{3}"/g) || [];
ok("Copy IDが定義されている(30件以上)", copyIds.length >= 30, String(copyIds.length));
ok("製品名が literal で保持されている", /"text": "パチスロ帝国"[\s\S]{0,40}"role": "製品名"/.test(copyStr.replace(/\\n/g, "")) || copy.identity.some(c => c.literal && c.text === "パチスロ帝国"));
ok("機種名10件が同梱", copy.fixed_content_sets.machine_names.items.length === 10);
ok("実績15件が同梱", copy.fixed_content_sets.achievements.items.length === 15);
ok("イベント文の分量と最大長が明示されている",
  copy.fixed_content_sets.daily_event_messages.count === 130 && /29文字/.test(copy.fixed_content_sets.daily_event_messages.shape));
ok("主要アクションのコピーが含まれる", copyStr.includes("営業開始"));
ok("4つの機能領域名が含まれる", ["ホール", "新台購入", "経営", "帳簿"].every(t => copyStr.includes(t)));

console.log("=== 5. Trust & Safety ===");
const ts = json("TRUST_AND_SAFETY_FACTS.json");
ok("述べてよい事実が定義されている", ts.factual_claims_that_are_true_and_may_be_communicated.length >= 5);
ok("作ってはならない主張が定義されている", ts.claims_that_must_never_be_invented_or_implied.length >= 5);
const brief = read("BLIND_DESIGN_BRIEF.md");
ok("ブリーフが禁止クレームに言及している", /存在しない機能・保証|示唆してはならない/.test(brief));

console.log("=== 6. ブリーフの盲検性 ===");
ok("ブリーフに未定義事項(Design Decision)の一覧がある", /Design Authority が決定すべき事項/.test(brief));
const openItems = (brief.match(/^\d+\. /gm) || []).length;
ok("未定義事項が14件列挙されている", /14\. アプリアイコン/.test(brief), String(openItems));
ok("ブリーフに現行UIを渡していない旨が明記されている", /意図的に含めていない|意図的に除外/.test(brief));
ok("ブリーフに構成の指示が含まれない", !/配置してください|並べてください|使ってください(?!。)/.test(brief));

console.log("=== 7. バインディング ===");
const binding = json("DESIGN_RETURN_BINDING.json");
ok("binding_id がある", typeof binding.binding_id === "string" && binding.binding_id.length >= 8);
ok("凍結範囲が宣言されている", binding.function_freeze_range === "F-001..F-045");
ok("状態IDが宣言されている", Array.isArray(binding.state_ids) && binding.state_ids.length === sids.length);
ok("返却必須物が宣言されている", Array.isArray(binding.required_return_files) && binding.required_return_files.length >= 6);
const hashed = Object.keys(binding.request_file_sha256 || {});
const expect = REQUIRED.filter(f => f !== "DESIGN_RETURN_BINDING.json");
ok("バインディング以外の全ファイルのハッシュがある", expect.every(f => hashed.includes(f)), expect.filter(f => !hashed.includes(f)).join(","));
let hashMismatch = [];
for (const f of expect) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(DIR, f))).digest("hex");
  if (actual !== binding.request_file_sha256[f]) hashMismatch.push(f);
}
ok("ハッシュが現在のファイル内容と一致", hashMismatch.length === 0, hashMismatch.join(","));

console.log(`\n=== SELF VALIDATION: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
