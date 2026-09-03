# 04_FUNCTION_FREEZE

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_PROTECTED_ITEMS: **33**

ここに挙げた項目は、**UI再設計で変更してはならない**。
変更すると製品の機能・数値・保存互換・配布のいずれかが壊れる。

対照的に、**UI側で自由に変更してよいのは「提示方法」のみ**である:
配置・構成・色・書体・余白・装飾・アイコン言語・状態の見せ方・モーション・情報の段階開示。

## PROTECTED_FUNCTION

### P-01

- DESCRIPTION: 1営業日の実行は利用者の明示操作のみで発生する
- SOURCE FILE: `pachinko/index.html:1788-1800`
- SYMBOL / FUNCTION / KEY: `btnOpen → simulateDay()`
- DEPENDENCIES: state全体
- WHAT_MUST_NOT_CHANGE: **自動進行・省略・複数日一括の導入**
- WHY: 1日1決断がゲームの単位そのもの

### P-02

- DESCRIPTION: 結果提示中の再実行は無効
- SOURCE FILE: `pachinko/index.html:1790`
- SYMBOL / FUNCTION / KEY: `modalBg.contains('show')ガード`
- DEPENDENCIES: showModal
- WHAT_MUST_NOT_CHANGE: **ガードの除去**
- WHY: 1操作で複数日進む不具合になる

### P-03

- DESCRIPTION: 倒産後はやり直し以外の全経営操作を拒否
- SOURCE FILE: `pachinko/index.html:1276-1298,1802-1838`
- SYMBOL / FUNCTION / KEY: `isDead() 15箇所`
- DEPENDENCIES: state.money
- WHAT_MUST_NOT_CHANGE: **ガードの除去・緩和**
- WHY: 売却で資金を回復させる抜け道が復活する

### P-04

- DESCRIPTION: 破壊的操作の実行確認
- SOURCE FILE: `pachinko/index.html:1047,1841`
- SYMBOL / FUNCTION / KEY: `confirm()×2`
- DEPENDENCIES: ―
- WHAT_MUST_NOT_CHANGE: **確認の除去**
- WHY: 誤操作で台/セーブを失う

### P-05

- DESCRIPTION: 試打は経営収支に影響しない
- SOURCE FILE: `pachinko/index.html:1349-1651`
- SYMBOL / FUNCTION / KEY: `openSlotTrial/openPachiTrial のローカル t`
- DEPENDENCIES: state非参照(grantAch除く)
- WHAT_MUST_NOT_CHANGE: **試打から経営stateへの書込み追加**
- WHY: 体験モードという製品事実が崩れる

## PROTECTED_GAME_LOGIC

### P-06

- DESCRIPTION: 設定別の店側粗利率
- SOURCE FILE: `pachinko/index.html:422`
- SYMBOL / FUNCTION / KEY: `MARGIN`
- DEPENDENCIES: simulateDay
- WHAT_MUST_NOT_CHANGE: **値の変更**
- WHY: 中心のトレードオフの強度が変わる

### P-07

- DESCRIPTION: 客数モデル(収容力・集客力・充填率)
- SOURCE FILE: `pachinko/index.html:806-836`
- SYMBOL / FUNCTION / KEY: `capacity/attract/fillRate/capMax`
- DEPENDENCIES: machines,rep,trend,ad,diff
- WHAT_MUST_NOT_CHANGE: **係数・構造の変更**
- WHY: 経営バランス全体が変わる

### P-08

- DESCRIPTION: 客層3種の分離(一般/常連/プロ)
- SOURCE FILE: `pachinko/index.html:820-843,856-857`
- SYMBOL / FUNCTION / KEY: `casual/regs/pros`
- DEPENDENCIES: MARGIN,DIFFS.proMul
- WHAT_MUST_NOT_CHANGE: **客層の統合・除去**
- WHY: 出す/渋るの意味が消える

### P-09

- DESCRIPTION: 行政警戒度の蓄積と指導判定
- SOURCE FILE: `pachinko/index.html:793-800`
- SYMBOL / FUNCTION / KEY: `s.heat / 0.25確率 / 罰金500000`
- DEPENDENCIES: avgSet,DIFFS.heatMul
- WHAT_MUST_NOT_CHANGE: **閾値・確率・罰金の変更**
- WHY: 回収営業の抑止力が変わる

### P-10

- DESCRIPTION: 特日/週末の判定と期待バンド
- SOURCE FILE: `pachinko/index.html:678-679,782-784,893-905`
- SYMBOL / FUNCTION / KEY: `isTokubi/isWeekend/avgSet分岐`
- DEPENDENCIES: state.day
- WHAT_MUST_NOT_CHANGE: **判定式・バンド境界の変更**
- WHY: 定期的な山場の設計が崩れる

### P-11

- DESCRIPTION: 新台効果・シマ効果・ブーム倍率
- SOURCE FILE: `pachinko/index.html:682-695`
- SYMBOL / FUNCTION / KEY: `islandBonus/trendMult/effectivePop`
- DEPENDENCIES: TRENDS,boughtDay
- WHAT_MUST_NOT_CHANGE: **倍率・上限の変更**
- WHY: 入替戦略の価値が変わる

### P-12

- DESCRIPTION: 常連プールの増減
- SOURCE FILE: `pachinko/index.html:879-891`
- SYMBOL / FUNCTION / KEY: `convMult / 0.025 / 上限capacity*0.5`
- DEPENDENCIES: avgSet,staffOK,ad.pct
- WHAT_MUST_NOT_CHANGE: **係数の変更**
- WHY: 固定客という長期資産の性質が変わる

### P-13

- DESCRIPTION: 評判の増減と上下限
- SOURCE FILE: `pachinko/index.html:893-906`
- SYMBOL / FUNCTION / KEY: `(avgSet-3)*1.4 / clamp(1,100)`
- DEPENDENCIES: repDelta
- WHAT_MUST_NOT_CHANGE: **式・範囲の変更**
- WHY: 集客の基礎が変わる

### P-14

- DESCRIPTION: 難易度係数
- SOURCE FILE: `pachinko/index.html:391-396`
- SYMBOL / FUNCTION / KEY: `DIFFS(money/rentMul/proMul/heatMul/fillMul)`
- DEPENDENCIES: simulateDay
- WHAT_MUST_NOT_CHANGE: **値の変更**
- WHY: 難易度差が失われる

### P-15

- DESCRIPTION: クリア条件と評価境界
- SOURCE FILE: `pachinko/index.html:387,676,945,951`
- SYMBOL / FUNCTION / KEY: `GOAL_ASSETS/totalAssets/clearRank`
- DEPENDENCIES: money,machineAssets,debt
- WHAT_MUST_NOT_CHANGE: **閾値の変更**
- WHY: ゴールと上達の評価が変わる

### P-16

- DESCRIPTION: 緊急融資と倒産の成立条件
- SOURCE FILE: `pachinko/index.html:909-917,1276`
- SYMBOL / FUNCTION / KEY: `creditLimit()内なら自動融資 / それ以外で倒産`
- DEPENDENCIES: debt,machineAssets
- WHAT_MUST_NOT_CHANGE: **条件の変更**
- WHY: 破滅の曲線(警告付きの死)が変わる

## PROTECTED_CALCULATION

### P-17

- DESCRIPTION: 経費の内訳
- SOURCE FILE: `pachinko/index.html:867-871`
- SYMBOL / FUNCTION / KEY: `rent/wages/utility/ad.cost/extraCost/interest`
- DEPENDENCIES: cap,staff,machines,debt,DIFFS.rentMul
- WHAT_MUST_NOT_CHANGE: **項目の増減・係数変更**
- WHY: 固定費の圧力が変わる

### P-18

- DESCRIPTION: 台別の売上と粗利
- SOURCE FILE: `pachinko/index.html:845-863`
- SYMBOL / FUNCTION / KEY: `qual/tokubiGap/spend/margin/mSales/mGross`
- DEPENDENCIES: MARGIN,rateBonus,pop
- WHAT_MUST_NOT_CHANGE: **式の変更**
- WHY: 台ごとの意思決定の意味が変わる

### P-19

- DESCRIPTION: 純資産と借入枠
- SOURCE FILE: `pachinko/index.html:674-677`
- SYMBOL / FUNCTION / KEY: `machineValue(0.45)/totalAssets/creditLimit(0.7+200万)`
- DEPENDENCIES: CATALOG.price
- WHAT_MUST_NOT_CHANGE: **係数の変更**
- WHY: 入替と融資の採算が変わる

## PROTECTED_DATA_MODEL

### P-20

- DESCRIPTION: セーブ構造とサニタイズ規則
- SOURCE FILE: `pachinko/index.html:629-658,1658-1732`
- SYMBOL / FUNCTION / KEY: `newGame()/sanitizeState()`
- DEPENDENCIES: localStorage
- WHAT_MUST_NOT_CHANGE: **フィールドの削除・クランプ範囲の緩和**
- WHY: 既存セーブの破損・注入リスクの再発

### P-21

- DESCRIPTION: 機種カタログ10件の定義
- SOURCE FILE: `pachinko/index.html:398-421`
- SYMBOL / FUNCTION / KEY: `CATALOG(id/type/name/price/pop/decay/desc/spec)`
- DEPENDENCIES: 試打・購入・収支
- WHAT_MUST_NOT_CHANGE: **件数・IDの変更**
- WHY: 保存済みセーブのcid参照が壊れる

### P-22

- DESCRIPTION: 実績15件のIDと条件
- SOURCE FILE: `pachinko/index.html:604-620,934-945`
- SYMBOL / FUNCTION / KEY: `ACHIEVEMENTS / grantAch`
- DEPENDENCIES: state.ach
- WHAT_MUST_NOT_CHANGE: **ID変更・条件変更**
- WHY: 解除済み実績が失効する

### P-23

- DESCRIPTION: イベント130件の定義と抽選
- SOURCE FILE: `pachinko/index.html:450-601,753-779`
- SYMBOL / FUNCTION / KEY: `LUCK_EVENTS(80)/COND_EVENTS(50)/LUCK_DAILY_P/cd`
- DEPENDENCIES: state全体
- WHAT_MUST_NOT_CHANGE: **件数・効果キー・cdの変更**
- WHY: 創発の量と偏りが変わる

## PROTECTED_STORAGE

### P-24

- DESCRIPTION: 保存キー
- SOURCE FILE: `pachinko/index.html:386`
- SYMBOL / FUNCTION / KEY: `SAVE_KEY='pachi-teikoku-save-v1'`
- DEPENDENCIES: localStorage
- WHAT_MUST_NOT_CHANGE: **キー名の変更**
- WHY: 既存プレイヤーのセーブが消える

### P-25

- DESCRIPTION: Service Workerのキャッシュ名とプリキャッシュ対象
- SOURCE FILE: `pachinko/sw.js:2-3`
- SYMBOL / FUNCTION / KEY: `CACHE='pachi-teikoku-v1' / PRECACHE 5件`
- DEPENDENCIES: オフライン動作
- WHAT_MUST_NOT_CHANGE: **対象からindex.html等を外すこと**
- WHY: オフライン起動が壊れる

## PROTECTED_ROUTE

### P-26

- DESCRIPTION: 単一ドキュメント構成(URLルーティングなし)
- SOURCE FILE: `pachinko/index.html:1-1862`
- SYMBOL / FUNCTION / KEY: `1ファイル / タブ切替のみ`
- DEPENDENCIES: file:/http(s)/Electron
- WHAT_MUST_NOT_CHANGE: **ルーティング導入・ファイル分割**
- WHY: file:とElectronでの動作が壊れる

## PROTECTED_NETWORK_BEHAVIOR

### P-27

- DESCRIPTION: 実行時の外部リクエストがゼロ
- SOURCE FILE: `pachinko/index.html(fetch/XHR/外部URLの出現数=0)`
- SYMBOL / FUNCTION / KEY: `―`
- DEPENDENCIES: CSP相当の前提
- WHAT_MUST_NOT_CHANGE: **外部フォント・CDN・解析の追加**
- WHY: オフライン動作とプライバシー事実が壊れる

## PROTECTED_RANDOMNESS

### P-28

- DESCRIPTION: 抽選は全てMath.randomのクライアント内乱数(シード指定なし)
- SOURCE FILE: `pachinko/index.html:624,753,773,1410,1572,1609`
- SYMBOL / FUNCTION / KEY: `rand()/Math.random()`
- DEPENDENCIES: 再現性なし
- WHAT_MUST_NOT_CHANGE: **シード化・サーバー抽選化**
- WHY: 製品事実(サーバー不在)が変わる

## PROTECTED_TEST_HOOK

### P-29

- DESCRIPTION: インラインハンドラ用のグローバル公開3件
- SOURCE FILE: `pachinko/index.html:1298,1751,1759`
- SYMBOL / FUNCTION / KEY: `window.closeModal/doReset/startGame`
- DEPENDENCIES: チュートリアル・結果・倒産の各操作
- WHAT_MUST_NOT_CHANGE: **削除・改名**
- WHY: 難易度選択と復帰操作が動かなくなる

### P-30

- DESCRIPTION: DOM識別子(静的40件 / 動的含め70件)
- SOURCE FILE: `pachinko/index.html(id属性)`
- SYMBOL / FUNCTION / KEY: `$()による直接取得`
- DEPENDENCIES: 全描画関数
- WHAT_MUST_NOT_CHANGE: **IDの改名・削除**
- WHY: 描画・操作の全結線が壊れる

## PROTECTED_ASSET_REQUIREMENT

### P-31

- DESCRIPTION: PWAアイコンのパスと寸法
- SOURCE FILE: `pachinko/manifest.webmanifest:12-16`
- SYMBOL / FUNCTION / KEY: `icon-192.png(192x192)/icon-512.png(512x512)`
- DEPENDENCIES: PWAインストール
- WHAT_MUST_NOT_CHANGE: **パス・寸法の変更**
- WHY: インストール時のアイコンが壊れる

### P-32

- DESCRIPTION: デスクトップビルドのアイコンパス
- SOURCE FILE: `pachinko/desktop/package.json:36,44,49`
- SYMBOL / FUNCTION / KEY: `build/icon.png`
- DEPENDENCIES: 3OSビルド
- WHAT_MUST_NOT_CHANGE: **パスの変更**
- WHY: ビルドが失敗する

### P-33

- DESCRIPTION: Electronが読み込むゲームファイルの位置
- SOURCE FILE: `pachinko/desktop/main.js:6-10,27`
- SYMBOL / FUNCTION / KEY: `resources/game/index.html / ../index.html`
- DEPENDENCIES: extraResources設定
- WHAT_MUST_NOT_CHANGE: **相対位置の変更**
- WHY: デスクトップ版が起動しない

## 内訳

| CATEGORY | 件数 |
|---|---|
| PROTECTED_FUNCTION | 5 |
| PROTECTED_GAME_LOGIC | 11 |
| PROTECTED_CALCULATION | 3 |
| PROTECTED_DATA_MODEL | 4 |
| PROTECTED_STORAGE | 2 |
| PROTECTED_ROUTE | 1 |
| PROTECTED_NETWORK_BEHAVIOR | 1 |
| PROTECTED_RANDOMNESS | 1 |
| PROTECTED_TEST_HOOK | 2 |
| PROTECTED_ASSET_REQUIREMENT | 3 |
| **合計** | **33** |

## UI変更が許される範囲(明示)

| 変更してよい | 変更してはならない |
|---|---|
| 画面の構成・配置・情報の順序 | 機能の有無・意味・結果(03の39件) |
| 色・書体・余白・装飾・アイコン言語 | 計算式・確率・経済係数(P-06〜P-19) |
| 状態の視覚的な表し分け | 状態の有無(06の62件) |
| モーションの性格と演出 | 1営業日=1操作の原則(P-01, P-02) |
| 情報の段階開示・要約 | 必須コピーの意味(12) |
| アイコン画像の絵柄 | アイコンのパスと寸法(P-31〜P-33) |
