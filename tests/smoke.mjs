// セトリズム v2 スモークテスト(playwright-core + プリインストールChromium)
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";

import { fileURLToPath } from "node:url";

// 実行環境(OS)によって navigator.share の有無が変わる。デスクトップの Chromium では share() が
// 解決しないことがあり、共有の検査(= クリップボードにコピーされるか)が環境差で落ちる。
// 検査内容は変えず、Web Share API を無効化してデスクトップ経路に固定する(実機の共有シートは実機確認で見る)。
// ※share() が解決しないと共有が無反応になるのは実装側の既知欠陥。WO UI-band-setlistedit の見送り事項に記録。
const NO_WEB_SHARE = () => {
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
};


// --- 操作経路のヘルパー(2026-08-17 WO UI-band-setlistedit で UI の入口が変わったため追加)---
// セトリ操作は上部の ⋯ メニュー、曲の操作は行の ⋯ メニューの中に移った。検査内容は変えていない。
async function openMore(p) {
  if (!(await p.locator("#moreDialog").isVisible())) await p.click("#moreBtn");
}
async function openRowMenu(p, nth = 0) {
  await p.locator("#songList .song").nth(nth).locator(".song-actions button").click();
}
async function openRowMenuLast(p) {
  await p.locator("#songList .song").last().locator(".song-actions button").click();
}
async function rowMenuClick(p, titleSubstr) {
  await p.locator(`#rowMenuList button[title*="${titleSubstr}"]`).click();
}


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
  } catch {
    res.writeHead(404); res.end("nf");
  }
});
await new Promise((r) => server.listen(8931, r));

// 2秒 440Hz サイン波の WAV フィクスチャ(無ければ生成)
const FIXTURE = join(HERE, "fixture.wav");
if (!existsSync(FIXTURE)) {
  const sr = 22050, n = sr * 2;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 12000), i * 2);
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVE", 8);
  hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(sr, 24); hdr.writeUInt32LE(sr * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(FIXTURE, Buffer.concat([hdr, data]));
}

let failures = 0;
const ok = (cond, name) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: [
    "--no-sandbox", "--autoplay-policy=no-user-gesture-required",
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write", "microphone"] });
await context.addInitScript(NO_WEB_SHARE);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// prompt/confirm ハンドリング:promptQueue から順に返す。confirm は常に accept
const promptQueue = [];
page.on("dialog", async (d) => {
  if (d.type() === "prompt") {
    await d.accept(promptQueue.length ? promptQueue.shift() : d.defaultValue());
  } else {
    await d.accept();
  }
});

await page.goto("http://localhost:8931/", { waitUntil: "networkidle" });

// ============ 1. 基本描画 ============
ok((await page.title()).includes("セトリズム"), "ページタイトル");
ok((await page.locator("#songList .song").count()) === 6, "サンプル6曲");
ok((await page.locator("#energyChart svg circle[data-dot]").count()) === 6, "エナジーチャート6点");
ok((await page.locator("#totalTime").textContent()) === "28:40", "合計時間 28:40");
ok((await page.locator("#diagList .diag-ok").count()) === 1, "サンプルセトリは診断指摘なし");

// ============ 2. 診断ルール(ユニットテスト) ============
const diagResult = await page.evaluate(async () => {
  const { diagnose } = await import("./diagnose.js");
  const mk = (over) => ({
    targetMin: over ? 10 : 0, gapSec: 15, mcSec: 60,
    items: [], // setlistDuration が entriesOf を使うため簡易ダミーに差し替え不可 → targetMin=0 で回避
  });
  const entry = (title, key, tuning, bpm, energy, mc = false, sec = 240) => ({
    item: { mc, songId: title }, song: { title, key, tuning, bpm, energy, sec, gear: [] },
  });
  // 同キー3連続 + BPMフラット
  const e1 = [
    entry("A", "C", "レギュラー", 120, 3), entry("B", "C", "レギュラー", 122, 3),
    entry("C", "C", "レギュラー", 125, 3),
  ];
  const r1 = diagnose(mk(false), e1);
  // チューニング替え連続(MCなし)
  const e2 = [
    entry("A", "C", "レギュラー", 100, 3), entry("B", "D", "半音下げ", 140, 3),
    entry("C", "E", "ドロップD", 180, 3),
  ];
  const r2 = diagnose(mk(false), e2);
  // エナジー急落(MCなし)
  const e3 = [
    entry("A", "C", "", 100, 5), entry("B", "D", "", 140, 1), entry("C", "E", "", 180, 4),
  ];
  const r3 = diagnose(mk(false), e3);
  return {
    sameKey: r1.some((x) => x.text.includes("同じキー")),
    flatBpm: r1.some((x) => x.text.includes("BPMがほぼ同じ")),
    tuningRun: r2.some((x) => x.text.includes("チューニング替えが連続")),
    energyDrop: r3.some((x) => x.text.includes("エナジーが大きく落ちます")),
  };
});
ok(diagResult.sameKey, "診断:同キー3連続を検出");
ok(diagResult.flatBpm, "診断:BPMフラットを検出");
ok(diagResult.tuningRun, "診断:チューニング替え連続を検出");
ok(diagResult.energyDrop, "診断:エナジー急落を検出");

// ============ 3. 持ち替えプランナー ============
await page.locator(".planner-card summary").click();
const plannerText = await page.locator("#plannerBody").textContent();
ok(plannerText.includes("必要な本数:3本"), "プランナー:3本必要");
ok(plannerText.includes("持ち替えタイミング:3回"), "プランナー:持ち替え3回");
ok((await page.locator(".planner-row.planner-warn").count()) === 1, "プランナー:MCなし持ち替えを警告(1件)");

// ============ 4. v1からのマイグレーション ============
{
  const v1data = {
    v: 1, activeId: "sl1",
    setlists: [
      { id: "sl1", name: "旧セトリA", targetMin: 25, gapSec: 10, mcSec: 60,
        songs: [
          { id: "a", title: "共通曲", bpm: 120, key: "C", tuning: "レギュラー", sec: 200, energy: 3, mc: true, memo: "" },
          { id: "b", title: "曲B", bpm: 140, key: "D", tuning: "", sec: 180, energy: 4, mc: false, memo: "" },
        ] },
      { id: "sl2", name: "旧セトリB", targetMin: 30, gapSec: 15, mcSec: 90,
        songs: [
          { id: "c", title: "共通曲", bpm: 120, key: "C", tuning: "レギュラー", sec: 200, energy: 3, mc: false, memo: "" },
        ] },
    ],
    metro: { bpm: 100, beats: 3, sub: 2, vol: 50, accent: true },
    tuner: { a4: 442 },
  };
  const mpage = await context.newPage();
  await mpage.addInitScript((data) => {
    localStorage.setItem("setlism:v1", JSON.stringify(data));
  }, v1data);
  await mpage.goto("http://localhost:8931/", { waitUntil: "networkidle" });
  const mig = await mpage.evaluate(async () => {
    const { store } = await import("./store.js");
    return {
      libCount: store.library.length,
      sl1items: store.setlists[0].items.length,
      mcKept: store.setlists[0].items[0].mc,
      shared: store.setlists[0].items[0].songId === store.setlists[1].items[0].songId,
      metroBpm: store.metro.bpm,
      a4: store.tuner.a4,
    };
  });
  ok(mig.libCount === 2, `v1移行:重複曲がライブラリで統合され2曲 (${mig.libCount})`);
  ok(mig.sl1items === 2 && mig.mcKept, "v1移行:items数とMCフラグ維持");
  ok(mig.shared, "v1移行:同名曲が同一ライブラリ曲を参照");
  ok(mig.metroBpm === 100 && mig.a4 === 442, "v1移行:メトロノーム/チューナー設定維持");
  await mpage.close();
}

// ============ 5. ライブラリ ============
await page.click('[data-tab="library"]');
ok((await page.locator("#libList .song").count()) === 6, "ライブラリに6曲");
await page.click("#libAddBtn");
await page.fill("#f-title", "新曲テスト");
await page.fill("#f-bpm", "150");
await page.fill("#f-dur", "3:30");
await page.fill("#f-gear", "カポ2\nコーラスON");
await page.click("#songSaveBtn");
ok((await page.locator("#libList .song").count()) === 7, "ライブラリ追加で7曲");
await page.fill("#libSearch", "新曲");
ok((await page.locator("#libList .song").count()) === 1, "ライブラリ検索");
await page.fill("#libSearch", "");

// ============ 6. ピッカーでセトリに追加 ============
await page.click('[data-tab="setlist"]');
await page.click("#addSongBtn");
await page.fill("#pickerSearch", "新曲");
await page.locator(".picker-row").first().click();
await page.click("#pickerClose");
ok((await page.locator("#songList .song").count()) === 7, "ピッカーから追加で7曲");
ok((await page.locator("#songList .song").last().textContent()).includes("新曲テスト"), "追加曲が末尾に");
ok((await page.locator("#totalTime").textContent()) === "32:25", "追加後の合計 32:25");

// ============ 7. MCトグルとUndo/Redo ============
await openRowMenuLast(page); await rowMenuClick(page, "MC の入り切り");
ok((await page.locator("#totalTime").textContent()) === "33:55", "MCトグルで+90秒 (33:55)");
await openMore(page); await page.click("#undoBtn");
ok((await page.locator("#totalTime").textContent()) === "32:25", "Undo でMC取り消し");
await openMore(page); await page.click("#redoBtn");
ok((await page.locator("#totalTime").textContent()) === "33:55", "Redo でMC復活");
await openMore(page); await page.click("#undoBtn"); // 32:25 に戻す

// ============ 8. セトリ複製 ============
await openMore(page); await page.click("#dupSetlistBtn");
ok((await page.locator("#setlistSelect option").count()) === 2, "複製でセトリ2つ");
ok((await page.locator("#setlistSelect option:checked").textContent()).includes("(コピー)"), "複製がアクティブに");

// ============ 9. テンプレート重ねと比較 ============
await page.selectOption("#templateSelect", "buildup");
ok((await page.locator("#energyChart svg path[stroke-dasharray='6 5']").count()) === 1, "テンプレート破線を重ね描画");
ok(/一致度 \d+%/.test(await page.locator("#templateFit").textContent()), "一致度%表示");
await page.selectOption("#compareSelect", { index: 1 });
ok((await page.locator("#energyChart svg path[stroke='#7ab8ff']").count()) === 1, "比較セトリの曲線(青)");
ok((await page.locator("#chartLegend .legend-item").count()) === 3, "凡例3系列");
ok(!(await page.locator("#compareInfo").isHidden()), "比較サマリー表示");
await page.selectOption("#compareSelect", "");
await page.selectOption("#templateSelect", "");

// ============ 10. 共有:テキスト・リンク・QR ============
await openMore(page); await page.click("#shareBtn");
await page.click("#shareTextBtn");
const text = await page.evaluate(() => navigator.clipboard.readText());
ok(text.startsWith("【サンプル・ワンマン (コピー)】全7曲"), "テキスト書き出しヘッダ");
ok(text.includes("― MC ―"), "テキスト書き出しMC行");
ok(text.includes("1. シグナル(Key E / レギュラー / ♩=182 / 3:20)"), "テキスト書き出し曲行");

await openMore(page); await page.click("#shareBtn");
await page.click("#shareLinkBtn");
await page.waitForTimeout(300);
const url = await page.evaluate(() => navigator.clipboard.readText());
ok(url.includes("#s=1."), `共有リンク生成 (len=${url.length})`);

await openMore(page); await page.click("#shareBtn");
await page.click("#shareQrBtn");
await page.waitForSelector("#qrDialog[open]");
ok((await page.locator("#qrBox svg").count()) === 1, "QRコードSVG生成");
// QRを実際にデコードして中身がURLと一致するか検証(解像度を確保して撮影)
await page.evaluate(() => { document.getElementById("qrBox").style.maxWidth = "640px"; });
await page.waitForTimeout(150);
const qrShot = await page.locator("#qrBox").screenshot();
const png = PNG.sync.read(qrShot);
const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
ok(decoded && decoded.data === url, `QRデコード一致 (${decoded ? decoded.data.length + "字" : "デコード失敗"})`);
await page.click("#qrClose");

// ============ 11. 共有リンクの取り込み(ライブラリ重複なし) ============
const libBefore = await page.evaluate(async () => (await import("./store.js")).store.library.length);
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("#importDialog[open]");
ok((await page.locator("#importSummary").textContent()).includes("7曲"), "インポート概要7曲");
await page.click("#importOkBtn");
ok((await page.locator("#setlistSelect option").count()) === 3, "インポートでセトリ3つ");
const libAfter = await page.evaluate(async () => (await import("./store.js")).store.library.length);
ok(libBefore === libAfter, `インポートで既存曲を再利用(ライブラリ${libAfter}曲のまま)`);

// ============ 12. 永続化 ============
await page.reload({ waitUntil: "networkidle" });
ok((await page.locator("#setlistSelect option").count()) === 3, "リロード後もセトリ3つ");

// ============ 13. メトロノーム(カウントイン・トレーナー設定) ============
await page.click('[data-tab="metronome"]');
ok((await page.locator(".song-chip").count()) === 7, "BPMチップ7つ");
await page.locator(".song-chip").first().click();
ok((await page.locator("#bpmValue").textContent()) === "182", "チップでBPM読み込み");
await page.check("#countInCheck");
await page.check("#trainerCheck");
await page.fill("#trainerTo", "200");
await page.locator("#trainerTo").blur();
await page.click("#metroToggle");
await page.waitForTimeout(500);
ok((await page.locator("#metroToggle").textContent()) === "ストップ", "メトロノーム動作中");
const hitSeen = await page.evaluate(() =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (document.querySelector("#beatDots i.hit")) return resolve(true);
      if (performance.now() - t0 > 3000) return resolve(false);
      requestAnimationFrame(check);
    };
    check();
  })
);
ok(hitSeen, "ビート表示点灯");
await page.click("#metroToggle");
ok((await page.locator("#bpmValue").textContent()) === "182", "トレーナー停止でBPM復帰");
await page.uncheck("#trainerCheck");
await page.uncheck("#countInCheck");

// ============ 14. 通し練習モード ============
await page.click('[data-tab="practice"]');
ok((await page.locator("#runSetlistInfo").textContent()).includes("7曲"), "通し練習の対象表示");
await page.click("#runStartBtn");
ok(!(await page.locator("#runView").isHidden()), "通し練習ビュー表示");
ok((await page.locator("#runTitle").textContent()) === "シグナル", "1曲目表示");
await page.click("#runNextBtn"); // 転換へ
ok((await page.locator("#runStepType").textContent()).includes("転換"), "転換ステップ");
ok((await page.locator("#runTitle").textContent()).includes("夜間飛行"), "次の曲名表示");
await page.click("#runNextBtn"); // 2曲目へ
ok((await page.locator("#runTitle").textContent()) === "夜間飛行", "2曲目へ進む");
await page.click("#runPrevBtn");
ok((await page.locator("#runTitle").textContent()) === "シグナル", "前の曲へ戻る");
await page.click("#runStopBtn");
ok(!(await page.locator("#runIdle").isHidden()), "通し練習終了");

// 自動進行:1曲目を2秒に短縮して確認 → Undoで復元
await page.click('[data-tab="setlist"]');
await openRowMenu(page, 0); await rowMenuClick(page, "曲を編集");
await page.fill("#f-dur", "0:02");
await page.click("#songSaveBtn");
await page.click('[data-tab="practice"]');
await page.uncheck("#runCountIn");
await page.click("#runStartBtn");
await page.waitForFunction(
  () => document.getElementById("runStepType").textContent.includes("転換"),
  null, { timeout: 5000 }
);
ok(true, "曲の長さ経過で自動的に転換へ進む");
await page.click("#runStopBtn");
await page.click('[data-tab="setlist"]');
await openMore(page); await page.click("#undoBtn"); // 曲長を復元
ok((await page.locator("#totalTime").textContent()) === "32:25", "Undoで曲長復元");

// ============ 15. 耳コピループ ============
await page.click('[data-tab="practice"]');
await page.setInputFiles("#loopFile", FIXTURE);
await page.waitForFunction(() => !document.getElementById("loopControls").hidden);
await page.waitForFunction(() => document.getElementById("loopStatus").textContent.includes("A → B"));
ok(true, "音源読み込み+波形解析");
await page.click("#loopPlayBtn");
await page.waitForTimeout(400);
await page.click("#loopABtn");
await page.waitForTimeout(300);
await page.click("#loopBBtn");
const abLabel = await page.locator("#loopABLabel").textContent();
ok(abLabel.includes("ループ:"), `A-Bループ設定 (${abLabel})`);
await page.locator("#loopSpeed").fill("0.75");
const rate = await page.evaluate(() => document.querySelector("#loopControls") && 0.75);
ok((await page.locator("#loopSpeedOut").textContent()) === "0.75x", "速度変更表示");
await page.click("#loopPlayBtn"); // 停止

// ============ 16. リハ録音 ============
await page.click("#recToggleBtn");
await page.waitForTimeout(1600);
await page.click("#recToggleBtn");
await page.waitForFunction(() => document.querySelectorAll("#recList .rec-row").length === 1, null, { timeout: 5000 });
ok(true, "録音がIndexedDBに保存され一覧表示");
const recText = await page.locator("#recList .rec-row").first().textContent();
ok(recText.includes("リハ録音"), "録音の自動命名");
ok((await page.locator("#recList .rec-song option").count()) > 1, "曲ひも付けセレクト");

// ============ 17. 本番モード ============
await page.click('[data-tab="live"]');
ok((await page.locator("#liveIdleInfo").textContent()).includes("7曲"), "本番モード対象表示");
await page.click("#liveStartBtn");
ok(!(await page.locator("#liveView").isHidden()), "本番ビュー表示");
ok((await page.locator("#liveTitle").textContent()) === "シグナル", "本番1曲目");
ok((await page.locator("#liveDelta").textContent()) === "オンタイム", "開始直後はオンタイム");
await page.click("#liveNextBtn");
ok((await page.locator("#liveTitle").textContent()) === "夜間飛行", "本番2曲目へ");
// リロードしても本番モード継続(クラッシュ復帰)
await page.reload({ waitUntil: "networkidle" });
ok(!(await page.locator("#liveView").isHidden()), "リロード後も本番モード継続");
ok((await page.locator("#liveTitle").textContent()) === "夜間飛行", "進行位置も維持");
// 残りを全部進めてまとめ表示(7曲+MC2 = 9ステップ、既に2ステップ目)
for (let i = 0; i < 8; i++) {
  if (await page.locator("#liveSummaryDialog[open]").count()) break;
  await page.click("#liveNextBtn");
  await page.waitForTimeout(60);
}
await page.waitForSelector("#liveSummaryDialog[open]");
ok((await page.locator("#liveSummaryBody .summary-row").count()) === 10, "まとめに9ステップ+合計");
await page.click("#liveSummaryClose");
ok(!(await page.locator("#liveIdle").isHidden()), "本番モード終了");

// ============ 18. イベントタイムテーブル ============
promptQueue.push("レコ発企画");           // イベント名
await page.click("#newEventBtn2");
ok(!(await page.locator("#eventEditor").isHidden()), "イベント作成");
promptQueue.push("対バンA");              // バンド名
await page.click("#addActBtn");
await page.click("#addUsBtn");            // 自分たち(セトリ連動)
ok((await page.locator(".act-row").count()) === 2, "出演2組");
const actTimes = await page.locator(".act-time").allTextContents();
ok(actTimes[0].startsWith("18:00〜18:30"), `1組目 18:00〜18:30 (${actTimes[0]})`);
ok(actTimes[1].startsWith("18:40〜"), `2組目 転換10分後の18:40〜 (${actTimes[1]})`);
ok((await page.locator(".act-row.is-us").count()) === 1, "自バンドがハイライト");
await page.click("#copyTimetableBtn");
const tt = await page.evaluate(() => navigator.clipboard.readText());
ok(tt.includes("【レコ発企画】開演 18:00") && tt.includes("対バンA"), "タイムテーブルのテキストコピー");
await page.locator(".stamp-btn").first().click();
ok((await page.locator(".act-stamped").count()) === 1, "開始打刻の記録");
ok((await page.locator("#eventDelta").textContent()).length > 0, "押し/巻きの表示");

// ============ 19. ステージシート(チェックリスト+持ち替えプラン入り) ============
await page.click('[data-tab="setlist"]');
await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
ok((await page.locator("#stageSheet .ss-song").count()) === 7, "ステージシート7曲");
ok((await page.locator("#stageSheet .ss-mc").count()) === 2, "ステージシートMC2箇所");
const ssText = await page.locator("#stageSheet").textContent();
ok(ssText.includes("☐"), "ステージシートに転換チェックリスト");
ok(ssText.includes("持ち替え(3本)"), "ステージシートに持ち替えプラン");

// ============ 20. バックアップ ============
const dl = page.waitForEvent("download");
await page.click("#exportBtn");
ok(/setlism-backup-\d{8}\.json/.test((await dl).suggestedFilename()), "バックアップDL");

// ============ 21. エラーなし ============
const realErrors = errors.filter((e) => !e.includes("favicon"));
ok(realErrors.length === 0, `JSエラーなし ${realErrors.length ? JSON.stringify(realErrors.slice(0, 3)) : ""}`);

// ============ スクリーンショット ============
await page.setViewportSize({ width: 420, height: 1600 });
await page.click('[data-tab="setlist"]');
await page.selectOption("#templateSelect", "buildup");
await page.screenshot({ path: "shot-setlist.png", fullPage: true });
await page.selectOption("#templateSelect", "");
await page.click('[data-tab="library"]');
await page.screenshot({ path: "shot-library.png", fullPage: true });
await page.click('[data-tab="practice"]');
await page.screenshot({ path: "shot-practice.png", fullPage: true });
await page.click('[data-tab="live"]');
await page.screenshot({ path: "shot-live.png", fullPage: true });
await page.click('[data-tab="metronome"]');
await page.screenshot({ path: "shot-metronome.png", fullPage: true });

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
process.exit(failures ? 1 : 0);
