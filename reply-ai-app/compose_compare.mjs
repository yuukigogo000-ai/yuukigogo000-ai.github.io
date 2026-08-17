// 横並び画像(見本 | 実装)を作る。UI_PLAYBOOK G6 用。
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const pairs = JSON.parse(process.argv[2]); // [{label, left, right, out}]
const browser = await chromium.launch();
const page = await browser.newPage({ viewportSize: { width: 1200, height: 900 } });

for (const p of pairs) {
  const b64 = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
  await page.setContent(`
    <body style="margin:0;background:#111;font-family:system-ui,sans-serif;color:#eee">
      <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
        <figure style="margin:0;flex:1">
          <figcaption style="font-size:13px;padding:6px 2px">見本(Stitch / M3)</figcaption>
          <img src="${b64(p.left)}" style="width:100%;display:block;border:1px solid #444">
        </figure>
        <figure style="margin:0;flex:1">
          <figcaption style="font-size:13px;padding:6px 2px">実装(Replier)</figcaption>
          <img src="${b64(p.right)}" style="width:100%;display:block;border:1px solid #444">
        </figure>
      </div>
      <div style="font-size:12px;padding:0 18px 14px;color:#aaa">${p.label}</div>
    </body>`);
  await page.waitForTimeout(300);
  const el = await page.$('body');
  await el.screenshot({ path: p.out });
  console.log('wrote', p.out);
}
await browser.close();
