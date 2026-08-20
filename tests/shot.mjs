/* shot — 現状スクショを固定条件で撮る。Phase 2 依頼と Phase 4 Baseline Capture で使う。
 *
 * 使い方:
 *   node tests/shot.mjs <出力ディレクトリ> [--widths 360,390,430]
 *
 * 撮るもの: 4タブ(前提/選択肢/俯瞰/感度)× 幅 × light/dark + 状態3種(空/長い/エラー)
 * サンプル3件を入れた状態で撮る(空の画面では密度が分からないため)。
 * 併せて横はみ出し(scrollWidth > clientWidth)を検査して報告する。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const PW_DIR = process.env.PW_DIR || 'C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/';
const { chromium } = createRequire(pathToFileURL(PW_DIR.replace(/\/?$/, '/')).href)('playwright');

const outDir = process.argv[2];
if (!outDir) { console.error('usage: node tests/shot.mjs <outdir> [--widths 360,390]'); process.exit(64); }
const wi = process.argv.indexOf('--widths');
const WIDTHS = wi > 0 ? process.argv[wi + 1].split(',').map(Number) : [390, 360];
const APP = pathToFileURL(path.resolve('expectation-explorer.html')).href;
fs.mkdirSync(outDir, { recursive: true });

const TABS = [['overview', '俯瞰'], ['profile', '前提'], ['editor', '選択肢'], ['sense', '感度']];
const STATES = [['empty', '空'], ['long', '長い8件'], ['error', 'エラー']];

const browser = await chromium.launch();
const overflow = [];

async function page(width, scheme) {
  const p = await browser.newPage({
    viewport: { width, height: 844 }, deviceScaleFactor: 2,
    colorScheme: scheme, locale: 'ja-JP', isMobile: true, hasTouch: true,
  });
  p.on('dialog', d => d.accept());
  return p;
}
async function checkOverflow(p, label) {
  const r = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  if (r.s > r.c) overflow.push(`${label}: scrollWidth ${r.s} > clientWidth ${r.c}`);
}

// --- 4タブ(サンプル3件入り) ---
for (const width of WIDTHS) {
  for (const scheme of ['light', 'dark']) {
    const p = await page(width, scheme);
    await p.goto(APP);
    await p.waitForTimeout(200);
    await p.click('#loadSample').catch(() => {});
    await p.waitForTimeout(400);
    await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); });
    for (const [tab, ja] of TABS) {
      await p.click(`nav button[data-tab="${tab}"]`);
      await p.waitForTimeout(350);
      await p.evaluate(() => { window.scrollTo(0, 0); const t = document.getElementById('toast'); if (t) t.classList.remove('show'); });
      await p.waitForTimeout(120);
      const base = path.join(outDir, `w${width}_${scheme}_${tab}_${ja}`);
      await p.screenshot({ path: base + '.png' });
      await p.screenshot({ path: base + '_全体.png', fullPage: true });
      await checkOverflow(p, `w${width}/${scheme}/${ja}`);
    }
    await p.close();
  }
}

// --- 状態3種(390 light のみ。状態が写らなければ検査していないのと同じ) ---
for (const [st, ja] of STATES) {
  const p = await page(390, 'light');
  await p.goto(APP + '?state=' + st);
  await p.waitForTimeout(400);
  await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); });
  const base = path.join(outDir, `w390_状態_${ja}`);
  await p.screenshot({ path: base + '.png' });
  await p.screenshot({ path: base + '_全体.png', fullPage: true });
  await checkOverflow(p, `w390/状態/${ja}`);
  await p.close();
}

await browser.close();
const files = fs.readdirSync(outDir).filter(f => f.endsWith('.png'));
console.log(`撮影: ${files.length} 枚 → ${outDir}`);
console.log(overflow.length ? '横はみ出し NG:\n  ' + overflow.join('\n  ') : '横はみ出し: 全条件 PASS');
process.exit(overflow.length ? 1 : 0);
