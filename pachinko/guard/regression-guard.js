#!/usr/bin/env node
/* ============================================================
   REGRESSION GUARD — UI変更の前後で同一の検査を実行する
   使い方:
     node guard/regression-guard.js baseline pachinko/index.html   # 基準を記録
     node guard/regression-guard.js verify   pachinko/index.html   # 基準と照合
   単一HTMLでもファイル全体ではなく Protected Region 単位で比較する。
   ============================================================ */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, "protected-spec.json"), "utf8"));
const BASE = path.join(__dirname, "baseline.json");

const norm = s => s.replace(/\s+/g, " ").trim();
const sha = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 32);

function fnSource(src, name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) return null;
  let d = 0, k = src.indexOf("{", i);
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) { k++; break; } }
  }
  return src.slice(i, k);
}
function constSource(src, name) {
  const i = src.indexOf("const " + name + " =");
  if (i < 0) return null;
  let d = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if ("[{(".includes(c)) d++;
    else if ("]})".includes(c)) d--;
    else if (c === ";" && d === 0) return src.slice(i, k + 1);
  }
  return null;
}

function collect(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = { file: path.relative(ROOT, file), functions: {}, constants: {}, missing: [] };
  for (const n of SPEC.functions) {
    const s = fnSource(src, n);
    if (!s) { out.missing.push("function:" + n); continue; }
    out.functions[n] = { sha: sha(norm(s)), len: norm(s).length };
  }
  for (const n of SPEC.constants) {
    const s = constSource(src, n);
    if (!s) { out.missing.push("const:" + n); continue; }
    out.constants[n] = { sha: sha(norm(s)), len: norm(s).length };
  }
  out.globals = SPEC.globals.filter(g => src.includes("window." + g + " ="));
  out.domIds = SPEC.domIds.filter(id => src.includes('id="' + id + '"'));
  out.copy = SPEC.requiredCopy.filter(c => src.includes(c));
  out.saveKey = src.includes('"' + SPEC.save.key + '"');
  return out;
}

const mode = process.argv[2] || "verify";
const target = path.resolve(process.argv[3] || path.join(ROOT, "index.html"));
const cur = collect(target);

if (mode === "baseline") {
  fs.writeFileSync(BASE, JSON.stringify(cur, null, 1));
  console.log("baseline written:", path.relative(ROOT, BASE));
  console.log(` functions ${Object.keys(cur.functions).length}/${SPEC.functions.length}` +
              ` / constants ${Object.keys(cur.constants).length}/${SPEC.constants.length}` +
              ` / globals ${cur.globals.length}/${SPEC.globals.length}` +
              ` / domIds ${cur.domIds.length}/${SPEC.domIds.length}` +
              ` / copy ${cur.copy.length}/${SPEC.requiredCopy.length}`);
  if (cur.missing.length) console.log(" MISSING:", cur.missing.join(", "));
  process.exit(0);
}

if (!fs.existsSync(BASE)) { console.error("baseline.json がない。先に baseline を実行すること。"); process.exit(2); }
const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { if (c) { pass++; console.log("  PASS  " + n); } else { fail++; console.log("  FAIL  " + n + (d ? "  << " + d : "")); } };

console.log("=== 1. 保護関数のハッシュ ===");
for (const n of SPEC.functions) {
  const b = base.functions[n], c = cur.functions[n];
  ok(`function ${n}`, !!b && !!c && b.sha === c.sha, !c ? "消失" : !b ? "baselineに無い" : `${b.sha} -> ${c.sha}`);
}
console.log("=== 2. 保護定数(確率・数値・カタログ) ===");
for (const n of SPEC.constants) {
  const b = base.constants[n], c = cur.constants[n];
  ok(`const ${n}`, !!b && !!c && b.sha === c.sha, !c ? "消失" : `${b && b.sha} -> ${c.sha}`);
}
console.log("=== 3. 保存キーとスキーマ ===");
ok("保存キー pachi-teikoku-save-v1", cur.saveKey);
console.log("=== 4. グローバル公開(インラインハンドラ用) ===");
for (const g of SPEC.globals) ok(`window.${g}`, cur.globals.includes(g));
console.log("=== 5. DOM識別子 ===");
const lostIds = base.domIds.filter(i => !cur.domIds.includes(i));
ok(`DOM識別子 ${cur.domIds.length}/${SPEC.domIds.length} 件が存在`, lostIds.length === 0, lostIds.join(","));
console.log("=== 6. 必須コピー ===");
const lostCopy = base.copy.filter(c => !cur.copy.includes(c));
ok(`必須コピー ${cur.copy.length}/${SPEC.requiredCopy.length} 件が存在`, lostCopy.length === 0, lostCopy.join(","));

console.log(`\n=== REGRESSION GUARD (static): ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
