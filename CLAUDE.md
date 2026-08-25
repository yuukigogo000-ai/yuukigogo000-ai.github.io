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
- セトリズム: `cd tests && npm install && npm test`(main に入っている。smoke 87項目 + torture 42項目)
- 公開面: `node tests/site_surface.mjs`(実サイトに対して「開いてよいもの/閉じるべきもの」を両方検査する)
- Replier 告知ページの後始末: `node tests/reply_ai_tombstone.mjs`(`--mutate` で検査器自身を確認)
- Replier: `cd reply-ai-app && npm test`。見た目の変更はソース側 → `npm run build` → `reply-ai/` を検査

## 公開面の地図(2026-08-25 整理)

このリポジトリは **public**。`_config.yml` の `exclude` に書いたものはサイトから配信されないが、
**github.com 上では引き続き読める**。秘密は絶対に置かない。

- サイトの入口 `/` = つくったもの置き場(公開中のアプリ一覧)
- **JAN→楽天価格 取得ツールは `/tools/jan/` へ移動した**(noindex + robots Disallow)。
  トップからはリンクしていないので、URL直打ちで開く
- 公開停止中 = `/surf/`(波チェック)・`/reply-ai/`(Replier)。どちらも告知ページのみ
- `/reply-ai/sw.js` は「墓標」。PWAとして端末に残った旧アプリを解除して消すためのもの。**消さない**
- 配信しないもの = `reply-ai-app/` `tests/` `honmono/tests/` `CLAUDE.md` `desktop/`
  `pachinko/desktop/` と内部の企画資料。詳細と理由は `_config.yml` に書いてある
- `honmono/design/AI_DETECTOR_EVAL.md` と `dataset_licenses.json` は
  公開ページからリンクしているので **exclude してはいけない**
