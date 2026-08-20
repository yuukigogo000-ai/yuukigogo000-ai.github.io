# yuukigogo000-ai.github.io — リポジトリ規則

## 期待値エクスプローラー(expectation-explorer.html)

### UI 改善の正本(2026-08-20 切替)
**`docs/ui/AI_UI_MASTER_PROTOCOL_v2.md`(AI UI改善マスタープロトコル v2)がこのアプリの UI 工程正本。**
旧 `~/.claude/playbooks/UI_PLAYBOOK.md` は参考に留める(体系が違う)。

**再開するときは会話履歴より先に `docs/ui/UI_HANDOFF.md` を読む。**

| 文書 | 役割 |
|---|---|
| `docs/ui/UI_HANDOFF.md` | **現在地**(Phase・branch・commit・課題・次にやること) |
| `docs/ui/FEATURE_INVENTORY.md` | **機能凍結の正本**。UI を作り変えたらこれと1つずつ照合する |
| `docs/ui/ARCHITECTURE.md` | 層構造・保存・状態・変更影響範囲 |
| `docs/ui/PHASE2_REQUEST_FOR_CHATGPT.md` | Phase 2(Visual Reference 生成)の依頼書 |

### 絶対ルール
- **Visual Reference と実データ仕様が衝突したら実データを優先**。AI 生成モックの架空機能・架空データを実装しない
- **Claude は Visual Reference を作らない**(v2 §2 で ChatGPT の役割)。「もっといい感じに」には Reference 生成で答える
- **Claude の自己採点を合格根拠にしない**。最終権限は 発注者 > 第三者スクショレビュー > テスト > 自己採点
- **main へ push = 公開**。公開前に APP_DEV_WORKFLOW 工程7(Codex 破壊的検証)PASS が要る
- 未レビューの UI 実装を勝手に main へ merge / push しない
- 1 iteration で直す大差は **1〜3個**。完成したら自主的に次へ進まず停止する

### 触ってはいけないもの(UI 作業で1行も変えない)
計算(`calc` / `annuity`)・整形(`fmtMan` / `fmtPerHour` / `fmtX` / `fmtPct`)・
保存(`loadProfile` / `loadOptions` / `persist` / `sanitizeProfile` / `sanitizeOption` / `num`)・
XSS 防御(`esc`)・定数(`LS_PROFILE` / `LS_OPTIONS` / `DOMAINS` / `TEMPLATES` / `PROFILE_DEF`)・
保存キー(`ee_profile_v1` / `ee_options_v1`)と保存形式・`FEATURE_INVENTORY.md` §6 の安定フック。

**外部通信を1本も足さない**(現在ゼロが仕様)。

### 検査(UI を触ったら全部回す)
```bash
node tests/logic_freeze.mjs     # 計算・保存・XSS が1文字も変わっていないか(18対象+5契約)
node tests/destructive.mjs      # 壊れ入力・XSS・極端値・状態遷移(55件)
node tests/shot.mjs docs/ui/screenshots/<名前> --widths 390,360   # スクショ+横はみ出し
MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs \
  --path /expectation-explorer.html --name ee \
  --baseline docs/ui/baselines/ee.json --accept distinct_bg_colors=5
# 状態別: --name ee-long --state state=long   (empty / error も同様)
```
- `--accept distinct_bg_colors=5` は旧 WO §9 で理由を宣言済(M3 トナル階層+判定色の予約)
- `?state=empty|long|error` は検査専用。**付いた回は localStorage を書き換えない**
- **検査器はわざと壊して落ちることを確認してから信用する**
  - `node tests/logic_freeze.mjs --mutate` → **16/16 RED** 必須
  - `uicheck --mutate` → **4/4 RED** 必須

### 復元点
`checkpoint/ee-pre-ui-v2-20260820` → `a2fa492`(UI 白紙宣言時点。機能完成・テスト55緑)
UI 実装用 branch: `ui/ee-v2`
