// セトリズム デスクトップ版:同梱した band/ の静的ファイルを
// 独自スキーム app:// で配信する薄い Electron ラッパー。
// file:// では ES モジュールが CORS で読めないため、カスタムプロトコルを使う。

const { app, BrowserWindow, Menu, protocol, session, shell, net } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_ROOT = path.join(__dirname, "app");
const APP_URL = "app://setlism/";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

// 二重起動はウィンドウを前面に出すだけにする
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 800,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#0d1017",
    title: "セトリズム",
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // 外部リンク(共有URLなど)はOSのブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(APP_URL)) {
      e.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    }
  });

  win.loadURL(APP_URL);
  return win;
}

app.whenReady().then(() => {
  // 同梱ファイルの配信(APP_ROOT の外へは出さない)
  protocol.handle("app", (req) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url).pathname);
    } catch {
      return new Response("bad request", { status: 400 });
    }
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const file = path.normalize(path.join(APP_ROOT, pathname));
    if (!file.startsWith(APP_ROOT + path.sep) && file !== path.join(APP_ROOT, "index.html")) {
      return new Response("forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });

  // チューナー・録音のためのマイク許可(それ以外は拒否)
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });

  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "ファイル",
      submenu: [
        {
          label: "ステージシートを印刷…",
          accelerator: "CmdOrCtrl+P",
          click: (_item, win) => {
            win?.webContents.executeJavaScript(
              "window.dispatchEvent(new Event('beforeprint')); window.print();",
              true
            ).catch(() => {});
          },
        },
        { type: "separator" },
        isMac ? { role: "close", label: "ウィンドウを閉じる" } : { role: "quit", label: "終了" },
      ],
    },
    {
      label: "編集",
      submenu: [
        { role: "undo", label: "元に戻す" },
        { role: "redo", label: "やり直す" },
        { type: "separator" },
        { role: "cut", label: "切り取り" },
        { role: "copy", label: "コピー" },
        { role: "paste", label: "貼り付け" },
        { role: "selectAll", label: "すべて選択" },
      ],
    },
    {
      label: "表示",
      submenu: [
        { role: "zoomIn", label: "拡大" },
        { role: "zoomOut", label: "縮小" },
        { role: "resetZoom", label: "等倍に戻す" },
        { type: "separator" },
        { role: "togglefullscreen", label: "フルスクリーン" },
        { type: "separator" },
        { role: "reload", label: "再読み込み" },
        { role: "toggleDevTools", label: "開発者ツール" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
