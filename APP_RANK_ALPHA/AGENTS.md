# AGENTS.md — APP RANK ALPHA v0.1 実装者(Claude Code / Opus 5)の運用規約

毎セッションの冒頭で、この順に読む: `PLAN.md` → `config/APP_RANK_ALPHA_v0.1_CANONICAL.md` → `results/PROGRESS.json`(あれば)。
優先順位: **仕様 > PLAN.md > このファイル**。

## 1. 承認を待たない

- 発注者への質問・確認は行わない(`AskUserQuestion` 禁止)。判断は PLAN.md §2.3 の順で自分で決める。
- 仕様の STOP 条件(§82)は正常終了。`FINAL_VERDICT.json` に VERDICT_0 を書いて最終報告する。
- Mapping Human Gate(§64)、`unlock-holdout`(§10)、API 上限内の呼び出しは PLAN.md §2.1 で事前承認済み。

## 2. 絶対禁止

- 仕様本文と `config/SPEC_SHA256.txt` の変更。必要なら `change_requests/SPEC_CHANGE_REQUEST_NNN.md`。
- `config/api_budget.yaml` の上限を超える API 呼び出し。新規契約・プラン変更・有料サービス利用。
- API キーの読み取り・表示・ログ出力(環境変数の値を `echo` / print / commit しない)。
- `data/`・`data_synthetic/`・トレード台帳・生レスポンスのコミット(このリポジトリは public)。
- 結果を見てからのパラメータ・期間・銘柄・変換式の変更(仕様 §80)。
- Holdout の 2 回目の開封。Holdout 後の修正を v0.1 と呼ぶこと。
- main ブランチへの push / マージ。

## 3. 作業の型

- ブランチ: `claude/app-rank-alpha-v01-impl`(無ければ main から作る)。ステージ完了ごとにコミット・`git push -u origin <branch>`。
- 作業ディレクトリ: `APP_RANK_ALPHA/`。他ディレクトリ(サイトのアプリ群)には触らない。
- 進捗: `results/PROGRESS.json` を毎ステージ更新(stage, status, last_command, next_command, updated_at)。
- 中断(キー未設定 / 日次上限): `results/RESUME_INSTRUCTIONS.md` に再開コマンドを書く。自己起床の手段(send_later / Routine)があれば 24 時間 15 分後に予約する。
- コミットメッセージ・コード・レポートにモデル名を書かない。

## 4. 科学的態度

- 不明は推測しない。除外して `audit/EXCLUSIONS.csv` に理由を書く。
- NA と 0 を混同しない。Top200 圏外 = 0、取得失敗 = NA。
- Confirmatory の結果は良くても悪くてもそのまま報告する。部分完了を完了と言わない。
- 最終報告は PLAN.md §4「最終報告」の 6 項目だけ。数字は before/after または表で示す。

## 5. 環境

- Python 3.12+、`uv`(無ければ `python -m venv .venv && pip install -e .[dev]`)。
- 環境変数: `APPTWEAK_API_KEY`, `JQUANTS_REFRESH_TOKEN`(または `JQUANTS_MAIL_ADDRESS` + `JQUANTS_PASSWORD`), 任意 `EDINET_API_KEY`, `APP_ALPHA_DATA_ROOT`。
- 外部アクセスはプロキシ経由。TLS 検証を無効化しない。
