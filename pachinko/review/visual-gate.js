#!/usr/bin/env node
/* VISUAL GATE(客観ガードレール)
   使い方: node visual-gate.js <実装画像> [<Target画像>]
   Target 省略時は screens/00-TARGET_GAME_CORE_REGION.jpg を使う。
   注: 補助指標であり、最終判定は Target との直接視覚比較(13軸)で行う。 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOOR = { entropy: .88, edge_ratio: .72, gold_ratio: .55, saturated_ratio: .55, luminance_sd: .72 };
const CEIL = { blank_tile_ratio: 1.75 };
const CODE = `
window.计 = 1;
window.computeMetrics = async (dataUrl) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const W = 512, H = Math.max(1, Math.round(512 * img.height / img.width));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); c.drawImage(img, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data;
  const n = W * H;
  const lum = new Float32Array(n);
  let dark = 0, bright = 0, gold = 0, sat = 0;
  const hist = new Float64Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = d[p] / 255, g = d[p+1] / 255, b = d[p+2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = l;
    hist[Math.min(255, Math.round(l * 255))]++;
    if (l < 0.18) dark++;
    if (l > 0.86) bright++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx === 0 ? 0 : (mx - mn) / mx;
    if (s > 0.35 && l > 0.10) sat++;
    // gold: 色相 35-60deg 付近で彩度・明度が十分
    let h = 0;
    if (mx !== mn) {
      if (mx === r) h = 60 * (((g - b) / (mx - mn)) % 6);
      else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2);
      else h = 60 * ((r - g) / (mx - mn) + 4);
      if (h < 0) h += 360;
    }
    if (h >= 25 && h <= 65 && s > 0.30 && l > 0.16) gold++;
  }
  let entropy = 0;
  for (let i = 0; i < 256; i++) { const p2 = hist[i] / n; if (p2 > 0) entropy -= p2 * Math.log2(p2); }
  // edge ratio (Sobel 風の簡易勾配)
  let edges = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = lum[i - 1] - lum[i + 1], gy = lum[i - W] - lum[i + W];
    if (Math.sqrt(gx * gx + gy * gy) > 0.10) edges++;
  }
  const edge_ratio = edges / ((W - 2) * (H - 2));
  let mean = 0; for (let i = 0; i < n; i++) mean += lum[i]; mean /= n;
  let v = 0; for (let i = 0; i < n; i++) { const dd = lum[i] - mean; v += dd * dd; } v /= n;
  // blank tile ratio: 16x16 タイルの分散が極小の割合
  const TS = 16; let tiles = 0, blank = 0;
  for (let ty = 0; ty + TS <= H; ty += TS) for (let tx = 0; tx + TS <= W; tx += TS) {
    let m2 = 0, c2 = 0;
    for (let y = ty; y < ty + TS; y++) for (let x = tx; x < tx + TS; x++) { m2 += lum[y * W + x]; c2++; }
    m2 /= c2;
    let vv = 0;
    for (let y = ty; y < ty + TS; y++) for (let x = tx; x < tx + TS; x++) { const dd = lum[y * W + x] - m2; vv += dd * dd; }
    vv /= c2;
    tiles++; if (Math.sqrt(vv) < 0.02) blank++;
  }
  return {
    entropy, edge_ratio, dark_ratio: dark / n, bright_ratio: bright / n,
    gold_ratio: gold / n, saturated_ratio: sat / n,
    luminance_sd: Math.sqrt(v), blank_tile_ratio: blank / tiles,
  };
};
`;
const mime = f => f.endsWith('.jpg') || f.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
(async () => {
  const args = process.argv.slice(2);
  const files = args.filter(a => !a.startsWith('--'));
  const target = files.length > 1 ? files.pop() : path.join(__dirname, 'screens/00-TARGET_GAME_CORE_REGION.jpg');
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const b = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const p = await b.newPage();
  await p.setContent('<body></body>');
  await p.addScriptTag({ content: CODE });
  const measure = f => p.evaluate(u => window.computeMetrics(u),
    'data:' + mime(f) + ';base64,' + fs.readFileSync(f).toString('base64'));
  const t = await measure(target);
  for (const f of files) {
    const m = await measure(f);
    const checks = [];
    for (const k of Object.keys(FLOOR)) checks.push({ k, v: m[k], need: '>= ' + (t[k]*FLOOR[k]).toFixed(4), pass: m[k] >= t[k]*FLOOR[k] });
    for (const k of Object.keys(CEIL)) checks.push({ k, v: m[k], need: '<= ' + (t[k]*CEIL[k]).toFixed(4), pass: m[k] <= t[k]*CEIL[k] });
    const ps = checks.filter(c => c.pass).length;
    console.log(`\n[${ps === checks.length ? 'PASS' : 'FAIL'}] ${path.basename(f)}  (${ps}/${checks.length})`);
    for (const c of checks) console.log(`   ${c.pass ? 'ok  ' : 'NG  '} ${c.k.padEnd(18)} ${Number(c.v).toFixed(4)}  need ${c.need}`);
  }
  await b.close();
})();
