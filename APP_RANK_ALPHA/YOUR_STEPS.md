# あなたの手順(3 つ、全部コピペ)

J-Quants は契約済み。株ソフトが使っている契約と同じものを使うだけなので、追加料金は出ない(月額制)。
株ソフトからキーを掘り出す必要はない。**J-Quants はログインのメールとパスワードで動く。**

## ① AppTweak のキーを 1 つ取る(新しく要るのはこれだけ)
1. https://www.apptweak.com/ で無料トライアルに登録
2. ログイン後、Account / API の画面で API キーをコピー

## ② キーを入れる
### PC の Git Bash で動かす場合(推奨)
Opus を起動する**同じ Git Bash** に、3 行貼る:
```
export APPTWEAK_API_KEY=①でコピーしたキー
export JQUANTS_MAIL_ADDRESS=J-Quantsのログインメール
export JQUANTS_PASSWORD=J-Quantsのログインパスワード
```
(PowerShell なら `$env:APPTWEAK_API_KEY="..."` の形)

### クラウド(claude.ai/code)で動かす場合
Environments → 使う環境 → Environment variables に同じ 3 つを入れる。

チャットにはキーを貼らない。

## ③ Opus 5 を起動して貼る
1. Git Bash でこのリポジトリのフォルダに入り、`claude` を起動(モデルは Opus 5)
2. `KICKOFF_PROMPT.md` の「初回」の文をコピーして貼る
3. 放置。翌日に止まっていたら「再開」の文を貼る(データ取得が 1 日 5,000 credits 上限のため 2〜3 日かかる)

## 終わったら
Opus から PR と 6 行の報告が来る。結論は `APP_RANK_ALPHA/results/FINAL_VERDICT.md` に VERDICT_0〜5 で書かれる。
