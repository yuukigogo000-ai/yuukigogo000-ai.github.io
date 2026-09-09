// CSP(Content-Security-Policy)の検査。
//
// 目的は2つ。
//   1. 公開する全ページに CSP が入っていること
//   2. その CSP が「アプリを壊していない」こと — 実ブラウザで開いて違反が0件であること
//
// 2 が本体。CSP は書くのは簡単で、静かに機能を殺すのが怖い。特に HONMONO の画素判定は
// Worker(blob:)と WebAssembly を使うので、CSP の書き損じが一番出やすい。
// そのため実画像を1枚流して判定まで走らせる。
//
// 使い方:
//   node tests/csp_check.mjs
//   node tests/csp_check.mjs --mutate   # 検査器自身が「NO」と言えるか確かめる
//
// 環境変数 CHROMIUM_PATH でブラウザの場所を指定する。

import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MUTATE = process.argv.includes("--mutate");
const PORT = 8934;

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".md": "text/markdown",
};

// 検査対象 = 公開している画面
const PAGES = [
  "/", "/band/", "/pachinko/", "/surf/", "/reply-ai/",
  "/honmono/", "/honmono/checker/", "/honmono/badge/", "/honmono/aicheck/",
  "/honmono/creators/", "/honmono/docs/", "/honmono/report/", "/honmono/business/",
  "/honmono/legal/privacy.html", "/honmono/legal/terms.html", "/honmono/legal/credits.html",
];

// --mutate のときだけ配る、わざと CSP に違反するページ。
// 検査器が違反を本当に拾えるかを確かめるための的。
const TRAP = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self'">
</head><body><img src="https://example.com/blocked.png" alt=""></body></html>`;

const server = createServer(async (req, res) => {
  let path = req.url.split("#")[0].split("?")[0];
  if (MUTATE && path === "/__trap__/") {
    res.writeHead(200, { "content-type": "text/html" }); res.end(TRAP); return;
  }
  if (path.endsWith("/")) path += "index.html";
  try {
    let body = await readFile(join(ROOT, path));
    // --mutate: 本物のページから CSP を剥がして配る(「CSPがある」検査が落ちるはず)
    if (MUTATE && path.endsWith(".html")) {
      body = Buffer.from(String(body).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, ""));
    }
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));
const BASE = `http://localhost:${PORT}`;

let failures = 0;
const ok = (cond, name, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) failures++;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});

// CSP違反を取りこぼさないため、ページ側のイベントで拾う(console文字列の当てずっぽうにしない)
const COLLECT = () => {
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (e) => {
    window.__csp.push(`${e.violatedDirective} <- ${e.blockedURI}`);
  });
};

async function open(path) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(COLLECT);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

console.log(`モード: ${MUTATE ? "変異注入(落ちるのが正しい)" : "通常"}\n`);
console.log("[1] 全ページ: CSPが入っているか / 違反が出ないか");

for (const p of PAGES) {
  const { ctx, page, errors } = await open(p);
  const hasCsp = await page.evaluate(() =>
    !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
  const violations = await page.evaluate(() => window.__csp || []);
  const realErrors = errors.filter((e) => !/favicon/i.test(e));
  ok(hasCsp, `${p} に CSP がある`);
  ok(violations.length === 0, `${p} で CSP 違反なし`, violations.join(" / "));
  ok(realErrors.length === 0, `${p} で JSエラーなし`, realErrors.join(" / "));
  await ctx.close();
}

if (MUTATE) {
  console.log("\n[2] 違反検出そのものの確認(わざと違反するページ)");
  const { ctx, page } = await open("/__trap__/");
  const violations = await page.evaluate(() => window.__csp || []);
  ok(violations.length > 0, "わざと違反するページで違反を検出できる", violations.join(" / "));
  await ctx.close();
}

console.log("\n[3] HONMONO 画素判定: Worker(blob:)と WebAssembly が CSP で殺されていないか");
{
  const { ctx, page } = await open("/honmono/checker/");
  // 判定に流す画像を作る(単色だと前処理で落ちることがあるので模様を入れる)
  const png = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (256 * y + x) << 2;
    png.data[i] = (x * 7) % 256; png.data[i + 1] = (y * 5) % 256;
    png.data[i + 2] = ((x ^ y) * 3) % 256; png.data[i + 3] = 255;
  }
  const buf = PNG.sync.write(png);
  await page.setInputFiles('input[type="file"]', { name: "probe.png", mimeType: "image/png", buffer: buf });
  await page.waitForTimeout(2500);

  const metaViolations = await page.evaluate(() => window.__csp || []);
  ok(metaViolations.length === 0, "画像を読ませた時点で CSP 違反なし", metaViolations.join(" / "));

  // 画素判定(モデル90MB + WebAssembly + Worker)を実際に走らせる
  const runBtn = page.locator("#pixelRun");
  if (await runBtn.count()) {
    await runBtn.click();
    // モデルの読み込みに時間がかかる。スコアが出るか、明確に失敗するまで待つ
    await page.waitForFunction(() => {
      const s = document.getElementById("pixelScore");
      const p = document.getElementById("pixelProgress");
      return (s && s.textContent.trim() !== "") ||
             (p && /実行できませんでした/.test(p.textContent || ""));
    }, null, { timeout: 180000 }).catch(() => {});
    const r = await page.evaluate(() => ({
      csp: window.__csp || [],
      score: (document.getElementById("pixelScore") || {}).textContent || "",
      progress: (document.getElementById("pixelProgress") || {}).textContent || "",
    }));
    ok(r.csp.length === 0, "画素判定の実行中に CSP 違反なし", r.csp.join(" / "));
    ok(r.score.trim() !== "", "画素判定がスコアを出した(Worker と wasm が生きている)",
       `score="${r.score}" progress="${r.progress}"`);
  } else {
    ok(false, "#pixelRun が見つからない(検査対象が変わった)");
  }
  await ctx.close();
}

await browser.close();
server.close();

console.log(`\n不合格 ${failures} 件`);
if (MUTATE) {
  if (failures === 0) {
    console.log("NG: 変異を入れたのに全部通った。この検査器は信用できない。");
    process.exit(1);
  }
  console.log("OK: 変異で落ちた(検査器はNOと言える)");
  process.exit(0);
}
process.exit(failures ? 1 : 0);
