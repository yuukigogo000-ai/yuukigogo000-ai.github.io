# 13_GAME_RULE_EVIDENCE

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_RULES: **50**

CONFIDENCE は根拠の強さ: HIGH = production code に直接の実装がある。
TEST は検証コードの有無で、リポジトリにテストが存在しないため全件 NOT_FOUND(C-03)。

| RULE_ID | RULE | SOURCE_FILE | LINE / SYMBOL | TEST | CONFIDENCE |
|---|---|---|---|---|---|
| R-01 | クリア条件は純資産(資金+台資産-借金)が100,000,000以上 | `pachinko/index.html` | `387,676,945` / `GOAL_ASSETS/totalAssets` | NOT_FOUND | HIGH |
| R-02 | 倒産は資金が負のまま営業日を終え、かつ緊急融資枠も尽きたとき | `pachinko/index.html` | `909-917,1276,1312` / `isDead/creditLimit` | NOT_FOUND | HIGH |
| R-03 | クリア評価は到達日数で S<=65 / A<=85 / B<=120 / それ以外C | `pachinko/index.html` | `951` / `clearRank` | NOT_FOUND | HIGH |
| R-04 | 1営業日は利用者の操作1回で1日だけ進む | `pachinko/index.html` | `931,1788-1800` / `s.day++` | NOT_FOUND | HIGH |
| R-05 | 時間モデルはターン制(1操作=1営業日)。実時間経過やtickは存在しない | `pachinko/index.html(setInterval は試打演出とオート回転のみ)` | `` / `―` | NOT_FOUND | HIGH |
| R-06 | 日付に数字7を含む日が特日。客数倍率1.7 | `pachinko/index.html` | `678,782` / `isTokubi` | NOT_FOUND | HIGH |
| R-07 | day%7が6または0の日が週末。客数倍率1.3(特日でない場合のみ適用) | `pachinko/index.html` | `679,783` / `isWeekend` | NOT_FOUND | HIGH |
| R-08 | 設定別の店側粗利率は 1:0.25 / 2:0.21 / 3:0.16 / 4:0.11 / 5:0.05 / 6:-0.02 | `pachinko/index.html` | `422` / `MARGIN` | NOT_FOUND | HIGH |
| R-09 | 低換金ポリシーで粗利+0.025、フリ客×0.88、常連×0.95 | `pachinko/index.html` | `814,829,850` / `rateMod/rateBonus` | NOT_FOUND | HIGH |
| R-10 | 収容力は台数×20。特日または新装開店の日は×1.15まで詰められる | `pachinko/index.html` | `806,835` / `capacity/capMax` | NOT_FOUND | HIGH |
| R-11 | 一般客は 収容力×充填率×補正+広告。充填率=(0.10+評判/100×0.66)×集客力×難易度係数 | `pachinko/index.html` | `811-820` / `fillRate/attract` | NOT_FOUND | HIGH |
| R-12 | 集客力は 0.55+平均人気/65×0.45+新台数×0.03、0.65〜1.25にクランプ | `pachinko/index.html` | `809-812` / `attract` | NOT_FOUND | HIGH |
| R-13 | 常連の来店は プール×0.65(特日0.9)×(低換金0.95)×揺らぎ | `pachinko/index.html` | `829` / `regs` | NOT_FOUND | HIGH |
| R-14 | プロは設定5以上の台数×3×難易度proMul(特日1.5倍)。上限は収容力の15% | `pachinko/index.html` | `830-833` / `pros` | NOT_FOUND | HIGH |
| R-15 | プロの粗利貢献は 客単価45,000×(margin-0.16) すなわち高設定ほど店の損失 | `pachinko/index.html` | `857` / `mGross` | NOT_FOUND | HIGH |
| R-16 | 客単価はP機30,000/S機36,000に、台鮮度(0.75〜1.00)と特日渋り(0.7)と揺らぎ(0.8〜1.2)を乗算 | `pachinko/index.html` | `853-854` / `qual/tokubiGap/spend` | NOT_FOUND | HIGH |
| R-17 | 常連の客単価は一般の1.35倍 | `pachinko/index.html` | `856-857` / `nReg*spend*1.35` | NOT_FOUND | HIGH |
| R-18 | 台の重みは 素の人気×新台1.4×(1+(設定-3)×0.05)×シマ×ブーム | `pachinko/index.html` | `689-695` / `effectivePop` | NOT_FOUND | HIGH |
| R-19 | シマ効果は同一機種で+6%/台、上限+30% | `pachinko/index.html` | `682-685` / `islandBonus` | NOT_FOUND | HIGH |
| R-20 | ブーム機種の重みは1.4倍。ブームは7日ごと(day%7===1)にTRENDS7種から抽選 | `pachinko/index.html` | `686-688,745-751` / `trendMult` | NOT_FOUND | HIGH |
| R-21 | 新台効果は導入から5日未満に人気1.4倍 | `pachinko/index.html` | `690-691` / `effectivePop` | NOT_FOUND | HIGH |
| R-22 | 台の人気は営業ごとに 機種decay×(0.7〜1.3) 低下し、下限15 | `pachinko/index.html` | `860` / `m.pop` | NOT_FOUND | HIGH |
| R-23 | 経費は 家賃(30,000+cap×2,500)×難易度rentMul + 人件費13,000×人数 + 光熱費2,500×台数 + 広告費 + 臨時支出 + 利息 | `pachinko/index.html` | `867-871` / `expenses` | NOT_FOUND | HIGH |
| R-24 | 借入利息は残高×0.0025/日で経費に計上 | `pachinko/index.html` | `870` / `interest` | NOT_FOUND | HIGH |
| R-25 | 借入枠は 台資産×0.7+2,000,000。台資産は購入価格×0.45の合計 | `pachinko/index.html` | `674-677` / `creditLimit/machineValue` | NOT_FOUND | HIGH |
| R-26 | 資金が負になった時点で枠内なら不足額+200,000が自動融資される | `pachinko/index.html` | `909-917` / `need2` | NOT_FOUND | HIGH |
| R-27 | 必要スタッフは ceil(台数/8) の下限1。不足時は客数×0.85と評判-2 | `pachinko/index.html` | `680,822-828` / `staffNeeded` | NOT_FOUND | HIGH |
| R-28 | 店舗拡張は+5台、費用 2,000,000+(cap-10)×300,000、上限60台 | `pachinko/index.html` | `388,1107,1804-1811` / `expandCost/MAX_CAP` | NOT_FOUND | HIGH |
| R-29 | 新装開店フェアは 直近2日以内の購入 かつ 前回から7日以上 かつ 資金300,000以上 で予約可。翌営業日に客数1.5倍・評判+2 | `pachinko/index.html` | `785-790,1812-1820` / `grandOpen` | NOT_FOUND | HIGH |
| R-30 | 警戒度は 平均設定2.6未満で (2.6-平均)×2.2×難易度heatMul 増加、それ以外は×0.65-0.2で減衰 | `pachinko/index.html` | `793-794` / `s.heat` | NOT_FOUND | HIGH |
| R-31 | 警戒度8超で25%の確率で行政指導: 罰金500,000・評判-8・警戒度2へリセット | `pachinko/index.html` | `795-799` / `指導判定` | NOT_FOUND | HIGH |
| R-32 | 評判は (平均設定-3)×1.4 を基本に、特日は 4.5以上+5 / 4以上+4 / 3.5以上±0 / 3以上-1 / 3未満-6 | `pachinko/index.html` | `893-905` / `repDelta` | NOT_FOUND | HIGH |
| R-33 | 評判は毎日±0.5の揺らぎを受け、1〜100にクランプ | `pachinko/index.html` | `906` / `s.rep` | NOT_FOUND | HIGH |
| R-34 | 常連は 平均設定3.4以上かつ人員充足の日に (一般客×0.025+0.5)×倍率 増加。倍率は特日4.5以上で2倍・4以上で1.5倍、新装開店で2倍、広告pct×3の上乗せ | `pachinko/index.html` | `879-886` / `convMult` | NOT_FOUND | HIGH |
| R-35 | 常連は 平均設定2.5未満で×0.94、特日3未満で×0.85(3.5未満で×0.95)、評判35未満で×0.97 流出。上限は収容力×0.5 | `pachinko/index.html` | `887-891` / `s.regulars` | NOT_FOUND | HIGH |
| R-36 | 運イベントは毎日50%で1件、80件から重み抽選 | `pachinko/index.html` | `540,753-758` / `LUCK_DAILY_P` | NOT_FOUND | HIGH |
| R-37 | 数値依存イベントは条件成立かつクールダウン経過の候補から確率抽選し、その中から1件のみ発生 | `pachinko/index.html` | `770-779` / `COND_EVENTS` | NOT_FOUND | HIGH |
| R-38 | 履歴は先頭追加で最大60件保持 | `pachinko/index.html` | `928-929` / `s.history` | NOT_FOUND | HIGH |
| R-39 | 損益推移は直近30件を古い順に描画。基準線は0と最大と最小 | `pachinko/index.html` | `1196-1239` / `renderChart` | NOT_FOUND | HIGH |
| R-40 | 実績は15件。条件成立時に一度だけ解除され、通知は3500msで消滅 | `pachinko/index.html` | `604-620,698-712,934-945` / `grantAch` | NOT_FOUND | HIGH |
| R-41 | 難易度は初期資金 13,000,000/10,000,000/6,500,000、家賃×0.75/1.0/1.35、プロ×0.5/1.0/1.6、警戒×0.7/1.0/1.5、集客×1.05/1.0/0.97 | `pachinko/index.html` | `391-396` / `DIFFS` | NOT_FOUND | HIGH |
| R-42 | 試打スロットの当選確率は設定1と6の分母を線形補間して算出 | `pachinko/index.html` | `1347,1407-1408` / `slotDenom` | NOT_FOUND | HIGH |
| R-43 | 試打スロットの小役は ぶどう1/6.5・チェリー1/33・リプレイ1/7.3(固定)。獲得は8/2/3枚 | `pachinko/index.html` | `1411-1413,1470-1472` / `rollFlag` | NOT_FOUND | HIGH |
| R-44 | 試打スロットは1G3枚消費。ボーナス獲得枚数は機種のbigPay/regPay | `pachinko/index.html` | `1435,1467-1468` / `lever/resolve` | NOT_FOUND | HIGH |
| R-45 | 試打パチンコの1回転消費玉は max(2, round(5.5-設定×0.5)) | `pachinko/index.html` | `1550` / `spinCost` | NOT_FOUND | HIGH |
| R-46 | 試打パチンコの当選は1/denom。リーチは当選時または1/12で発生 | `pachinko/index.html` | `1573-1574` / `spin` | NOT_FOUND | HIGH |
| R-47 | 試打パチンコのRUSHは継続率rushPctで連チャン。初当り出玉firstBalls、連チャン中rushBalls | `pachinko/index.html` | `1598-1629` / `hitSequence` | NOT_FOUND | HIGH |
| R-48 | 試打は経営stateを変更しない(実績解除のみ副作用) | `pachinko/index.html` | `1349-1651,1474-1476,1602` / `openSlotTrial/openPachiTrial` | NOT_FOUND | HIGH |
| R-49 | 保存はlocalStorageの単一キー。読込時に全フィールドを型検証・範囲クランプし、未知IDは除去 | `pachinko/index.html` | `386,1652-1743` / `save/load/sanitizeState` | NOT_FOUND | HIGH |
| R-50 | 乱数はすべてMath.random。シード指定・再現性の仕組みは存在しない | `pachinko/index.html` | `624,753,773,1410,1572,1609` / `rand/Math.random` | NOT_FOUND | HIGH |

## 集計

- HIGH: 50件 / MEDIUM: 0件 / LOW: 0件 / UNVERIFIED: 0件
- すべてのルールが production code に実装を持つため、推測のみの項目(UNVERIFIED)は発生していない
- ただし**テストによる裏づけは1件も存在しない**。回帰の検出はコード読解と実行時観測に依存する

**TOTAL_RULES = 50**
