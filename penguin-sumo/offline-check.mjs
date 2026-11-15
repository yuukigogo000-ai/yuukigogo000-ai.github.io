// オフラインで開けるかの確認(NODE_PATH=$(npm root -g) node offline-check.mjs)
// 小さなサーバーでこのフォルダを配信し、1 回開いてから通信を切って再読み込みする。
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(dir, rel);
  if (!file.startsWith(dir) || !existsSync(file) || !TYPES[path.extname(file)]) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] }); res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
// 効果音: 最初の操作のあとに音の準備ができるか
await page.locator('#panel button', { hasText: 'はじめる' }).first().click();
const sound = await page.evaluate(() => globalThis.__psSound());
await ctx.setOffline(true);
let offlineOk = false, title = '';
try { await page.reload({ timeout: 15000 }); title = await page.title(); offlineOk = await page.locator('#panel button', { hasText: 'はじめる' }).first().isVisible(); } catch (e) { errors.push('offline reload: ' + String(e).slice(0, 120)); }
const resumeShown = offlineOk ? await page.locator('#panel button', { hasText: 'つづきから' }).count() : 0;
await browser.close(); server.close();
const out = { controlled, offlineOk, title, resumeShownAfterReload: resumeShown === 1, soundOn: sound.on, soundStarted: sound.started, errors };
console.log(JSON.stringify(out));
if (!controlled || !offlineOk || errors.length) process.exitCode = 1;
