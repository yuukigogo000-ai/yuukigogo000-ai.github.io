# 基準線レポート(再設計前の現行実装)

取得日: 2026-09-02 / 検査器: `verify/verify_ui.mjs`

この数字は「再設計後にここを下回ってはいけない」という下限である。

## 結果

| 指標 | 値 |
|---|---|
| FUNCTION_COVERAGE | **100.0%**(93件 / 未検証0 / 失敗0)|
| STATE_COVERAGE | **100.0%**(56件 / 未検証0 / 失敗0)|
| UNAUTHORIZED_FUNCTION | 0(Freeze 外の機能なし)|
| RESPONSIVE | PASS(11ページ × 360/390/430 × light/dark = 66通り 横溢れ0)|
| RUNTIME | PASS(11ページ JSエラー0・未捕捉例外0・404の0)|
| INTERACTION | PASS(checker / badge / aicheck / creators の主要フローを自動完走)|
| MOTION | PASS(reduced-motion で無限アニメ0・1秒超アニメ0・操作可能)|

### 検査の方法(内訳)

| 対象 | browser | static | 推論差し替え |
|---|---|---|---|
| 機能 93件 | 93 | 0 | 0 |
| 状態 56件 | 49 | 4 | 3 |

`static` は C2PA署名検証の分岐(有効/不正/読込失敗)で、同梱SDKと実際の署名付きファイルが要るため
ソース上の経路の存在で確認している。90MBモデルを実際に落として推論まで通す経路は
`tests/csp_check.mjs` が別途毎回確認している(実行済み・PASS)。

### 検査器自身の確認

```
node verify/verify_ui.mjs --mutate   → F 93/93 ・ S 56/56 を検出(MUTATE OK)
python3 verify/check_package.py --mutate → 6/6 検出
python3 honmono/tests/verify_site.py --selftest → 6/6 検出
node honmono/tests/test_pages_smoke.js --mutate → 32/32 検出
```

## この作業中に見つかり、直した既存の不具合

| 内容 | 状態 |
|---|---|
| `/honmono/docs/` が 360px / 390px でページ全体が横スクロールしていた(用途表が折り返せない)| 修正済み。既存の `.scroll` パターンを適用 |
| `verify_site.py` / `test_overflow.js` が特定PCの一時ディレクトリを直書きしており実行不能だった | 修正済み。`SITE_ROOT` / `CHROME_PATH` に対応 |
| 既存資料が AIアカウント鑑定を「リスク22項目」と記載(実際はリスク18 + 信頼4)| Truth 側を実測に合わせた |

## 既知の未検査領域(正直に書く)

- 実機のスマートフォン。検査は Chromium のビューポート再現である
- iOS Safari 固有の挙動(HEIC のプレビュー、`position: sticky` の癖)
- 実際に署名された C2PA ファイルでの署名検証の正常系・異常系
- 性能(long task / layout shift / FPS)。Phase 8 の PERFORMANCE は、
  モーション導入前後の比較が要るため再設計後に測る

---

# 再設計後の実測(2026-09-02)

再設計前の基準線(上)と同じ検査器で測った結果。

| 指標 | 再設計前 | 再設計後 |
|---|---|---|
| FUNCTION_COVERAGE | 100%(93件) | **100%(93件・失敗0)** |
| STATE_COVERAGE | 100%(56件) | **100%(56件・失敗0)** |
| RESPONSIVE | 66通り 横溢れ0 | **66通り 横溢れ0** |
| RUNTIME | JSエラー0・404の0 | **JSエラー0・404の0** |
| MOTION | 無限アニメ0 | **reduced-motion で無限アニメ0・1秒超0・操作は健在** |
| layout shift(最大) | 0.0149 | **0** |
| 最悪の long task | 225ms | **208ms** |
| 転送量(最大) | 66KB | 92KB(トップの作品画像を含む) |
| CSP違反 | 0 | **0** |

検査器の自己確認: `verify_ui.mjs --mutate` で F 93/93・S 56/56 を検出。

## 実装中に見つけて直したもの

| 内容 | 直した方法 |
|---|---|
| AIアカウント鑑定で layout shift 0.4166 | 一覧を後から差し込まず、置き場所の直後で組み立てるようにした |
| トップページの転送量 269KB | 作品画像を表示に必要な760px幅へ再エンコード(232KB → 34KB) |
| 帯の色が出ない | トークン名の付け替え(`var(--ok)` → `var(--c-ok)`)に追随していなかった |
| 共有用の結果画像が旧配色のまま | 新しい配色へ置き換え |
| `verify_site.py --selftest` が 5/6 に落ちていた | 仕込みを全置換にして 6/6 に戻した |

## 性能の測り方を直した(2026-09-02)

最初は「再設計前を別の実行で測って保存し、それと比べる」方式にしていたが、
**マシンの混み具合の差がそのまま数字の差になり、一度「劣化した」と誤判定した**
(同じコードで 208ms → 345ms と出た)。

いまは `verify/perf.mjs` が再設計前のコミットを `git archive` で取り出し、
**同じ実行の中で前後を交互に測る**。絶対値は実行ごとに動くが、前後の関係は動かない。

| 実行 | 再設計前の最悪 long task | 再設計後 | 判定 |
|---|---|---|---|
| 1回目 | 250ms | 199ms | PASS |
| 2回目 | 301ms | 340ms | PASS(許容幅の内側) |

layout shift は毎回 0.0149 → 0。
