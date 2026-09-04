# PROTECTED LOGIC REPORT

抽出時点(`f71190b`)の `pachinko/index.html` と、V5実装後の `pachinko/index.html` を
関数単位・定数単位で突き合わせた(空白正規化比較)。検証スクリプト: `verify_protected_logic.js`。

```
git show 40c2eaa:pachinko/index.html > /tmp/before.html   # 抽出時点と同一内容
node review/verify_protected_logic.js /tmp/before.html pachinko/index.html
→ PROTECTED LOGIC: 39 PASS / 1 FAIL
```

## 完全一致(39件)

- 関数: `simulateDay` `weeklyReport` `expandCost` `isDead` `slotDenom` `clearRank`
  `save` `sanitizeState` `load` `newGame` `makeMachine` `catalogOf` `machineValue`
  `machineAssets` `totalAssets` `creditLimit` `isTokubi` `isWeekend` `staffNeeded`
  `islandBonus` `trendMult` `effectivePop` `rollFlag` `finalSymbols` `spinCost` `hasAch`
- 定数: `SAVE_KEY` `GOAL_ASSETS` `MAX_CAP` `DIFFS` `CATALOG`(10機種) `MARGIN` `ADS`
  `TRENDS` `LUCK_EVENTS`(80) `LUCK_DAILY_P` `COND_EVENTS`(50) `ACHIEVEMENTS`(15) `SLOT_SYMBOLS`

## 唯一の差分(1件・意図的)

`grantAch()` — **状態変更は完全同一**(`state.ach.push(id)` と `save(true)`)。
通知の出し方のみ、旧UIの文字列トーストから新UIの実績トースト+実績一覧の再描画へ変更した。
Function Freeze が保護するのは「実績が解除され保存されること」であり、提示方法はUI側の裁量。

## P-01〜P-33 の維持状況

| 項目 | 状態 |
|---|---|
| P-01 1営業日は明示操作のみ | 維持(`#btnOpen` → `runDay()` → `simulateDay()`) |
| P-02 結果表示中の再実行を無効化 | 維持(`modalBg.show` ガード + `busy` フラグ) |
| P-03 倒産後の操作封鎖(isDead 15箇所) | 維持(破壊的検証27件で確認) |
| P-04 破壊的操作の確認 | 維持(売却 / やり直しで `confirm()`) |
| P-05 試打は経営stateへ書き込まない | 維持(ローカル `t` のみ。grantAchを除く) |
| P-06〜P-19 計算モデル | 維持(定数・関数が完全一致) |
| P-20 セーブ構造とサニタイズ | 維持(22キー・クランプ範囲そのまま) |
| P-21〜P-23 カタログ/実績/イベント定義 | 維持 |
| P-24 保存キー | 維持(`pachi-teikoku-save-v1`) |
| P-25 SWキャッシュ | 維持(PRECACHEに `./art/hall.jpg` を追加、世代を v3 へ) |
| P-26 単一ドキュメント構成 | 維持(HTML1枚。追加はローカル画像1点のみ) |
| P-27 実行時の外部リクエスト0 | 維持(自動検証で0件) |
| P-28 クライアント内乱数 | 維持 |
| P-29 グローバル公開3件 | **復旧**(V4実装で失われていた `window.closeModal/doReset/startGame` を復元) |
| P-30 DOM識別子70件 | **復旧**(V4実装で33件が失われていた。全70件を再配置し自動検証) |
| P-31〜P-33 アイコン/デスクトップのパス | 維持 |

## バランス回帰

熟練プレイのボット(25試行×4条件)で再測定:

| 条件 | 中央値(日) | 抽出時点との差 |
|---|---|---|
| 基準(全施策あり) | 72 | ±0 |
| 売却なし | 70 | −2 |
| 広告なし | 73 | +1 |
| 新装開店なし | 73 | +1 |

クリア日数の分布は再構築前と同水準であり、ゲームバランスは変化していない。
