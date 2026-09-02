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
| 4 | CHATGPT DESIGN REQUEST + 自己検証 | ✅ 完了(SELF VALIDATION PASS / mutate 6/6) |
| — | 検証基盤の整備と基準線の取得 | ✅ 完了(FUNCTION 100% / STATE 100%) |
| **—** | **Gate H3 AWAITING_CHATGPT_DESIGN** | ⏸ **ここで停止中** |
| 5 | DESIGN RETURN VERIFY | ⬜ Design Return 待ち |
| 6 | DESIGN FREEZE | ⬜ |
| 7 | IMPLEMENTATION | ⬜ |
| 8 | AUTOMATED VERIFICATION | ⬜(検査器は先に用意済み) |
| 9 | POST IMPLEMENT CAPTURE | ⬜ |
| 10 | FINAL CHATGPT REVIEW | ⬜ |
| 11 | REPAIR(最大2ラウンド) | ⬜ |
| — | Gate H5 READY_FOR_USER_APPROVAL | ⬜ |

Phase 5 以降は Design Return が無いと進められない。
無い状態で見た目を決めることは pipeline §0 の禁止事項にあたるため、着手していない。

---

## ディレクトリ

```
truth/    内部用の製品事実(実装がこれを見る。現行UIの記述も含む)
brief/    Design Authority へ渡す Blind Brief と Function Presence Contract
bridge/   実際に zip へ入る一式(Visual Sanitization 済み)
verify/   サニタイザ・自己検査・Phase 8 検証基盤
CHATGPT_DESIGN_REQUEST.zip   ChatGPT へ渡すもの
ASSUMPTIONS.md               Gate 外で自分で決めたことの記録
```

`truth/` と `bridge/` の違いは意図的。`truth/` は実装が参照する完全版で、
現行のファイル位置やセレクタを含む。`bridge/` はそれを落としたもの。
**`truth/` を直接 ChatGPT へ渡してはいけない。**

---

## 動かし方

```bash
# 1) Design Request を作り直す(truth/ か brief/ を直したら必ず)
python3 verify/sanitize_bridge.py
cp brief/BLIND_DESIGN_BRIEF.md brief/FUNCTION_PRESENCE_CONTRACT.json bridge/
python3 verify/make_binding.py

# 2) 自己検証(漏洩・欠落・文言改変・binding)
python3 verify/check_package.py
python3 verify/check_package.py --mutate     # 検査器自身の確認(6/6)

# 3) 梱包
(cd bridge && zip -q -X -r ../CHATGPT_DESIGN_REQUEST.zip . -x '.*')

# 4) Phase 8 の検証(現行実装でも再設計後でも同じコマンド)
node verify/verify_ui.mjs
node verify/verify_ui.mjs --mutate           # 検査器自身の確認(F 93/93・S 56/56)
```

`verify_ui.mjs` は `tests/node_modules` の playwright-core と、システムの Chromium を使う
(ブラウザ本体はダウンロードしない)。
Windows では `SITE_ROOT` / `CHROME_PATH` を必要に応じて指定する。

---

## 再設計後にやること(検査器の側)

マークアップが変わったら、**直すのは `verify/selectors.json` だけ**にする。
`verify_ui.mjs` 本体は書き換えない。書き換えたくなったら、それは
「機能が変わった」か「検査が甘い」のどちらかなので、先にそこを疑う。

直したら必ず `--mutate` を通してから信用する。
