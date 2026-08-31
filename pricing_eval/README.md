# Replier — AIモデル探索・品質評価・原価実測基盤

> **入口は `reply-ai-app/docs/SYSTEM_MAP.md`(設計図+説明書・現在地・決定台帳・落とし穴)。** この README はコマンドの詳細。

料金を決めるために必要な「再現可能な測定」を行うための道具立て。
**本番の生成経路・UI・課金・公開料金には一切触れない。**

## これは何を決めるための道具か

- どのAIモデルが Replier の条件(国内処理・ゼロ保持・画像6枚・品質)を満たすか
- 1回の返信生成にいくらかかるか(再試行込みの実効原価)
- 月間◯回のプランにしたとき、AI推論原価がいくらになるか

**この道具は採用モデル・価格・月間回数を決めない。** 人間の blind review と
unit economics を経て、別工程で決める。

## 前提と制約

- 評価データは**すべて架空の合成データ**。実在人物・実際の会話・ユーザー提供スクショは使わない
- スクリーンショットは自前の汎用チャットUIをPNG化したもの。他社アプリのUI・ロゴは複製しない
- モデル名をコードに埋め込まない。候補は実行時のAWS APIから動的に探索する
- 取得できない価格・仕様・保持条件・EOLは `unknown` にし、それを必要とする最終判断をブロックする

## セットアップ

```bash
cd pricing_eval
npm install          # playwright-core のみ(Chromium は /opt/pw-browsers を使う)
cp config.example.json config.json    # 必要に応じて編集
```

`config.json` の `evalEnvironmentDeclared` を `true` にしない限り preflight は通らない
(本番と分離された評価用アカウントであることを人間が宣言する項目)。

### Windows での実行(2026-08-30 追記)

- スクリーンショット生成は `CHROMIUM_PATH` に Chromium/Chrome の exe を指定する
  (例: `%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`)
- AWS 資格情報は **named profile 対応**: 環境変数キーが無く `AWS_PROFILE` があるときは
  `aws configure export-credentials --format process` で解決する(値はメモリ内のみ・ログへ出さない)。
  環境変数キーが残っているとそちらが優先されるため、評価コマンドは
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` を外した子プロセスで実行し、
  `AWS_PROFILE` / `AWS_REGION` / `AWS_DEFAULT_REGION` だけを渡す

## コマンド

すべてリポジトリのルートから実行する。

```bash
# 1. データセット(120ケース)を生成 — seed 固定なので何度実行しても同じ
node pricing_eval/src/generate_cases.mjs

# 2. スクリーンショット(汎用チャットUI)を生成し cases.json の images を更新
node pricing_eval/src/render_screenshots.mjs

# 3. dataset の検証
node pricing_eval/src/validate_dataset.mjs

# 4. AWS 環境・データ保持の preflight(read-only。通らなければ評価は実行しない)
node pricing_eval/src/retention_preflight.mjs

# 5. 候補モデルの動的探索(Hard Gate 判定つき)
node pricing_eval/src/discover_models.mjs

# 6. dry-run(実行せず上限費用を見積る)
node pricing_eval/src/run_eval.mjs --stage=dryrun --usd-jpy=160

# 7. smoke(代表5ケース。エラー率10%超のモデルは Full Run へ進めない)
node pricing_eval/src/run_eval.mjs --stage=smoke --usd-jpy=160

# 8. full(120ケース)
node pricing_eval/src/run_eval.mjs --stage=full --usd-jpy=160

# 9. resume(同じ run ID を渡す。成功済みケースは再実行しない)
node pricing_eval/src/run_eval.mjs --stage=full --run-id=full_20260829T012345

# 10. レポートのみ再生成(results.jsonl から作り直せる)
node pricing_eval/src/report.mjs --run-id=full_20260829T012345 --usd-jpy=160
```

### 器の検査(AWSなしで動かす)

実AWSが無くても、harness 自体の挙動はモックで確認できる。
**モックの出力は合成された偽の応答であり、モデルの品質・原価の結論には使えない**
(結果には `synthetic: true` が付き、レポートにも警告が出る)。

```bash
node pricing_eval/src/run_eval.mjs --stage=smoke --adapter=mock --fault=none
node pricing_eval/src/run_eval.mjs --stage=full  --adapter=mock --fault=two_replies
```

`--fault` に指定できるもの:
`none` `http_429` `http_500` `timeout` `broken_json` `two_replies` `empty`
`interest_score` `false_refusal` `fabrication` `six_images_fail` `usage_missing` `flaky_first_only`

## 捏造耐性の限定評価(10ケース・別 dataset)

```bash
# 5分類×2件(飲食/旅行/本・映画/趣味・ブランド/個人体験)。出力後に sha256 が表示される
node pricing_eval/src/generate_cases_fab10.mjs
# 確証run(別 dataset は --dataset-hash 必須。合格条件 confirm10 = 10件・再生成≤1)
node pricing_eval/src/fidelity_eval.mjs --models=<id> --dataset=pricing_eval/cases_fab10.json --dataset-hash=<sha256> \
  --per-category=2 --expected-cases=10 --pass-criteria=confirm10 --confirm-run --tool-use --stop-on-violation \
  --regenerate-once --max-first-violations=1 --temperature=0.2 --retry-transient-only --max-retries=1 \
  --usd-jpy=160 --prior-spent-usd=<recordedSpendUsd()> --run-id=<新ID>
# 人間確認ページ(全件。自動評価だけで捏造ゼロと断定しない)
node pricing_eval/src/human_review_page.mjs --run-id=<新ID> --dataset=pricing_eval/cases_fab10.json --max-regenerated=1
```

### Anthropic API 直接(アプリ本来の経路・Opus 5)

```bash
# キー: 環境変数 ANTHROPIC_API_KEY か ~/.anthropic/replier_eval.key(値はログ・成果物に出ない)。価格は pricing_anthropic.json(公式・cache 単価つき)
node pricing_eval/src/fidelity_eval.mjs --provider=anthropic --models=claude-opus-5 --accept-provider-retention --omit-temperature --output-max-tokens=16000 \
  --dataset=pricing_eval/cases_fab10.json --dataset-hash=<sha256> --per-category=2 --expected-cases=10 --pass-criteria=confirm10 \
  --confirm-run --stop-on-violation --regenerate-once --max-first-violations=1 --retry-transient-only --max-retries=1 \
  --usd-jpy=160 --prior-spent-usd=<recordedSpendUsd()> --run-id=<新ID>
```
- schema は本番 api.ts と同じ `output_config json_schema`(`toStructuredOutputSchema` で minItems>1/maxItems を落とす。落とさないと 400)
- `--omit-temperature`: claude-opus-5 は temperature を受け付けない(400)。`--output-max-tokens=16000` は本番と同値(既定 1024 は途中切れ=`max_tokens_truncated`)
- この経路は retention none ではない(Anthropic 標準)。合成データ限定・`--accept-provider-retention` 必須

価格が AWS 公式ページから機械取得できないモデル(Anthropic 系)は、`pricing_override.json` に `kind: derived_estimate`(出典URL必須)を置き、
`--allow-estimated-price` を明示したときだけ安全係数 1.1 を掛けて予算計上する(manifest/summary に推定である旨が残る)。既定では呼び出し禁止のまま。

検出器の層: 停止層(カタカナ語の体験文脈・施設接尾辞・例文名・有名チェーン/ブランドの固定リスト・プレースホルダ)と
補助候補層(地名+店名・体験談の言い回し。`fabrication_hint`)。**補助候補は人間確認の入口であって、未知の漢字・ひらがな
固有名詞を完全に検出できるものではない。**

## テスト

```bash
node pricing_eval/tests/run_tests.mjs            # 自動テスト(§12)
node pricing_eval/tests/run_tests.mjs --mutate   # わざと壊して「テストが落ちること」を確認
node pricing_eval/tests/destructive.mjs          # 破壊的検証(§13)
```

## 為替と予算

- **USD/JPY は暗黙値を使わない。** `--usd-jpy=160` のように明示するか `config.json` に書く。
  未指定なら円の数字を一切出さない(0円にもしない)
- 予算上限は `EVAL_MAX_BUDGET_JPY` / `--max-budget-jpy`、既定 10,000 円。
  見積りが上限を超えるなら実行しない。実行中に到達したら中断する

## 価格が取れないとき

AWS Price List API から機械取得できない場合、**価格を捏造しない**。
`pricing_override.example.json` を `pricing_override.json` にコピーし、
公式ページの値を `source`(URL)と `fetchedAt` つきで転記する。
転記されるまで、そのモデルの原価は `unknown` のまま扱われる(0円ではない)。

## 出力物

```
runs/<run_id>/
  run_manifest.json            実行時に固定した条件(ケースID・候補・設定・見積り)
  results.jsonl                1行=1(モデル×ケース)。試行ごとの usage / latency / 原価
  summary.csv                  モデル別の集計
  blind_review.csv             人間採点用(モデル名は伏せてある)
  MODEL_COST_QUALITY_REPORT.md レポート(results.jsonl から再生成できる)
runs/_discovery/
  candidate_discovery.json     候補探索と Hard Gate の判定
  preflight.json               AWS 環境・保持の確認結果
  dryrun.json                  上限費用の見積り
```

## Hard Gate の3値(重要)

| 判定 | 意味 | 影響 |
|---|---|---|
| `PASS` | AWS API か公式情報で確認できた | — |
| `FAIL` | 条件を満たさないことが確認できた | **候補から除外。Full Run しない** |
| `UNKNOWN` | 実行時に検証できなかった | 評価は進めてよいが**最終採用をブロック** |

モデル名や Provider 名からの推測で `PASS` を付けてはいけない。

## 人間が判断する範囲(自動化しない)

- 日本語の自然さ / 文体再現の納得感 / 実際に送りたいか(`rubric.md`)
- Provider 規約の最終法務判断(用途の可否・入出力の共有有無)
- 最終的な採用モデル・価格・月間回数の承認

LLM による自動採点でこれらを「完了」にしない。

## 証拠として残しているもの

`evidence/price_snapshot.json` — AWS Price List API から機械取得した公式価格の日付つきスナップショット。
価格は変わるため、判断に使った時点の値をリポジトリに残している(取得元URL・取得日時・リージョン・
service tier つき)。再取得は `node pricing_eval/src/fetch_pricing.mjs`。
