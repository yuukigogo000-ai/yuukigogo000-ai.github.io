/* logic_freeze — 「UI を作り変えても機能が損なわれていない」ことを機械で証明する。
 *
 * なぜ要るか:
 *   UI 改善で最も怖いのは「見た目を直したついでに計算や保存を壊す」こと。
 *   通常のテストは "動くか" は見るが、"同じ実装のままか" は見ない。ここでは
 *   保護対象の関数の**実ソース**と定数の**実値**を sha256 で固定し、変わったら落とす。
 *   (AI UI改善マスタープロトコル v2 §23 Logic freeze proof)
 *
 * 方式:
 *   自前パーサは使わない(正規表現リテラル内の {} や引用符で必ず破綻する)。
 *   ページを実際にブラウザで読み、Function.prototype.toString() でエンジンが解釈した
 *   ソースそのものを取り出す。定数は値を JSON 化して比較する。
 *   → 空白やコメントの整形ではなく「中身が変わったか」を見る。
 *
 * 使い方:
 *   node tests/logic_freeze.mjs --write   # 現在の中身を正本として記録(意図的な変更時のみ)
 *   node tests/logic_freeze.mjs           # 記録と突き合わせ。差があれば exit 1
 *   node tests/logic_freeze.mjs --mutate  # 検査器の自己検査。わざと壊して落ちることを確かめる
 *
 * 記録先: tests/logic_freeze.json (Git 管理)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const PW_DIR = process.env.PW_DIR || 'C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/';
const { chromium } = createRequire(pathToFileURL(PW_DIR.replace(/\/?$/, '/')).href)('playwright');

const APP = path.resolve('expectation-explorer.html');
const MANIFEST = path.resolve('tests/logic_freeze.json');
const NL = String.fromCharCode(10);

/** UI 作業で 1 行も変えてはいけないもの(UI_HANDOFF §14) */
const PROTECTED_FUNCS = [
  'num', 'sanitizeProfile', 'sanitizeOption', 'loadProfile', 'loadOptions', 'persist',
  'annuity', 'calc', 'fmtMan', 'fmtPerHour', 'fmtX', 'fmtPct', 'esc',
];
const PROTECTED_CONSTS = ['LS_PROFILE', 'LS_OPTIONS', 'DOMAINS', 'TEMPLATES', 'PROFILE_DEF'];

const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

/** ソースを読まずに測れる「守るべき性質」。ブラウザ不要。 */
function contracts(html) {
  const i = html.indexOf('<script>'), j = html.lastIndexOf('</script>');
  const src = html.slice(i + 8, j);
  const keys = [...html.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*([A-Z_]+|"[^"]*")/g)].map(m => m[1]);
  return {
    no_fetch: !/\bfetch\s*\(/.test(src) && !/XMLHttpRequest/.test(src),
    no_external_url: !/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')),
    no_external_asset: !/<link\s|@import|<img\s|<script[^>]+src=/i.test(html),
    ls_accessors: [...new Set(keys)].sort().join(','),
    demo_guard: /function persist\(\)\s*\{\s*\n\s*if \(DEMO\) return;/.test(src),
  };
}

let browser = null;
async function extractInBrowser(htmlText) {
  if (!browser) browser = await chromium.launch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-freeze-'));
  const file = path.join(dir, 'app.html');
  fs.writeFileSync(file, htmlText, 'utf8');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(120);
    const got = await page.evaluate(({ funcs, consts }) => {
      // top-level の const はグローバルオブジェクトに載らない(レキシカル束縛)ので
      // 間接 eval でグローバルスコープから参照する
      const g = n => (0, eval)(n);
      const out = { funcs: {}, consts: {}, missing: [] };
      for (const n of funcs) {
        let f; try { f = g(n); } catch { f = undefined; }
        if (typeof f !== 'function') { out.missing.push('fn:' + n); continue; }
        out.funcs[n] = Function.prototype.toString.call(f);
      }
      for (const n of consts) {
        let v; try { v = g(n); } catch { out.missing.push('const:' + n); continue; }
        out.consts[n] = JSON.stringify(v);
      }
      return out;
    }, { funcs: PROTECTED_FUNCS, consts: PROTECTED_CONSTS });
    got.pageerrors = errors;
    return got;
  } finally {
    await page.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function build(htmlText) {
  const g = await extractInBrowser(htmlText);
  const protectedMap = {};
  for (const [n, srcText] of Object.entries(g.funcs)) protectedMap['fn:' + n] = { sha256_16: sha(srcText), bytes: Buffer.byteLength(srcText, 'utf8') };
  for (const [n, val] of Object.entries(g.consts)) protectedMap['const:' + n] = { sha256_16: sha(val), bytes: Buffer.byteLength(val, 'utf8') };
  return { generated_for: 'expectation-explorer.html', missing: g.missing, pageerrors: g.pageerrors, protected: protectedMap, contracts: contracts(htmlText) };
}

async function verify(htmlText, quiet) {
  if (!fs.existsSync(MANIFEST)) { console.error('記録が無い。先に --write'); process.exit(2); }
  const want = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const bad = [];
  let got;
  try { got = await build(htmlText); }
  catch (e) { return ['抽出失敗: ' + e.message]; }
  if (got.pageerrors.length) bad.push('JSエラー: ' + got.pageerrors[0]);
  for (const m of got.missing) bad.push(m + ': 消えている');
  for (const [k, v] of Object.entries(want.protected)) {
    const g = got.protected[k];
    if (!g) { if (!got.missing.includes(k)) bad.push(k + ': 取得できない'); }
    else if (g.sha256_16 !== v.sha256_16) bad.push(k + ': 中身が変わっている (' + v.sha256_16 + ' → ' + g.sha256_16 + ')');
  }
  for (const [k, v] of Object.entries(want.contracts)) {
    if (String(got.contracts[k]) !== String(v)) bad.push('契約 ' + k + ': ' + v + ' → ' + got.contracts[k]);
  }
  if (!quiet) {
    if (bad.length === 0) {
      console.log('logic freeze: OK — 保護対象と契約は記録時と変わっていない');
      console.log('  関数 ' + PROTECTED_FUNCS.length + ' / 定数 ' + PROTECTED_CONSTS.length + ' / 契約 ' + Object.keys(want.contracts).length);
    } else {
      console.log('logic freeze: NG — 機能が損なわれた可能性がある');
      bad.forEach(b => console.log('  - ' + b));
    }
  }
  return bad;
}

const html = fs.readFileSync(APP, 'utf8');
const mode = process.argv[2];
let exitCode = 0;

if (mode === '--write') {
  const m = await build(html);
  if (m.missing.length) { console.error('取得できない対象がある: ' + m.missing.join(', ')); exitCode = 2; }
  else {
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + NL, 'utf8');
    console.log('記録しました: ' + MANIFEST);
    console.log('  保護対象 ' + Object.keys(m.protected).length + ' 件 / 契約 ' + Object.keys(m.contracts).length + ' 件');
  }
} else if (mode === '--mutate') {
  // 検査器の自己検査: わざと壊して「落ちること」を確かめる。落とせない検査器は信用しない。
  const MUT = [
    ['calc の割引率を無視させる', s => s.replace('const r = (overrides.rate !== undefined ? overrides.rate : prof.discountRate) / 100;', 'const r = 0;')],
    ['annuity の符号を反転', s => s.replace('return (1 - Math.pow(1 + rate, -years)) / rate;', 'return (Math.pow(1 + rate, -years) - 1) / rate;')],
    ['calc の判定境界をずらす', s => s.replace('if (ev <= 0) verdict = "見送り";', 'if (ev < 0) verdict = "見送り";')],
    ['calc の制約チェックを1つ削る', s => s.replace('  if (worst < -prof.maxLoss) blockedBy.push("最悪ケースが許容損失超え");' + NL, '')],
    ['esc を素通しにする(XSS 穴)', s => s.replace('function esc(s) { return String(s).replace', 'function esc(s) { return String(s); }' + NL + 'function escOld(s) { return String(s).replace')],
    ['保存キーを変える', s => s.replace('const LS_OPTIONS = "ee_options_v1";', 'const LS_OPTIONS = "ee_options_v2";')],
    ['sanitizeOption の id 検証を外す', s => s.replace('/^[A-Za-z0-9_-]{1,32}$/.test(raw.id)', 'true')],
    ['sanitizeOption の保存キーを1つ削る', s => s.replace('    note: String(raw.note || "").slice(0, 300),' + NL, '')],
    ['num のクランプを外す', s => s.replace('return Math.min(max, Math.max(min, n));', 'return n;')],
    ['fmtMan の「−0万円」対策を戻す', s => s.replace('const sign = r === 0 ? "" : (v < 0 ? "−" : (signed ? "+" : ""));', 'const sign = v < 0 ? "−" : (signed ? "+" : "");')],
    ['外部通信を足す', s => s.replace('function annuity(', 'async function ping(){ await fetch("https://example.com"); }' + NL + 'function annuity(')],
    ['DEMO ガードを外す(検査が本物を壊す)', s => s.replace('  if (DEMO) return;              // 状態再現モードでは本物のデータを書き換えない' + NL, '')],
    ['シナリオのラベルを変える', s => s.replace('["悲観","中位","楽観"].map((label, i) => ({', '["低","中","高"].map((label, i) => ({')],
    ['TEMPLATES の数値を変える', s => s.replace('scenarios:[{prob:20,effect:-50,years:10}', 'scenarios:[{prob:25,effect:-50,years:10}')],
    ['DOMAINS を1つ増やす', s => s.replace('"生活基盤","その他"]', '"生活基盤","副業","その他"]')],
    ['PROFILE_DEF の既定値を変える', s => s.replace('maxLoss:200,', 'maxLoss:500,')],
  ];
  let caught = 0, skipped = 0;
  for (const [name, f] of MUT) {
    const mutated = f(html);
    if (mutated === html) { skipped++; console.log('  SKIP(仕込めず) ' + name); continue; }
    const bad = await verify(mutated, true);
    if (bad.length) { caught++; console.log('  RED  ' + name + '  ← ' + bad[0]); }
    else console.log('  MISS ' + name + '  ← 見逃した');
  }
  const target = MUT.length - skipped;
  console.log(NL + 'MUTATION: ' + caught + '/' + target + ' を検出' + (skipped ? '  (仕込めず ' + skipped + ')' : ''));
  exitCode = (caught === target && skipped === 0) ? 0 : 2;
} else {
  exitCode = (await verify(html, false)).length ? 1 : 0;
}

if (browser) await browser.close();
process.exit(exitCode);
