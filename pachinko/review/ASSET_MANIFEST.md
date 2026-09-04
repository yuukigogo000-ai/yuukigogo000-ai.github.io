# ASSET MANIFEST

| ファイル | 種別 | 寸法 | サイズ | 分類 | 由来 |
|---|---|---|---|---|---|
| `pachinko/art/hall.jpg` | JPEG | 1170×1290 | 336 KB | **C(要・新規アート)** の暫定 | セッション内で Canvas 2D により手続き生成。外部素材の混入なし |
| `pachinko/icon-192.png` | PNG | 192×192 | 49 KB | A(既存) | セッション内生成 |
| `pachinko/icon-512.png` | PNG | 512×512 | 266 KB | A(既存) | セッション内生成 |
| `pachinko/desktop/build/icon.png` | PNG | 512×512 | — | A(既存) | icon-512 の複製 |
| インラインSVGアイコン 34種 | SVG(HTML内) | 24×24 viewBox | — | B(コード描画) | 本実装で作成 |
| 店舗評価クレスト | SVG(HTML内) | 120×120 viewBox | — | B(コード描画) | 本実装で作成 |
| 台カードのサムネイル | CSS | 34×44 | — | B(コード描画) | 機種カラーで生成 |
| フィルムグレイン | SVG data URI | 120×120 | 約0.4KB | B(コード描画) | feTurbulence |

- 外部フォント・外部CDN・外部画像は使用していない(実行時リクエスト0を自動検証)。
- 新規ラスタ資産は `sw.js` の PRECACHE に登録済み(`pachi-teikoku-v3`)。
- **分類C(新規アートが必要)**: `hall-overview`。発注書は `../CHATGPT_ARTWORK_REQUEST.md`。
