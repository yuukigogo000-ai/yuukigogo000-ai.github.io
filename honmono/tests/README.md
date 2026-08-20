# HONMONO サイトの検査

3本とも「壊れたものを本当に落とせるか」を自分で確かめられるようになっています。
**検査器を直したら、必ず変異注入(`--selftest` / `--mutate`)を通してから信用してください。**

## 1. 静的検査 `verify_site.py`(Python・ブラウザ不要)

```
python honmono/tests/verify_site.py            # 本番の検査
python honmono/tests/verify_site.py --selftest # わざと6種類壊して、全部検出できるか確かめる
```

見ているもの:

- 内部リンクが全部実在するか(リンク切れ)
- HTML のタグ対応・id 重複
- **外部からの読み込み(`src=`)がないか** — プロジェクト規則で禁止
- 未登録の外部ホストへのリンクが増えていないか
- **禁止表現が復活していないか** — 「オフラインでも動作します」(虚偽)、「なぜ偽造できない」(断定)、「いかなる損害についても責任を負いません」(消費者契約法8条で無効)、架空クリエイターの人名
- **必須の記載が消えていないか** — 各ライブラリの著作権表示、免責の限定(「故意または重大な過失」)、学習データのライセンス名、名誉毀損への注意
- 同梱ライセンスファイルとモデル本体の実在

最終確認: 仕込み 6/6 検出。

## 2. ブラウザ実機検査 `test_pages_smoke.js`(playwright-core + Edge)

```
node honmono/tests/test_pages_smoke.js          # 11ページ / 32項目
node honmono/tests/test_pages_smoke.js --mutate # 期待値を全部ずらして、32件すべて落ちるか確かめる
```

見ているもの: 全11ページで **JSエラー0・404なし**、描画後の本文に必須の文言があること、
そして**画面に見えていなくてもDOMに必ずあるべき法的リンク**(モデルの利用条件・クレジット・プライバシー・利用規約)。

最終確認: SMOKE PASS / MUTATE で 32/32 検出。

## 3. 横溢れ検査 `test_overflow.js`

```
node honmono/tests/test_overflow.js
```

360×800 と 390×844(DPR3)で、ページ全体が横スクロールしないことを9ページ×2サイズで確認します。
`overflow-x:auto` の中(広い表)は正当なスクロールなので除外しています。

最終確認: 18通り PASS。

## 実行環境

`playwright-core` は `AppData/Local/Temp/claude/.../scratchpad/bakeoff/node_modules` にあります。
無い場合は `npm i playwright-core` のうえ、システムの Edge / Chrome を使います(ブラウザ本体はダウンロードしません)。
