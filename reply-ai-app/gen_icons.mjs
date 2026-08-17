// アイコンPNGを favicon.svg から生成する(Chromium でレンダリングして撮影)。
// 使い方: NODE_PATH=<playwrightのある場所> node gen_icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('./public/icons/favicon.svg', import.meta.url), 'utf8');

// maskable はセーフゾーン(中央80%)にマークを収める必要があるので、背景を広げて縮小配置する
const maskable = svg
  .replace('viewBox="0 0 512 512"', 'viewBox="0 0 512 512"')
  .replace('<rect width="512" height="512" rx="112" fill="#14181c"/>', '<rect width="512" height="512" fill="#14181c"/>')
  .replace('<path d="M152 108', '<g transform="translate(256 256) scale(0.76) translate(-256 -256)"><path d="M152 108')
  .replace(/<\/svg>\s*$/, '</g></svg>');

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, source: svg },
  { file: 'public/icons/icon-512.png', size: 512, source: svg },
  { file: 'public/icons/icon-maskable-512.png', size: 512, source: maskable },
  { file: 'public/icons/apple-touch-icon.png', size: 180, source: svg },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<body style="margin:0;width:${t.size}px;height:${t.size}px">${t.source.replace(
      '<svg ',
      `<svg width="${t.size}" height="${t.size}" `,
    )}</body>`,
  );
  const buf = await page.screenshot({ omitBackground: false });
  writeFileSync(new URL('./' + t.file, import.meta.url), buf);
  console.log('wrote', t.file, t.size);
}
await browser.close();
