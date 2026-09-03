# 08_ACTION_INVENTORY

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_ACTIONS: **35**

TOUCH_FREQUENCY はコード上の役割から推定した相対頻度(VERY_HIGH/HIGH/MEDIUM/LOW/VERY_LOW)。

## ACT-01 — 「営業開始」

- SCREEN: SCR-01 / STATE(代表): ST-01
- FUNCTION: FN-17
- DESTRUCTIVE: **NO** / REVERSIBLE: NO(1日進行は巻き戻せない) / CONFIRMATION: **NO**
- DISABLED_CONDITION: 倒産中 / 提示中 / 台0台(案内へ)
- TOUCH_FREQUENCY: VERY_HIGH(毎日)
- RELATED_CODE: `pachinko/index.html:369,1788`

## ACT-02 — 「ホール」

- SCREEN: SCR-01 / STATE(代表): ST-01
- FUNCTION: FN-01
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: HIGH
- RELATED_CODE: `pachinko/index.html:258,1779`

## ACT-03 — 「新台購入」

- SCREEN: SCR-01 / STATE(代表): ST-01
- FUNCTION: FN-01
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: MEDIUM
- RELATED_CODE: `pachinko/index.html:259,1779`

## ACT-04 — 「経営」

- SCREEN: SCR-01 / STATE(代表): ST-01
- FUNCTION: FN-01
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: MEDIUM
- RELATED_CODE: `pachinko/index.html:260,1779`

## ACT-05 — 「帳簿」

- SCREEN: SCR-01 / STATE(代表): ST-01
- FUNCTION: FN-01
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:261,1779`

## ACT-06 — 「設定1〜6(台ごと)」

- SCREEN: SCR-02 / STATE(代表): ST-07
- FUNCTION: FN-02
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: 倒産中
- TOUCH_FREQUENCY: VERY_HIGH(毎日・台数分)
- RELATED_CODE: `pachinko/index.html:1031-1039`

## ACT-07 — 「試打(台ごと)」

- SCREEN: SCR-02 / STATE(代表): ST-07
- FUNCTION: FN-03
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: MEDIUM
- RELATED_CODE: `pachinko/index.html:1040-1042`

## ACT-08 — 「売却(台ごと)」

- SCREEN: SCR-02 / STATE(代表): ST-13
- FUNCTION: FN-04
- DESTRUCTIVE: **YES** / REVERSIBLE: NO / CONFIRMATION: **YES(confirm)**
- DISABLED_CONDITION: 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1043-1052`

## ACT-09 — 「試打(カタログ)」

- SCREEN: SCR-03 / STATE(代表): ST-14
- FUNCTION: FN-05
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1081-1083`

## ACT-10 — 「導入する」

- SCREEN: SCR-03 / STATE(代表): ST-14
- FUNCTION: FN-06
- DESTRUCTIVE: **NO** / REVERSIBLE: NO(売却で45%回収のみ) / CONFIRMATION: **NO**
- DISABLED_CONDITION: 資金不足 / 設置枠なし / 倒産中
- TOUCH_FREQUENCY: MEDIUM
- RELATED_CODE: `pachinko/index.html:1084-1101`

## ACT-11 — 「雇用する (+1人)」

- SCREEN: SCR-04 / STATE(代表): ST-18
- FUNCTION: FN-07
- DESTRUCTIVE: **NO** / REVERSIBLE: YES(解雇) / CONFIRMATION: **NO**
- DISABLED_CONDITION: 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:290,1802`

## ACT-12 — 「解雇する (−1人)」

- SCREEN: SCR-04 / STATE(代表): ST-19
- FUNCTION: FN-08
- DESTRUCTIVE: **NO** / REVERSIBLE: YES(雇用) / CONFIRMATION: **NO**
- DISABLED_CONDITION: staff<=1 / 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:291,1803`

## ACT-13 — 「広告プラン(4種)」

- SCREEN: SCR-04 / STATE(代表): ST-22
- FUNCTION: FN-09
- DESTRUCTIVE: **NO** / REVERSIBLE: YES(営業前まで) / CONFIRMATION: **NO**
- DISABLED_CONDITION: 倒産中
- TOUCH_FREQUENCY: MEDIUM
- RELATED_CODE: `pachinko/index.html:1126-1132`

## ACT-14 — 「フェアを開催する」

- SCREEN: SCR-04 / STATE(代表): ST-23
- FUNCTION: FN-10
- DESTRUCTIVE: **NO** / REVERSIBLE: NO(費用は戻らない) / CONFIRMATION: **NO**
- DISABLED_CONDITION: 条件未達 / CD中 / 資金不足 / 予約済 / 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:302,1812`

## ACT-15 — 「+5台 拡張する」

- SCREEN: SCR-04 / STATE(代表): ST-28
- FUNCTION: FN-11
- DESTRUCTIVE: **NO** / REVERSIBLE: NO / CONFIRMATION: **NO**
- DISABLED_CONDITION: 資金不足 / 上限60 / 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:308,1804`

## ACT-16 — 「借りる (+100万)」

- SCREEN: SCR-04 / STATE(代表): ST-31
- FUNCTION: FN-12
- DESTRUCTIVE: **NO** / REVERSIBLE: YES(返済) / CONFIRMATION: **NO**
- DISABLED_CONDITION: 枠上限 / 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:318,1822`

## ACT-17 — 「返済する (−100万)」

- SCREEN: SCR-04 / STATE(代表): ST-32
- FUNCTION: FN-13
- DESTRUCTIVE: **NO** / REVERSIBLE: YES(借入) / CONFIRMATION: **NO**
- DISABLED_CONDITION: 残高なし / 資金不足 / 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:319,1830`

## ACT-18 — 「交換率(2種)」

- SCREEN: SCR-04 / STATE(代表): ST-33
- FUNCTION: FN-14
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: 倒産中
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1155-1162`

## ACT-19 — 「セーブ」

- SCREEN: SCR-04 / STATE(代表): ST-01
- FUNCTION: FN-15
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:340,1839`

## ACT-20 — 「最初からやり直す」

- SCREEN: SCR-04 / STATE(代表): ST-40
- FUNCTION: FN-16
- DESTRUCTIVE: **YES** / REVERSIBLE: NO / CONFIRMATION: **YES(confirm)**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: VERY_LOW
- RELATED_CODE: `pachinko/index.html:341,1840`

## ACT-21 — 「閉じる(結果)」

- SCREEN: SCR-07 / STATE(代表): ST-44
- FUNCTION: FN-28
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: 倒産中は提示されない
- TOUCH_FREQUENCY: VERY_HIGH(毎日)
- RELATED_CODE: `pachinko/index.html:1333`

## ACT-22 — 「わかった(台0台案内)」

- SCREEN: SCR-09 / STATE(代表): ST-06
- FUNCTION: FN-28
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: VERY_LOW
- RELATED_CODE: `pachinko/index.html:1794`

## ACT-23 — 「最初からやり直す(倒産)」

- SCREEN: SCR-08 / STATE(代表): ST-47
- FUNCTION: FN-16
- DESTRUCTIVE: **YES** / REVERSIBLE: NO / CONFIRMATION: **NO(倒産後の唯一手段)**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: VERY_LOW
- RELATED_CODE: `pachinko/index.html:1281,1314`

## ACT-24 — 「のんびり/標準/修羅」

- SCREEN: SCR-06 / STATE(代表): ―
- FUNCTION: FN-27
- DESTRUCTIVE: **NO** / REVERSIBLE: NO / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: VERY_LOW(開始時)
- RELATED_CODE: `pachinko/index.html:1770-1774`

## ACT-25 — 「背景操作で閉じる」

- SCREEN: SCR-07 / STATE(代表): ST-44
- FUNCTION: FN-28
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: 倒産中は閉じない
- TOUCH_FREQUENCY: MEDIUM
- RELATED_CODE: `pachinko/index.html:1297`

## ACT-26 — 「レバーON (3枚)」

- SCREEN: SCR-10 / STATE(代表): ST-48
- FUNCTION: FN-29
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: 回転中 / メダル3枚未満
- TOUCH_FREQUENCY: VERY_HIGH(遊技中)
- RELATED_CODE: `pachinko/index.html:1487`

## ACT-27 — 「STOP ×3」

- SCREEN: SCR-10 / STATE(代表): ST-49
- FUNCTION: FN-30
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: 未回転
- TOUCH_FREQUENCY: VERY_HIGH(遊技中)
- RELATED_CODE: `pachinko/index.html:1488`

## ACT-28 — 「試打設定(スロット)」

- SCREEN: SCR-10 / STATE(代表): ST-48
- FUNCTION: FN-31
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1489`

## ACT-29 — 「メダル補充 (+500)」

- SCREEN: SCR-10 / STATE(代表): ST-53
- FUNCTION: FN-32
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1490`

## ACT-30 — 「試打を終える」

- SCREEN: SCR-10 / STATE(代表): ST-48
- FUNCTION: FN-28
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: MEDIUM
- RELATED_CODE: `pachinko/index.html:1389,1533`

## ACT-31 — 「回す」

- SCREEN: SCR-11 / STATE(代表): ST-54
- FUNCTION: FN-33
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: 回転中 / 玉不足
- TOUCH_FREQUENCY: VERY_HIGH(遊技中)
- RELATED_CODE: `pachinko/index.html:1631`

## ACT-32 — 「オート」

- SCREEN: SCR-11 / STATE(代表): ST-54
- FUNCTION: FN-35
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1632`

## ACT-33 — 「釘(設定)」

- SCREEN: SCR-11 / STATE(代表): ST-54
- FUNCTION: FN-36
- DESTRUCTIVE: **NO** / REVERSIBLE: YES / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1640`

## ACT-34 — 「玉補充 (+1000)」

- SCREEN: SCR-11 / STATE(代表): ST-61
- FUNCTION: FN-36
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: なし
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1641`

## ACT-35 — 「推移上の個別日を参照」

- SCREEN: SCR-05 / STATE(代表): ST-42
- FUNCTION: FN-22
- DESTRUCTIVE: **NO** / REVERSIBLE: ― / CONFIRMATION: **NO**
- DISABLED_CONDITION: 履歴0件
- TOUCH_FREQUENCY: LOW
- RELATED_CODE: `pachinko/index.html:1240-1250`

## 画面ごとの PRIMARY ACTION(明示)

| SCREEN_ID | PRIMARY ACTION |
|---|---|
| SCR-01 (`SHELL (persistent chrome)`) | 1営業日を実行する(btnOpen) |
| SCR-02 (`panel-hall`) | 台ごとの出玉設定変更 |
| SCR-03 (`panel-shop`) | 新台の購入 |
| SCR-04 (`panel-mgmt`) | 経営施策の選択(広告/フェア/融資/交換率/拡張/人員) |
| SCR-05 (`panel-ledger`) | なし(閲覧のみ) |
| SCR-06 (`modal:tutorial`) | 難易度を選んで開始(3択) |
| SCR-07 (`modal:day-result`) | 閉じて経営へ戻る |
| SCR-08 (`modal:bankrupt`) | 最初からやり直す |
| SCR-09 (`modal:no-machine`) | 了解して戻る |
| SCR-10 (`modal:trial-slot`) | レバーON(遊技開始) |
| SCR-11 (`modal:trial-pachinko`) | 回す(1回転) |
| SCR-12 (`overlay:toast`) | なし(自動消滅) |

## 破壊的操作(確認を必須とするもの)

| ACTION_ID | ラベル | 確認 | 根拠 |
|---|---|---|---|
| ACT-08 | 売却(台ごと) | YES(confirm) | `pachinko/index.html:1043-1052` |
| ACT-20 | 最初からやり直す | YES(confirm) | `pachinko/index.html:341,1840` |
| ACT-23 | 最初からやり直す(倒産) | NO(倒産後の唯一手段) | `pachinko/index.html:1281,1314` |

ACT-23(倒産後のやり直し)は確認を持たないが、これは倒産状態からの唯一の復帰手段であり、
他の操作がすべて封鎖された状態で提示されるため(P-03)。

**TOTAL_ACTIONS = 35**
