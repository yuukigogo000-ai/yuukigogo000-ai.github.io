# Replier — プロンプト/スキーマ契約 v1.0(2026-09-01)

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
反応・感情 / 質問 / 未来の興味・意向 / 入力話題を使った軽い冗談 / 相手の発言の言い換え / その場の感想(「食べたくなってきた」)

### 3.2 根拠が要るもの(無ければ hard_reject)
過去体験・習慣/頻度・確立した好み・所有/生活状態・職業/住所/家族/交際・専門性/経験・行きつけ/渡航歴/購入歴・
固有名詞を使った個人史。**日本語は主語が落ちるので「自分/僕/俺」が無くても検査する。**

根拠にできるのは次だけ:
1. 会話の中の**自分の発言**
2. **この要求で有効化され、かつ候補が `usedFactIds` で申告した**自分情報
   - 有効だが申告していない自分情報で書いた個人事実は **破棄**(`undeclared_fact_use` を記録)
   - 無効化済み・存在しない・他リクエストの fact ID は **破棄**

### 3.3 例外(安全側なので許可)
**否定形**(「行ったことない」「詳しくない」「まだ開拓できてない」)は、嘘の事実を作る向きではないので許可する。
Opus 5 が実測で最も良かった型(「詳しくないので逆に教えてほしい」)を殺さないための判断。

### 3.4 固有名詞
| 状況 | 判定 |
|---|---|
| 入力(会話・プロフィール・文体サンプル)にある固有名詞の再利用 | 許可 |
| 入力に無い固有名詞を**質問・未来**の文脈で使う | `soft_risk`(人間確認へ) |
| 入力に無い固有名詞を**過去体験・好み**として断定 | `hard_reject` |
| `〇〇` `△△` `［店名］` などの穴埋め・「相手さん」 | `hard_reject` |

### 3.5 明示している限界(「完全検出」を主張しない)
- 未知の漢字・ひらがな固有名詞は取りこぼす(実在名の固定リストと言い回しのパターンしか見ていない)
- 暗黙の個人事実(固有名詞も体験動詞も無い作り話)は `generic_past_claim` = **soft_risk** 止まり
- スクリーンショット入力は元テキストを独立照合できない(OCR未導入)
- 自分情報との矛盾検出は現状「〜派」の食い違いだけ

## 4. 検査の順序(`validateCandidate`)
1 形式(型・長さ・lane 値・usedFactIds 型) → 2 プレースホルダ → 3 個人事実 → 4 fact ID の存在/有効/他リクエスト →
5 申告外の個人事実 → (6 重複は集合側) → 7 lane 整合 → 8 既存の禁止出力(`BANNED_RULES`) → 9 `interest_level` 混入 → 10 自動送信・操作

## 5. 3案の選抜(`selectThree` / `finalizeReplies`)
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

## 7. 変更するときの手順
1. この文書 → `prompts.ts` / `fact_firewall.mjs` / `candidate_select.mjs` の順に直す(片方だけ直さない)
2. `node pricing_eval/tests/fact_firewall_tests.mjs`(35件)と
   `node pricing_eval/tests/mutate_fact_firewall.mjs`(**ソースを実際に壊す変異24件**)を通す
3. 外部 `REPLY_SCHEMA` を変える場合は発注者の GO が要る(3案固定は固定事項)
