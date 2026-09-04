# CAPABILITY_AUDIT.md
# 実行日: 2026-09-04 / 対象環境: Claude Code Remote(クラウドコンテナ)

着手前に、この環境で実際に何ができるかを**コマンドを実行して**確認した。推測は含まない。

## 1. 実装に必要な能力

| 能力 | 可否 | 証拠 |
|---|---|---|
| ローカルラスタ資産(JPEG/PNG)の利用 | **可** | `pachinko/art/*.jpg` を `<img>` で読み込み、file:// / http:// / Electron の3経路で表示を確認 |
| スクリーンショット取得 | **可** | Playwright + Chromium(`/opt/pw-browsers/chromium`)で 390×844 等を取得 |
| ビューポート再現(360/390/430/デスクトップ) | **可** | 同上。`isMobile` / `deviceScaleFactor` / `reducedMotion` の指定が可能 |
| 回帰検査スクリプトの作成と実行 | **可** | Node 22。既存 `review/verify_protected_logic.js` で実績あり |
| オフライン起動の検証 | **可** | ローカルHTTPサーバ + `context.setOffline(true)` で確認済み |
| Electron / file:// 起動の検証 | **可** | `pachinko/desktop` の Electron を xvfb 上で起動し確認済み |
| 画像の切り出し・再エンコード | **可** | Chromium の Canvas 経由(外部ツール不要) |

## 2. 制作能力(重要)

| 能力 | 可否 | 証拠 |
|---|---|---|
| 画像生成AIによる新規アート生成 | **不可** | 環境内に画像生成モデル・APIキーともに無し |
| 外部の画像生成API利用 | **不可** | `api.openai.com` / `api.stability.ai` へ接続不可(HTTP 000) |
| 画像モデルの取得と自前実行 | **不可** | `huggingface.co` 接続不可(HTTP 000)。かつGPU非搭載(`nvidia-smi` なし / CPU4コア) |
| 3Dソフト・画像編集ソフト | **不可** | 環境に存在しない |
| 音声素材の生成 | **不可** | 同上 |
| プログラムによる図形描画 | 可 | Canvas 2D。ただし写実的な質感には到達しない(V5で検証済み) |

## 3. 結論

**Artwork生成不可はブロッカーではない。** 本パッケージ(HANDOFF v6)に
88点のラスタ資産 + 12点の390×844クロップ + 4枚のアトラス原本が同梱されているため、
`ASSET_COVERAGE_MATRIX.csv` の PRIMARY → SECONDARY → OVERFLOW の順で選択して使用する。

不足が生じた場合の方針:
1. PRIMARY を使う
2. 不適(文字の焼き込み等)なら SECONDARY
3. それも不適なら OVERFLOW
4. いずれも不適な場合のみ、アトラス原本から該当セルを**キャプション帯を除いて**切り出す

## 4. 注意点(実測して判明)

- 同梱の `ARTWORK/*.jpg` は**アトラスからの機械的な切り出し**であり、
  多くにキャプション文字(「01 全景(メイン・軍配)」等)や隣接セルの一部が写り込んでいる。
  `ASSET_MANIFEST.json` の `text_baked_in: "inspect before PRIMARY use"` の通り、**使用前に目視確認が必要**。
- そのため本実装では、**アトラス原本(`REFERENCE/GENERATED_ATLAS_0*.png`)から
  キャプション帯を除いた領域を自前で切り出して**製品資産とする。
  これは「供給されたArtworkを使う」方針の範囲内であり、CSS/SVGでの再制作ではない。
- `04 UI FRAMES` の一部および `08 SPECIAL/SCREEN` は、
  実在しないデータ(資金128,450,000円 / ランキング12位 / お知らせ3件)が焼き込まれているため
  **製品には使用しない**(構造の参考のみ)。数値・文字はすべてLive DOMで描画する。
