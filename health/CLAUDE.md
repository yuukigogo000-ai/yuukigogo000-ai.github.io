# カラダ日報 (/health/) — このディレクトリの規則

## 最初に読むもの
1. **`health/docs/ui/UI_HANDOFF.md`** — いまどのPhaseで、次に何をするか(会話履歴より先に読む)
2. **`C:\Users\gogyo\AI_WORKSPACE\_AI_UI_PROTOCOL\AI_UI_MASTER_PROTOCOL_v2.md`** — UI改善工程の正本

## UI(見た目)の規則 — 正本 = AI UI改善マスタープロトコル v2
機能を先に凍結する / **Data truth は Visual Reference より上** / Master + 適用範囲つき Supplemental Reference /
1 iteration = 大きな差 1〜3個だけ / Screenshot で第三者比較(**自己採点を合格根拠にしない**) /
満足した画面は Freeze して触らない / **会話ではなくファイルで引き継ぐ**

| 文書 | 場所 |
|---|---|
| 引き継ぎ(現在Phase・次の作業) | `health/docs/ui/UI_HANDOFF.md` |
| 機能凍結・取得できないデータ | `health/docs/ui/FEATURE_INVENTORY.md` |
| 構造・関数マップ・検査の仕組み | `health/docs/ui/ARCHITECTURE.md` |
| 合格条件(作り直しても不変) | `health/docs/ui/UI_ACCEPTANCE.md` |
| トークンと不変の制約 | `health/docs/ui/DESIGN_SYSTEM.md` |
| 各ラウンドの記録 | `health/docs/ui/REVIEW_LOG.md` |
| Visual Reference | `health/docs/ui/reference/`(+ 権利ルールは同 README) |
| 旧規約時代の作業指示書(経緯) | `health/ui/wo/WO_UI_karada_home.md` |
| 機械検査の基準線 | `health/ui/baselines/karada.json` |

## コマンド
```
node health/tests/smoke.mjs                # 機能テスト38項目
node health/tests/smoke.mjs --mutate       # テスト自身の自己検査(壊して落ちるか)
MSYS_NO_PATHCONV=1 node C:/Users/gogyo/AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs \
  --path /health/ --name karada --baseline health/ui/baselines/karada.json
```

## 変えてはいけないもの(詳細は FEATURE_INVENTORY §4)
- localStorage キー: `ojisan_health_records` / `ojisan_health_settings` / `ojisan_health_checkups`
- 判定の基準値: メタボ=特定健診(男性)腹囲85cm+リスク数 / 血圧=JSH2019 / 純アルコールg換算 / 健診7項目
- CSV の列と順序 / 同日マージ / 旧データ互換(`drinks:n` → n×20g)
- 外部依存を足さない(CDN・Webフォント・アイコン読込・通信すべて禁止。オフラインで動くこと)
- 架空データ・架空機能を作らない。医療免責を消さない
- テストが掴む id / `[data-drink]` / `[data-go]`(変えるならテストも同時に直す)

## 状態の再現
`?state=empty` / `?state=demo` / `?state=saved`(本番URLでは無視され、この状態では localStorage に書き込まない)

## 他社アプリの参考画像
`AI_WORKSPACE/ui_toolkit/refs/karada_*` に置く。**このリポジトリに入れない**(公開されるため)。
