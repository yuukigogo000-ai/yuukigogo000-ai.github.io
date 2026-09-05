# あなたの手順(2 つだけ)

J-Quants の有料プランは契約済みとのことなので、お金の判断は不要。
プランが足りるかどうかは Opus の `doctor` が自動で判定する(足りなければ VERDICT_0 で正常終了し、必要条件を報告する)。

## ① キーを Opus の環境に入れる
「別ソフト」に入れたキーは、そのソフトの中にあるだけで Opus からは見えない。次の場所にコピーする。

**どこに**: claude.ai/code → Environments → 使う環境 → Environment variables

**何を**:
| 変数名 | 値 | どこで見つかるか |
|---|---|---|
| `APPTWEAK_API_KEY` | AppTweak の API キー | AppTweak にログイン → Account / API settings。無ければ無料トライアルに登録 |
| `JQUANTS_MAIL_ADDRESS` | J-Quants のログインメール | 自分のログイン情報。トークンを探す必要なし |
| `JQUANTS_PASSWORD` | J-Quants のログインパスワード | 同上 |

(リフレッシュトークンが手元にあるなら、メール+パスワードの代わりに `JQUANTS_REFRESH_TOKEN` 1 つでもよい)

チャットには貼らない。ここに入れるだけ。

## ② Opus 5 に貼る
`KICKOFF_PROMPT.md` の「初回」の文をコピーして貼る。以後は放置。
翌日に止まっていたら「再開」の文を貼る(データ取得が 1 日 5,000 credits 上限のため 2〜3 日かかる)。

## 終わったら
Opus から PR と 6 行の報告が来る。結論は `APP_RANK_ALPHA/results/FINAL_VERDICT.md` に VERDICT_0〜5 で書かれる。
