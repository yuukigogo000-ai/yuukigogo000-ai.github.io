# E2Eテスト(破壊的検証)

`index.html` をモックAPIで検証する自動テスト36項目。正常系に加え、APIキー未入力・401・refusal・応答途中切断・壊れた画像・7枚超過アップロード・XSS注入・ネットワーク断などの異常系を実ブラウザで叩く。

## 実行方法
```bash
npm i playwright                # 要Chromium。パス指定は環境変数 PW_CHROMIUM
python3 -m http.server 8778 &   # リポジトリのルートで実行
node reply-ai/tests/e2e.test.js
```
`36/36 passed` になればOK。UIやプロンプト構造を変えたら必ず再実行すること。
