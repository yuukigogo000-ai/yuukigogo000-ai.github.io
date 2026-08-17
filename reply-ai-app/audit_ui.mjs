// uicheck が RED にした項目の「どの要素か」を出す診断用(WOのG3/G4の材料)
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8778/reply-ai/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.goto(BASE);
await page.waitForSelector('#generate');
await page.selectOption('#sampleSelect', '1');
await page.waitForTimeout(300);

const out = await page.evaluate(() => {
  const label = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : '');
    return `${el.tagName.toLowerCase()}${id}${id ? '' : cls}`.slice(0, 60);
  };
  const lum = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]');
  };

  const inputsSmall = [];
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    if (!visible(el)) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) inputsSmall.push(`${label(el)} = ${fs}px`);
  });

  const tapSmall = [];
  document.querySelectorAll('button, a, input, select, textarea, [role=button], [role=tab], label[for]').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) tapSmall.push(`${label(el)} = ${Math.round(r.width)}x${Math.round(r.height)}`);
  });

  const contrastLow = [];
  document.querySelectorAll('*').forEach((el) => {
    if (!visible(el)) return;
    const t = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!t) return;
    const cs = getComputedStyle(el);
    const l1 = lum(cs.color), l2 = lum(bgOf(el));
    if (l1 == null || l2 == null) return;
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const fs = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) contrastLow.push(`${label(el)} ${cs.color} on ${bgOf(el)} = ${ratio.toFixed(2)} (need ${need}) "${el.textContent.trim().slice(0, 18)}"`);
  });

  const sizes = new Map(), radii = new Map();
  document.querySelectorAll('*').forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) sizes.set(cs.fontSize, (sizes.get(cs.fontSize) || 0) + 1);
    const r = cs.borderTopLeftRadius;
    if (r && r !== '0px') radii.set(r, (radii.get(r) || 0) + 1);
  });

  return {
    inputsSmall,
    tapSmall: [...new Set(tapSmall)],
    contrastLow: [...new Set(contrastLow)],
    sizes: [...sizes.entries()].sort((a, b) => b[1] - a[1]),
    radii: [...radii.entries()].sort((a, b) => b[1] - a[1]),
  };
});

console.log('■ 入力の文字<16px:', out.inputsSmall.length);
out.inputsSmall.forEach((s) => console.log('   ', s));
console.log('■ タップ<44px:', out.tapSmall.length);
out.tapSmall.forEach((s) => console.log('   ', s));
console.log('■ コントラスト不足:', out.contrastLow.length);
out.contrastLow.slice(0, 20).forEach((s) => console.log('   ', s));
console.log('■ 文字サイズ:', out.sizes.map(([k, v]) => `${k}(${v})`).join(' '));
console.log('■ 角丸:', out.radii.map(([k, v]) => `${k}(${v})`).join(' '));

await browser.close();
