# MASTER REFERENCE IMPLEMENTATION — 実装レポート

対象: `pachinko/index.html`(単一自己完結HTML / ビルド工程なし / 外部リクエスト0)
方針: APPROVED_MASTER_REFERENCE を **MASTER VISUAL TARGET** として全画面を作り直した。
現行UIへの部分的な寄せは行っていない(表示層は全面的に書き直した)。

---

## 1. 変更していないもの(Function Freeze / Protected Logic)

再構築前後で **バイト列レベルで同一** であることを機械検証した(空白正規化比較)。

| 種別 | 対象 | 結果 |
|---|---|---|
| 関数 | `simulateDay` `weeklyReport` `expandCost` `isDead` `slotDenom` `clearRank` `save` `sanitizeState` `load` `newGame` `makeMachine` `catalogOf` `machineValue` `machineAssets` `totalAssets` `creditLimit` `isTokubi` `isWeekend` `staffNeeded` `islandBonus` `trendMult` `effectivePop` `rollFlag` `finalSymbols` `spinCost` `hasAch` | 26/26 一致 |
| 定数 | `SAVE_KEY` `GOAL_ASSETS` `MAX_CAP` `DIFFS` `CATALOG`(10機種) `MARGIN` `ADS` `TRENDS` `LUCK_EVENTS`(80) `LUCK_DAILY_P` `COND_EVENTS`(50) `ACHIEVEMENTS`(15) `SLOT_SYMBOLS` | 13/13 一致 |
| セーブ形式 | `pachi-teikoku-save-v1` のキー22項目 | 変更なし(旧セーブがそのまま読める) |

唯一 `grantAch()` だけは **通知の出し方のみ**を差し替えた
(状態変更 `state.ach.push(id)` と `save(true)` は同一。旧: 文字列トースト → 新: 実績トースト+店長室の再描画)。

## 2. 実装した画面

| 画面 | 実装内容 |
|---|---|
| ホーム(ホール) | ホール概観アート+状態チップ / 配分サマリ(表示専用) / 筐体カード一覧(設定1〜6が主役の操作) |
| 新台購入 | 機種カード(スペック・集客力・人気低下・設置数・ブーム)+試打+導入 |
| 店長室 | スタッフ・広告・新装開店フェア・店舗拡張・銀行融資・交換率・警戒度・実績・データ |
| 帳簿 | 0基線の損益グラフ(▲▼併記)+営業日ログ |
| 1日の実行 | 開店演出(760ms)→ 結果シート(純利益を主役に据えたスラム表示) |
| 結果 | イベント文 / 客数内訳 / 収支内訳 / 資金・純資産 / 台別収支 / 週次レポート / クリア・倒産バナー |
| 試打(スロット) | ランプ・リール(SVGシンボル)・レバー・STOP×3・5指標 |
| 試打(パチンコ) | デジタル3桁・リーチ・大当り・RUSH連チャン・オート・5指標 |
| オンボーディング | 世界観の提示+難易度3種の選択 |
| 空 / 終局 | 台なしの案内、倒産シート(やり直し以外を受け付けない) |

## 3. 自動検証の結果

| スイート | 内容 | 結果 |
|---|---|---|
| 実装検証 | 起動・4領域遷移・設定変更・購入・売却・試打・経営操作・帳簿・保存形式 | 全項目 PASS / console エラー 0 / 外部リクエスト 0 |
| タッチ/レイアウト | 44px未満のタップ対象 0件、CTA 56px、横スクロール 0px(320/360/390/430) | PASS |
| モーション | `prefers-reduced-motion: reduce` で演出短縮(<600ms)・カーテン非表示・アニメーション実質0秒 | PASS |
| PWA | Service Worker 登録、**オフラインで再起動可能**、theme-color 一致 | PASS |
| 長時間プレイ | 実UIのクリックで60営業日を連続実行 | エラー0 / 外部通信0 / 横スクロール0 |
| 破壊的検証 | セーブ改竄12種・連打4種・試打の破壊5種・倒産後のゾンビ操作4種・極限状態2種 | **27 PASS / 0 FAIL** |
| バランス回帰 | 熟練プレイのボット(25試行×4条件) | 中央値 72日(再構築前と同水準)。売却なし −2日 / 広告なし +1日 / フェアなし +2日 |
| デスクトップ | Electron(sandbox有効)で起動→1日営業→保存 | PASS / ページエラーなし |

## 4. 実装しなかったもの

Master Reference の画に見えていても本製品に存在しない機能(フロアマップ、客エンティティ、
リアルタイム、ランキング、ミッション、ログイン、クラウドセーブ、マルチプレイ、通知、課金 ほか)は
**機能としてもダミーのボタンとしても置いていない**。詳細は `../FEATURE_ROADMAP.md`。

## 5. 未完了(ブロッカー)

**ARTWORK_ASSET_BLOCKER** — ホール概観のキーアート `hall-overview` が手続き生成の
プレースホルダのまま。差し替え口は `buildStageArt()` と `#stageArt` の1箇所に閉じてある。
発注内容は `../CHATGPT_ARTWORK_REQUEST.md`。
自己採点は `VISUAL_QUALITY_GATE.md`(Art Direction Fidelity のみ 3.9 で未通過)。

## 6. スクリーンショット

`screens/` に収録。390px(2倍解像度)を基準、360 / 430 / デスクトップ1080 / Electron を併載。

```
home / machine-selected / shop / mgmt / ledger
result-plus / result-minus / trial-slot / trial-pachi
achievement / empty-hall / no-machine / bankrupt / onboarding
desktop-1080 / electron-1080
```
