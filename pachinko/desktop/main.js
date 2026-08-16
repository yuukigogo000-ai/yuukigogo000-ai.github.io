// パチスロ帝国 デスクトップ版 (Electron)
// ゲーム本体は ../index.html を共有し、パッケージ時は extraResources 経由で同梱する。
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

function gameFile() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "game", "index.html")
    : path.join(__dirname, "..", "index.html");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 920,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: "#0d0a1a",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadFile(gameFile());

  // 外部リンクはOSブラウザで開く(ゲーム内に外部リンクはないが保険)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
