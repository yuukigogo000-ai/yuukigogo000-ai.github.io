# 01_REPOSITORY_MAP

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査
     対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     Design Authority: ChatGPT / Implementation Authority: Claude Code
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

## 調査対象

- リポジトリ: yuukigogo000-ai/yuukigogo000-ai.github.io
- コミット: `f71190b50a118dad4fa2adb5531541ae36875eb3`
- 対象製品: **パチスロ帝国** (`pachinko/` 配下)
- 追跡ファイル総数: 30件 / うち製品実装に関わるもの: 11件

## 技術構成(実測)

| 項目 | 実測値 | 根拠 |
|---|---|---|
| 言語 | HTML / CSS / JavaScript (ES2020相当。`?.` と `??` を使用) | pachinko/index.html:772, 690 |
| フレームワーク | なし(素のDOM操作) | import/require/フレームワーク参照の出現数0 |
| ビルドシステム | なし(製品側) / electron-builder(デスクトップ配布のみ) | pachinko/desktop/package.json:12 |
| パッケージマネージャ | npm(デスクトップ配布のみ) | pachinko/desktop/package-lock.json |
| 実行時依存 | ゼロ | 外部URL・fetch・XHR・importの出現数0 |
| エントリポイント | pachinko/index.html (単一) | ルーティング実装なし |
| ルーティング | なし。4パネルのclass切替のみ | pachinko/index.html:1779-1786 |
| 状態管理 | 単一のグローバル変数 `state` | pachinko/index.html:627, 629-658 |
| 保存 | localStorage 単一キー `pachi-teikoku-save-v1` | pachinko/index.html:386, 1652-1743 |
| 描画 | HTML + CSS + 実行時生成のインラインSVG | canvas/webgl の出現数0、`<svg` は1箇所(:1220) |
| フォント | OS標準スタックのみ(Webフォント読込なし) | pachinko/index.html:33-35 |
| アイコン | 絵文字(文字として)+ PNG 3件 | アイコンライブラリの参照なし |
| 音声 | なし | Audio/audio の出現数0 |
| アニメーション | CSS @keyframes 5件 + JSタイマー | pachinko/index.html:182,193,208,214,231 |
| ネットワーク | 実行時リクエスト0 | fetch/XMLHttpRequest/WebSocket/外部URL いずれも0 |
| API / 認証 / DB | なし | 該当実装の検出0 |
| Service Worker | あり(https配信時のみ登録) | pachinko/index.html:1845-1847, pachinko/sw.js |
| マニフェスト | あり(standalone) | pachinko/manifest.webmanifest |
| テスト | **NOT_FOUND**(テストファイル0件) | git追跡ファイルにテストコードなし |
| テストセレクタ | 専用属性なし。id属性(静的40 / 全70)とclassに依存 | pachinko/index.html 全体 |
| デプロイ前提 | GitHub Pages と読めるがワークフロー定義なし(UNKNOWN: U-08) | .github/workflows は desktop-build.yml のみ |

## ファイル別の役割

### `pachinko/index.html`
- SIZE: 94,305 bytes / 1,862行
- ROLE: 製品「パチスロ帝国」の全実装(HTML+CSS+JSを含む単一ファイル)
- WHY_IT_MATTERS: 本パケットの一次証拠。UI・ゲームロジック・保存・描画のすべてがこの1ファイルに存在する

### `pachinko/manifest.webmanifest`
- SIZE: 750 bytes / 17行
- ROLE: PWAマニフェスト
- WHY_IT_MATTERS: インストール時の名称・表示モード(standalone)・アイコン参照・テーマ色の正本

### `pachinko/sw.js`
- SIZE: 997 bytes / 32行
- ROLE: Service Worker(ネットワーク優先+キャッシュフォールバック)
- WHY_IT_MATTERS: オフライン動作の根拠。PRECACHEの5件が固定されている

### `pachinko/icon-192.png`
- SIZE: 44,506 bytes / 192x192
- ROLE: PWAアイコン(小)
- WHY_IT_MATTERS: manifest・link・PRECACHEから参照される実アセット

### `pachinko/icon-512.png`
- SIZE: 238,578 bytes / 512x512
- ROLE: PWAアイコン(大・maskable)
- WHY_IT_MATTERS: 同上

### `pachinko/desktop/main.js`
- SIZE: 1,289 bytes / 46行
- ROLE: Electronメインプロセス
- WHY_IT_MATTERS: デスクトップ版の起動条件・ウィンドウ寸法・セキュリティ設定・ゲームファイルの探索経路

### `pachinko/desktop/package.json`
- SIZE: 1,370 bytes / 53行
- ROLE: Electron/electron-builder設定
- WHY_IT_MATTERS: 3OSのビルドターゲット、アイコンパス、extraResourcesによるゲーム同梱方法

### `pachinko/desktop/package-lock.json`
- SIZE: 188,751 bytes / 5,288行
- ROLE: 依存の固定
- WHY_IT_MATTERS: 開発依存はelectronとelectron-builderのみ。製品実行時の依存は存在しない

### `pachinko/desktop/build/icon.png`
- SIZE: 238,578 bytes / 512x512
- ROLE: ビルド用アイコン
- WHY_IT_MATTERS: icon-512.pngとsha256一致(複製)

### `pachinko/desktop/README.md`
- SIZE: 1,218 bytes / 33行
- ROLE: デスクトップ版の開発・ビルド手順
- WHY_IT_MATTERS: 文書(証拠優先度5)。機能の根拠には使用しない

### `pachinko/desktop/.gitignore`
- SIZE: 20 bytes
- ROLE: node_modules/ と dist/ の除外
- WHY_IT_MATTERS: ビルド生成物が追跡対象外であることの根拠

### `.github/workflows/desktop-build.yml`
- SIZE: 884 bytes / 39行
- ROLE: CI: 3OSのデスクトップインストーラをビルド
- WHY_IT_MATTERS: リポジトリに存在する唯一のCI。テスト実行のワークフローは存在しない

### `pachinko/DESIGN.md`
- SIZE: 11,613 bytes / 141行
- ROLE: 設計・バランス検証の記録(文書)
- WHY_IT_MATTERS: 証拠優先度5。記載された自動検証の実体はリポジトリに存在しない(C-03)

### `pachinko/redesign/** (12ファイル)`
- SIZE: 計約170KB
- ROLE: 先行して作成されたデザイン依頼パッケージ(文書)
- WHY_IT_MATTERS: 証拠優先度5。本パケットはコードから独立に抽出しており、齟齬はCONFLICTSに記録(C-01, C-02, C-04)

### `index.html (リポジトリ直下)`
- SIZE: 11,271 bytes / 242行
- ROLE: 別製品「JAN→楽天価格 取得ツール」
- WHY_IT_MATTERS: 本パケットの対象外。外部API(openapi.rakuten.co.jp)へリクエストする別アプリであり、「パチスロ帝国」の事実と混同してはならない(C-05)

## 重要な不在(調査で確認)

- テストスイート / テスト用CI: **NOT_FOUND**
- サーバーコード / API定義 / スキーマ定義ファイル: **NOT_FOUND**
- 設計正本としてのデザイン仕様(DESIGN_DECISION等): **NOT_FOUND**(U-10)
- 音声資産: **NOT_FOUND**
- Canvas / WebGL の使用: **NOT_FOUND**
