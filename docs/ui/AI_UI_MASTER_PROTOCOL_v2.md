# AI UI改善マスタープロトコル v2

> 目的: ChatGPT + Claude Code 等の実装AIを使い、既存アプリの機能を壊さず、再現性高く商用品質に近いUIへ改善する。
> v2は「波チェック Ocean UI」で実際に成功した工程を逆算し、スレッドが変わっても再現できるようにした運用正本。

---

## 0. 最重要原則

このプロトコルは会話履歴を正本にしない。

**正本は必ずファイルとして残す。**

標準フロー:

**Inspect → Freeze Function → Generate → Freeze Reference → Specify → Implement → Screenshot → Compare → Scope-fix → Freeze Screen → Expand → Stress Test → Ship**

AIに「いい感じのUIをコードで発明」させない。
AIには、凍結した仕様とVisual Referenceとの差分を埋めさせる。

---

# 1. Source of Truth の優先順位

矛盾した場合は上から優先する。

1. **ユーザーが明示した最新の機能要件・変更指示**
2. **現行コードで実際に存在する機能・データ・テスト**
3. `FEATURE_INVENTORY.md` / `ARCHITECTURE.md` / protected hooks
4. `DESIGN_SYSTEM.md` / `UI_IMPLEMENTATION.md` / `UI_ACCEPTANCE.md`
5. Master Visual Reference
6. 画面・領域限定のSupplemental Reference
7. AI生成画像内の文言・数値・架空アイコン
8. AIの推測

### 絶対ルール
Visual Referenceと実データ仕様が衝突したら、**実データ仕様を優先する**。
AI生成モックに存在する架空機能・架空データを実装しない。

---

# 2. 役割分担

## ChatGPT
- プロダクト/UIディレクター
- Visual Reference生成
- Design System監督
- Screenshot第三者レビュー
- 次の1回分だけの修正スコープ決定
- 実装AI向け指示文作成
- 完成/停止判断

## Claude Code 等の実装AI
- リポジトリ調査
- Git安全化
- 実装
- テスト
- Screenshot取得
- DOM/logic差分検査
- Git差分報告

## ユーザー
- 最終的な見た目の採否
- 機能変更の承認
- 公開/mergeの承認

---

# 3. スレッドを跨ぐための必須成果物

会話だけに依存しない。
各プロジェクトに最低限以下を残す。

```text
docs/ui/
├─ AI_UI_MASTER_PROTOCOL_v2.md
├─ FEATURE_INVENTORY.md
├─ ARCHITECTURE.md
├─ DESIGN_SYSTEM.md
├─ UI_IMPLEMENTATION.md
├─ UI_ACCEPTANCE.md
├─ REVIEW_LOG.md
├─ UI_HANDOFF.md
└─ reference/
   ├─ ui-master-v1.png
   ├─ ui-secondary-v1.png          # 必要時のみ
   ├─ crop-*.png                   # 領域限定Reference
   └─ accepted-*.png               # 採用画面の基準スクショ
```

### `UI_HANDOFF.md` は必須
各大工程の終了時に更新する。

最低限:
- 現在Phase
- repo path
- working branch
- base/checkpoint commit
- latest accepted commit
- 未commit差分
- Master Reference
- Supplemental Reference
- 凍結済み画面
- 現在のAcceptance
- 次にやること1〜3個
- 禁止事項
- 既知の問題
- テスト結果

**新しいチャットでは、会話履歴より先にこのファイルを読む。**

---

# 4. Referenceは「1枚だけ」ではなく階層化する

v1の「唯一のReferenceを1枚」は厳しすぎる。
実際には全体Reference + 部分Referenceが有効だった。

## 4.1 Master Reference
アプリ全体のデザイン言語を決める正本。

決めるもの:
- 色
- 空気感
- Typographyの方向
- Card language
- Navigation
- 情報密度
- Heroの方向

例:
`reference/ui-master-v1.png`

## 4.2 Supplemental Reference
Masterでは細部が不足する時だけ追加。

例:
- Home下半分のcrop
- Forecast chart領域
- Settings form領域
- 画面群のsecondary concept board

### ルール
Supplemental Referenceは**適用範囲を必ず明記**する。

例:
`crop-home-lower-v1.png = Primary Card以下だけの正本`

適用範囲外を上書きしてはいけない。

---

# 5. Phase 0 — Repo Archaeology / 機能凍結

UIを1pxも変える前に調査する。

作る:
- `FEATURE_INVENTORY.md`
- `ARCHITECTURE.md`
- `UI_HANDOFF.md`

調べる:
- 技術構成
- 画面
- API
- 実データ
- 取得していないデータ
- 保存形式
- routing
- state
- offline/cache
- loading/error/empty
- tests
- DOM selector / id / aria-label / data-* の安定フック
- 公開branch
- asset
- font

## Protected Zoneを明記
例:
- score logic
- API URL
- localStorage key
- data model
- test hook
- public URL

UI作業で触ってよい範囲と触ってはいけない範囲を明示する。

---

# 6. Phase 1 — Git Safety

最低限:
1. `git status`
2. public/main branch特定
3. checkpoint tagまたはbase commit記録
4. UI専用branch作成
5. working tree状態保存

例:
```text
checkpoint/app-live-YYYYMMDD
ui/ocean-v1
```

### 重要: v1からの修正
**Design Freezeのdocs/referenceは実装前にcommitしてよい。むしろ推奨。**

理由:
Visual ReferenceとDesign Systemの基準点をGit上で固定できるため。

ただし、未レビューのUI実装本体は勝手にmainへcommit/merge/pushしない。

---

# 7. Phase 2 — Visual Direction

ChatGPTへ渡す:
- 現状スクショ
- FEATURE_INVENTORY
- アプリの目的
- 最重要タスク
- 想定端末
- 取得可能/不可能データ
- 好み
- 既存ブランド要素

## 7.1 最初は「母艦画面」
アプリを象徴し、他画面へ最も影響する1画面を選ぶ。

例:
- Home
- Dashboard
- 返信提案
- セットリスト
- 商品詳細

## 7.2 UI画像を生成
一目で「これにしたい」と思えるVisualを作る。

ただし生成画像は**UI仕様ではない**。
文言・数値・機能は信用しない。

## 7.3 Figma等の追加ツール
**デフォルトでは導入しない。**

導入するのは:
- 人間デザイナーとの共同編集
- 高度なvector asset管理
- 複雑なprototype
- design handoffが必要

など明確な便益がある場合のみ。

AI画像 → Design System → 実装AI → Screenshot比較で進むなら追加しない。

---

# 8. Phase 3 — Design Freeze

Master Referenceを保存。
Design Systemを作る。

必須:
- Color tokens
- Typography tokens
- Spacing scale
- Radius
- Surface/Card
- Shadow/Glass
- Icons
- Navigation
- Buttons/inputs
- Responsive
- Safe-area
- Motion
- Accessibility
- Asset rules
- 禁止事項

## 8.1 Asset Plan
Heroや装飾をCSSだけで無理に再現しない。

判断:
- CSS/SVGで十分 → code
- 写真/イラスト/空気感が支配的 → local image asset

画像は:
- local
- 圧縮
- 適切なformat(WebP/AVIF/PNG等)
- license確認
- 外部CDN依存を増やさない

## 8.2 Font Plan
Typographyは後回しにしすぎないが、構造より先に微調整しない。

決める:
- family
- fallback
- weight
- line-height
- letter-spacing
- tabular numbers
- 日本語と英数字の組み合わせ
- local bundleかsystem fontか
- ライセンス
- ネイティブ移植可否

---

# 9. Phase 4 — Baseline Capture

実装前に母艦画面を保存する。

必須:
- 基準端末幅
- full screenshot
- viewport screenshot
- overflow
- test結果
- network request

モバイル例:
- 360
- 390
- 430

ただし固定値ではなく**対象ユーザー端末に合わせて変更可**。

---

# 10. Phase 5 — v0.1 母艦実装

1回だけ実装する。

### Scope Lock
今回変更してよいものを列挙する。
今回変更禁止のものも列挙する。

例:
```text
変更可: Home visual layer / CSS / local asset
変更禁止: API / score / storage / other screens
```

### Change Budget
1 iterationで大きな目的は原則1〜3個。

悪い例:
- Hero
- Typography
- Navigation
- API
- Feature
- Settings
を同時変更

良い例:
- Hero再現
- Card hierarchy
- Density

完成したら**自主的にv0.2へ進まず停止**。

---

# 11. Phase 6 — Screenshot Review

Claudeの自己採点を最終判断にしない。

ChatGPT + ユーザーでReferenceと比較する。

評価:
- First impression
- Composition
- Hierarchy
- Density
- Spacing
- Typography
- Color
- Cards
- Atmosphere
- Mobile usability
- Data truth
- Reference similarity

## 最大差3点
次 iterationでは原則この3点だけ直す。

### 判断例
もしHeroが明確に弱いなら、0.5pxのTypography調整をしない。

---

# 12. Phase 7 — 差分修正のエスカレーション順

大きな差が残る時はこの順で原因を疑う。

1. Layout / hierarchy
2. Content density
3. Asset不足
4. Card/surface
5. Typography
6. Micro spacing / letter spacing

### Asset escalation rule
同じVisual gapがCSS調整1回で大きく改善しない場合、
写真・イラスト・textureなどのassetで解決できないか検討する。

「CSSだけで頑張り続ける」を避ける。

---

# 13. Phase 8 — Scoped Passes

必要なら母艦を複数Passに分ける。

推奨例:

### Pass A — Hero / 主役
Hero・score・top hierarchyだけ。

### Pass B — Density / 下半分
metrics・forecast・chart・navだけ。

### Pass C — Typography
family / weight / line-height / trackingだけ。
**body構造やspacingを変更しない。**

各Passで:
- before/after diff
- test
- screenshot
- overflow
- stop

この「工程を混ぜない」が重要。

---

# 14. 実データStress Test

綺麗な1ケースだけで評価しない。

最低限:
- 最長spot名 / 長いユーザー入力
- 最大/最小数値
- null
- 取得失敗
- stale/cache
- offline
- loading
- empty list
- partial failure
- disabled item
- 360px
- safe-area

### 文字
意味のある情報をellipsisで隠さない方針の場合、
実際の最大文字列幅を測る。

### 数字
例:
`12.5m/s`
`0.9-1.4m`
などworst-case widthを実フォントで検証する。

---

# 15. State Matrix

UI完成はhappy pathだけではない。

各主要画面で必要な状態を表にする。

| State | 必須検証 |
|---|---|
| loading | skeleton / progress |
| success | normal |
| stale | 前回データ明示 |
| offline | 再取得不能でも落ちない |
| partial failure | 一部だけ失敗 |
| total error | fake dataを表示しない |
| empty | 次actionを提示 |
| null optional data | `–` / section非表示 |
| disabled | 押せないことが見て分かる |
| destructive action | 誤操作防止 |

---

# 16. 母艦画面Freeze

ユーザーが満足し、重大差が消えたら止める。

凍結する:
- accepted screenshot
- Design System
- Typography
- assets
- navigation
- component language

`UI_HANDOFF.md`に:
`Home UI v1 = FROZEN`
等と記録。

### Diminishing Return Rule
以下なら原則止める:
- 残差が微細なfont/1〜2px中心
- 実用品質を下げる恐れがある
- 次画面へ進む方が価値が高い
- ユーザーが満足している

ReferenceがAI生成の場合、pixel-perfectを目的化しない。
**同じdesign language + 実用品質**を優先する。

---

# 17. Secondary Screen Design

母艦が凍結したら、残り画面用のconcept boardを必要に応じて作る。

ここで初めて:
- Spot
- Forecast
- Settings
- Detail
など複数画面を1枚にまとめてもよい。

### 重要
Secondary boardは**Home Design Systemに従属**する。
新しいdesign languageを作らない。

AI画像に架空データが混ざることを前提に、指示書へ必ず書く:

> この画像はVisual Referenceのみ。表示データ・機能の正本はFEATURE_INVENTORYと現行コード。矛盾時は実データを優先。

---

# 18. 残り画面の実装

母艦でdesign languageが安定していれば、複数画面を一気に実装してよい。

ただし内部Gate:
1. navigation基盤
2. Screen A
3. regression
4. Screen B
5. regression
6. Screen C
7. regression
8. integration

途中でユーザー確認のために毎回止まる必要はないが、
**内部でGateを飛ばさない。**

不安定なら従来通り1画面ずつ進める。

---

# 19. Navigation / 未実装機能

Referenceに存在しても未実装なら勝手に実装しない。

選択肢:
- 表示しない
- visual skeletonとしてdisabled表示
- 仕様確定後に別Phaseで実装

押すと架空画面へ遷移するfake interactionは禁止。

---

# 20. Mobile / Native移植ルール

Webで作ったデザインを将来ネイティブ化する場合、
CSSそのものではなく**Design TokenとAssetを移植単位**にする。

保持:
- color token
- spacing scale
- typography
- radius
- icon geometry
- assets
- state hierarchy

確認:
- safe-area
- notch / Dynamic Island等
- 44px相当以上のtouch target
- keyboard表示
- scroll
- reduced motion
- dark/light方針
- font bundle/license
- large textへの耐性

Web特有のblurやfilterに依存しすぎず、nativeで近似可能なsurfaceを優先する。

---

# 21. Asset / Git Policy

推奨:

### Git管理する
- Master Reference
- 採用するSupplemental Reference
- 採用asset
- Design System
- UI docs
- license

### 原則ignore
- 比較用一時Screenshot
- shot大量生成物
- image viewer lock/temp
- rejected experiment outputs

### 例外
採用状態のbaseline screenshotをvisual regression用に使うならcommit可。

---

# 22. Design docs同期

実装でTypographyやtokenを正式変更したら、
`DESIGN_SYSTEM.md`も同じPhase内またはFreeze時に同期する。

「コードは新仕様、文書は旧仕様」を残さない。

---

# 23. Regression / Destructive Verification

UI作業後:
- existing regression
- logic tests
- new UI tests
- no console errors
- network diff
- data persistence
- route/hash
- accessibility hooks

### Mutation check
重要な新規テストは可能なら、意図的に壊してREDになることを確認してから採用。

### Logic freeze proof
重要アプリでは、UI変更前後で
- core function範囲
- API config
- storage schema
などをdiffして不変を証明する。

---

# 24. Acceptance

共通100点例:
- First impression 15
- Design consistency 20
- Information hierarchy 15
- Typography 10
- Card/density 10
- Atmosphere 10
- Mobile usability 10
- Information accuracy 10

ただし**点数は補助**。
Claudeの自己採点90を合格根拠にしない。

最終権限:
1. User acceptance
2. Third-party Screenshot Review
3. Functional tests
4. Claude self-score

---

# 25. Stop Rule

止める:
- ユーザーが満足
- 大きなVisual gapがない
- 残差がmicro tuning中心
- 次画面の方が価値が高い
- 微調整で可読性や安定性が悪化しそう

続ける:
- 一目でReferenceと別物
- Hero/主役が弱い
- hierarchyが違う
- densityが違う
- generic AI UI感が残る

---

# 26. Public Ship Gate

公開前:
1. user screenshot approval
2. all tests PASS
3. overflow PASS
4. state matrix PASS
5. no fake data
6. external network増加なし（仕様追加が無い場合）
7. docs同期
8. git status理解済み
9. final commit
10. push / merge / publish

公開はユーザー承認後。

---

# 27. 新しいチャットでの起動文

今後は以下だけでよい。

```text
ChatGPT Libraryに保存してある
「AI UI改善マスタープロトコル v2」
を読んで、このアプリに適用してください。

会話履歴ではなく、プロトコルと今回のリポジトリ/仕様を正本にしてください。
まずPhase 0から始めてください。
```

途中再開なら:

```text
「AI UI改善マスタープロトコル v2」を読み、
このプロジェクトの UI_HANDOFF.md / FEATURE_INVENTORY.md /
DESIGN_SYSTEM.md を正本として、現在Phaseから再開してください。
```

---

# 28. Claude Code 初回命令テンプレート

```text
このアプリに AI UI改善マスタープロトコル v2 を適用します。

まだUIを変更しないでください。
Phase 0 / Phase 1だけ実施してください。

1. git status
2. current/public branch
3. checkpoint/base commit
4. UI専用branch
5. architecture
6. screens
7. APIs/data
8. unavailable data
9. persistence
10. error/loading/offline states
11. tests
12. stable DOM/test hooks
13. protected logic
14. assets/fonts
15. FEATURE_INVENTORY.md
16. ARCHITECTURE.md
17. UI_HANDOFF.md

最後に、ChatGPTへ渡すための日本語要約を出して停止してください。
UI実装は禁止です。
```

---

# 29. ChatGPT Visual Reference依頼テンプレート

```text
AI UI改善マスタープロトコル v2 のPhase 2を行います。

以下がFEATURE_INVENTORY / ARCHITECTURE / 現在Screenshotです。

このアプリの母艦画面について、商用品質のVisual Referenceを作ってください。

制約:
- 実装済み機能と取得可能データを尊重
- 架空機能をデザイン要件化しない
- AI生成画像の文字・数値は後で仕様正本と照合する
- mobile first
- genericなAIカード羅列を避ける
- まずVisual方向を決め、コードは書かない
```

---

# 30. Claude Design Freezeテンプレート

```text
採用Visual ReferenceをDesign Freezeします。

Master Referenceと適用範囲限定のSupplemental Referenceを区別してください。

作成/更新:
- DESIGN_SYSTEM.md
- UI_IMPLEMENTATION.md
- UI_ACCEPTANCE.md
- UI_HANDOFF.md
- reference/README.md

特に:
- data truth > visual reference
- protected logic/hooks
- tokens
- responsive
- asset plan
- font plan
- state matrix
- forbidden fake data/features
を明記してください。

このDesign Freeze文書と採用Referenceは、実装前checkpointとしてcommitして構いません。
まだUI実装はしないでください。
```

---

# 31. Claude v0.1テンプレート

```text
母艦画面v0.1を1回だけ実装してください。

Scope Lock:
今回変更可能な領域と変更禁止領域を作業前に列挙してください。

条件:
- protected logic変更禁止
- dummy data禁止
- Referenceの架空情報をコピーしない
- local asset優先
- existing tests PASS
- target widths screenshot
- overflow検査
- network差分検査
- git diff報告
- 自主的にv0.2へ進まない
- 未レビュー実装をmainへmerge/pushしない

完成したら停止してください。
```

---

# 32. Screenshot Reviewテンプレート

```text
Visual Referenceと実装Screenshotを破壊的に比較してください。

出力:
1. 総合評価
2. 最大差3点
3. Data truth違反の有無
4. 直さない方がよい部分
5. 次の1回だけのScope Lock
6. CSS/layoutで直すべきかassetで直すべきか
7. v0.2 Claude Code指示文

微差より大差を優先。
一度に別領域まで触らせない。
```

---

# 33. 最終原則

成功を再現するために必要なのは「完璧なプロンプト」ではなく、
**正本・変更範囲・比較画像・停止地点を毎回固定すること**。

特に重要な7原則:

1. 機能を先に凍結
2. Data truthはVisualより上
3. Master + scoped Supplemental Reference
4. 1 iteration = 1〜3個の大差だけ
5. Screenshotで第三者比較
6. 満足した画面はFreezeして触らない
7. 会話ではなくファイルで引き継ぐ

この7つを守れば、スレッドが変わっても同じ工程を再開できる。
