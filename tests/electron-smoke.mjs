// デスクトップ版(Electron)スモークテスト:Playwright _electron ドライバで実起動
import { _electron } from "playwright-core";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP = join(dirname(fileURLToPath(import.meta.url)), "..", "desktop");

const require = createRequire(join(DESKTOP, "package.json"));
const electronPath = require("electron");

let failures = 0;
const ok = (cond, name) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
};

const app = await _electron.launch({
  executablePath: electronPath,
  args: ["main.js", "--no-sandbox"],
  cwd: DESKTOP,
});

const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.waitForLoadState("domcontentloaded");
await page.waitForSelector("#songList .song");

// 1. app:// スキームで ES モジュールが読めてアプリが動く
ok((await page.title()).includes("セトリズム"), "タイトル表示");
ok(await page.evaluate(() => location.href.startsWith("app://setlism/")), "app://スキームで動作");
ok((await page.locator("#songList .song").count()) === 6, "サンプル6曲描画(ESモジュール動作)");
ok((await page.locator("#energyChart svg circle[data-dot]").count()) === 6, "エナジーチャート描画");

// 2. localStorage 永続化(userData に保存される)— 実行間の残留状態に依存しない相対比較
const totalBefore = await page.locator("#totalTime").textContent();
await page.locator("#songList .song .chip-mc").first().click();
const totalAfter = await page.locator("#totalTime").textContent();
ok(totalAfter !== totalBefore, `編集が反映 (${totalBefore} → ${totalAfter})`);

// 3. 共有リンクがデスクトップでも Web の公開URLになる
const shareUrl = await page.evaluate(async () => {
  const { encodeShare } = await import("./share.js");
  const { activeSetlist, entriesOf } = await import("./store.js");
  const sl = activeSetlist();
  const payload = await encodeShare(sl, entriesOf(sl));
  // app.js と同じロジック
  const base = location.protocol.startsWith("http")
    ? location.origin + location.pathname
    : "https://yuukigogo000-ai.github.io/band/";
  return base + "#s=" + payload;
});
ok(shareUrl.startsWith("https://yuukigogo000-ai.github.io/band/#s=1."), "共有リンクは公開URLベース");

// 4. QRダイアログ(ベンダリングしたqrcode.mjsがapp://で読める)
await page.click("#shareBtn");
await page.click("#shareQrBtn");
await page.waitForSelector("#qrDialog[open]", { timeout: 5000 });
ok((await page.locator("#qrBox svg").count()) === 1, "QR生成(vendor moduleロード)");
await page.click("#qrClose");

// 5. タブ切り替え+メトロノーム(AudioContext)
await page.click('[data-tab="metronome"]');
await page.click("#metroToggle");
await page.waitForTimeout(600);
ok((await page.locator("#metroToggle").textContent()) === "ストップ", "メトロノーム動作");
const hit = await page.evaluate(() =>
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
ok(hit, "ビート点灯(Web Audio動作)");
await page.click("#metroToggle");

// 6. IndexedDB(録音の保存先)が使える
const idbOk = await page.evaluate(async () => {
  const { addRecording, listRecordings, deleteRecording } = await import("./rec-db.js");
  await addRecording({ id: "t1", name: "テスト", songId: null, date: 1, mime: "audio/webm", sec: 1, blob: new Blob(["x"]) });
  const list = await listRecordings();
  await deleteRecording("t1");
  return list.length === 1 && list[0].name === "テスト";
});
ok(idbOk, "IndexedDB動作(録音保存)");

// 7. 再起動して永続化を確認
await page.screenshot({ path: "shot-desktop.png" });
await app.close();

const app2 = await _electron.launch({
  executablePath: electronPath,
  args: ["main.js", "--no-sandbox"],
  cwd: DESKTOP,
});
const page2 = await app2.firstWindow();
await page2.waitForSelector("#songList .song");
ok((await page2.locator("#totalTime").textContent()) === totalAfter, "再起動後もデータ永続化");
ok(await page2.locator("#undoBtn").isDisabled(), "Undo履歴は再起動でリセット(仕様どおり)");
// 後片付け(MCを再トグルで元に戻す)
await page2.locator("#songList .song .chip-mc").first().click();
ok((await page2.locator("#totalTime").textContent()) === totalBefore, "後片付け完了");
await app2.close();

const realErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("Autofill"));
ok(realErrors.length === 0, `JSエラーなし ${realErrors.length ? JSON.stringify(realErrors.slice(0, 2)) : ""}`);

console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
process.exit(failures ? 1 : 0);
