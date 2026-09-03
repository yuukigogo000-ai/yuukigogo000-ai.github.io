# 18_EXTRACTION_REPORT

## STATUS

**DESIGN_INPUT_PACKET_COMPLETE**

## REPOSITORY

- COMMIT: `f71190b50a118dad4fa2adb5531541ae36875eb3`
- BRANCH: claude/pachinko-slot-management-app-p2j058
- 対象製品: パチスロ帝国 (`pachinko/`)
- 調査モード: READ-ONLY(製品コードの変更なし)

## FILES INSPECTED

- pachinko/index.html (1,862行 / 全域)
- pachinko/manifest.webmanifest (17行 / 全域)
- pachinko/sw.js (32行 / 全域)
- pachinko/desktop/main.js (46行 / 全域)
- pachinko/desktop/package.json (53行 / 全域)
- pachinko/desktop/package-lock.json (依存の確認)
- pachinko/desktop/README.md (文書として確認)
- pachinko/desktop/.gitignore
- .github/workflows/desktop-build.yml (39行 / 全域)
- pachinko/DESIGN.md (文書として確認)
- pachinko/redesign/** 12ファイル (先行文書として確認・CONFLICTS照合)
- pachinko/icon-192.png / icon-512.png / desktop/build/icon.png (寸法・サイズ・sha256)
- index.html (リポジトリ直下 / 別製品として識別・対象外)

## TOTALS

| 指標 | 値 | 定義したファイル |
|---|---|---|
| TOTAL_SCREENS | **12** | 05 |
| TOTAL_STATES | **62** | 06 |
| TOTAL_FUNCTIONS | **39** | 03 |
| TOTAL_ACTIONS | **35** | 08 |
| TOTAL_DATA_FIELDS | **62** | 07 |
| TOTAL_PROTECTED_ITEMS | **33** | 04 |
| TOTAL_ASSETS | **3** | 11 |
| TOTAL_REQUIRED_COPY | **40** (EXACT 13 + SEMANTIC 27) | 12 |
| TOTAL_GAME_RULES | 50 | 13 |
| TOTAL_NAVIGATION_EDGES | 24 | 09 |
| TOTAL_DESIGN_RISKS | 12 | 14 |
| TRUTH_MATRIX_ROWS | 374 | 15 |
| UNKNOWNS | **10** | 10 / 16 |
| CONFLICTS | **5** | 16 / 本ファイル |

## UNKNOWNS(推測で埋めていない項目)

| ID | 項目 | 状態 |
|---|---|---|
| U-01 | 対象ビューポートの明示的定義 | UNKNOWN |
| U-02 | 最小タップ領域の方針 | UNKNOWN |
| U-03 | 対応ブラウザ・デバイスの範囲 | UNKNOWN |
| U-04 | 性能目標(FPS/フレーム予算/起動時間) | UNKNOWN |
| U-05 | アセット容量の上限方針 | UNKNOWN |
| U-06 | 音声資産の可否方針 | UNKNOWN |
| U-07 | アクセシビリティ方針(ARIA/コントラスト基準) | UNKNOWN |
| U-08 | デプロイ手順の正本 | UNKNOWN |
| U-09 | アイコン画像の由来ライセンス | UNKNOWN |
| U-10 | Candidate 03 のビジュアル仕様そのもの | UNKNOWN |

いずれも Design Authority 側の宣言、または別途の判断が必要。
とくに **U-01(対象ビューポート)** は実装と自動検証の前提になるため、宣言が必須。

## CONFLICTS(ソース優先度による解決)

### C-01 — prefers-reduced-motion 対応の有無

- 内容: pachinko/redesign/request/TECHNICAL_CONSTRAINTS.json(文書, 優先度5)は「prefers-reduced-motion: reduce の尊重が必須」と記述。一方 production code(優先度1)には出現数0で未実装。
- 解決: **上位ソース(コード)を採用: 現状は UNIMPLEMENTED。文書側の記述は既存事実ではなく要求である。**
- ソース: `pachinko/redesign/request/TECHNICAL_CONSTRAINTS.json vs pachinko/index.html`

### C-02 — 必須対応幅 360/390/430 の出典

- 内容: 同文書は must_support_widths_px を [360,390,430] と記述。production codeには当該幅の指定・分岐が存在しない。
- 解決: **上位ソースを採用: リポジトリ上は UNKNOWN(U-01)。当該数値は外部の検証手順に由来し、コード上の制約ではない。**
- ソース: `pachinko/redesign/request/TECHNICAL_CONSTRAINTS.json vs pachinko/index.html:5,239`

### C-03 — テスト証跡の所在

- 内容: pachinko/DESIGN.md(文書, 優先度5)はPlaywrightによる自動プレイ検証の結果を記述。リポジトリにテストコードは1件も存在しない。
- 解決: **上位ソースを採用: TEST_EVIDENCE は全項目 NOT_FOUND。DESIGN.mdの記述は再現不能な外部実行の報告として扱う。**
- ソース: `pachinko/DESIGN.md vs リポジトリ全体(テストファイル0件)`

### C-04 — 機能の粒度

- 内容: pachinko/redesign/request/FUNCTION_FREEZE.json(文書)はF-001〜F-045の45件。本抽出はエントリポイント基準でFN-01〜FN-39の39件。
- 解決: **挙動の矛盾ではなく粒度の差(前者はリール停止・補充・実績閲覧等を個別計上)。本パケットはコードのハンドラ単位を採用。**
- ソース: `pachinko/redesign/request/FUNCTION_FREEZE.json vs pachinko/index.html`

### C-05 — リポジトリ内の別アプリケーション

- 内容: リポジトリ直下 index.html は別製品(JAN→楽天価格 取得ツール)であり、外部APIへのリクエストを行う。
- 解決: **本パケットの対象は pachinko/ 配下のみ。直下index.htmlの性質(外部通信あり)を「パチスロ帝国」の事実として混同しないこと。**
- ソース: `index.html:6,81`

最重要: **C-01(prefers-reduced-motion は未実装)** と **C-02(対象幅の記述はコードに存在しない)**。
先行文書はこれらを既存の制約として記述しているが、production code には実装も宣言も存在しない。
本パケットは上位ソース(コード)を採用している。

## FEASIBILITY_VERDICT

**FEASIBLE_WITH_VISUAL_ADAPTATION (1件のみ PRODUCT_TRUTH_CONFLICT: responsive対象幅の正本が不在)**

| 評価領域 | 判定 | 根拠 |
|---|---|---|
| cinematic hall environment | **FEASIBLE_WITH_VISUAL_ADAPTATION** | 空間・座席・島の実データが存在しない(RK-01)。ターン制で営業中の連続進行も存在しない(RK-03) |
| full-canvas artwork | **FEASIBLE_WITH_ASSETS** | Canvas/WebGLは未使用だが禁止されていない。外部リクエスト不可のため同梱必須(P-27, RK-05) |
| customer density representation | **FEASIBLE_WITH_VISUAL_ADAPTATION** | 客は3系統の人数のみ(RK-02)。収容力は台数×20(R-10) |
| machine / island representation | **FEASIBLE_WITH_VISUAL_ADAPTATION** | 台は配列。島は同一機種の台数ボーナスのみ(R-19)。座標なし |
| live operational information overlay | **FEASIBLE** | 7指標が常時参照可能で、renderStatusが状態更新ごとに再描画する(FN-26, D-01〜D-07) |
| typography | **FEASIBLE_WITH_VISUAL_ADAPTATION** | Webフォントの読込は実行時外部リクエストとなり P-27 と衝突。現状はOS標準スタックのみ(pachinko/index.html:33-35) |
| navigation | **FEASIBLE** | 4領域の切替は既存(FN-01)。履歴操作は未実装でスタックも持たない(NAV_NOTES) |
| animation | **FEASIBLE_WITH_VISUAL_ADAPTATION** | 既存@keyframes5件。prefers-reduced-motionは未実装(RK-07) |
| responsive 360 / 390 / 430 | **PRODUCT_TRUTH_CONFLICT** | リポジトリに対象幅の宣言が存在しない(U-01, C-02)。@mediaは未使用クラス向け1件のみ |
| safe-area | **FEASIBLE** | env()未使用(RK-08)。下部固定バーが存在 |
| touch targets | **FEASIBLE** | 最小サイズの明示指定は不在(U-02)。実寸はpadding依存 |
| performance | **FEASIBLE_WITH_VISUAL_ADAPTATION** | 単一HTML・依存ゼロで軽量。ただし台最大60件の再描画は毎回全再生成(pachinko/index.html:1008-1057) |
| offline behavior | **FEASIBLE_WITH_ASSETS** | SWのPRECACHEは5件固定(pachinko/sw.js:3)。新規アセットは未登録だとオフライン初回で取得できない |
| asset loading | **FEASIBLE_WITH_ASSETS** | 外部リクエスト不可(P-27)。file:とElectronでも動作する必要がある(P-26) |

### 判定の内訳

- FEASIBLE: 4件
- FEASIBLE_WITH_ASSETS: 3件
- FEASIBLE_WITH_VISUAL_ADAPTATION: 6件
- PRODUCT_TRUTH_CONFLICT: 1件(responsive対象幅の正本が不在)
- TECHNICAL_BLOCKER: 0件

### 各領域の補足

- **cinematic hall environment** (FEASIBLE_WITH_VISUAL_ADAPTATION): 美術としての俯瞰は実装可能。ただし個々の台の位置や客の個体を実データの反映として示すことはできない
- **full-canvas artwork** (FEASIBLE_WITH_ASSETS): インラインSVG/CSS/同梱ラスタ/Canvas描画のいずれも可。容量とPRECACHEの扱いを定義する必要がある
- **customer density representation** (FEASIBLE_WITH_VISUAL_ADAPTATION): 人数と収容力の比率としての密度表現は事実に忠実。個体表現は不可
- **machine / island representation** (FEASIBLE_WITH_VISUAL_ADAPTATION): 機種でまとめた集団として表現するのは事実に沿う。物理的な島レイアウトは装飾に留める
- **live operational information overlay** (FEASIBLE): ただし更新契機は1営業日の実行であり、秒単位で変化するものではない(RK-10)
- **typography** (FEASIBLE_WITH_VISUAL_ADAPTATION): OS標準スタックでの階層設計、または同梱フォント(容量とライセンスの明示が必要)に限定される
- **navigation** (FEASIBLE): 領域の提示方法は自由。ただし営業開始への常時到達(P-01の起点)を維持する必要がある
- **animation** (FEASIBLE_WITH_VISUAL_ADAPTATION): 新規モーションはreduce時の代替を伴う必要がある。ブロッキング演出は1営業日の即時性(P-01)と衝突する
- **responsive 360 / 390 / 430** (PRODUCT_TRUTH_CONFLICT): 対象幅はDesign Authority側で宣言が必要。リポジトリからは決定できない。実装は宣言に従う
- **safe-area** (FEASIBLE): safe-area余白の追加は既存の意味を変えない実装追加として可能
- **touch targets** (FEASIBLE): 最小寸法をDesign Systemで宣言してもらえば実装・自動検証ともに可能
- **performance** (FEASIBLE_WITH_VISUAL_ADAPTATION): 60件×装飾レイヤーの同時アニメーションは避ける必要がある。静的表現と限定的なモーションなら問題ない
- **offline behavior** (FEASIBLE_WITH_ASSETS): 新規アセットを追加する場合はPRECACHEへの追加が必要(実装側の対応事項)
- **asset loading** (FEASIBLE_WITH_ASSETS): 相対パスの同梱アセットまたはインラインのみ。fetchに依存する読込は不可

**結論**: Candidate 03 のアートディレクションは棄却する必要はない。
ただし「空間データ・客個体・リアルタイム進行が存在しない」という Product Truth に沿って、
俯瞰・密度・営業中の表現を**既存データの範囲で成立する表現へ変換**する必要がある(14 の SAFE_DESIGN_RESPONSE)。
唯一の PRODUCT_TRUTH_CONFLICT は対象幅の未宣言であり、これは Design Authority 側の宣言で解消する。

## DESTRUCTIVE_VERIFICATION_RESULT

自分の抽出結果に対する10項目の反証を実施。

| CHECK | RESULT |
|---|---|
| A. READMEをProduct Truthと誤認していないか | **PASS** |
| B. dead codeを現行機能として数えていないか | **PASS(1件検出・除外)** |
| C. test fixture / mock dataを本番データと誤認していないか | **PASS** |
| D. コメントアウトされた機能を存在すると扱っていないか | **PASS** |
| E. Candidate 03のVisualから機能を逆輸入していないか | **PASS** |
| F. 現在到達不能なScreenを通常Screenとして扱っていないか | **PASS** |
| G. 単なる内部stateをユーザー向けScreenへ変換していないか | **PASS** |
| H. 同じFunctionを別名で二重計上していないか | **PASS** |
| I. 存在しないnetwork / backend / accountを想定していないか | **PASS** |
| J. ゲームロジック変更をUI変更可能領域へ入れていないか | **PASS** |

### 詳細

#### A. READMEをProduct Truthと誤認していないか → PASS

READMEはpachinko/desktop/README.md(33行, ビルド手順)のみで、本パケットの機能記述には使用していない。全ルールはproduction codeの行番号を根拠にしている(GAME_RULE_EVIDENCE 50件すべてにpachinko/index.html等の行参照)。

#### B. dead codeを現行機能として数えていないか → PASS(1件検出・除外)

CSSクラス .grid2 が定義のみで未使用(pachinko/index.html:237,239)。デッドCSSとして NON_FEATURES に記録し、画面・状態・機能には計上していない。関数はすべて参照が存在することを確認済み。

#### C. test fixture / mock dataを本番データと誤認していないか → PASS

リポジトリにテスト・フィクスチャは0件。CATALOG/ACHIEVEMENTS/LUCK_EVENTS/COND_EVENTS/TRENDS/ADS/DIFFS はいずれも production code の実行時定数であり、実際に参照されていることを確認(pachinko/index.html:689,934,753,773,745,818,730)。

#### D. コメントアウトされた機能を存在すると扱っていないか → PASS

コメントはセクション見出しと説明のみで、コメントアウトされた実装は検出されなかった。

#### E. Candidate 03のVisualから機能を逆輸入していないか → PASS

島・座席・客個体・照明・リアルタイム進行はいずれも NON_FEATURES に「不在」として記録し、SCREEN/STATE/FUNCTION/DATA/ACTION のどのIDにも登場させていない。Visual Intentは DESIGN_RISK_REGISTER と FEASIBILITY の評価対象としてのみ参照している。

#### F. 現在到達不能なScreenを通常Screenとして扱っていないか → PASS

12画面すべてに ENTRY_CONDITION をコード行付きで記載。到達経路は NAVIGATION_GRAPH の24辺で網羅。到達手段のない画面は検出されなかった。

#### G. 単なる内部stateをユーザー向けScreenへ変換していないか → PASS

SCREEN として計上したのは、DOMの表示単位(4パネル / #modalBox の6内容 / #toasts / 常時chrome)のみ。state.trend / state.evCd / state.maxDebt などの内部値は DATA または内部状態として扱い、画面にしていない。

#### H. 同じFunctionを別名で二重計上していないか → PASS

FN-03(hall起点の試打)とFN-05(カタログ起点の試打)は同一の openTrial を呼ぶが、エントリポイントと入力(現在設定 / 設定3相当)が異なるため別機能として計上。それ以外に同一ハンドラの重複計上は検出されなかった。ACTIONは操作単位、FUNCTIONは挙動単位で分離している。

#### I. 存在しないnetwork / backend / accountを想定していないか → PASS

実行時の外部リクエスト0を実測し(fetch/XHR/WebSocket/外部URLの出現数0)、P-27 および NON_FEATURES に明記。TECHNICAL_CONSTRAINTS の NETWORK 節も同じ事実に基づく。

#### J. ゲームロジック変更をUI変更可能領域へ入れていないか → PASS

計算・抽選・経済・保存・乱数・アセット要件を PROTECTED 33件として分離し、各項目に WHAT_MUST_NOT_CHANGE を明記。UI側で変更可能なのは提示方法のみであることを 04 に記載。

**検出して除外した誤りは1件**: デッドCSS `.grid2`(定義のみ・未使用)を、
画面・状態・機能として計上しないよう除外した(検証B)。

## AUTOMATION_VERIFICATION_RESULT

- AUTOMATABLE: 20件
- PARTIALLY_AUTOMATABLE: 3件
- VISUAL_REVIEW_REQUIRED: 3件

自動検証を支える足場(DOM識別子70件 / グローバル公開3件 / ロジックの直接呼出 / 単一state / 単一保存キー)は
いずれも production code に実在し、PROTECTED_TEST_HOOK として凍結対象に含めた(P-29, P-30)。
既存のテストコードは存在しないため、検証は次工程で新規に用意する必要がある。

## SOURCE_REPO_INTEGRITY

**Repository code modified: NO**

本調査で追加したのは `DESIGN_INPUT_PACKET/` 配下の18ファイルのみ。
製品コード・アセット・設定・依存・CIのいずれも変更していない(git status で確認)。

## 次工程への引き継ぎ

1. Design Authority(ChatGPT)は 16_DESIGN_RETURN_REQUIREMENTS.json と 15_TRUTH_MATRIX.csv を
   機能捏造の防止に使用する。EXISTS=NO / UNKNOWN の項目を実在として描いてはならない。
2. 未宣言の U-01(対象ビューポート)と U-02(最小タップ領域)を Design System 側で宣言する。
3. 14_DESIGN_RISK_REGISTER の HIGH 4件(RK-01〜RK-04)への対応方針を Design Decision に含める。
4. 新規アセットを伴う場合は 11_ASSET_AUDIT の PRECACHE 追加要件を満たす。
5. 実装は 04_FUNCTION_FREEZE の33項目を不変条件として扱う。
