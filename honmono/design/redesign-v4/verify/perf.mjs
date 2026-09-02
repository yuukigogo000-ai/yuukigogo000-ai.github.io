// Phase 8 PERFORMANCE.
// モーションを入れたことで重大な劣化が起きていないかだけを見る。
//   - long task(50ms超のメインスレッド占有)
//   - layout shift の累積
//   - 転送量
//   - 解析中・推論中に走るアニメーションがコンポジタで完結しているか
//
//   node verify/perf.mjs
import fs from 'fs';
import path from 'path';
import http from 'http';
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
  const server = await serve();
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--no-sandbox'] });
  const results = [];
  const PAGES = ['/honmono/', '/honmono/checker/', '/honmono/aicheck/', '/honmono/badge/',
    '/honmono/creators/', '/honmono/report/', '/honmono/business/', '/honmono/docs/'];

  for (const url of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.addInitScript(OBSERVE);
    let bytes = 0;
    page.on('response', async r => {
      try { const b = await r.body(); bytes += b.length; } catch { /* リダイレクト等 */ }
    });
    const t0 = Date.now();
    await page.goto('http://127.0.0.1:' + PORT + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const perf = await page.evaluate(() => ({
      longTasks: window.__perf.longTasks,
      cls: +window.__perf.cls.toFixed(4),
      nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.domContentLoadedEventEnd) : null; })(),
    }));
    results.push({
      url, ms_to_networkidle: Date.now() - t0, transferred_kb: Math.round(bytes / 1024),
      dom_content_loaded_ms: perf.nav,
      long_tasks_over_50ms: perf.longTasks.filter(d => d > 50),
      cumulative_layout_shift: perf.cls,
    });
    await ctx.close();
  }

  // 解析中に走るアニメーションが、レイアウトを動かさないか
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(OBSERVE);
  await page.goto('http://127.0.0.1:' + PORT + '/honmono/checker/', { waitUntil: 'networkidle' });
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
      properties: cs ? cs.animationName : null,
      transition_property: cs ? cs.transitionProperty : null,
      cls_during_wait: +window.__perf.cls.toFixed(4),
      long_tasks_during_wait: window.__perf.longTasks.filter(d => d > 50),
    };
  });
  await page.waitForTimeout(1500);
  await ctx.close();

  await browser.close();
  server.close();

  const report = {
    generated_at: new Date().toISOString().slice(0, 10),
    note: '固定条件 390x844 / DPR3 / ローカル配信。ネットワークの実測ではなく、'
        + 'モーション導入によるメインスレッドとレイアウトへの影響を見るためのもの。',
    pages: results,
    analysis_wait: wait,
    worst: {
      transferred_kb: Math.max(...results.map(r => r.transferred_kb)),
      long_tasks_over_50ms: results.reduce((n, r) => n + r.long_tasks_over_50ms.length, 0),
      max_cls: Math.max(...results.map(r => r.cumulative_layout_shift)),
    },
  };
  // 判定は「0件かどうか」ではなく「再設計前より悪くなっていないか」で見る。
  // ページを開けば必ず parse と初回レイアウトで long task は出る。
  const basePath = path.join(HERE, 'REPORT_perf_baseline.json');
  let verdict = { compared: false };
  if (fs.existsSync(basePath)) {
    const b = JSON.parse(fs.readFileSync(basePath, 'utf8'));
    const worstTask = r => Math.max(0, ...r.pages.flatMap(p => p.long_tasks_over_50ms));
    verdict = {
      compared: true,
      long_tasks: { before: b.worst.long_tasks_over_50ms, after: report.worst.long_tasks_over_50ms },
      worst_long_task_ms: { before: worstTask(b), after: worstTask(report) },
      max_cls: { before: b.worst.max_cls, after: report.worst.max_cls },
      transferred_kb: { before: b.worst.transferred_kb, after: report.worst.transferred_kb },
    };
    verdict.pass =
      report.worst.max_cls <= b.worst.max_cls + 0.05 &&
      report.worst.long_tasks_over_50ms <= b.worst.long_tasks_over_50ms + 2 &&
      worstTask(report) <= worstTask(b) * 1.25 + 20;
  }
  report.regression_check = verdict;
  fs.writeFileSync(path.join(HERE, 'REPORT_perf.json'), JSON.stringify(report, null, 2) + '\n');

  console.log('転送量の最大: %d KB', report.worst.transferred_kb);
  console.log('50ms超の long task 合計: %d 件', report.worst.long_tasks_over_50ms);
  console.log('layout shift の最大: %s', report.worst.max_cls);
  console.log('解析中の待ち表示:', JSON.stringify(wait));
  if (!verdict.compared) {
    console.log('基準線が無いので比較できない(REPORT_perf_baseline.json を置いてください)');
    process.exit(1);
  }
  console.log('基準線との比較:', JSON.stringify(verdict, null, 1));
  console.log(verdict.pass ? 'PERFORMANCE PASS — 再設計前より悪化していない' : 'PERFORMANCE FAIL — 劣化している');
  process.exit(verdict.pass ? 0 : 1);
})();
