# yuukigogo000-ai.github.io — リポジトリ規則

## UI(見た目)の規則 — 正本 ~/.claude/playbooks/UI_PLAYBOOK.md(例外なし)
見本なしで発明しない / 交通整理はClaudeが決めてWOに記録し発注者に見せる(拒否権) / トークン外の生値禁止(文字階層≤5・角丸≤3) /
自己採点しない(uicheck GREEN + 発注者の一言) / 完了報告は数字+横並び画像 / main push=公開(公開前は APP_DEV_WORKFLOW 工程4R2+工程7)

### 期待値エクスプローラー(expectation-explorer.html)
- 基準線: `docs/ui/baselines/ee.json`(2026-08-18 UI作り変え後。改修前は `ee_before_20260818.json`)
- WO: `docs/ui/wo/WO_UI_ee_overview.md` / 横並び: `docs/ui/g6/`
- 検査: `MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs --path /expectation-explorer.html --name ee --baseline docs/ui/baselines/ee.json --accept distinct_bg_colors=5`
  - `--accept distinct_bg_colors=5` は WO §9 で理由を宣言済(M3 トナル階層 + 判定色の予約)
- 状態: `--state state=empty|long|error`(本番URLでは無効。`?state=` 付きの回は localStorage を書き換えない)
- テスト: `node tests/destructive.mjs`(破壊的検証55件。Playwright は ui_toolkit/uicheck のものを借りる。`PW_DIR` で差し替え可)
- **触ってはいけない**: 計算ロジック(`calc`/`annuity`)・保存キー(`ee_profile_v1`/`ee_options_v1`)・保存形式・`sanitize*`・テストが参照するID
