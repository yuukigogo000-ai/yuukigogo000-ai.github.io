// 実ブラウザで通しプレイ(NODE_PATH=$(npm root -g) node browser-check.mjs [画像の出力先])
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url)), shots = process.argv[2] || dir;
const url = pathToFileURL(path.join(dir, 'index.html')).href, out = {};
const browser = await chromium.launch();
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const vp of [{ w: 360, h: 800 }, { w: 390, h: 844 }]) for (const scheme of ['light', 'dark']) {
  const key = `${vp.w}x${vp.h}-${scheme}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(shots, `ps-${key}-title.png`) });
  const layout = await page.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, canvas: [Math.round(c.width), Math.round(c.height)] }; });
  await page.locator('#panel button', { hasText: 'はじめる' }).first().click();
  await page.locator('#panel button', { hasText: 'はじめる' }).first().click(); // フロアの案内を閉じる
  // 1 手目はスワイプで入力できるか確かめる
  const box = await page.locator('#cv').boundingBox();
  const first = await page.evaluate(() => globalThis.__ps().suggest);
  const d = { up: [0, -90], down: [0, 90], left: [-90, 0], right: [90, 0] }[first.dir];
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + d[0], box.y + box.height / 2 + d[1], { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(() => !globalThis.__ps().animating, null, { timeout: 20000 });
  const swipeWorked = await page.evaluate(() => { const s = globalThis.__ps(); return s.panelOpen || s.state.turn > 1 || s.state.phase !== 'play'; });
  let steps = 0, upgrades = 0, shot = false;
  for (; steps < 700; steps++) {
    const st = await page.evaluate(() => { const s = globalThis.__ps(); return { over: s.run ? s.run.over : 'none', panel: s.panelOpen, floor: s.run ? s.run.floor : -1, suggest: s.suggest, animating: s.animating }; });
    if (st.over === 'won' || st.over === 'lost') break;
    if (st.panel) {
      if (await page.locator('#panel .choice').count()) { await page.locator('#panel .choice').first().click(); upgrades++; }
      else await page.locator('#panel button.primary').first().click();
      continue;
    }
    if (st.floor === 4 && !shot) { await page.screenshot({ path: path.join(shots, `ps-${key}-boss.png`) }); shot = true; }
    if (steps === 3) await page.screenshot({ path: path.join(shots, `ps-${key}-play.png`) });
    if (st.suggest.brake) await page.click('#brake');
    await page.keyboard.press(KEY[st.suggest.dir]);
    await page.waitForFunction(() => !globalThis.__ps().animating, null, { timeout: 20000 });
  }
  const end = await page.evaluate(() => { const s = globalThis.__ps(); return { over: s.run.over, floor: s.run.floor, turns: s.run.stats.turns, ups: Object.keys(s.run.ups).length, saved: !!localStorage.getItem('penguin-sumo.v1') }; });
  await page.screenshot({ path: path.join(shots, `ps-${key}-end.png`) });
  out[key] = { noHScroll: layout.sw <= layout.iw, noVScroll: layout.sh <= layout.ih, canvas: layout.canvas, swipeWorked, steps, upgrades, end, errors };
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(dir, 'results-browser.json'), JSON.stringify(out, null, 2) + '\n');
for (const k of Object.keys(out)) console.log(k, JSON.stringify(out[k]));
