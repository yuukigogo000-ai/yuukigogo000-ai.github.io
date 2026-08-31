# Replier サーバー側プロキシ — 工程1: 設計書たたき台 v0.1(2026-09-01)

**位置づけ**: 実装には着手しない。工程0(STEP0_REQUIREMENTS_OPTIONS.md)の「推奨」を仮置きして書いた設計。§7 の決定が変われば書き直す。
**仮置きした決定**: AWS 東京 / Cognito(メール OTP)/ Stripe Checkout+Portal / 非同期ジョブ / 回数は成功時のみ消費 / 初期リリースは**追加枠なし・上限到達=次回更新待ち**。

---

## 1. 全体構成

```
[ブラウザ PWA(GitHub Pages, 静的)]
   │ HTTPS(JWT: Cognito IdToken)
   ▼
[Amazon API Gateway HTTP API (ap-northeast-1)] ── スロットリング(IP/ルート) ── JWT オーソライザ(Cognito)
   │
   ├─ POST /v1/jobs            → Lambda: create_job   (回数・レート検査 → DynamoDB jobs に PENDING → 非同期で worker を起動)
   ├─ GET  /v1/jobs/{id}       → Lambda: get_job      (状態と結果を返す。DONE 後に結果は TTL 5分で消える)
   ├─ GET  /v1/me              → Lambda: me           (プラン・残り回数・次回更新日時)
   ├─ POST /v1/billing/checkout→ Lambda: checkout     (Stripe Checkout Session を作成)
   ├─ POST /v1/billing/portal  → Lambda: portal       (Customer Portal URL)
   └─ POST /v1/billing/webhook → Lambda: webhook      (Stripe 署名検証 → subscriptions を更新。認証なし・署名のみ)

[Lambda: worker (非同期・timeout 90秒)] → Amazon Bedrock Converse (ap-northeast-1, Kimi K2.5, toolConfig, 非ストリーミング)
                                       → 出力検査 → DynamoDB jobs を DONE/FAILED に更新 → 成功なら usage を原子的に加算

[DynamoDB]: users / subscriptions / usage / jobs(TTL) / events(メタデータのみ)
[Secrets Manager]: Stripe 秘密鍵・Webhook 署名秘密
[CloudWatch]: メトリクス(費用・遅延・失敗率)。ログに会話本文・画像・メールアドレス以外の個人情報を出さない
```

- 秘密はブラウザに置かない。Bedrock は Lambda の IAM ロールで呼ぶ(鍵の配布なし)
- 推論は ap-northeast-1 のみ。他リージョンへのフォールバックは実装しない(方針違反になるため)
- 静的 PWA は現行の React/Vite をそのまま使い、`api.ts` の呼び先を Anthropic 直叩きからこの API に差し替える(BYOK コードは削除)

## 2. データモデル(DynamoDB・単一テーブル案)

| PK / SK | 主な属性 | 備考 |
|---|---|---|
| `USER#<sub>` / `PROFILE` | email(ハッシュ化しない。連絡に必要)、createdAt、status(active/banned)、freeUsed(0〜3) | Cognito の sub が主キー |
| `USER#<sub>` / `SUB` | stripeCustomerId、stripeSubscriptionId、status(active/past_due/canceled/none)、currentPeriodStart/End、priceId、launchPriceUntil | Webhook で更新。正本は Stripe |
| `USER#<sub>` / `USAGE#<periodKey>` | count(月内成功回数)、periodEnd | periodKey = Stripe の請求期間開始日。条件付き更新で 150 を超えない |
| `USER#<sub>` / `DAY#<yyyy-mm-dd JST>` | count | 20 を超えない。TTL 3日 |
| `JOB#<uuid>` / `META` | userId、status(PENDING/RUNNING/DONE/FAILED)、createdAt、**request(本文・画像は入れない。入れるのは worker への受け渡しに必要な最小限=下記)**、result(検査後の JSON)、error(種別のみ)、ttl(作成+5分) | 本文・画像の受け渡しは §3.2 |
| `EVENT#<yyyy-mm>` / `<ts>#<uuid>` | userId、kind(generate/profile)、modelId、inputTokens、outputTokens、costUsd、latencyMs、requestId、outcome | 原価集計用。TTL 400日 |

**会話・画像を保存しない(N2)との整合**: ジョブの入力(会話・画像)を DynamoDB に置くと「保存」になる。そこで入力は **create_job が Lambda の非同期 Invoke ペイロード(最大 256KB)** …では画像が入らないため、次のどちらか:
- (a) 入力を S3 の一時バケット(SSE・TTL 10分・アクセスは worker ロールのみ)に置き、worker が読んで即削除 — 一時的な保存が発生(ポリシーに「処理のため最大10分保持」と明記)
- (b) create_job 自身が同期で Bedrock を呼ぶが、API Gateway の30秒を超えるため不可
- **(c) 推奨: クライアントが `POST /v1/jobs` を 2段階にせず、API Gateway → Lambda(create_job)を「非同期呼び出し」にし、create_job が受け取った本体をそのまま worker ロジックに渡す**(= create_job と worker を同一 Lambda にし、API Gateway 側は `InvocationType: Event` 相当の統合で即 202 を返す)。入力はメモリ上にしか存在しない。HTTP API の Lambda 非同期統合はペイロード 6MB→**非同期 Invoke は 256KB 上限**のため画像付きは不可 → **画像付きは (a)、テキストのみは (c)** の併用が現実解
- 結論(たたき台): **入力は S3 一時バケット(SSE-KMS・ライフサイクル1日+worker が処理後に即削除)を経由**。DynamoDB には入力を置かない。プライバシーポリシーに「送信内容は処理のため最大10分間、東京リージョン内の暗号化ストレージに一時保持し、処理後に削除」と書く。ここは §7 の決定事項

## 3. API 仕様(抜粋)

### 3.1 認証
- Cognito User Pool(メール OTP・パスワードレス)。JWT(IdToken)を `Authorization: Bearer` で送る。HTTP API の JWT オーソライザで検証
- 未ログインでも「お試し」はさせない(無料3回もログイン後)。理由: 生涯3回を数えるにはアカウントが要る

### 3.2 生成ジョブ
```
POST /v1/jobs
  body: { kind: "reply" | "profile", uploadId?: string, text?: {...現行 ReplyTab の入力...}, options: { goal, tone, split, extra, styleSample } }
  → 202 { jobId, status: "PENDING", remaining: { month: 149, day: 19, free: 0 } }
  → 402 { code: "SUBSCRIPTION_REQUIRED" }                   無料3回を使い切り・未課金
  → 429 { code: "MONTHLY_LIMIT", resetAt: "2026-10-01T00:00:00+09:00" }   150回到達(次回更新日時を返す)
  → 429 { code: "DAILY_LIMIT",   resetAt: "2026-09-02T00:00:00+09:00" }   20回到達
  → 429 { code: "RATE_LIMITED" }                             1分5回超
  → 413 { code: "PAYLOAD_TOO_LARGE" }                        画像合計 > 4.5MB(base64 前)/ 6枚超
GET /v1/jobs/{jobId}
  → 200 { status: "RUNNING", stage: "reading"|"analyzing"|"writing" }
  → 200 { status: "DONE", result: { situation, replies[3], advice }, notes: ["shortfall"|"placeholder"|...] }
  → 200 { status: "FAILED", code: "MODEL_INVALID_OUTPUT"|"MODEL_TIMEOUT"|"MODEL_ERROR", chargeable: false }
```
- 画像付きは先に `POST /v1/uploads` で S3 の署名付き URL(PUT・10分)を得てアップロード → `uploadId` を渡す。サイズ・枚数・MIME はサーバーで再検査
- ステージ表示(読み取り中→分析中→作成中)は現行 UI のまま。サーバーは経過秒数から擬似的に stage を返す(モデルは一括応答のため実際の段階は分からない — 現行と同じ演出)

### 3.3 課金
- `POST /v1/billing/checkout` → Stripe Checkout(mode=subscription、price=月1,480円、ローンチ期間中は coupon 980円×3か月を自動付与、`success_url`/`cancel_url` はアプリ)
- `POST /v1/billing/portal` → Customer Portal(解約・カード変更)
- Webhook: `checkout.session.completed` / `customer.subscription.updated|deleted` / `invoice.payment_failed` → `SUB` を更新。署名検証必須・冪等(event.id を保存)
- `GET /v1/me` → `{ plan: "free"|"paid", remaining: { month, day, free }, periodEnd, launchPriceUntil, portalAvailable }`

## 4. 回数制限のロジック(初期リリース)

```
canGenerate(user):
  if user.status != active → 403
  if 分間レート超過 → 429 RATE_LIMITED
  if sub.status in (active, trialing) and now < sub.currentPeriodEnd:
      if usage[period].count >= 150 → 429 MONTHLY_LIMIT (resetAt = currentPeriodEnd)   ← 追加枠の案内は出さない(初期)
      if day[today].count  >= 20  → 429 DAILY_LIMIT   (resetAt = 翌日0時 JST)
      return PAID
  else:
      if user.freeUsed >= 3 → 402 SUBSCRIPTION_REQUIRED
      return FREE
消費: worker が「検査済みの結果を DONE として書く」トランザクションの中で count/freeUsed を +1(条件付き更新で上限超えを拒否)。
     FAILED(モデル起因・タイムアウト)では消費しない。
```
- 上限到達時のクライアント表示: 生成ボタン無効・「次回更新: 10月1日 0:00」・履歴と設定はそのまま使える。**追加購入の導線は表示しない**(将来の追加枠は `SUB` に `addon` 属性を足すだけで入れられる形にしておく)
- 残り回数の表示は `GET /v1/me` を画面表示時と生成完了時に取得。残り30回/10回で画面内バナー

## 5. worker(Bedrock 呼び出しと出力検査)

1. 入力を組み立てる: system = `prompts.ts` の REPLY_SYSTEM(除去後・4,6xx字)、user = 現行 ReplyTab と同じ節構成、画像は S3 から読んで Converse の image ブロックへ(最大6枚)
2. `Converse`(非ストリーミング)+ `toolConfig: { tools:[reply_result(REPLY_SCHEMA)], toolChoice:{tool} }`、`maxTokens 1024`、`temperature 0.7`(評価と同一。変えるなら再評価)
3. 出力検査(pricing_eval の `parseProductionReply` / `BANNED_RULES` と**同じ実装を共有パッケージ化**して使う。二重実装しない):
   - toolUse 無し / JSON 不正 → 1回だけ再試行 → 失敗なら FAILED(MODEL_INVALID_OUTPUT・消費なし)
   - replies > 3 → **先頭3件に切り詰め**(b2 run の6案事例への対処)、notes に `trimmed`
   - replies < 3 → 再試行1回 → なお不足なら不足のまま DONE、notes に `shortfall`
   - 各案の bubbles 1〜3件・why 必須。逸脱した案は除外
   - スキーマ外の項目(interest_level 等)は削除
   - 禁止出力(BANNED_RULES)に該当した案は除外。全案該当なら FAILED
   - `○○`/`〇〇`/`△△` を含む案は notes に `placeholder`(画面で「○○を埋めてください」を表示)。除外はしない(§7-6)
4. events にメタデータを書く(トークン・費用=公式単価×usage・遅延・requestId)。**本文は書かない**
5. jobs を DONE(result)にし、同一トランザクションで usage を消費。S3 の入力を削除

タイムアウト: worker 90秒。Bedrock 側 SDK タイムアウト 75秒。超過は FAILED(MODEL_TIMEOUT・消費なし)。

## 6. セキュリティ・プライバシー

| 項目 | 設計 |
|---|---|
| 秘密 | Stripe 鍵・Webhook 秘密は Secrets Manager。Bedrock は IAM ロール(`bedrock:InvokeModel` を Kimi と予備モデルの ARN に限定) |
| CORS | 許可オリジンはアプリのオリジンのみ。CSP は現行公開ページと同様 |
| ログ | 構造化ログにユーザーID(sub)・jobId・requestId・数値のみ。**会話本文・画像・メールアドレスを出さない**。テストで「本文の一部がログに現れたら落ちる」検査を入れる |
| 保持 | 入力: S3 一時(処理後即削除・最長10分)。結果: jobs TTL 5分。events: 400日(本文なし)。Bedrock: retention none・呼び出しログ無効(公開前に本番アカウントで preflight) |
| 悪用 | API Gateway スロットリング(IP)・アカウント別 1分5回・使い捨てメールドメイン拒否・登録時と無料枠の生成時に CAPTCHA(Cloudflare Turnstile か hCaptcha。どちらも外部送信先としてポリシーに記載) |
| 削除要求 | ユーザーの退会でプロフィール・使用量・イベントの userId を削除(Stripe 顧客は Stripe 側で削除) |

## 7. 未決定(発注者判断・工程0 §7 と対応)
1. 基盤 AWS 東京 / 認証 Cognito / 決済 Stripe — この前提でよいか
2. **画像付き入力の一時保持(S3・最長10分)を許容するか**(許容しない場合、画像付きは同期経路が必要になり 30秒問題に戻る)
3. 6案の対処 = 先頭3件に切り詰め でよいか(再試行で1回分の原価が増える案との比較)
4. 「○○」プレースホルダ = 画面注記(除外しない)でよいか。あわせてプロンプトに「店名を知らないときは聞き返す/未経験の形にする」を足すか(足すなら再評価が要る)
5. 回数消費 = 成功時のみ でよいか
6. CAPTCHA のベンダー(外部送信先が1つ増える)
7. ドメイン・事業者表記・サポート窓口

## 8. 工程の見取り図(この設計が承認された後)
- 工程2 詳細設計: OpenAPI 定義・DynamoDB キー設計・IAM ポリシー・Stripe 商品/価格/coupon の定義・失敗時のシーケンス図
- 工程3 参考調査: Bedrock Converse の画像制限(Kimi の枚数・サイズ)公式値の確認、HTTP API の JWT オーソライザ制約、Cognito パスワードレスの設定、Stripe の日本向け Checkout 表示(税込・特商法リンク)
- 工程4〜: 実装は**別 GO**。順序案: 認証+me → ジョブ(テキストのみ)→ 画像経路 → 課金 → 回数制限 → 出力検査の共有パッケージ化 → E2E → 破壊的検証(Codex)→ 本番アカウント preflight → プライバシーポリシー/規約/特商法 → 公開
- 共通: すべての工程で「本文をログに出さないテスト」「回数上限の変異テスト(151回目が通ったら落ちる)」「Webhook 冪等テスト」を最初から書く

## 9. この設計に影響する実測(2026-09-01・確証run b2・2ケースで停止)
- TXT_SHORT_07: Kimi が tool-use でも **replies 6件** を返した(requestId a6499ef3-39d8-400b-8107-234643e75b37・出力本文は当時未保存)。→ §5-3 の切り詰め/再試行
- TXT_SHORT_06: 店名を「○○」で出力(3案とも)。捏造はしていない(新規則どおり)が、そのまま送れない。→ §5-3 の placeholder 注記/§7-4
- 同ケースで検出器が「カレー屋」「ミステリー」を誤検知 → 検出器側を修正済み(業態の一般語・ジャンル語を除外)
