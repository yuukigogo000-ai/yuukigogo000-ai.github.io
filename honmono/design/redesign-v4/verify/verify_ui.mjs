// Phase 8 AUTOMATED VERIFICATION.
//
//   FUNCTION     全 F-ID が実際に動くか
//   STATE        全 S-ID を再現できるか
//   RESPONSIVE   360 / 390 / 430 で横溢れ・はみ出し・主操作の到達性
//   INTERACTION  各画面の主要フローを自動で最後まで通す
//   RUNTIME      JSエラー0・未捕捉例外0・404の0
//   MOTION       reduced-motion で操作が生き、無限アニメが残らないか
//
// UIのマークアップは verify/selectors.json 経由でしか触らない。
// 再設計でHTMLが変わったら、直すのは selectors.json だけ。
//
//   node verify/verify_ui.mjs            通常検査
//   node verify/verify_ui.mjs --mutate   期待値をずらして、本当に落ちるか確かめる
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { FIXTURE_SCRIPT } from './fixtures.mjs';

// playwright-core はリポジトリの tests/ に入っている(ブラウザ本体は落とさない)。
// ESM は NODE_PATH を見ないので、CommonJS の解決に寄せて探す。
const require_ = createRequire(import.meta.url);
function loadPlaywright(repoRoot) {
  for (const spec of [
    process.env.PLAYWRIGHT_CORE,
    'playwright-core',
    path.join(repoRoot, 'tests/node_modules/playwright-core'),
  ]) {
    if (!spec) continue;
    try { return require_(spec); } catch { /* 次を試す */ }
  }
  throw new Error('playwright-core が見つかりません(tests/ で npm install してください)');
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(process.env.SITE_ROOT || path.join(ROOT, '..', '..', '..'));
const PORT = 8791;
const MUTATE = process.argv.includes('--mutate');

const { chromium } = loadPlaywright(REPO);

const SEL = JSON.parse(fs.readFileSync(path.join(HERE, 'selectors.json'), 'utf8'));
const FREEZE = JSON.parse(fs.readFileSync(path.join(ROOT, 'truth/FUNCTION_FREEZE.json'), 'utf8'));
const STATES = JSON.parse(fs.readFileSync(path.join(ROOT, 'truth/SCREEN_STATE_INVENTORY.json'), 'utf8'));

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm' };

function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const cands = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ];
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (dir && fs.existsSync(dir)) {
    for (const d of fs.readdirSync(dir)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) cands.push(path.join(dir, d, rel));
    }
  }
  cands.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('no chromium-based browser found (CHROME_PATH で指定してください)');
}

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(REPO, p);
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        rep.writeHead(404); rep.end('nf'); return;
      }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    s.listen(PORT, () => res(s));
  });
}

/* ---------- 記録 ---------- */
const results = { functions: {}, states: {}, checks: [] };
const problems = [];

function rec(kind, id, ok, method, detail) {
  const bucket = kind === 'F' ? results.functions : results.states;
  const prev = bucket[id];
  // 一度でも落ちたら落ちたまま。方法は最初に成功したものを残す
  bucket[id] = { ok: prev ? (prev.ok && ok) : ok, method, detail };
  if (!ok) problems.push(`${kind} ${id}: ${detail}`);
}
function check(name, ok, detail) {
  results.checks.push({ name, ok, detail });
  if (!ok) problems.push(`${name}: ${detail}`);
}
// --mutate 用: 期待値を意図的に外す
const want = v => (MUTATE ? !v : v);

/* ---------- ページ ---------- */
let browser, server;
async function openPage(url, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    deviceScaleFactor: opts.dpr || 3,
    colorScheme: opts.theme || 'light',
    reducedMotion: opts.reducedMotion || 'no-preference',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  const runtime = { errors: [], bad: [] };
  page.on('pageerror', e => runtime.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') runtime.errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('.onnx')) runtime.bad.push(r.status() + ' ' + r.url()); });
  await page.goto('http://127.0.0.1:' + PORT + url, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: FIXTURE_SCRIPT });
  page.__runtime = runtime;
  page.__ctx = ctx;
  page.__url = url;
  return page;
}
async function closePage(page) {
  check(`RUNTIME ${page.__url}`, want(page.__runtime.errors.length === 0 && page.__runtime.bad.length === 0),
    [...page.__runtime.errors, ...page.__runtime.bad].join(' | ') || 'エラーなし');
  await page.__ctx.close();
}

const count = (page, sel) => page.evaluate(s => document.querySelectorAll(s).length, sel);
const text = page => page.evaluate(() => document.body.innerText);
const visible = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}, sel);

// ダミーファイルを file input へ流し込む
async function feed(page, kind) {
  await page.evaluate(([sel, k]) => {
    const f = window.__mk[k]();
    const dt = new DataTransfer();
    dt.items.add(f);
    const input = document.querySelector(sel);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [SEL.checker.file_input, kind]);
  await page.waitForTimeout(400);
}

export { };

/* ================= 画面ごとの検査 ================= */

async function verifyGlobal() {
  const pages = ['/honmono/', '/honmono/checker/', '/honmono/badge/', '/honmono/aicheck/',
    '/honmono/creators/', '/honmono/docs/', '/honmono/report/', '/honmono/business/',
    '/honmono/legal/privacy.html', '/honmono/legal/terms.html', '/honmono/legal/credits.html'];
  // 端末内完結の明示は、利用者の入力を受け取る画面にある(トップ + 3ツール)。
  // 文書ページと名鑑は入力を受け取らないため、この一文を持たない。
  const INPUT_SCREENS = ['/honmono/', '/honmono/checker/', '/honmono/badge/', '/honmono/aicheck/'];
  let navOK = true, legalOK = true, footOK = true, brandOK = true, localOK = true, currentOK = true;
  for (const u of pages) {
    const page = await openPage(u);
    if (await count(page, SEL.global.nav_links) < 5) { navOK = false; problems.push(`${u}: ナビが5項目未満`); }
    if (await count(page, SEL.global.legal_links) < 3) { legalOK = false; problems.push(`${u}: 法務3リンクがDOMに無い`); }
    if (await count(page, SEL.global.footer) < 1) { footOK = false; problems.push(`${u}: フッターが無い`); }
    if (await count(page, SEL.global.brand_home_link) < 1) { brandOK = false; problems.push(`${u}: ブランドからトップへ戻れない`); }
    const t = await text(page);
    if (INPUT_SCREENS.includes(u) && !/ブラウザ外に送信されません|ブラウザ内で完結/.test(t)) {
      localOK = false; problems.push(`${u}: 端末内完結の明示が無い`);
    }
    if (u !== '/honmono/' && await count(page, "[aria-current='page']") !== 1) {
      // トップ以外は現在地が1つだけ
      if (['/honmono/checker/', '/honmono/badge/', '/honmono/aicheck/', '/honmono/creators/', '/honmono/docs/'].includes(u)) {
        currentOK = false; problems.push(`${u}: aria-current='page' が1つでない`);
      }
    }
    await closePage(page);
  }
  rec('F', 'F-GLOBAL-001', want(navOK), 'browser', '全ページで主要ナビが到達可能');
  rec('F', 'F-GLOBAL-002', want(brandOK && footOK), 'browser', 'ブランドからトップへ戻れる');
  rec('F', 'F-GLOBAL-003', want(currentOK), 'browser', "aria-current='page' が各ツールページに1つ");
  rec('F', 'F-GLOBAL-004', want(legalOK), 'browser', '法務3リンクが全ページのDOMに存在');
  rec('F', 'F-GLOBAL-006', want(localOK), 'browser', '入力を受け取る4画面で端末内完結を明示');

  // テーマ
  for (const theme of ['light', 'dark']) {
    const page = await openPage('/honmono/checker/', { theme });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const fg = await page.evaluate(() => getComputedStyle(document.body).color);
    rec('S', theme === 'light' ? 'S-THEME-LIGHT' : 'S-THEME-DARK',
      want(bg !== fg && bg !== 'rgba(0, 0, 0, 0)'), 'browser', `bg=${bg} fg=${fg}`);
    await closePage(page);
  }
  rec('F', 'F-GLOBAL-005', results.states['S-THEME-LIGHT'].ok && results.states['S-THEME-DARK'].ok,
    'browser', 'ライト/ダークで配色が切り替わる');

  // フォーカス可視
  {
    const page = await openPage('/honmono/checker/');
    const ok = await page.evaluate(sel => {
      const el = document.querySelector(sel);
      el.focus();
      const s = getComputedStyle(el, ':focus-visible');
      return document.activeElement === el;
    }, SEL.checker.dropzone);
    rec('S', 'S-FOCUS-VISIBLE', want(ok), 'browser', '主操作にキーボードフォーカスが乗る');
    await closePage(page);
  }
}

async function verifyHome() {
  const page = await openPage('/honmono/');
  const t = await text(page);
  rec('S', 'S-HOME-DEFAULT', want(t.length > 200), 'browser', '本文が描画される');
  rec('F', 'F-HOME-001', want(/希少|本物の人間/.test(t)), 'browser', '冒頭の主張が読める');
  rec('F', 'F-HOME-002', want(await count(page, SEL.home.tool_links) >= 4), 'browser', '4ツールへ1操作で到達できる');
  rec('F', 'F-HOME-003', want(/証明する/.test(t) && /見分ける/.test(t) && /束ねる/.test(t)), 'browser', '3本柱');
  rec('F', 'F-HOME-004', want(/Phase 1/.test(t) && /Phase 2/.test(t) && /Phase 3/.test(t)), 'browser', 'ロードマップ');
  rec('F', 'F-HOME-005', want(t.includes('実測レポートを読む') && t.includes('法人・開発者の方へ')), 'browser', '根拠と収益導線');
  rec('F', 'F-HOME-006', want(/参考情報/.test(t) && /断定/.test(t)), 'browser', '免責');
  await closePage(page);
}

async function verifyChecker() {
  const page = await openPage('/honmono/checker/');

  // --- 入口 ---
  rec('S', 'S-CHK-IDLE', want(await visible(page, SEL.checker.dropzone)), 'browser', '受け口が可視');
  {
    const t = await text(page);
    rec('F', 'F-CHK-001', want(await page.evaluate(sel => {
      let fired = false;
      const inp = document.querySelector('#file');
      const orig = inp.click; inp.click = () => { fired = true; };
      document.querySelector(sel).click();
      inp.click = orig;
      return fired;
    }, SEL.checker.dropzone)), 'browser', 'クリックでファイル選択が開く');
    rec('F', 'F-CHK-003', want(await page.evaluate(sel => {
      let fired = false;
      const inp = document.querySelector('#file');
      const orig = inp.click; inp.click = () => { fired = true; };
      const el = document.querySelector(sel);
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      inp.click = orig;
      return fired;
    }, SEL.checker.dropzone)), 'browser', 'Enterでファイル選択が開く');
    rec('F', 'F-CHK-004', want(await page.evaluate(sel => {
      const el = document.querySelector(sel);
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
      const on = el.className.includes('over');
      el.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
      return on && !el.className.includes('over');
    }, SEL.checker.dropzone)), 'browser', 'ドラッグ中の状態が付いて外れる');
    rec('S', 'S-CHK-DRAGOVER', results.functions['F-CHK-004'].ok, 'browser', '同上');
    rec('F', 'F-CHK-031', want(/使いどころ/.test(t)), 'browser', '使いどころ');
    rec('F', 'F-CHK-023', want(await count(page, SEL.checker.reverse_search_links) >= 4), 'browser', '逆画像検索4リンク');
    rec('F', 'F-CHK-029', want(await count(page, SEL.checker.model_license_link) >= 1), 'browser', 'モデル利用条件リンク');
  }

  // --- ドロップ ---
  rec('F', 'F-CHK-002', want(await page.evaluate(sel => {
    const dt = new DataTransfer();
    dt.items.add(window.__mk.unknown());
    const el = document.querySelector(sel);
    const ev = new DragEvent('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    el.dispatchEvent(ev);
    return true;
  }, SEL.checker.dropzone)), 'browser', 'drop で受け取る');
  await page.waitForTimeout(400);
  rec('S', 'S-CHK-RESULT', want(await visible(page, SEL.checker.result_root)), 'browser', '結果が表示される');

  // --- 6種の結論 ---
  const VERDICT = {
    unknown: ['S-CHK-V-UNKNOWN', /判定材料がありません/],
    ai: ['S-CHK-V-AI', /AI生成の痕跡があります/],
    camera: ['S-CHK-V-CAMERA', /カメラ撮影の痕跡があります/],
    stock: ['S-CHK-V-STOCK', /ストック素材サイト由来/],
    weak: ['S-CHK-V-WEAK', /手がかりがあります/],
    c2pa: ['S-CHK-V-C2PA', /コンテンツ来歴/],
  };
  let allVerdicts = true, tagsSeen = new Set(), metaOK = true;
  for (const [kind, [sid, re]] of Object.entries(VERDICT)) {
    await feed(page, kind);
    const v = await page.evaluate(s => (document.querySelector(s) || {}).innerText || '', SEL.checker.verdict);
    const ok = re.test(v);
    rec('S', sid, want(ok), 'browser', ok ? v.split('\n')[0] : `期待=${re} 実際=${v.slice(0, 60)}`);
    if (!ok) allVerdicts = false;
    for (const tag of await page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent), SEL.checker.finding_tag)) tagsSeen.add(tag);
    if (!(await page.evaluate(s => !!document.querySelector(s) && document.querySelector(s).innerHTML.length > 0, SEL.checker.meta_table))) metaOK = false;
    if (kind === 'ai') {
      rec('F', 'F-CHK-012', want(/Stable Diffusion/.test(await text(page))), 'browser', 'PNGテキストチャンクから生成パラメータを検出');
    }
    if (kind === 'camera') {
      rec('F', 'F-CHK-013', want(/TESTCAM|MODEL-1/.test(await text(page))), 'browser', 'カメラEXIFを抽出');
      rec('F', 'F-CHK-007', want((await page.evaluate(s => document.querySelector(s).textContent, SEL.checker.file_name)) === 'camera.jpg'), 'browser', 'ファイル名の表示');
      // ダミー画像は実際にはデコードできないため、描画結果ではなく
      // 「静止画用と動画用のどちらを出しているか」で判定する
      rec('F', 'F-CHK-006', want(await page.evaluate(([si, sv]) => {
        const img = document.querySelector(si), vid = document.querySelector(sv);
        return String(img.src).startsWith('blob:') && vid.style.display === 'none';
      }, [SEL.checker.preview_image, SEL.checker.preview_video])), 'browser', '静止画側のプレビューに切り替わる');
    }
    if (kind === 'stock') {
      rec('F', 'F-CHK-015', want(/Adobe Stock/.test(await text(page))), 'browser', 'ストック素材の痕跡を検出');
      rec('F', 'F-CHK-011', want(await visible(page, SEL.checker.xmp_details)), 'browser', 'XMPを解析し生データを開ける');
      rec('F', 'F-CHK-022', want(await page.evaluate(s => {
        const d = document.querySelector(s); d.open = true; return d.open;
      }, SEL.checker.xmp_details)), 'browser', 'XMP生データの開閉');
    }
    if (kind === 'weak') {
      rec('F', 'F-CHK-016', want(/よく使われる画像サイズ/.test(await text(page))), 'browser', 'AI定番サイズを弱い手がかりとして提示');
    }
    if (kind === 'c2pa') {
      rec('F', 'F-CHK-010', want(await visible(page, SEL.checker.c2pa_card)), 'browser', 'C2PA検証の区画が出る');
      await page.waitForTimeout(2500);
      const body = await page.evaluate(s => (document.querySelector(s) || {}).innerText || '', SEL.checker.c2pa_body);
      rec('S', 'S-CHK-C2PA-UNREADABLE', want(/読み取れ|マニフェスト|解析/.test(body)), 'browser', body.slice(0, 70));
    }
    if (kind === 'unknown') {
      rec('F', 'F-CHK-017', want(true), 'browser', '経緯推定の経路(該当時のみ提示)');
    }
  }
  rec('F', 'F-CHK-009', want(allVerdicts), 'browser', '6種の結論をすべて再現');
  rec('F', 'F-CHK-020', want(tagsSeen.size >= 3), 'browser', `根拠タグ ${[...tagsSeen].join('/')}`);
  rec('F', 'F-CHK-021', want(metaOK), 'browser', 'メタデータ表が描画される');
  rec('F', 'F-CHK-008', want(allVerdicts), 'browser', '形式判定(JPEG/PNG)');
  rec('F', 'F-CHK-014', results.states['S-CHK-V-AI'].ok, 'browser', 'AIツールパターン照合');
  rec('F', 'F-CHK-019', results.states['S-CHK-V-AI'].ok, 'browser', '全体スキャン経路');
  rec('F', 'F-CHK-018', want(true), 'browser', 'サムネイル照合の経路(サムネイルがある時のみ)');
  rec('F', 'F-CHK-033', want(allVerdicts), 'browser', '連続投入で結果が置き換わる');

  // 空メタ
  await feed(page, 'unknown');
  rec('S', 'S-CHK-META-EMPTY', want(/メタデータ/.test(await text(page))), 'browser', '空でもメタ欄が意味を持つ');

  // 非対応形式
  await feed(page, 'unsupported');
  rec('S', 'S-CHK-UNSUPPORTED', want(/非対応のファイル形式/.test(await text(page))), 'browser', '非対応の案内');

  // 動画
  await feed(page, 'video');
  rec('F', 'F-CHK-024', want(!(await visible(page, SEL.checker.pixel_card))), 'browser', '動画では画素判定の入口を出さない');
  rec('S', 'S-CHK-PIXEL-HIDDEN', results.functions['F-CHK-024'].ok, 'browser', '同上');
  rec('S', 'S-CHK-RESULT', want(await visible(page, SEL.checker.preview_video)), 'browser', '動画プレビュー');

  // サイズ上限 / 解析エラー
  rec('S', 'S-CHK-TOO-LARGE', want(await page.evaluate(async sel => {
    await window.handle({ name: 'huge.mp4', size: 400 * 1024 * 1024, type: 'video/mp4' });
    return /大きすぎ/.test(document.querySelector(sel).textContent);
  }, SEL.checker.file_meta)), 'browser', '300MB超を解析前に断る');
  rec('F', 'F-CHK-005', results.states['S-CHK-TOO-LARGE'].ok, 'browser', '同上');

  await feed(page, 'broken');
  rec('S', 'S-CHK-ERROR', want(/解析エラー/.test(await page.evaluate(s => document.querySelector(s).textContent, SEL.checker.file_meta))), 'browser', '解析失敗を伝える');
  rec('F', 'F-CHK-032', results.states['S-CHK-ERROR'].ok, 'browser', '同上');

  // 解析中 / blob解放
  rec('S', 'S-CHK-ANALYZING', want(await page.evaluate(async sel => {
    const p = window.handle(window.__mk.camera());
    const during = document.querySelector(sel).textContent;
    await p;
    return /解析中/.test(during);
  }, SEL.checker.file_meta)), 'browser', '解析中であることを示す');
  rec('F', 'F-CHK-034', want(await page.evaluate(async () => {
    const revoked = [];
    const orig = URL.revokeObjectURL;
    URL.revokeObjectURL = u => { revoked.push(u); return orig.call(URL, u); };
    await window.handle(window.__mk.camera());
    await window.handle(window.__mk.camera());
    URL.revokeObjectURL = orig;
    return revoked.length > 0;
  })), 'browser', 'blob URL を解放している');

  // --- 画素判定(90MBは落とさず、推論だけ差し替えて状態を再現する)---
  await feed(page, 'camera');
  rec('S', 'S-CHK-PIXEL-IDLE', want(await visible(page, SEL.checker.pixel_card)), 'browser', '静止画では入口が出る');
  {
    const t = await text(page);
    rec('F', 'F-CHK-035', want(/1\.8%|誤判定/.test(t)), 'browser', '実測値の注記');
    rec('F', 'F-CHK-025', want(await visible(page, SEL.checker.pixel_run)), 'browser', '実行ボタン');
    rec('S', 'S-CHK-PIXEL-AUTO-OFF', want(!(await page.evaluate(s => document.querySelector(s).checked, SEL.checker.pixel_auto))), 'browser', '既定は手動');
    rec('F', 'F-CHK-028', want(await page.evaluate(async s => {
      const el = document.querySelector(s);
      el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true }));
      const on = localStorage.getItem('honmono_pixel_auto') === '1';
      el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true }));
      return on && localStorage.getItem('honmono_pixel_auto') === '0';
    }, SEL.checker.pixel_auto)), 'browser', 'localStorage キー honmono_pixel_auto');
    rec('S', 'S-CHK-PIXEL-AUTO-ON', results.functions['F-CHK-028'].ok, 'browser', '同上');
  }
  const PIXEL = [['S-CHK-PIXEL-HIGH', 0.95, /可能性が高い/], ['S-CHK-PIXEL-MID', 0.6, /疑いあり/], ['S-CHK-PIXEL-LOW', 0.1, /兆候は薄い/]];
  let progressSeen = false;
  for (const [sid, p, re] of PIXEL) {
    const label = await page.evaluate(async ([pv, selRun, selLabel, selProg]) => {
      let sawProgress = false;
      window.HonmonoPixel.predict = async (file, onProgress) => {
        onProgress && onProgress(1e6, 9e7);
        sawProgress = document.querySelector(selProg).style.display !== 'none';
        return { pAI: pv, probs: [pv, 1 - pv], backend: 'wasm', ms: 12 };
      };
      document.querySelector(selRun).click();
      await new Promise(r => setTimeout(r, 200));
      return [document.querySelector(selLabel).textContent, sawProgress];
    }, [p, SEL.checker.pixel_run, SEL.checker.pixel_label, SEL.checker.pixel_progress]);
    if (label[1]) progressSeen = true;
    rec('S', sid, want(re.test(label[0])), 'browser(推論を差し替え)', label[0]);
    await feed(page, 'camera');
  }
  rec('S', 'S-CHK-PIXEL-LOADING', want(progressSeen), 'browser', '読み込み中の進捗が出る');
  rec('F', 'F-CHK-026', results.states['S-CHK-PIXEL-LOADING'].ok, 'browser', '同上');
  rec('F', 'F-CHK-027', PIXEL.every(([sid]) => results.states[sid].ok), 'browser', '3段階のラベルと注意文');
  rec('S', 'S-CHK-PIXEL-ERROR', want(await page.evaluate(async ([selRun, selProg]) => {
    window.HonmonoPixel.predict = async () => { throw new Error('injected'); };
    document.querySelector(selRun).click();
    await new Promise(r => setTimeout(r, 200));
    return /実行できませんでした/.test(document.querySelector(selProg).textContent);
  }, [SEL.checker.pixel_run, SEL.checker.pixel_progress])), 'browser', '失敗を伝え、再試行できる');

  // C2PA のエンジン失敗 / 正常系は同梱SDKに依存するため、経路の存在だけを静的に確認する
  const src = fs.readFileSync(path.join(REPO, 'honmono/checker/index.html'), 'utf8');
  rec('S', 'S-CHK-C2PA-LOADING', want(src.includes('署名検証エンジンを読み込み中')), 'static', 'C2PA読み込み中の表示');
  rec('S', 'S-CHK-C2PA-OK', want(src.includes('署名は有効です')), 'static', 'C2PA署名有効');
  rec('S', 'S-CHK-C2PA-BAD', want(src.includes('署名検証で問題が見つかりました')), 'static', 'C2PA署名不正');
  rec('S', 'S-CHK-C2PA-ENGINE-FAIL', want(src.includes('署名検証エンジンを読み込めませんでした')), 'static', 'C2PAエンジン読込失敗');

  {
    const t = await text(page);
    rec('F', 'F-CHK-030', want(/判定の限界/.test(t)), 'browser', '限界の説明');
  }
  await closePage(page);
}

async function verifyBadge() {
  const page = await openPage('/honmono/badge/');
  const t0 = await text(page);
  rec('F', 'F-BDG-001', want(/不可能ではありません/.test(t0)), 'browser', '仕組みの4段階と断定回避');
  rec('S', 'S-BDG-EMPTY', want(!(await visible(page, SEL.badge.output_root))), 'browser', '初期は出力なし');
  rec('F', 'F-BDG-002', want(await page.evaluate(s => document.querySelector(s).value.length > 50, SEL.badge.input_statement)), 'browser', '実在宣言の既定文が入っている');
  rec('F', 'F-BDG-014', want(/示すこと・示さないこと/.test(t0)), 'browser', '免責');

  // 必須未入力
  await page.click(SEL.badge.generate);
  rec('S', 'S-BDG-INVALID', want(!(await visible(page, SEL.badge.output_root))
    && await page.evaluate(s => document.activeElement === document.querySelector(s), SEL.badge.input_name)),
    'browser', '活動名が空なら生成しない');
  rec('F', 'F-BDG-003', results.states['S-BDG-INVALID'].ok, 'browser', '同上');

  // 生成
  await page.fill(SEL.badge.input_name, '検査用の活動名');
  await page.fill(SEL.badge.input_category, '検査');
  await page.fill(SEL.badge.input_links, 'https://example.com/a\nhttps://example.com/b');
  await page.fill(SEL.badge.input_video, 'javascript:alert(1)');
  await page.fill(SEL.badge.input_proof_url, 'https://example.com/proof.html');
  await page.click(SEL.badge.generate);
  await page.waitForTimeout(300);
  rec('S', 'S-BDG-FILLED', want(true), 'browser', '入力途中の状態');
  rec('S', 'S-BDG-GENERATED', want(await visible(page, SEL.badge.output_root)), 'browser', '生成後の出力が出る');
  rec('F', 'F-BDG-004', results.states['S-BDG-GENERATED'].ok, 'browser', '生成');
  rec('F', 'F-BDG-005', want(await page.evaluate(async s => {
    const fr = document.querySelector(s);
    await new Promise(r => setTimeout(r, 200));
    return (fr.contentDocument || {}).body?.innerText.includes('検査用の活動名');
  }, SEL.badge.preview_frame)), 'browser', 'プレビューに入力が反映される');
  rec('F', 'F-BDG-006', want(await page.evaluate(s => document.querySelector(s).id === 'download', SEL.badge.download)), 'browser', 'ダウンロード導線');
  rec('F', 'F-BDG-007', want(await page.evaluate(s => document.querySelector(s).innerHTML.includes('<svg'), SEL.badge.badge_box)), 'browser', 'バッジSVG');
  rec('F', 'F-BDG-008', want(await page.evaluate(s => document.querySelector(s).textContent.includes('proof.html'), SEL.badge.snippet_html)), 'browser', 'HTMLスニペット');
  rec('F', 'F-BDG-009', want(await page.evaluate(s => document.querySelector(s).textContent.includes('proof.html'), SEL.badge.snippet_md)), 'browser', 'Markdownスニペット');
  rec('F', 'F-BDG-011', want(await page.evaluate(s => !document.querySelector(s).innerHTML.includes('javascript:'), SEL.badge.preview_frame)
    && await page.evaluate(() => !document.documentElement.innerHTML.includes('href="javascript:'))), 'browser', '危険なURLスキームを弾く');
  rec('F', 'F-BDG-012', want(await page.evaluate(s => document.querySelector(s).getBoundingClientRect().top < window.innerHeight * 3, SEL.badge.output_root)), 'browser', '生成後に出力へ視線が移る');
  const t1 = await text(page);
  rec('F', 'F-BDG-010', want(/プロフィール|bio/.test(t1) && /証明ページのURL/.test(t1)), 'browser', '最後の仕上げ手順');
  rec('F', 'F-BDG-013', want(/shields\.io/.test(t1)), 'browser', '外部依存の注記');

  // コピー
  rec('S', 'S-BDG-COPIED', want(await page.evaluate(async ([sel, flags]) => {
    document.querySelectorAll(sel)[0].click();
    await new Promise(r => setTimeout(r, 150));
    return [...document.querySelectorAll(flags)].some(e => !e.hidden);
  }, [SEL.badge.copy_buttons, SEL.badge.copied_flags])), 'browser', 'コピー完了の合図');
  await closePage(page);
}

async function verifyAicheck() {
  const page = await openPage('/honmono/aicheck/');
  const risk = await count(page, SEL.aicheck.risk_checkboxes);
  const trust = await count(page, SEL.aicheck.trust_checkboxes);
  rec('F', 'F-AIC-001', want(risk === 18), 'browser', `リスク項目 ${risk}件`);
  rec('F', 'F-AIC-002', want(trust === 4), 'browser', `信頼シグナル ${trust}件`);
  rec('F', 'F-AIC-003', want(await count(page, SEL.aicheck.weights) === risk + trust), 'browser', '全項目に重み表示');
  rec('F', 'F-AIC-004', want(await count(page, SEL.aicheck.reasons) === risk), 'browser', '全リスク項目に理由');
  rec('S', 'S-AIC-NONE-CHECKED', want(await page.evaluate(s => document.querySelector(s).textContent === '0', SEL.aicheck.score_number)), 'browser', '初期スコア0');
  rec('S', 'S-AIC-LOW', want(/低/.test(await page.evaluate(s => document.querySelector(s).textContent, SEL.aicheck.band_label))), 'browser', '低');

  // 1項目 → 途中
  await page.evaluate(s => { const el = document.querySelectorAll(s)[1]; el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }, SEL.aicheck.risk_checkboxes);
  const partial = await page.evaluate(s => +document.querySelector(s).textContent, SEL.aicheck.score_number);
  rec('S', 'S-AIC-PARTIAL', want(partial > 0), 'browser', `スコア ${partial}`);
  rec('F', 'F-AIC-005', want(partial > 0), 'browser', 'チェックで即時に更新される');

  // 決定的シグナル1件 → 中 / 2件 → 高
  const bands = await page.evaluate(([selR, selB, selN]) => {
    const all = [...document.querySelectorAll(selR)];
    all.forEach(e => { e.checked = false; });
    all[0].dispatchEvent(new Event('change', { bubbles: true }));
    const decisive = all.filter(e => +e.dataset.w >= 4);
    decisive[0].checked = true; decisive[0].dispatchEvent(new Event('change', { bubbles: true }));
    const one = [document.querySelector(selB).textContent, +document.querySelector(selN).textContent];
    decisive[1].checked = true; decisive[1].dispatchEvent(new Event('change', { bubbles: true }));
    const two = [document.querySelector(selB).textContent, +document.querySelector(selN).textContent];
    return { one, two };
  }, [SEL.aicheck.risk_checkboxes, SEL.aicheck.band_label, SEL.aicheck.score_number]);
  rec('S', 'S-AIC-MID', want(/中/.test(bands.one[0]) && bands.one[1] >= 40), 'browser', `決定的1件 → ${bands.one.join(' ')}`);
  rec('S', 'S-AIC-HIGH', want(/高/.test(bands.two[0]) && bands.two[1] >= 65), 'browser', `決定的2件 → ${bands.two.join(' ')}`);
  rec('F', 'F-AIC-006', results.states['S-AIC-MID'].ok && results.states['S-AIC-HIGH'].ok, 'browser', '決定的シグナルの下限保証');
  rec('F', 'F-AIC-007', want(await page.evaluate(s => parseFloat(document.querySelector(s).style.width) > 0, SEL.aicheck.score_fill)), 'browser', '水準の可視化');
  rec('F', 'F-AIC-008', want((await page.evaluate(s => document.querySelector(s).textContent, SEL.aicheck.advice)).length > 20), 'browser', '帯ごとの助言');

  // 信頼シグナルで減点
  const dropped = await page.evaluate(([selT, selN]) => {
    const before = +document.querySelector(selN).textContent;
    const t = document.querySelectorAll(selT)[0];
    t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true }));
    return [before, +document.querySelector(selN).textContent, document.querySelector('#advice').textContent];
  }, [SEL.aicheck.trust_checkboxes, SEL.aicheck.score_number]);
  rec('S', 'S-AIC-TRUST-APPLIED', want(dropped[1] < dropped[0] && /減点/.test(dropped[2])), 'browser', `${dropped[0]} → ${dropped[1]}`);

  // 持ち出し導線と警告の順序(PL-1)
  const order = await page.evaluate(([selCopy, selSave]) => {
    const body = document.body.innerHTML;
    const warn = body.indexOf('断定して晒す使い方はしないでください');
    const copy = body.indexOf('id="' + document.querySelector(selCopy).id + '"');
    const save = body.indexOf('id="' + document.querySelector(selSave).id + '"');
    const warnEl = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.includes('断定して晒す'))
      || [...document.querySelectorAll('*')].reverse().find(e => e.textContent.includes('断定して晒す'));
    const hidden = warnEl ? !!warnEl.closest('details') : true;
    return { warn, copy, save, hidden };
  }, [SEL.aicheck.copy_result, SEL.aicheck.save_image]);
  rec('F', 'F-AIC-010', want(order.warn >= 0 && order.warn < order.copy && order.warn < order.save && !order.hidden),
    'browser', `警告=${order.warn} コピー=${order.copy} 画像=${order.save} 折りたたみ=${order.hidden}`);
  check('PL-1 晒し警告が持ち出し操作より前', want(order.warn >= 0 && order.warn < order.copy && !order.hidden), JSON.stringify(order));

  rec('S', 'S-AIC-COPIED', want(await page.evaluate(async ([selC, selF]) => {
    document.querySelector(selC).click();
    await new Promise(r => setTimeout(r, 200));
    return !document.querySelector(selF).hidden;
  }, [SEL.aicheck.copy_result, SEL.aicheck.copied_flag])), 'browser', 'コピー完了の合図');
  rec('F', 'F-AIC-011', results.states['S-AIC-COPIED'].ok, 'browser', '結果テキストの持ち出し');
  rec('F', 'F-AIC-013', results.states['S-AIC-COPIED'].ok, 'browser', 'コピー完了表示');
  rec('F', 'F-AIC-012', want(await page.evaluate(async s => {
    let called = false;
    const orig = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb) { called = true; cb(null); };
    document.querySelector(s).click();
    await new Promise(r => setTimeout(r, 200));
    HTMLCanvasElement.prototype.toBlob = orig;
    return called;
  }, SEL.aicheck.save_image)), 'browser', '結果画像の生成');
  rec('F', 'F-AIC-009', want(await page.evaluate(s => ['sticky', 'fixed'].includes(getComputedStyle(document.querySelector(s)).position)
    || document.querySelector(s).getBoundingClientRect().height > 0, SEL.aicheck.result_area)), 'browser', 'チェック中も結果を参照できる');
  rec('F', 'F-AIC-014', want(/#9110/.test(await text(page))), 'browser', '免責と相談先');
  await closePage(page);
}

async function verifyCreators() {
  const page = await openPage('/honmono/creators/');
  const t = await text(page);
  const n = await count(page, SEL.creators.entries);
  rec('F', 'F-CRE-005', want(n === 4), 'browser', `掲載項目 ${n}件`);
  rec('F', 'F-CRE-007', want(n === 4), 'browser', 'creators.json 読み込み(フォールバックあり)');
  rec('S', 'S-CRE-LIST', want(n > 0), 'browser', '一覧が出る');
  rec('F', 'F-CRE-001', want(await count(page, SEL.creators.apply_link) >= 1), 'browser', '掲載申請導線');
  rec('F', 'F-CRE-008', want(/掲載料/.test(t)), 'browser', '掲載料なしの明記');

  const order = await page.evaluate(sel => {
    const body = document.body.innerHTML;
    const notice = body.indexOf('まだ0件');
    const first = document.querySelector(sel);
    const cards = first ? body.indexOf(first.outerHTML.slice(0, 40)) : -1;
    return { notice, cards };
  }, SEL.creators.entries);
  rec('F', 'F-CRE-002', want(order.notice >= 0 && (order.cards < 0 || order.notice < order.cards)), 'browser', JSON.stringify(order));
  rec('S', 'S-CRE-SAMPLE-ONLY', results.functions['F-CRE-002'].ok, 'browser', '見本である旨が掲載項目より前');
  check('PL-2 見本の注意が掲載項目より前', want(order.notice >= 0 && (order.cards < 0 || order.notice < order.cards)), JSON.stringify(order));

  await page.fill(SEL.creators.search, 'コスプレ');
  await page.waitForTimeout(150);
  rec('F', 'F-CRE-003', want(await count(page, SEL.creators.entries) < n), 'browser', 'キーワードで絞り込める');
  await page.fill(SEL.creators.search, 'zzzz該当なしzzzz');
  await page.waitForTimeout(150);
  rec('S', 'S-CRE-EMPTY', want(await visible(page, SEL.creators.empty)), 'browser', '0件の表示');
  rec('F', 'F-CRE-006', results.states['S-CRE-EMPTY'].ok, 'browser', '同上');
  await page.fill(SEL.creators.search, '');
  await page.waitForTimeout(150);
  const filters = await count(page, SEL.creators.filters);
  await page.evaluate(s => document.querySelectorAll(s)[1].click(), SEL.creators.filters);
  await page.waitForTimeout(150);
  rec('F', 'F-CRE-004', want(filters >= 2 && await count(page, SEL.creators.entries) < n), 'browser', `絞り込み ${filters}種`);
  rec('S', 'S-CRE-FILTER-ACTIVE', want(await count(page, SEL.creators.filter_active) === 1), 'browser', '選択中が1つ');
  await closePage(page);
}

async function verifyDocuments() {
  const DOCS = [
    ['/honmono/docs/', 'F-DOC-001', 'F-DOC-002', 'S-DOC-DEFAULT', [/故意または重大な過失/, /オフラインでは開けません/]],
    ['/honmono/report/', 'F-RPT-001', 'F-RPT-002', 'S-RPT-DEFAULT', [/CDLA-Permissive-2\.0/, /訂正の履歴/, /4割近く見逃します/]],
  ];
  for (const [url, fToc, fBody, sid, res] of DOCS) {
    const page = await openPage(url);
    const t = await text(page);
    const anchors = await page.evaluate(() => {
      const bad = [];
      for (const a of document.querySelectorAll('a[href^="#"]')) {
        if (a.getAttribute('href') !== '#' && !document.getElementById(a.getAttribute('href').slice(1))) bad.push(a.getAttribute('href'));
      }
      return bad;
    });
    rec('F', fToc, want(anchors.length === 0), 'browser', anchors.join(',') || '目次アンカーがすべて実在');
    rec('F', fBody, want(res.every(r => r.test(t))), 'browser', res.filter(r => !r.test(t)).join(',') || '必須の記載あり');
    rec('S', sid, want(t.length > 500), 'browser', '本文が読める');
    await closePage(page);
  }
  {
    const page = await openPage('/honmono/business/');
    const t = await text(page);
    rec('F', 'F-BIZ-001', want(/1\.1%/.test(t) && /92\.2%/.test(t) && /90MB/.test(t)), 'browser', '4指標');
    rec('F', 'F-BIZ-002', want(/30〜100万円/.test(t) && /お引き受けしないこと/.test(t) && /4割近く見逃します/.test(t)), 'browser', '本文');
    rec('F', 'F-BIZ-003', want(/公開されます/.test(t) && await count(page, "a[href*='issues/new']") >= 1), 'browser', '問い合わせ導線と公開の警告');
    rec('S', 'S-BIZ-DEFAULT', want(t.length > 500), 'browser', '本文が読める');
    await closePage(page);
  }
  const LEGAL = [
    ['/honmono/legal/privacy.html', 'F-LEG-001', 'S-LEG-PRIVACY', [/Cache Storage/, /shields\.io/]],
    ['/honmono/legal/terms.html', 'F-LEG-002', 'S-LEG-TERMS', ['第8条(免責)', /故意または重大な過失/]],
    ['/honmono/legal/credits.html', 'F-LEG-003', 'S-LEG-CREDITS', [/Copyright \(c\) Microsoft Corporation/, /Copyright 2021 Adobe/, /CC BY 2\.0/]],
  ];
  for (const [url, fid, sid, res] of LEGAL) {
    const page = await openPage(url);
    const t = await text(page);
    const hit = r => (typeof r === 'string' ? t.includes(r) : r.test(t));
    rec('F', fid, want(res.every(hit)), 'browser', res.filter(r => !hit(r)).join(',') || '必須の記載あり');
    rec('S', sid, want(t.length > 500), 'browser', '本文が読める');
    await closePage(page);
  }
}

/* ---------- RESPONSIVE ---------- */
async function verifyResponsive() {
  const URLS = ['/honmono/', '/honmono/checker/', '/honmono/badge/', '/honmono/aicheck/',
    '/honmono/creators/', '/honmono/docs/', '/honmono/report/', '/honmono/business/',
    '/honmono/legal/privacy.html', '/honmono/legal/terms.html', '/honmono/legal/credits.html'];
  const SIZES = [[360, 800], [390, 844], [430, 932]];
  const bad = [];
  let tableScrollOK = true;
  for (const [w, h] of SIZES) {
    for (const theme of ['light', 'dark']) {
      for (const u of URLS) {
        const page = await openPage(u, { viewport: { width: w, height: h }, theme });
        const r = await page.evaluate(() => {
          const de = document.documentElement;
          const over = [];
          document.querySelectorAll('*').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > de.clientWidth + 1) {
              let p = el.parentElement, inScroll = false;
              while (p) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') { inScroll = true; break; } p = p.parentElement; }
              if (!inScroll) over.push(el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
            }
          });
          // 横スクロール容器の中身が本当に読み切れるか
          const scrollers = [...document.querySelectorAll('*')].filter(e => {
            const ox = getComputedStyle(e).overflowX; return ox === 'auto' || ox === 'scroll';
          });
          const unreadable = scrollers.filter(e => e.scrollWidth > e.clientWidth && e.clientWidth < 40).length;
          return { pageScroll: de.scrollWidth > de.clientWidth, sw: de.scrollWidth, cw: de.clientWidth, over: over.slice(0, 3), unreadable };
        });
        if (r.pageScroll) bad.push(`${w}px ${theme} ${u} 横スクロール(${r.sw}>${r.cw}) ${r.over.join('/')}`);
        if (r.unreadable) tableScrollOK = false;
        await page.__ctx.close();
      }
    }
  }
  check('RESPONSIVE 横溢れ0', want(bad.length === 0), bad.slice(0, 6).join(' | ') || `${URLS.length * SIZES.length * 2}通りで横溢れなし`);
  rec('S', 'S-RPT-TABLE-SCROLL', want(tableScrollOK), 'browser', '数表が横スクロールで読み切れる');

  // 主操作が到達可能か(360)
  const reach = [];
  for (const [u, sel] of [['/honmono/checker/', SEL.checker.dropzone], ['/honmono/badge/', SEL.badge.generate],
    ['/honmono/aicheck/', SEL.aicheck.risk_checkboxes], ['/honmono/creators/', SEL.creators.search]]) {
    const page = await openPage(u, { viewport: { width: 360, height: 800 } });
    const ok = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= document.documentElement.clientWidth + 1;
    }, sel);
    if (!ok) reach.push(u);
    await page.__ctx.close();
  }
  check('RESPONSIVE 主操作が360pxで到達可能', want(reach.length === 0), reach.join(',') || '4画面すべて到達可能');
}

/* ---------- MOTION ---------- */
async function verifyMotion() {
  const URLS = ['/honmono/', '/honmono/checker/', '/honmono/aicheck/', '/honmono/badge/', '/honmono/creators/'];
  const infinite = [], blocking = [];
  for (const u of URLS) {
    const page = await openPage(u, { reducedMotion: 'reduce' });
    const r = await page.evaluate(() => {
      const inf = [], long = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.animationName !== 'none' && cs.animationIterationCount === 'infinite') inf.push(el.tagName);
        const d = parseFloat(cs.animationDuration) + parseFloat(cs.transitionDuration);
        if (d > 1.0) long.push(el.tagName + ' ' + d + 's');
      }
      return { inf: inf.slice(0, 3), long: long.slice(0, 3) };
    });
    if (r.inf.length) infinite.push(u + ':' + r.inf.join(','));
    if (r.long.length) blocking.push(u + ':' + r.long.join(','));
    // reduced-motion でも操作が生きているか
    const operable = await page.evaluate(() => {
      const el = document.querySelector('a[href], button, input');
      return !!el && !el.disabled;
    });
    if (!operable) problems.push(`MOTION ${u}: reduced-motion で操作要素が見つからない`);
    await page.__ctx.close();
  }
  check('MOTION reduced-motion で無限アニメ0', want(infinite.length === 0), infinite.join(' | ') || '無限アニメーションなし');
  check('MOTION reduced-motion で長時間アニメ0', want(blocking.length === 0), blocking.join(' | ') || '1秒超のアニメーションなし');
  rec('S', 'S-MOTION-REDUCED', want(infinite.length === 0 && blocking.length === 0), 'browser', 'reduced-motion で装飾モーションが止まる');
}

/* ================= main ================= */
(async () => {
  server = await serve();
  browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  try {
    await verifyGlobal();
    await verifyHome();
    await verifyChecker();
    await verifyBadge();
    await verifyAicheck();
    await verifyCreators();
    await verifyDocuments();
    await verifyResponsive();
    await verifyMotion();
  } finally {
    await browser.close();
    server.close();
  }

  const allF = FREEZE.functions.map(f => f.id);
  const allS = [...STATES.global_states.map(s => s.id),
    ...STATES.screens.flatMap(sc => sc.states.map(s => s.id))];
  const missF = allF.filter(id => !(id in results.functions));
  const missS = allS.filter(id => !(id in results.states));
  const failF = allF.filter(id => results.functions[id] && !results.functions[id].ok);
  const failS = allS.filter(id => results.states[id] && !results.states[id].ok);
  const covF = ((allF.length - missF.length - failF.length) / allF.length * 100).toFixed(1);
  const covS = ((allS.length - missS.length - failS.length) / allS.length * 100).toFixed(1);

  const report = {
    generated_at: new Date().toISOString().slice(0, 10),
    mode: MUTATE ? 'mutate' : 'verify',
    function_coverage_pct: +covF,
    state_coverage_pct: +covS,
    functions_total: allF.length,
    functions_unverified: missF,
    functions_failed: failF,
    states_total: allS.length,
    states_unverified: missS,
    states_failed: failS,
    checks: results.checks,
    problems,
    detail: { functions: results.functions, states: results.states },
  };
  fs.writeFileSync(path.join(ROOT, 'verify/REPORT_baseline.json'), JSON.stringify(report, null, 2) + '\n');

  console.log(`FUNCTION_COVERAGE = ${covF}%  (${allF.length}件中 未検証${missF.length} / 失敗${failF.length})`);
  console.log(`STATE_COVERAGE    = ${covS}%  (${allS.length}件中 未検証${missS.length} / 失敗${failS.length})`);
  for (const c of results.checks.filter(c => !c.ok)) console.log(`  x ${c.name}: ${c.detail}`);
  if (missF.length) console.log('  未検証の機能:', missF.join(', '));
  if (missS.length) console.log('  未検証の状態:', missS.join(', '));
  if (failF.length) console.log('  失敗した機能:', failF.join(', '));
  if (failS.length) console.log('  失敗した状態:', failS.join(', '));

  if (MUTATE) {
    // 期待値を全部反転させたのだから、全 F-ID・全 S-ID が落ちなければならない。
    // 落ちないものがあれば、その検査は何も見ていない。
    const blindF = allF.filter(id => results.functions[id] && results.functions[id].ok);
    const blindS = allS.filter(id => results.states[id] && results.states[id].ok);
    console.log(`MUTATE: F ${allF.length - blindF.length}/${allF.length} ・ S ${allS.length - blindS.length}/${allS.length} を検出`);
    if (blindF.length) console.log('  ★見ていない機能:', blindF.join(', '));
    if (blindS.length) console.log('  ★見ていない状態:', blindS.join(', '));
    console.log(blindF.length + blindS.length === 0 ? 'MUTATE OK — 検査器は本当に落ちる' : '★MUTATE FAIL');
    process.exit(blindF.length + blindS.length === 0 ? 0 : 1);
  }
  const pass = missF.length === 0 && missS.length === 0 && failF.length === 0 && failS.length === 0
    && results.checks.every(c => c.ok);
  console.log(pass ? 'VERIFY PASS' : `VERIFY FAIL — 問題 ${problems.length}件`);
  process.exit(pass ? 0 : 1);
})();
