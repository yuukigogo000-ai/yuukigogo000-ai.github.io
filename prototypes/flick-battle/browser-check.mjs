// 実ブラウザでの確認(node browser-check.mjs): スマホ幅での表示、引っぱり操作、
// Node と同じ結果になるか、CPU を 6 倍遅くしたときの描画の重さ。
import { createRequire } from 'node:module';
// playwright は環境に入っているものを使う(NODE_PATH=$(npm root -g) を付けて実行)
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const shots = process.argv[2] || dir;
const url = pathToFileURL(path.join(dir, 'index.html')).href;
const node = JSON.parse(readFileSync(path.join(dir, 'results-node.json'), 'utf8'));
const out = {};
const browser = await chromium.launch();

// 1) Node と同じ乱数手順を流して、ハッシュがビット単位で一致するか
{
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  out.crossRuntime = await page.evaluate(() => {
    const S = globalThis.FlickSim;
    let chain = 0x811c9dc5;
    for (let seed = 1; seed <= 300; seed++) {
      const rnd = S.mulberry32(seed), s = S.createState(seed % 2 ? 'mob' : 'boss');
      let h = 0x811c9dc5;
      while (s.phase === 'aim' && s.shots < 80) {
        const d = S.DIRS[Math.floor(rnd() * S.DIRS.length)], p = S.POWERS[Math.floor(rnd() * S.POWERS.length)];
        S.shoot(s, d[0], d[1], p); S.resolve(s); h = S.hashState(s, h);
      }
      chain = Math.imul(chain ^ h, 0x01000193) >>> 0;
    }
    return { hash: chain.toString(16).padStart(8, '0'), ua: navigator.userAgent };
  });
  out.crossRuntime.nodeHash = node.determinism.goldenHash;
  out.crossRuntime.match = out.crossRuntime.hash === node.determinism.goldenHash;
  out.crossRuntime.pageErrors = errors;
  await page.context().close();
}

// 2) スマホ幅 × 明暗で表示と操作、CPU 6 倍減速での重さ
for (const vp of [{ w: 360, h: 800 }, { w: 390, h: 844 }]) for (const scheme of ['light', 'dark']) {
  const key = `${vp.w}x${vp.h}-${scheme}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(300);
  const layout = await page.evaluate(() => {
    const c = document.getElementById('cv').getBoundingClientRect();
    return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, scrollH: document.documentElement.scrollHeight, innerH: innerHeight,
             canvasCss: [Math.round(c.width), Math.round(c.height)], smallestDiscCssPx: +(16 * 2 * c.width / 360).toFixed(1) };
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  // 引っぱって離す(下に引く → 上に飛ぶ)
  const box = await page.locator('#cv').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.6;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 10, cy + 60, { steps: 6 }); await page.mouse.move(cx + 14, cy + 120, { steps: 6 });
  await page.screenshot({ path: path.join(shots, `shot-${key}-aim.png`) });
  await page.mouse.up();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shots, `shot-${key}-moving.png`) });
  await page.waitForFunction(() => globalThis.__flickState().phase !== 'resolving', null, { timeout: 60000 });
  const afterDrag = await page.evaluate(() => ({ shots: globalThis.__flickState().shots, phase: globalThis.__flickState().phase }));
  // おまかせで最後まで(描画しながら)
  await page.evaluate(() => { const p = globalThis.__flickPerf; p.frames = 0; p.slow = 0; p.maxMs = 0; p.simMsMax = 0; });
  const t0 = Date.now();
  let aiMs = [];
  for (let i = 0; i < 40; i++) {
    const ph = await page.evaluate(() => globalThis.__flickState().phase);
    if (ph !== 'aim') break;
    await page.click('#auto');
    await page.waitForFunction(() => globalThis.__flickState().phase !== 'aim' || false, null, { timeout: 60000 });
    await page.waitForFunction(() => globalThis.__flickState().phase !== 'resolving', null, { timeout: 60000 });
    aiMs.push(await page.evaluate(() => Math.round(globalThis.__flickPerf.aiMs)));
  }
  const perf = await page.evaluate(() => Object.assign({}, globalThis.__flickPerf));
  const end = await page.evaluate(() => ({ phase: globalThis.__flickState().phase, shots: globalThis.__flickState().shots }));
  await page.screenshot({ path: path.join(shots, `shot-${key}-end.png`) });
  out[key] = { layout, noHorizontalScroll: layout.scrollW <= layout.innerW, noVerticalScroll: layout.scrollH <= layout.innerH, afterDrag, end,
               wallSec: +((Date.now() - t0) / 1000).toFixed(1),
               cpuThrottle: 6, frames: perf.frames, slowFramesOver25ms: perf.slow, worstFrameMs: Math.round(perf.maxMs), worstSimMsInFrame: +perf.simMsMax.toFixed(2),
               aiTurnMsMedian: aiMs.sort((a, b) => a - b)[aiMs.length >> 1], aiTurnMsMax: Math.max(...aiMs), pageErrors: errors };
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(dir, 'results-browser.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
