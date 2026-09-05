# あなたの手順(3 つだけ)

## ① お金の判断(1 回)
J-Quants の有料プランを契約するか決める。
- 契約する → 研究が最後まで走る。「10 年以上の履歴」が入るプランを選ぶ(料金は公式サイトで確認)。
- 契約しない(Free)→ Opus は「データ不足(VERDICT_0)」で正常終了する。お金はかからないが結論も出ない。

## ② キーを 2 つ、Opus の環境に入れる
1. AppTweak: 無料トライアルに登録 → API キーをコピー
2. J-Quants: ログイン → リフレッシュトークンをコピー
3. claude.ai/code → Environments → 使う環境 → Environment variables に追加
   - `APPTWEAK_API_KEY` = (AppTweak のキー)
   - `JQUANTS_REFRESH_TOKEN` = (J-Quants のトークン)

キーはチャットに貼らない。ここに入れるだけ。
※ 入れずに始めても壊れない。Opus は「合成データで全部作る」ところまで進んで止まり、再開手順を残す。

## ③ Opus 5 に貼る
`KICKOFF_PROMPT.md` の「初回」の文をコピーして貼る。以後は放置。
翌日に止まっていたら「再開」の文を貼る(データ取得が 1 日 5,000 credits 上限のため、2〜3 日かかる)。

## 終わったら
Opus から PR と 6 行の報告が来る。`APP_RANK_ALPHA/results/FINAL_VERDICT.md` に結論(VERDICT_0〜5)が書いてある。main へのマージはあなたが判断。
