// セトリズム 破壊的検証スイート:壊す前提でぶつけるテスト
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import zlib from "node:zlib";

import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "band");
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  let path = req.url.split("#")[0].split("?")[0];
  if (path === "/") path = "/index.html";
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(8932, r));
const URL0 = "http://localhost:8932/";

let failures = 0;
const ok = (cond, name) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required",
         "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  return errors;
}

// 独立コンテキストで localStorage を仕込んで起動できるかを検証
async function bootWith(name, storageValue, extraCheck = null) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  if (storageValue !== undefined) {
    await page.addInitScript((v) => localStorage.setItem("setlism:v1", v), storageValue);
  }
  await page.goto(URL0, { waitUntil: "networkidle" });
  const booted = await page.evaluate(() =>
    !!document.querySelector("#songList") && !document.getElementById("tab-setlist").hidden ||
    !document.getElementById("tab-live").hidden
  );
  let extra = true;
  if (extraCheck) extra = await extraCheck(page);
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(booted && clean && extra, `${name}${clean ? "" : " → " + errors[0]}`);
  await ctx.close();
}

// ============ A. 壊れた localStorage で起動 ============
console.log("--- A. 壊れた保存データからの起動 ---");
await bootWith("A1: JSONですらない文字列", "{{{not json!!");
await bootWith("A2: null", "null");
await bootWith("A3: ただの文字列JSON", '"こんにちは"');
await bootWith("A4: setlists が文字列", '{"v":2,"setlists":"x","library":[]}');
await bootWith("A5: library がオブジェクト", '{"v":2,"library":{},"setlists":[]}');
await bootWith("A6: 欠損参照itemsとゴミitems",
  JSON.stringify({
    v: 2,
    library: [{ id: "s1", title: "生きてる曲", sec: 100, energy: 3 }],
    setlists: [{ id: "sl", name: "テスト", items: [
      { id: "i1", songId: "s1" }, { id: "i2", songId: "GONE" }, null, 42, "x", { songId: 5 },
    ] }],
    activeId: "sl",
  }),
  async (p) => (await p.locator("#songList .song").count()) === 1
);
await bootWith("A7: live.steps が文字列",
  JSON.stringify({
    v: 2, activeId: "sl",
    library: [{ id: "s1", title: "曲", sec: 100, energy: 3 }],
    setlists: [{ id: "sl", name: "T", items: [{ id: "i1", songId: "s1" }] }],
    live: { setlistId: "sl", steps: "broken", idx: 999 },
  })
);
await bootWith("A8: live.idx が範囲外+ゴミstep",
  JSON.stringify({
    v: 2, activeId: "sl",
    library: [{ id: "s1", title: "曲", sec: 100, energy: 3 }],
    setlists: [{ id: "sl", name: "T", items: [{ id: "i1", songId: "s1" }] }],
    live: { setlistId: "sl", idx: 999, startedAt: "x", stepStartedAt: null, log: "junk",
      steps: [{ type: "weird" }, { type: "song", label: 12345, planStart: "a", planSec: -5 }] },
  }),
  // 復元されるなら本番ビュー、捨てられるならアイドル — どちらでもクラッシュしないこと
  async (p) => (await p.locator("#liveView, #liveIdle").count()) > 0
);
await bootWith("A9: metro/tuner/eventsがゴミ",
  JSON.stringify({
    v: 2, activeId: "x",
    library: [], setlists: [{ id: "sl", name: "T", items: [] }],
    metro: { bpm: "fast", beats: -1, trainer: "x", mute: 7 },
    tuner: { a4: 99999 },
    events: [{ name: 123, acts: "x" }, null, "junk"],
  })
);
await bootWith("A10: v1形式にゴミ曲混入",
  JSON.stringify({
    v: 1, activeId: "sl1",
    setlists: [{ id: "sl1", name: "旧", songs: [
      { title: "正常曲", bpm: 120, sec: 200, energy: 3 },
      null, 42, { title: { nested: true }, bpm: "x", sec: "y", energy: 99 },
    ] }],
  }),
  async (p) => (await p.locator("#songList .song").count()) >= 1
);

// ============ メインの対話コンテキスト ============
const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write", "microphone"] });
const page = await ctx.newPage();
const errors = watchErrors(page);
const promptQueue = [];
page.on("dialog", async (d) => {
  if (d.type() === "prompt") await d.accept(promptQueue.length ? promptQueue.shift() : d.defaultValue());
  else await d.accept();
});
await page.goto(URL0, { waitUntil: "networkidle" });

const b64url = (buf) => Buffer.from(buf).toString("base64url");

// ============ B. 共有リンクのファズ ============
console.log("--- B. 共有リンクのファズ ---");
const fuzzPayloads = [
  ["B1: 空ペイロード", ""],
  ["B2: ドットなしゴミ", "zzzzzz"],
  ["B3: base64でない圧縮ペイロード", "1.!!!!####"],
  ["B4: 未知のバージョン", "9.abcabc"],
  ["B5: JSONでない非圧縮", "0." + b64url("not json at all")],
  ["B6: 構造が違うJSON", "0." + b64url('{"s":"x"}')],
  ["B7: 圧縮ゴミバイト", "1." + b64url(Buffer.from([1, 2, 3, 250, 251, 252]))],
  ["B8: 正常圧縮だが壊れ構造", "1." + b64url(zlib.deflateRawSync(Buffer.from('{"n":1,"s":123}')))],
];
for (const [name, payload] of fuzzPayloads) {
  await page.evaluate((p) => { location.hash = "#s=" + p; }, payload);
  await page.waitForTimeout(350);
  const toastShown = await page.evaluate(() =>
    document.getElementById("toast").textContent.includes("読み込めませんでした"));
  const hashCleared = await page.evaluate(() => location.hash === "");
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(toastShown && hashCleared && clean, `${name}:トースト表示+ハッシュ除去+無クラッシュ`);
  errors.length = 0;
  await page.waitForTimeout(150);
}

// ============ C. XSS注入 ============
console.log("--- C. XSS/HTML注入 ---");
const XSS_TITLE = '<img src=x onerror="window.__xss=1">曲';
await page.click('[data-tab="library"]');
await page.click("#libAddBtn");
await page.fill("#f-title", XSS_TITLE);
await page.fill("#f-memo", "<svg onload=window.__xss2=1>メモ");
await page.fill("#f-gear", "<script>window.__xss3=1</script>準備");
await page.fill("#f-dur", "3:00");
await page.click("#songSaveBtn");
await page.click('[data-tab="setlist"]');
await page.click("#addSongBtn");
await page.fill("#pickerSearch", "曲");
await page.locator(".picker-row", { hasText: "onerror" }).click();
await page.click("#pickerClose");
promptQueue.push('"><script>window.__xss4=1</script>セトリ');
await page.click("#renameSetlistBtn");
await page.waitForTimeout(300);
const xss = await page.evaluate(() => ({
  x1: window.__xss, x2: window.__xss2, x3: window.__xss3, x4: window.__xss4,
  titleShownAsText: [...document.querySelectorAll(".song-title")].some((el) => el.textContent.includes('<img src=x')),
  imgInjected: !!document.querySelector("#songList img, .song-title img"),
}));
ok(!xss.x1 && !xss.x2 && !xss.x3 && !xss.x4, "スクリプトは一切実行されない");
ok(xss.titleShownAsText && !xss.imgInjected, "HTMLはただの文字として表示される");
// 本番モードのチェックリスト・印刷・共有テキストにも注入されないか
await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
const printInjected = await page.evaluate(() => !!document.querySelector("#stageSheet img, #stageSheet script"));
ok(!printInjected, "ステージシートにも注入されない");
await page.click("#shareBtn");
await page.click("#shareTextBtn");
const sharedText = await page.evaluate(() => navigator.clipboard.readText());
ok(sharedText.includes('<img src=x'), "テキスト書き出しは原文のまま(実行はされない)");
// エナジーチャートのツールチップ(innerHTML経由のSVGにタイトルが入らないか)
const chartInjected = await page.evaluate(() => !!document.querySelector("#energyChart img, #energyChart script"));
ok(!chartInjected, "チャートにも注入されない");
// 後片付け:曲追加・rename・item追加をUndo
await page.click("#undoBtn"); await page.click("#undoBtn"); await page.click("#undoBtn");

// ============ D. 極端なデータ量 ============
console.log("--- D. 極端なデータ量(80曲) ---");
{
  const bigCtx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const bp = await bigCtx.newPage();
  const bigErrors = watchErrors(bp);
  const songs = Array.from({ length: 80 }, (_, i) => ({
    id: "s" + i,
    title: `曲${i}-${Math.random().toString(36).slice(2)}`.repeat(3),
    bpm: 60 + (i * 7) % 180, key: ["C", "Am", "G", "F#m"][i % 4],
    tuning: ["レギュラー", "半音下げ", "ドロップD"][i % 3],
    sec: 120 + (i % 8) * 30, energy: 1 + (i % 5),
    memo: "メモ".repeat(20), gear: ["準備" + i],
  }));
  const seed = {
    v: 2, activeId: "big",
    library: songs,
    setlists: [{ id: "big", name: "フェス耐久", targetMin: 300, gapSec: 15, mcSec: 60,
      items: songs.map((s, i) => ({ id: "i" + i, songId: s.id, mc: i % 10 === 0 })) }],
  };
  await bp.addInitScript((v) => localStorage.setItem("setlism:v1", v), JSON.stringify(seed));
  await bp.goto(URL0, { waitUntil: "networkidle" });
  ok((await bp.locator("#songList .song").count()) === 80, "80曲を描画");
  const labelCount = await bp.locator("#energyChart svg text").count();
  ok(labelCount < 40, `チャートのラベルが間引かれる (${labelCount}個)`);
  // 共有リンク(巨大)
  await bp.click("#shareBtn");
  await bp.click("#shareLinkBtn");
  await bp.waitForTimeout(400);
  const bigUrl = await bp.evaluate(() => navigator.clipboard.readText());
  ok(bigUrl.includes("#s=1."), `巨大セトリの共有リンク生成 (len=${bigUrl.length})`);
  // QR:容量超過なら丁寧に失敗、入るなら表示 — どちらでもクラッシュしない
  await bp.click("#shareBtn");
  await bp.click("#shareQrBtn");
  await bp.waitForTimeout(500);
  const qrOutcome = await bp.evaluate(() =>
    document.getElementById("qrDialog").open ||
    document.getElementById("toast").textContent.includes("QRコード"));
  ok(qrOutcome, "巨大セトリのQR:表示または丁寧なエラー");
  // 巨大リンクを実際に開いて取り込めるか
  const p2 = await bigCtx.newPage();
  const p2errors = watchErrors(p2);
  await p2.goto(bigUrl, { waitUntil: "networkidle" });
  await p2.waitForSelector("#importDialog[open]", { timeout: 5000 });
  await p2.click("#importOkBtn");
  ok((await p2.locator("#songList .song").count()) === 80, "巨大リンクの取り込み(80曲)");
  ok(bigErrors.length === 0 && p2errors.length === 0, "巨大データでもJSエラーなし");
  await bigCtx.close();
}

// ============ E. Undo枯渇 ============
console.log("--- E. Undoスタック枯渇 ---");
{
  const before = await page.locator("#totalTime").textContent();
  // 55回連続でMCトグル(スタック上限50を超える)
  await page.evaluate(async () => {
    for (let i = 0; i < 55; i++) {
      document.querySelector("#songList .song .chip-mc").click();
      await new Promise((r) => setTimeout(r, 5));
    }
  });
  // 上限50+余分に押しても壊れない
  await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      const b = document.getElementById("undoBtn");
      if (b.disabled) break;
      b.click();
      await new Promise((r) => setTimeout(r, 5));
    }
    for (let i = 0; i < 10; i++) document.getElementById("undoBtn").click();
  });
  const undoDisabled = await page.locator("#undoBtn").isDisabled();
  const total = await page.locator("#totalTime").textContent();
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(undoDisabled && clean, `55回変更→70回Undoでも壊れない(最終 ${total} / 開始 ${before})`);
  errors.length = 0;
}

// ============ F. ライブ進行中にデータを消す ============
console.log("--- F. 本番モード中の削除 ---");
{
  await page.click('[data-tab="live"]');
  await page.click("#liveStartBtn");
  await page.click("#liveNextBtn"); // 2ステップ目へ
  // 別セトリを作って、ライブ中のセトリを削除
  await page.click('[data-tab="setlist"]');
  promptQueue.push("避難用セトリ");
  await page.click("#newSetlistBtn");
  await page.selectOption("#setlistSelect", { index: 0 }); // 元のセトリ
  await page.click("#deleteSetlistBtn"); // confirm自動OK
  // さらにライブラリから次の曲を削除
  await page.click('[data-tab="library"]');
  await page.locator("#libList .song").first().locator('button[title="ライブラリから削除"]').click();
  // ライブ画面に戻って最後まで進める
  await page.click('[data-tab="live"]');
  const stillLive = !(await page.locator("#liveView").isHidden());
  ok(stillLive, "セトリ・曲を消しても本番モードは継続");
  for (let i = 0; i < 12; i++) {
    if (await page.locator("#liveSummaryDialog[open]").count()) break;
    await page.click("#liveNextBtn");
    await page.waitForTimeout(40);
  }
  ok((await page.locator("#liveSummaryDialog[open]").count()) === 1, "削除後も完走してまとめ表示");
  await page.click("#liveSummaryClose");
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(clean, `本番モード中の削除でJSエラーなし${clean ? "" : " → " + errors[0]}`);
  errors.length = 0;
}

// ============ G. 空セトリでの各モード起動+通し練習中のUndo ============
console.log("--- G. 空セトリ+通し練習中のUndo ---");
{
  // Fの削除でアクティブは空の「避難用セトリ」— 空のまま各モードを叩く
  await page.click('[data-tab="practice"]');
  await page.click("#runStartBtn");
  await page.waitForTimeout(200);
  const idleStays = !(await page.locator("#runIdle").isHidden());
  await page.click('[data-tab="live"]');
  await page.click("#liveStartBtn");
  await page.waitForTimeout(200);
  const liveIdleStays = !(await page.locator("#liveIdle").isHidden());
  await page.click('[data-tab="setlist"]');
  await page.click("#printBtn");
  await page.waitForTimeout(200);
  await page.click("#shareBtn");
  await page.click("#shareQrBtn");
  await page.waitForTimeout(200);
  await page.locator("#shareDialog[open] #shareDialogClose, #shareDialogClose").first().click().catch(() => {});
  let clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(idleStays && liveIdleStays && clean, "空セトリで通し/本番/印刷/QRを叩いても丁寧に拒否");
  errors.length = 0;

  // 曲を2曲入れてから通し練習中にUndoで足元のデータを差し替える
  await page.click("#addSongBtn");
  await page.locator(".picker-row").first().click();
  await page.locator(".picker-row").nth(1).click();
  await page.click("#pickerClose");
  await page.click('[data-tab="practice"]');
  await page.click("#runStartBtn");
  await page.waitForSelector("#runView:not([hidden])");
  await page.evaluate(async () => (await import("./store.js")).undo());
  await page.click("#runNextBtn");
  await page.click("#runNextBtn");
  await page.waitForTimeout(200);
  const done = !(await page.locator("#runView").isHidden()) || !(await page.locator("#runIdle").isHidden());
  if (!(await page.locator("#runView").isHidden())) await page.click("#runStopBtn");
  clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(done && clean, "通し練習中にUndoしても進行が壊れない");
  errors.length = 0;
}

// ============ H. 保存容量エラー ============
console.log("--- H. localStorage書き込み失敗 ---");
{
  await page.evaluate(() => {
    const orig = localStorage.setItem.bind(localStorage);
    window.__restoreLS = () => { localStorage.setItem = orig; };
    localStorage.setItem = () => { throw new DOMException("QuotaExceededError"); };
  });
  await page.click('[data-tab="setlist"]');
  await page.locator("#songList .song .chip-mc").first().click();
  await page.waitForTimeout(300);
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(clean, "保存が失敗してもUIは動き続ける(クラッシュしない)");
  await page.evaluate(() => window.__restoreLS());
  await page.click("#undoBtn");
  errors.length = 0;
}

// ============ I. バックアップの取り込み ============
console.log("--- I. バックアップ ---");
{
  const v1backup = JSON.stringify({
    v: 1, activeId: "sl1",
    setlists: [{ id: "sl1", name: "v1バックアップ", targetMin: 20, gapSec: 10, mcSec: 60,
      songs: [{ title: "旧形式の曲", bpm: 100, sec: 180, energy: 2, mc: false }] }],
  });
  await page.setInputFiles("#importFile", {
    name: "old-backup.json", mimeType: "application/json", buffer: Buffer.from(v1backup),
  });
  await page.waitForTimeout(400);
  const migrated = await page.locator("#setlistSelect option").allTextContents();
  ok(migrated.some((t) => t.includes("v1バックアップ")), "v1形式バックアップも移行して読める");

  await page.setInputFiles("#importFile", {
    name: "junk.json", mimeType: "application/json", buffer: Buffer.from("{{{{broken"),
  });
  await page.waitForTimeout(400);
  const toastText = await page.locator("#toast").textContent();
  const stillThere = (await page.locator("#setlistSelect option").allTextContents())
    .some((t) => t.includes("v1バックアップ"));
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(toastText.includes("読み込めませんでした") && stillThere && clean, "壊れたバックアップは拒否されデータ無事");
  errors.length = 0;
}

// ============ J. 非対応ファイルをループ再生へ ============
console.log("--- J. 非対応ファイル ---");
{
  await page.click('[data-tab="practice"]');
  await page.setInputFiles("#loopFile", {
    name: "偽物.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("これは音声ではありません"),
  });
  await page.waitForTimeout(800);
  await page.click("#loopPlayBtn");
  await page.waitForTimeout(500);
  const status = await page.locator("#loopStatus").textContent();
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(clean, `偽音声ファイルでもクラッシュしない(status: ${status.slice(0, 30)}…)`);
  errors.length = 0;
}

// ============ K. チューナー二度押し ============
console.log("--- K. チューナー連打 ---");
{
  await page.click('[data-tab="tuner"]');
  await page.click("#tunerToggle");
  await page.click("#tunerToggle").catch(() => {});
  await page.click("#tunerToggle").catch(() => {});
  await page.waitForTimeout(800);
  // 最終的に開始/停止どちらかの安定状態にあること
  const label = await page.locator("#tunerToggle").textContent();
  const stable = label === "チューナー開始" || label === "チューナー停止";
  if (label === "チューナー停止") await page.click("#tunerToggle");
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(stable && clean, `チューナー連打でも安定 (${label})`);
  errors.length = 0;
}

// ============ L. ダイアログの重ね開き ============
console.log("--- L. ダイアログ重ね開き ---");
{
  await page.click('[data-tab="setlist"]');
  // 有効な共有リンクを先に作る
  await page.click("#shareBtn");
  await page.click("#shareLinkBtn");
  await page.waitForTimeout(300);
  const validUrl = await page.evaluate(() => navigator.clipboard.readText());
  const validHash = validUrl.split("#")[1];
  // 曲ダイアログを開いたまま共有リンクが飛んでくる
  await page.click('[data-tab="library"]');
  await page.click("#libAddBtn");
  await page.evaluate((h) => { location.hash = h; }, validHash);
  await page.waitForSelector("#importDialog[open]", { timeout: 3000 });
  await page.click("#importCancelBtn");
  await page.click("#songCancelBtn");
  const clean = errors.filter((e) => !e.includes("favicon")).length === 0;
  ok(clean, "編集ダイアログ中に共有リンク受信しても両立");
  errors.length = 0;
}

await ctx.close();
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
process.exit(failures ? 1 : 0);
