# PC の Claude Code に貼るプロンプト

以下の `---` から `---` までをそのままコピーして、このリポジトリを開いた Claude Code に貼る。
先に `handoff\collect_pc_inventory.ps1` を実行しておくこと(手順は `PC_INVENTORY_HOWTO.md`)。

---

`handoff/INVENTORY_2026-09.md` の `[PC側で記入]` を埋めてください。これは ChatGPT に渡す棚卸し文書です。

**読む場所**:
1. `%USERPROFILE%\Desktop\pc_inventory_<日付>\`(最新の1つ)。`00_SUMMARY.txt` → `11_memory\` の写し → `12_settings_keys.txt` → `20_workspace_tree.txt` → `30_git_repos.txt` → `40_env.txt` の順
2. あなた自身のメモリ(このプロジェクトの memory ディレクトリ、グローバルの CLAUDE.md)
3. `~/.claude/playbooks/UI_PLAYBOOK.md` と `APP_DEV_WORKFLOW.md` が読めるなら直接

**埋める場所と書き方**:
- §6 の表「状態」列: `存在(最終更新 yyyy-mm-dd、サイズ)` / `NOT_FOUND` / `別の場所にある: <パス>` のいずれか
- §9.1: メモリに書いてある発注者の好み・約束を箇条書き(10行以内)
- §9.2: UI_PLAYBOOK の工程一覧と各工程の完了条件、APP_DEV_WORKFLOW の工程1〜7 と「ラウンド2」「Codex PASS」の定義。本文の写しではなく要約(各20行以内)
- §9.3: AI_WORKSPACE のサブフォルダごとに 用途 / 最終更新日 / 1行説明
- §9.4: `30_git_repos.txt` の全リポジトリを 表(パス / remote / ブランチ / 最終コミット日 / 一言)。`health` 健康手帳が見つかったら §4 の該当行も書き換える
- §9.5: hooks のイベント名と何が走るか、permissions の要点、MCP サーバー名、よく使うスキル
- §9.6: あなたがメモリから知っている発注者の癖・好み(確認方針、報告形式、言語、禁止事項)

**守ること**:
- 断定できないものは `UNVERIFIED` と書く。推測で埋めない
- API キー・トークン・パスワード・`.env` の中身は読まない、書かない。写しに `[REDACTED]` があればそのまま
- `INVENTORY_2026-09.md` の他の節(§0〜§5、§7、§8)は変更しない。§4 の `health` 行だけ例外
- 書式は既存の見出しと表の列をそのまま使う
- 終わったら、埋めた箇所の一覧(節番号と行数)と、埋められなかった箇所とその理由を報告する。文書の要約はしない

---
