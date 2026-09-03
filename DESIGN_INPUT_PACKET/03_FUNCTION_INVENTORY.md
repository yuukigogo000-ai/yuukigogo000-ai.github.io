# 03_FUNCTION_INVENTORY

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_FUNCTIONS: **39** (FN-01 〜 FN-39)

DESIGN_VISIBILITY は既存UI・ロジック・エントリポイントから分類したものであり、
UI上の重要度を新たに決めたものではない。凡例:

- REQUIRED: 常に利用者が到達できる必要がある(既存で常時到達可能)
- CONTEXTUAL: 条件が成立したときに提示される(既存で条件付き)
- OPTIONAL: 到達できればよい(既存でも副次的な位置)
- NONE: 利用者向けの提示を持たない(システム/配布基盤レベル)

TEST_EVIDENCE は全件 **NOT_FOUND**。リポジトリにテストスイートが存在しない(01, C-03)。

## FN-01 — 機能領域の切替

- DESCRIPTION: 4領域(hall/shop/mgmt/ledger)の表示切替
- ENTRY_POINT: .tab クリック
- INPUT: 領域ID
- OUTPUT: 対象パネルのみ表示
- STATE_CHANGE: DOMのみ(state非変更)
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-01
- RELATED_CODE: `pachinko/index.html:1779-1786`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-02 — 出玉設定の変更

- DESCRIPTION: 台ごとに設定1〜6を選択
- ENTRY_POINT: hall内の設定選択(select change)
- INPUT: 1〜6
- OUTPUT: 当該台のsetting更新+再描画
- STATE_CHANGE: machines[i].setting
- PERSISTENCE: save()で即保存
- RELATED_SCREEN: SCR-02
- RELATED_CODE: `pachinko/index.html:1031-1039`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-03 — 設置台の試打起動

- DESCRIPTION: 当該台の現在設定で遊技を開始
- ENTRY_POINT: hall内の試打操作
- INPUT: 機種+設定
- OUTPUT: S型/P型に応じた遊技画面
- STATE_CHANGE: なし(経営state非変更)
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-02
- RELATED_CODE: `pachinko/index.html:1040-1042, pachinko/index.html:1340`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-04 — 設置台の売却

- DESCRIPTION: 確認後に売却額を資金へ加算し台を除去
- ENTRY_POINT: hall内の売却操作
- INPUT: 対象台+確認
- OUTPUT: money+=price*0.45 / machines除去
- STATE_CHANGE: money, machines
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-02
- RELATED_CODE: `pachinko/index.html:1043-1052, pachinko/index.html:674`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-05 — カタログ機種の試打起動

- DESCRIPTION: 未購入機種を設定3相当で試打
- ENTRY_POINT: shop内の試打操作
- INPUT: 機種
- OUTPUT: 遊技画面
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-03
- RELATED_CODE: `pachinko/index.html:1081-1083`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-06 — 新台の購入

- DESCRIPTION: 価格を支払い設置一覧へ追加
- ENTRY_POINT: shop内の導入操作
- INPUT: 機種
- OUTPUT: money-=price / machines追加 / boughtDay記録
- STATE_CHANGE: money, machines, uid
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-03
- RELATED_CODE: `pachinko/index.html:1091-1101`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-07 — スタッフの雇用

- DESCRIPTION: スタッフを1人増やす
- ENTRY_POINT: btnHire
- INPUT: なし
- OUTPUT: staff+1
- STATE_CHANGE: staff
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1802`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-08 — スタッフの解雇

- DESCRIPTION: スタッフを1人減らす(下限1)
- ENTRY_POINT: btnFire
- INPUT: なし
- OUTPUT: staff-1
- STATE_CHANGE: staff
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1803`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-09 — 広告プランの選択

- DESCRIPTION: 翌営業日の集客を増やす施策を選ぶ
- ENTRY_POINT: 広告ボタン(4種)
- INPUT: プランID
- OUTPUT: ad更新
- STATE_CHANGE: ad
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1126-1132, pachinko/index.html:425-430`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-10 — 新装開店フェアの予約

- DESCRIPTION: 翌営業日に客数1.5倍+評判上昇
- ENTRY_POINT: btnGrand
- INPUT: なし
- OUTPUT: money-=300000 / grandOpen=true / lastGrand=day
- STATE_CHANGE: money, grandOpen, lastGrand
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1812-1820`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-11 — 店舗の拡張

- DESCRIPTION: 最大設置数を+5(上限60)
- ENTRY_POINT: btnExpand
- INPUT: なし
- OUTPUT: money-=expandCost() / cap+=5
- STATE_CHANGE: money, cap
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1804-1811, pachinko/index.html:1107`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-12 — 借入

- DESCRIPTION: 100万円単位で借入(枠内)
- ENTRY_POINT: btnBorrow
- INPUT: なし
- OUTPUT: money+=100万 / debt+=100万 / maxDebt更新
- STATE_CHANGE: money, debt, maxDebt
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1822-1829, pachinko/index.html:677`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-13 — 返済

- DESCRIPTION: 100万円単位で返済
- ENTRY_POINT: btnRepay
- INPUT: なし
- OUTPUT: money-=x / debt-=x
- STATE_CHANGE: money, debt
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1830-1838`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-14 — 交換率ポリシーの切替

- DESCRIPTION: 等価交換 / 低換金
- ENTRY_POINT: 交換率ボタン(2種)
- INPUT: ポリシーID
- OUTPUT: rate更新
- STATE_CHANGE: rate
- PERSISTENCE: save()
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1155-1162`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-15 — 手動セーブ

- DESCRIPTION: 現在状態を保存し完了を通知
- ENTRY_POINT: btnSave
- INPUT: なし
- OUTPUT: localStorage更新+通知
- STATE_CHANGE: なし
- PERSISTENCE: localStorage
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1839`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **OPTIONAL**

## FN-16 — 最初からやり直す

- DESCRIPTION: 確認後にセーブ削除し新規開始
- ENTRY_POINT: btnReset
- INPUT: 確認
- OUTPUT: state初期化+チュートリアルへ
- STATE_CHANGE: state全体
- PERSISTENCE: localStorage削除
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1840-1842, pachinko/index.html:1744`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-17 — 1営業日の実行

- DESCRIPTION: 当日の客数・収支・評判・常連・警戒度・実績を計算し1日進める
- ENTRY_POINT: btnOpen
- INPUT: state全体
- OUTPUT: 結果レコードと発生イベント
- STATE_CHANGE: money, rep, regulars, heat, day, machines.pop, ach, history, trend, ad, grandOpen, debt
- PERSISTENCE: save(true)
- RELATED_SCREEN: SCR-01
- RELATED_CODE: `pachinko/index.html:1788-1800, pachinko/index.html:718-949`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-18 — 当日結果の提示

- DESCRIPTION: 収支・客層内訳・台別収支・イベント文を提示
- ENTRY_POINT: FN-17完了時
- INPUT: rec, notes
- OUTPUT: 結果画面
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-07
- RELATED_CODE: `pachinko/index.html:1300-1335`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-19 — 週次レポートの提示

- DESCRIPTION: 7日毎に週間実績と助言(8条件)を提示
- ENTRY_POINT: rec.day%7===0
- INPUT: 直近7日+現在state
- OUTPUT: レポート追記
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-07
- RELATED_CODE: `pachinko/index.html:954-985`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-20 — クリア判定と評価

- DESCRIPTION: 純資産1億到達で告知と S/A/B/C 評価
- ENTRY_POINT: FN-17内の判定
- INPUT: clearDay
- OUTPUT: cleared=true / clearDay記録 / 告知
- STATE_CHANGE: cleared, clearDay
- PERSISTENCE: save(true)
- RELATED_SCREEN: SCR-07
- RELATED_CODE: `pachinko/index.html:945, pachinko/index.html:951, pachinko/index.html:1315-1318`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-21 — 倒産の確定と操作封鎖

- DESCRIPTION: money<0で終局。やり直し以外を拒否
- ENTRY_POINT: FN-17後 / closeModal / 起動時
- INPUT: なし
- OUTPUT: 倒産提示。全経営操作を拒否
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-08
- RELATED_CODE: `pachinko/index.html:1276-1283, pachinko/index.html:1312-1314, pachinko/index.html:1854`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-22 — 損益推移の提示

- DESCRIPTION: 直近30営業日の純利益を推移として提示し個別日を参照
- ENTRY_POINT: ledger表示時
- INPUT: history30件
- OUTPUT: 推移表示+hover詳細
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-05
- RELATED_CODE: `pachinko/index.html:1194-1250`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-23 — 営業成績の提示

- DESCRIPTION: 最大60営業日×8項目を新しい順に提示
- ENTRY_POINT: ledger表示時
- INPUT: history
- OUTPUT: 明細表示
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-05
- RELATED_CODE: `pachinko/index.html:1251-1269`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-24 — 実績の解除と一時通知

- DESCRIPTION: 未解除条件の成立で解除し通知
- ENTRY_POINT: grantAch()
- INPUT: 実績ID
- OUTPUT: ach追加+一時通知
- STATE_CHANGE: ach
- PERSISTENCE: save(true)
- RELATED_SCREEN: SCR-12
- RELATED_CODE: `pachinko/index.html:698-712, pachinko/index.html:934-945`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-25 — 実績一覧の提示

- DESCRIPTION: 15件を名称・条件・解除状態で提示
- ENTRY_POINT: mgmt表示時
- INPUT: ACHIEVEMENTS, ach
- OUTPUT: 一覧表示
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-04
- RELATED_CODE: `pachinko/index.html:1180-1192, pachinko/index.html:604-620`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **OPTIONAL**

## FN-26 — 経営ステータスの常時提示

- DESCRIPTION: 7指標と特日/週末/ブームを提示
- ENTRY_POINT: 状態更新ごと
- INPUT: state
- OUTPUT: 指標表示更新
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-01
- RELATED_CODE: `pachinko/index.html:986-999`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-27 — 難易度選択によるゲーム開始

- DESCRIPTION: 3難易度から初期条件を決めて開始
- ENTRY_POINT: チュートリアルの難易度操作
- INPUT: 難易度ID
- OUTPUT: state初期化
- STATE_CHANGE: state全体
- PERSISTENCE: save(true)
- RELATED_SCREEN: SCR-06
- RELATED_CODE: `pachinko/index.html:1752-1758, pachinko/index.html:391-396`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-28 — 提示の閉了と復帰

- DESCRIPTION: 結果/案内/遊技を閉じて経営へ戻る(倒産時は不可)
- ENTRY_POINT: 閉じる操作 / 背景操作
- INPUT: なし
- OUTPUT: 提示を閉じ再描画。遊技のタイマーを全停止
- STATE_CHANGE: なし
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-07
- RELATED_CODE: `pachinko/index.html:1285-1298`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-29 — スロット遊技: 開始操作

- DESCRIPTION: 3枚消費して抽選し3リールを回転
- ENTRY_POINT: trLever
- INPUT: なし
- OUTPUT: credits-3 / games+1 / 抽選確定
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-10
- RELATED_CODE: `pachinko/index.html:1434-1452, pachinko/index.html:1405-1416`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-30 — スロット遊技: リール停止と結果確定

- DESCRIPTION: 3リールを個別停止し成立役と獲得を確定
- ENTRY_POINT: stop0/1/2
- INPUT: 停止対象
- OUTPUT: 図柄確定 / 獲得枚数 / BB・RB加算
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-10
- RELATED_CODE: `pachinko/index.html:1454-1485`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-31 — スロット遊技: 試打設定の変更

- DESCRIPTION: 抽選確率を設定1〜6で切替(店の設定は不変)
- ENTRY_POINT: trSet
- INPUT: 1〜6
- OUTPUT: 以後の抽選確率が変化
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-10
- RELATED_CODE: `pachinko/index.html:1489, pachinko/index.html:1347`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-32 — スロット遊技: メダル補充

- DESCRIPTION: 所持メダルを500増やす(無償)
- ENTRY_POINT: trRefill
- INPUT: なし
- OUTPUT: credits+500
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-10
- RELATED_CODE: `pachinko/index.html:1490`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-33 — パチンコ遊技: 回転操作

- DESCRIPTION: 釘設定に応じた玉を消費し1回転を抽選
- ENTRY_POINT: pSpin
- INPUT: なし
- OUTPUT: balls-cost / spins+1 / 演出
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-11
- RELATED_CODE: `pachinko/index.html:1558-1596, pachinko/index.html:1550`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-34 — パチンコ遊技: 連続大当りの継続抽選

- DESCRIPTION: 継続率で連チャンを繰り返し総獲得を提示
- ENTRY_POINT: 当選時に自動
- INPUT: c.spec.rushPct
- OUTPUT: balls加算 / 連チャン数 / maxRen更新
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-11
- RELATED_CODE: `pachinko/index.html:1598-1629`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **REQUIRED**

## FN-35 — パチンコ遊技: 自動回転

- DESCRIPTION: 一定間隔で回転を自動実行
- ENTRY_POINT: pAuto
- INPUT: ON/OFF
- OUTPUT: 自動回転の開始/停止
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-11
- RELATED_CODE: `pachinko/index.html:1632-1639`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-36 — パチンコ遊技: 釘変更と玉補充

- DESCRIPTION: 釘1〜6で消費玉が変化 / 玉を1000補充
- ENTRY_POINT: trSet, pRefill
- INPUT: 1〜6 / なし
- OUTPUT: spinCost変化 / balls+1000
- STATE_CHANGE: 試打ローカル状態のみ
- PERSISTENCE: なし
- RELATED_SCREEN: SCR-11
- RELATED_CODE: `pachinko/index.html:1640-1641, pachinko/index.html:1550`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **CONTEXTUAL**

## FN-37 — 自動保存と自動復元(保存値の無害化)

- DESCRIPTION: 状態を保存し起動時に復元。破損値は補正/除去
- ENTRY_POINT: save()/load()/sanitizeState()
- INPUT: localStorage
- OUTPUT: 前回状態から再開または新規開始
- STATE_CHANGE: state全体
- PERSISTENCE: localStorage
- RELATED_SCREEN: APP_LEVEL
- RELATED_CODE: `pachinko/index.html:1652-1743, pachinko/index.html:1848-1856`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **NONE**

## FN-38 — オフライン動作(Service Worker)

- DESCRIPTION: https配信時にSWを登録しオフラインで起動可能に
- ENTRY_POINT: 起動時(http(s)のみ)
- INPUT: なし
- OUTPUT: キャッシュ登録 / オフライン応答
- STATE_CHANGE: なし
- PERSISTENCE: CacheStorage
- RELATED_SCREEN: APP_LEVEL
- RELATED_CODE: `pachinko/index.html:1845-1847, pachinko/sw.js:1-32`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **NONE**

## FN-39 — デスクトップ起動(Electron)

- DESCRIPTION: 同一HTMLをネイティブウィンドウで起動
- ENTRY_POINT: アプリ起動
- INPUT: なし
- OUTPUT: 1080x920ウィンドウでゲーム描画
- STATE_CHANGE: なし
- PERSISTENCE: アプリ内localStorage
- RELATED_SCREEN: APP_LEVEL
- RELATED_CODE: `pachinko/desktop/main.js:1-46`
- TEST_EVIDENCE: NOT_FOUND (リポジトリにテストスイートが存在しない)
- DESIGN_VISIBILITY: **NONE**

## 内訳

| DESIGN_VISIBILITY | 件数 |
|---|---|
| REQUIRED | 25 |
| CONTEXTUAL | 9 |
| OPTIONAL | 2 |
| NONE | 3 |
| **合計** | **39** |
