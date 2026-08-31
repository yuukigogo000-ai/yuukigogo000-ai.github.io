# Replier — プロンプト/スキーマ契約 v1.1(2026-09-01)

> v1.1 の変更(同日の FIX_REQUIRED): **否定形の個人事実を hard に**・**謙遜を soft に**・**日常行動の捏造を hard に**・
> **soft_risk は最終3案で最大1件**・**集計指標**と**次回費用の見積り**を追加。判定は PASS → FIX_REQUIRED → 修正済み。

**外部契約(利用者に返すもの)と内部契約(候補生成)を分ける。** 実装本体は未着手で、この文書は型・契約の正本。
関連: [SYSTEM_MAP](SYSTEM_MAP.md) / [STEP0](server/STEP0_REQUIREMENTS_OPTIONS.md) / [STEP1](server/STEP1_DESIGN_DRAFT.md) / [RESEARCH_LINE_STYLE](../RESEARCH_LINE_STYLE.md) §4.9

---

## 1. 外部契約(変更禁止)

`reply-ai-app/src/lib/prompts.ts` の **`REPLY_SCHEMA`**。利用者に見せる返信案は **必ず3案**。

- `situation`(会話の状態・1〜2文)/ `replies`(**minItems 3・maxItems 3**、各 `bubbles[1..3]` + `why`)/ `advice`
- `interest_level`(脈あり度)は **除去済み・復活させない**
- 指紋(sha256 / `export const REPLY_SCHEMA = {…} as const;` の全文):
  `2d61aecca4f43804f37863e5f65e1f025507e57964d5020d713e36e3dcaf970a`
  → `pricing_eval/tests/fact_firewall_tests.mjs` の 32 番がこの値を検査する(1バイトでも変われば落ちる)
- 送信時の注意: Anthropic の構造化出力は配列制約が `minItems` 0/1 のみ・`maxItems` 不可。
  `toStructuredOutputSchema()`(`schema_compat.mjs`)で落としてから送る。**件数の担保はアプリ側**

## 2. 内部契約(今回追加)

### 2.1 スキーマ `INTERNAL_CANDIDATE_SCHEMA`(prompts.ts)

```
candidates: 6件(必ず)
  text        : そのまま送れる返信文(1〜120字・穴埋め記号なし)
  lane        : "reaction" | "expand" | "personal_or_future"
  usedFactIds : 使った「今回有効な自分情報」の id(使っていなければ空配列)
```

### 2.2 型(`candidate_select.d.mts`)

```ts
type ReplyLane = "reaction" | "expand" | "personal_or_future";
type ReplyCandidate = { text: string; lane: ReplyLane; usedFactIds: string[] };
type EnabledSelfFact = { id: string; text: string; enabledForRequest: boolean; source: "explicit" | "verified_user_message" };
```

### 2.3 lane の役割(各2候補)

| lane | 役割 | 導出条件(本文から機械判定) |
|---|---|---|
| `reaction` | 反応・感情・軽いユーモア | 疑問で終わらず、未来/興味の語も無い |
| `expand` | 話題を広げる質問・深掘り | 疑問符・「〜ですか」・疑問詞がある |
| `personal_or_future` | 有効な自分情報を使う。無ければ未来の興味・意向 | 「〜たい」「気になる」「興味」「おすすめ」等 |

**モデルが申告した `lane` と `usedFactIds` は信用しない。** 本文から独立に導出し、食い違いは `lane_mismatch` として記録したうえで
**導出した lane を採用**する(申告違反を理由に候補を捨てない=会話品質を落とさないため)。

## 3. 事実ファイアウォール(`fact_firewall.mjs`)

3値判定。**hard_reject の候補は部分置換せず候補ごと破棄する。**

### 3.1 自由に作ってよいもの(誤停止させない)
反応・感情 / 質問 / 未来の興味・意向 / 入力話題を使った軽い冗談 / 相手の発言の言い換え / その場の感想(「食べたくなってきた」)/
「詳しく知りたい」「もう少し知りたい」「教えてほしい」「気になる」

### 3.2 根拠が要るもの(無ければ hard_reject)
過去体験・習慣/頻度・確立した好み・所有/生活状態・職業/住所/家族/交際・専門性/経験・行きつけ/渡航歴/購入歴・
固有名詞を使った個人史・**日常の行動**(洗濯/掃除/料理/買い物/仕事/通勤/ジム/映画/帰宅 等の「やった」)。
**日本語は主語が落ちるので「自分/僕/俺」が無くても検査する。**
**肯定・否定にかかわらず個人事実として扱う**(v1.1)。「行ったことがない」「食べたことがない」「観たことがない」
「読んだことがない」「買ったことがない」「持っていない」「飼っていない」「住んだことがない」「経験したことがない」も、
根拠が無ければ嘘になるので hard_reject。

根拠にできるのは次だけ:
1. 会話の中の**自分の発言**
2. **この要求で有効化され、かつ候補が `usedFactIds` で申告した**自分情報
   - 有効だが申告していない自分情報で書いた個人事実は **破棄**(`undeclared_fact_use` を記録)
   - 無効化済み・存在しない・他リクエストの fact ID は **破棄**

### 3.3 謙遜(soft_risk・hard にはしない)
「詳しくない」「よく知らない」は**事実の申告**なので ok にはしない。ただし嘘を作る向きではないので hard にもしない =
`soft_risk`(人間確認へ回す)。**非事実表現**(「詳しく知りたい」「もう少し知りたい」「教えてほしい」「気になる」)は ok のまま。

> v1.0 では否定形を一律許可していた。実出力を見直した結果、「台湾は行ったことないです」「家から出てないです」も
> 根拠のない自分の事実であり、通してよい理由が無い。**モデルの出力を通すために意味上の基準を緩めない**(発注者判断)。

### 3.4 固有名詞
| 状況 | 判定 |
|---|---|
| 入力(会話・プロフィール・文体サンプル)にある固有名詞の再利用 | 許可 |
| 入力に無い固有名詞を**質問・未来**の文脈で使う | `soft_risk`(人間確認へ) |
| 入力に無い固有名詞を**過去体験・好み**として断定 | `hard_reject` |
| `〇〇` `△△` `［店名］` などの穴埋め・「相手さん」 | `hard_reject` |

### 3.5 日常行動の捏造(hard_reject・v1.1)
根拠のない「自分がやった日常の行動」は破棄する。主語が無くても検出する。
例: 「洗濯して終わりました」「仕事が終わりました」「今帰ってきました」「料理してました」「ジムに行ってました」
「さっき買い物してきました」「家で映画を見てました」。
**相手への質問**(「仕事終わりました?」「今日は何してました?」「最近ジム行ってます?」)は誤停止させない
(節が疑問文なら自分の事実として数えない)。定型の丁寧表現(「お疲れ様でした」等)も対象外。

### 3.6 明示している限界(「完全検出」を主張しない)
- 未知の漢字・ひらがな固有名詞は取りこぼす(実在名の固定リストと言い回しのパターンしか見ていない)
- 暗黙の個人事実(固有名詞も体験動詞も日常行動語も無い作り話)は `generic_past_claim` = **soft_risk** 止まり
- スクリーンショット入力は元テキストを独立照合できない(OCR未導入)
- 自分情報との矛盾検出は現状「〜派」の食い違いだけ
- **モデル単体で捏造ゼロは保証しない**。最終判定は人間確認

## 4. 検査の順序(`validateCandidate`)
1 形式(型・長さ・lane 値・usedFactIds 型) → 2 プレースホルダ → 3 個人事実 → 4 fact ID の存在/有効/他リクエスト →
5 申告外の個人事実 → (6 重複は集合側) → 7 lane 整合 → 8 既存の禁止出力(`BANNED_RULES`) → 9 `interest_level` 混入 → 10 自動送信・操作

## 5. 3案の選抜(`selectThree` / `finalizeReplies`)

**優先順位は常に `ok` > `soft_risk` > `fallback`(v1.1)。**
- `hard_reject` は**絶対に**最終3案へ入れない(不変条件で例外にする)
- `soft_risk` は最終3案で**最大1件**(`MAX_SOFT_RISK_IN_FINAL = 1`)
- `ok` 候補が足りているなら `soft_risk` を選ばない(lane の並びより ok を優先して差し替える)
- `soft_risk` が2件以上必要になる場合は**1回だけ再生成**。再生成後も足りなければ、2件目以降の soft ではなく**決定的 fallback**
- 生成は最大2パス(`MAX_GENERATION_PASSES = 2`)。3パス目を渡したら例外(呼び出し回数を勝手に増やさない)

1. `reaction` → `expand` → `personal_or_future` の順に、有効候補から1件ずつ(`ok` を `soft_risk` より優先)
2. 追加条件: 書き出しが同じにならない / 3案が同一内容の言い換えにならない(文字bigram Jaccard < **0.72**) /
   全案が疑問符で終わらない / 既存の文体・長さ制約を維持 / **役割ラベルは UI に出さない**
3. 足りない lane があれば **最大1回だけ再生成**
4. それでも足りなければ **決定的テンプレート**(lane ごとに5種類、`FNV-1a(idempotencyKey|lane) % 5`)で補う
   - 同じ要求なら文面は必ず同じ / テンプレートも同じ検査器を通す / 既に選ばれた案と重複しない
5. 最後に不変条件を検査(**3件ちょうど・空でない・重複なし・全部質問でない**)。破れたら例外(=出荷しない)

## 6. 自分情報(今回は型と契約のみ・UI未実装)
- 既定 **無効**。今回の要求で明示的に有効化されたものだけ使える
- モデルに推測させて自分情報を追加しない / 古い自分情報を自動選択しない
- 他リクエストの fact ID は使えない / サーバーへの恒久保存は前提にしない
- 将来のブラウザ内保存案は STEP1 に記載するが、今回は実装しない

## 7. 集計指標(v1.1・`selectionMetrics`)
件数: `requestCount` / `generatedCandidateCount` / `okCandidateCount` / `softRiskCandidateCount` / `hardRejectCandidateCount` /
`selectedOkCount` / `selectedSoftRiskCount` / `selectedFallbackCount` / `requestsWithFallback` / `requestsWithSoftRisk` / `regenerationCount`
率: `fallbackReplyRate`(採用fallback ÷ **返信総数**)/ `fallbackRequestRate`(fallbackを使ったリクエスト ÷ **リクエスト数**)/
`softRiskReplyRate`(採用soft_risk ÷ 返信総数)/ `regenerationRate`(再生成回数 ÷ リクエスト数)。
**分母を取り違えない**(候補数と返信数は別物)。分母0のときは `null`(0 と書かない)。

## 8. 次の run の費用(v1.1・`estimate_next_run.mjs`)
`oneCallCost = inputTokens×inputPrice + outputTokens6Candidates×outputPrice` /
`worstCase10 = 10 × oneCallCost × 2`(2倍 = 全10ケースで1回ずつ再生成した場合)。
入力単価と出力単価を混ぜない。`outputTokens6Candidates` は「3案ぶんの実測 × 2」= **仮定**。
公式価格(official_exact)が無いモデルは**見積不能**で、0円扱いにしない。
実行可能扱いにする条件 = 対象モデル・モデルID・呼び出し経路・国内destination・公式価格が揃い、かつ**人間の GO**。

## 9. 変更するときの手順
1. この文書 → `prompts.ts` / `fact_firewall.mjs` / `candidate_select.mjs` の順に直す(片方だけ直さない)
2. `node pricing_eval/tests/fact_firewall_tests.mjs`(50件)と
   `node pricing_eval/tests/mutate_fact_firewall.mjs`(**ソースを実際に壊す変異43件**)を通す
3. 外部 `REPLY_SCHEMA` を変える場合は発注者の GO が要る(3案固定は固定事項)
