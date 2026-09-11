# PC の Claude Code に貼るプロンプト(自己完結型)

PC 側でやることは1つだけ。VS Code のターミナルでこのリポジトリを開き、`claude` を起動して次の1行を貼る:

```
handoff/PROMPT_FOR_LOCAL_CLAUDE.md を読んで、その指示を実行して
```

以下がローカル Claude Code への指示本文。

---

`handoff/INVENTORY_2026-09.md` の `[PC側で記入]` を埋め、同じブランチに push してください。これは ChatGPT に渡す棚卸し文書です。人に確認を求めず最後まで進めてください(課金が生じる操作はありません)。

**手順**:
1. ブランチ確認: `git branch --show-current` が `claude/pc-inventory-and-history-f48zkr` でなければ `git fetch origin claude/pc-inventory-and-history-f48zkr && git checkout claude/pc-inventory-and-history-f48zkr`
2. 収集スクリプトを実行: `powershell -ExecutionPolicy Bypass -File handoff\collect_pc_inventory.ps1`。読み取り専用で、書き込み先は `%USERPROFILE%\Desktop\pc_inventory_<日付>\` だけ。エラーで止まったら原因を直してから再実行(スクリプトの修正はコミットに含めてよい)
3. 出力を読む。順番: `00_SUMMARY.txt` → `11_memory\` の写し → `12_settings_keys.txt` → `20_workspace_tree.txt` → `30_git_repos.txt` → `40_env.txt`
4. あなた自身のメモリ(このプロジェクトの memory ディレクトリ、グローバルの CLAUDE.md)と、`~/.claude/playbooks/UI_PLAYBOOK.md` `APP_DEV_WORKFLOW.md` が読めるなら直接読む
5. `INVENTORY_2026-09.md` を埋める(下の「埋める場所と書き方」)
6. 秘密の混入確認: `Select-String -Path handoff\INVENTORY_2026-09.md -Pattern 'sk-ant-','ghp_','AKIA','BEGIN .* PRIVATE KEY','accessKey *[:=]','apiKey *[:=]','token *[:=]','password *[:=]' -CaseSensitive:$false`。ヒットした行は伏字ではなく削除。キー名だけの言及(`rk_accessKey` など)は問題ない
7. コミットして push: `git add handoff/` → コミットメッセージ「棚卸し: PC側の記入欄を埋める」→ `git push -u origin claude/pc-inventory-and-history-f48zkr`。**main には触らない**
8. 報告(4点だけ): 埋めた節と行数 / 埋められなかった節と理由 / 手順6の結果 / コミットハッシュ。文書の要約はしない

**埋める場所と書き方**:
- §6 の表「状態」列: `存在(最終更新 yyyy-mm-dd、サイズ)` / `NOT_FOUND` / `別の場所にある: <パス>` のいずれか
- §4 と §6 の `health/` 行: `30_git_repos.txt` で健康手帳のリポジトリが見つかったらパスと最終コミット日を書く
- §9.1: メモリに書いてある発注者の好み・約束を箇条書き(10行以内)
- §9.2: UI_PLAYBOOK の工程一覧と各工程の完了条件、APP_DEV_WORKFLOW の工程1〜7 と「ラウンド2」「Codex PASS」の定義。写しではなく要約(各20行以内)
- §9.3: AI_WORKSPACE のサブフォルダごとに 用途 / 最終更新日 / 1行説明
- §9.4: `30_git_repos.txt` の全リポジトリを表(パス / remote / ブランチ / 最終コミット日 / 一言)
- §9.5: hooks のイベント名と何が走るか、permissions の要点、MCP サーバー名、よく使うスキル
- §9.6: あなたがメモリから知っている発注者の癖・好み(確認方針、報告形式、言語、禁止事項)

**守ること**:
- 断定できないものは `UNVERIFIED` と書く。推測で埋めない
- API キー・トークン・パスワード・`.env` の中身は読まない、書かない。写しの `[REDACTED]` はそのまま
- `INVENTORY_2026-09.md` の他の節(§0〜§3、§5、§7、§8)は変更しない。§4 の `health` 行だけ例外
- 書式は既存の見出しと表の列をそのまま使う

---
