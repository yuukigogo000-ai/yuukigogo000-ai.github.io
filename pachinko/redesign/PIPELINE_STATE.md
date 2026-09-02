# UI REDESIGN PIPELINE v4.0 — 実行状態

対象アプリ: `pachinko/index.html`(パチスロ帝国)
Binding ID: **PT-87DA08BE2BEE2CF3**

## 進捗

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | REPO TRUTH(Product Truth / Function Freeze / State Inventory / Copy / 技術制約 / 信頼と安全) | ✅ 完了 |
| 2 | VISUAL SANITIZATION(既存の視覚情報を除去) | ✅ 完了(自動検査 PASS) |
| 3 | BLIND DESIGN BRIEF + FUNCTION PRESENCE CONTRACT | ✅ 完了 |
| 4 | CHATGPT DESIGN REQUEST パッケージ生成 + 自己検証 | ✅ 完了(48 PASS / 0 FAIL) |
| — | **Gate H3: AWAITING_CHATGPT_DESIGN** | ⏸ **ここで待機中** |
| 5 | DESIGN RETURN VERIFY | 未着手(返却待ち) |
| 6 | DESIGN FREEZE | 未着手 |
| 7 | IMPLEMENTATION | 未着手 |
| 8 | AUTOMATED VERIFICATION | 未着手 |
| 9 | POST IMPLEMENT CAPTURE | 未着手 |
| 10 | FINAL CHATGPT REVIEW | 未着手 |
| 11 | REPAIR(最大2ラウンド) | 未着手 |

## 成果物

```
pachinko/redesign/
├── CHATGPT_DESIGN_REQUEST.zip   ← ChatGPT へ渡すパッケージ(11ファイル)
├── request/                      ← zip の中身(そのまま参照可)
├── validate_request.js           ← 自己検証スクリプト
├── ASSUMPTIONS.md                ← 人間へ照会せず自己解決した判断の記録
└── PIPELINE_STATE.md             ← このファイル
```

## 自己検証の結果(`node validate_request.js`)

- 必須ファイル 11件すべて存在 / 想定外ファイルなし
- 視覚アンカーの漏洩なし(色コード・CSS・構成要素語・配置指示・装飾形容・スクリーンショットのいずれも不検出)
- Function Truth カバレッジ: F-001〜F-045 連番一意・必須8項目完備・全依存状態が S-ID に解決・
  全 F-ID が文脈に紐づく(配布基盤レベルの F-044/F-045 を除く)
- Product Truth の全能力が存在契約に定義済み / 存在契約に表示方法の指定なし
- 必須コピー同梱(機種10・実績15・イベント130の量的仕様)
- バインディング有効(全ファイルの SHA-256 が一致)

## 再開方法

1. `CHATGPT_DESIGN_REQUEST.zip` を Design Authority(ChatGPT)へ渡す
2. 返却された `CHATGPT_DESIGN_RETURN.zip` を `pachinko/redesign/return/` に展開
3. Phase 5(DESIGN RETURN VERIFY)から再開する

返却物の要件は `request/DESIGN_RETURN_SCHEMA.json`、
Design Authority への指示は `request/CHATGPT_INSTRUCTIONS.md` に定義済み。

## 不変条件(以後のフェーズでも維持する)

- SOURCE_REPO_INTEGRITY: 本フェーズでゲーム本体のコードは一切変更していない
- Claude Code は Design Authority ではない。未定義の Design Decision は
  `BLIND_DESIGN_BRIEF.md` 第14節として差し戻し済みであり、実装者側で補完しない
