# 期待値エクスプローラー — UI 引き継ぎ書(UI_HANDOFF)

**作成 2026-08-20 / 更新 2026-08-20(Phase 0・Phase 1 完了) / 作成者 Claude(Opus 5) / 会話履歴が全部消えても、この1枚から再開できることを目的とする。**

この文書は**リポジトリの実物を確認して書いた**。推測で書いた箇所は無い。確認できなかったことは「⚠ 未確認」と明示した。テスト結果と検査数値は**この文書を書くために実際に走らせた実測値**。

- リポジトリ: `https://github.com/yuukigogo000-ai/yuukigogo000-ai.github.io`
- 作業クローン: `C:\Users\gogyo\AI_WORKSPACE\yuukigogo000-ai.github.io_ee`
- この文書の位置: `docs/ui/UI_HANDOFF.md`(リポジトリ直下の `docs/` を使用。当アプリはリポジトリ直下に住む単一ファイルのため)

> ⚠ **同一リポジトリのクローンが3つある。取り違え注意。**
> | クローン | 用途 | 状態(2026-08-20) |
> |---|---|---|
> | `yuukigogo000-ai.github.io_ee` | **このアプリ専用(ここで作業する)** | clean |
> | `yuukigogo000-ai.github.io` | 共用。別スレが Replier / band を作業中 | dirty 40ファイル |
> | `yuukigogo000-ai.github.io_surf` | 波チェック(Ocean UI)専用 | `surf/docs/` 未追跡 |

---

## 1. アプリ名と目的

**期待値エクスプローラー**(`expectation-explorer.html`)

個人が自分のリソース(資金・時間・年齢/残り活動年数・リスク許容度)を前提として登録し、**人生レベルの選択肢**(転職・資格取得・積立投資の増額・独立・移住・健康習慣など)の期待値を長期の時間軸で見積もり・比較・探索するツール。

問いは「**今後5〜30年、どこにリソースを張るのが割に合うか**」。

- 目的は**予測を当てることではない**。「桁と順位を間違えない」ためのラフな見積もり環境。
- 数値はすべてユーザー入力。アプリは計算と可視化のみで、**投資助言・税務助言にあたる断定的推奨はしない**。
- ⚠ **v0.1 は「せどり・ポイ活・キャンペーン」の短期小銭稼ぎツールだった。2026-08-16 に発注者の指示で全面的にマクロへ再定義した**(`docs/期待値エクスプローラー定義書.md` v0.2)。この経緯を知らずに短期案件の機能を戻してはいけない。
- 設計正本: `docs/期待値エクスプローラー定義書.md`(v0.2・164行)

### 数理モデル(この2式がアプリの中身そのもの)
```
シナリオ価値 = Σ[t=1..T] (年間効果額_t ÷ (1+r)^t) − 初期コスト − 継続コストの現在価値
EV = p(悲観)×悲観価値 + p(中位)×中位価値 + p(楽観)×楽観価値
```
比較指標: EV / 時間対効果(EV÷総投入時間) / 資金対効果(EV÷総投入資金) / 最悪ケース(悲観シナリオ価値) / 損益分岐確率。
判定: **有望**(EV>0 かつ全制約クリア)/ **条件付き**(EV>0 だが制約抵触)/ **見送り**(EV≤0)。

---

## 2. 現在の技術構成

| | |
|---|---|
| 形式 | **単一 HTML ファイル** `expectation-explorer.html`(**1,272 行**) |
| 内訳 | `<style>` 13〜313行 / `<body>` 315〜1271行 / `<script>` 535〜1270行 |
| CSS | 素の CSS。`:root` のカスタムプロパティ(Design Token)のみ。ライト/ダーク両対応(`prefers-color-scheme`) |
| JS | 素の ES2020+(テンプレート文字列・オプショナルチェーン・Set/Map)。**ビルドなし・依存なし・フレームワークなし・router なし** |
| バックエンド | **なし** |
| **外部通信** | **ゼロ**。`fetch` / `XMLHttpRequest` / 外部URL / `<link>` / `@import` / 外部画像 — **grep で1件も無いことを確認済み** |
| 画像アセット | **なし**。アイコンは全て**インライン SVG 14個**(自前で描いたもの。他社アイコン持ち込みなし) |
| フォント | **system-ui のみ**(`system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif`)。Webフォント読込なし・バンドルなし |
| ホスティング | GitHub Pages(**main へ push = 公開**) |
| テスト実行環境 | Node **v24.17.0** / Playwright **1.62.1**(`ui_toolkit/uicheck/node_modules` を借用・`PW_DIR` で差し替え可) |
| 破壊的検証(Codex) | **未実施** |

---

## 3. 現在の branch

| | |
|---|---|
| 作業 branch | **`claude/personal-expectation-explorer-imex4l`** |
| 公開 branch | **`main`**(GitHub Pages) |
| working tree | **clean**(未コミット差分なし・`git status --porcelain` が空) |
| リモート同期 | push 済み(`origin/claude/personal-expectation-explorer-imex4l` = ローカル HEAD) |
| **UI 専用 branch** | **`ui/ee-v2`**(2026-08-20 作成・`a2fa492` 起点・ローカルのみ・未 push) |

> Phase 5 の実装は `ui/ee-v2` で行う。`claude/personal-expectation-explorer-imex4l` はアプリ新規作成時からの1本で、Phase 0/1 の文書はこちらに入れている。

---

## 4. 最新の重要 commit / checkpoint

| | |
|---|---|
| HEAD | **`a2fa492`** `UI_PLAYBOOK v3 に従い UI を 1 から全部作り変え(外殻込み・主画面=俯瞰)` |
| その前 | `b182dcc` `破壊的検証で見つかった問題を修正・入力を無害化` ← **UI改修前の最後の状態(機能完成点)** |
| 初回実装 | `03ea53a` `期待値エクスプローラー v1 を実装` |
| 設計書 | `9116683` `定義書をマクロ視点の意思決定探索ツールとして再定義（v0.2）` |
| **公開中の main** | **`b64051b`**(HONMONO の commit)。**このアプリは main に1行も入っていない** |
| **復元点 tag** | **`checkpoint/ee-pre-ui-v2-20260820`** → `a2fa492`(2026-08-20 作成・ローカルのみ・未 push)。**ここに戻せば必ず元に戻る** |

**main との差分**: 10ファイル / +2,645行(`expectation-explorer.html` 1,272 / `tests/destructive.mjs` 333 / 定義書 164 / WO 151 / baselines 710 / CLAUDE.md 14 / index.html 1 / G6画像2枚)。

---

## 5. UI 改善プロトコルの version

**このプロジェクトの UI 正本は 2026-08-20 に切り替わった。**

| 文書 | 場所 | 役割 |
|---|---|---|
| **AI UI改善マスタープロトコル v2** | **`docs/ui/AI_UI_MASTER_PROTOCOL_v2.md`**(888行・2026-08-20 にリポジトリへ複製)。原本は `C:\Users\gogyo\AI_WORKSPACE\_AI_UI_PROTOCOL\` | **現在の UI 工程正本**(2026-08-20 発注者指定) |
| UI_PLAYBOOK v3 | `~/.claude/playbooks/UI_PLAYBOOK.md` | **旧正本**。`a2fa492` はこれに従って作った。v2 とは別体系 |
| APP_DEV_WORKFLOW | `~/.claude/playbooks/APP_DEV_WORKFLOW.md` | 10工程の正本(0相談〜9公開後)。UI は工程5 |
| リポジトリ常設指示 | `CLAUDE.md` | main へ push = 公開 / 触ってはいけないもの / 検査コマンド |
| 設計正本 | `docs/期待値エクスプローラー定義書.md` | アプリの目的と数式(v0.2) |
| 旧WO | `docs/ui/wo/WO_UI_ee_overview.md` | UI_PLAYBOOK v3 での作業記録(151行)。**v2 での正本ではないが、refs 調査と ref→実装 対応表は再利用価値あり** |

| **機能棚卸し** | **`docs/ui/FEATURE_INVENTORY.md`** | Phase 0 成果。**「機能が損なわれていないか」を照合する正本** |
| **構造** | **`docs/ui/ARCHITECTURE.md`** | Phase 0 成果。層構造・保存・状態・変更影響範囲 |
| **Phase 2 依頼書** | **`docs/ui/PHASE2_REQUEST_FOR_CHATGPT.md`** | ChatGPT にそのまま貼る |

### v2 が要求していて**まだ無い**文書
`DESIGN_SYSTEM.md` / `UI_IMPLEMENTATION.md` / `UI_ACCEPTANCE.md` / `REVIEW_LOG.md` / `reference/` — **Phase 3 以降で作る**(Master Reference が決まってから)。

---

## 6. 現在の Phase

# **Phase 1 完了 → 次は Phase 2(Visual Direction)**

| Phase | 成果物 | 状態 |
|---|---|---|
| **0 Repo Archaeology** | `FEATURE_INVENTORY.md` / `ARCHITECTURE.md` / `UI_HANDOFF.md` | **完了**(2026-08-20) |
| **1 Git Safety** | checkpoint tag / UI 専用 branch / プロトコル複製 | **完了**(2026-08-20) |
| **2 Visual Direction** | Master Visual Reference(**ChatGPT が作る**) | **未着手 ← いまここ** |
| 3 Design Freeze | `DESIGN_SYSTEM.md` / `reference/` | 未着手 |
| 4 Baseline Capture | 基準スクショ | **素材はある**(`docs/ui/screenshots/current-20260820/` 38枚) |
| 5 v0.1 母艦実装 | — | 未着手 |

**Phase 2 の依頼書は作成済み**: `docs/ui/PHASE2_REQUEST_FOR_CHATGPT.md`。これをそのまま ChatGPT に貼り、指定のスクショを添付する。

> ⚠ **Claude が Visual Reference を作ってはいけない**(v2 §2 で ChatGPT の役割)。ここで止まるのが正しい。

### 「白紙」の扱い(2026-08-20 確定)
発注者の「現状の UI は一度白紙」を、**(A) コードは足場として残し、視覚層だけ作り直す**と解釈して進めている(発注者の「あなたが良いと思うようにすすめて。重要なのは機能そこなわないこと」による)。
- **視覚層**(HTML 骨格・CSS・下タブ・結論カード・散布図の見た目)= **白紙**。Reference 確定後に作り直す
- **非視覚層**(計算・保存・sanitize・状態再現フック・テスト)= **残す**。`tests/logic_freeze.mjs` で1文字も変わらないことを機械証明する
- `b182dcc` への revert は**しない**。復元が必要なら tag `checkpoint/ee-pre-ui-v2-20260820` から戻せる

---

## 7. 完成・凍結済み画面

# **凍結済み画面は無い(ゼロ)。**

`UI_ACCEPTANCE.md` が存在せず、accepted screenshot も無く、発注者の採点も受けていない。プロトコル v2 §16 の意味での FROZEN は**1画面も無い**。

参考(機能としての完成度・**見た目は白紙扱い**):

| 画面 | 機能 | 見た目 |
|---|---|---|
| ③ 俯瞰(母艦候補) | 動作する | **白紙** |
| ① 前提 | 動作する | **白紙** |
| ② 選択肢 | 動作する | **白紙** |
| ④ 感度 | 動作する | **白紙** |

---

## 8. 未完成画面

**上記4画面すべてが UI としては未完成**(Phase 0 のため)。

加えて、機能としても未実装のもの(**Reference に描かれても勝手に実装しない** — v2 §19):

| 項目 | 状態 |
|---|---|
| 実績の振り返り(見積もり精度の可視化) | 未実装。定義書 v0.2 §7.2 の v2 候補 |
| モンテカルロ試算 | 未実装。同上 |
| 選択肢間の依存関係(排他) | 未実装。同上 |
| PWA manifest / Service Worker | 未実装。`has_manifest:false` を uicheck で確認済み。オフライン化は別作業 |

---

## 9. Master Visual Reference

# **存在しない。**

**これが Phase 2 に進むための唯一のブロッカー。** ChatGPT に生成させて `docs/ui/reference/ui-master-v1.png` として保存し、Git 管理下に置く必要がある(v2 §4.1 / §21)。

代替になりそうだが**正本ではないもの**:

| ファイル | 内容 | Git | なぜ正本でないか |
|---|---|---|---|
| `ui_toolkit/stitch/ee_samples/A_390.png` | Stitch 生成の俯瞰画面(採用案) | ⚠ **Git 管理外** | 旧プロトコルの「見本」。散布図が `Map Visualization` のグレー矩形プレースホルダで、Hero の空気感を決めていない |
| `ui_toolkit/stitch/ee_samples/B_390.png` / `C_390.png` | 不採用の2案 | ⚠ Git 管理外 | 同上 |

---

## 10. Supplemental Reference

**存在しない。**

参考資料として集めた**他社著作物**(Reference ではない・**アプリに持ち込み禁止**):

| 場所 | 内容 | Git |
|---|---|---|
| `ui_toolkit/refs/ee_overview_jp` | 同カテゴリ jp 5アプリ 33枚(FIREタイムライン / みらいぼ / ライフプラン / かんたん複利計算 / 三井住友信託) | ⚠ **Git 管理外(意図的。公開リポジトリに入れない)** |
| `ui_toolkit/refs/ee_overview_us` | 同カテゴリ us 3アプリ 20枚(John Hancock / Vanguard / Investment Run) | ⚠ 同上 |
| `ui_toolkit/refs/ee_overview_top` | 同画面種別の一流 4アプリ 30枚(マネーフォワードME / OsidOri / Caho家計簿 / お小遣い帳) | ⚠ 同上 |
| `ui_toolkit/refs/ee_REFS_INDEX.md` | 上記83枚を全部見て書いた索引(良い点/借りる/借りない・画像番号つき) | ⚠ 同上 |

> **最も参考になったのは FIREタイムライン(6780137922)の 01(ホーム)と 03(比較)。** 同じ「シナリオを振って結論を出す」構造を持つ唯一の実在アプリ。Phase 2 で ChatGPT に方向を伝えるとき、この2枚を見せるのが早い。

---

## 11. Design System の場所

# **存在しない(`DESIGN_SYSTEM.md` 未作成)。**

現在のトークンは `expectation-explorer.html` の `:root`(13〜64行付近)に直接書かれているだけで、**文書化されていない**。Phase 3 で `docs/ui/DESIGN_SYSTEM.md` に起こす必要がある。

現在コードに入っている値(**白紙対象だが、記録として**):

| 種別 | 値 |
|---|---|
| 生成方法 | M3 シード色から `@material/material-color-utilities` v0.4.0 で light/dark 全ロール自動生成 |
| ⚠ シード色 | **M3 baseline blue**。⚠ 具体値は uicheck の `css_raw_hex_outside_root` を 0 にするため CSS コメントから削除済み。**再現するには `themeFromSourceColor(argbFromHex('#005ac1'))`**(生成スクリプト `ui_toolkit/gen_m3_ee.mjs` / `gen_m3_surf.mjs`・⚠ Git管理外) |
| 余白 | `--sp-1..6` = 4/8/12/16/24/32 |
| 文字階層(5) | `--fs-display 2rem` / `--fs-title 1.25rem` / `--fs-body 1rem` / `--fs-label .875rem` / `--fs-caption .75rem` |
| 角丸(3) | `--r-sm 8px` / `--r-md 12px` / `--r-lg 28px` |
| 判定色(**予約**) | 有望=緑 `--good*` / 条件付き=黄 `--warn*` / 見送り=グレー `--skip*`。**装飾に使わない** |
| 面 | M3 トナル階層 `--surface` / `--surface-low` / `--surface-c` / `--surface-high` |

> ⚠ **material-color-utilities v0.4.0 は Node ESM で素直に import できない**(内部が拡張子なし import)。`ui_toolkit/_extres.mjs` + `_extres_reg.mjs` の resolver hook 経由で実行する。

---

## 12. 使用中 asset

# **画像アセットはゼロ。**

| 種別 | 実状 |
|---|---|
| 画像 | **なし**。`assets/` ディレクトリ自体が存在しない |
| アイコン | **インライン SVG 14個**。すべて自前で描画(`stroke="currentColor"`)。他社アイコンセットの持ち込みなし |
| フォント | **system-ui のみ**。Webフォント読込なし・バンドルなし・ライセンス懸案なし |
| 外部CDN | **なし** |

> v2 §8.1 の Asset Plan は**未策定**。Phase 3 で「Hero を CSS/SVG で作るか画像にするか」を決める必要がある。現状は全て code。

---

## 13. Typography

**⚠ 文書化されていない**(`DESIGN_SYSTEM.md` が無いため)。現在コードに入っている実装値:

| | |
|---|---|
| family | `system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif` |
| 基準 | `html { font-size: 16px }`・`body { line-height: 1.55 }` |
| 階層 | 5段(display 32 / title 20 / body 16 / label 14 / caption 12 px)。**M3 型スケール内** |
| 実測の使用種類 | **4種**(既定状態)/ **5種**(データあり状態)— uicheck 実測 |
| tabular numbers | `font-variant-numeric: tabular-nums` を数値入力・KPI・スライダー出力に適用 |
| 入力欄 | **16px 以上**(iOS Safari の自動ズーム回避。uicheck `input_font_small: 0` で担保) |
| 日本語/英数字 | 混植の個別調整なし(system-ui 任せ)。letter-spacing の指定なし |
| ライセンス | system font のみのため**懸案なし**。ネイティブ移植も容易 |

---

## 14. 変更禁止ロジック

UI 作業では **1 行も触らない**。触ると `tests/destructive.mjs` が落ちる。

**定数**(`expectation-explorer.html`)

| 名前 | 行 | 内容 |
|---|---|---|
| `LS_PROFILE` | 543 | `"ee_profile_v1"` |
| `LS_OPTIONS` | 544 | `"ee_options_v1"` |
| `DOMAINS` | 546 | 7ドメインの配列。**順序と文字列が保存データの検証に使われる** |
| `TEMPLATES` | 548 | テンプレート6件(数値は参考値。変えると test 1 の期待値が動く) |
| `PROFILE_DEF` | 579 | 前提の既定値 |

**関数**(2026-08-20 時点の行番号)

| 関数 | 行 | 役割 |
|---|---|---|
| `num` | 583 | 数値の強制・クランプ(NaN/Infinity/文字列/負数の無害化) |
| `sanitizeProfile` | 588 | 壊れた profile の修復 |
| `sanitizeOption` | 596 | 壊れた option の修復。**id を英数32字に強制する属性インジェクション対策を含む** |
| `loadProfile` / `loadOptions` | 617 / 621 | localStorage 読み出し |
| `persist` | 627 | 保存。**`DEMO` が真なら書かない**(状態再現が本物を壊さない仕組み) |
| **`annuity`** | **638** | 年金現価係数。**中核** |
| **`calc`** | **645** | **期待値エンジン。このアプリの本体。EV / worst / breakeven / blockedBy / verdict / perHour / perYen を返す** |
| `fmtMan` | 685 | 万円/億円表記。**「−0万円」を出さない丸め順序を含む** |
| `fmtPerHour` / `fmtX` / `fmtPct` | 696 / 703 / 704 | 表示整形 |
| `esc` | 705 | HTML エスケープ。**XSS 防御。絶対に外さない** |

> ⚠ **`esc` と `sanitizeOption` の id 正規表現は、破壊的検証で実際に見つかった攻撃(属性インジェクション)への対策。** 「使っていないように見える」からと外すと穴が開く。

**View 層(触ってよい層)**: `renderProfileForm` 750 / `renderProfileTiles` 755 / `renderTemplateChips` 770 / `applyTemplate` 776 / `readEditor` 788 / `renderEditorCalc` 806 / `renderBreakdown` 821 / `renderOptionList` 860 / `editOption` 883 / `renderOverview` 901 / `renderHero` 904 / `sortedRows` 942 / `renderOptionCards` 951 / `niceTicks` 990 / `fmtAxis` 999 / `renderScatter` 1005 / `renderCombo` 1068 / `renderSenseSelect` 1110 / `initSenseSliders` 1125 / `renderWhatIfChips` 1156 / `renderSense` 1165。

---

## 15. API・保存仕様

**変更禁止。**

| | |
|---|---|
| 外部 API | **無し。外部通信ゼロ**(grep で `fetch` / `XMLHttpRequest` / `http` が1件も無いことを確認) |
| localStorage | **`ee_profile_v1`** / **`ee_options_v1`** の2キーのみ |
| 保存形式 | `profile` = `PROFILE_DEF` の9キー(全て数値)。`options` = 配列。各要素は `{id, name, domain, note, initialCost, monthlyCost, monthlyHours, effortYears, scenarios[3]}`。`scenarios[i]` = `{label, prob, effect, years}` |
| 読み込み時 | **必ず `sanitize*` を通す**。壊れた JSON・型不正・NaN・非配列でもクラッシュせず既定値に落ちる(破壊的検証で担保) |
| 単位 | 金額は**すべて万円**。`fmtMan` だけが表示単位を知っている |
| URL | **ハッシュ・クエリを状態に使わない**。例外は `?state=empty|long|error`(検査専用) |
| 入出力 | JSON エクスポート/インポート(`Blob` + `<a download>` / `<input type=file>`)。**サーバ送信なし** |

### 状態再現フック `?state=`
| 値 | 内容 |
|---|---|
| `?state=empty` | 選択肢ゼロ |
| `?state=long` | 選択肢8件(テンプレ6+重複2)・組合せに2件チェック |
| `?state=error` | 確率合計120%のエラー表示・選択肢タブへ遷移 |

> **`?state=` が付いた回は `persist()` が early return する**ので、検査が本物のデータを壊さない。破壊的検証11で担保。

---

## 16. Regression test

`tests/destructive.mjs`(333行・**Git 管理下**)

```bash
cd C:\Users\gogyo\AI_WORKSPACE\yuukigogo000-ai.github.io_ee
node tests/destructive.mjs
```
Playwright は `ui_toolkit/uicheck/node_modules` を `createRequire` で借用。環境変数 `PW_DIR` で差し替え可。

| # | ブロック | 内容 |
|---|---|---|
| 1 | 計算コアの数値検証 | `annuity` の3ケース・転職サンプルの EV/worst/breakeven を手計算と突合・breakeven の縮退(全正=0/全負=1)・ゼロ除算 |
| 2 | XSS | `<img onerror>` `<script>` `<svg onload>` を名前とメモに注入 |
| 3 | 壊れた localStorage | 不正JSON / 非配列 / scenarios欠損 / 型不正 / NaN / **id属性インジェクション** の6種 |
| 4 | 極端な入力値 | 負コスト・1e15・9999年 → クランプ確認 |
| 5 | 確率まわり | 33.3+33.3+33.4 の浮動小数点・合計≠100%のブロック |
| 6 | 感度スライダー | 相互クランプ・書き戻し後の合計100% |
| 6b | もしもチップ | 5個・全適用後も確率が壊れない |
| 7 | 削除と空状態 | 全削除後の空状態遷移 |
| 8 | 永続化 | リロード後の同一性 |
| 9 | 散布図の縮退 | 全点が原点でも SVG に NaN が出ない |
| 10 | 破壊的インポート | 非JSON/null/数値配列/ネストしたゴミの連投 |
| 11 | 状態再現フックの隔離 | `?state=` が本物のデータを書き換えない |

**機械検査 uicheck**(スクショ+実測。`ui_toolkit/uicheck/uicheck.mjs`・⚠ Git管理外の共通ツール)
```bash
MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs \
  --path /expectation-explorer.html --name ee \
  --baseline docs/ui/baselines/ee.json --accept distinct_bg_colors=5
# 状態別: --name ee-long --state state=long  (empty / error も同様)
```
- 固定条件: 360×800(android-s)/ 390×844(iphone)・DPR3・タッチ・light+dark・ja-JP
- `--accept distinct_bg_colors=5` は旧WO §9 で理由を宣言済み(M3 トナル階層+判定色の予約)
- **検査器の自己検査**: `--mutate` で仕込み4/4 を検出することを 2026-08-18 に確認済み(RED OK)

**壊してはいけない安定フック**(テストが参照):
`#o-name` `#o-note` `#o-domain` `#o-initialCost` `#o-monthlyCost` `#o-monthlyHours` `#o-effortYears` /
`#s0-prob` `#s0-effect` `#s0-years` `#s1-prob` `#s2-prob` `#s2-effect` /
`#saveOption` `#clearEditor` `#probWarn` `#e-ev` /
`#loadSample` `#exportJson` `#importJson` `#importFile` `#wipeAll` /
`#senseSelect` `#sl-p0` `#sl-p2` `#sl-scale` `#sl-rate` `#applySense` `#whatIfChips` `#senseEmpty` `#s-ev` /
`#scatter` `g.pt` `#overviewTable` `[data-combo]` `[data-del]` `[data-edit]` /
`nav button[data-tab="profile|editor|overview|sense"]` / `.tile`(**ちょうど3個**)

> `#overviewTable` は**表ではなくカード一覧の入れ物**。空のとき文字列「**まだありません**」を含むことをテスト7が固定している。
> `.tile` は前提タブ専用で**ちょうど3個**。増減させるとテスト3・10が落ちる。

---

## 17. 現在のテスト結果

**2026-08-20 に実際に実行して確認した数字**(記憶ではない)。

| スイート | PASS 数 | 結果 |
|---|---|---|
| `tests/destructive.mjs` | **55** | **55 passed / 0 failed** |
| uicheck 既定状態 | — | **GREEN**(HARD 0件・基準線より悪化なし) |

**uicheck METRIC(既定状態・2026-08-20 実測)**
`tap_small:0` / `contrast_low:0` / `distinct_font_sizes:4` / `distinct_radii:2` / `distinct_text_colors:4` / `distinct_bg_colors:5` / `css_raw_hex_outside_root:0` / `css_font_size_decl_distinct:6` / `css_radius_decl_distinct:4`
HARD: `console_errors:0` / `overflow_x:false` / `input_font_small:0` / `external_font:false` / `uses_100vh:false`

**状態別(2026-08-18 実測・全て HARD 0・tap<44 0・contrast_low 0)**
| 状態 | tap<44 | contrast_low | font_sizes | bg_colors |
|---|---|---|---|---|
| `?state=empty` | 0 | 0 | 4 | 5 |
| `?state=long`(8件) | 0 | 0 | 5 | 8 |
| `?state=error` | 0 | 0 | 5 | 8 |

**変異注入**: uicheck `--mutate` で **4/4 RED**(2026-08-18)。
⚠ **`tests/destructive.mjs` 自体の変異注入は未実施**(v2 §23 の Mutation check 未達)。

---

## 18. 直近の Screenshot

| 用途 | 場所 | Git |
|---|---|---|
| **G6 横並び4枚**(旧UI｜refs代表｜見本 Stitch A｜実装) | `docs/ui/g6/G6_iphone_light.jpg` / `G6_iphone_dark.jpg` | ✅ **Git 管理下** |
| uicheck 既定状態(4条件) | `ui_toolkit/uicheck/out/ee/<timestamp>/{android-s,iphone}_{light,dark}[_full].png`(7回分) | ⚠ Git 管理外 |
| uicheck 状態別 | `ui_toolkit/uicheck/out/ee-{empty,long,error}/<timestamp>/`(2/3/2回分) | ⚠ Git 管理外 |
| 旧UI vs 実装(同データ) | `ui_toolkit/uicheck/ee_g6/{old,new}_{light,dark}_{fold,full}.png` | ⚠ Git 管理外 |
| Stitch 見本3案(実寸描画) | `ui_toolkit/stitch/ee_samples/{A,B,C}_390[_fold].png` | ⚠ Git 管理外 |

撮り方(旧UIと実装を同条件・同データで撮る):
```bash
git show b182dcc:expectation-explorer.html > <dir>/old.html
node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/compose_ee.mjs <dir>/old.html <new.html> <dir>
```
⚠ `compose_ee.mjs` と横並び合成の `compose.py` は **Git 管理外**(`ui_toolkit/uicheck/` と `ee_g6/` にある)。

---

## 19. 現在残っている課題

### ★ 最優先(工程の入口)

| # | 課題 | 状態 |
|---|---|---|
| **1** | **`a2fa492` の視覚層をどう扱うか(発注者決裁)** | 「白紙」の意味が **(A) コードは残して見た目だけ作り直す** か **(B) `b182dcc` へ revert** かが未確定。**Claude の推奨は (A)**(§6 参照)。ここが決まらないと Phase 2 以降の作業量が変わる |
| **2** | **Master Visual Reference が無い** | Phase 2 の唯一のブロッカー。ChatGPT に生成させ `docs/ui/reference/ui-master-v1.png` へ(§9) |
| **3** | **母艦画面が未確定** | 候補は **③俯瞰**(このアプリの結論が出る画面)。旧WOでは俯瞰を主画面としたが、v2 の Phase 2 で正式に選び直す |

### 文書・工程の欠落(v2 §3 の必須成果物)

| # | 課題 | 状態 |
|---|---|---|
| 4 | `FEATURE_INVENTORY.md` | **未作成**(Phase 0 の必須) |
| 5 | `ARCHITECTURE.md` | **未作成**(Phase 0 の必須) |
| 6 | `DESIGN_SYSTEM.md` / `UI_IMPLEMENTATION.md` / `UI_ACCEPTANCE.md` / `REVIEW_LOG.md` | **未作成**(Phase 3 以降) |
| 7 | プロトコル本体がリポジトリに無い | v2 §3 は `docs/ui/AI_UI_MASTER_PROTOCOL_v2.md` を求めている。現在は `_AI_UI_PROTOCOL/` に1本だけ |
| 8 | checkpoint tag が無い | Phase 1 の必須(§4) |
| 9 | UI 専用 branch が無い | Phase 1 の必須(§3) |

### 品質・運用

| # | 課題 | 状態 |
|---|---|---|
| 10 | **Codex 破壊的検証(工程7)が未実施** | `APP_DEV_WORKFLOW` 工程7。**PASS 前は公開禁止** |
| 11 | `destructive.mjs` の変異注入が未実施 | v2 §23。「テストが本当に落ちるか」を確認していない |
| 12 | Reference / 見本 / 検査ツールが Git 管理外 | クローンが消えると失われる(§10・§18) |
| 13 | State Matrix が不完全 | v2 §15。`loading` / `stale` / `partial failure` / `disabled` は**このアプリに該当しない**(外部通信ゼロ)が、その旨を文書化していない |
| 14 | PWA 化(manifest / SW) | 未実施。`has_manifest:false` |
| 15 | 実データ Stress Test の文字幅検証 | v2 §14。選択肢名80字・効果額1e9万円などの worst-case 幅を実フォントで測っていない(uicheck の overflow 検査は通っているが、`?state=long` の8件は全てテンプレ由来の短い名前) |

---

## 20. 次にやるべき作業

**この順番で。前を飛ばさない。**

1. **発注者に §19 課題1 を確認する**(白紙 = (A)見た目だけ作り直す / (B)revert のどちらか)
2. **Phase 0 を完了させる** — `FEATURE_INVENTORY.md` と `ARCHITECTURE.md` を作る(本書 §14〜16 が下敷きになる)
3. **Phase 1 を完了させる** — checkpoint tag(`checkpoint/ee-pre-ui-v2-20260820` 等)を切り、UI 専用 branch(`ui/ee-v2` 等)を作る。プロトコル本体を `docs/ui/` に複製
4. **Phase 2 へ渡す** — ChatGPT に「FEATURE_INVENTORY + ARCHITECTURE + 現状スクショ + FIREタイムライン 01/03」を渡し、**母艦画面(俯瞰)の Master Visual Reference** を生成してもらう
5. **Phase 3 Design Freeze** — Reference を `docs/ui/reference/` に保存し `DESIGN_SYSTEM.md` を作る。**ここまではコミットしてよい**(v2 §6)
6. Phase 4 Baseline Capture → Phase 5 v0.1 実装(1回だけ・Scope Lock・停止)

> ⚠ **Claude が Phase 2 の Visual Reference を勝手に作ってはいけない。** v2 §2 で Visual Reference 生成は ChatGPT の役割。旧プロトコルで Stitch を使ったのとは体制が違う。

---

## 21. commit / push / merge 状態

| | |
|---|---|
| working tree | **clean**(未コミット差分なし) |
| ローカル HEAD | `a2fa492` |
| リモート | `origin/claude/personal-expectation-explorer-imex4l` = `a2fa492`(**push 済み・同期**) |
| main へのマージ | **していない** |
| **公開状態** | **未公開**。`origin/main` に `expectation-explorer.html` は**存在しない**(`git cat-file -e` で確認)。GitHub Pages では 404 |
| 本書 | **未コミット**(発注者の指示により commit / push / merge を行っていない) |

**公開に必要なもの**(v2 §26 / `APP_DEV_WORKFLOW` 工程7〜8): 発注者のスクショ承認 → 全テスト PASS → state matrix → **Codex 破壊的検証 PASS** → docs 同期 → main へマージ。**現時点でどれも揃っていない。**

---

## 22. 再開時に最初に読むファイル一覧

**この順に読む。会話履歴より先。**

| # | ファイル | なぜ |
|---|---|---|
| 1 | **本書** `docs/ui/UI_HANDOFF.md` | 現在地 |
| 2 | `C:\Users\gogyo\AI_WORKSPACE\_AI_UI_PROTOCOL\AI_UI_MASTER_PROTOCOL_v2.md` | **UI 工程の正本**(888行) |
| 3 | `docs/期待値エクスプローラー定義書.md` | アプリの目的と数式(v0.2・164行) |
| 4 | `CLAUDE.md`(リポジトリ直下) | 触ってはいけないもの・検査コマンド |
| 5 | `expectation-explorer.html` の 535〜710行 | 変更禁止ロジックの実物(`calc` / `annuity` / `sanitize*` / `esc`) |
| 6 | `tests/destructive.mjs` | 安定フックの正本(テストが何を固定しているか) |
| 7 | `docs/ui/wo/WO_UI_ee_overview.md` | 旧プロトコルの作業記録。**refs 調査と ref→実装 対応表**は再利用価値あり |
| 8 | `ui_toolkit/refs/ee_REFS_INDEX.md`(⚠ Git外) | 実在アプリ83枚の索引 |
| 9 | `~/.claude/playbooks/APP_DEV_WORKFLOW.md` | 10工程(UI は工程5・公開は工程8) |
| 10 | 参考実装 `yuukigogo000-ai.github.io_surf/surf/docs/ui/UI_HANDOFF.md` | **プロトコル v2 で実際に成功した事例**の引き継ぎ書。書式と粒度の手本 |

**最初に打つコマンド**
```bash
cd C:\Users\gogyo\AI_WORKSPACE\yuukigogo000-ai.github.io_ee
git status && git log --oneline -3
node tests/destructive.mjs
MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs \
  --path /expectation-explorer.html --name ee \
  --baseline docs/ui/baselines/ee.json --accept distinct_bg_colors=5
```

---

## 禁止事項(まとめ)

1. `calc` / `annuity` / `sanitize*` / `esc` / `num` / `fmtMan` を UI 作業で触らない
2. localStorage キー(`ee_profile_v1` / `ee_options_v1`)と保存形式を変えない
3. §16 の安定フック(id / data-* / `.tile` 3個 / `g.pt`)を消さない・改名しない
4. **外部通信を1本も足さない**(現在ゼロ。追加は仕様変更であり発注者承認が要る)
5. 他社アプリの画像・アイコンを持ち込まない(`ui_toolkit/refs/` は参考のみ・Git に入れない)
6. Reference に描かれていても**未実装機能を勝手に作らない**。押すと架空画面へ行く fake interaction 禁止(v2 §19)
7. **Claude の自己採点を合格根拠にしない**(v2 §24)
8. **Codex 破壊的検証 PASS 前に main へ merge / push しない**
9. Visual Reference と実データ仕様が衝突したら**実データを優先**(v2 §1)
10. Phase 5 完了後に自主的に v0.2 へ進まない(v2 §10)
