# E2Eテスト(破壊的検証)

ビルド済みの `reply-ai/` を実ブラウザ(Chromium)+モックAPIで検証する自動テスト **87項目**。

正常系に加えて、APIキー未入力 / 401 / refusal / 応答の途中切断 / 壊れた画像 / 7枚超過アップロード / XSS注入 / ネットワーク断などの異常系を実際に叩く。さらにUIの品質(絵文字を使っていない・生成中の状態表示・ダークモード・Escで閉じる・PWAの配信物)も機械的に検査する。

## 実行方法

```bash
cd reply-ai-app
npm install
npm run build                 # ../reply-ai を更新(テスト対象はビルド結果)
# 別のシェルで、リポジトリのルートから:
python3 -m http.server 8778
npm test
```

`87/87 passed` になればOK。UI・プロンプト・スキーマを変えたら必ず再実行すること。

- 対象URLは `BASE_URL` で変更できる(既定 `http://localhost:8778/reply-ai/`)
- Chromiumのパスは `PW_CHROMIUM` で指定できる
- Service Workerはテスト中のリクエスト横取りを避けるため無効化している(SW自体の配信は18cで検証)

## 画面の確認(スクリーンショット)

```bash
SHOT_DIR=./shots node shots.mjs   # ライト/ダーク × 入力・結果・設定
```
