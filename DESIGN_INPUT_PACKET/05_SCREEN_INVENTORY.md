# 05_SCREEN_INVENTORY

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_SCREENS: **12**

本製品にURLルーティングは存在しない(単一ドキュメント)。
そのため SCREEN は「利用者が置かれる表示単位」として、コード上の実体で定義した:
常時表示のchrome(1) / 排他表示のパネル(4) / #modalBox に描画される内容(6) / 重畳オーバーレイ(1)。
コード上に製品名称のない画面には technical identifier を用い、名称を発明していない。

## SCR-01 — `SHELL (persistent chrome)`

- ROUTE / ENTRY: 常時表示。ルーティングなし
- PURPOSE: 経営状態の常時提示と、機能領域の切替、1営業日実行の起点
- PRIMARY_ACTION: **1営業日を実行する(btnOpen)**
- SECONDARY_ACTIONS: 機能領域の切替(4)、dayNoteの助言/ブーム提示
- VISIBLE_DATA: 営業日、資金、評判、常連、台数/上限、借入、純資産、特日/週末の別、今週のブーム
- FUNCTIONS_PRESENT: FN-01, FN-17, FN-26
- ENTRY_CONDITION: アプリ起動時から常時
- EXIT_CONDITION: なし(常時)
- RELATED_CODE: `pachinko/index.html:247-262 statusbar/tabs, pachinko/index.html:367-370 daybar, pachinko/index.html:986 renderStatus`
- REQUIRED / CONDITIONAL: **REQUIRED**

## SCR-02 — `panel-hall`

- ROUTE / ENTRY: #panel-hall(既定でactive)
- PURPOSE: 設置中の台の運用。設定変更・試打・売却
- PRIMARY_ACTION: **台ごとの出玉設定変更**
- SECONDARY_ACTIONS: 台の試打起動、台の売却
- VISIBLE_DATA: 機種名、説明文、スペック表記、状態標識、人気値、前日収支、前日客数、売却額、現在設定
- FUNCTIONS_PRESENT: FN-02, FN-03, FN-04
- ENTRY_CONDITION: 起動直後 / タブ選択
- EXIT_CONDITION: 他タブ選択
- RELATED_CODE: `pachinko/index.html:265-271 markup, pachinko/index.html:1001 renderHall`
- REQUIRED / CONDITIONAL: **REQUIRED**

## SCR-03 — `panel-shop`

- ROUTE / ENTRY: #panel-shop
- PURPOSE: 機種カタログからの導入判断
- PRIMARY_ACTION: **新台の購入**
- SECONDARY_ACTIONS: カタログ機種の試打起動
- VISIBLE_DATA: 機種名、説明文、スペック表記、集客力、人気低下の速さ、価格、ブーム標識、自店設置数
- FUNCTIONS_PRESENT: FN-05, FN-06
- ENTRY_CONDITION: タブ選択
- EXIT_CONDITION: 他タブ選択
- RELATED_CODE: `pachinko/index.html:274-280 markup, pachinko/index.html:1059 renderShop`
- REQUIRED / CONDITIONAL: **REQUIRED**

## SCR-04 — `panel-mgmt`

- ROUTE / ENTRY: #panel-mgmt
- PURPOSE: 台以外の経営資源と、警戒度・実績・データ操作
- PRIMARY_ACTION: **経営施策の選択(広告/フェア/融資/交換率/拡張/人員)**
- SECONDARY_ACTIONS: スタッフ雇用/解雇、広告選択、新装開店、拡張、借入/返済、交換率、手動セーブ、やり直し
- VISIBLE_DATA: スタッフ数、日給合計、必要人数、広告プラン4種、フェア可否、最大設置数、拡張費用、借入残高、借入枠、金利、交換率2種、警戒度、実績15件
- FUNCTIONS_PRESENT: FN-07, FN-08, FN-09, FN-10, FN-11, FN-12, FN-13, FN-14, FN-15, FN-16, FN-24, FN-25
- ENTRY_CONDITION: タブ選択
- EXIT_CONDITION: 他タブ選択
- RELATED_CODE: `pachinko/index.html:283-345 markup, pachinko/index.html:1109 renderMgmt`
- REQUIRED / CONDITIONAL: **REQUIRED**

## SCR-05 — `panel-ledger`

- ROUTE / ENTRY: #panel-ledger
- PURPOSE: 過去営業日の検証
- PRIMARY_ACTION: **なし(閲覧のみ)**
- SECONDARY_ACTIONS: 推移上の個別日の詳細参照(hover)
- VISIBLE_DATA: 純利益推移(最大30日)、営業成績表(最大60日×8列)
- FUNCTIONS_PRESENT: FN-22, FN-23
- ENTRY_CONDITION: タブ選択
- EXIT_CONDITION: 他タブ選択
- RELATED_CODE: `pachinko/index.html:348-363 markup, pachinko/index.html:1194 renderChart, pachinko/index.html:1251 renderLedger`
- REQUIRED / CONDITIONAL: **REQUIRED**

## SCR-06 — `modal:tutorial`

- ROUTE / ENTRY: showModal() 経由 #modalBox
- PURPOSE: 製品説明と難易度選択によるゲーム開始
- PRIMARY_ACTION: **難易度を選んで開始(3択)**
- SECONDARY_ACTIONS: なし
- VISIBLE_DATA: 製品概要、中心ジレンマ、特日/ブーム/シマ、融資、試打、難易度3種と初期資金
- FUNCTIONS_PRESENT: FN-27
- ENTRY_CONDITION: セーブ不在で起動 / doReset()実行後
- EXIT_CONDITION: 難易度選択(startGame)
- RELATED_CODE: `pachinko/index.html:1761 showTutorial, pachinko/index.html:1770-1774 difficulty buttons`
- REQUIRED / CONDITIONAL: **REQUIRED**

## SCR-07 — `modal:day-result`

- ROUTE / ENTRY: showDayResult() 経由 #modalBox
- PURPOSE: 当日結果の提示と次判断への接続
- PRIMARY_ACTION: **閉じて経営へ戻る**
- SECONDARY_ACTIONS: (7日毎)週次レポート閲覧、(達成時)クリア評価確認、(倒産時)やり直し
- VISIBLE_DATA: 日数、特日/週末、発生イベント文、客数と内訳3、総売上、出玉払出、経費、利息、純利益、台別収支、週間純利益、平均客数、常連数、助言、クリア評価、倒産告知
- FUNCTIONS_PRESENT: FN-18, FN-19, FN-20, FN-21, FN-28
- ENTRY_CONDITION: btnOpen実行完了
- EXIT_CONDITION: 閉じる操作(倒産時を除く)
- RELATED_CODE: `pachinko/index.html:1300 showDayResult, pachinko/index.html:954 weeklyReport`
- REQUIRED / CONDITIONAL: **REQUIRED**

## SCR-08 — `modal:bankrupt`

- ROUTE / ENTRY: showBankruptModal() 経由 #modalBox
- PURPOSE: 倒産の終局提示。やり直し以外を封じる
- PRIMARY_ACTION: **最初からやり直す**
- SECONDARY_ACTIONS: なし
- VISIBLE_DATA: 倒産の事実、経営日数
- FUNCTIONS_PRESENT: FN-21, FN-25
- ENTRY_CONDITION: 倒産状態でbtnOpen/closeModal/起動時
- EXIT_CONDITION: doReset()のみ
- RELATED_CODE: `pachinko/index.html:1277 showBankruptModal, pachinko/index.html:1293 closeModalガード, pachinko/index.html:1854 起動時`
- REQUIRED / CONDITIONAL: **CONDITIONAL**

## SCR-09 — `modal:no-machine`

- ROUTE / ENTRY: showModal() 経由 #modalBox
- PURPOSE: 台0台での営業実行の無効化と次行動の案内
- PRIMARY_ACTION: **了解して戻る**
- SECONDARY_ACTIONS: なし
- VISIBLE_DATA: 台0台では営業できない旨、新台購入への誘導
- FUNCTIONS_PRESENT: FN-17, FN-28
- ENTRY_CONDITION: 台0台でbtnOpen
- EXIT_CONDITION: 閉じる操作
- RELATED_CODE: `pachinko/index.html:1791-1795`
- REQUIRED / CONDITIONAL: **CONDITIONAL**

## SCR-10 — `modal:trial-slot`

- ROUTE / ENTRY: openSlotTrial() 経由 #modalBox
- PURPOSE: スロット実機の遊技(営業収支に影響しない)
- PRIMARY_ACTION: **レバーON(遊技開始)**
- SECONDARY_ACTIONS: 3リールの停止、試打設定変更、メダル補充、試打終了
- VISIBLE_DATA: 機種名、スペック表記、試打設定、3リール図柄、告知ランプ、直前結果、所持メダル、総ゲーム数、BIG回数、REG回数、差枚
- FUNCTIONS_PRESENT: FN-29, FN-30, FN-31, FN-32, FN-28
- ENTRY_CONDITION: S型機種の試打起動
- EXIT_CONDITION: 試打を終える / 背景操作
- RELATED_CODE: `pachinko/index.html:1349 openSlotTrial`
- REQUIRED / CONDITIONAL: **CONDITIONAL**

## SCR-11 — `modal:trial-pachinko`

- ROUTE / ENTRY: openPachiTrial() 経由 #modalBox
- PURPOSE: パチンコ実機の遊技(営業収支に影響しない)
- PRIMARY_ACTION: **回す(1回転)**
- SECONDARY_ACTIONS: オート回転切替、釘(設定)変更、玉補充、試打終了
- VISIBLE_DATA: 機種名、スペック表記、釘設定、3桁図柄、リーチ告知、当り/RUSH告知、持ち玉、回転数、当り回数、最高連チャン、差玉
- FUNCTIONS_PRESENT: FN-33, FN-34, FN-35, FN-36, FN-28
- ENTRY_CONDITION: P型機種の試打起動
- EXIT_CONDITION: 試打を終える / 背景操作
- RELATED_CODE: `pachinko/index.html:1496 openPachiTrial`
- REQUIRED / CONDITIONAL: **CONDITIONAL**

## SCR-12 — `overlay:toast`

- ROUTE / ENTRY: #toasts へ動的追加
- PURPOSE: 実績解除の一時通知(操作を妨げない)
- PRIMARY_ACTION: **なし(自動消滅)**
- SECONDARY_ACTIONS: なし
- VISIBLE_DATA: 解除した実績名
- FUNCTIONS_PRESENT: FN-24
- ENTRY_CONDITION: 未解除実績の条件成立
- EXIT_CONDITION: 3500ms経過で自動消滅
- RELATED_CODE: `pachinko/index.html:707 toast(), pachinko/index.html:372 #toasts`
- REQUIRED / CONDITIONAL: **CONDITIONAL**

## 一覧

| SCREEN_ID | 名称 | 主要アクション | 区分 |
|---|---|---|---|
| SCR-01 | `SHELL (persistent chrome)` | 1営業日を実行する(btnOpen) | REQUIRED |
| SCR-02 | `panel-hall` | 台ごとの出玉設定変更 | REQUIRED |
| SCR-03 | `panel-shop` | 新台の購入 | REQUIRED |
| SCR-04 | `panel-mgmt` | 経営施策の選択(広告/フェア/融資/交換率/拡張/人員) | REQUIRED |
| SCR-05 | `panel-ledger` | なし(閲覧のみ) | REQUIRED |
| SCR-06 | `modal:tutorial` | 難易度を選んで開始(3択) | REQUIRED |
| SCR-07 | `modal:day-result` | 閉じて経営へ戻る | REQUIRED |
| SCR-08 | `modal:bankrupt` | 最初からやり直す | CONDITIONAL |
| SCR-09 | `modal:no-machine` | 了解して戻る | CONDITIONAL |
| SCR-10 | `modal:trial-slot` | レバーON(遊技開始) | CONDITIONAL |
| SCR-11 | `modal:trial-pachinko` | 回す(1回転) | CONDITIONAL |
| SCR-12 | `overlay:toast` | なし(自動消滅) | CONDITIONAL |

**TOTAL_SCREENS = 12**(REQUIRED 7 / CONDITIONAL 5)
