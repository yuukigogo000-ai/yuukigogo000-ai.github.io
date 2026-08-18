// 波チェック(/surf/) の自動テスト。Open-Meteo をモックして通信なしで回す。
// 実行: cd surf/tests && npm install && npm test   (リポジトリのルート = ../../ を静的配信)
// 何を守るか: 描画・フォールバック連鎖・全null時のエラー表示・通信断時のキャッシュ表示・ダーク・
//            状態フック(?state=)が本番経路と混ざらないこと・詳細/設定の導線・レベル切替の保存。
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---- フィクスチャ(今日の 00:00 から 7 日分・JST ローカル) ----
const pad = n => String(n).padStart(2, "0");
function makeTimes() {
  const t = []; const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 24 * 7; i++) { t.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`); d.setHours(d.getHours() + 1); }
  return t;
}
const times = makeTimes();
const marine = nullData => ({ latitude: 35.3, longitude: 139.5, hourly: {
  time: times,
  wave_height: times.map((_, i) => nullData ? null : +(0.6 + 0.6 * Math.sin(i / 8)).toFixed(2)),
  wave_direction: times.map(() => nullData ? null : 180),
  wave_period: times.map((_, i) => nullData ? null : 8 + (i % 3)),
  swell_wave_height: times.map(() => nullData ? null : 0.8),
  swell_wave_period: times.map(() => nullData ? null : 10),
  sea_surface_temperature: times.map(() => nullData ? null : 26.4),
} });
const weather = () => { const days = [...new Set(times.map(t => t.slice(0, 10)))]; return { hourly: {
  time: times,
  wind_speed_10m: times.map((_, i) => +(2 + 4 * Math.abs(Math.sin(i / 10))).toFixed(1)),
  wind_direction_10m: times.map((_, i) => (i % 2 ? 0 : 350)),
  temperature_2m: times.map(() => 29),
}, daily: { time: days, sunrise: days.map(d => d + "T04:58"), sunset: days.map(d => d + "T18:26") } }; };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url.split("?")[0].replace(/\/$/, "/index.html"));
  try { res.setHeader("content-type", p.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream"); res.end(fs.readFileSync(p)); }
  catch { res.statusCode = 404; res.end("nf"); }
});

let failures = 0;
const check = (name, cond, extra) => { console.log((cond ? "PASS" : "FAIL") + " - " + name + (cond || extra == null ? "" : "  → " + extra)); if (!cond) failures++; };
const routeOk = async page => {
  await page.route("https://marine-api.open-meteo.com/**", r => r.fulfill({ json: marine(false) }));
  await page.route("https://api.open-meteo.com/**", r => r.fulfill({ json: weather() }));
};

await new Promise(r => server.listen(8765, r));
const base = "http://localhost:8765/surf/";
const browser = await chromium.launch();

// ========== 1. 正常系(本番経路・API モック) ==========
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); page.on("pageerror", e => errors.push(String(e)));
  const requested = [];
  page.on("request", r => { if (r.url().includes("open-meteo")) requested.push(r.url()); });
  await routeOk(page);
  await page.goto(base);
  await page.waitForSelector(".hero .badge", { timeout: 10000 });
  check("正常系: 5スポット(ヒーロー1+行4)が描画される", (await page.locator(".hero").count()) === 1 && (await page.locator(".row").count()) === 4);
  check("正常系: 本番経路で API が呼ばれる(フィクスチャ経路と混ざらない)", requested.length >= 10, `requests=${requested.length}`);
  check("正常系: cell_selection=sea を常時指定", requested.filter(u => u.includes("marine-api")).every(u => u.includes("cell_selection=sea")));
  const badge = await page.locator(".hero .badge").textContent();
  check("正常系: 判定バッジに語+点", /(最高|良い|まあまあ|微妙|見送り)\s*\d+/.test(badge), badge);
  const wear = await page.locator(".hero .wear b").textContent();
  check("正常系: 水温26.4℃でボードショーツ判定", wear.includes("ボードショーツ"), wear);
  check("正常系: 状態1文が表示される", !(await page.locator("#status-line").isHidden()));
  // 詳細へ
  await page.locator(".hero").click();
  await page.waitForSelector("#view-detail:not([hidden]) .chart-box svg");
  check("詳細: 48h チャート SVG が表示", (await page.locator("#view-detail .chart-box svg").count()) === 1);
  check("詳細: 週間 7 行", (await page.locator("#view-detail .week li").count()) === 7);
  check("詳細: 日の出時刻", (await page.locator("#view-detail .meta").textContent()).includes("04:58"));
  check("詳細: 服装カード", (await page.locator("#view-detail .card .h").first().textContent()).length > 0);
  await page.locator("#view-detail rect.hit").nth(5).dispatchEvent("pointerenter");
  await page.waitForTimeout(150);
  check("詳細: バーの pointer でツールチップ", await page.locator("#view-detail .tip").isVisible());
  // 戻る
  await page.locator("#btn-back").click();
  await page.waitForSelector("#view-home:not([hidden])");
  check("詳細→戻るで一覧に戻る", await page.locator("#view-detail").isHidden());
  // 設定: レベル切替が保存される
  await page.locator("#btn-settings").click();
  await page.waitForSelector("#settings-sheet:not([hidden])");
  await page.locator('.level[data-lv="advanced"]').click();
  check("設定: レベル切替が aria-pressed に反映", (await page.locator('.level[data-lv="advanced"]').getAttribute("aria-pressed")) === "true");
  check("設定: sc.level が保存される(保存キー不変)", (await page.evaluate(() => localStorage.getItem("sc.level"))) === '"advanced"');
  check("設定: 入力欄の文字は 16px 以上", (await page.evaluate(() => Math.min(...[...document.querySelectorAll("#settings-sheet input, #settings-sheet select")].map(e => parseFloat(getComputedStyle(e).fontSize))))) >= 16);
  // スポット追加(保存形式不変: {id,name,region,lat,lon,offshore,custom})
  await page.fill("#f-name", "千倉"); await page.fill("#f-lat", "34.95"); await page.fill("#f-lon", "139.96");
  await page.locator("#f-add").click();
  await page.waitForFunction(() => document.querySelectorAll(".row").length === 5, null, { timeout: 10000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sc.spots")));
  check("設定: 追加スポットが sc.spots に旧形式で保存", saved.length === 1 && saved[0].name === "千倉" && saved[0].custom === true && typeof saved[0].offshore === "number", JSON.stringify(saved));
  check("正常系: コンソールエラーなし", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
} catch (e) { check("1. 正常系(本番経路・API モック): 例外なく完走", false, String(e).split(String.fromCharCode(10))[0]); }

// ========== 2. best_match 全null → gwam フォールバック ==========
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requested = [];
  await page.route("https://marine-api.open-meteo.com/**", r => { const u = r.request().url(); requested.push(u); r.fulfill({ json: marine(!u.includes("models=gwam")) }); });
  await page.route("https://api.open-meteo.com/**", r => r.fulfill({ json: weather() }));
  await page.goto(base);
  await page.waitForSelector(".hero .badge", { timeout: 10000 });
  check("フォールバック: 全null時に gwam へ再リクエスト", requested.some(u => u.includes("models=gwam")));
  await page.locator(".hero").click();
  await page.waitForSelector("#view-detail:not([hidden]) .meta");
  check("フォールバック: 使用モデル gwam が表示", (await page.locator("#view-detail .meta").textContent()).includes("gwam"));
  await page.close();
} catch (e) { check("2. best_match 全null → gwam フォールバック: 例外なく完走", false, String(e).split(String.fromCharCode(10))[0]); }

// ========== 3. 全モデル失敗 → 取得不可(キャッシュなし) ==========
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("https://marine-api.open-meteo.com/**", r => r.fulfill({ json: marine(true) }));
  await page.route("https://api.open-meteo.com/**", r => r.fulfill({ json: weather() }));
  await page.goto(base);
  await page.waitForSelector(".row .rk.none", { timeout: 10000 });
  check("異常系: 全モデル null で全スポット「取得不可」", (await page.locator(".row .rk.none").count()) === 5);
  check("異常系: 状態1文が bad", (await page.getAttribute("#status-line", "class")).includes("bad"));
  await page.close();
} catch (e) { check("3. 全モデル失敗 → 取得不可(キャッシュなし): 例外なく完走", false, String(e).split(String.fromCharCode(10))[0]); }

// ========== 4. 通信断 → キャッシュにフォールバック ==========
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await routeOk(page);
  await page.goto(base);
  await page.waitForSelector(".hero .badge", { timeout: 10000 });
  await page.unroute("https://marine-api.open-meteo.com/**"); await page.unroute("https://api.open-meteo.com/**");
  await page.route("https://*.open-meteo.com/**", r => r.abort());
  await page.locator("#btn-refresh").click();
  await page.waitForFunction(() => document.querySelector("#status-line") && document.querySelector("#status-line").textContent.includes("オフライン"), null, { timeout: 10000 });
  check("キャッシュ: 通信断時に「オフライン…取得のデータ」を表示", true);
  await ctx.close();
} catch (e) { check("4. 通信断 → キャッシュにフォールバック: 例外なく完走", false, String(e).split(String.fromCharCode(10))[0]); }

// ========== 5. ダーク ==========
try {
  const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); await routeOk(page); await page.goto(base); await page.waitForSelector(".hero .badge");
  check("ダーク: body がダーク背景(#10131a)", (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(16, 19, 26)");
  await ctx.close();
} catch (e) { check("5. ダーク: 例外なく完走", false, String(e).split(String.fromCharCode(10))[0]); }

// ========== 6. 状態フック(?state=)は通信せず・未知の値は本番経路 ==========
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let hits = 0; await page.route("https://*.open-meteo.com/**", r => { hits++; r.abort(); });
  await page.goto(base + "?state=normal"); await page.waitForSelector(".hero .badge");
  check("state=normal: 通信ゼロで5スポット描画", hits === 0 && (await page.locator(".row").count()) === 4, `hits=${hits}`);
  await page.goto(base + "?state=error"); await page.waitForSelector(".rk.none");
  check("state=error: 1スポットが取得不可", (await page.locator(".rk.none").count()) === 1);
  await page.goto(base + "?state=offline"); await page.waitForSelector("#status-line:not([hidden])");
  check("state=offline: オフライン帯", (await page.locator("#status-line").textContent()).includes("オフライン"));
  await page.goto(base + "?state=empty"); await page.waitForSelector(".empty");
  check("state=empty: 空状態に「スポットを追加」", (await page.locator(".empty").textContent()).includes("スポットを追加"));
  await page.goto(base + "?state=loading"); await page.waitForSelector(".skel");
  check("state=loading: スケルトン", (await page.locator(".skel").count()) >= 2);
  await page.goto(base + "?state=bogus"); await page.waitForTimeout(600);
  check("未知の state は本番経路(通信する)", hits > 0, `hits=${hits}`);
  await page.close();
} catch (e) { check("6. 状態フック(?state)は通信せず・未知の値は本番経路: 例外なく完走", false, String(e).split(String.fromCharCode(10))[0]); }

await browser.close(); server.close();
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
