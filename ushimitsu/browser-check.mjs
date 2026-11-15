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
const um = (page, fn) => page.evaluate(fn);
// 画面のボタンだけで 1 手打つ(札を選ぶ → 相手を選ぶ → ＋で刻を合わせる → 決める)
async function move(page) {
  const o = await um(page, () => globalThis.__um().best()); if (!o) return false;
  const b = typeof o.a === 'number' ? page.locator('#cards button').nth(o.a) : page.locator('#basics button').nth(o.a === 'utsu' ? 0 : 1);
  await b.click();
  if (o.target !== undefined && o.target >= 0) { const f = page.locator(`#foes .foe[data-id="${o.target}"]`); if (await f.count()) await f.click(); }
  for (let i = 0; i < 4; i++) { const k = await um(page, () => globalThis.__um().sel && globalThis.__um().sel.k); if (k === o.k) break; await page.click(k < o.k ? '#more' : '#less'); }
  await page.click('#go');
  await page.waitForFunction(() => !globalThis.__um().busy, null, { timeout: 20000 });
  return true;
}
let n = 0;
for (const vp of [{ w: 360, h: 800 }, { w: 390, h: 844 }]) for (const scheme of ['light', 'dark']) {
  const key = `${vp.w}x${vp.h}-${scheme}`, charIdx = n % 3, diffIdx = [0, 1, 0, 2][n]; n++;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(200);
  const layout = async () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  const fits = async () => page.evaluate(() => { const p = document.querySelector('#panel'); return p.hidden || p.scrollHeight <= p.clientHeight + 1; });
  const shot = (name) => page.screenshot({ path: path.join(shots, `um-${key}-${name}.png`) });
  const seen = {}, fit = {};
  await shot('title'); fit.title = await fits();
  await page.locator('#panel .choice').nth(charIdx).click();
  await page.locator('#panel .grid3 button').nth(diffIdx).click();
  await page.locator('#panel button', { hasText: '夜回りに出る' }).click();
  await shot('intro'); fit.intro = await fits();
  await page.locator('#panel button', { hasText: '歩きだす' }).click();
  await shot('map'); fit.map = await fits();
  const l0 = await layout();
  // 最初の戦いは、動きを飛ばさずに、手で針を引っぱって打つ
  await page.locator('#panel .hour.now .choice').first().click();
  await page.locator('#basics button').first().click();
  const box = await page.locator('#cv').boundingBox();
  const t0 = await um(page, () => globalThis.__um().run.battle.t);
  // いまの針(刻 0 = てっぺん)から 3 刻ぶん先 = 右(3 時の向き)へ引っぱる
  await page.mouse.move(box.x + box.width / 2, box.y + 30); await page.mouse.down(); await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2, { steps: 5 }); await page.mouse.up();
  const dragK = await um(page, () => globalThis.__um().sel.k);
  await shot('battle'); const l1 = await layout();
  const info = await page.locator('#info').textContent();
  await page.click('#go');
  const wasBusy = await um(page, () => globalThis.__um().busy);
  await page.waitForFunction(() => !globalThis.__um().busy, null, { timeout: 20000 });
  const t1 = await um(page, () => { const u = globalThis.__um(); return u.run.battle ? u.run.battle.t : -1; });
  await um(page, () => globalThis.__um().setFast(true));
  let steps = 0, shopBought = false;
  for (; steps < 1500; steps++) {
    const st = await um(page, () => { const u = globalThis.__um(); return { phase: u.run ? u.run.phase : 'none', sub: u.sub, panel: u.panelOpen, step: u.run ? u.run.step : -1, hp: u.run ? u.run.hp : 0, max: u.run ? u.run.maxHp : 1 }; });
    if (st.phase === 'over' && !st.sub) break;
    if (st.sub) { await page.locator('#panel button.primary').first().click(); continue; }
    if (st.phase === 'battle') { if (!seen.battle2 && st.step >= 4) { seen.battle2 = true; await shot('battle-mid'); } if (!seen.battle3 && await page.locator('#foes .foe').count() >= 2) { seen.battle3 = true; await page.locator('#cards button').first().click(); await shot('battle-multi'); } await move(page); continue; }
    if (!seen[st.phase]) { seen[st.phase] = true; await shot(st.phase); fit[st.phase] = await fits(); }
    if (st.phase === 'map') { const c = page.locator('#panel .hour.now .choice'), cnt = await c.count(); await c.nth(cnt > 1 && (charIdx === 1 || st.hp < st.max * 0.6 || st.step % 2 === 1) ? 1 : 0).click(); }
    else if (st.phase === 'reward') await page.locator('#panel .choice').first().click();
    else if (st.phase === 'shop') { const it = page.locator('#panel .item:not([disabled])'); if (!shopBought && await it.count()) { shopBought = true; await it.first().click(); if (await um(page, () => globalThis.__um().sub)) await page.locator('#panel .choice').first().click(); } else { shopBought = false; await page.locator('#panel button.primary').click(); } }
    else if (st.phase === 'rest') await page.locator('#panel .choice').first().click();
    else if (st.phase === 'event') await page.locator('#panel .choice:not([disabled])').first().click();
  }
  await shot('end'); fit.end = await fits();
  const end = await um(page, () => { const r = globalThis.__um().run; return { phase: r.phase, result: r.result, deck: r.deck.length, relics: r.relics.length, fights: r.stats.fights, saved: !!localStorage.getItem('ushimitsu.v1'), ending: document.querySelector('#panel h2').textContent }; });
  // もちものの画面
  out[key] = { char: charIdx, diff: diffIdx, noHScroll: l0.sw <= l0.iw && l1.sw <= l1.iw, noVScroll: l0.sh <= l0.ih && l1.sh <= l1.ih, dragSetsTicks: dragK === 3, forecastShown: /刻/.test(info) && /無傷|受ける|勝ち/.test(info),
    animated: wasBusy, clockMoved: t1 - t0 === 3 || t1 === -1, steps, seen: Object.keys(seen), fit, end, errors };
  await ctx.close();
}
// オフライン: 1 回開いてから通信を切って再読み込み。続きから再開できるか
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  await page.locator('#panel button', { hasText: '夜回りに出る' }).click();
  await page.locator('#panel button', { hasText: '歩きだす' }).click();
  await page.locator('#panel .hour.now .choice').first().click();
  await um(page, () => globalThis.__um().setFast(true));
  await move(page);
  const before = await um(page, () => { const b = globalThis.__um().run.battle; return b ? b.t + ':' + b.hp : 'x'; });
  // もちもの
  await page.click('#bag'); const bagShown = await page.locator('#panel h2', { hasText: 'もちもの' }).count(); await page.locator('#panel button', { hasText: 'とじる' }).click();
  await ctx.setOffline(true);
  let offlineOk = false, resume = 0;
  try { await page.reload({ timeout: 15000 }); offlineOk = await page.locator('#panel button', { hasText: '夜回りに出る' }).isVisible(); resume = await page.locator('#panel button', { hasText: 'つづきから' }).count(); } catch (e) { errors.push(String(e)); }
  let resumed = false;
  if (resume) { await page.locator('#panel button', { hasText: 'つづきから' }).click(); resumed = (await um(page, () => { const b = globalThis.__um().run.battle; return b ? b.t + ':' + b.hp : 'x'; })) === before; }
  out.offline = { controlled, offlineOk, resumeShown: resume === 1, resumedSameState: resumed, bagShown: bagShown === 1, errors };
}
await browser.close(); server.close();
writeFileSync(path.join(dir, 'results-browser.json'), JSON.stringify(out, null, 2) + '\n');
for (const k of Object.keys(out)) console.log(k, JSON.stringify(out[k]));
