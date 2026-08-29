// 合成スクリーンショット生成(§6)。
//
// 汎用チャットUIを自前のHTML/CSSで描き、PNGへ落とす。
// 他社アプリのロゴ・配色・UI要素を複製しない(意図的に無地・中立な見た目にしている)。
//
// 使い方: node pricing_eval/src/render_screenshots.mjs [--out-dir=pricing_eval/screenshots]

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/config.mjs';
import { logInfo } from './lib/log.mjs';

const CASES = 'pricing_eval/cases.json';

// 解像度にばらつきを付ける(§6: 解像度・枚数・文字密度・長文・改行・ダークモードに差を付ける)
const VIEWPORTS = [
  { w: 360, h: 800, dpr: 2 },
  { w: 390, h: 844, dpr: 3 },
  { w: 414, h: 896, dpr: 2 },
  { w: 375, h: 812, dpr: 2 },
];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function pageHtml(turns, { dark, density, title }) {
  const bg = dark ? '#101317' : '#f2f4f6';
  const fg = dark ? '#e6e8ea' : '#1b1d20';
  const selfBg = dark ? '#2f6b57' : '#b7e4c7';
  const partnerBg = dark ? '#23282e' : '#ffffff';
  const gap = density === 'dense' ? 6 : 12;
  const fontSize = density === 'dense' ? 13 : 15;
  const rows = turns
    .map((t) => {
      const mine = t.from === 'self';
      // 改行を含む文面も混ぜる
      const body = esc(t.text).replace(/\n/g, '<br>');
      return `<div class="row ${mine ? 'me' : 'you'}">
        <div class="bubble">${body}</div>
        <div class="meta">${mine ? '既読 ' : ''}${t.time}</div>
      </div>`;
    })
    .join('');
  return `<!doctype html><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:${bg};color:${fg};
       font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;font-size:${fontSize}px}
  .bar{padding:10px 12px;background:${dark ? '#181c21' : '#e7eaee'};font-weight:600;font-size:14px}
  .log{padding:10px;display:flex;flex-direction:column;gap:${gap}px}
  .row{display:flex;flex-direction:column;max-width:78%}
  .row.me{align-self:flex-end;align-items:flex-end}
  .row.you{align-self:flex-start;align-items:flex-start}
  .bubble{padding:7px 11px;border-radius:14px;line-height:1.45;word-break:break-word;
          background:${partnerBg};color:${fg}}
  .me .bubble{background:${selfBg};color:${dark ? '#eaf5ef' : '#10261c'}}
  .meta{font-size:10px;opacity:.55;margin-top:2px}
</style>
<div class="bar">${esc(title)}</div>
<div class="log">${rows}</div>`;
}

// 会話を N 枚へ時系列で分割
function splitTurns(conv, n) {
  const per = Math.ceil(conv.length / n);
  const out = [];
  for (let i = 0; i < n; i++) {
    const slice = conv.slice(i * per, (i + 1) * per);
    if (slice.length) out.push(slice);
  }
  // 端数で枚数が減った場合は最後を分けて枚数を合わせる
  while (out.length < n && out.length > 0) {
    const last = out.pop();
    const mid = Math.max(1, Math.floor(last.length / 2));
    out.push(last.slice(0, mid), last.slice(mid));
  }
  return out.slice(0, n);
}

function withTimes(turns, startMin) {
  let m = startMin;
  return turns.map((t) => {
    m += 3 + (t.text.length % 7);
    const hh = 9 + Math.floor(m / 60) % 14;
    return { ...t, time: `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` };
  });
}

async function main() {
  const args = parseArgs();
  const outDir = args['out-dir'] || 'pricing_eval/screenshots';
  const data = JSON.parse(readFileSync(CASES, 'utf8'));

  const targets = data.cases.filter((c) => c.image_plan && c.image_plan.count > 0);
  if (!targets.length) { console.log('画像が必要なケースがありません'); return; }

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  let total = 0;

  for (const [ci, c] of targets.entries()) {
    const vp = VIEWPORTS[ci % VIEWPORTS.length];
    const plan = c.image_plan;
    if (plan.count > 6) throw new Error(`${c.id}: 1ケース最大6枚を超えている (${plan.count})`);
    const chunks = splitTurns(c.conversation, plan.count);
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: vp.dpr,
      colorScheme: plan.dark ? 'dark' : 'light',
    });
    const page = await ctx.newPage();
    const names = [];
    for (const [i, chunk] of chunks.entries()) {
      const html = pageHtml(withTimes(chunk, 60 * (i + 1)), {
        dark: plan.dark, density: plan.density, title: `トーク (${i + 1}/${chunks.length})`,
      });
      await page.setContent(html, { waitUntil: 'load' });
      const name = `${c.id}_${String(i + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: join(outDir, name), fullPage: true });
      names.push(name);
      total++;
    }
    await ctx.close();
    c.images = names; // 順序を固定して記録
  }
  await browser.close();

  writeFileSync(CASES, JSON.stringify(data, null, 2));
  logInfo(`スクリーンショット ${total} 枚を生成し、cases.json の images を更新しました`, { outDir, cases: targets.length });
}

main().catch((e) => { console.error('[error]', e.message); process.exit(1); });
