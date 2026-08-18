# カラダ日報 (/health/) — このディレクトリの規則

## UI(見た目)の規則 — 正本 ~/.claude/playbooks/UI_PLAYBOOK.md(例外なし)
見本なしで発明しない / 交通整理はClaudeが決めてWOに記録し発注者に見せる(拒否権) / トークン外の生値禁止(文字階層≤5・角丸≤3) /
自己採点しない(uicheck GREEN + 発注者の一言) / 完了報告は数字+横並び画像 / main push=公開(公開前は APP_DEV_WORKFLOW 工程4R2+工程7)

- 基準線: `health/ui/baselines/karada.json`
- 発注書: `health/ui/wo/WO_UI_karada_home.md`
- 検査: `MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs --path /health/ --name karada --baseline health/ui/baselines/karada.json`
- テスト: `node health/tests/smoke.mjs`(通常) / `node health/tests/smoke.mjs --mutate`(検査器の自己検査)
- refs: `AI_WORKSPACE/ui_toolkit/refs/karada_*`(他社著作物・**このリポジトリに入れない**)

## 変えてはいけないもの
- localStorage キー: `ojisan_health_records` / `ojisan_health_settings` / `ojisan_health_checkups`(変えると既存ユーザーの記録が消える)
- 判定の基準値: メタボ=特定健診(男性)腹囲85cm+リスク数 / 血圧=JSH2019 / 純アルコールg換算 / 健診値の基準
- 外部依存を足さない(CDN・Webフォント・アイコン読込・通信すべて禁止。オフラインで動くこと)

## 状態の再現
`?state=empty` / `?state=demo` / `?state=saved`(本番URLでは無視され、この状態では localStorage に書き込まない)
