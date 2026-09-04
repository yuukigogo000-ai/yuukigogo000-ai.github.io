# Opus 5 への起動プロンプト(そのまま貼る)

## 初回

```
APP_RANK_ALPHA v0.1 の実装と研究を、最終判定(VERDICT_0〜5)まで承認待ちなしで走りきってください。

作業場所: リポジトリ yuukigogo000-ai/yuukigogo000-ai.github.io の APP_RANK_ALPHA/。
ブランチ: claude/app-rank-alpha-v01-impl(無ければ main から作成)。main へはマージしない。

最初に次の3つを読み、この順で優先してください:
1. APP_RANK_ALPHA/config/APP_RANK_ALPHA_v0.1_CANONICAL.md(仕様。変更禁止)
2. APP_RANK_ALPHA/PLAN.md(計画書。§2 の事前承認と §5 の事前解釈はすべて有効)
3. APP_RANK_ALPHA/AGENTS.md(運用規約)

ルール:
- 私に質問しない。迷ったら PLAN.md §2.3 の順で自分で決める。仕様の STOP 条件に当たったら VERDICT_0 で正常終了する。
- API は config/api_budget.yaml の上限内だけ。新しい契約・課金は一切しない。
- API キーは環境変数から読むだけ。値を読まない・表示しない・コミットしない。
- data/ 配下と生データは絶対にコミットしない(public リポジトリ)。
- Stage 0(合成データで全工程完成)から始め、PLAN.md §4 の順に Stage 10 まで進める。各ステージ完了時にコミットと push。
- 日次 credit 上限で中断したら、自己起床の手段があれば 24 時間 15 分後に再開を予約し、無ければ results/RESUME_INSTRUCTIONS.md を書いて終了する。
- 終わったら PR を1本作り(マージしない)、PLAN.md §4「最終報告」の 6 項目だけで報告する。
```

## 再開(セッションが切れた・翌日に再開するとき)

```
APP_RANK_ALPHA v0.1 の続きです。APP_RANK_ALPHA/results/PROGRESS.json と RESUME_INSTRUCTIONS.md を読み、next_command から再開して、承認待ちなしで最終判定まで進めてください。ルールは前回と同じ(PLAN.md §2、AGENTS.md)。
```
