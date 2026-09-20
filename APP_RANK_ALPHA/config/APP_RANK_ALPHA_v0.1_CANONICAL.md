APP RANK ALPHA v0.1

CANONICAL RESEARCH & IMPLEMENTATION SPEC

Status: DESIGN FREEZE CANDIDATE
Purpose: Japanese listed mobile-game equity alpha discovery
Primary data: Japan App Store / Google Play Top Grossing + JPX market data
Implementation owner: Claude Code
Research authority: this specification

⸻

0. MISSION

本システムの目的は、

「セルランが上がった株を買う」

ことではない。

目的は、

アプリ課金ランキングから企業業績に関係する実需変化を抽出し、その情報が株価へ完全に反映されるまでに統計的・経済的に利用可能な遅延が存在するかを検証すること

である。

検証対象を以下の4 Familyに固定する。

A. NEW LAUNCH / NEW MONETIZATION
B. QUARTER-TO-DATE PORTFOLIO NOWCAST
C. EXISTING TITLE POSITIVE SHOCK
D. PORTFOLIO DETERIORATION

最重要FamilyはB。

優先順位:

B > A > D > C

⸻

1. FUNDAMENTAL PRINCIPLE

Alpha候補は以下の構造を満たさなければならない。

App Monetization Change
→
Listed Company Economic Exposure
→
Future Operating Performance
→
Market Underreaction
→
Net Tradable Return

以下は禁止。

Rank上昇
→
株価上昇

という単純相関だけでAlpha認定すること。

⸻

2. SCOPE

v0.1では以下だけ扱う。

Country:
Japan

Stores:
Apple App Store
Google Play

Chart:
Grossing

Category:
Games

Market:
Tokyo Stock Exchange listed equities

Frequency:
Daily

Primary strategy:
Long-horizon / earnings-nowcast

Intraday:
Primaryでは使用しない。

Revenue Estimate:
Primaryでは使用しない。

Machine Learning:
Primaryでは使用しない。

海外セルラン:
Primaryでは使用しない。

これらはv0.2以降。

⸻

3. FAIL-CLOSED RULE

不明なものをClaude Codeが推測してはいけない。

以下の場合は必ずSTOPまたは該当データを除外する。

* AppTweak API仕様不明
* category ID不明
* historical availability不明
* app ID mapping不明
* publisher不明
* listed parent不明
* economic ownership不明
* ticker effective date不明
* release date不明
* ranking取得失敗
* API response incomplete
* stock listing status不明
* fiscal quarter不明
* corporate action処理不能
* timezone不明
* data known-at不明
* future information contamination

推測値を0として埋めてはいけない。

⸻

4. VERSION FREEZE

本仕様を

/config/APP_RANK_ALPHA_v0.1_CANONICAL.md

として保存。

SHA256を計算し、

/config/SPEC_SHA256.txt

へ保存。

Backtest開始後、Claude Code自身が仕様を変更してはいけない。

変更が必要な場合は、

/change_requests/SPEC_CHANGE_REQUEST_XXX.md

へ提案を書く。

Canonical Specは人間の明示承認なしに変更禁止。

⸻

5. DATA SOURCES

5.1 App rankings

Primary:

AppTweak Top Charts History API

固定パラメータ:

country = JP
type = grossing
device = iphone / android
category = Games
limit = 200

category IDはdocumentationから毎回検証する。

ハードコードする場合も、
初回doctorで現在の公式値と一致することを確認する。

⸻

5.2 Market data

Primary:

J-Quants

必要データ:

* historical listed issue master
* adjusted/unadjusted OHLC
* volume
* financial information
* earnings announcement date
* trading calendar
* TOPIX

Minute/Tickはv0.1 Primaryでは不要。

⸻

5.3 Corporate data

Priority:

1. company official IR
2. TDnet
3. official app-store metadata
4. official publisher website

第三者記事だけでeconomic mappingを確定してはいけない。

⸻

6. API COST SAFETY

全API処理は

DRY RUN
→
COST ESTIMATE
→
EXECUTION

の順。

以下を実装。

MAX_APPTWEAK_CREDITS_PER_RUN
MAX_APPTWEAK_CREDITS_PER_DAY
MAX_APPTWEAK_CREDITS_TOTAL

default:

per run = 2,000
per day = 5,000
trial total = 18,000

残り2,000 creditsは事故用bufferとして確保。

上限を超える場合は実行禁止。

⸻

7. PHASE 0 — DATA FEASIBILITY PROBE

大量取得前に以下のみ取得。

iOS Japan Games Grossing:
複数の代表日

Android Japan Games Grossing:
複数の代表日

probe years:

2014
2015
2016
…
2026

各年1月・7月程度のsmall requestを使い、

* earliest available date
* latest available date
* missing periods
* rank depth
* response schema
* API credit actual cost

を確認。

API responseにあるactual request costを保存。

⸻

8. HISTORY REQUIREMENT

Primary long-history testには、

iOS / Android共通期間で最低

TRAIN >= 48 months
VALIDATION >= 24 months
HOLDOUT >= 12 months

必要。

不足なら

INSUFFICIENT_HISTORY

とする。

確認できた最古日を勝手に外挿しない。

⸻

9. DATA SPLIT

十分な履歴がある場合、

TRAIN:
earliest common usable date
through
2021-12-31

VALIDATION:
2022-01-01
through
2024-12-31

FINAL HOLDOUT:
2025-01-01
through
2026-08-31

とする。

TRAIN/VALIDATION中はHoldoutデータを読み込んではならない。

⸻

10. HOLDOUT LOCK

通常実行:

–mode train_validation

の場合、

2025-01-01以降のstock returnsおよびrank featuresを読み込み禁止。

Holdoutを開くには、

app-alpha unlock-holdout

を明示実行。

その際、

* Spec SHA
* code git commit
* candidate rule SHA
* timestamp

を記録。

Holdoutを一度開いた後にparameter変更した戦略は、

新しい研究Versionとして扱う。

v0.1のHoldout再利用は禁止。

⸻

11. APP UNIVERSE

現在存在する有名ゲームを手で選んではならない。

まずTop Grossing historyそのものから、

historical app IDs

を抽出する。

したがって、

today's winners only

というsurvivorship biasを回避する。

Delisted appsも可能な限り保持。

⸻

12. TOP-200 CENSORING

Grossing rank:

1–200:
observed

rank outside Top200:
censored

とする。

API failureとTop200圏外を区別する。

APP_EXISTS_AND_NOT_TOP200
と
DATA_MISSING

を同じ0にしてはいけない。

⸻

13. APP REGISTRY

/app_registry/apps.parquet

最低限:

app_entity_id
store
store_app_id
title
publisher
first_seen
last_seen
verified_release_date
release_confidence
delisted_date
country
platform
source
retrieved_at

iOS / Androidの同一ゲームには
共通app_entity_idを割り当てる。

タイトル名だけで自動merge禁止。

⸻

14. ECONOMIC OWNERSHIP REGISTRY

最重要テーブル。

/registry/ownership_history.parquet

columns:

app_entity_id
publisher_entity
listed_company_code
listed_company_name
effective_from
effective_to
relationship_type
economic_rights_description
mapping_confidence
evidence_source
evidence_date
verified_at

mapping confidence:

A:
official sourceで上場会社への経済的帰属が明確

B:
関連性は強いが収益帰属が完全には明確でない

C:
名称/IP等からの推測

PrimaryはAのみ。

B/CはPrimaryから除外。

⸻

15. PUBLISHER TRANSFER

現在のpublisherを過去へbackfill禁止。

ゲーム譲渡、
事業譲渡、
子会社売却、
publisher変更

があった場合、

effective_from / effective_to

でpoint-in-time管理。

signal date時点の所有者だけ使用。

⸻

16. LISTED COMPANY SURVIVORSHIP

現在上場している会社だけでUniverseを作らない。

J-Quants historical listed masterを使い、

signal date時点で上場していた会社を使用。

上場廃止企業も可能な限り含める。

現在のtickerを過去へ機械的に適用しない。

⸻

17. MATERIALITY

Universeを2層に分ける。

U1 — BROAD

Mapping Confidence A
かつ
signal date時点で日本上場。

U2 — HIGH MOBILE EXPOSURE

U1に加えて、

signal dateより前に公開された公式資料から、

mobile-game関連売上が
consolidated revenueの20%以上

と確認できる企業。

または、

公式開示から実質的にmobile gameが主力事業であることを
定量的に確認できる企業。

数値確認不能の場合、

UNKNOWN

としU2には入れない。

Primary Tradable StrategyはU2。

U1はrobustness。

⸻

18. RANK TRANSFORMATION

順位そのものを線形使用しない。

固定変換:

RankPower(r) = ln(201 / r)

for:

1 <= r <= 200

Top200圏外:

0

例:

rank 1:
高スコア

rank 10:
中高スコア

rank 100:
低スコア

rank 200:
ほぼ0

変換式はv0.1 confirmatory testでは変更禁止。

⸻

19. PLATFORM SCORE

各appについて、

iOS RankPower
Android RankPower

を計算。

その日に両platformで配信されていれば:

AppPower =
(iOS + Android) / 2

一方のplatformだけで正式配信されていれば:

利用可能platformのみ。

「配信されているがTop200圏外」は0。

「データ取得失敗」はNA。

NAを0に変換禁止。

⸻

20. COMPANY PORTFOLIO POWER

company c のdate tについて、

PortfolioPower(c,t)

SUM(
AppPower(a,t)
)

where:

app a belongs economically to c
at date t
with Mapping Confidence A.

アプリ数で平均しない。

理由:

企業全体の課金powerを近似するため。

複数ヒットタイトルを持つ会社は合算する。

⸻

21. PRIMARY FAMILY B

QTD PORTFOLIO NOWCAST

本研究の本命。

各企業のactual fiscal quarterを使用。

calendar quarter固定は禁止。

Primary checkpoint:

Fiscal Quarter Day 60

暦日ベース。

quarter startからDay60までの

PortfolioPower

を累積。

QTD_POWER(c,q,60)

を作る。

⸻

22. FAMILY B BASELINE

前年同一fiscal quarterの
同一Day60までを取得。

PY_QTD_POWER

とする。

Raw Growth:

B_RAW =
ln(
(QTD_POWER + 1)
/
(PY_QTD_POWER + 1)
)

ただし、

PY_QTD_POWERが極端に小さく比較不能の場合は、

NEW_MONETIZATION_REGIME

としてBから除外しAへ回す。

⸻

23. FAMILY B STANDARDIZATION

各companyについて、

過去8 quarterの
B_RAW

だけを使用。

未来データ禁止。

B_Z =
(B_RAW - rolling_median)
/
(1.4826 * rolling_MAD)

最低8過去quarter必要。

MAD = 0の場合はsignalなし。

⸻

24. FAMILY B CONFIRMATORY RULE

B_Z >= +1.0

→ LONG candidate

B_Z <= -1.0

→ NEGATIVE candidate

Primary executable v0.1はLONGのみ。

Negative側はpredictive researchとして記録する。

Short売買はv0.2。

⸻

25. FAMILY B ENTRY

Historical Primaryではknown-atを保守的に扱う。

Ranking Date Dのデータは、

最短でもD翌日以降に利用可能だったものとして扱う。

Primary Entry:

必要なDay60データがすべて揃った後の
次のTSE営業日OPEN。

同日朝のrankを使って同日寄りで約定禁止。

⸻

26. FAMILY B EXIT

Primary:

対象quarterの
次回決算発表後、
最初のTSE CLOSE。

決算発表が取引時間内でも、

同日引けか翌営業日かを
timestampに基づいて決定。

timestamp不明なら翌営業日CLOSE。

maximum holding:

80 TSE trading days

80日を超えたら強制exit。

⸻

27. FAMILY B FUNDAMENTAL VALIDATION

単なる株価相関だけでは不十分。

signal B_Zが、

次回報告される

* consolidated revenue growth
* operating profit growth

と正方向に関係するか検証。

U2 subsetをPrimary。

Regression:

FutureOperatingMetric
~
B_Z
+
Company Fixed Effects
+
Fiscal Quarter Fixed Effects

standard errors:

two-way cluster
company
calendar quarter

Primary要求:

coefficient signが正。

p値だけで判断しない。

rank signalのdecileと
future operating resultに
概ねmonotonic relationshipがあること。

⸻

28. FAMILY A

NEW LAUNCH / MONETIZATION BREAKOUT

Launch Familyには

verified release date

が必要。

release confidence AのみPrimary。

Release dateを
first Top200 dateで代用してはいけない。

⸻

29. FAMILY A SUCCESS

Release Day = D0

D0–D2の3日間について、

LAUNCH_AUC3 =
SUM(AppPower)

を計算。

過去の同条件launch cohortだけで
historical percentileを作る。

最低20 past launches必要。

Primary positive:

AUC3 percentile >= 80%

Entry:

D2データknown後の
次TSE OPEN。

Exit:

10 TSE trading days後CLOSE。

⸻

30. FAMILY A FAILURE

Failure判定はSuccessより厳しくする。

対象は、

release前の公式IR等で
当該titleが当年度の重要releaseとして
明示されていたものだけ。

major_launch_confidence = A

D0–D6:

LAUNCH_AUC7

を計算。

Primary failure research signal:

historical percentile <= 20%

または

7日間すべてTop200圏外。

ただし後者は、
全7日ランキング取得が正常だった場合だけ。

Failureはv0.1ではshort実行しない。

future abnormal returnのみ検証。

⸻

31. FAMILY C

EXISTING TITLE POSITIVE SHOCK

app age >= 90 calendar days

のみ。

各appについて、

prior 60 calendar daysのAppPowerから

median
MAD

を計算。

今日をrolling windowへ含めない。

C_Z =
(CurrentPower - Median60)
/
(1.4826*MAD60)

Primary condition:

C_Z >= 2.0

かつ

2 consecutive days

かつ

company PortfolioPowerも
60-day median比 +30%以上。

Entry:

2日目signal known後の次TSE OPEN。

Exit:

5 TSE trading days後CLOSE。

⸻

32. FAMILY D

COMPANY PORTFOLIO DETERIORATION

個別ゲームの低下ではなく
会社全体を見る。

Current7 =
PortfolioPowerの直近7日平均

Baseline60 =
その前60日のmedian

D_RATIO =
Current7 / Baseline60

さらにrolling robust Zを計算。

Primary deterioration:

D_Z <= -2.0

かつ

D_RATIO <= 0.60

かつ

3 consecutive calendar days。

Primaryではpredictive research only。

short executionなし。

Future horizons:

5d
10d
20d

Confirmatory primary horizon:

10 TSE trading days。

⸻

33. CONTAMINATION FLAGS

全signalについて、

以下をStock-Signal単位で記録。

earnings announcement
earnings revision
new game announcement
M&A
capital raise
share buyback
tender offer
stock split
major litigation
large shareholder event
trading halt
limit-up/down
TSE system event

Primary entry日の前後1営業日に

earnings
earnings revision
M&A
capital raise

がある場合、

ISOLATED_ALPHA sampleから除外。

ただしraw resultには残す。

⸻

34. SCHEDULED GAME EVENTS

周年、
大型ガチャ、
コラボ、
イベント等は、

可能なら

scheduled_event_flag

を付ける。

ただしPrimaryで自動除外しない。

理由:

予定イベントそのものではなく、
イベントが市場予想以上に課金を生んだかが重要だから。

別途、

scheduled
vs
unscheduled

subsampleを表示。

⸻

35. MARKET RETURNS

実際のP&L:

Raw Return

統計検証:

Abnormal Return

両方出す。

Abnormal Return Primary:

Stock Return - TOPIX Return

Secondary:

Stock Return

custom Japanese Game Equity Basket

custom basketは
その日時点のeligible U1 stocksから作成。

⸻

36. EXECUTION PRICE

Daily Primary:

Entry = next eligible TSE OPEN

Exit = rule-defined CLOSE

J-Quants adjusted pricesを
return calculationに使用。

raw price / volumeは
liquidity calculationに使用。

corporate action around holding periodは
auditする。

⸻

37. COST MODEL

v0.1 Primary:

round-trip 50 bp

Stress:

75 bp

Extreme:

100 bp

すべてのresultに、

gross
net50
net75
net100

を出す。

手数料0でGO判定禁止。

⸻

38. LIQUIDITY

Primary assumed position:

JPY 1,000,000 per stock

Sensitivity:

JPY 500,000
JPY 3,000,000

ADV20:

signal以前20営業日の
raw yen turnover平均。

future volume禁止。

Primary capacity rule:

OrderValue <= 0.5% ADV20

超過:

CAPACITY_FAIL

1%:

HARD_FAIL

⸻

39. REPEATED SIGNALS

position保有中に
同一方向signalが再発しても

pyramid禁止。

position追加禁止。

既存exit ruleを維持。

同一銘柄について複数Familyが同時発生した場合も、
v0.1ではpositionを重ねない。

Family別backtestでは個別に評価。

Combined portfolioはv0.2。

⸻

40. CONFIRMATORY TRACK

各FamilyのPrimary ruleは上記固定。

結果が悪いから

threshold
entry
exit
rank transform
universe

を変更してはいけない。

Confirmatory resultは必ずそのまま報告。

⸻

41. DISCOVERY TRACK

Confirmatoryとは完全分離。

探索を許すが
有限gridのみ。

許可parameter以外を探索禁止。

⸻

42. DISCOVERY GRID — FAMILY B

Checkpoint:

45
60
75 fiscal days

Z threshold:

0.75
1.00
1.50

Exit:

20 trading days
next earnings
day before next earnings

最大:

27 configurations

⸻

43. DISCOVERY GRID — FAMILY A

Observation:

D1
D3
D7

historical percentile:

80
90

holding:

5d
10d

最大:

12 positive configurations

Failure:

D3
D7

percentile:

10
20

holding:

5d
10d

最大:

8 negative configurations

⸻

44. DISCOVERY GRID — FAMILY C

Z:

1.5
2.0
2.5

persistence:

1
2
3 days

holding:

3
5
10 TSE days

最大:

27 configurations

⸻

45. DISCOVERY GRID — FAMILY D

D_Z:

-1.5
-2.0
-2.5

D_RATIO:

0.50
0.60
0.70

holding:

5
10
20 days

最大:

27 configurations

⸻

46. GLOBAL SEARCH BUDGET

全Family合わせて

MAX_CONFIGURATIONS <= 120

とする。

Claude Codeが勝手に追加parameterを生成禁止。

MLによるfeature search禁止。

Genetic optimization禁止。

Bayesian optimization禁止。

random search禁止。

⸻

47. TRAIN SELECTION

TRAINでは、

candidate discoveryのみ行う。

最低条件:

Net50 mean > 0
minimum sample satisfied
profit not concentrated
signal-return direction sensible

TRAIN Sharpe最大の条件を
単純採用しない。

⸻

48. VALIDATION PROMOTION

各FamilyからHoldoutへ進める候補は

最大1 strategy。

選択基準:

1. Train net positive
2. Validation net positive
3. parameter neighborhood stable
4. low concentration
5. sufficient sample
6. multiple-testing correction surviving

「最もSharpeが高い」
だけを理由に選ばない。

⸻

49. MULTIPLE TESTING

Discovery Trackでは必ず以下を計算。

Benjamini-Hochberg FDR

q <= 0.10

さらに、

Deflated Sharpe Ratio

Probability of Backtest Overfitting

parameter stability

を算出。

PBO計算可能なサンプル数がない場合は、
PBO_UNAVAILABLE

と明示。

勝手な近似禁止。

⸻

50. DEPENDENCE

app-dayやstock-eventを
すべて独立サンプルとして
通常t-testしてはいけない。

イベントreturnsでは、

company
calendar time

の依存を考慮。

block bootstrap:

calendar month単位をPrimary。

必要に応じてquarter blockも併記。

⸻

51. SAMPLE SIZE REQUIREMENTS

Family B:

= 60 company-quarter signals
= 8 companies

Family A:

= 30 launches
= 6 companies

Family C:

= 80 events
= 8 companies

Family D:

= 60 events
= 8 companies

満たさない場合、

INSUFFICIENT_SAMPLE

であり、

GO禁止。

⸻

52. CONCENTRATION TEST

必須。

remove best trade
remove best 3 trades
remove best company
leave-one-company-out
leave-one-year-out

を実施。

最大1イベントの利益が

total positive P&Lの20%以上

なら

CONCENTRATION_WARNING。

35%以上:

FAIL。

最大1companyが
総利益35%以上:

FAIL。

⸻

53. PARAMETER STABILITY

例えばZ=1.0だけ勝ち、
0.75と1.5が両方負けなら

fragile。

選択parameterの隣接条件の
過半数が同方向であること。

cliff-edge strategyはHoldoutへ昇格させない。

⸻

54. MONOTONICITY

Continuous signalを

quintile

またはsample不足時tertile

に分け、

signal strengthと

future operating result
future abnormal return

の関係を見る。

1 thresholdだけ勝つ戦略より、

signalが強いほどreturnが改善するものを高評価。

⸻

55. FINAL HOLDOUT

Holdoutでparameter変更禁止。

各Family最大1候補。

見る項目:

Net50
Net75
Net100
mean
median
hit rate
profit factor
Sharpe
max drawdown
bootstrap CI
company concentration
year concentration

Holdout失敗後の修正を

v0.1改善

と呼んではいけない。

それはv0.2。

⸻

56. FAMILY FINAL GO

TRADEABLE_ALPHA_GOには最低限、

1. sample size requirement PASS
2. Train Net50 > 0
3. Validation Net50 > 0
4. Holdout Net50 > 0
5. pooled block-bootstrap 95% CI lower bound > 0
6. Net75 > 0
7. Net100 >= 0
8. leave-one-company-out 80%以上 positive
9. best event concentration <35%
10. best company concentration <35%
11. parameter stability PASS
12. capacity PASS
13. obvious lookahead contamination 0

を要求。

1つでも欠ける場合、

TRADEABLE_ALPHA_GO禁止。

⸻

57. FUNDAMENTAL-ONLY VERDICT

Family Bについて、

future operating performanceは予測するが
future stock returnを予測しない場合、

FUNDAMENTAL_EDGE_ONLY

と判定。

これは失敗ではない。

その場合、

自動売買signalではなく
決算予想・裁量分析ツールとして残す。

⸻

58. NO FUNDAMENTAL LINK

Rank signalが

mobile exposureの高いU2でも

future company operating performanceと
関係しない場合、

NO_ECONOMIC_LINK

とする。

株価だけ偶然相関していても
Primary GO禁止。

⸻

59. REVENUE ESTIMATE — PHASE 2 ONLY

Top Grossing Rankだけで
少なくとも1 Familyが

VALIDATION_CANDIDATE

になった後だけ取得を検討。

全app一括取得禁止。

対象:

候補signalへ最も寄与したapp
＋
control apps

だけ。

Revenue Estimateの目的:

rank→money calibration。

Alpha探索のために
高価なRevenue Estimateを
大量取得してはいけない。

⸻

60. HISTORICAL PROVIDER MODEL CHANGES

AppTweak等のprovider methodologyは
将来変更され得る。

manifestへ保存:

retrieved_at
API endpoint
requested params
provider docs version/date if known
response schema hash

raw data overwrite禁止。

再取得結果が違う場合、
旧snapshotを残す。

⸻

61. APP STORE METHODOLOGY BREAKS

store ranking methodology変更、
ranking depth変更等が疑われる時点は

STRUCTURAL_BREAK_FLAG。

Google Play等のrank depth変更があっても、

Primaryは全期間Top200へ統一。

Top200より深い過去rankを使わない。

⸻

62. JAPAN-ONLY LIMITATION

v0.1はJapan storeだけ。

海外売上比率の高い企業では
coverageが不十分な可能性を明示。

Japan signalが弱かったからといって、

世界全体のmobile-game demandと
無関係だったと結論してはいけない。

Taiwan
Korea
US

追加はv0.2候補。

⸻

63. LAUNCH REGISTRY PROBLEM

Top200 historyだけでは

「発売したがTop200に一度も入らなかったゲーム」

を発見できない。

したがってLaunch Failure Familyには

別途launch registry必須。

registry incompleteの場合、

Family A Failureは実行禁止。

Top200に出なかったことを
「発売されなかった」と解釈禁止。

⸻

64. MAPPING HUMAN GATE

自動mapping終了後、

/audit/UNRESOLVED_OWNERSHIP.csv

を生成。

以下を含む。

high-rank unmapped apps
publisher ambiguity
joint ventures
licensed IP
publisher transfers
delisted publishers

Mapping Confidence A確定前に
Primary Backtestへ進めない。

これはv0.1で最も重要なmanual audit。

⸻

65. MAPPING COVERAGE REPORT

会社ごとに、

known apps
mapped A
mapped B/C
unresolved

を表示。

さらにPortfolioPowerのうち

A-mapped dataで説明できる比率

を算出。

coverage不足企業はPrimary U2から除外。

最低coverage:

80%

⸻

66. DATA QUALITY TESTS

必須。

duplicate date
duplicate app ID
rank outside 1–200
calendar gap
store gap
impossible launch date
ownership overlap
ticker outside listing period
fiscal quarter inconsistency
negative volume
missing OHLC
non-trading date execution

すべて検出。

⸻

67. LOOKAHEAD CANARY

非常に重要。

未来データを人工的に書き換える。

例:

2024年以降rankを全て1位に変える。

その状態で、

2023年以前に作られたfeatures/signalsが
1 byteでも変化したら、

LOOKAHEAD_FAIL。

同様に、

future financial data
future ownership
future stock price

でも実施。

⸻

68. POINT-IN-TIME TEST

各featureについて、

feature_timestamp <= decision_timestamp

をprogrammatically assert。

違反1件でも

BACKTEST_INVALID。

⸻

69. PROJECT STRUCTURE

APP_RANK_ALPHA/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── config/
│   ├── APP_RANK_ALPHA_v0.1_CANONICAL.md
│   ├── SPEC_SHA256.txt
│   ├── research_spec.yaml
│   ├── cost_model.yaml
│   └── api_budget.yaml
├── data/
│   ├── raw/
│   │   ├── apptweak/
│   │   ├── jquants/
│   │   └── official_ir/
│   ├── processed/
│   └── manifests/
├── registry/
│   ├── apps.parquet
│   ├── ownership_history.parquet
│   ├── companies.parquet
│   ├── materiality_history.parquet
│   └── launches.parquet
├── src/
│   ├── ingestion/
│   ├── registry/
│   ├── point_in_time/
│   ├── features/
│   ├── signals/
│   ├── fundamentals/
│   ├── backtest/
│   ├── statistics/
│   ├── bias_audit/
│   └── reports/
├── tests/
├── audit/
├── results/
└── change_requests/

⸻

70. TECH STACK

Primary:

Python 3.12+

DuckDB
Parquet
PyArrow
Polars or Pandas
HTTPX
Pydantic
NumPy
SciPy
statsmodels

不要:

microservices
cloud infrastructure
React UI
database server

v0.1はlocal-first。

⸻

71. CLI

最低限以下。

app-alpha doctor

app-alpha estimate-cost

app-alpha probe-apptweak

app-alpha ingest-ranks

app-alpha build-app-registry

app-alpha build-ownership-registry

app-alpha audit-mapping

app-alpha ingest-jquants

app-alpha build-features

app-alpha run-confirmatory

app-alpha run-discovery

app-alpha validate

app-alpha freeze-candidates

app-alpha unlock-holdout

app-alpha run-holdout

app-alpha report

app-alpha paper-signal

⸻

72. API DESIGN RULE

Claude CodeはMCPを

documentation discovery

として使ってよい。

大量データ取得pipeとしてMCPを使わない。

API仕様を確認
→
local clientを書く
→
APIからdiskへ直接保存

をPrimary workflowとする。

API keyをLLM outputへ表示禁止。

⸻

73. RAW DATA IMMUTABILITY

/raw/

配下はimmutable。

同一queryを再取得した場合も
overwriteしない。

snapshot timestampを付ける。

manifest:

source
endpoint
parameters
retrieved_at
sha256
credit_cost
row_count
schema_hash

を保存。

⸻

74. TEST REQUIREMENTS

最低限unit/integration tests:

RankPower
Top200 censoring
platform averaging
ownership effective dates
listing dates
fiscal quarter Day60
QTD calculation
rolling MAD
future-data isolation
entry date
exit date
corporate action
cost deduction
ADV20
signal persistence
duplicate signals
holdout lock
API credit cap

⸻

75. DESTRUCTIVE TESTS

以下を必ず実行。

未来データ注入
ranking date 1日shift
stock price 1日shift
ownership 1年shift
cost 2倍
largest company removal
largest winner removal
COVID period removal
2021 mobile-game boom removal
2025–26 period separate
iOS only
Android only

ただしこれらはRobustness。

Primary rule変更には使わない。

⸻

76. RESULTS

/results/

以下必須。

DATA_FEASIBILITY.md
API_COST_REPORT.md
DATA_QUALITY.md
MAPPING_AUDIT.md
UNIVERSE.md

FAMILY_A_CONFIRMATORY.csv
FAMILY_B_CONFIRMATORY.csv
FAMILY_C_CONFIRMATORY.csv
FAMILY_D_CONFIRMATORY.csv

DISCOVERY_GRID_ALL.csv
MULTIPLE_TESTING.csv
PARAMETER_STABILITY.csv
CONCENTRATION_TESTS.csv
COST_STRESS.csv
LIQUIDITY_STRESS.csv

VALIDATION_REPORT.md
HOLDOUT_REPORT.md
FINAL_VERDICT.md
FINAL_VERDICT.json

⸻

77. HTML REPORT

UI開発はしない。

static HTML 1枚で十分。

表示:

DATA STATUS
MAPPING STATUS
LOOKAHEAD STATUS
HOLDOUT STATUS

Family A
Family B
Family C
Family D

Gross return
Net50
Net75
Net100
N
Companies
Hit rate
Profit factor
Sharpe
CI
Concentration
Capacity

最後に大きく、

NO ECONOMIC LINK

FUNDAMENTAL EDGE ONLY

DISCOVERY ONLY

VALIDATION CANDIDATE

TRADEABLE ALPHA GO

のいずれか。

⸻

78. PAPER MODE

Tradeable Alpha GO後、

paper modeを実装。

毎日AppTweak更新後に

current Top Grossing
↓
registry
↓
features
↓
signal
↓
candidate position

を生成。

v0.1 live-safe time:

10:15 JST以降。

ただしPrimary backtestとの整合性確認のため、

NEXT OPEN signal

も同時表示。

実取引を自動発注する機能は
v0.1に入れない。

⸻

79. PAPER VALIDATION

Historical GOだけで
production-readyと呼ばない。

paper modeで、

signal generated_at
source retrieved_at
entry reference price
theoretical fill
exit
cost estimate

を記録。

Historicalとlive calculationに差があれば
原因を調査。

⸻

80. ABSOLUTE PROHIBITIONS

以下禁止。

結果を見て銘柄を除外
結果を見て期間変更
結果を見てrank transform変更
結果を見てthreshold追加
Holdoutでparameter調整
現在のpublisherを過去へ適用
現在上場会社だけ使用
Top200圏外とmissingを混同
当日rankで当日OPEN約定
手数料0だけ報告
20アプリ×100日を2000独立sampleとしてt-test
最高Sharpeだけ報告
Revenue Estimateを無制限取得
API credit無制限使用
API keyのログ保存
Claude Codeによる仕様自己変更

⸻

81. PHASE ORDER

PHASE 0
Data feasibility probe

PASS
↓

PHASE 1
Historical Top Grossing ingestion

↓

PHASE 2
App / Ownership registry

↓

HUMAN MAPPING AUDIT

PASS
↓

PHASE 3
J-Quants ingestion

↓

PHASE 4
Feature construction

↓

PHASE 5
Confirmatory backtests

↓

PHASE 6
Bounded Discovery

↓

PHASE 7
Validation

↓

Candidate Freeze

↓

PHASE 8
One-time Holdout

↓

TRADEABLE_ALPHA_GO
or
NO-GO

↓

PHASE 9
Paper Mode

⸻

82. STOP CONDITIONS

即終了条件:

AppTweak historical common coverage不足

Mapping Confidence A coverage不足

U2企業数 < 6

Family B company-quarter sample <60

lookahead test failure

historical known-atを再現不能

API利用条件に抵触

data quality critical error

上記の場合、

無理にAlpha探索を続けない。

⸻

83. FINAL RESEARCH QUESTION

最終的に答えるのは以下。

Q1.
Grossing Rankは将来業績を予測するか。

Q2.
その情報は株価へ即時反映されるか。

Q3.
反映されない場合、どのsignal familyか。

Q4.
50bpコスト後でも残るか。

Q5.
100bpでも壊れないか。

Q6.
特定company/title/yearだけではないか。

Q7.
完全Holdoutでも残るか。

Q8.
100万円規模で実行可能か。

Q9.
Fundamental edgeだけか、
tradable stock alphaまであるか。

⸻

84. REQUIRED FINAL VERDICT

Claude Codeは最終的に必ず1つを選ぶ。

VERDICT_0:
DATA_NOT_FEASIBLE

VERDICT_1:
NO_ECONOMIC_LINK

VERDICT_2:
FUNDAMENTAL_EDGE_ONLY

VERDICT_3:
DISCOVERY_SIGNAL_ONLY

VERDICT_4:
OUT_OF_SAMPLE_ALPHA_BUT_NOT_ROBUST

VERDICT_5:
PAPER_TRADE_WORTH_PURSUING

「 promising 」
「 interesting 」
等の曖昧判定は禁止。

⸻

END OF CANONICAL SPEC
