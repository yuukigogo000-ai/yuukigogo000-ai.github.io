# UI REDESIGN PIPELINE v4.0 — HONMONO

Claude Code は **Product Truth 抽出者 / Function Freeze 管理者 / Design Bridge 管理者 /
実装者 / 自動検証者** であり、**Design Authority ではない**。
Visual / Interaction / Motion は ChatGPT Design Authority が決める。

---

## いまここ

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | REPO TRUTH | ✅ 完了 |
| — | FUNCTION FREEZE(F-ID 93 / S-ID 56) | ✅ 完了 |
| 2 | VISUAL SANITIZATION | ✅ 完了(機械検査つき) |
| 3 | BLIND DESIGN BRIEF | ✅ 完了 |
| 4 | CHATGPT DESIGN REQUEST + 自己検証 | ✅ 完了(mutate 6/6) |
| 5 | DESIGN RETURN VERIFY | ✅ VERIFIED(mutate 12/12) |
| 6 | DESIGN FREEZE | ✅ `frozen/` に凍結 |
| 7 | IMPLEMENTATION | ✅ 11画面を実装 |
| 8 | AUTOMATED VERIFICATION | ✅ FUNCTION 100% / STATE 100% / 性能劣化なし |
| 9 | POST IMPLEMENT CAPTURE | ✅ 56枚 + モーションの証跡 |
| **10** | **FINAL CHATGPT REVIEW** | ⏸ **ここで停止中(人手で渡す必要がある)** |
| 11 | REPAIR(最大2ラウンド) | ⬜ レビュー結果待ち |
| — | Gate H5 READY_FOR_USER_APPROVAL | ⬜ |

Phase 10 は ChatGPT へ `CHATGPT_FINAL_REVIEW_PACKET.zip` を渡す必要がある。
自動の橋渡しがこの環境に無いため、そこで止めている。

### 検証の結果(現在の実装)

| 指標 | 値 |
|---|---|
| FUNCTION_COVERAGE | 100%(93機能・失敗0) |
| STATE_COVERAGE | 100%(56状態・失敗0) |
| RESPONSIVE | 11ページ × 3幅 × light/dark = 66通りで横溢れ0 |
| RUNTIME | JSエラー0・404の0 |
| MOTION | reduced-motion で無限アニメ0・1秒超アニメ0 |
| PERFORMANCE | 再設計前と比較して劣化なし(CLS 0.0149→0) |
| CSP | 違反0。90MBモデルの Worker と wasm も生存 |

---

## ディレクトリ

```
truth/    内部用の製品事実(実装がこれを見る。現行UIの記述も含む)
brief/    Design Authority へ渡す Blind Brief と Function Presence Contract
bridge/   Design Request の zip に入る一式(Visual Sanitization 済み)
return/   ChatGPT から受け取った Design Return(そのまま)
frozen/   凍結した Design Source of Truth。**実装はこれだけを見る**
build/    11ページの静的HTMLを書き出すスクリプトと部品
verify/   サニタイザ・自己検査・Phase 8 検証基盤・キャプチャ・性能測定
CHATGPT_DESIGN_REQUEST.zip        Phase 4 で ChatGPT へ渡したもの
CHATGPT_FINAL_REVIEW_PACKET.zip   Phase 10 で ChatGPT へ渡すもの
ASSUMPTIONS.md                    Gate 外で自分で決めたことの記録
```

`truth/` と `bridge/` の違いは意図的。`truth/` は実装が参照する完全版で、
現行のファイル位置やセレクタを含む。`bridge/` はそれを落としたもの。
**`truth/` を直接 ChatGPT へ渡してはいけない。**

## 動かし方

```bash
# ページを組み立て直す(build/pages/ を直したら必ず)
python3 build/build.py

# Design Request を作り直す(truth/ か brief/ を直したら必ず)
python3 verify/sanitize_bridge.py
cp brief/BLIND_DESIGN_BRIEF.md brief/FUNCTION_PRESENCE_CONTRACT.json bridge/
python3 verify/make_binding.py
python3 verify/check_package.py            # 漏洩・欠落・文言改変・binding
python3 verify/check_package.py --mutate   # 検査器自身の確認(6/6)

# Design Return の検証
python3 verify/check_return.py
python3 verify/check_return.py --mutate    # 検査器自身の確認(12/12)

# 実装の検証
node verify/verify_ui.mjs                  # 機能・状態・レスポンシブ・実行時・モーション
node verify/verify_ui.mjs --mutate         # 検査器自身の確認(F 93/93・S 56/56)
node verify/perf.mjs                       # 再設計前との性能比較

# レビュー用の梱包
node verify/capture.mjs
python3 verify/make_review_packet.py
```

リポジトリ側の検査も通しておくこと。

```bash
python3 honmono/tests/verify_site.py            # --selftest で 6/6
node honmono/tests/test_pages_smoke.js          # --mutate で 32/32
node honmono/tests/test_overflow.js
CHROMIUM_PATH=... node tests/csp_check.mjs
```

`verify_ui.mjs` と `capture.mjs` は `tests/node_modules` の playwright-core と、
システムの Chromium を使う(ブラウザ本体はダウンロードしない)。
Windows では `SITE_ROOT` / `CHROME_PATH` を必要に応じて指定する。

---

## ページを直すとき

**`honmono/*.html` を直接編集しない。** 次の書き出しで消える。

1. `build/pages/<画面>.html`(本文)/ `.css`(その画面だけのスタイル)/ `_scripts.html`(その画面のJS)を直す
2. ヘッダー・メニュー・フッター・アイコンは `build/shell.py` の1か所
3. `python3 build/build.py`
4. 検査を通す

## 再設計後にやること(検査器の側)

マークアップが変わったら、**直すのは `verify/selectors.json` だけ**にする。
`verify_ui.mjs` 本体は書き換えない。書き換えたくなったら、それは
「機能が変わった」か「検査が甘い」のどちらかなので、先にそこを疑う。

直したら必ず `--mutate` を通してから信用する。
