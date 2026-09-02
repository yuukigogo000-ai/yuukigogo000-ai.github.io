// Phase 9 POST IMPLEMENT CAPTURE.
// 実装後の画面だけを撮る(改善前のスクリーンショットは Design Authority へ戻さない)。
//
//   node verify/capture.mjs
//
// 出力: verify/captures/*.png と motion_evidence.json
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { FIXTURE_SCRIPT } from './fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(process.env.SITE_ROOT || path.join(ROOT, '..', '..', '..'));
const OUT = path.join(HERE, 'captures');
const PORT = 8793;

const require_ = createRequire(import.meta.url);
function loadPlaywright() {
  for (const spec of [process.env.PLAYWRIGHT_CORE, 'playwright-core',
    path.join(REPO, 'tests/node_modules/playwright-core')]) {
    if (!spec) continue;
    try { return require_(spec); } catch { /* 次を試す */ }
  }
  throw new Error('playwright-core が見つかりません');
}
const { chromium } = loadPlaywright();

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm' };

function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const cands = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'];
  if (dir && fs.existsSync(dir)) {
    for (const d of fs.readdirSync(dir)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) cands.push(path.join(dir, d, rel));
    }
  }
  cands.push('/usr/bin/google-chrome', '/usr/bin/chromium');
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('no chromium-based browser found');
}

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(REPO, p);
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rep.writeHead(404); rep.end('nf'); return; }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    s.listen(PORT, () => res(s));
  });
}

const shots = [];

async function shot(page, name, opts = {}) {
  const p = path.join(OUT, name + '.png');
  await page.screenshot({ path: p, fullPage: !!opts.full });
  shots.push(name);
  console.log('  ', name);
}

async function feed(page, kind) {
  await page.evaluate(k => {
    const f = window.__mk[k]();
    const dt = new DataTransfer();
    dt.items.add(f);
    const input = document.querySelector('#file');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, kind);
  await page.waitForTimeout(500);
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--no-sandbox'] });
  const base = 'http://127.0.0.1:' + PORT;

  async function open(url, w, theme, reduce) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 }, deviceScaleFactor: 2,
      colorScheme: theme, reducedMotion: reduce ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: FIXTURE_SCRIPT });
    page.__ctx = ctx;
    return page;
  }

  // --- 390: HOME ---
  for (const theme of ['light', 'dark']) {
    const p = await open('/honmono/', 390, theme);
    await p.waitForTimeout(600);
    await shot(p, `390_home_${theme}`, { full: true });
    await p.__ctx.close();
  }

  // --- 390: CHECKER の各状態 ---
  for (const theme of ['light', 'dark']) {
    const p = await open('/honmono/checker/', 390, theme);
    await shot(p, `390_checker_idle_${theme}`, { full: true });

    // 受け取り可能であることを示す状態
    await p.evaluate(() => document.querySelector('#drop').dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true })));
    await p.waitForTimeout(200);
    await shot(p, `390_checker_dragover_${theme}`);
    await p.evaluate(() => document.querySelector('#drop').dispatchEvent(new DragEvent('dragleave', { bubbles: true })));

    // 解析中(結果を確定させる前に撮る)
    await p.evaluate(() => { window.__slow = analyze; window.analyze = async f => { await new Promise(r => setTimeout(r, 4000)); return window.__slow(f); }; });
    p.evaluate(() => window.handle(window.__mk.camera()));
    await p.waitForTimeout(600);
    await shot(p, `390_checker_processing_${theme}`);
    await p.waitForTimeout(4200);
    await p.evaluate(() => { window.analyze = window.__slow; });

    for (const [kind, label] of [['camera', 'ok'], ['ai', 'bad'], ['unknown', 'neutral'], ['weak', 'warn']]) {
      await feed(p, kind);
      await shot(p, `390_checker_result_${label}_${theme}`, { full: true });
    }

    // 実験機能の3段階(推論だけ差し替え。90MBは落とさない)
    for (const [pv, tag] of [[0.95, 'high'], [0.6, 'mid'], [0.1, 'low']]) {
      await feed(p, 'camera');
      await p.evaluate(async v => {
        window.HonmonoPixel.predict = async (f, cb) => { cb && cb(9e7, 9e7); return { pAI: v, probs: [v, 1 - v], backend: 'wasm', ms: 812 }; };
        document.querySelector('#pixelRun').click();
        await new Promise(r => setTimeout(r, 250));
        document.querySelector('#pixelCard').scrollIntoView();
      }, pv);
      await p.waitForTimeout(300);
      await shot(p, `390_checker_lab_${tag}_${theme}`);
    }

    // 受け取れない / 解析できない
    await p.evaluate(() => window.handle({ name: 'huge.mp4', size: 400 * 1024 * 1024, type: 'video/mp4' }));
    await p.waitForTimeout(200);
    await shot(p, `390_checker_toolarge_${theme}`);
    await feed(p, 'broken');
    await shot(p, `390_checker_error_${theme}`);
    await p.__ctx.close();
  }

  // --- 390: AICHECK の3帯 ---
  for (const theme of ['light', 'dark']) {
    const p = await open('/honmono/aicheck/', 390, theme);
    await shot(p, `390_aicheck_none_${theme}`);
    for (const [n, tag] of [[1, 'mid'], [2, 'high']]) {
      await p.evaluate(k => {
        const all = [...document.querySelectorAll('input[data-kind="risk"]')];
        all.forEach(e => { e.checked = false; });
        all.filter(e => +e.dataset.w >= 4).slice(0, k).forEach(e => {
          e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true }));
        });
        window.scrollTo(0, 300);
      }, n);
      await p.waitForTimeout(300);
      await shot(p, `390_aicheck_${tag}_${theme}`);
    }
    // 持ち出し警告が持ち出し操作より前にあること
    await p.evaluate(() => document.querySelector('#exposureWarning').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(200);
    await shot(p, `390_aicheck_exposure_${theme}`);
    await p.__ctx.close();
  }

  // --- 390: BADGE / CREATORS ---
  for (const theme of ['light', 'dark']) {
    const p = await open('/honmono/badge/', 390, theme);
    await shot(p, `390_badge_empty_${theme}`, { full: true });
    await p.fill('#name', '見本の活動名');
    await p.fill('#links', 'https://example.com/a\nhttps://example.com/b');
    await p.fill('#proofUrl', 'https://example.com/proof.html');
    await p.click('#generate');
    await p.waitForTimeout(700);
    await shot(p, `390_badge_generated_${theme}`, { full: true });
    await p.__ctx.close();

    const c = await open('/honmono/creators/', 390, theme);
    await shot(c, `390_creators_${theme}`, { full: true });
    await c.fill('#q', 'zzz該当なしzzz');
    await c.waitForTimeout(250);
    await shot(c, `390_creators_empty_${theme}`);
    await c.__ctx.close();
  }

  // --- 390: DOCUMENT ---
  for (const [url, name] of [['/honmono/report/', 'report'], ['/honmono/business/', 'business'],
    ['/honmono/docs/', 'docs'], ['/honmono/legal/terms.html', 'terms']]) {
    const p = await open(url, 390, 'light');
    await shot(p, `390_${name}_light`, { full: true });
    await p.__ctx.close();
  }

  // --- メニュー ---
  for (const theme of ['light', 'dark']) {
    const p = await open('/honmono/checker/', 390, theme);
    await p.click('#menuBtn');
    await p.waitForTimeout(400);
    await shot(p, `390_menu_${theme}`);
    await p.__ctx.close();
  }

  // --- 360 / 430: HOME と主要な結果 ---
  for (const w of [360, 430]) {
    const h = await open('/honmono/', w, 'light');
    await h.waitForTimeout(500);
    await shot(h, `${w}_home_light`, { full: true });
    await h.__ctx.close();
    const c = await open('/honmono/checker/', w, 'light');
    await feed(c, 'unknown');
    await shot(c, `${w}_checker_result_light`, { full: true });
    await c.__ctx.close();
    const r = await open('/honmono/report/', w, 'light');
    await shot(r, `${w}_report_light`, { full: true });
    await r.__ctx.close();
  }

  // --- モーションの証跡 ---
  const motion = [];
  {
    const p = await open('/honmono/checker/', 390, 'light');
    // M-06 待ちレール: 無限ループだがCSSのみ・解析が終われば消える
    p.evaluate(() => { window.__slow = analyze; window.analyze = async f => { await new Promise(r => setTimeout(r, 2500)); return window.__slow(f); }; window.handle(window.__mk.camera()); });
    await p.waitForTimeout(400);
    const a = await p.evaluate(() => {
      const el = document.querySelector('.wait-rail__highlight');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { present: true, name: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount, props: 'transform' };
    });
    motion.push({ id: 'M-06', desc: '解析中の待ちレール', measured: a });
    await p.waitForTimeout(600);
    await shot(p, '390_motion_M06_wait');
    await p.waitForTimeout(2200);
    const after = await p.evaluate(() => !!document.querySelector('.wait-rail__highlight'));
    motion.push({ id: 'M-06', desc: '解析が終わると待ちレールは消える', measured: { stillPresent: after } });
    await p.__ctx.close();
  }
  {
    // reduced-motion では装飾モーションが止まり、操作は生きている
    const p = await open('/honmono/', 390, 'light', true);
    const r = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.animationName !== 'none' && cs.animationIterationCount === 'infinite') out.push(el.className);
      }
      return { infinite: out, ctaClickable: !!document.querySelector('a.btn') };
    });
    motion.push({ id: 'reduced-motion', desc: 'HOME で無限アニメーション0・主操作は健在', measured: r });
    await shot(p, '390_motion_reduced_home', { full: true });
    await p.__ctx.close();
  }
  {
    // M-11 スコアの入れ替わり
    const p = await open('/honmono/aicheck/', 390, 'light');
    const r = await p.evaluate(async () => {
      const el = document.querySelector('input[data-kind="risk"]');
      el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 30));
      const n = document.querySelector('#scoreNum');
      const cs = getComputedStyle(n);
      return { classApplied: n.classList.contains('bump'), name: cs.animationName, dur: cs.animationDuration };
    });
    motion.push({ id: 'M-11', desc: 'スコア更新のフィードバック', measured: r });
    await p.__ctx.close();
  }

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, 'motion_evidence.json'),
    JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), motion, shots }, null, 2) + '\n');
  console.log('撮影 %d 枚 → %s', shots.length, OUT);
})();
