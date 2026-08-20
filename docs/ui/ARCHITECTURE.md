# 期待値エクスプローラー — 構造(ARCHITECTURE)

**作成 2026-08-20 / AI UI改善マスタープロトコル v2 Phase 0 / 実物を確認して作成・推測なし**

対象: `expectation-explorer.html`(単一ファイル・**1,272行**)

---

## 1. 全体像

```
expectation-explorer.html   ← これ1つで完結。ビルドなし・依存なし・バックエンドなし
├─  1〜 12  <head>  meta(viewport-fit=cover / theme-color / apple-mobile-web-app-*)
├─ 13〜313  <style> 素の CSS。:root の Design Token → 部品クラス
├─ 315〜533 <body>  4つの <section class="screen"> + <nav class="navbar"> + #toast
└─ 535〜1270 <script> 素の ES2020+(モジュールでもクラスでもない・関数と let/const だけ)
```

**外部依存ゼロ**: `fetch` / `XMLHttpRequest` / `<link>` / `@import` / `<img>` / 外部 `<script src>` / Web フォント — **1つも無い**(`logic_freeze` の契約で機械的に固定)。

---

## 2. レイヤ構造(触ってよい層 / いけない層)

```
┌─────────────────────────────────────────────┐
│ View 層 — UI 作業で作り変えてよい            │
│   render*() 系 15 関数 + DOM + CSS           │
└──────────────┬──────────────────────────────┘
               │ 呼ぶだけ(一方向)
┌──────────────▼──────────────────────────────┐
│ ドメイン層 — 変更禁止(logic_freeze で固定)  │
│   calc / annuity                             │
│   fmtMan / fmtPerHour / fmtX / fmtPct        │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ 永続化層 — 変更禁止                          │
│   loadProfile / loadOptions / persist        │
│   sanitizeProfile / sanitizeOption / num     │
│   LS_PROFILE / LS_OPTIONS                    │
└─────────────────────────────────────────────┘
```

**依存の向きは上から下の一方向**。ドメイン層は DOM を一切知らない(`calc` は引数だけで完結し、戻り値も純粋なオブジェクト)。だから **UI を全部書き換えても計算は影響を受けない**。

`esc()` は View 層が使う XSS 防御だが、**外すと穴が開くので変更禁止側**に置いている。

---

## 3. 状態(state)

グローバル変数4つだけ。ストア・リアクティブ機構は無い。

| 変数 | 型 | 意味 | 永続化 |
|---|---|---|---|
| `profile` | object | リソースプロファイル9項目 | ✅ `ee_profile_v1` |
| `options` | array | 選択肢の配列 | ✅ `ee_options_v1` |
| `comboChecked` | Set&lt;id&gt; | 組合せチェックで選んだ id | ❌ セッション限り |
| `editingId` | string \| null | 編集中の選択肢 id | ❌ |
| `sortKey` / `sortDesc` | string / bool | 俯瞰の並び順 | ❌ |
| `senseId` | string \| null | 感度で選択中の id | ❌ |
| `focusId` | string \| null | 地図でタップされた id | ❌ |
| `DEMO` | string \| null | `?state=` の値 | ❌ |

**更新の流れ**: イベント → グローバル変数を書き換え → `persist()` → 該当 `render*()` を呼ぶ。
**差分描画はしない**。`innerHTML` を丸ごと組み直す。データ件数が数十件のアプリなので問題にならない。

---

## 4. ルーティング

**無し。** タブ切替は `section.screen` の `.active` クラスの付け替えだけ。

- **URL は変わらない**(hash も query も使わない)
- 例外: `?state=empty|long|error` は**検査専用の入口**。`DEMO` に入り、`persist()` を無効化する
- ブラウザの戻るでタブは戻らない(既知の割り切り)

---

## 5. 保存

| | |
|---|---|
| 方式 | `localStorage` のみ |
| キー | **`ee_profile_v1`** / **`ee_options_v1`** の2本だけ |
| 形式 | JSON |
| 読み | `JSON.parse` → **必ず `sanitize*` を通す** → 不正なら既定値へ落とす |
| 書き | `persist()`。**`DEMO` が真なら何も書かない** |
| 失敗 | `try/catch`。容量超過はトーストで通知(黙って失敗しない) |
| 移行 | JSON の書き出し/読み込み(手動)。**マイグレーション機構は無い**(キー名に `_v1` が入っているのは将来用) |

### 保存されるオブジェクトの形

```jsonc
// ee_profile_v1
{ "lumpSumMax":100, "monthlyBudget":3, "monthlyHours":30, "age":35,
  "activeYears":30, "maxLoss":200, "livingCost":20, "discountRate":3, "parallelMax":2 }

// ee_options_v1
[{ "id":"o1a2b3c", "name":"転職する", "domain":"キャリア", "note":"",
   "initialCost":0, "monthlyCost":0, "monthlyHours":10, "effortYears":0.5,
   "scenarios":[ {"label":"悲観","prob":20,"effect":-50,"years":10},
                 {"label":"中位","prob":50,"effect":50,"years":10},
                 {"label":"楽観","prob":30,"effect":150,"years":10} ] }]
```

**`sanitizeOption` が保証すること**(壊れたデータを受け取っても落ちない)
- `id` は `/^[A-Za-z0-9_-]{1,32}$/` に合わなければ生成し直す ← **属性インジェクション対策**
- `domain` は `DOMAINS` に無ければ「その他」
- 数値は `num()` で NaN/Infinity/文字列/範囲外を潰す
- `scenarios` は**必ず3要素**にする(欠損・型不正でも既定値で埋める)
- ラベルは常に `["悲観","中位","楽観"]`

---

## 6. 状態表現(State Matrix)

v2 §15 の表に対して、このアプリで**該当するものだけ**。

| State | このアプリでは | 実装 |
|---|---|---|
| loading | **該当なし**(同期計算のみ・通信なし) | — |
| success(通常) | 通常表示 | 全画面 |
| stale | **該当なし** | — |
| offline | **該当なし**(そもそも通信しない) | — |
| partial failure | **該当なし** | — |
| total error | 入力エラー = 確率合計 ≠ 100% | `#probWarn`・保存ブロック |
| empty | 選択肢ゼロ | 俯瞰=結論カード「まだ選択肢がありません」+ サンプル投入 / 感度=`#senseEmpty` / 一覧=「まだありません」 |
| null optional data | 時間0・コスト0 で指標が出せない | `fmtPerHour`/`fmtX` が `null` → **「—」** |
| disabled | **現状なし** | — |
| destructive action | 削除・全消し | `confirm()` |

**再現フック**: `?state=empty` / `?state=long`(8件) / `?state=error`(確率120%)。
**⚠ `?state=` を付けた回は `persist()` が early return する**ので、検査が本物のデータを壊さない(`destructive.mjs` テスト11で担保)。

---

## 7. CSS の構造

```
:root                     Design Token(色/余白/文字/角丸)— 生値はここだけ
@media (prefers-color-scheme: dark) :root   ダークの上書き
素地                      html / body / 見出し / button / a のリセット
.appbar                   上部バー(64dp + safe-area-inset-top)
main / .screen            画面の入れ物(.active のみ表示)
.card / .verdict-hero     面(M3 トナル階層。枠線でなく明度差)
.tile / .opt-card         数値タイル / 選択肢カード
.badge / .chip            判定バッジ / チップ
.oc-bar / .gauge / .meter / .bd-*   バー類
.field / input / .btn     フォームとボタン
.navbar                   下部ナビ(80dp + safe-area-inset-bottom)
#toast
```

**Token**(現行値。**Phase 3 で `DESIGN_SYSTEM.md` に正式化する**)
- 余白 `--sp-1..6` = 4/8/12/16/24/32
- 文字 `--fs-display/title/body/label/caption` = 2 / 1.25 / 1 / .875 / .75 rem(**5階層**)
- 角丸 `--r-sm/md/lg` = 8 / 12 / 28 px(**3種**)
- 色 = M3 ロール(シード `#005ac1` から `@material/material-color-utilities` v0.4.0 で light/dark 自動生成)
- 判定色 `--good* / --warn* / --skip*` は**予約**。装飾に使わない

> ⚠ `material-color-utilities` v0.4.0 は Node の ESM で直接 import できない(内部が拡張子なし import)。
> `ui_toolkit/_extres.mjs` + `_extres_reg.mjs` の resolver hook 経由で実行する。生成スクリプトは `ui_toolkit/gen_m3_ee.mjs`(⚠ Git 管理外)。

---

## 8. アセットとフォント

| | |
|---|---|
| 画像 | **0 個**。`assets/` ディレクトリ自体が無い |
| アイコン | **インライン SVG 14 個**。自前で描画・`stroke="currentColor"` でテーマ追従 |
| フォント | **system-ui のみ**。`system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif` |
| ライセンス懸案 | **無し**(自前 SVG + system font のみ) |

→ Hero に写真を使う設計にするなら**ライセンス確認と `assets/` の新設が必要**になる(v2 §8.1)。

---

## 9. 実行環境と検査系

| | |
|---|---|
| 実行 | ブラウザだけ。ローカルは `file://` で直接開ける |
| ホスティング | GitHub Pages(**main へ push = 公開**)。現在 **main に未投入 = 未公開** |
| Node | v24.17.0 |
| Playwright | 1.62.1(`ui_toolkit/uicheck/node_modules` を借用。`PW_DIR` で差し替え可) |

| 検査 | ファイル | Git | 自己検査 |
|---|---|---|---|
| ロジック凍結 | `tests/logic_freeze.mjs` + `.json` | ✅ | `--mutate` **16/16 RED** |
| 破壊的検証 | `tests/destructive.mjs`(55件) | ✅ | ⚠ 変異注入は未実施 |
| スクショ+はみ出し | `tests/shot.mjs` | ✅ | — |
| UI 機械検査 | `ui_toolkit/uicheck/uicheck.mjs` | ⚠ Git外(共通ツール) | `--mutate` **4/4 RED** |

> **2026-08-20: uicheck の欠陥を1件修正した。** `overflow_x` が `window.innerWidth`(モバイル擬似で 392)と比較していたため、レイアウト幅 390 からのはみ出しを構造的に見逃していた。`clientWidth` 比較へ変更。**この修正は共通ツールなので他アプリ(band / surf / replier / honmono 等)にも効く**(=今まで見逃されていたはみ出しが新たに RED になる可能性がある)。

---

## 10. 変更の影響範囲(UI を作り変えるとき)

| 触るもの | 影響 | 必要な再検査 |
|---|---|---|
| `<style>` 全体 | 見た目のみ | uicheck / shot |
| `<body>` の DOM 構造 | **安定フックを保てば**ロジックは無傷 | destructive / uicheck / shot |
| `render*()` | 表示のみ | destructive / shot |
| `calc` / `annuity` / `sanitize*` / `persist` / `esc` / `num` / `fmt*` | **禁止** | — |
| `LS_*` / `DOMAINS` / `TEMPLATES` / `PROFILE_DEF` | **禁止** | — |

**UI 作業の前後で必ず `node tests/logic_freeze.mjs` を回す。** OK なら「計算・保存・XSS 対策は1文字も変わっていない」ことが証明される。
