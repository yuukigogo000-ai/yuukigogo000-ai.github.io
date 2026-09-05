# あなたの手順(発注者用)

やることは 6 つ。判断が要るのは 2 だけ。ほかは作業。

## 1. この計画書をマージする(5 分)
ブランチ `claude/app-rank-alpha-v01-plan-35t1pb` の PR を作って main にマージする。
- 影響: `_config.yml` の exclude 追加だけ。サイトの見た目は変わらない。
- 飛ばすと: Opus が計画書を読めない。

## 2. J-Quants のプランを決める(唯一の課金判断)
必要な履歴 = **2018-01-01 より前から今まで**の日足・財務・上場銘柄一覧。
- Free のまま → Opus は途中で「履歴不足 = VERDICT_0」で正常終了する(お金はかからないが結論も出ない)。
- 10 年以上の履歴が入るプランを契約 → 研究が最後まで走る。現行の名称と料金は J-Quants 公式サイトで確認。
- ここでどう決めても Opus は止まらない。決めないなら Free で走らせて「何が足りないか」の報告だけ受け取るのも可。

## 3. API キーを 2 つ用意する(15 分)
- AppTweak: 無料トライアルを申し込み、API キーと **残 credits** を確認する。
- J-Quants: ログインしてリフレッシュトークンを取る。
- キーは Opus に貼らない。次の 4 で環境変数として渡す。

## 4. Opus の実行環境に環境変数を設定する(5 分)
Claude Code(Web)なら環境(Environment)の設定画面、ローカルならシェルで:
```
APPTWEAK_API_KEY=...
JQUANTS_REFRESH_TOKEN=...
```
- AppTweak の残 credits が 18,000 と違うなら `APP_RANK_ALPHA/config/api_budget.yaml` の `max_credits_total` を「残高 − 2,000」に書き換えてコミットしておく。
- 飛ばすと: Opus は Stage 0(合成データで全工程完成)まで作って止まり、`results/RESUME_INSTRUCTIONS.md` を残す。あとからキーを入れて再開できる。

## 5. Opus 5 を起動する(1 分)
`APP_RANK_ALPHA/KICKOFF_PROMPT.md` の「初回」の文をコピーして、Opus 5 のセッションに貼る。以後は放置してよい。
- Opus は質問してこない。止まるのは「終わった」「STOP 条件(VERDICT_0)」「日次 credit 上限で翌日待ち」の 3 つだけ。

## 6. 翌日以降、止まっていたら再開文を貼る(1 分、最大 2〜3 回)
AppTweak の日次上限 5,000 credits のため、データ取得は 2 日以上かかる。
Opus が自分で翌日に再開できない環境なら、`KICKOFF_PROMPT.md` の「再開」の文を貼る。
- 進み具合は `APP_RANK_ALPHA/results/PROGRESS.json` を見れば分かる。

## 終わったら受け取るもの
- PR 1 本(main へはマージされていない。マージはあなたが判断)
- 最終報告 6 項目: VERDICT / 到達ステージ / 変更ファイル / 確認方法 / 残リスク / 変更要望一覧
- `APP_RANK_ALPHA/results/FINAL_VERDICT.md` と `report.html`

## やらなくていいこと
- 途中の承認、Mapping 監査の確認、Holdout 開封の許可 → 計画書 §2.1 で事前承認済み。
- 生データの置き場所の用意 → `.gitignore` で除外済み。コミットされない。
- UI 確認 → UI は作らない。
