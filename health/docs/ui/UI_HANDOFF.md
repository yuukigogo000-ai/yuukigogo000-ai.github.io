# UI_HANDOFF — カラダ日報 (/health/)

> **新しいチャットでは、会話履歴より先にこのファイルを読む。**(AI UI改善マスタープロトコル v2 §3)
> 作成 2026-08-21 / 最終更新 2026-08-21(Phase 0 整備を反映)/ 作成者: Claude Code (Opus 5)
>  記載内容は**すべてリポジトリを実際に確認して記録**。推測は「未確認」と明記した。

---

## 1. アプリ名と目的

**カラダ日報**(旧称「おじさん健康手帳」。2026-08-18 に改名)

40〜50代の男性が、**風呂上がりと晩酌中に片手で・酔っていても・暗い部屋でも**開いて1タップで終わる健康記録帳。
体重・腹囲・血圧・飲酒・歩数・睡眠を毎日つけ、メタボ(特定健診)・血圧(JSH2019)・純アルコール量・健診値の経年比較を「判定」として返す。
サーバー無し・通信ゼロ・データは端末のブラウザにのみ保存。

副題(READMEとページ説明のみで使用): 「おじさんのための健康記録」。**アプリ名からは「おじさん」を外している**(ホーム画面に置いても気にならない名前にするため / 2026-08-18 発注者決定)。

---

## 2. 現在の技術構成

| 項目 | 実測値 |
|---|---|
| 形態 | 静的サイト。**単一HTMLファイル** `health/index.html`(1,273行)。CSS・JS ともインライン |
| フレームワーク | なし(Vanilla JS)。ビルド工程なし。npm パッケージなし(`health/` 配下に package.json 無し) |
| 外部依存 | **ゼロ**。`health/index.html` 内の `http(s)://` 参照 = **0件**(grep 実測)。CDN・Webフォント・外部アイコンなし |
| フォント | `system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif`(index.html:78)。ローカルバンドルなし |
| アイコン | すべて自前のインラインSVG(stroke・24×24・`currentColor`)。画像アセット 0件 |
| 配色 | ライト/ダーク両対応。`prefers-color-scheme` 分岐は1箇所(`:root` の再定義のみ) |
| 保存 | localStorage のみ。IndexedDB・Cookie・SW なし |
| PWA | **未対応**(manifest なし・Service Worker なし。uicheck INFO: `has_manifest:false` `sw_registered:false`) |
| 対応幅 | 360 / 390px を検査条件に固定。コンテンツ幅は max 480px 中央寄せ |

---

## 3. 現在のbranch

- 作業ブランチ: **`claude/ojisan-health-app-panu15`**(UI専用ブランチではなく、このアプリ全体のブランチ)
- 公開ブランチ: **`main`**(GitHub Pages)。**`main` に `health/` は存在しない**(`git ls-tree origin/main | grep ^health/` = 0件)
- したがって **`https://yuukigogo000-ai.github.io/health/` はまだ存在しない**(未公開)
- リモート: `origin` = github.com/yuukigogo000-ai/yuukigogo000-ai.github.io
- **注意**: このブランチは古いコミット `9fc5598` から分岐しており、`main` にある他アプリ(band/ honmono/ surf/ reply-ai-app/ 等)や README.md・robots.txt を含まない。マージ時に `main` の README.md と競合する可能性がある(本ブランチの README は `health/README.md` に置いてある)

---

## 4. 最新の重要commit / checkpoint

| 種別 | 値 | 内容 |
|---|---|---|
| HEAD | `06d6ad7` | UI: カラダ日報のホームを1から作り変え(UI_PLAYBOOK v3)。push 済み |
| 直前 | `d551664` | アプリ名を「カラダ日報」に変更 |
| **checkpoint tag** | **`health-pre-ui-rebuild-20260818`**(= `d551664`) | **UI作り変え直前の復旧点。リモートにも push 済み** |
| 復旧コマンド | `git checkout health-pre-ui-rebuild-20260818 -- health/` | 旧UIに戻す |
| 未コミット差分 | **なし**(`git status --porcelain` 空。ただし本ファイル作成後は本ファイルが未追跡になる) |

---

## 5. UI改善プロトコルのversion

- **現行: AI UI改善マスタープロトコル v2**(`C:/Users/gogyo/AI_WORKSPACE/_AI_UI_PROTOCOL/AI_UI_MASTER_PROTOCOL_v2.md`)
- 2026-08-21 に切り替え。**Phase 0 の成果物を作成済み**(下記6)
- v0.1 の実装(commit `06d6ad7`)までは旧規約 **UI_PLAYBOOK v3** で実施。経緯は `health/ui/wo/WO_UI_karada_home.md` と `health/docs/ui/REVIEW_LOG.md` R1 に残っている

| UI_PLAYBOOK v3 | プロトコル v2 |
|---|---|
| G0 基準線 | Phase 4 Baseline Capture |
| G1 交通整理 | Phase 2 の一部 |
| G2a refs 収集 | Phase 2 の材料集め |
| G2 見本3案 | Phase 2〜3 |
| G3 トークン | Phase 3 Design System |
| G4 実装 | Phase 5 v0.1 |
| G5 機械検査 | Phase 23 Regression |
| G6 人の一言 | Phase 6 Screenshot Review |

## 6. 現在のPhase

## **Phase 2(Visual Direction)の入口で停止中 — Master Visual Reference 待ち**

発注者の方針(2026-08-21):**UIは今回の規約に基づき1から作り直す**。
そのため v0.1 の見た目は Freeze せず、**Phase 2 からやり直す**。v0.1 のコード・トークン・テスト・基準線は捨てずに残す。

| Phase | 状態 | 根拠 |
|---|---|---|
| 0 Repo Archaeology | ✅ **完了(2026-08-21)** | `FEATURE_INVENTORY.md` `ARCHITECTURE.md` `UI_HANDOFF.md` を作成 |
| 1 Git Safety | ✅ 完了 | checkpoint tag 2本・UI専用ブランチ `ui/karada-v1` 作成済み・working tree clean |
| **2 Visual Direction** | **▶ ここで停止** | **Master Reference が無い**。部分Referenceが3枚あるだけ(`health/docs/ui/reference/`) |
| 3 Design Freeze | △ 半分 | `DESIGN_SYSTEM.md` 作成済み。ただし**B層(色・文字・寸法)は v0.1 の暫定値**で、新Referenceが決まったら差し替える |
| 4 Baseline Capture | ✅ 完了 | `health/ui/baselines/karada.json`(旧UI時点)。作り直し後に v0.1 を新基準線にするかは要判断 |
| 5 v0.1 母艦実装 | ✅ 完了(**未承認**) | commit `06d6ad7` |
| 6 Screenshot Review | ⏸ **打ち切り** | v0.1 の承認は取らない(作り直すため)。提示した横並び画像と3問は `REVIEW_LOG.md` R1 に記録して閉じた |
| 14 実データStress Test | ✗ 未 | 最長文字列・worst-case幅・60件超が未検査 |
| 16 Freeze | ✗ 未 | 凍結済み画面なし |
| 23 Regression | ✅ 稼働中 | smoke 38/38・uicheck GREEN(作り直し後も同じ基準で判定する) |
| 26 Public Ship Gate | ✗ 未 | 未マージ・Codex 破壊的検証 未実施 |

## 7. 完成・凍結済み画面

**なし。凍結済み画面は存在しない。**

母艦画面(ホーム)は v0.1 実装済みだが **Phase 6 の承認前**のため FROZEN ではない。

---

## 8. 未完成画面

このアプリは**1画面構成**(縦1本のホームに全セクション)。個別画面は存在しない。
下部タブ(ホーム/記録/推移/健診)は**同一ページ内スクロール**であり、別画面ではない。

未完成・未着手の領域:

| 領域 | 状態 |
|---|---|
| ホーム全体 | v0.1 実装済み・**未承認** |
| PWA(manifest / Service Worker / ホーム画面追加) | **未着手**(別Phase) |
| 通知・リマインド | 未着手 |
| 週報・月報 | 未着手 |
| 健診票の写真読み取り | 未着手(外部API必要・設計未) |
| 曜日ストリップからの日付選択 | **意図的に見送り**(表示専用。誤タップで別日を書き換える事故を防ぐため) |
| 記録一覧の編集 | 削除のみ実装。編集は未実装 |

---

## 9. Master Visual Reference

## **⚠ まだ存在しない。これが次の作業。**

`health/docs/ui/reference/` は作成済み(Git管理下)だが、入っているのは**部分Reference3枚と実装の記録だけ**。
アプリ全体のデザイン言語を決める `ui-master-*.png` が無い。

| 用意すべきもの | 内容 |
|---|---|
| Master Reference | 母艦画面(ホーム)の全体像。色・空気感・Typographyの方向・カードの言語・ナビ・情報密度・主役の見せ方を決める1枚 |
| 置き場所 | `health/docs/ui/reference/ui-master-<name>-v1.png` |
| 作る人 | プロトコル §2 では ChatGPT(プロダクト/UIディレクター役)。発注者が用意してもよい |
| 渡す材料 | `FEATURE_INVENTORY.md`(実装済み機能と**取得できないデータ**)・現状スクショ・想定端末(360/390px)・使う場面(夜・片手・酔っている) |
| 必ず伝える制約 | 架空機能を描かない / 体脂肪率・心拍・カロリー等は**取得できない** / 単一の健康スコアを作らない / 外部フォント不可 |

参考: v0.1 で使った見本は Google Stitch(Material Design 3・シード色 `#1C3160`)。生成元 project `7000033258657660127`。

## 10. Supplemental Reference

**Git 管理下**(`health/docs/ui/reference/`)— 自分で生成した画像だけを置く:

| ファイル | 適用範囲(この範囲外を上書きしてはいけない) |
|---|---|
| `stitch-A-band-marker-v0.1.png` | **画面上半分のみ**(ヘッダー・あいさつ・状態カード・継続カード・下タブ)。※Stitchの出力打ち切りで下半分が無い |
| `stitch-B-drink-first-v0.1.png` | **晩酌ブロックのみ**(2×2の大ボタン・×2バッジ・集計行・全幅ボタン)+ 曜日ストリップ |
| `stitch-C-record-table-v0.1.png` | **画面下半分のみ**(記録マトリクス・グラフ2枚・健診表・記録一覧行) |
| `accepted-none-v0.1-implementation-light.png` / `-dark.png` | v0.1 実装の記録。**まだ accepted ではない** |
| `history-old-ui-20260818.png` | 作り変える前のUI(経緯) |

**Git 外**(公開リポジトリに入れない):

| もの | 場所 | 理由 |
|---|---|---|
| 実在アプリの参考画像 47枚 + 索引 | `C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/refs/karada_home_jp` / `karada_bp_jp` / `karada_home_us` | **他社著作物** |
| 横並び比較 `G6_compare.png` 等 | `C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/refs/karada_compare/` | 他社画像を含む合成 |
| Stitch 見本の HTML と元画像 | `C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/stitch/karada/` | 作業用の中間物 |

権利のルールは `health/docs/ui/reference/README.md` に記載。

---

## 11. Design Systemの場所

**`health/docs/ui/DESIGN_SYSTEM.md`**(2026-08-21 作成)。2層構成:

- **A層 = 不変の制約** — 使う場面(夜・片手・酔っている)から来る要求、外部依存ゼロ、文字5〜6種・角丸3種、生16進は `:root` だけ、色だけで意味を伝えない、禁止事項。**作り直しても変えない**
- **B層 = 現行 v0.1 の値(暫定)** — 色・余白・文字階層・角丸・寸法。**新しい Master Reference を凍結した時点で差し替える**

実際に効いているトークンの実体は `health/index.html` の `:root`(8〜72行)。**コードと文書を食い違ったまま放置しない**(プロトコル §22)。

主要トークン(B層・現行 v0.1):

| 役割 | 変数 | Light | Dark |
|---|---|---|---|
| ページ | `--page` | `#f4f3f1` | `#131316` |
| カード | `--card` | `#ffffff` | `#1b1b1f` |
| 沈み面 | `--sunken` | `#e9e8e6` | `#26262b` |
| 帯トラック | `--track` | `#dedcd8` | `#3a3a40` |
| 主色 / 上の文字 | `--accent` / `--on-accent` | `#1c3160` / `#ffffff` | `#b1c5ff` / `#002c71` |
| 文字 | `--ink` / `--muted` | `#1b1b1f` / `#44464f` | `#e4e2e6` / `#c5c6d0` |
| 線 | `--line` | `#d7d6d3` | `#3a3a40` |
| 状態 | `--good` / `--warn` / `--bad` | `#0f6b3f` / `#8a5000` / `#ba1a1a` | `#7ad39a` / `#ffb95c` / `#ffb4ab` |
| グラフ | `--c-weight` / `--c-sys` / `--c-dia` / `--grid` | `#1c3160` / `#ba1a1a` / `#00696e` / `#e0dfdd` | `#b1c5ff` / `#ff8a80` / `#4fd8de` / `#33333a` |
| 余白 | `--sp1`〜`--sp6` | 4 / 8 / 12 / 16 / 24 / 32 px | 同 |
| 文字階層(**5種**) | `--fs-hero/title/body/label/cap` | 32 / 20 / 16 / 14 / 12 px | 同 |
| 角丸(**3種**) | `--r1` / `--r2` / `--r3` | 2px / 4px / 999px | 同 |
| タップ | `--tap` | 48px | 同 |

出所: Stitch デザインシステム `Zenith Health Ledger`(シード色 `#1C3160` / M3)+ `@material/material-color-utilities@0.2.7`。

---

## 12. 使用中asset

**画像アセットは0件。**

- 画像・写真・イラスト・アイコンフォント: **なし**
- アイコン: すべて `index.html` 内のインラインSVG(`<svg stroke="currentColor" stroke-width="1.8">`)。`ICONS` 相当の定数 `IC` と `GLASS_ICON`(酒の器7種)
- favicon / apple-touch-icon: **未設定**(PWA未対応のため)
- ライセンス上の懸念: なし(他社画像・アイコンの持ち込みゼロ)

---

## 13. Typography

| 項目 | 実測 |
|---|---|
| family | `system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif`(1箇所で定義・以降は `font-family: inherit`) |
| バンドル | なし(system font のみ)。ライセンス問題なし・ネイティブ移植も容易 |
| 階層(**5種のみ**) | `--fs-hero` 2rem(32px) / `--fs-title` 1.25rem(20px) / `--fs-body` 1rem(16px) / `--fs-label` .875rem(14px) / `--fs-cap` .75rem(12px) |
| 実測の使用種類 | **5種**(uicheck `distinct_font_sizes: 5`) |
| line-height | body 1.55(個別指定は見出し・数値のみ) |
| 数字の揃え | 表のセルに `font-variant-numeric: tabular-nums` |
| 入力欄 | **16px 以上**(iOS の自動ズーム回避。uicheck `input_font_small: 0` で機械確認) |
| letter-spacing | アプリ名のみ `.02em`。それ以外は既定 |

---

## 14. 変更禁止ロジック(Protected Zone)

**UI作業では以下に触らない。** 触る必要が出たら別Phase・別承認。

### 判定ロジック(基準値を含む)
| 関数/定数 | 行 | 基準 |
|---|---|---|
| `bpClass(sys, dia)` | 590 | 血圧 JSH2019(120/130/140/160/180・80/90/100/110) |
| `bmiClass(bmi)` | 599 | 18.5 / 25 / 30 |
| `metaboClass()` | 606 | **特定健診(男性)**: 腹囲85cm + 血圧130/85・中性脂肪150・HDL40・血糖110・HbA1c6.0 のリスク数 |
| `CHK_METRICS` | 620 | 健診7項目の基準値と判定関数 |
| `DRINKS` | 558 | 純アルコールg換算(ビール20 / ハイボール14 / 日本酒22 / ワイン12 / 缶ビール14 / 焼酎12 / チューハイ18) |
| `alcGrams(rec)` | 576 | 旧データ互換(`alc` 無し `drinks:n` → n×20g)を含む |
| `RANKS` / `streakDays()` | 643 / 648 | 継続日数→役職 |
| 週の適量 | 140g/週(厚労省の目安 20g/日 × 7) |

### その他
- **localStorage キー**: `ojisan_health_records` / `ojisan_health_settings` / `ojisan_health_checkups`(index.html:514-516)。**変えると既存ユーザーの記録が消える**
- **CSV の列**: `date,weight,waist,sys,dia,steps,sleep,alc_g,drinks,memo`(日次)/ `date,ggt,tg,hdl,ldl,glu,hba1c,ua`(健診)
- **医療免責の文言**(ドロワー内・健診表の下)を消さない
- **外部通信を足さない**(オフラインで動くことが仕様)
- **偽データを表示しない**(未記録は「—」と「未記録」で表す)

### テストが掴んでいる安定フック(変えるならテストも同時に直す)
`#status` `#drinkSum` `#btnDry` `#btnSave` `#savedMsg` `#checkup` `#bellDot` `#bellPanel` `#btnBell` `#btnMenu` `#drawer` `#scrim` `#btnCsvDay` `#fileImport` `#fWeight` `#fWaist` `#fSys` `#fDia` `#fSteps` / `[data-drink="..."]` / `[data-go="..."]` / `.tab[aria-current]`

---

## 15. API・保存仕様

- **外部API: なし。ネットワーク通信ゼロ**(スモークテストで `外部への通信ゼロ` を毎回検査)
- 保存先: localStorage 3キー(上記14)
- データ形

```js
// ojisan_health_records: 日付昇順の配列
{ date:"YYYY-MM-DD", weight:Number|null, waist:Number|null, sys:Number|null, dia:Number|null,
  steps:Number|null, sleep:Number|null,
  alc:{b500:n,high:n,sake:n,wine:n,b350:n,sho:n,chu:n}|null,   // {} = 休肝日確定 / null = 未記録
  memo:String|null,
  alc_g:Number|null, drinks:Number|null }                       // 旧データ互換のみ

// ojisan_health_settings
{ height:Number|null, target:Number|null, checkupDate:"YYYY-MM-DD"|null }

// ojisan_health_checkups: 日付昇順の配列
{ date:"YYYY-MM-DD", ggt,tg,hdl,ldl,glu,hba1c,ua }             // 各 Number|null
```

- 同じ日付の再保存は**マージ**(空欄は既存値を残す)
- **状態プレビュー `?state=empty|demo|saved` のときは localStorage に書き込まない**(index.html:519 `persist()` の先頭で return)

---

## 16. Regression test

| 項目 | 内容 |
|---|---|
| ファイル | `health/tests/smoke.mjs`(Playwright / Chromium) |
| 実行 | `node health/tests/smoke.mjs` |
| **自己検査** | `node health/tests/smoke.mjs --mutate` — メタボ基準 85cm を 95cm に**わざと壊して**テストが落ちることを確認してから元に戻す |
| 依存 | playwright は共通ツールのものを借用(`AI_WORKSPACE/ui_toolkit/uicheck/node_modules`)。`PW_DIR` 環境変数で上書き可 |
| 検査範囲(12群38項目) | 空状態 / 晩酌カウンター(加算・×2バッジ・リロード保持・休肝日の確定と取消) / 保存と同日マージ / メタボ判定3ケース / 血圧4区分 / 健診判定5ケース / 週の純アルコール2ケース / 旧データ互換 / 継続と役職 / 外殻(下タブ・ドロワー・お知らせ) / CSV往復 / console エラーと外部通信 |
| 機械UI検査 | `MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs --path /health/ --name karada --baseline health/ui/baselines/karada.json` |
| uicheck の自己検査 | `--mutate`(仕込み4/4検出を確認済み) |
| 状態別 | `--state state=demo` / `state=empty` / `state=saved` |

---

## 17. 現在のテスト結果(2026-08-20 15:31 実行・本ファイル作成時に再実行して確認)

- **スモークテスト: 38 passed / 0 failed**
- **uicheck: GREEN**(HARD 0件・基準線より悪化なし)

| METRIC | 旧UI(基準線) | 現在 | 目標 |
|---|---|---|---|
| タップ44px未満 | 11 | **0** | 0 ✅ |
| コントラスト不足 | 22 | **0** | 0 ✅ |
| 文字サイズの種類 | 11 | **5** | ≤6 ✅ |
| 角丸の種類 | 4 | **2** | ≤3 ✅ |
| 文字色の種類 | 5 | **4** | — |
| 背景色の種類 | 3 | **3** | — |
| `:root` 外の生16進 | 1 | **0** | 0 ✅ |
| CSS font-size 宣言 | 14 | **5** | ≤6 ✅ |
| CSS 角丸宣言 | 6 | **3** | ≤3 ✅ |

HARD: console エラー 0 / 横はみ出しなし / 入力16px以上 / 外部フォントなし / `100vh` 不使用。
INFO: Safe Area 対応あり・`viewport-fit=cover` あり・manifest なし・SW なし・`contrast_unknown` 0。

⚠ **データが入った状態(`?state=demo`)では 文字色7・背景色9 に増える**(判定の状態色と帯マーカーのぶん)。基準線比較は同条件(データ無し)で GREEN。**タップ0・コントラスト0 は全状態で維持**。

---

## 18. 直近のScreenshot

すべて **Git 外**(`C:\Users\gogyo\AI_WORKSPACE\ui_toolkit\refs\karada_compare\`):

| ファイル | 内容 |
|---|---|
| `G6_compare.png` | **Phase 6 の横並び4枚**(①旧UI ②実在アプリ参考 ③見本Stitch案A ④実装v3) |
| `new_full_light.png` / `new_full_dark.png` | 実装の全長(ライト/ダーク・390×844・DPR2・demoデータ) |
| `new_fold_light.png` / `new_fold_dark.png` | 実装の初期表示 |
| `old_fold.png` / `old_full.png` | 旧UI(同条件・同データ) |

uicheck の撮影物: `C:\Users\gogyo\AI_WORKSPACE\ui_toolkit\uicheck\out\karada*\`(360/390 × light/dark × 状態別)。

触って確認できるプレビュー(デモデータ入り・保存無効): https://claude.ai/code/artifact/e3b1de39-1a40-4018-95f6-59ccdbb238d3

---

## 19. 現在残っている課題

### いま一番の欠落
1. **Master Visual Reference が無い**(§9)。これが無いと Phase 2 から先に進めない

### 実装の既知の弱点(作り直しでも引き継ぐ宿題)
2. **実データ Stress Test 未実施** — 最長のメモ文字列 / 体重3桁 / 血圧3桁+3桁 / 歩数5桁 / 健診値の桁あふれ / 記録60件超 / 360px の worst-case 幅を測っていない(`UI_ACCEPTANCE.md` §5 に条件を明文化済み)
3. **localStorage 書込失敗が未実装・未検査** — 容量超過やプライベートモードで保存できていないのに成功したように見える可能性
4. データが入ると色数が増える(文字色7・背景色9)。タップ0・コントラスト0 は全状態で維持
5. **PWA未対応** — ホーム画面に追加できない。毎晩開くアプリとしては導線が弱い
6. 見本が「1案まるごと」にならなかった(Stitch の出力打ち切り)。作り直しでは Master Reference を1枚用意して解消する

### 運用上の注意
7. **`main` にマージすると公開される。** 公開前に Codex 破壊的検証(APP_DEV_WORKFLOW 工程7)が必要 — **未実施**
8. ブランチが古い基点から分岐しているため、`main` の README.md と競合しうる(本ブランチの README は `health/README.md`)
9. データはブラウザの localStorage のみ。**サイトデータ削除で消える**(CSV書き出しが唯一の退避手段)

---

## 20. 次にやるべき作業(上から順に。1回に1〜3個)

1. **Phase 2: Master Visual Reference を用意する** ← **いまここ**
   - 母艦画面(ホーム)の全体像を1枚。`health/docs/ui/reference/ui-master-<name>-v1.png` として置く
   - 生成を依頼するときに**必ず渡す**: `FEATURE_INVENTORY.md`(特に §2 の「取得できないデータ」)・現状スクショ・360/390px・使う場面(夜・片手・酔っている・暗い部屋)
   - **必ず伝える制約**: 架空機能を描かない / 体脂肪率・心拍・カロリー・天気は取得できない / 単一の健康スコアを作らない / 外部フォント不可 / ダーク必須
2. **Phase 3: Design Freeze** — 採用Referenceからトークンを抽出し、`DESIGN_SYSTEM.md` の**B層だけ**を差し替える。A層は触らない。`reference/README.md` に適用範囲を追記
3. **Phase 4: Baseline 再取得** — v0.1 を新しい基準線にするか、旧UI基準線のままにするかを決めて記録
4. **Phase 5: v1.0 実装(1回だけ)** — Scope Lock を先に書く。変更可=見た目とCSSとDOM構造、変更禁止=判定ロジック・保存仕様・テストフック。**自主的に v1.1 へ進まず停止**
5. **Phase 14: 実データ Stress Test** — `UI_ACCEPTANCE.md` §5 の S1〜S8 をテストに追加(追加したテストは変異注入でREDを確認)
6. **Phase 6: Screenshot Review** — 横並び画像 + 3問。最大差3点だけを次の修正に
7. (承認後)**Phase 26: Ship Gate** — Codex 破壊的検証 PASS → `main` へマージ → 公開

---

## 21. commit / push / merge状態

| 項目 | 状態 |
|---|---|
| working tree | **clean**(本ファイル作成前の時点。作成後は本ファイルが未追跡) |
| 本ブランチの最終commit | `06d6ad7` |
| push | **済み**(`origin/claude/ojisan-health-app-panu15` = `06d6ad7`) |
| merge | **未**。`main` に `health/` は無い |
| 公開 | **未公開** |
| checkpoint tag | `health-pre-ui-rebuild-20260818` — ローカル・リモート両方に存在 |
| **本ファイル(UI_HANDOFF.md)** | **未コミット**(発注者の指示により commit / push / merge を行っていない) |

---

## 22. 再開時に最初に読むファイル一覧(この順)

1. **本ファイル** `health/docs/ui/UI_HANDOFF.md` — いまどのPhaseで、次に何をするか
2. `C:/Users/gogyo/AI_WORKSPACE/_AI_UI_PROTOCOL/AI_UI_MASTER_PROTOCOL_v2.md` — UI改善工程の正本
3. `health/docs/ui/FEATURE_INVENTORY.md` — **何が実装済みで、どのデータが取得できないか**(Referenceより上の正本)
4. `health/docs/ui/UI_ACCEPTANCE.md` — 作り直しても変わらない合格条件
5. `health/docs/ui/DESIGN_SYSTEM.md` — A層(不変)とB層(暫定トークン)
6. `health/docs/ui/ARCHITECTURE.md` — 関数マップ・データフロー・検査の仕組み
7. `health/docs/ui/REVIEW_LOG.md` — 前のラウンドで何を試し、なぜそう決めたか
8. `health/docs/ui/reference/README.md` — Reference の権利ルールと適用範囲
9. `health/CLAUDE.md` — このディレクトリの規則(変更禁止・コマンド)
10. `health/index.html` の `:root`(8〜72行)と `health/tests/smoke.mjs`
11. (経緯)`health/ui/wo/WO_UI_karada_home.md` — 旧規約での作業指示書。ref→実装の対応表と before/after の数値

### ファイルの置き場所メモ
本アプリのUIドキュメントは現在**2箇所に分かれている**(統合は次の作業候補):
- `health/docs/ui/` — 本ファイル(プロトコル v2 の標準位置。他アプリ `reply-ai-app/docs/ui/` と同じ)
- `health/ui/` — `baselines/karada.json`, `wo/WO_UI_karada_home.md`(UI_PLAYBOOK v3 時代の位置)
