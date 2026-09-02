// Phase 8 PERFORMANCE.
// モーションを入れたことで重大な劣化が起きていないかだけを見る。
//
// 【重要】再設計前と再設計後を **同じ実行の中で** 測る。
// 別々に測ると、その時のマシンの混み具合の差がそのまま数字の差になり、
// 「劣化した」と誤判定する(実際に一度これで誤判定した)。
//   - long task(50ms超のメインスレッド占有)
//   - layout shift の累積
//   - 転送量
//   - 解析中・推論中に走るアニメーションがコンポジタで完結しているか
//
//   node verify/perf.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { FIXTURE_SCRIPT } from './fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(process.env.SITE_ROOT || path.join(ROOT, '..', '..', '..'));
const PORT = 8794;

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
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm' };

function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const cands = [];
  if (dir && fs.existsSync(dir)) {
    for (const d of fs.readdirSync(dir)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) cands.push(path.join(dir, d, rel));
    }
  }
  cands.push('/usr/bin/google-chrome', '/usr/bin/chromium');
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('no chromium-based browser found');
}

function serve(root, port) {
  return new Promise(res => {
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rep.writeHead(404); rep.end('nf'); return; }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    s.listen(port, () => res(s));
  });
}

// 再設計直前のコミットの中身を取り出す。取れなければ比較しない。
const BASELINE_REF = process.env.BASELINE_REF || 'a9d5144';
function exportBaseline() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'honmono-perf-base-'));
  try {
    const tar = execFileSync('git', ['archive', BASELINE_REF], { cwd: REPO, maxBuffer: 1 << 30 });
    const tarPath = path.join(dir, 'site.tar');
    fs.writeFileSync(tarPath, tar);
    execFileSync('tar', ['-xf', tarPath, '-C', dir]);
    fs.unlinkSync(tarPath);
    return dir;
  } catch (e) {
    console.log('基準線のコミット(%s)を取り出せなかった: %s', BASELINE_REF, e.message);
    fs.rmSync(dir, { recursive: true, force: true });
    return null;
  }
}

const OBSERVE = () => {
  window.__perf = { longTasks: [], cls: 0 };
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.longTasks.push(Math.round(e.duration)); })
      .observe({ type: 'longtask', buffered: true });
  } catch { /* 未対応ブラウザ */ }
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* 未対応ブラウザ */ }
};

(async () => {
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--no-sandbox'] });
  const PAGES = ['/honmono/', '/honmono/checker/', '/honmono/aicheck/', '/honmono/badge/',
    '/honmono/creators/', '/honmono/report/', '/honmono/business/', '/honmono/docs/'];

  // 1ページを測る
  async function measurePage(base, url) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.addInitScript(OBSERVE);
    let bytes = 0;
    page.on('response', async r => {
      try { const b = await r.body(); bytes += b.length; } catch { /* リダイレクト等 */ }
    });
    const t0 = Date.now();
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const perf = await page.evaluate(() => ({
      longTasks: window.__perf.longTasks,
      cls: +window.__perf.cls.toFixed(4),
      nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.domContentLoadedEventEnd) : null; })(),
    }));
    await ctx.close();
    return {
      url, ms_to_networkidle: Date.now() - t0, transferred_kb: Math.round(bytes / 1024),
      dom_content_loaded_ms: perf.nav,
      long_tasks_over_50ms: perf.longTasks.filter(d => d > 50),
      cumulative_layout_shift: perf.cls,
    };
  }

  function summarize(pages) {
    return {
      transferred_kb: Math.max(...pages.map(r => r.transferred_kb)),
      long_tasks_over_50ms: pages.reduce((n, r) => n + r.long_tasks_over_50ms.length, 0),
      max_cls: Math.max(...pages.map(r => r.cumulative_layout_shift)),
      worst_long_task_ms: Math.max(0, ...pages.flatMap(r => r.long_tasks_over_50ms)),
    };
  }

  // 再設計前と後を交互に測る。マシンの混み具合を両方に等しく浴びせるため。
  const baseDir = exportBaseline();
  const nowServer = await serve(REPO, PORT);
  const nowBase = 'http://127.0.0.1:' + PORT;
  let baseServer = null, baseUrl = null;
  if (baseDir) {
    baseServer = await serve(baseDir, PORT + 1);
    baseUrl = 'http://127.0.0.1:' + (PORT + 1);
  }

  const nowPages = [], basePages = [];
  for (const url of PAGES) {
    nowPages.push(await measurePage(nowBase, url));
    if (baseUrl) basePages.push(await measurePage(baseUrl, url));
  }

  // 解析中に走るアニメーションが、レイアウトを動かさないか
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(OBSERVE);
  await page.goto(nowBase + '/honmono/checker/', { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: FIXTURE_SCRIPT });
  await page.evaluate(() => {
    window.__slow = analyze;
    window.analyze = async f => { await new Promise(r => setTimeout(r, 2500)); return window.__slow(f); };
    window.handle(window.__mk.camera());
  });
  await page.waitForTimeout(1500);
  const wait = await page.evaluate(() => {
    const el = document.querySelector('.wait-rail__highlight');
    const cs = el && getComputedStyle(el);
    return {
      animating: !!el,
      // transform / opacity 以外を動かしていないこと
      animation_name: cs ? cs.animationName : null,
      cls_during_wait: +window.__perf.cls.toFixed(4),
      long_tasks_during_wait: window.__perf.longTasks.filter(d => d > 50),
    };
  });
  await page.waitForTimeout(1500);
  await ctx.close();

  await browser.close();
  nowServer.close();
  if (baseServer) baseServer.close();
  if (baseDir) fs.rmSync(baseDir, { recursive: true, force: true });

  const after = summarize(nowPages);
  const report = {
    generated_at: new Date().toISOString().slice(0, 10),
    note: '固定条件 390x844 / DPR3 / ローカル配信。再設計前(' + BASELINE_REF + ')と'
        + '同じ実行の中で交互に測っている。マシンの混み具合の差で誤判定しないため。',
    baseline_ref: BASELINE_REF,
    pages: nowPages,
    baseline_pages: basePages,
    analysis_wait: wait,
    worst: after,
  };

  let verdict = { compared: false };
  if (basePages.length) {
    const before = summarize(basePages);
    verdict = {
      compared: true, measured_in_same_run: true,
      long_tasks: { before: before.long_tasks_over_50ms, after: after.long_tasks_over_50ms },
      worst_long_task_ms: { before: before.worst_long_task_ms, after: after.worst_long_task_ms },
      max_cls: { before: before.max_cls, after: after.max_cls },
      transferred_kb: { before: before.transferred_kb, after: after.transferred_kb },
    };
    verdict.pass =
      after.max_cls <= before.max_cls + 0.05 &&
      after.long_tasks_over_50ms <= before.long_tasks_over_50ms + 2 &&
      after.worst_long_task_ms <= before.worst_long_task_ms * 1.5 + 40;
  }
  report.regression_check = verdict;
  fs.writeFileSync(path.join(HERE, 'REPORT_perf.json'), JSON.stringify(report, null, 2) + '\n');

  console.log('転送量の最大: %d KB', after.transferred_kb);
  console.log('50ms超の long task 合計: %d 件 / 最悪 %d ms',
    after.long_tasks_over_50ms, after.worst_long_task_ms);
  console.log('layout shift の最大: %s', after.max_cls);
  console.log('解析中の待ち表示:', JSON.stringify(wait));
  if (!verdict.compared) {
    console.log('基準線を測れなかったので比較していない');
    process.exit(1);
  }
  console.log('同じ実行の中での比較:', JSON.stringify(verdict, null, 1));
  console.log(verdict.pass ? 'PERFORMANCE PASS — 再設計前より悪化していない' : 'PERFORMANCE FAIL — 劣化している');
  process.exit(verdict.pass ? 0 : 1);
})();
