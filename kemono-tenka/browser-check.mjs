// 実ブラウザで通しプレイとオフライン確認(NODE_PATH=$(npm root -g) node browser-check.mjs [画像の出力先])
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url)), shots = process.argv[2] || dir, out = {};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html', file = path.join(dir, rel);
  if (!file.startsWith(dir) || !existsSync(file) || !TYPES[path.extname(file)]) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] }); res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();
let n = 0;
for (const vp of [{ w: 360, h: 800 }, { w: 390, h: 844 }]) for (const scheme of ['light', 'dark']) {
  const key = `${vp.w}x${vp.h}-${scheme}`, clanIdx = n % 4, diff = ['やさしい', 'ふつう', 'むずかしい'][n % 3]; n++;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(200);
  const layout = async () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  const l0 = await layout();
  await page.screenshot({ path: path.join(shots, `kt-${key}-title.png`) });
  await page.locator('#panel .grid2 .choice').nth(clanIdx).click();
  await page.locator('#panel .grid3 .choice', { hasText: diff }).click();
  await page.locator('#panel button', { hasText: 'はじめる' }).first().click();
  await page.locator('#panel button', { hasText: 'はじめる' }).first().click();
  // 手で操作できるか: 本拠(左下)をタップ → 徴兵
  const box = await page.locator('#cv').boundingBox();
  await page.mouse.click(box.x + box.width / 6, box.y + box.height * 7 / 8);
  await page.screenshot({ path: path.join(shots, `kt-${key}-select.png`) });
  await page.locator('#acts button', { hasText: '徴兵' }).click();
  const manual = await page.evaluate(() => globalThis.__kt().state.ordersLeft === 2);
  // となりの国をタップして、出陣の確かめが出るか
  await page.mouse.click(box.x + box.width / 6, box.y + box.height * 5 / 8);
  const marchUi = await page.locator('#acts button', { hasText: '全軍' }).count();
  await page.locator('#acts button', { hasText: 'やめる' }).click();
  let steps = 0, events = 0, reports = 0, shot = false, l1 = l0;
  for (; steps < 900; steps++) {
    const st = await page.evaluate(() => { const k = globalThis.__kt(); return { phase: k.state.phase, turn: k.state.turn, panel: k.panelOpen, adv: k.advice.length, title: k.panelOpen ? document.querySelector('#panel h2') && document.querySelector('#panel h2').textContent : '' }; });
    if (st.phase === 'over') break;
    if (st.panel) {
      if (await page.locator('#panel .choice').count()) { await page.locator('#panel .choice').first().click(); events++; }
      else { await page.locator('#panel button.primary').first().click(); reports++; }
      continue;
    }
    if (st.turn === 6 && !shot) { await page.screenshot({ path: path.join(shots, `kt-${key}-mid.png`) }); shot = true; l1 = await layout(); }
    if (st.adv > 0) { await page.click('#advice'); await page.locator('#panel .choice').first().click(); }
    else await page.click('#end');
  }
  const end = await page.evaluate(() => { const s = globalThis.__kt().state; return { phase: s.phase, turn: s.turn, won: s.winner === s.player, reason: s.endReason, saved: !!localStorage.getItem('kemono-tenka.v1') }; });
  await page.screenshot({ path: path.join(shots, `kt-${key}-end.png`) });
  out[key] = { clan: clanIdx, diff, noHScroll: l0.sw <= l0.iw && l1.sw <= l1.iw, noVScroll: l0.sh <= l0.ih && l1.sh <= l1.ih, manualRecruit: manual, marchConfirmShown: marchUi === 1, steps, end, errors };
  await ctx.close();
}
// オフライン: 1 回開いてから通信を切って再読み込み。続きから再開できるか
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  await page.locator('#panel button', { hasText: 'はじめる' }).first().click();
  await page.locator('#panel button', { hasText: 'はじめる' }).first().click();
  await page.click('#end');
  await ctx.setOffline(true);
  let offlineOk = false, resume = 0;
  try { await page.reload({ timeout: 15000 }); offlineOk = await page.locator('#panel button', { hasText: 'はじめる' }).first().isVisible(); resume = await page.locator('#panel button', { hasText: 'つづきから' }).count(); } catch (e) { errors.push(String(e).slice(0, 120)); }
  let resumed = false;
  if (resume) { await page.locator('#panel button', { hasText: 'つづきから' }).click(); resumed = await page.evaluate(() => { const k = globalThis.__kt(); return !!k.state && k.state.turn === 2; }); }
  out.offline = { controlled, offlineOk, resumeShown: resume === 1, resumedAtTurn2: resumed, errors };
}
await browser.close(); server.close();
writeFileSync(path.join(dir, 'results-browser.json'), JSON.stringify(out, null, 2) + '\n');
for (const k of Object.keys(out)) console.log(k, JSON.stringify(out[k]));
