# 10_TECHNICAL_CONSTRAINTS

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

すべてリポジトリからの実測。明示的な制約が存在しない項目は **UNKNOWN** と記載した。

## PLATFORM

| 実行環境 | 根拠 |
|---|---|
| Webブラウザ(http/https) | `pachinko/index.html` を直接配信 |
| PWA(standalone表示) | `manifest.webmanifest:8` display=standalone |
| Electronデスクトップ(Chromium) | `desktop/main.js:27` win.loadFile |
| file: プロトコル直接オープン | SW登録が `location.protocol.startsWith('http')` で分岐(:1845) |

同一の1ファイルが上記すべてで動作する必要がある(P-26)。

## TARGET VIEWPORTS

**UNKNOWN**(U-01)。リポジトリに目標幅の宣言は存在しない。実測できるのは以下のみ:

- `<meta name="viewport" content="width=device-width, initial-scale=1">`(:5)
- メディアクエリは **1件のみ**: `@media (max-width: 560px)`(:239)。  しかもその対象クラス `.grid2` は**どこからも使用されていないデッドCSS**(B検証で検出)
- 本文の最大幅: `.wrap { max-width: 980px }`(:32)、モーダル: `max-width: 460px`(:152)
- Electronの既定ウィンドウ: 1080x920、最小 420x600(`desktop/main.js:14-17`)

つまりレイアウトは幅指定の分岐を持たない流動レイアウトである。
対象幅の決定は Design Authority 側の宣言が必要(RK-09)。

## SAFE AREA

**NOT_HANDLED**。`env(safe-area-inset-*)` の出現数0。
下部固定の操作バーが存在するため(`.daybar` :109-118)、端末のホーム領域との衝突は未考慮。

## INPUT METHOD

- ポインタ操作(click)と `<select>` の change、チェックボックスの change
- キーボード専用の操作系は未実装(keydownハンドラの出現数0)。ネイティブ要素の既定挙動に依存
- ホバー依存の情報が1件存在する: 損益推移の詳細参照は `mousemove` のみ(:1240-1250)。  タッチ環境での代替経路は実装されていない

## MINIMUM TOUCH TARGET

**UNKNOWN**(U-02)。min-height/min-width によるタップ領域の宣言は存在しない。
実寸はpadding依存: 汎用ボタン `padding: 7px 10px`(:100)、主要アクション `padding: 12px 34px`(:116)。

## RENDERING

| 技術 | 使用 | 根拠 |
|---|---|---|
| HTML + CSS | **主** | 全体 |
| インラインSVG(実行時生成) | あり(損益推移のみ) | :1201-1239 |
| Canvas | **なし** | canvas/getContext 出現数0 |
| WebGL | **なし** | webgl 出現数0 |
| CSS @keyframes | 5件(うち無限反復2件) | :182,193,208,214,231 |
| 絵文字 | UI要素として多用(文字として描画) | 全体 |

## ASSET RULES

- **NEW_LOCAL_RASTER_ASSET_ALLOWED: YES** — 既にローカルPNGを同ディレクトリに置いて参照する構成が成立している(manifest/sw/desktopが相対パスで参照)。ただしsw.jsのPRECACHEに含めない新規ファイルはオフライン時に取得できない点に注意(pachinko/sw.js:3)。
- **NEW_LOCAL_SVG_ALLOWED: YES** — index.html:1201-1239 で実行時にインラインSVGを生成しており、インラインSVGは既に成立している。外部SVGファイル参照は実行時リクエストとなるためオフライン要件と衝突しうる(P-27)。
- **NEW_AUDIO_ALLOWED: UNKNOWN** — リポジトリに音声資産・Audio APIの使用は皆無(検出0)。禁止する明示的制約も見つからない。前例と方針の記述がないためUNKNOWN。

| 種別 | 可否 | 根拠 |
|---|---|---|
| ローカルラスタ(PNG等) | 可 | 既に3件が相対パスで参照されている |
| インラインSVG | 可 | :1201-1239 に前例 |
| 外部SVG/画像ファイル参照 | 実行時リクエストとなるため **オフライン要件と衝突**(P-27) | sw.js のPRECACHEは5件固定 |
| 外部CDN | **不可** | 実行時リクエスト0が現状(P-27) |
| Webフォント | **不可** | 同上。現状はOS標準スタックのみ(:33-35) |
| アイコンライブラリ | 使用なし | 参照の検出0 |
| 音声 | UNKNOWN(U-06) | 前例なし・禁止記述なし |

## PERFORMANCE

**明示的な数値目標は UNKNOWN**(U-04)。実測できる構造上の事実:

- 単一ファイル94KB、実行時の外部取得0のため初回表示は軽量
- 再描画は全再生成方式: `renderHall()` は台数分のDOMを毎回作り直す(:1008-1057)。台は最大60件
- `renderAll()` は4領域すべてを再描画する(:1271-1274)。状態変更のたびに呼ばれる
- 常時再生のアニメーションは2件(bannerflash / lampblink)。いずれも試打中のみ
- 試打の演出は setInterval(70ms / 80ms)とsetTimeoutの連鎖。終了時に全停止する後処理あり(:1493, 1646-1650)

## NETWORK

**実行時リクエスト = 0**(実測: fetch / XMLHttpRequest / WebSocket / 外部URL いずれも出現数0)。
API・認証・データベース・解析のいずれも存在しない(P-27, NON_FEATURES)。

参考: リポジトリ直下の別アプリ `index.html` は外部API(`openapi.rakuten.co.jp`)を呼ぶが、
本製品とは無関係である(C-05)。

## STORAGE

- localStorage 単一キー `pachi-teikoku-save-v1`(:386)
- 保存契機: 各操作後および営業日終了時(`save()` :1652-1656)
- 読込時に `sanitizeState()` が全フィールドを型検証・範囲クランプし、未知IDを除去(:1658-1732)
- 例外は握りつぶす実装のため、localStorage不可の環境でも致命的に落ちない(:1653)
- CacheStorage: Service Worker が `pachi-teikoku-v1` を使用(sw.js:2)

## OFFLINE

- https配信時のみSWを登録(:1845-1847)。file:とElectronでは登録しない
- 方針: ネットワーク優先 → 失敗時にキャッシュ → 最終フォールバックは `./index.html`(sw.js:19-30)
- PRECACHE対象は5件固定: `./`, `./index.html`, `./manifest.webmanifest`, `./icon-192.png`, `./icon-512.png`(sw.js:3)
- **新規アセットを追加してもPRECACHEに含めなければオフライン初回で取得できない**(RK-05)

## BUILD

- 製品側: **ビルド工程なし**。`pachinko/index.html` がそのまま成果物
- デスクトップ側: `npm run dist` → electron-builder(win nsis / mac dmg / linux AppImage)
- ゲーム本体は `extraResources` で `resources/game/index.html` として同梱(`desktop/package.json:31-33`)
- Electronは `app.isPackaged` で読込先を切り替える(`desktop/main.js:6-10`)

## DEPLOYMENT

**UNKNOWN**(U-08)。GitHub Pages 前提と読めるが、デプロイのワークフロー定義は存在しない。
存在するCIは `.github/workflows/desktop-build.yml`(タグ `desktop-v*` または手動実行)のみ。

## RESPONSIVE

- 流動レイアウト: flex / grid + `repeat(auto-fit, minmax(...))`(:41, 247)
- 幅に応じた分岐は実質存在しない(前述のデッドCSS1件のみ)
- 横スクロールの局所化: `.tablewrap { overflow-x: auto }`(:126)、モーダルは `max-height: 86vh` で縦スクロール(:152)
- 下部固定バーのための余白は `body` の `padding-bottom: 90px`(:32)

## ACCESSIBILITY

**部分的**。実測:

| 項目 | 実測 |
|---|---|
| prefers-reduced-motion | **未実装**(出現数0 / C-01) |
| ARIA | `role="img"` + `aria-label` が損益推移のSVGに1件のみ(:1220) |
| フォーカス可視化 | `select:focus, button:focus { outline: 2px solid ... }`(:97) |
| 色以外の手がかり | 一部で併用(実績のlockedは彩度低下、純利益は符号+色)。網羅的ではない |
| 見出し構造 | h1 / h3 は存在するが h2 は未使用 |
| コントラスト基準 | UNKNOWN(U-07。基準の記述なし) |
| キーボード操作 | ネイティブ要素の既定挙動に依存。独自ハンドラなし |
| lang属性 | `<html lang="ja">`(:2) |

## BROWSER / DEVICE SUPPORT

**UNKNOWN**(U-03)。browserslist等の宣言は存在しない。コードから読める前提:

- ES2020相当の構文(オプショナルチェーン `?.` / null合体 `??`)を使用(:690, 772)
- `Intl` 相当の `toLocaleString('ja-JP')` に依存(:623)
- `String.prototype.includes` / `Array.prototype.flatMap` 等のモダンAPIを使用
- Electron同梱Chromiumは ^33 系(`desktop/package.json:17`)

## FILE SIZE / ASSET WEIGHT

明示的な上限の記述は **UNKNOWN**(U-05)。実測値:

| 対象 | サイズ |
|---|---|
| pachinko/index.html | 94,305 bytes |
| icon-192.png | 44,506 bytes |
| icon-512.png | 238,578 bytes |
| desktop/build/icon.png | 238,578 bytes(icon-512の複製) |
| 配信時の実質総量(index+manifest+sw+icon2件) | 約 379 KB |
