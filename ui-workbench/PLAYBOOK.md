# このリポジトリのUI改善メモ(固有情報)

**正本(全アプリ共通)は `~/.claude/playbooks/UI_PLAYBOOK.md`。発注書は `~/.claude/playbooks/UI_WO_TEMPLATE.md`。** ここには yuukigogo000-ai.github.io 固有のことだけ書く。
初版(2026-08-17 v1・リポジトリ内で完結していた版)は [_archive/PLAYBOOK_v1_20260817.md](_archive/PLAYBOOK_v1_20260817.md)。制定の根拠 = [DESTRUCTIVE_VERIFICATION_20260817.md](DESTRUCTIVE_VERIFICATION_20260817.md)。

## アプリと順序

| # | アプリ | パス | 作り | テスト |
|---|---|---|---|---|
| 1 | セトリズム「セトリ編集」 | `/band/` | Vanilla JS・PWA済 | 87項目(smoke/torture)は **main に無い** → `git checkout origin/claude/band-app-development-wgs7ly -- tests` → `cd tests && npm install && npm test` |
| 2 | セトリズム「本番モード」 | 同上 | | 同上 |
| 3 | セトリズム 共通トークンを全タブへ | 同上 | | 同上 |
| 4 | Replier | `/reply-ai/`(ビルド出力)/ ソース `reply-ai-app/`(React+Vite) | PWA済 | `cd reply-ai-app && npm test`。**変更はソース側 → `npm run build`** |
| 5 | 波チェック | `/surf/` | HTML1枚 | 無し → uicheck HARD+主操作1本の手動 |
| 6 | HONMONO | `/honmono/` | Web(PWA化まだ) | 無し |
| 7 | おじさん健康手帳 | `/health/`(ブランチ `claude/ojisan-health-app-panu15`) | 単一HTML | 無し。先行WO `health/PLAN_UI_PORT.md`(Figma Make見本)と整合させる |

`line-auto-reply/` は GAS の LINE ボット(画面は LINE)→ 対象外。`pachinko/` は必要になったら追加。

## 基準線

`ui-workbench/baselines/<app>.json`(2026-08-17 取得・git 管理)。検査は**リポジトリのルートで**:
```
MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs --path /band/ --name band --baseline ui-workbench/baselines/band.json
```
現状の要点(2026-08-17): セトリズム = 入力欄<16px 5件(HARD)・タップ<44px 44件・font-size宣言33種・生16進25 / 波チェック・Replier も入力欄<16px あり / HONMONO は HARD 0。

## 公開

GitHub Pages。**main へ push = 公開**。WO 完了≠公開(上位正本 工程4R2+工程7 Codex PASS の後)。

## UI Workbench(`index.html`・08-16)

トークンの容器・スマホプレビュー・`tokens.json`/`theme.css` 書き出し・素材チェックリスト。**候補生成はトークン値の出所にしない**(正本 §9)。
