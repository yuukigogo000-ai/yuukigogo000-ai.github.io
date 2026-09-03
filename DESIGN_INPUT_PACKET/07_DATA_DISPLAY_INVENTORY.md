# 07_DATA_DISPLAY_INVENTORY

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_DATA_FIELDS: **62**

UIに実際に表示されている、または表示可能な実在データのみを列挙した。
デザイン参照画像に存在した項目を根拠に追加してはいない。
MAX_REALISTIC_LENGTH は書式適用後の日本語表示幅の目安(全角換算)。

## D-01 — 営業日

- TYPE: integer / UNIT: 日
- RANGE: 1〜1,000,000(保存時クランプ)
- FORMAT: N日目 + 特日/週末の別
- SOURCE: `state.day / pachinko/index.html:988,1663`
- UPDATE_TIMING: 1営業日実行ごと
- SCREEN: SCR-01
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約12字

## D-02 — 資金

- TYPE: integer / UNIT: 円
- RANGE: -1e13〜1e13(保存時クランプ)。負値で倒産
- FORMAT: ¥ + 3桁区切り
- SOURCE: `state.money / pachinko/index.html:989,1664,623`
- UPDATE_TIMING: 営業実行・購入・売却・融資・拡張ごと
- SCREEN: SCR-01
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-03 — 評判

- TYPE: number / UNIT: なし(0-100尺度)
- RANGE: 1〜100
- FORMAT: 整数 / 100
- SOURCE: `state.rep / pachinko/index.html:990,906,1665`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-01
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 9字

## D-04 — 常連客数

- TYPE: number / UNIT: 人
- RANGE: 0〜100000(保存時)。実質は収容力×0.5が上限
- FORMAT: 整数+人
- SOURCE: `state.regulars / pachinko/index.html:991,885-891,1666`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-01
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約8字

## D-05 — 設置台数 / 最大設置数

- TYPE: integer / UNIT: 台
- RANGE: 0〜60 / 10〜60
- FORMAT: N / M
- SOURCE: `machines.length, state.cap / pachinko/index.html:992`
- UPDATE_TIMING: 購入・売却・拡張ごと
- SCREEN: SCR-01
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 7字

## D-06 — 借入残高

- TYPE: integer / UNIT: 円
- RANGE: 0〜1e12。0のとき「なし」表記
- FORMAT: ¥+区切り または なし
- SOURCE: `state.debt / pachinko/index.html:993,1668`
- UPDATE_TIMING: 借入・返済・緊急融資ごと
- SCREEN: SCR-01
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-07 — 純資産

- TYPE: integer / UNIT: 円
- RANGE: 下限なし(資金+台資産-借金)
- FORMAT: ¥+区切り
- SOURCE: `totalAssets() / pachinko/index.html:676,994`
- UPDATE_TIMING: 上記いずれかの更新時
- SCREEN: SCR-01
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-08 — 今週のブーム名

- TYPE: string / UNIT: なし
- RANGE: TRENDS の7種のいずれか
- FORMAT: 「今週:「名称」」
- SOURCE: `state.trend.name / pachinko/index.html:433-441,996`
- UPDATE_TIMING: 7日ごと(day%7===1)
- SCREEN: SCR-01
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(trend=null時は非表示)
- MAX_REALISTIC_LENGTH: 約16字

## D-09 — 機種名

- TYPE: string / UNIT: なし
- RANGE: CATALOG 10種
- FORMAT: そのまま
- SOURCE: `CATALOG[].name / pachinko/index.html:398-421`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-02,SCR-03
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 13字(最長: P究極神威ゴッドラッシュ)

## D-10 — 機種の説明文

- TYPE: string / UNIT: なし
- RANGE: CATALOG 10種
- FORMAT: そのまま
- SOURCE: `CATALOG[].desc / pachinko/index.html:398-421`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-02,SCR-03
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 16字

## D-11 — 機種スペック表記

- TYPE: string / UNIT: なし
- RANGE: CATALOG 10種
- FORMAT: そのまま
- SOURCE: `CATALOG[].spec.label / pachinko/index.html:398-421`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-02,SCR-03
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 20字(甘デジ 1/99・RUSH継続50%)

## D-12 — 台の現在人気

- TYPE: number / UNIT: なし(0-300尺度)
- RANGE: 15〜300(実運用は15〜165程度)
- FORMAT: 整数 + 比率表現
- SOURCE: `machine.pop / pachinko/index.html:689,860,1043,1690`
- UPDATE_TIMING: 営業実行ごとに機種別decayで低下
- SCREEN: SCR-02
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 3字

## D-13 — 台の前日収支(店側)

- TYPE: integer / UNIT: 円
- RANGE: 負値あり
- FORMAT: +/- ¥+区切り
- SOURCE: `machine.lastNet / pachinko/index.html:858,1014-1015`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-02,SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: YES(未営業時)
- MAX_REALISTIC_LENGTH: 約16字

## D-14 — 台の前日客数

- TYPE: integer / UNIT: 人
- RANGE: 0以上
- FORMAT: 客N人
- SOURCE: `machine.lastCust / pachinko/index.html:859,1015`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-02
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(未営業時)
- MAX_REALISTIC_LENGTH: 約7字

## D-15 — 台の売却額

- TYPE: integer / UNIT: 円
- RANGE: 購入価格×0.45 = 180,000〜652,500
- FORMAT: ¥+区切り
- SOURCE: `machineValue() / pachinko/index.html:674,1016`
- UPDATE_TIMING: 不変(機種依存)
- SCREEN: SCR-02
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約10字

## D-16 — 台の現在設定

- TYPE: integer / UNIT: 段階
- RANGE: 1〜6
- FORMAT: 設定N
- SOURCE: `machine.setting / pachinko/index.html:1031-1039,1689`
- UPDATE_TIMING: 設定変更ごと
- SCREEN: SCR-02,SCR-07
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 4字

## D-17 — 台の状態標識

- TYPE: string[] / UNIT: なし
- RANGE: ブーム中 / シマ+N% / プロ警戒(最大3件同時)
- FORMAT: 記号+短語
- SOURCE: `pachinko/index.html:1019-1023`
- UPDATE_TIMING: 営業実行・設定変更・購入売却ごと
- SCREEN: SCR-02
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(該当なし時)
- MAX_REALISTIC_LENGTH: 約20字

## D-18 — 新台標識

- TYPE: boolean / UNIT: なし
- RANGE: 導入から5日未満
- FORMAT: 短語(NEW)
- SOURCE: `pachinko/index.html:1011,1025`
- UPDATE_TIMING: 日進行で失効
- SCREEN: SCR-02
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 3字

## D-19 — 機種の集客力

- TYPE: integer / UNIT: なし
- RANGE: 50〜118
- FORMAT: 集客力 N
- SOURCE: `CATALOG[].pop / pachinko/index.html:398-421,1073`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-03
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 3字

## D-20 — 機種の人気低下の速さ

- TYPE: string / UNIT: なし
- RANGE: 遅い / 普通 / 速い(decay 0.4〜2.0)
- FORMAT: 3段階の語
- SOURCE: `CATALOG[].decay / pachinko/index.html:1073`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-03
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 2字

## D-21 — 機種の価格

- TYPE: integer / UNIT: 円
- RANGE: 400,000〜1,450,000
- FORMAT: ¥+区切り
- SOURCE: `CATALOG[].price / pachinko/index.html:398-421,1075`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-03
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約10字

## D-22 — 自店の同一機種設置数

- TYPE: integer / UNIT: 台
- RANGE: 1〜60
- FORMAT: 設置中×N
- SOURCE: `pachinko/index.html:1062,1070`
- UPDATE_TIMING: 購入・売却ごと
- SCREEN: SCR-03
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(0台時は非表示)
- MAX_REALISTIC_LENGTH: 約8字

## D-23 — スタッフ数と日給合計

- TYPE: integer / UNIT: 人 / 円
- RANGE: 1〜200 / 13,000×人数
- FORMAT: N人 (日給計 ¥…)
- SOURCE: `state.staff / pachinko/index.html:1110,868`
- UPDATE_TIMING: 雇用・解雇ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約22字

## D-24 — 必要スタッフ数

- TYPE: integer / UNIT: 人
- RANGE: ceil(台数/8) の下限1
- FORMAT: N人 + 充足/不足の別
- SOURCE: `staffNeeded() / pachinko/index.html:680,1112`
- UPDATE_TIMING: 購入・売却ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約12字

## D-25 — 広告プラン名と費用

- TYPE: string+integer / UNIT: 円
- RANGE: 4種 / 0〜250,000
- FORMAT: 名称 (¥費用)
- SOURCE: `ADS / pachinko/index.html:425-430,1128`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-04
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約20字

## D-26 — 広告の効果表記

- TYPE: string / UNIT: 人 / %
- RANGE: +12〜75人 / 4〜15%
- FORMAT: 客数 +N人 + 集客率N%ブースト
- SOURCE: `ADS[].flat/.pct / pachinko/index.html:1142`
- UPDATE_TIMING: 選択ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約34字

## D-27 — フェアの可否と理由

- TYPE: string / UNIT: なし
- RANGE: 5種(開催可 / 予約済 / 直後のみ / 残りN日 / 資金不足)
- FORMAT: 短文
- SOURCE: `pachinko/index.html:1145-1153`
- UPDATE_TIMING: 状態変化ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約20字

## D-28 — 最大設置数

- TYPE: integer / UNIT: 台
- RANGE: 10〜60(上限到達表記あり)
- FORMAT: N台 (+最大)
- SOURCE: `state.cap / pachinko/index.html:1116`
- UPDATE_TIMING: 拡張ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約9字

## D-29 — 拡張費用

- TYPE: integer / UNIT: 円
- RANGE: 2,000,000〜5,000,000
- FORMAT: ¥+区切り
- SOURCE: `expandCost() / pachinko/index.html:1107,1121`
- UPDATE_TIMING: 拡張ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約10字

## D-30 — 借入可能枠

- TYPE: integer / UNIT: 円
- RANGE: 2,000,000〜(台資産×0.7+200万)
- FORMAT: ¥+区切り
- SOURCE: `creditLimit() / pachinko/index.html:677,1156`
- UPDATE_TIMING: 購入・売却・借入ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-31 — 金利

- TYPE: string / UNIT: %/日
- RANGE: 0.25% 固定
- FORMAT: 0.25% / 日 (経費に計上)
- SOURCE: `pachinko/index.html:316,870`
- UPDATE_TIMING: 不変(静的)
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約22字

## D-32 — 交換率ポリシー

- TYPE: string / UNIT: なし
- RANGE: 等価交換 / 低換金 (5.6枚)
- FORMAT: 名称+説明
- SOURCE: `state.rate / pachinko/index.html:1163-1172`
- UPDATE_TIMING: 切替ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約13字

## D-33 — 行政・組合の警戒度

- TYPE: number / UNIT: なし(0-12尺度で表現)
- RANGE: 0〜200(保存時)。表現上は0〜12を100%に対応
- FORMAT: 比率表現 + 3段階の説明文
- SOURCE: `state.heat / pachinko/index.html:793-799,1174-1179`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約46字(説明文)

## D-34 — 実績(名称/条件/解除状態)

- TYPE: object[] / UNIT: なし
- RANGE: 15件固定
- FORMAT: 名称+説明+解除状態
- SOURCE: `ACHIEVEMENTS, state.ach / pachinko/index.html:604-620,1180-1192`
- UPDATE_TIMING: 条件成立ごと
- SCREEN: SCR-04
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 名称6字/説明24字

## D-35 — 帳簿: 日

- TYPE: integer / UNIT: 日
- RANGE: 1〜
- FORMAT: N日目
- SOURCE: `history[].day / pachinko/index.html:1262`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約7字

## D-36 — 帳簿: 客数

- TYPE: integer / UNIT: 人
- RANGE: 0〜(収容力×1.15が上限)
- FORMAT: N人
- SOURCE: `history[].cust / pachinko/index.html:1262`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約7字

## D-37 — 帳簿: 一般/常連/プロの内訳

- TYPE: integer×3 / UNIT: 人
- RANGE: 各0以上
- FORMAT: N / N / N
- SOURCE: `history[].cas,reg,pro / pachinko/index.html:1263`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05,SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(旧セーブは-表示)
- MAX_REALISTIC_LENGTH: 約14字

## D-38 — 帳簿: 売上

- TYPE: integer / UNIT: 円
- RANGE: 0以上
- FORMAT: ¥+区切り
- SOURCE: `history[].sales / pachinko/index.html:1264`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05,SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-39 — 帳簿: 出玉払出

- TYPE: integer / UNIT: 円
- RANGE: 負値もあり得る(粗利が負のとき売上超)
- FORMAT: ¥+区切り
- SOURCE: `history[].payout / pachinko/index.html:864,1264`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05,SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-40 — 帳簿: 経費

- TYPE: integer / UNIT: 円
- RANGE: 0以上(家賃+人件費+光熱費+広告+臨時+利息)
- FORMAT: ¥+区切り
- SOURCE: `history[].exp / pachinko/index.html:871,1264`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05,SCR-07
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-41 — 帳簿: 純利益

- TYPE: integer / UNIT: 円
- RANGE: 負値あり
- FORMAT: +/- ¥+区切り
- SOURCE: `history[].net / pachinko/index.html:874,1265`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05,SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-42 — 帳簿: 備考

- TYPE: string / UNIT: なし
- RANGE: 特日 / 週末 / 空
- FORMAT: 短語
- SOURCE: `history[].note / pachinko/index.html:925,1266`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(平日は空)
- MAX_REALISTIC_LENGTH: 2字

## D-43 — 損益推移(直近30日)

- TYPE: integer[] / UNIT: 円
- RANGE: 負値あり。最大/最小/0の3基準線
- FORMAT: 比率表現 + 万単位ラベル
- SOURCE: `renderChart() / pachinko/index.html:1194-1239`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-05
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: ラベル約8字

## D-44 — 推移の個別日詳細

- TYPE: string / UNIT: 円
- RANGE: ―
- FORMAT: N日目: +/-¥金額
- SOURCE: `pachinko/index.html:1243-1244`
- UPDATE_TIMING: ポイント時
- SCREEN: SCR-05
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約24字

## D-45 — 当日の発生イベント文

- TYPE: string[] / UNIT: なし
- RANGE: 130種+システム文。1日0〜複数件
- FORMAT: 短文
- SOURCE: `LUCK_EVENTS/COND_EVENTS / pachinko/index.html:450-601,1302`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-07
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(0件あり)
- MAX_REALISTIC_LENGTH: 29字(絵文字除く実測)

## D-46 — 当日の利息

- TYPE: integer / UNIT: 円
- RANGE: 0以上
- FORMAT: (利息¥…含む)
- SOURCE: `history[].interest / pachinko/index.html:870,1328`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-47 — 台別の店側収支一覧

- TYPE: object[] / UNIT: 円
- RANGE: 台数分。降順
- FORMAT: 機種名 [設定N] +/-¥金額
- SOURCE: `pachinko/index.html:1303-1309`
- UPDATE_TIMING: 営業実行ごと
- SCREEN: SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約34字/行

## D-48 — 週間純利益

- TYPE: integer / UNIT: 円
- RANGE: 負値あり
- FORMAT: +/- ¥+区切り
- SOURCE: `weeklyReport() / pachinko/index.html:957,981`
- UPDATE_TIMING: 7日ごと
- SCREEN: SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約16字

## D-49 — 週間平均客数

- TYPE: integer / UNIT: 人
- RANGE: 0以上
- FORMAT: N人/日
- SOURCE: `pachinko/index.html:958,982`
- UPDATE_TIMING: 7日ごと
- SCREEN: SCR-07
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約8字

## D-50 — 週次の助言

- TYPE: string[] / UNIT: なし
- RANGE: 8条件のうち成立分。0件時は既定文1件
- FORMAT: 短文
- SOURCE: `weeklyReport() / pachinko/index.html:962-978`
- UPDATE_TIMING: 7日ごと
- SCREEN: SCR-07
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約46字

## D-51 — クリア評価ランク

- TYPE: string / UNIT: なし
- RANGE: S(<=65日) / A(<=85) / B(<=120) / C
- FORMAT: 1文字 + 基準の併記
- SOURCE: `clearRank() / pachinko/index.html:951,1316-1318`
- UPDATE_TIMING: クリア到達日のみ
- SCREEN: SCR-07
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(未達成時)
- MAX_REALISTIC_LENGTH: 1字

## D-52 — スロット: 所持メダル

- TYPE: integer / UNIT: 枚
- RANGE: 0以上(補充で+500)
- FORMAT: 整数+枚
- SOURCE: `t.credits / pachinko/index.html:1398,1435`
- UPDATE_TIMING: 1G・補充ごと
- SCREEN: SCR-10
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約6字

## D-53 — スロット: 総ゲーム数

- TYPE: integer / UNIT: G
- RANGE: 0以上
- FORMAT: 整数+G
- SOURCE: `t.games / pachinko/index.html:1399,1436`
- UPDATE_TIMING: 1Gごと
- SCREEN: SCR-10
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約6字

## D-54 — スロット: BIG/REG回数

- TYPE: integer×2 / UNIT: 回
- RANGE: 0以上
- FORMAT: 整数
- SOURCE: `t.bb,t.rb / pachinko/index.html:1400-1401,1467-1468`
- UPDATE_TIMING: 当選ごと
- SCREEN: SCR-10
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約4字

## D-55 — スロット: 差枚

- TYPE: integer / UNIT: 枚
- RANGE: 負値あり
- FORMAT: +/-整数
- SOURCE: `t.diff / pachinko/index.html:1402,1481`
- UPDATE_TIMING: 1G・当選ごと
- SCREEN: SCR-10
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約7字

## D-56 — スロット: 直前の結果文

- TYPE: string / UNIT: 枚
- RANGE: BIG/REG/小役/リプレイ/なし
- FORMAT: 記号+短文+獲得枚数
- SOURCE: `pachinko/index.html:1467-1472`
- UPDATE_TIMING: 1Gごと
- SCREEN: SCR-10
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(ハズレ時は空)
- MAX_REALISTIC_LENGTH: 約18字

## D-57 — パチンコ: 持ち玉

- TYPE: integer / UNIT: 玉
- RANGE: 0以上(補充で+1000)
- FORMAT: 整数
- SOURCE: `t.balls / pachinko/index.html:1541,1560`
- UPDATE_TIMING: 1回転・当選・補充ごと
- SCREEN: SCR-11
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約6字

## D-58 — パチンコ: 回転数

- TYPE: integer / UNIT: 回転
- RANGE: 0以上
- FORMAT: 整数+回転
- SOURCE: `t.spins / pachinko/index.html:1542,1560`
- UPDATE_TIMING: 1回転ごと
- SCREEN: SCR-11
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約7字

## D-59 — パチンコ: 当り回数 / 最高連チャン

- TYPE: integer×2 / UNIT: 回 / 連
- RANGE: 0以上
- FORMAT: 整数 / 最高N連
- SOURCE: `t.hits,t.maxRen / pachinko/index.html:1543-1544,1599,1621`
- UPDATE_TIMING: 当選・RUSH終了ごと
- SCREEN: SCR-11
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約8字

## D-60 — パチンコ: 差玉

- TYPE: integer / UNIT: 玉
- RANGE: 負値あり
- FORMAT: +/-整数
- SOURCE: `t.balls-t.startBalls / pachinko/index.html:1545-1546`
- UPDATE_TIMING: 1回転・当選ごと
- SCREEN: SCR-11
- CAN_BE_ZERO: YES / CAN_BE_NEGATIVE: YES / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約8字

## D-61 — パチンコ: RUSH連チャン表記

- TYPE: string / UNIT: 玉
- RANGE: 1連〜(継続率依存で上限なし)
- FORMAT: RUSH N連!! +N玉 / RUSH終了 (N連 / +N玉)
- SOURCE: `pachinko/index.html:1610-1620`
- UPDATE_TIMING: 当選中
- SCREEN: SCR-11
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: YES(非当選時)
- MAX_REALISTIC_LENGTH: 約34字

## D-62 — 解除した実績名(一時通知)

- TYPE: string / UNIT: なし
- RANGE: 15件のいずれか
- FORMAT: 記号+実績解除+名称
- SOURCE: `pachinko/index.html:704`
- UPDATE_TIMING: 条件成立ごと
- SCREEN: SCR-12
- CAN_BE_ZERO: NO / CAN_BE_NEGATIVE: NO / CAN_BE_NULL: NO
- MAX_REALISTIC_LENGTH: 約20字

## 注意すべき値域(デザイン上の含意)

- **負値を取り得る**: 資金(D-02) / 純資産(D-07) / 台の前日収支(D-13) / 出玉払出(D-39) / 純利益(D-41) /
  損益推移(D-43) / 週間純利益(D-48) / 差枚(D-55) / 差玉(D-60)
- **null を取り得る**: 台の前日収支・前日客数(未営業時) / 備考(平日) / ブーム名(trend未設定) /
  クリア評価(未達成) / 状態標識(該当なし) / 一般常連プロの内訳(旧セーブ)
- **最長の文字列**: 機種名13字(P究極神威ゴッドラッシュ) / スペック表記20字 / イベント文29字 /
  警戒度の説明46字 / 週次の助言46字
- **最大件数**: 台60件 / 帳簿60行×8列 / 推移30点 / 実績15件 / カタログ10件

**TOTAL_DATA_FIELDS = 62**
