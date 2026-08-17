# yuukigogo000-ai.github.io — Claude への常設指示

静的サイト(GitHub Pages)。各ディレクトリが1アプリ(`band/`=セトリズム, `reply-ai/`=Replier のビルド出力(ソースは `reply-ai-app/` React+Vite), `honmono/`, `surf/`=波チェック, `health/`=おじさん健康手帳(ブランチ), `pachinko/`, `line-auto-reply/`=GAS ボット)。ビルドが要るのは `reply-ai-app/` だけ。

## UI(見た目)の規則 — 正本 `~/.claude/playbooks/UI_PLAYBOOK.md`(例外なし)
- 見本なしで発明しない(見本=Material Design 3 公式+Google Stitch/M3仕様から Claude が自動用意。「もっと良く」には見本生成で答える)
- 交通整理(主操作1つ・上位3タスク・格下げ・状態一覧)は **Claude が決めて WO に理由つきで記録し、発注者に見せる**(発注者は拒否権)
- トークン以外の生値を新たに書かない(文字階層≤5・角丸≤3)
- 自己採点しない: `AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs` GREEN + 発注者の一言(横並び画像に3問)で完了。検査器を直したら `--mutate` 4/4 を再確認
- 完了報告は数字(before/after)+横並び画像+見送り事項。部分完了を完了と言わない
- 1WO=1アプリ×1画面。順序・基準線・テストの所在は `ui-workbench/PLAYBOOK.md`(固有メモ)
- **main へ push = 公開。** 公開前は `~/.claude/playbooks/APP_DEV_WORKFLOW.md` の工程4ラウンド2+工程7(Codex PASS)

固定条件: 360×800 / 390×844・DPR3・light+dark。Git Bash では `MSYS_NO_PATHCONV=1` を付け、スクリプトは `C:/...` 形式で。
禁止: 外部CDN/Webフォント/外部アイコン読込(オフラインPWA)・見た目WOでのロジック/保存形式/localStorage キー変更・他社画像の持ち込み。

## テスト
- セトリズム: `tests/` は main に無い → `git checkout origin/claude/band-app-development-wgs7ly -- tests` → `cd tests && npm install && npm test`
- Replier: `cd reply-ai-app && npm test`。見た目の変更はソース側 → `npm run build` → `reply-ai/` を検査
