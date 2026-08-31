# Replier サーバー側プロキシ — 工程1: 設計書たたき台 v0.4(2026-09-01 発注者決定反映・API経路は条件付き・暗号化 idempotency 応答・**モデル=Kimi不採用・Qwen3 VL再評価中**)

**位置づけ**: 実装には着手しない。STEP0 v0.2 §0 の決定(AWS東京 / Regional REST API+Lambda / Cognito メール OTP / DynamoDB / S3 なし / 同期 / 履歴はブラウザ内 / CAPTCHA なし / 追加枠なし / 予約方式の回数制限 / サーバー側出力検査)を前提に書いた設計。

---

## 1. 全体構成

```
[ブラウザ PWA  app.<所有ドメイン>(静的配信)]
   │ HTTPS  Authorization: Bearer <Cognito IdToken>   Idempotency-Key: <uuid>
   │ 画像はブラウザで圧縮(最大6枚・長辺1600px・JPEG/WebP)し、リクエスト全体 ≤ 4.5MB を送信前に検査
   ▼
[AWS WAF] ── IP レート制限・サイズ制限 ── 
[API Gateway Regional REST API  api.<所有ドメイン>  (ap-northeast-1)]
   │ Cognito オーソライザ / 統合タイムアウト 60秒(条件付き: 計測で確定・STEP0 §4.4) / ペイロード検査
   ├─ POST /v1/generate         → Lambda generate  (同期。予約→Bedrock→検査→確定/返却→応答)   timeout 75秒
   ├─ POST /v1/profile          → Lambda generate  (同経路・kind=profile)
   ├─ GET  /v1/me               → Lambda me        (プラン・残り回数・次回更新日時)
   ├─ POST /v1/billing/checkout → Lambda billing   (Stripe Checkout Session)
   ├─ POST /v1/billing/portal   → Lambda billing   (Customer Portal URL)
   ├─ POST /v1/generate/ack     → Lambda generate  (受領確認: 暗号化 idempotency 応答を即削除)
   └─ POST /v1/billing/webhook  → Lambda webhook   (Stripe 署名検証のみ・認証なし)

[Lambda generate] → Amazon Bedrock Converse(ap-northeast-1・採用モデル=設定値(Kimi K2.5 不採用・Qwen3 VL 235B 再評価中)・toolConfig・非ストリーミング・SDK timeout 55秒)
                  → 出力検査(共有パッケージ)→ 再生成は1回まで → 応答
                  → 入力・出力はメモリ上のみ。DynamoDB/S3/ログに本文を書かない

[DynamoDB]: users / subscriptions / quota(予約・確定) / idempotency / events(メタデータのみ)
[Secrets Manager]: Stripe 秘密鍵・Webhook 署名秘密
[CloudWatch]: メトリクス(遅延 p50/p95・費用・失敗種別・試行数)。本文は出さない
```

- 秘密はブラウザに置かない。Bedrock は Lambda 実行ロールで呼ぶ(`bedrock:InvokeModel` を採用モデルと予備モデルの ARN に限定)
- 推論・API・DB・認証はすべて ap-northeast-1。他リージョンへのフォールバックは実装しない
- 静的 PWA は現行の React/Vite。`api.ts` の Anthropic 直叩き(BYOK)を削除し、この API へ差し替え。履歴・採用文・設定は現行どおりブラウザ内(localStorage)のみ
- ドメインは設定値(`APP_ORIGIN` / `API_ORIGIN`)。CORS 許可オリジンは `APP_ORIGIN` のみ

## 2. データモデル(DynamoDB・単一テーブル)

| PK / SK | 属性 | 備考 |
|---|---|---|
| `USER#<sub>` / `PROFILE` | email、createdAt、status(active/banned)、freeUsed(0〜3) | Cognito の sub が主キー |
| `USER#<sub>` / `SUB` | stripeCustomerId、stripeSubscriptionId、status、currentPeriodStart/End、priceId、launchPriceUntil、lastEventId | Webhook で更新。正本は Stripe |
| `USER#<sub>` / `QUOTA#M#<periodKey>` | success(確定成功数 ≤150)、attempts(試行数 ≤180)、reserved(予約中 0/1) | periodKey = 請求期間開始日(無料は `FREE`) |
| `USER#<sub>` / `QUOTA#D#<yyyy-mm-dd JST>` | success(≤20)、attempts(≤25)、TTL 3日 | |
| `USER#<sub>` / `RESV#<reservationId>` | createdAt、TTL(5分)、state(RESERVED/CONFIRMED/RELEASED) | 返却漏れは TTL で自動返却(ストリーム or 次回参照時に精算) |
| `IDEM#<sub>#<idempotencyKey>` / `META` | state(IN_PROGRESS/DONE/FAILED)、**encResponse**(検査済み結果を**ブラウザ保有鍵**で AES-256-GCM 暗号化した暗号文+IV+認証タグ)、responseHash、TTL(**最大10分**) | 同一 key の再送(画面更新・回線断)に同じ応答を返すための短期保持。**平文・鍵・入力画像は保存しない**(サーバーが持つのは暗号文だけ)。受領確認(`/v1/generate/ack`)で**即削除**+TTL の併用 |
| `EVENT#<yyyy-mm>` / `<ts>#<uuid>` | userId、kind、modelId、attemptNo、inputTokens、outputTokens、costUsd、latencyMs、requestId、outcome(OK/REGENERATED/INVALID/TIMEOUT/ERROR)、validationFlags(trimmed/placeholder/forbidden/shortfall) | 原価・品質集計。本文なし。TTL 400日 |

会話本文・画像・返信内容はどの項目にも平文で入れない。唯一の例外が `IDEM.encResponse`(ブラウザ保有鍵で暗号化した検査済み結果・最大10分・ack で即削除)で、サーバー側には鍵が無いので読めない。

## 3. API 仕様(抜粋)

### 3.1 認証
- Cognito User Pool(メール OTP・パスワードレス)。IdToken を `Authorization: Bearer`。REST API の Cognito オーソライザで検証
- 無料3回もログイン後(生涯3回を数えるにはアカウントが要る)

### 3.2 生成(同期)
```
POST /v1/generate
  headers: Authorization, Idempotency-Key(必須・UUID)
  body: { kind: "reply", images?: [{ mime, base64 }] (≤6・合計 ≤4.5MB), text?: {...現行 ReplyTab の入力...}, options: { goal, tone, split, extra, styleSample } }
  → 200 { result: { situation, replies[≤3], advice }, notes: ["shortfall"?], remaining: { month, day, free }, resetAt }
  → 400 { code: "INVALID_INPUT" }                       枚数/サイズ/MIME/必須項目
  → 402 { code: "SUBSCRIPTION_REQUIRED" }               無料3回を使い切り・未課金
  → 409 { code: "IN_PROGRESS" }                         同一ユーザーで生成中(同時1件)
  → 413 { code: "PAYLOAD_TOO_LARGE" }                   4.5MB 超(API Gateway/WAF でも遮断)
  → 429 { code: "MONTHLY_LIMIT"|"DAILY_LIMIT"|"ATTEMPT_LIMIT"|"RATE_LIMITED", resetAt }
  → 502 { code: "MODEL_INVALID_OUTPUT"|"MODEL_TIMEOUT"|"MODEL_ERROR", charged: false }   再生成1回でも失敗。回数は消費しない
```
- 同じ `Idempotency-Key` の再送: IN_PROGRESS なら 409、DONE なら保存済み暗号文を**リクエストの鍵で復号して**同じ応答、FAILED なら同じエラー(モデルを再度呼ばない)。鍵が違えば 404(復号不能=別クライアント)
- 暗号化 idempotency 応答(§3.4): ブラウザが要求ごとに 256bit 鍵を生成し `X-Response-Key`(base64)で送る。サーバーは応答生成後、その鍵で暗号化して `IDEM.encResponse` に保存し、鍵はメモリから破棄。ブラウザは応答受領後に `POST /v1/generate/ack {idempotencyKey}` を送り、サーバーは該当行を即削除(ack が届かなくても TTL 10分で消える)
- タイムアウト設計(**条件付き**。STEP0 §4.4 の判定表で経路を確定してから数値を固定): 同期案は WAF/API 統合 60秒 > Lambda 75秒(統合が先に切れても予約返却を完了させるため長め) > Bedrock SDK 55秒。統合が先に切れた場合クライアントは 504 を受け、Lambda はバックグラウンドで返却処理を終え、暗号化 idempotency 応答を保存する(クライアントは同じ key で再取得できる)。**p50/p90/p95/最大・120秒超率を CloudWatch に出す**

### 3.3 課金
- `POST /v1/billing/checkout` → Stripe Checkout(mode=subscription、月1,480円、ローンチ期間中は coupon 980円×3か月、`success_url`/`cancel_url` は `APP_ORIGIN`)
- `POST /v1/billing/portal` → Customer Portal(解約・カード変更)
- Webhook: `checkout.session.completed` / `customer.subscription.updated|deleted` / `invoice.payment_failed` → `SUB` を更新。署名検証必須・冪等(event.id)
- `GET /v1/me` → `{ plan, remaining: { month, day, free }, attemptsLeft: { month, day }, periodEnd, launchPriceUntil }`

## 4. 回数制限(予約方式)

```
generate(user, key):
  idem = getOrCreate(IDEM#user#key)            // IN_PROGRESS を原子的に作成。既存なら §3.2 の再送規則
  plan = paid if SUB.active && now < periodEnd else free
  reserve:  TransactWrite(条件付き)
     - RESV: 同一ユーザーの RESERVED が 0 件であること(同時1件)        → 違反 409 IN_PROGRESS
     - QUOTA#M: success < 150(free: freeUsed < 3) かつ attempts < 180  → 違反 429 MONTHLY_LIMIT / ATTEMPT_LIMIT / 402
     - QUOTA#D: success < 20 かつ attempts < 25                         → 違反 429 DAILY_LIMIT / ATTEMPT_LIMIT
     - attempts += 1(試行は予約時点で確定。返却しても戻さない=原価上限)
     - RESV を RESERVED で作成(TTL 5分)
  result = callAndValidate(attempt 1)
  if result.needsRegenerate: attempts += 1(上限内なら) → callAndValidate(attempt 2)
  if result.ok:  TransactWrite: success += 1 / RESV=CONFIRMED / IDEM=DONE            → 200
  else:          TransactWrite: RESV=RELEASED(success は増えない) / IDEM=FAILED        → 502(charged:false)
  例外・タイムアウト時も finally で RELEASED。取りこぼしは RESV の TTL 切れで自動返却
```
- 「成功時のみ消費」= success は確定時のみ +1。attempts は試行ごと +1(原価上限 月180/日25 に効く)
- 上限到達時のクライアント: 生成ボタン無効・「次回更新: 10月1日 0:00」・履歴と設定は使える・追加購入導線なし
- 残り回数表示は `GET /v1/me` を画面表示時と生成完了時に取得。残り30回/10回で画面内バナー

## 5. Lambda generate(呼び出しと出力検査)

1. 入力検査: 画像 ≤6・各 MIME(JPEG/WebP/PNG)・デコード後サイズ・合計 ≤4.5MB(API Gateway/WAF の上限より先に自前で検査し 413)。テキスト長上限
2. プロンプト: system = `prompts.ts` の REPLY_SYSTEM(3件固定・プレースホルダ禁止を含む版)、user = 現行 ReplyTab と同じ節構成、画像は Converse の image ブロック
3. `Converse`(非ストリーミング)+ `toolConfig: { tools:[reply_result(REPLY_SCHEMA: replies minItems/maxItems=3)], toolChoice:{tool} }`、`maxTokens 1024`、**`temperature 0.2`**(2026-09-01 に 0.7 から変更。評価と同一。変えるなら再評価。**claude-opus-5 は temperature 非対応(400)なので Opus 5 採用時は送らない**)。tool 説明文「返信案は必ずちょうど3件(4件以上・2件以下は禁止)」。プロンプトは「入力に無い固有名詞(地名・店名・人物・作家・作品・ブランド)と自分の体験談を足さない」規則を強化し、NG→OK 例を5分類(飲食/旅行/本・映画/趣味・ブランド/個人体験)で明記した版。**それでも機械検査は補助**(漢字・ひらがなの固有名詞・体験談は完全検出できない)なので、結果画面に「AIによる返信案です。内容が事実と合っているか確認してから使用してください。」を常設する
4. **出力検査(共有パッケージ `reply-validate`。pricing_eval の `parseProductionReply` / `checkStyleRules(placeholder)` / `BANNED_RULES` と同一実装)** — モデル出力を無条件で信用しない:
   - toolUse 無し / JSON 不正 / 必須欠落 → **再生成1回**
   - 各案を内容検査: bubbles 1〜3件・why 必須・禁止出力なし(BANNED_RULES)・**プレースホルダなし(PLACEHOLDER_RE)** → 通らない案は除外
   - 通った案が **4件以上 → 先頭3件**(events に `trimmed`)/ **ちょうど3件 → OK** / **3件未満 → 再生成1回**
   - 再生成後も3件未満・禁止出力・プレースホルダ → **エラー(502)・予約返却・回数消費なし**。2件でも返さない(発注者決定: 再失敗はエラー表示)
   - スキーマ外の項目(interest_level 等)は落とす
   - `invalidOutput`(違反時の本文)は**保存しない**(合成評価データ限定の機能。本番禁止)
5. events にメタデータ(トークン・費用=公式単価×usage・遅延・requestId・outcome・validationFlags)。本文なし
6. 応答。入力・出力はここで破棄(メモリ)

タイムアウト: Bedrock SDK 55秒 → `MODEL_TIMEOUT`(消費なし)。Lambda 75秒。

## 6. セキュリティ・プライバシー

| 項目 | 設計 |
|---|---|
| 秘密 | Stripe 鍵・Webhook 秘密は Secrets Manager。Bedrock は IAM ロール(モデル ARN 限定) |
| WAF | IP レート制限(例: 5分100リクエスト)・ボディサイズ上限・既知の悪性 IP リスト(マネージドルール)。CAPTCHA は使わない(初期) |
| CORS/CSP | 許可オリジンは `APP_ORIGIN` のみ。CSP は現行公開ページと同様 |
| ログ | 構造化ログに sub・idempotencyKey・requestId・数値・outcome のみ。**会話本文・画像・返信内容・メールアドレスを出さない**。テスト: 本文の一部がログ出力に現れたら落ちる |
| 保持 | 本文: 保持なし(S3 なし・DB なし)。IDEM.encResponse は**暗号文のみ**・最大10分(ack で即削除)。events: 400日(本文なし)。Bedrock: retention none・呼び出しログ無効(本番アカウントで preflight) |
| 悪用 | メール認証・WAF・アカウント別 1分5回・同時1件・idempotency key・試行上限 月180/日25・使い捨てメールドメイン拒否 |
| 削除要求 | 退会でプロフィール・QUOTA・EVENT の userId を削除(Stripe 顧客は Stripe 側で削除) |

## 7. 未決定(残り)
0. **採用モデル**: 未定。Kimi K2.5 は不採用、Qwen3 VL 235B も10件評価で不合格(5件目停止・人間確認で4件中3件に捏造)(2026-09-01)。**Opus 5(Anthropic API 直接)は自動10/10・固有名詞捏造0**(軽い自己事実の作り込み5/10・約4.8円/回・p95 29.5秒)。採用は発注者判断。Opus 5 なら §3 の Bedrock 呼び出しは Anthropic Messages API(Lambda→api.anthropic.com・キーは Secrets Manager・`toStructuredOutputSchema`・temperature 送らない・プロンプトキャッシュ)に置き換える。設計はモデル非依存のまま進められる部分(認証・回数制限・課金・出力検査の枠)のみ
1. **API 経路**(60秒同期 / 180秒申請 / 非同期)— 次の確証runの遅延計測で STEP0 §4.4 の判定表に当てて確定
2. 所有ドメイン名・サポート窓口・特商法表記
3. 暗号化 idempotency 応答の鍵配送の細部(ヘッダー名・鍵長・ack の再送時の扱い)は工程2で詰める。方針(暗号文のみ保持・最大10分・ack 即削除)は決定済み

## 8. 工程の見取り図(承認後・実装は別 GO)
- 工程2 詳細設計: OpenAPI 定義・DynamoDB キー/TransactWrite 条件式・IAM ポリシー・WAF ルール・Stripe 商品/価格/coupon・失敗シーケンス(統合タイムアウト時の返却)
- 工程3 参考調査: REST API 統合タイムアウト緩和の申請手順と実績、Cognito パスワードレス設定、Bedrock Converse の採用モデル(Qwen3 VL 候補)の画像制限(枚数・サイズ)公式値、Stripe 日本向け Checkout(税込・特商法リンク)
- 実装順序案: 共有 `reply-validate` パッケージ(pricing_eval と共用・変異テスト付き)→ 認証+me → generate(テキストのみ)→ 画像経路(圧縮・4.5MB)→ 課金 → 予約方式の回数制限 → E2E → 破壊的検証(Codex)→ 本番 preflight → プライバシーポリシー/規約/特商法 → 公開
- 最初から書くテスト: 本文非出力テスト・回数上限の変異テスト(151回目/181試行目が通ったら落ちる)・同時2件が通ったら落ちる・idempotency 再送でモデルが2回呼ばれたら落ちる・Webhook 冪等・6案入力を3件に切り詰める/2案入力を再生成する/プレースホルダ案を除外する
- 公開前: 不安定 E2E(21e2)の原因特定か隔離

## 9. この設計に影響する実測(2026-09-01)
- 確証run b2 TXT_SHORT_07: Kimi が tool-use でも replies 6件(requestId a6499ef3…)→ §5-4 の検査・切り詰め・再生成
- 同 TXT_SHORT_06: 店名・相手の名前を「○○」で出力(3案とも)→ プロンプトに置き換え規則を追加・§5-4 のプレースホルダ除外
- 強制終了時に進行中の1呼び出しが台帳外になった → 評価器に「呼び出し直前 STARTED 永続化 / UNKNOWN_OUTCOME は worst-case 計上」を実装。本番でも同じ考え方(予約→確定/返却)を §4 に採用
- 確証run b3(temperature 0.7): 50.9秒・51.6秒・**120秒タイムアウト1件**、再試行応答に「○○」→停止。→ temperature 0.2+1回再生成(初回違反は独立記録)へ変更し、遅延の p50/p90/p95/最大・120秒超率を次runで計測(STEP0 §4.4)
