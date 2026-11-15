// 仮の戦闘画面を実ブラウザで確認(NODE_PATH=$(npm root -g) node browser-check.mjs [画像の出力先])
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url)), shots = process.argv[2] || dir;
const url = pathToFileURL(path.join(dir, 'index.html')).href, out = {};
const browser = await chromium.launch();
const STAGES = ['mob:kitchen:0', 'mob:living:1', 'mob:attic:2', 'boss:vacuum', 'boss:washer', 'boss:fan'];
for (const vp of [{ w: 360, h: 800 }, { w: 390, h: 844 }]) for (const scheme of ['light', 'dark']) {
  const key = `${vp.w}x${vp.h}-${scheme}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(300);
  const layout = await page.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, canvas: [Math.round(c.width), Math.round(c.height)] }; });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  // 引っぱって離す
  const box = await page.locator('#cv').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.6;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 12, cy + 70, { steps: 6 }); await page.mouse.move(cx + 16, cy + 130, { steps: 6 });
  await page.screenshot({ path: path.join(shots, `play-${key}-aim.png`) });
  await page.mouse.up();
  await page.waitForFunction(() => globalThis.__flickState().phase !== 'resolving', null, { timeout: 60000 });
  const afterDrag = await page.evaluate(() => globalThis.__flickState().shots);
  const stages = {};
  for (const st of (key === '360x800-light' ? STAGES : [STAGES[(vp.w + scheme.length) % STAGES.length]])) {
    await page.selectOption('#stage', st);
    await page.evaluate(() => { const p = globalThis.__flickPerf; p.frames = 0; p.slow = 0; p.maxMs = 0; p.simMsMax = 0; });
    const ai = [];
    for (let i = 0; i < 45; i++) {
      if (await page.evaluate(() => globalThis.__flickState().phase) !== 'aim') break;
      if (await page.evaluate(() => !document.getElementById('ult').disabled) && i % 2 === 0) await page.click('#ult'); // 必殺が使えるときは 2 回に 1 回使う
      await page.click('#auto');
      await page.waitForFunction(() => globalThis.__flickState().phase !== 'aim' || !document.getElementById('overlay').hidden, null, { timeout: 60000 });
      await page.waitForFunction(() => globalThis.__flickState().phase !== 'resolving', null, { timeout: 90000 });
      ai.push(await page.evaluate(() => Math.round(globalThis.__flickPerf.aiMs)));
      if (i === 3) await page.screenshot({ path: path.join(shots, `play-${key}-${st.replace(/:/g, '_')}-mid.png`) });
    }
    const r = await page.evaluate(() => { const s = globalThis.__flickState(), p = globalThis.__flickPerf; return { phase: s.phase, shots: s.shots, ults: s.stats.ultsUsed, chain: s.bestChain, frames: p.frames, slow: p.slow, simMs: +p.simMsMax.toFixed(1) }; });
    ai.sort((a, b) => a - b);
    stages[st] = Object.assign(r, { aiMsMedian: ai[ai.length >> 1], aiMsMax: ai[ai.length - 1] });
  }
  await page.screenshot({ path: path.join(shots, `play-${key}-end.png`) });
  out[key] = { noHScroll: layout.sw <= layout.iw, noVScroll: layout.sh <= layout.ih, canvas: layout.canvas, dragWorked: afterDrag === 1, stages, errors };
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(dir, 'results-browser.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 1));
