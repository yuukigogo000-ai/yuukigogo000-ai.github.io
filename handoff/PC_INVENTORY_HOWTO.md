# PC 側の棚卸し手順(発注者向け・5ステップ)

`INVENTORY_2026-09.md` のうち、リポジトリで分かる部分は Claude Code が埋めてあります。
残っている `[PC側で記入]` は、あなたの PC にしか無い情報(メモリ・playbooks・AI_WORKSPACE・他リポジトリ・設定)です。
以下の手順で埋めて、1本の Markdown にして ChatGPT に渡します。所要 15〜30 分。

## ステップ 1: 収集スクリプトを実行する(読み取り専用)

PowerShell を開き、このリポジトリのフォルダで:

```powershell
cd <このリポジトリのパス>
git fetch origin claude/pc-inventory-and-history-f48zkr
git checkout claude/pc-inventory-and-history-f48zkr
powershell -ExecutionPolicy Bypass -File handoff\collect_pc_inventory.ps1
```

できるもの: `%USERPROFILE%\Desktop\pc_inventory_<日付>\`

| ファイル | 中身 |
|---|---|
| `00_SUMMARY.txt` | 何が見つかり、何が無かったかの一覧(先にこれを見る) |
| `10_claude_tree.txt` | `~/.claude/` の全ファイル一覧(パス・サイズ・更新日) |
| `11_memory/` | `~/.claude/CLAUDE.md`、`projects/*/memory/*.md`、`playbooks/*.md`、`skills/**/SKILL.md` の**写し**(秘密パターンは伏字化) |
| `12_settings_keys.txt` | `settings.json` の hooks / permissions / mcpServers の**キー名だけ**(値は写さない) |
| `20_workspace_tree.txt` | `AI_WORKSPACE/`、`ui-workbench/`、`tools/jan/`、`scratchpad` の一覧 |
| `30_git_repos.txt` | ホーム配下の git リポジトリ一覧(最終コミット・ブランチ) |
| `40_env.txt` | Node / Python / git / Claude Code のバージョン |

スクリプトが**読まないもの**: `.env`、`*key*`、`credentials*`、`*.pem`、`*token*`、`*secret*`。
書き込むのは出力フォルダの中だけです。

## ステップ 2: PC の Claude Code に埋めさせる

このリポジトリを開いた Claude Code に、`handoff/PROMPT_FOR_LOCAL_CLAUDE.md` の本文をそのまま貼ります。
Claude Code が `pc_inventory_<日付>\` を読み、`INVENTORY_2026-09.md` の `[PC側で記入]` を埋めて、埋めた箇所の一覧を報告します。

自分で埋めても構いません。その場合は §6 の「状態」列と §9 の各節を、`11_memory/` の写しを見ながら書きます。

## ステップ 3: 秘密が混ざっていないか確認する

```powershell
Select-String -Path handoff\INVENTORY_2026-09.md -Pattern 'sk-ant-','accessKey','appId','token','secret','password','BEGIN .* PRIVATE KEY' -CaseSensitive:$false
```

何も出なければ OK。出たら該当行を消す(伏字ではなく削除)。楽天の `rk_appId` / `rk_accessKey` は**キー名**として文書に載っているので、それは問題ありません。値が載っていたら削除。

## ステップ 4: ChatGPT に渡す

**推奨**: ファイルをそのままアップロード(`INVENTORY_2026-09.md` 1本。約 40KB)。

貼り付けで渡す場合は、先頭に次の1段落を付けてから、§0 → §1 → §2 → §3〜§9 の順で分けて貼る:

> これから貼るのは、私が Claude Code と作ってきたソフトの棚卸しです。Claude Code が書いた事実記録で、`[PC側で記入]` は私が埋めました。全部読み終わるまで要約や提案はしないでください。読み終わったら「アプリ名 / 公開状態 / 現在の段階 / 直近の判断待ち」を表にして返してください。

ChatGPT のメモリ機能を使うなら、読ませたあとに「この棚卸しの §1.2 と §7 を記憶して」と指示すると、次回以降の相談で前提を毎回貼らずに済みます。

## ステップ 5: 更新するとき

次回以降は全部書き直さず、次だけ差し替えます:
- §2 各アプリの「現在の段階」「残作業」
- §3 年表の末尾
- §4 未マージ作業
- §7 判断待ち

Claude Code に「`handoff/INVENTORY_2026-09.md` を現在のリポジトリに合わせて更新して。§2 の段階・§3・§4・§7 だけ」と頼めば、この文書の書式のまま更新できます。

## 補足: この環境から分からなかったこと(残リスク)

- `health/`(おじさん健康手帳)はこのリポジトリのどの ref にも無い。別リポジトリか、削除済み。ステップ 1 の `30_git_repos.txt` で見つかる見込み
- `~/.claude/playbooks/` の中身(UI_PLAYBOOK・APP_DEV_WORKFLOW)は写しが取れないと §5 の規則が「見出しだけ」の説明で止まる
- ChatGPT 側にしか無いもの(Candidate 03 の Visual Intent、HANDOFF v6 の原本)は、ChatGPT の該当会話を探して ID か日付を §6 に書いておくと後で辿れる
