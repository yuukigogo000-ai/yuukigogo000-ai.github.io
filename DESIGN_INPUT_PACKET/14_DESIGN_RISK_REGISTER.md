# 14_DESIGN_RISK_REGISTER

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_RISKS: **12**

本ファイルは「デザインの良し悪し」ではなく、**Candidate 03 のビジュアル意図と
Product Truth / Technical Constraint の衝突**のみを扱う。

SAFE_DESIGN_RESPONSE は表現の変換案であり、**ゲーム機能の変更を一切含まない**。

参照した Visual Intent(ChatGPT側で選定済み・リポジトリには存在しない):
営業中のホール / 強い俯瞰感 / 店舗そのものが主役 / 客・台・島・照明の密度 /
経営状態がホール空間に接続 / cinematic / dark環境 / warm machine lighting /
gold・amber中心のpremium / 経営シミュレーションと一目でわかる / SaaSダッシュボードにしない /
汎用カード列にしない / Web LPにしない / ケータイ用ゲームとして成立させる。

## RK-01 [SEVERITY: HIGH]

- DESCRIPTION: 「ホール全体を見渡す俯瞰」に対応する空間データが存在しない
- EVIDENCE: `台は配列(machines)で保持され座標・座席・島オブジェクトを持たない。NON_FEATURES参照。pachinko/index.html:660-671,1658-1700`
- DESIGN_IMPACT: ホール俯瞰を実データの写像として描くことはできない
- SAFE_DESIGN_RESPONSE: 俯瞰は既存データ(台数・機種・設定・人気・前日収支・客数)から構成できる範囲の表現に留める。空間配置は装飾として扱い、個々の台の位置に意味を持たせない。または俯瞰を背景美術として扱い、操作対象は既存の台一覧データに紐づける。

## RK-02 [SEVERITY: HIGH]

- DESCRIPTION: 「客・照明による密度感」に対応する個体データが存在しない
- EVIDENCE: `客は 一般/常連/プロ の3系統の人数(数値)のみ。個体・位置・状態は不在。pachinko/index.html:820-843`
- DESIGN_IMPACT: 客を個体として描画・追跡する表現は根拠を持たない
- SAFE_DESIGN_RESPONSE: 密度は3系統の人数と収容力(台数×20、特日×1.15)の比率として表現する。個体の振る舞いを示唆しない。

## RK-03 [SEVERITY: HIGH]

- DESCRIPTION: 「営業中」の常時進行を示すデータが存在しない(ターン制)
- EVIDENCE: `経営はターン制で、営業日の途中という状態は保持されない。setIntervalは試打演出とオート回転のみ。R-04,R-05`
- DESIGN_IMPACT: リアルタイムに動くホールを提示すると、存在しない進行を示唆する
- SAFE_DESIGN_RESPONSE: 「営業中」は当日の結果が確定した後の静的な断面、または次の1日を待つ構えとして表現する。進行中を示すアニメーションは、実行操作から結果提示までの遷移に限定する。

## RK-04 [SEVERITY: HIGH]

- DESCRIPTION: 台1件あたりの必須表示要素が多く、俯瞰と両立しない可能性
- EVIDENCE: `台ごとに9項目+最大3標識+3操作(D-09〜D-18, ACT-06〜08)。台は最大60件(R-28)`
- DESIGN_IMPACT: 俯瞰の一覧性と、台単位の操作可能性が競合する
- SAFE_DESIGN_RESPONSE: 俯瞰(概観)と台明細(操作)を段階的に分ける。ただし FN-02/03/04 への到達性は維持する。

## RK-05 [SEVERITY: MEDIUM]

- DESCRIPTION: 大型背景アートワークの容量と外部依存
- EVIDENCE: `実行時の外部リクエストは0(P-27)。アセットはローカル同梱のみ。現状PNG3件で計約521KB`
- DESIGN_IMPACT: 高精細ラスタ背景は同梱容量とオフライン初回取得に直結する
- SAFE_DESIGN_RESPONSE: 背景はCSSグラデーション/インラインSVG/軽量ラスタのいずれかで構成し、sw.jsのPRECACHEに追加するか、未取得時に成立する設計にする(pachinko/sw.js:3)。

## RK-06 [SEVERITY: MEDIUM]

- DESCRIPTION: 暗い環境+暖色照明でのテキスト可読性
- EVIDENCE: `本文・数値は7指標+帳簿8列+台明細と密度が高い(D-01〜D-07, D-35〜D-42)`
- DESIGN_IMPACT: 装飾層の上に高密度の数値を載せると可読性が落ちる
- SAFE_DESIGN_RESPONSE: 数値と本文は装飾層と分離した面に置く。色のみで意味を伝えない(既存にも色依存の箇所がある)。

## RK-07 [SEVERITY: MEDIUM]

- DESCRIPTION: prefers-reduced-motion が未実装のまま演出を増やすと後退する
- EVIDENCE: `出現数0(NON_FEATURES)。既存の@keyframesは5件で、うち2件は無限反復`
- DESIGN_IMPACT: cinematicな常時演出は低減設定の利用者に配慮できない
- SAFE_DESIGN_RESPONSE: 新規モーションは reduce 時の代替を同時に定義する。実装側で reduce 分岐を追加する(既存動作の変更ではなく追加)。

## RK-08 [SEVERITY: MEDIUM]

- DESCRIPTION: safe-area 未対応のまま下部固定要素を強化すると衝突する
- EVIDENCE: `env()の出現数0。下部固定バーが存在(pachinko/index.html:109-118)`
- DESIGN_IMPACT: 端末のホームバー領域と主要アクションが重なる懸念
- SAFE_DESIGN_RESPONSE: 下部固定要素に safe-area の余白を追加する(既存レイアウトの意味を変えない範囲の追加)。

## RK-09 [SEVERITY: MEDIUM]

- DESCRIPTION: 対象幅の正本が存在しない
- EVIDENCE: `U-01, C-02。@mediaは未使用クラス向けの1件のみ`
- DESIGN_IMPACT: どの幅で成立を保証するのかが未確定のまま設計が進む
- SAFE_DESIGN_RESPONSE: Design Authority側で対象幅を宣言してもらい、実装・検証はその宣言に従う。リポジトリからは決定できない。

## RK-10 [SEVERITY: LOW]

- DESCRIPTION: 高精細表現とターン制の情報更新頻度の不一致
- EVIDENCE: `1営業日の実行以外では経営データが変化しない(R-04)`
- DESIGN_IMPACT: 常時変化する画面を装うとデータの実態と乖離する
- SAFE_DESIGN_RESPONSE: 変化は1日単位で起きるという事実に沿って、変化の見せ場を実行→結果の遷移に集約する。

## RK-11 [SEVERITY: LOW]

- DESCRIPTION: 機種名・スペック表記が長く、俯瞰内の要素に収まらない可能性
- EVIDENCE: `最長機種名13字、スペック表記20字(D-09, D-11)。いずれもEXACT_REQUIRED_COPY(CP-02, CP-03)`
- DESIGN_IMPACT: 短縮・省略は必須コピーの改変にあたる
- SAFE_DESIGN_RESPONSE: 省略表示を行う場合も、原文へ到達できる経路(台明細)を保持する。

## RK-12 [SEVERITY: LOW]

- DESCRIPTION: デスクトップ(1080x920)とモバイル幅の同一構成での両立
- EVIDENCE: `Electronの既定ウィンドウは1080x920、最小420x600(pachinko/desktop/main.js:14-17)`
- DESIGN_IMPACT: モバイル前提の俯瞰は広い窓で間延びする
- SAFE_DESIGN_RESPONSE: 同一HTMLで両立する必要がある。最大幅の扱いを定義してもらう。

## 集計

| SEVERITY | 件数 |
|---|---|
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 3 |
| **合計** | **12** |

## 最重要の3点(Design Authority への論点)

1. **空間データが存在しない**(RK-01 / RK-02 / RK-04)。台は配列、客は人数。座標・座席・島・客個体はない。
   俯瞰を「実データの写像」として描くことはできず、美術としての俯瞰 + 既存データへの紐づけが必要。
2. **ターン制であり「営業中」の連続進行は存在しない**(RK-03)。データが変化するのは1営業日の実行時のみ。
   リアルタイムに動くホールは、存在しない進行を示唆する。
3. **対象幅の正本が存在しない**(RK-09 / U-01 / C-02)。リポジトリからは決定できないため、
   Design Authority 側での宣言が必要。
