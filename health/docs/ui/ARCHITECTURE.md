# ARCHITECTURE — カラダ日報 (/health/)

> AI UI改善マスタープロトコル v2 Phase 0。**UIを作り直す人が、壊さずに書き換えるための地図。**
> 作成 2026-08-21 / すべて `health/index.html`(1,273行)の実測。

---

## 1. 構成

```
health/
├─ index.html            ← アプリ本体。これ1つで動く(HTML+CSS+JS インライン・1,273行)
├─ README.md             ← 機能紹介(公開用)
├─ CLAUDE.md             ← このディレクトリの規則(変更禁止事項・検査コマンド)
├─ PLAN_UI_PORT.md       ← 役目を終えた旧指示書(Figma移植案・冒頭に SUPERSEDED を明記)
├─ design/README.md      ← 参照画像の置き場(現在は空)
├─ tests/smoke.mjs       ← Playwright スモークテスト 38項目(--mutate 自己検査つき)
├─ ui/
│  ├─ baselines/karada.json      ← uicheck の基準線(2026-08-18・旧UI時点)
│  └─ wo/WO_UI_karada_home.md    ← UI_PLAYBOOK v3 時代の作業指示書(経緯として保持)
└─ docs/ui/              ← プロトコル v2 の正本置き場(本ファイル群)
```

- **ビルド工程なし**。`health/index.html` をそのまま配信する静的サイト
- npm パッケージなし(テストは共通ツールの playwright を借用)
- ルーティングなし。URL は `/health/` の1つだけ。ハッシュも使わない
- クエリ `?state=empty|demo|saved` は**状態プレビュー専用**(本番では未指定)

---

## 2. index.html の中身の並び(行番号は 2026-08-21 時点)

| 範囲 | 内容 |
|---|---|
| 1–7 | `<head>`・meta(`viewport-fit=cover`・`color-scheme`)・`<title>` |
| 8–72 | **`:root` トークン定義**(ライト)+ `prefers-color-scheme: dark` の再定義。**生の16進はここだけ** |
| 73–330 | CSS(外殻 → 見出し → カード → 帯 → ピル → メーター → 晩酌 → ボタン → 入力 → グラフ → 表 → 折りたたみ → 下タブ → ドロワー) |
| 331–470 | HTML: `<header class="appbar">` / `<div class="wrap">` に5つの `<section>` / `<nav class="tabbar">` / スクリム / ドロワー / お知らせパネル |
| 471–1273 | `<script>`(下記3) |

### section の id(下タブが指す先)
`sec-home` / `sec-drink` / `sec-record` / `sec-trend` / `sec-checkup`

---

## 3. JS の構造(関数の役割マップ)

宣言順。**A=触ってよい(描画)/ B=触ってはいけない(ロジック)/ C=土台**

| 種別 | 関数 | 役割 |
|---|---|---|
| C | `load` `persist` | localStorage 読み書き。`persist()` は `?state=` のとき**書かない** |
| C | `isoOf` `todayISO` `daysAgoISO` `fmtDate` `esc` `num` `clamp` | 日付・文字列・数値の下ごしらえ。`esc` は全出力の XSS 対策 |
| **B** | `alcGrams` `drinkCount` | 純アルコールg換算。**旧データ互換**(`alc` 無し `drinks:n` → n×20g)を含む |
| **B** | `bpClass` `bmiClass` `metaboClass` `chkVerdict` | 医学的判定。基準値を含む |
| **B** | `streakDays` `rankOf` `nextRank` | 記録継続と役職 |
| C | `latest` `valueOnOrBefore` `upsert` `getOrCreateToday` | レコード検索・追加(日付昇順を維持) |
| A | `icon` `band` `pill` `card` `drinkButton` | 見た目の部品(HTML文字列を返す) |
| A | `renderGreeting` `renderStrip` `renderStatus` `renderDrinks` `renderRecordForm` `renderCharts` `renderCheckup` `renderCheckupForm` `renderList` `renderBell` | 各領域の描画 |
| A | `renderAll` | 上記を全部呼ぶ。**状態が変わったら必ずこれを呼ぶ** |
| B寄り | `coachMessages` | 実データから助言文を選ぶ(条件は医学的判定に依存) |
| A | `niceTicks` `movingAvg` `drawChart` | インラインSVGのグラフ描画。`movingAvg` は7日移動平均(表示用に小数1桁へ丸め) |
| A | `openDrawer` `closeOverlays` `setActiveTab` | 外殻の開閉と現在地 |
| C | `csvEscape` `downloadCsv` `parseCsv` | CSV 入出力 |
| C | `demoData` `applyState` | 状態プレビュー用のデータ生成(**乱数不使用**・`Math.sin` による決定的な波形) |

### 起動シーケンス(ファイル末尾)
```
localStorage 読み込み → (?state があれば applyState で差し替え)
→ renderCheckupForm()（健診入力欄を生成）
→ 設定値をドロワーの入力欄へ反映
→ renderAll()
→ (?state=saved なら保存メッセージを表示)
```

### イベント結線(14箇所)
`btnDry` `btnUndo` `btnMore` `btnSave` `btnSaveChk` `btnSaveSet` `btnMenu` `btnCloseDrawer` `scrim` `btnBell` `btnCsvDay` `btnCsvChk` `btnImport` `fileImport`
加えて **動的生成**の結線: `[data-drink]`(晩酌ボタン・`renderDrinks` の中で毎回張り直す)、`[data-del]`(記録一覧の削除)、`.tab[data-go]`(下タブ)、`window.scroll`(現在地の追従)、`keydown Escape`(オーバーレイを閉じる)。

> **UIを作り直すときの要点**: 描画のたびに `innerHTML` を差し替え、その直後に `querySelectorAll` で結線し直す方式。DOMを作り替えても、**同じ `id` と `data-*` を用意すれば結線もテストもそのまま通る。**

---

## 4. データフロー

```
[入力/タップ]
   ↓
records / settings / checkups （メモリ上の素の配列・オブジェクト）
   ↓ persist()               ※ ?state= のときは書かない
localStorage（3キー）
   ↓ renderAll()
判定関数（bpClass / metaboClass / …）→ 描画関数 → innerHTML
```

- 状態管理ライブラリなし。**単方向・全再描画**。差分更新をしていないので、描画関数は何度呼んでも安全
- 保存と描画は分離している(`persist()` → `renderAll()` の順で呼ぶのが決まり)

---

## 5. スタイルの土台

- トークンは `:root` の CSS 変数のみ。**`:root` の外に生の16進を書かない**(uicheck が数える)
- ダークは `@media (prefers-color-scheme: dark)` で `:root` の値だけ差し替え。セレクタは共通
- レイアウト: コンテンツ幅 `max-width: 480px` 中央寄せ。上部バーは `sticky`、下部タブは `fixed`
- Safe Area: `env(safe-area-inset-top/bottom)` を上部バー・下部タブ・本文下部に適用。`viewport-fit=cover` 指定済み
- `100vh` は**使わない**(モバイルのアドレスバー問題を避けるため。uicheck の HARD 項目)
- グラフは**インラインSVG**を文字列で組み立て(外部ライブラリなし)。色は `var(--c-*)` を SVG 属性に直接渡している

---

## 6. 検査の仕組み

| 道具 | 実行 | 何を見るか |
|---|---|---|
| スモークテスト | `node health/tests/smoke.mjs` | 機能38項目。console エラー0・**外部通信0** も検査 |
| 同・自己検査 | `node health/tests/smoke.mjs --mutate` | メタボ基準を85→95に壊して**テストが落ちること**を確認し、元に戻す |
| uicheck | `MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs --path /health/ --name karada --baseline health/ui/baselines/karada.json` | タップ44px未満・コントラスト・文字サイズ種類・角丸種類・生16進・横はみ出し・入力16px・外部フォント・100vh。360/390 × light/dark |
| 同・状態別 | `--state state=demo` 等 | 空/長い/成功のスクショ |
| 同・自己検査 | `--mutate` | 仕込んだ欠陥4種を検出できるか |

テストは playwright を **`AI_WORKSPACE/ui_toolkit/uicheck/node_modules`** から借りる(環境変数 `PW_DIR` で上書き可)。テスト自身が簡易HTTPサーバを立てて `http://127.0.0.1:<port>/health/` を開く(file:// ではない)。

---

## 7. 公開の経路

- リポジトリ: `github.com/yuukigogo000-ai/yuukigogo000-ai.github.io`(GitHub Pages)
- **`main` にマージした時点で公開**される
- 現在 `main` に `health/` は**無い**(未公開)
- 公開前ゲート: 発注者の見た目承認 → 全テストPASS → 状態網羅 → Codex 破壊的検証(APP_DEV_WORKFLOW 工程7)PASS → マージ

---

## 8. 既知の弱点(アーキテクチャ由来)

1. **localStorage 書込失敗を扱っていない** — 容量超過やプライベートモードで `setItem` が例外を投げると、保存できていないのに画面は成功したように見える可能性がある。**未実装・未検査**
2. **全再描画** — 記録が数千件になると `renderList`(60件に制限済み)以外でも再描画コストが増える。現状の想定件数(年365件)では問題にならない
3. **単一ファイル** — 1,273行。UIを作り直すと差分が巨大になり、レビューしづらい(そのぶん checkpoint tag での復旧を前提にしている)
4. **グラフが自前SVG** — 凡例・軸・移動平均を手で描いている。表現を増やすほどコードが伸びる
5. **データの退避手段がCSVのみ** — サイトデータ削除で消える
