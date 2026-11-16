// はじきバトル 演出の検査器(撮影台)。場面カタログの各場面を実ブラウザで止まった時計のまま 1 コマずつ進め、
// 「1 手の待ち・敵の番・決着の余韻・離してから動くまで・文字の段・危険色の使い方・明滅・同時の演出の数」を測る。
// あわせて、各場面の決まった時刻のコマを並べた一覧画像を書き出す(before / after の比較用)。
//   NODE_PATH=$(npm root -g) node fx/fx-check.mjs --label before [--out fx/baseline] [--mutate] [--perf]
// 判定は fx/tokens.js の予算。部分的に赤でも数字はすべて書き出す(完了の判定は数字と発注者の一言で)。
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { SCENES, sceneState } from './scenes.js';
import { SCENE_INPUTS } from './scenes-inputs.js';
import { scriptShot } from './script.js';
import { threatPreview } from '../engine/engine.js';
import { FXT } from './tokens.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const label = arg('--label', 'now'), outDir = path.resolve(arg('--out', path.join(here, 'baseline')));
const MUTATE = process.argv.includes('--mutate'), PERF = process.argv.includes('--perf');
const page0 = pathToFileURL(path.join(here, '..', 'play', 'index.html')).href;
const FRAME = 1000 / 60, SHEET_T = [0, 80, 160, 320, 640, 1280, 2400];
const HARM_OK = /^(落ちる|落|落ちた\(戻る\)|⚠.*|たいあたり|はんい攻撃|ビーム|ふきとばし|ひきよせ|なかま呼び|回復|自爆|ここで離すと取り消し)$/;
const BANNED = /^あと少し!$/; // 惜しく見せる言葉(借りない一覧)
mkdirSync(outDir, { recursive: true });

// 場面ごとに「味方が受けたダメージの数字」を台本から拾う(赤い '-N' が正しい使い方かを見分けるため)
const allyDmg = {};
for (const sc of SCENES) {
  const inp = SCENE_INPUTS[sc.id];
  if (sc.kind !== 'shot' || !inp) continue;
  const s = scriptShot(sceneState(sc), inp);
  allyDmg[sc.id] = new Set(s.events.filter((r) => r.e.t === 'hit' && r.at[r.e.to] && r.at[r.e.to].side === 0).map((r) => '-' + r.e.dmg));
  if (s.events.some((r) => r.e.t === 'ko' && r.at[r.e.id] && r.at[r.e.id].side === 0 && r.at[r.e.id].kind === 'ally')) allyDmg[sc.id].add('たおれた'); // 味方が倒れた場面なら正しい使い方
  // 予想ダメージ(このまま何もしなければ、次の敵の番に味方が受ける)は、味方に悪いことなので危険色が正しい
  for (const st of [sceneState(sc), s.end]) { const tv = threatPreview(st); for (const id of Object.keys(tv.dmg)) allyDmg[sc.id].add('-' + tv.dmg[id] + (tv.ko.indexOf(+id) >= 0 ? ' たおれる' : '')); }
}

const browser = await chromium.launch();
async function openScene(id, vp, scheme, dpr) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: dpr || 1, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  await page.goto(page0 + '?scene=' + id + '&clock=manual');
  await page.waitForFunction(() => !!globalThis.__fx);
  return { ctx, page, errors };
}

/** 1 場面を最後まで流して測る。mut: 検査器の自己検査で入れる故障 */
async function measure(sc, vp, scheme, mut) {
  const { ctx, page, errors } = await openScene(sc.id, vp, scheme);
  const danger = await page.evaluate(() => __fx.colors().danger);
  if (mut === 'text') await page.evaluate((dc) => { const c = document.getElementById('cv').getContext('2d'); const f = c.fillText; c.fillText = function (t, x, y) { f.call(this, t, x, y); this.save(); this.font = '700 33px sans-serif'; this.fillStyle = dc; f.call(this, '-99', x, y); this.restore(); }; }, danger);
  if (mut === 'flash') await page.evaluate(() => { const c = document.getElementById('cv').getContext('2d'); const f = c.clearRect; let k = 0; c.clearRect = function (...a) { f.apply(this, a); }; const d = c.fillRect; c.fillRect = function (...a) { d.apply(this, a); if (a[0] === 0 && a[1] === 0) { k++; this.save(); this.fillStyle = k % 2 ? '#fff' : '#000'; d.call(this, 0, 0, 360, 520); this.restore(); } }; });
  await page.evaluate(() => __fx.textLog(true));
  await page.evaluate(() => __fx.fire());
  if (mut === 'release') await page.evaluate(() => __fx.hold(300));
  const lum = [];
  let t = 0;
  for (; t < 12000; t += FRAME) {
    const info = await page.evaluate(() => __fx.advance(1000 / 60));
    lum.push(await page.evaluate(() => __fx.lum()));
    if (mut === 'wait' && Math.abs(t - 100) < FRAME / 2) await page.evaluate(() => __fx.hold(900));
    if (info.phase !== 'resolving' && t > 300) { for (let k = 0; k < 40; k++) { await page.evaluate(() => __fx.advance(1000 / 60)); lum.push(await page.evaluate(() => __fx.lum())); } break; }
  }
  const m = await page.evaluate(() => __fx.metrics());
  const texts = await page.evaluate(() => __fx.textLog(false));
  await ctx.close();
  // 明滅: 隣り合うコマで卓の平均の明るさが 0.1 以上変わり、向きが反転する組を 1 回と数え、どの 1 秒でも何回あったか
  const changes = [];
  for (let k = 1; k < lum.length; k++) { const d = lum[k] - lum[k - 1]; if (Math.abs(d) >= 0.1 && Math.min(lum[k], lum[k - 1]) < 0.8) changes.push({ k, s: Math.sign(d) }); }
  let flashes = 0;
  for (let a = 0; a < changes.length; a++) { let n = 0, prev = 0; for (let b = a; b < changes.length && changes[b].k - changes[a].k < 60; b++) { if (changes[b].s !== prev) { n++; prev = changes[b].s; } } flashes = Math.max(flashes, Math.floor(n / 2)); }
  const sizes = [...new Set(texts.map((x) => x.px))].sort((a, b) => a - b);
  const harm = texts.filter((x) => x.fill.toLowerCase() === danger.toLowerCase()).map((x) => x.t);
  const okSet = allyDmg[sc.id] || new Set();
  const misuse = [...new Set(harm.filter((t) => !HARM_OK.test(t) && !okSet.has(t)))];
  const banned = [...new Set(texts.filter((x) => BANNED.test(x.t)).map((x) => x.t))];
  return { scene: sc.id, vp: vp.w + 'x' + vp.h, scheme, shotWait: m.shotWait, enemyWait: m.enemyWait, slowMs: m.slowMs, finaleMs: m.finaleMs,
           releaseToMove: m.releaseToMove, maxFx: m.maxFx, flashes, sizes, misuse, banned, errors, durationMs: Math.round(t) };
}

function verdict(r) {
  const B = FXT.budget, bad = [];
  if (r.shotWait > B.addedWaitPerShotMs) bad.push('1手の待ち ' + r.shotWait + 'ms');
  if (r.enemyWait > B.enemyTurnMaxMs) bad.push('敵の番 ' + r.enemyWait + 'ms');
  if (r.finaleMs > B.finaleMaxMs + 400) bad.push('決着 ' + r.finaleMs + 'ms'); // 決着は勝敗の画面が出るまでを含むので少し甘く
  if (r.releaseToMove !== null && r.releaseToMove > B.releaseToMoveMs) bad.push('離して動くまで ' + r.releaseToMove + 'ms');
  if (r.flashes > B.flashesPerSecMax) bad.push('明滅 ' + r.flashes + '回/秒');
  if (r.misuse.length) bad.push('危険色の誤用 ' + r.misuse.slice(0, 4).join(' '));
  if (r.banned.length) bad.push('借りない言葉 ' + r.banned.join(' '));
  if (r.errors.length) bad.push('JSエラー ' + r.errors.length);
  return bad;
}

if (MUTATE) {
  const sc = SCENES.find((s) => s.id === 'strong'), vp = { w: 390, h: 844 };
  const cases = [['text', (r) => r.sizes.includes(33) && r.misuse.includes('-99')], ['flash', (r) => r.flashes > FXT.budget.flashesPerSecMax],
                 ['wait', (r) => r.shotWait > FXT.budget.addedWaitPerShotMs], ['release', (r) => r.releaseToMove > FXT.budget.releaseToMoveMs]];
  const clean = await measure(sc, vp, 'light');
  let caught = 0;
  for (const [mut, seen] of cases) { const r = await measure(sc, vp, 'light', mut); if (seen(r) && JSON.stringify(verdict(r)) !== JSON.stringify(verdict(clean))) caught++; else console.log('  見逃し: ' + mut, JSON.stringify(r)); }
  console.log(`自己検査: 入れた故障 ${cases.length} 件中 ${caught} 件を検出`);
  await browser.close();
  process.exit(caught === cases.length ? 0 : 1);
}

// ---- 測る(4 つの条件 × 場面) ----
const results = [];
const VPS = [{ w: 360, h: 800 }, { w: 390, h: 844 }];
for (const vp of VPS) for (const scheme of ['light', 'dark']) for (const sc of SCENES) {
  if (sc.kind !== 'shot' || !SCENE_INPUTS[sc.id]) continue;
  const r = await measure(sc, vp, scheme);
  r.bad = verdict(r);
  results.push(r);
}
const allSizes = [...new Set(results.flatMap((r) => r.sizes))].sort((a, b) => a - b);

// ---- 一覧画像(390×844・ライトとダーク。各場面を決まった時刻で並べる) ----
async function sheet(scheme) {
  const rows = [];
  for (const sc of SCENES) {
    const vp = { w: 390, h: 844 };
    const { ctx, page } = await openScene(sc.id, vp, scheme, 1);
    const box = await page.locator('#cv').boundingBox();
    const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
    const frames = [];
    if (sc.kind === 'state') frames.push({ t: '止め', b64: (await page.screenshot({ clip })).toString('base64') });
    else {
      await page.evaluate(() => __fx.fire());
      let now = 0;
      for (const t of SHEET_T) { if (t > now) { await page.evaluate((ms) => __fx.advance(ms), t - now); now = t; } frames.push({ t: t + 'ms', b64: (await page.screenshot({ clip })).toString('base64') }); }
    }
    rows.push({ id: sc.id, ja: sc.ja, tier: sc.tier, frames, w: box.width, h: box.height });
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } });
  const page = await ctx.newPage();
  await page.setContent('<canvas id=c></canvas>');
  const jpg = await page.evaluate(async ({ rows, cols, title }) => {
    const S = 0.75, fw = Math.round(rows[0].w * S), fh = Math.round(rows[0].h * S), head = 26, pad = 8, lw = 150;
    const c = document.getElementById('c'); c.width = lw + cols * (fw + pad) + pad; c.height = 40 + rows.length * (fh + head + pad);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.font = '700 18px sans-serif'; g.fillText(title, pad, 26);
    const load = (b64) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + b64; });
    let y = 40;
    for (const r of rows) {
      g.fillStyle = '#111'; g.font = '700 14px sans-serif'; g.fillText(r.ja, pad, y + 18);
      g.font = '12px sans-serif'; g.fillStyle = '#555'; g.fillText(r.id + (r.tier === null || r.tier === undefined ? '' : ' ・ 格' + r.tier), pad, y + 36);
      let x = lw;
      for (const f of r.frames) { const im = await load(f.b64); g.drawImage(im, x, y + head, fw, fh); g.fillStyle = '#555'; g.font = '12px sans-serif'; g.fillText(f.t, x, y + 18); x += fw + pad; }
      y += fh + head + pad;
    }
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  }, { rows, cols: SHEET_T.length, title: 'はじきバトル 演出の場面一覧(' + label + ' / 390×844 ' + scheme + ' / 離してからの時刻)' });
  await ctx.close();
  const f = path.join(outDir, `${label}-390-${scheme}.jpg`);
  writeFileSync(f, Buffer.from(jpg, 'base64'));
  return f;
}
const sheets = [await sheet('light'), await sheet('dark')];

// ---- 重い場面を実時間で(CPU を 4 倍遅くした模擬) ----
let perf = null;
if (PERF) {
  perf = {};
  for (const id of ['chain10', 'blast', 'special']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto(page0 + '?scene=' + id);
    const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const p = globalThis.__flickPerf; p.frames = 0; p.slow = 0; p.maxMs = 0; __fx.fire(); });
    await page.waitForTimeout(4000);
    perf[id] = await page.evaluate(() => { const p = globalThis.__flickPerf; return { frames: p.frames, slowFrames: p.slow, maxFrameMs: Math.round(p.maxMs) }; });
    await ctx.close();
  }
}
await browser.close();

const summary = { label, date: new Date().toISOString().slice(0, 10), textSizesAll: allSizes, textTiersOk: allSizes.length <= FXT.budget.textTiersMax,
                  red: results.filter((r) => r.bad.length).length, total: results.length, perf, sheets: sheets.map((f) => path.relative(path.join(here, '..'), f)) };
writeFileSync(path.join(outDir, `metrics-${label}.json`), JSON.stringify({ summary, results }, null, 1));
console.log(`文字の大きさ(卓の中・全場面): ${allSizes.join(', ')}px → ${allSizes.length} 種類(上限 ${FXT.budget.textTiersMax})`);
const pick = results.filter((r) => r.vp === '390x844' && r.scheme === 'light');
for (const r of pick) console.log(`${r.scene.padEnd(11)} 待ち ${String(r.shotWait).padStart(4)}ms 敵 ${String(r.enemyWait).padStart(4)}ms 決着 ${String(r.finaleMs).padStart(4)}ms 動くまで ${String(r.releaseToMove).padStart(4)}ms 明滅 ${r.flashes} 演出 ${String(r.maxFx).padStart(2)} ${r.bad.length ? '× ' + r.bad.join(' / ') : '○'}`);
console.log(`赤: ${summary.red} / ${summary.total}(4 条件 × 場面)`);
if (perf) console.log('実時間(CPU 4 倍遅い模擬):', JSON.stringify(perf));
