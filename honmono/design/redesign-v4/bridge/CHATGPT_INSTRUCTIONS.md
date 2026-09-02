# CHATGPT DESIGN AUTHORITY — 依頼書

UI REDESIGN PIPELINE v4.0 / Phase 4
対象製品: **HONMONO**(日本語の静的Webツール群)
依頼元: Claude Code(実装者。Design Authority ではない)

---

## 1. あなたの役割

あなたは **Design Authority** です。

この依頼における **Visual / Interaction / Motion の決定権は、すべてあなたにあります。**

- Visual Direction
- Color Personality
- Typography Personality
- Composition
- Visual Metaphor
- Signature Visual Element
- Decorative Treatment
- Brand Atmosphere
- Icon Language
- Motion Personality
- 情報構造(11画面をどう束ねるか・何を主操作にするか・何を格下げするか)

これらは**依頼元が決めません**。あなたが決めて、決めた理由とともに返してください。

依頼元(Claude Code)がやるのは、

- 製品の機能・状態・文言の事実を正確に渡すこと
- あなたの決めたデザインを、機能を壊さずコードへ翻訳すること
- 機能・状態・レスポンシブ・モーション・性能を機械検証すること

だけです。**依頼元は「自分ならこうする」というデザイン変更を加えません。**

---

## 2. あなたに渡していないもの(意図的)

この依頼には、次のものが**入っていません**。

- 現行UIのスクリーンショット
- 現行のCSS
- 現行の配色・書体・余白・面の丸み・視覚的階層
- 現行の画面構成・構成要素の並び
- 現行のデザインを形容する言葉

**現在の見た目に引きずられずに決めていただくためです。**

したがって「今のこれを活かして」「この構成を踏襲して」という前提は一切ありません。
ゼロから決めてください。

なお、製品名 **HONMONO** の表記だけは固定です(ローマ字大文字)。
ロゴのビジュアルは**存在しないので、必要なら新規に定義してください**。

---

## 3. 同梱物

| ファイル | 中身 |
|---|---|
| `BLIND_DESIGN_BRIEF.md` | **最初に読んでください。** 製品の事実・利用者・思想・画面・配置制約・技術制約 |
| `PRODUCT_TRUTH.json` | 製品の目的・利用者・能力・経路・データの流れ・プライバシーの事実 |
| `FUNCTION_FREEZE.json` | 全ユーザー機能(F-ID)。**削除・追加・意味変更は不可** |
| `SCREEN_STATE_INVENTORY.json` | 全状態(S-ID)。**すべてに見せ方が必要** |
| `FUNCTION_PRESENCE_CONTRACT.json` | 各能力が「どこで認識される必要があるか」だけを定めた契約。表示方法は指定していない |
| `REQUIRED_COPY.json` | 必ず入る文言。`verbatim`(1文字も変えられない)と `meaning`(意味を弱めなければ書き換え可)がある |
| `TRUST_AND_SAFETY_FACTS.json` | 実測値・必須の開示・害のモデル。**数値は丸めない** |
| `TECHNICAL_CONSTRAINTS.json` | 実装可能性の境界。**ここを外れた案は実装できません** |
| `DESIGN_RETURN_SCHEMA.json` | 返却物の形式(必須ファイル・必須セクション・上限) |
| `DESIGN_RETURN_BINDING.json` | この依頼の識別子と各ファイルのハッシュ |

---

## 4. 特に効く制約(ここを外すと実装できません)

1. **外部からの読み込みが一切できません。** CSP で外部オリジンの script / style / **font** / image / fetch が全てブロックされます
   → **Webフォントは使えません。** OS標準フォントのスタックで成立させてください
   → 外部アイコンフォント・外部アイコンライブラリも使えません
2. **新しい実行時ライブラリを増やせません。** モーションは **CSS と Web Animations API** の範囲です
3. **人物・顔・手を描いた画像は一切使えません。** 抽象図形・幾何学模様・器具/レンズ等のモチーフ・自作の図解は可
4. **文字階層は5段以内、面の丸みは3種以内**(依頼元のプロジェクト規則)
5. **light と dark の両方**を、それぞれ独立に定義してください。片方の色をそのまま流用しないでください
6. **`prefers-reduced-motion` 対応は必須**
7. 検証幅は **360 / 390 / 430**。**利用者の大半はスマートフォンです**
8. 日本語が主言語。長文・長い固有名詞・数表が崩れないこと

---

## 5. 特に決めていただきたいこと

依頼元では決められない(決めてはいけない)ものです。

1. **11画面をどう束ねるか。** 一般利用者と法人では必要な画面がまったく違います
2. **`CHECKER` の結果画面の情報設計。** 結論・根拠・生データ・次の手・限界を、素人が読めて玄人も満足する形にすること
3. **「断定しないが、行動は決められる」の見せ方。** これがこの製品の核心です
4. **`AICHECK` の22項目(リスク18 + 信頼4)**を、スマートフォンで最後まで進ませる形
5. **実験機能(90MB・別枠・参考値)を、本判定と混同させない扱い**
6. **「判定材料なし」(最も多い結果)が、失敗にも安心にも見えない見せ方**
7. **`CREATORS` の掲載0件**を、空虚ではなく募集中として成立させる形
8. **端末内で完結する(データを送らない)という差別化**を、文章以外でも伝える方法

---

## 6. 返していただくもの

`DESIGN_RETURN_SCHEMA.json` が正式な形式です。ZIP のルート直下に置いてください。

**文書(必須)**

- `DESIGN_DECISION.md`
- `DESIGN_SYSTEM.md`
- `SCREEN_SPEC.md`
- `MOTION_SPEC.md`
- `ASSET_MANIFEST.json`
- `DESIGN_RETURN_BINDING.json`

**ビジュアル(必須)**

- `HOME_MASTER` — 390幅・light と dark
- `TASK_MASTER` — 390幅・light と dark(最低でも `CHECKER` の結果表示を含む)
- `STATE_VISUALS` — `CHECKER` の6結論 / 根拠の4段階 / 画素判定の3段階 / `AICHECK` の3帯 / 待ち / 空 / エラー

**画面の役割分担**

- `HOME` = **BRAND_CRITICAL**(visual impact / worldbuilding を優先)
- `CHECKER` / `AICHECK` / `BADGE` / `CREATORS` = **TASK_CRITICAL**(clarity / hierarchy / trust / task completion を優先)
- `REPORT` / `BUSINESS` / `DOCS` / 法務3文書 = **DOCUMENT**

**HOME の装飾密度を Task 画面へ機械的にコピーしないでください。**
ただし Color Language / Typography Family / Signature Motif / Icon Language /
Surface Language / Motion Character は**同一の Design Language**を保ってください。

---

## 7. モーションについて

すべてのモーションは、次の3つのいずれかの目的を持つ必要があります。

1. **Feedback**(操作に応えた)
2. **State Transition**(状態が変わった)
3. **Brand Motion**(この製品らしさ)

目的が3つのどれでもないモーションは採用できません。

避けてください:

- 不要な無限アニメーション
- レイアウトを動かすプロパティのアニメーション
- 大面積の animated blur
- スクロール乗っ取り
- 利用者の操作をブロックする長さのモーション
- 同時多発的なモーション

**この製品には、メインスレッドが重くなる区間が2つあります**
(ファイル解析中と、端末内でのモデル推論中)。
その区間のモーションは、CSS だけで完結し、JavaScript の停止に影響されないものにしてください。

---

## 8. 書いてはいけないこと

デザイン上の説得力のために、存在しない事実を足さないでください。

- 利用者数・導入実績・受賞歴・顧客ロゴ・推薦の声(**すべて存在しません**)
- 認証・認定・公的機関・第三者監査(**第三者による再測定は行われていません**)
- 有料プラン・課金・トライアル(**全ツール無料**)
- `TRUST_AND_SAFETY_FACTS.json` の `measured_numbers` に無い精度の数値
- 「AI生成でないことを証明できる」という主旨の表現
- 判定に対する「100%」「確実に」「必ず」

---

## 9. 未定義の項目があった場合

依頼元は**未定義の Design Decision を自分で補完しません**。

決めきれなかった項目は、`DESIGN_RETURN_BINDING.json` の
`unresolved_design_questions` に列挙して返してください。
その項目は、あなたへ質問として戻ります。

---

## 10. 返却後に起きること

1. 依頼元が **Design Return Verify** を行います(機械的な整合性のみ。**デザインの良し悪しは評価しません**)
2. 通れば Design Freeze。以後、依頼元は独自のデザイン変更を行いません
3. 実装 → 機能/状態/レスポンシブ/実行時/モーション/性能の自動検証
4. 実装後のキャプチャとモーションの証跡をまとめ、**最終 Design Intent Review** をあなたへ依頼します
   - 見るのは **PIXEL PERFECT ではなく DESIGN INTENT FIDELITY** です
   - 返せるのは `PASS`(REPAIR_SCOPE = NONE)または **最大3件の IMPLEMENTATION_GAP** です
   - 微小な余白差・数ピクセルの位置差・実文言の長さによる自然な流れの差・ブラウザ差は、修正理由になりません
