# 11_ASSET_AUDIT

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_ASSETS: **3**

リポジトリ内のバイナリ視覚資産はPNG3件のみ。フォント・音声・動画・外部素材は存在しない。

## AS-01 — `pachinko/icon-192.png`

- TYPE: PNG(RGBA)
- DIMENSIONS: 192x192
- FILE_SIZE: 44,506 bytes
- USED_BY: manifest.webmanifest(icons), index.html:8 icon, index.html:9 apple-touch-icon, sw.js PRECACHE
- LICENSE / SOURCE: 本リポジトリ内で生成(セッション内生成物)。外部素材の混入は確認されない
- SAFE_TO_REUSE: **YES(差替も可)**
- DESIGN_ROLE: アプリアイコン(小)

## AS-02 — `pachinko/icon-512.png`

- TYPE: PNG(RGBA)
- DIMENSIONS: 512x512
- FILE_SIZE: 238,578 bytes
- USED_BY: manifest.webmanifest(icons: any/maskable), sw.js PRECACHE
- LICENSE / SOURCE: 同上
- SAFE_TO_REUSE: **YES(差替も可)**
- DESIGN_ROLE: アプリアイコン(大/マスカブル)

## AS-03 — `pachinko/desktop/build/icon.png`

- TYPE: PNG(RGBA)
- DIMENSIONS: 512x512
- FILE_SIZE: 238,578 bytes(AS-02とsha256一致)
- USED_BY: pachinko/desktop/package.json:36,44,49(win/mac/linux)
- LICENSE / SOURCE: 同上(AS-02の複製)
- SAFE_TO_REUSE: **YES(差替も可)**
- DESIGN_ROLE: デスクトップビルド用アイコン

## 新規アセットの可否

| 項目 | 判定 | 根拠 |
|---|---|---|
| NEW_LOCAL_RASTER_ASSET_ALLOWED | **YES** | 既にローカルPNGを同ディレクトリに置いて参照する構成が成立している(manifest/sw/desktopが相対パスで参照)。ただしsw.jsのPRECACHEに含めない新規ファイルはオフライン時に取得できない点に注意(pachinko/sw.js:3)。 |
| NEW_LOCAL_SVG_ALLOWED | **YES** | index.html:1201-1239 で実行時にインラインSVGを生成しており、インラインSVGは既に成立している。外部SVGファイル参照は実行時リクエストとなるためオフライン要件と衝突しうる(P-27)。 |
| NEW_AUDIO_ALLOWED | **UNKNOWN** | リポジトリに音声資産・Audio APIの使用は皆無(検出0)。禁止する明示的制約も見つからない。前例と方針の記述がないためUNKNOWN。 |

## 注意

- 新規のローカルアセットを追加する場合、オフライン初回取得のために `pachinko/sw.js:3` の PRECACHE への追加が必要
- アイコンの**パスと寸法**は PWA と3OSビルドが参照しており固定要件(P-31〜P-33)。**絵柄は変更可**
- `desktop/build/icon.png` は `icon-512.png` と同一内容(sha256一致)。差替時は両方を更新する必要がある
- ライセンス表記ファイルは存在しない(U-09)。外部素材の混入は検出されなかった

**TOTAL_ASSETS = 3**
