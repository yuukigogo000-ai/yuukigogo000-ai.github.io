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
