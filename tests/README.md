# セトリズム テストスイート

実ブラウザ(Chromium)でアプリを起動して検証するテスト群です。機能追加・修正のあとは必ずここを回してからマージしてください。

| ファイル | 内容 | 項目数の目安 |
|---|---|---|
| `smoke.mjs` | 通常操作のスモークテスト(時間計算・共有リンク往復・QR実デコード・v1移行・通し練習の自動進行・録音・本番モードのリロード復帰など) | 87 |
| `torture.mjs` | 破壊的検証(壊れた保存データでの起動・共有リンクファズ・XSS注入・80曲の極端データ・Undo枯渇・本番中の削除・保存失敗など) | 42 |
| `electron-smoke.mjs` | デスクトップ版の実起動テスト(`app://`配信・永続化・再起動) | 14 |

## 実行方法

```bash
cd tests
npm install

# Web版(スモーク+破壊的検証)
npm test

# デスクトップ版(先に ../desktop で npm install が必要)
npm run test:electron            # Linuxでは xvfb-run -a npm run test:electron
```

### Chromium の場所

既定では `/opt/pw-browsers/chromium`(Claude Code のリモート環境)を使います。手元のPCで動かすときは環境変数 `CHROMIUM_PATH` にChrome/Chromiumの実行ファイルを指定してください。

```bash
# 例: macOS
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
# 例: Windows (PowerShell)
$env:CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm test
```

## 判定

各項目が `PASS` / `FAIL` で出力され、最後に `ALL PASS` か `N FAILURES` が出ます(FAILがあると終了コード1)。スクリーンショット(`shot-*.png`)は目視確認用に生成されます。
