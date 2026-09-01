# Replier — 設計図+説明書(SYSTEM_MAP)v1.1 / 2026-09-01

**このファイルが入口。** Replier(返信コーチPWA)と、その料金決定用モデル評価基盤 `pricing_eval/` の
「今どうなっているか・どこに何があるか・どう動かすか・何を守るか・次に何を判断するか」を1枚にまとめた引き継ぎ文書。
次の担当(別モデルの Claude を含む)は、まずこれを読み、細部は各正本(§9)へ飛ぶ。

- リポジトリ: `yuukigogo000-ai.github.io`(public)/ 作業ブランチ **`claude/replier-pricing-decision-sh97a2`**(worktree `AI_WORKSPACE\ygo-replier-pricing`)
- 最終コミット: この文書と同じコミット(履歴は `git log --oneline`)。`main` には未マージ(**main へ push = 公開**なので Codex PASS 前に merge しない)
- 用語: 「発注者」= このリポジトリの所有者(ユーザー)。「GO」= 発注者の明示の許可

---

## 0. 30秒で分かる現在地

| 項目 | 状態(2026-09-01 深夜) |
|---|---|
| 公開状況 | **Replier は公開停止中**(`/reply-ai/` は告知ページ+墓標SW のみ)。理由: BYOK(利用者のAPIキーを localStorage に預かる)構成のまま公開し続けるのは危険 |
| 次の形 | **サーバー側プロキシ化**(AWS 東京・API Gateway+Lambda・Cognito メールOTP・DynamoDB・Stripe)。工程0/1 の文書まで完了・**実装は未着手**(発注者の「実装本体に着手しない」指示が継続中) |
| 採用AIモデル | **未定**。Kimi K2.5=不採用(人間確認で捏造5/5)・Qwen3 VL 235B=不合格(10件評価を5件目で停止)・**Opus 5(Anthropic API 直接)=自動10/10・固有名詞捏造0/10・軽い自己事実の作り込み5/10 → 採用は発注者判断待ち** |
| 料金 | PRICING.md v3.3=**暫定**(月1,480円・ローンチ980円×3か月・生涯3回無料・月150回/日20回・追加枠なし)。原価が Opus 5 なら約4.8円/回=原価率約47%で見直し要 |
| 評価予算 | 10,000円枠。予算計上 **$2.09≈335円**(記録済み $1.61834135 + 費用不明 worst-case $0.4739328。うち4件≈$0.44 は実際は非課金の 4xx) |
| 生成方式 | **2026-09-01 変更: 事実ファイアウォール+内部6候補→3案**(禁止語を増やす方式は撤回)。契約 = `docs/CONTRACT_PROMPT_SCHEMA.md`。実装は共有 lib のみで、**本番UI・サーバーへの結線は未着手**。新方式でのモデル実測は未実施(GO待ち) |
| 本番バグ | 2026-08-31 実射で **2件発見・修正済み**(構造化出力が `minItems/maxItems=3` を拒否 / claude-opus-5 が `temperature` を拒否)。3案固定コミット以降、再公開していれば全リクエスト失敗だった |

---

## 1. これは何か(製品)

- マッチングアプリ〜LINE移行後の会話で、**本人の文体を真似た返信3案+次の一手**を返す男性向けコーチアプリ(PWA・React+Vite)
- 入力: 会話テキスト or スクショ最大6枚、相手プロフィール、文体サンプル、ゴール
- 出さないもの(決定済み): 脈あり度・人物評価・感情推定・自動送信。**「AIによる返信案です。内容が事実と合っているか確認してから使用してください。」を結果画面に常設**
- 最大の品質課題 = **入力に無い固有名詞・体験談の捏造**(送った本人が次のターンで答えられなくなる)。規則・検出器・モデル選定の3層で扱う(§4)

## 2. 地図(どこに何があるか)

```
reply-ai-app/                      … 本番アプリのソース(React+Vite)。ビルドが要るのはここだけ
  src/lib/prompts.ts               … ★正本: REPLY_SYSTEM(指示書 約4,700字)・REPLY_SCHEMA(minItems/maxItems=3)・PROFILE_*
  src/lib/api.ts                   … Anthropic Messages API 直接呼び出し(model claude-opus-5・max_tokens 16000・
                                      output_config json_schema・system cache_control・temperature は送らない)
  src/lib/schema_compat.mjs(+d.mts)… toStructuredOutputSchema: API に送る schema から minItems>1/maxItems を落とす(共有実装)
  src/lib/ungrounded.mjs(+d.mts)   … 固有名詞の検出器(停止層+補助候補層)。UI と評価器で単一実装
  src/lib/fact_firewall.mjs(+d.mts)… ★事実ファイアウォール(嘘になる個人事実だけを止める。3値判定・PLACEHOLDER_RE の正本)
  src/lib/candidate_select.mjs(+d.mts) … ★内部6候補(3lane×2)の検査と最終3案の選抜・決定的 fallback
  docs/CONTRACT_PROMPT_SCHEMA.md   … ★プロンプト/スキーマ契約(外部3案は不変・内部候補・検査順・限界)
  src/components/ReplyTab.tsx      … 返信タブ(結果表示・#ungroundedNote・#aiNotice・3件切り詰め/不足注記)
  src/components/ReplyCard.tsx     … 1案カード(コピー。article onClick+内側ボタン stopPropagation)
  src/App.tsx                      … タブ・トースト・採用履歴(onAdopt)
  tests/e2e.test.js                … Playwright e2e 139項目(モックAPI)。実行法は §6
  PRICING.md                       … 料金決定資料 v3.3(暫定)。Desktop に副本
  RESEARCH_LINE_STYLE.md           … 指示書の根拠と改訂記録(§4.5〜4.8 が捏造対策・脈あり度除去・3案固定・モデル評価)
  docs/server/STEP0_*.md, STEP1_*.md … サーバー側プロキシ化の工程0(要件・決定)/工程1(設計たたき台)v0.4
  docs/ui/WO_UI_replier_reply.md   … UI 工程の作業指示(UI は Autonomous Pilot で完了済み)
reply-ai/                          … ★墓標(公開中の告知ページ+旧PWA解除用 sw.js)。ビルド出力をここに出さない(§7)
pricing_eval/                      … 料金決定用のモデル評価基盤(Node・依存は playwright-core のみ)
  README.md                        … 説明書(コマンド一覧)。この SYSTEM_MAP が上位
  src/fidelity_eval.mjs            … ★本番プロンプト追従テスト=確証run(Bedrock tool-use / Anthropic 直接)。実行前 fail-closed 再確認・
                                      1回再生成・停止規律・合格条件・遅延分位点
  src/run_eval.mjs                 … 旧: 中立契約での smoke/full(3モデル120ケース比較)。readResults/contractStopError を共用
  src/adapters/bedrock.mjs         … Converse(SigV4 自前署名)・named profile 対応 / anthropic.mjs … Messages API / mock.mjs
  src/lib/call_log.mjs             … ★呼び出し台帳(STARTED→SUCCEEDED/FAILED、UNKNOWN=worst-case、recordedSpendUsd 突合、予約式予算ガード)
  src/lib/ledger.mjs               … 実行台帳(model×case×dataset/prompt/config ハッシュ。成功済み再実行なし)
  src/lib/fidelity_checks.mjs      … schema 解析・文体規則・PLACEHOLDER_RE・停止理由・捏造検査/補助候補
  src/lib/config.mjs               … 設定(config.json は gitignore。config.example.json が雛形)
  src/calculate_cost.mjs           … 価格読み込み(snapshot+override)・usage→USD(cache 単価対応)
  src/human_review_page.mjs        … 人間確認ページ生成(全件・入力/出力/フラグ/補助候補の再計算)
  src/generate_cases.mjs           … 合成データ120ケース(seed 固定)→ cases.json / generate_cases_fab10.mjs → cases_fab10.json(捏造耐性10件)
  src/retention_preflight.mjs, discover_models.mjs, smoke_guard.mjs, toolconfig_probe.mjs, blind_review_page.mjs … 探索・前提確認
  pricing_anthropic.json           … Anthropic 直接経路の公式価格(Opus 5 $5/$25・cache 6.25/0.5・出典URL)
  pricing_override.json            … gitignore。Bedrock 側 Opus 5 の推定価格(derived_estimate)。人間の公式確認で差し替え
  evidence/                        … 価格 snapshot・モデルカード・規約(機械/人間の証拠)
  runs/                            … ★gitignore。全 run の results.jsonl / run_manifest / fidelity_summary / stop_reason、call_log.jsonl、ledger.jsonl、
                                      _discovery/(candidate_discovery・preflight)、_summary/(human_review_*.html・call_counts.json)
  fixtures/saved_problem_outputs.json … 実runの問題出力の写し(回帰用。runs/ は gitignore・改変しない)
  src/candidate_review_page.mjs    … 内部6候補→3案の人間確認ページ生成
  tests/run_tests.mjs(74件・--mutate で53件が落ちる)/ tests/destructive.mjs(21件)
  tests/fact_firewall_tests.mjs(35件)/ tests/mutate_fact_firewall.mjs(**ソースを実際に壊す変異24件**)
tests/                             … サイト全体の検査(reply_ai_tombstone.mjs・csp_check.mjs・site_surface.mjs 等。CLAUDE.md 参照)
```

## 3. データの流れ(図)

```
[本番アプリ]  入力(会話/スクショ/プロフィール/文体/ゴール)
   → ReplyTab が user prompt を組む(buildProductionUserPrompt と同形)
   → api.ts: POST https://api.anthropic.com/v1/messages
        model claude-opus-5 / system=REPLY_SYSTEM(cache_control) / output_config json_schema=toStructuredOutputSchema(REPLY_SCHEMA)
        max_tokens 16000 / temperature なし / x-api-key=利用者のキー(現状 BYOK → プロキシ化で Lambda 側へ)
   → JSON parse → replies を先頭3件に切り詰め(3件未満は注記・0件はエラー)
   → ungrounded.findUngroundedNames で ⚠ 警告(ブロックしない)+ #aiNotice 常設
   → カードをタップでコピー → 採用履歴(localStorage・文体学習の材料)

[評価器 fidelity_eval]  cases.json / cases_fab10.json(合成データのみ。generated_by で強制)
   → 実行前 fail-closed 再確認(§5)→ 各ケース: STARTED を台帳へ → 呼び出し(Bedrock Converse+toolConfig / Anthropic 直接)
   → SUCCEEDED/FAILED(費用は usage から。null なら worst-case)→ parseProductionReply → checkStyleRules(+placeholder)
   → checkUngroundedNames(停止層)+ checkFabricationHints(補助候補)→ 違反なら1回だけ再生成(初回違反は独立記録)
   → 最終違反1件で停止(stop_reason.json)/ 初回違反上限で停止 → results.jsonl → fidelity_summary.json(合格判定)
   → human_review_page.mjs で全件を人間確認ページへ(**自動評価だけで捏造ゼロと断定しない**)
```

## 4. 決定台帳(日付順・変えるときは発注者 GO)

| 日付 | 決定 | 根拠/場所 |
|---|---|---|
| 08-25 | Replier 公開停止(BYOK 危険)。墓標SW配備 | memory `replier-status` |
| 09-01 | **脈あり度(interest_level)を製品から除去**(prompt/schema/UI/評価器)。situation は会話の状態のみ・感情断定なし | RESEARCH §4.6・Codex r3 PASS |
| 09-01 | **3案固定**: schema minItems/maxItems=3 +(c)説明文/プロンプト「必ずちょうど3件」+サーバー側検査+**プレースホルダ禁止**(○○等)。3件未満/禁止出力/未解決プレースホルダは1回だけ再生成、再失敗はエラー(回数非消費) | RESEARCH §4.7・STEP0 §0 |
| 09-01 | 呼び出し台帳 STARTED/終端・UNKNOWN=worst-case・invalidOutput 保存は合成データのみ | call_log.mjs・Codex r4〜r9(会計監査 **r9 PASS で完了・追加ラウンドなし**) |
| 09-01 | サーバー構成: AWS東京 / Regional REST API+Lambda(**条件付き**: 次runの p95≤55秒&120秒超0→60秒同期候補 / 55〜110秒→180秒申請検討 / 120秒超再発→非同期)/ Cognito メールOTP / DynamoDB(本文・画像・返信は保存しない)/ **S3なし** / 履歴はブラウザ内 / CAPTCHA初期なし・WAF先行 / **追加枠販売なし**(上限到達は次回更新待ち)/ ドメインは設定値 / ブラウザ側 6枚・長辺1600px・JPEG/WebP・合計4.5MB / 回数は予約→確定→返却・同時1件・月150/日20成功+月180/日25試行 / idempotency 応答は**ブラウザ保有鍵で暗号化した暗号文だけ**を DynamoDB に最大10分(ack で即削除+TTL) | STEP0 v0.4 §0・STEP1 v0.4 |
| 09-01 | A+C: temperature 0.7→**0.2**(**Bedrock 系モデルのみ。claude-opus-5 は temperature 非対応で送らない**)+本番同様1回再生成(初回違反率は独立記録) | 6c9dcf7・a034414 |
| 09-01 | **Kimi K2.5 不採用**(規則強化+0.2 でも人間確認で捏造5/5)。追加調整・再実行なし | PRICING v3.2 |
| 09-01 | プロンプトに NG→OK 例5分類(飲食/旅行/本・映画/趣味・ブランド/個人体験・固有名詞を使わない) | prompts.ts「誠実さ」節 |
| 09-01 | **検出器拡張は補助候補に限定**(完全検出を主張しない)。停止層=カタカナ体験文脈・施設接尾辞・例文名・有名チェーン/ブランド固定リスト・プレースホルダ(「相手さん」含む)。補助層=地名+店名・体験談言い回し・地名リスト・自己申告 | ungrounded.mjs・RESEARCH §4.8 |
| 09-01 | **Qwen3 VL 235B 不合格**(10件評価を5件目で停止。人間確認で4件中3件に捏造) | run `fidelity_tooluse_qwen_fab10` |
| 08-31深夜 | **Opus 5 は Anthropic API 直接で評価**(B 経路)。Bedrock の Opus 5 は評価用 IAM で InvokeModel 未許可(ポリシー拡大はしない) | run `fidelity_anthropic_opus5_fab10_r4` |
| 08-31深夜 | 本番修正: `toStructuredOutputSchema` を送信時に適用 / api.ts から temperature 削除 | a034414・e2e 4f2 |
| 09-01 | **事実ファイアウォール+内部6候補→3案**。反応・質問・未来の興味は自由/個人事実だけ根拠必須/固有名詞は文脈で hard・soft を分ける/不正候補は部分置換せず破棄/不足 lane は1回再生成→決定的テンプレート/自分情報は既定無効・申告制。**外部 REPLY_SCHEMA は不変(指紋 2d61aecc…)** | CONTRACT_PROMPT_SCHEMA.md・RESEARCH §4.9 |

## 5. 守ること(絶対ルール)

1. **モデル呼び出し=実課金。1 run ごとに発注者の GO が要る。** 自分から新しい run を打たない。30件・100件へ「自動で進まない」
2. **fail-closed**: 実行前再確認(東京/retention none/主体 `****1901 …user/replier-eval-cli`/dataset ハッシュ/予算≤10,000円/`--prior-spent-usd` が `recordedSpendUsd()` と完全一致/台帳健全)に1つでも欠ければ**呼び出しゼロで止まる**。緩めない
3. **合成データのみ**(`generated_by` で強制)。Anthropic 直接経路は retention none ではないので `--accept-provider-retention` の明示が要る
4. **秘密**: AWS 資格情報・Anthropic キーを表示/ログ/成果物/git に出さない。キーは `~/.anthropic/replier_eval.key`(リポ外)か env。Account ID は `****1901` 表記のみ。IAM 拡大・契約操作はしない。OS 永続環境変数を変えない
5. **人間確認が最終判定**: 自動評価の「捏造候補0」は検出器の範囲内の話。全件を人間確認ページで読み、結果を発注者へ出す。**自分の検査結果を自分で採点して甘くしない**
6. **git**: `git reset --hard`/checkout 破棄/無断削除禁止。raw 応答(runs/)をコミットしない。他 worktree・dirty checkout に触れない。テストは書いたら必ずコミット
7. **公開前**: Codex 破壊的検証 PASS・e2e 21e2 の根治か隔離・プライバシーポリシー。main へ push しない
8. **台帳の手直しは発注者 GO**(4xx 非課金分の $0 精算も含む)。手で行を消さない

## 6. 手順書(コマンド。すべてリポジトリ直下 `C:/Users/gogyo/AI_WORKSPACE/ygo-replier-pricing` で)

```bash
# --- 検査(変更したら全部回す) ---
node pricing_eval/tests/run_tests.mjs                 # 74/0 が正常
node pricing_eval/tests/run_tests.mjs --mutate        # 「期待どおり N 件が落ちました」(現在 54)= 検査器が効いている証明
node pricing_eval/tests/destructive.mjs               # 21/0
node pricing_eval/tests/fact_firewall_tests.mjs      # 35/0(事実ファイアウォール+6候補→3案)
node pricing_eval/tests/mutate_fact_firewall.mjs     # 変異24/24 検出(ソースを実際に壊して確認)
node pricing_eval/src/candidate_review_page.mjs      # 人間確認ページ(内部候補・reject理由・最終3案)
(cd reply-ai-app && npx tsc -b --noEmit)              # 型検査
# ビルドは必ず scratchpad へ(reply-ai/ 墓標を汚さない)→ 汚れていないことを確認
(cd reply-ai-app && npx vite build --outDir "<scratchpad>/site/reply-ai" --emptyOutDir) && git status --short reply-ai/
# e2e: <scratchpad>/site で python -m http.server 8778 を起動してから
(cd reply-ai-app && PW_CHROMIUM="C:\Users\gogyo\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe" node tests/e2e.test.js)   # 139/139

# --- 費用の現在値(次 run の --prior-spent-usd はこの recordedSpendUsd を渡す) ---
node -e "import('./pricing_eval/src/lib/call_log.mjs').then(m=>{const r=m.recordedSpendUsd('pricing_eval/runs');console.log(r.sum, m.unaccountedWorstCaseUsd(m.loadCallLog().rows))})"

# --- 確証run(Anthropic 直接・Opus 5・10件。GO 必須) ---
node pricing_eval/src/fidelity_eval.mjs --provider=anthropic --models=claude-opus-5 --accept-provider-retention --omit-temperature --output-max-tokens=16000 \
  --dataset=pricing_eval/cases_fab10.json --dataset-hash=4e0c6da47a2da289a830da0d5afcd06c7fd0e71ce67c4b74e7d5ecd029e86c72 \
  --per-category=2 --expected-cases=10 --pass-criteria=confirm10 --confirm-run --stop-on-violation --regenerate-once --max-first-violations=1 \
  --retry-transient-only --max-retries=1 --usd-jpy=160 --prior-spent-usd=<recordedSpendUsd()> --run-id=<新しいID>

# --- 確証run(Bedrock・tool-use。AWS は子プロセスで環境変数を外し profile だけ渡す) ---
export PATH="$PATH:/c/Program Files/Amazon/AWSCLIV2"
env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN -u AWS_BEARER_TOKEN_BEDROCK AWS_PROFILE=replier-eval AWS_REGION=ap-northeast-1 \
  node pricing_eval/src/fidelity_eval.mjs --models=<modelId> --confirm-run --tool-use --stop-on-violation --regenerate-once --temperature=0.2 \
  --dataset=... --dataset-hash=... --per-category=... --expected-cases=... --pass-criteria=confirm10|confirm30 --max-first-violations=... \
  --retry-transient-only --max-retries=1 --usd-jpy=160 --prior-spent-usd=<recordedSpendUsd()> --run-id=<新しいID>
# 30件(cases.json・6区分×5・前回と重複しない次の5件)は --case-offset=5 --pass-criteria=confirm30 --max-first-violations=3(dataset 省略=既定)

# --- 人間確認ページ(全件。Desktop へコピーして発注者に見せる) ---
node pricing_eval/src/human_review_page.mjs --run-id=<runId> --dataset=pricing_eval/cases_fab10.json --max-regenerated=1

# --- データセット再生成(sha256 が表示される。--dataset-hash に転記) ---
node pricing_eval/src/generate_cases_fab10.mjs

# --- Codex 破壊的検証(読み取り専用サンドボックス。prompt は標準入力で) ---
codex exec --sandbox read-only -C C:/Users/gogyo/AI_WORKSPACE/ygo-replier-pricing - < <prompt.txt>
```

## 7. 落とし穴(全部実測)

- **Windows の Bash ヒアドキュメントはバックスラッシュを潰す** → 正規表現/JS を含む編集は Write ツールでスクリプトを書いて `python -X utf8` で適用
- **Bash の cwd は呼び出しごとにリセット**(`reply-ai-app` に cd したまま次のコマンドを打つと module not found)。毎回リポ直下から
- run 終了後の `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` は Node/Windows の終了時クラッシュで**結果には無害**(results/台帳は書けている)
- **同じ run-id を再利用しない**: results.jsonl にある case は失敗行でも doneKeys でスキップされる。やり直しは新 ID
- `--prior-spent-usd` は `recordedSpendUsd()` と 1e-6 で一致が必要。費用不明 worst-case は評価器が自動加算するので**足さない**
- Vite build は `--outDir` を指定しても `reply-ai/` に一部生成物が漏れることがあった → ビルド後は必ず `git status reply-ai/`
- **Anthropic 構造化出力**: 配列は `minItems` 0/1 のみ・`maxItems` 不可(400)。`toStructuredOutputSchema` を必ず通す
- **claude-opus-5**: `temperature` を送ると 400。Bedrock 側の 0.2 設定と混同しない
- 評価の `max_tokens` 既定 1024 は Opus 5 で途中切れ(`max_tokens_truncated`)。本番同値 16000 を渡す
- Bedrock の `anthropic.claude-opus-5` は global プロファイルのみ(国内固定なし)+評価用 IAM で InvokeModel 未許可 → 403(非課金だが台帳は worst-case 計上)
- 検出器の誤停止例: 「カレー屋」「ミステリー」「1トピック」「自分パン屋」→ 直した。新しい誤検知は停止層でなく補助層で受ける
- e2e **21e2 は不安定**(成功トースト「(改行区切り)」と失敗エラーが同時表示=onAdopt が2回呼ばれている痕跡。ReplyCard の article onClick と内側ボタンの二重発火が疑い)。公開前に根治か隔離
- 変異テストは「変異の元文字列が1箇所あるか」を必ず確認する(無言で何も壊さない変異=常に緑、を防ぐ)。実際、最初に書いた自動送信の変異は `(?!)` を選択肢の先頭に足しただけで無効化になっておらず、MISSED として露見した
- 4xx(403/400)は非課金だが台帳契約では「費用 null の終端=worst-case」。**手で消さず**発注者 GO で精算行を入れる

## 8. 数値ファクト(2026-09-01)

| モデル(経路) | 10件の自動評価 | 人間確認: 固有名詞/店名/ブランド捏造 | 人間確認: 固有名詞なしの自己事実 | 1回原価(実測) | latency p50/p95 |
|---|---|---|---|---|---|
| Kimi K2.5(Bedrock tool-use) | 07×5 は通過 | 5/5 | 多数 | 1.03円 | 5.8s / 7.5s |
| Qwen3 VL 235B(Bedrock tool-use) | 5件目で停止 | 4件中3件 | 多数 | 約0.43円 | 約5s |
| **Opus 5(Anthropic 直接)** | **10/10** | **0/10** | **5/10(軽度)** | **約4.8円**(cache read) | **23.8s / 29.5s** |

- 呼び出し総数(旧比較〜確証): 506+以後の確証・診断分。正本 `runs/*/results.jsonl`・`_summary/call_counts.json`
- 予算計上 $2.09≈335円 / 記録済み $1.61834135(次の prior)/ 費用不明 worst-case $0.4739328(6件。うち4件は非課金 4xx)

## 9. 索引(正本と副本)

- 料金: `reply-ai-app/PRICING.md`(v3.3・暫定)→ Desktop `Replier料金決定資料.md`
- 指示書の根拠: `reply-ai-app/RESEARCH_LINE_STYLE.md`(§4.5〜4.8)
- サーバー化: `reply-ai-app/docs/server/STEP0_REQUIREMENTS_OPTIONS.md`・`STEP1_DESIGN_DRAFT.md`(v0.4)→ Desktop `Replier_工程0_*.md`・`Replier_工程1_*.md`
- 評価器の説明書: `pricing_eval/README.md`
- 人間確認ページ: Desktop `Replier_人間確認_07x5.html`(Kimi)・`Replier_人間確認_Qwen_10件.html`・`Replier_人間確認_Opus5_10件.html`
- 記憶(セッション横断): `~/.claude/projects/C--Users-gogyo/memory/replier-pricing-eval-status.md`・`replier-status.md`
- サイト全体の規則: リポ直下 `CLAUDE.md`(公開面の地図・墓標・検査コマンド)

## 10. 次にやること(発注者の判断待ち → GO 後の作業順)

**判断待ち(発注者)**
0. **新方式(事実ファイアウォール+6候補)でのモデル実測へ進むか**(GO 必須。10ケースで約100〜300円。出力が6候補ぶんに増えるので原価は再測定が要る)
1. 採用モデル: **Opus 5(Anthropic 直接)を候補にするか**(固有名詞捏造0・4.8円/回・p95 30秒・原価率約47%)
2. 「固有名詞なしの自己事実の作り込み(5/10)」を許容するか / **「自分の事実」入力欄**を足して塞ぐか
3. 台帳の 4xx 非課金分($0.44)の $0 精算 GO/NO
4. Opus 5 の追加評価(30件・スクショ含む)へ進むか(GO 必須・約150〜300円)
5. Anthropic キーの削除(評価が終わったら Console で削除してよい)

**GO 後の作業順(担当が変わっても同じ)**
1. 30件評価 → 人間確認 → 採用確定 → PRICING を「暫定」から確定へ(原価・回数上限・価格の再計算)
2. STEP1 を採用モデルに合わせて改訂(Anthropic 直接なら Lambda→api.anthropic.com・Secrets Manager・キャッシュ・retention の扱いをプラポリへ)
3. 工程2(詳細設計)→ 実装(共有 `reply-validate`→認証→generate→画像→課金→回数制限→E2E→Codex→preflight→プラポリ/規約/特商法→公開)
4. 公開前: 21e2 根治・Codex PASS・`tests/reply_ai_tombstone.mjs`/`csp_check.mjs`/`site_surface.mjs` 緑

---
更新履歴: v1.0 2026-09-01 新設(Fable 5)。次の担当は変更のたびに §0/§4/§8/§10 を更新し、細部は各正本へ。
