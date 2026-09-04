# EXTRACTION_DRIFT

`CANONICAL_SOURCE_MAP.json` の抽出時点は `f71190b`。
V5着手時のリポジトリHEADは `a3c54f5` であり、その間に **前回のUI再構築(V4)** が入っている。
V4は先生の評価により破棄対象(`0B_INVALID_DEPRECATED_VISUAL_SOURCES.md`)であるため、
V5では **V4のPresentationを一切参照せず**、保護ロジックのみを抽出時点の実装から引き継いだ。

## ベースラインとの照合

| 指標 | 抽出時点 | V5実装時点 | 差分 |
|---|---|---|---|
| SCREENS | 12 | 12(+実績を独立領域化して13) | 実績一覧をモーダル内から独立パネルへ昇格(機能追加ではない) |
| STATES | 62 | 62 | なし |
| FUNCTIONS | 39 | 39 | なし |
| ACTIONS | 35 | 35 | なし |
| DATA_FIELDS | 62 | 62 | なし |
| PROTECTED_ITEMS | 33 | 33 | なし(P-29/P-30はV4で破損 → V5で復旧) |

## V4で発生していたドリフト(V5で修復済み)

| 項目 | V4の状態 | V5 |
|---|---|---|
| P-29 `window.closeModal` / `doReset` / `startGame` | 3件とも欠落 | 復旧 |
| P-30 DOM識別子 | 70件中33件が欠落(`panel-*` → `p-*`、`modalBg`/`modalBox` 廃止、`st*` 廃止 等) | 全70件を復旧し自動検証を追加 |
| モーダル構造 | 独自のシート実装 | `#modalBg` > `#modalBox` の既存構造へ戻した |

## そのほかの差異

- `pachinko/art/hall.jpg`(新規ローカルアセット)を追加。`sw.js` の PRECACHE に登録し、
  キャッシュ世代を `pachi-teikoku-v3` へ更新した(`11_ASSET_AUDIT.md` の許可範囲)。
- アイコン(192/512)とテーマ色はV4で更新済みのものを継承(パス・寸法は不変=P-31〜P-33)。

**方針**: 差異はすべてProduction Codeを優先し、抽出パケットの数値は上記の通り再照合した。
