# 上位スマホゲームの UI を画面ごとに分解する(おはじきバトル向け見本帳・調査メモ)

調査の限界(先に): WebFetch は gamedeveloper.com 系以外で DNS 失敗が多く、curl で本文が取れたのは Game Developer、GMTK(Substack)、4Gamer、GAME Watch のみ。gamebiz.jp・mobilegamer.biz・therookies・outof.games は取得不可。【要約のみ】は WebSearch の要約文に基づく。
**今回、開発者・UI 担当が自分の言葉で語った「戦闘 HUD の具体的な配置・寸法」は、対象 13 作品のうち 1 つも本文で確認できなかった**(Clash Royale は第三者の分析のみ、Marvel Snap の GDC 講演は UI 非中心、原神・崩壊スターレイル・ブルアカ・Pokémon は UI 担当の講演が見つからず)。本文で確かめられたのは、ヘブンバーンズレッド(CEDEC 2022)、プリコネ R(CEDEC 2020、既報)、ウマ娘(Cygames Tech Conference 2021)、Balatro(GMTK)、Game UI Database(Game Developer)。
前回の調査(reports/はじきバトルの演出と動き.md、research_notes/…/縦画面の戦闘UI.md)に書かれた内容(モンストの「どこでも引ける」・StS の意図に数字・Peggle の決着の寄り・カットイン約 2 秒など)は繰り返さない。画面写真・動画で確かめる見本は、末尾の「見本の一覧」にまとめた。

## 1. 戦闘画面の HUD の配置(上・下・横に何を置くか、味方の順番・体力、敵情報、ボタン、片手の届き)

### Takeaway
本文で確かめられた具体は、ウマ娘の「ヘッダー・サブ・メイン・フッターの 4 段+メイン情報は指の来る位置」という構造ルールと、ヘブンバーンズレッドの「重要機能は複数の入口」「明暗差・形の差で次に押すボタンへ目を誘う」だけ。戦闘 HUD の寸法・配置は、PC で実画面を見て取る必要がある。

### Cited Findings
- ウマ娘の育成画面は上から「ヘッダー(ターン数・育成目標・やる気など全体に関わる情報)/サブ情報(3D キャラ・アドバイス)/メイン情報(基礎能力・メインコマンド)/フッター(スキップ切替・ログ・メニュー)」に分かれる。ほぼ固定なのはヘッダーとフッター、変わるのはサブとメイン。「スマートフォンでの操作が前提で、ちょうど指がくる位置にメイン情報」を置く。トレーニング画面に進んでも基礎能力は固定表示のまま、選んだ項目を押すと上がる数値を出す(周回を迷わず速く進めるため)。【本文確認】 — [GAME Watch: 「ウマ娘」UI設計の根幹とは](https://game.watch.impress.co.jp/docs/kikaku/1366165.html)
- 同講演の作り方: 情報の「洗い出し→グループ化→階層化→関連・紐づき→情報フロー」の 5 作業で情報を整理し、画面ごとではなく「情報表示のルール」(位置・優先度)を先に決めた。仕様が「毎月末にレース」から「育成目標」に変わったときも、ヘッダーに目標を足すだけで済んだ。【本文確認】 — 同上、[先行公開スライドの記事](https://game.watch.impress.co.jp/docs/news/1364925.html)
- ヘブンバーンズレッド: スマホは「入力時に指が隠れる・物理的な反応がない・視線が安定しない」という制約があるので、指が届きやすい位置と大きさのボタン、可読性の高いフォント、過度に画面を明滅させないことを方針にした。多い情報は「明暗差や形状差」で視線誘導し、「もう一度プレイする」ボタンの制限時間バーが自然と目に入るようにした。重要機能(メニュー)は ホーム・フィールド・ダンジョンの 3 か所に置く。PC ではなく実機で繰り返し確認することを推奨(PC だと指が隠れる問題が再現されない)。【本文確認】 — [4Gamer: CEDEC 2022 ヘブバン UI](https://www.4gamer.net/games/487/G048777/20220826055/)
- Clash Royale は、操作を何層も奥のメニューに入れず HUD に出し、タブをスワイプで切り替え、各セクションの内容を即時に出して読み込み待ちをなくしている(Om Tandon・DIGIT Game Studios の UX ディレクターの評)。「中核の情報は表面に出す」が要点。【本文確認】 — [Game Developer: 6 examples of UI design](https://gamedeveloper.com/audio/6-examples-of-ui-design-that-every-game-developer-should-study)
- Hearthstone: 「誰が攻撃できるか・誰が致死ダメージを受けるか」といった要点が常に明確、すべてのクリックに見た目と音の返事がある(Stanislav Costiuc の評。開発者本人ではない)。【本文確認】 — 同上
- Overwatch の Zarya は、エネルギー表示を照準の周りに置いて「目の移動をなくす」(Oliver Janoschek・Massive の UI アーティストの評)。一般則「重要な情報は、プレイヤーが一番見ている所へ寄せる」の例。【本文確認】 — 同上
- Clash Royale の第三者分析: 重要な要素は片手の親指が届く範囲に置き、最も重要なボタンは黄色。【要約のみ】 — [The Rookies の分析(取得不可・検索要約)](https://discover.therookies.co/2020/02/24/game-design-ux-best-practices-detailed-breakdown-of-clash-royale/)
- Pokémon UNITE モバイル版は UI を大きく作り直し、操作系の見た目を変えた。タップで狙う相手を優先指定できる。小さすぎるアイコンがあるという指摘、操作配置のカスタム、UI を全部隠して見通す機能がある。【要約のみ】 — [Destructoid ほかの検索要約](https://thegamehaus.com/pokemon-unite/review-of-pokemon-unite-mobile/2021/09/22/)、[mein-mmo](https://mein-mmo.de/en/7-new-features-that-make-pokemon-unite-finally-playable,724912)
- Brawl Stars: GDC 2019 の講演説明で、操作は従来の Supercell 作品よりはるかに難しく、タッチ向けに簡単にするため大量の試作をした、とある。操作ボタンの配置はカスタム可能(近すぎて押し間違える人がいるため、第三者の批評)。【要約のみ】 — [GDC Vault の講演ページ(検索要約)](https://gdcvault.com/play/1025751/contactUs)、[Pratt ixd の批評](https://ixd.prattsi.org/2025/02/design-critique-brawl-stars/)
- 崩壊スターレイルの戦闘 UI(行動順の表示など)について、開発者が語ったインタビューは、検索で見つからなかった。【調査して見つからず】

### Inferences
- ウマ娘の「情報表示のルール化」は、おはじきバトルの WO(§5 デザイン仕様)にそのまま使える方法である。戦闘・図鑑・勝敗の 3 画面で、上の帯・卓・下の帯に「何をどの位置・優先度で置くか」を 1 枚の表にし、持ち物や目標が増えても「帯の中に足す・外す」で済むようにする(推論。ウマ娘の事例は育成画面で、戦闘ではない)。
- ヘブバンの「指が隠れる」「PC ではなく実機」は、WO の「引っぱる親指が情報を隠さない」「iPhone で弾く(G7)」と同じ考え方で、裏づけになる(強)。
- ヘブバンの「重要機能は複数の入口」は、おはじきバトルの「…」に集約する方針と逆向きに見える。ただし戦闘中の主操作は 1 つなので矛盾しない。図鑑・持ち物は「戦闘中は長押し/勝敗画面から」の 2 か所に置くのが妥当(推論)。

### Gaps
- Clash Royale の戦闘画面(エリクサー棒・手札 4 枚・次のカード)の位置・寸法の一次資料は未取得。Supercell の UI 担当の講演・記事は検索で見つからなかった(求人ページのみ)。
- Brawl Stars・Pokémon UNITE・Pokémon Masters EX・ブルーアーカイブ・原神・崩壊スターレイル・Royal Match・Marvel Snap の戦闘 HUD の「味方の順番・体力・必殺までの回数」の出し方は、開発者発言を取れなかった。画面で確かめるしかない(末尾の一覧)。

## 2. 数字と文字の見せ方(太い数字・縁取り・ダメージの色分け・大きな数の略し方・文字の段数)

### Takeaway
今回、これを開発者が具体的に語った本文は取れなかった。確かめられたのは Balatro の「数字がだんだん上がる+音+倍率が燃える」を「結果を見せる儀式」にする考えと、ヘブバンの「可読性の高いフォント・独自フォントとブランドカラーで認知を取る」だけである。

### Cited Findings
- Balatro は、手を出した後に「数字が上がっていき、音が段々高くなり、各カードとジョーカーが順に前へ出て自分の点を足し、運がよければ倍率が燃え、掛けるほど強く燃える」。作者は事前の点数プレビューを意図的に出さない(出すと「儀式」が意味を失う、UI に「点数の幅」を出す手間が増える、最適化の作業になる、が理由。ただし電卓で計算されてしまう点は、GMTK が設計上の弱点と指摘)。【本文確認】 — [GMTK: Balatro's Cursed Design Problem](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- Balatro の「数字を積み上げる」見せ方は、第三者の分析で「揺れ・粒・数字・音の重ね合わせ」「揺れの強さで手の大きさを知らせる」と読まれている(分析者の解釈で開発者発言ではなく、記事内のタイミング値は例示と見られる)。【要約のみ】 — [blakecrosley.com の Balatro 分析](https://blakecrosley.com/guides/design/balatro)
- ヘブバンは、原作に合わせて独自フォントとブランドカラーのピンクを作り、「ヘブバンといえばあのフォントとピンク」と認識されるようにした。画面に余白を残し、装飾を可能な限り削る。【本文確認】 — [4Gamer](https://www.4gamer.net/games/487/G048777/20220826055/)
- ウマ娘のレース結果の「ピラミッド」(ファン数の重要性を強調する表示)は、情報表示ルールの中で後から追加された。数字は「現在のファン数/目標までの残り/獲得できる数」と、関係で整理されている。【本文確認】 — [GAME Watch](https://game.watch.impress.co.jp/docs/kikaku/1366165.html)
- Game UI Database 2.0 のギャラリー表示は、画面要素ごとに「アイコンの使い方」「フォントの大きさ」などの情報が見られる。【本文確認】 — [Game Developer: Game UI Database relaunches](https://www.gamedeveloper.com/design/game-ui-database-relaunches-with-new-features-video-support-and-over-55-000-screenshots)

### Inferences
- ダメージ数字の「色分け」(通常・弱点・クリティカル・回復)と「大きな数の略し方(1.2万・1.2K)」は、モンスト、パズドラ、ウマ娘、原神、崩壊スターレイルで画面を撮って、「色の数」「略す桁」「文字の段数」を数えるのが一番早い(推論。末尾の一覧)。数えるときの観点は、既存の WO の「文字階層 5 つ以内」。
- Balatro の方式は、おはじきバトルの「手の最後の合計」と構造が同じ(順に足す→最後に大きく)。ただし Balatro は「予告を出さない」、おはじきバトルは「予測線で先に出す」と、情報の出し方が逆である。おはじきは「先に見せる+結果で驚かせる」の組合せになる点を意識すべき(推論)。
- 「縁取り・影つきの太い数字」は、ゲーム画面の大半で見られるが、本文で確かめた資料は取れなかった。見本は Game UI Database で「HUD/ダメージ数字」を絞って集める。

### Gaps
- 文字の段階数(見出し・本文・注記が何段か)を、実際のゲームで数えた資料は取れなかった。
- 数字の略し方の基準(何桁から万・K にするか)を語った資料は見つからなかった。

## 3. ボタンの押し心地(沈む・縮む・光る・音・押せない見た目・反応までの時間)

### Takeaway
開発者が語った数値は取れなかった。確かめられたのは、Hearthstone の「すべてのクリックに見た目と音の返事」、ヘブバンの「意図の伴うアニメーションに適切な音を付ける・アニメーションの規則書を作る」だけである。

### Cited Findings
- Hearthstone は「カードを画面上で動かすだけでも満足感がある」ほど、あらゆるクリックに見た目・音の返事がある(評者 Costiuc の言)。【本文確認】 — [Game Developer: 6 examples](https://gamedeveloper.com/audio/6-examples-of-ui-design-that-every-game-developer-should-study)
- ヘブバン: 単に動かすのは冗長になるので、「意図の伴うアニメーション」に「適切なサウンド」を付ける。そのために「アニメーションコンセプト」「アニメーションレギュレーション」という文書を作って品質を保つ。入力は、タッチパネルに物理的な反応がなく成功を確認しにくいことが前提。【本文確認】 — [4Gamer](https://www.4gamer.net/games/487/G048777/20220826055/)
- Clash Royale 評: 画面の切り替えで待たせない(タブ内容の即時表示)。【本文確認】 — [Game Developer: 6 examples](https://gamedeveloper.com/audio/6-examples-of-ui-design-that-every-game-developer-should-study)

### Inferences
- 「アニメーションの規則書」(長さ・イージング・音を 1 つの表にする)は、おはじきバトルの「動きの数値を 1 か所のトークンに」の考えと同じ(前回の報告書にも同じ提案)。作品で裏づけられたのは、ヘブバンの運用(中)。
- 押し心地の具体(沈む量・時間)は、Clash Royale・Royal Match・ブルアカのボタンを動画でコマ送りにして測る(末尾の一覧)。M3 の押下状態の数値は未取得(前回と同じ)。

### Gaps
- ボタンの「沈む量・縮む割合・押してから反応までのミリ秒」を語った資料は、1 件も取れなかった。
- 「押せないときの見た目」(グレーアウトか、理由の表示か)を語った資料は取れなかった。

## 4. 画面の切り替え・読み込み・結果画面の順番

### Takeaway
本文で確かめられたのは、プリコネ R の「画面遷移のストレスを減らす」が CEDEC のテーマだったこと(既報)、Clash Royale の「タブをスワイプ・即時表示」、ヘブバンの「時間が経つ画面では、あえて間を取る」、ウマ娘の「結果にピラミッドを追加して重要な数字を強調」だけ。結果画面の順番(勝敗→星→報酬→次へ)を語った一次資料は取れなかった。

### Cited Findings
- ヘブバン: 1 日の始まりと終わり、時間が経つ画面では「あえてじっくり間を取り」、安堵や儚さを演出する。タイトル画面は静止画から「カメラが動く」ものに変え、「通過するだけ」の画面に楽しみを足した。【本文確認】 — [4Gamer](https://www.4gamer.net/games/487/G048777/20220826055/)
- ウマ娘: 育成目標の開始と達成の画面を追加して動機づけを明確にした。レース結果にファン数の「ピラミッド」を足した。【本文確認】 — [GAME Watch](https://game.watch.impress.co.jp/docs/kikaku/1366165.html)
- Clash Royale: タブ間の移動で読み込み待ちが出ない。【本文確認】 — [Game Developer: 6 examples](https://gamedeveloper.com/audio/6-examples-of-ui-design-that-every-game-developer-should-study)
- Royal Match: UI のアニメーションを「単純さ・磨き・焦点」を伝える手段にし、物理的につながる動きで文字や情報の説明を減らす(分析者の評)。リトライ時は目的画面を省き、外にいる時間を減らして試行数を増やす(分析者の観察)。クリアで星を 1 つもらう(星=通貨)。【要約のみ】 — [Funovus](https://funovus.com/blogs/royal-match-dominates-match-3-what-can-all-designers-learn)、[Medium: Game Analysis of Royal Match](https://medium.com/@ekinmelissezer/game-analysis-for-royal-match-and-toon-blast-9c4bff8ef48b)
- 別作品(Slime Road)の「レベルクリア」は、粒、上から降る紙吹雪、最終スコアの文字アニメで構成されると紹介されている(参考。上位作品ではない)。【要約のみ】 — [Game Developer: 3 game juice techniques](https://gamedeveloper.com/design/3-game-juice-techniques-from-slime-road)
- Shadowverse(CEDEC 2017)は、戦闘中のキャラアニメ・エフェクトに加えて「結果を表示する UI アニメーション」を講演の題材にした。【要約のみ】 — [gamebiz.jp](https://gamebiz.jp/news/192687)(取得不可)

### Inferences
- 結果画面の順番は、Royal Match・Clash Royale・ブルアカ・ウマ娘の結果を動画で 1 コマずつ見て、「何秒目に何が出るか」を表にするのが早い(末尾)。作品名と順番の想定(勝敗→主役の数字→報酬→次へ)は推論であり、本調査で本文確認はできていない。
- 「負けは静かに・間を取る」は、ヘブバンの「間を演出にする」と同じ向きで、前回の報告の負けの扱いと整合する(中)。

### Gaps
- ワイプ・フェード・カードが飛ぶ遷移の時間、読み込み中の見せ方(進行バー・ヒント・キャラ)の資料は取れなかった。
- 結果画面の順番・各段の秒数の一次資料は取れなかった。

## 5. 説明の出し方(長押しツールチップ・図鑑・初回チュートリアル・NEW 表示)

### Takeaway
Marvel Snap の GDC 講演がオンボーディングを扱っているらしいが、本文は取れなかった。確かめられたのは、ウマ娘の「育成目標の開始画面で動機づけ」、Marvel Snap の「カード文言を明確にする継続改修」(要約)、Game UI Database に「画面種別」で絞る機能があること。

### Cited Findings
- Marvel Snap: Ben Brode の GDC 2023「Designing MARVEL SNAP」(Design 部門)と、Kent-Erik Hagman のオンボーディングを含む講演がある(内容は要約のみ)。UI を語ったとは確認できず。【要約のみ】 — [GDC Vault: Designing MARVEL SNAP](https://www.gdcvault.com/play/1029024/Designing-MARVEL-SNAP)、[mobilegamer.biz](https://mobilegamer.biz/second-dinner-reveals-the-secrets-of-marvel-snaps-onboarding-and-card-design/)
- Marvel Snap は、カード文言を継続的に直している(「activate」を「repeat」へ、「first」を「next」へ。「Odin の機能を明確に伝えない」という理由)。また、ターン終了の取り消し(undo end turn)を含むパッチがある。【要約のみ】 — 検索要約: [marvelsnap.com パッチ告知](https://marvelsnap.com/author/seconddinnerjared/)、[outof.games のパッチ記事の見出し](https://outof.games/news/7156-marvel-snaps-latest-patch-adds-graveyard-viewing-undo-end-turn-balance-changes-and-more/)(詳細は確認できず)
- Marvel Snap の開発者の助言: 縦持ちを使い、画面回転を強いない。【要約のみ】 — [outof.games](https://outof.games/news/6233-ben-brode-marvel-snap-devs-provide-game-design-tips-for-mobile-gaming/)(前回の調査と同じ出典)
- ウマ娘: 情報の「関連・紐づき」(例: 現在のファン数と出走条件のファン数から「残り何人」を出す)で、説明しなくても読める数字を作る。【本文確認】 — [GAME Watch](https://game.watch.impress.co.jp/docs/kikaku/1366165.html)
- Game UI Database 2.0: 55,000 枚超のスクリーンショットと 1,700 本超の動画(1,341 作品)。画面種別・操作・質感・模様・HUD 要素・色などで絞れる。動画は「アニメーション・画面の流れ・ゲーム状態・仕組み・手触り」の見本に使える。色覚フィルターもある。無料。作者は UI アーティストの Edd Coates。【本文確認】 — [Game Developer](https://www.gamedeveloper.com/design/game-ui-database-relaunches-with-new-features-video-support-and-over-55-000-screenshots)

### Inferences
- 長押しツールチップ・図鑑・NEW 表示は、ブルアカ・Pokémon Masters EX・モンスト・原神の画面を実際に見て、「図鑑の一覧は何列か」「NEW の形と消える条件」を拾うのが現実的(推論。末尾)。本調査では本文確認ゼロ。
- カード文言を「何を起こすか」が曖昧でない動詞に直す Marvel Snap の運用は、おはじきバトルの技・進化の説明文を書くときの参考になる(推論。要約のみの根拠なので弱)。

### Gaps
- 長押しツールチップの長押し時間・表示位置、NEW バッジの仕様・消し方、初回チュートリアルの出し方(矢印・暗転・強制の有無)を語った資料は取れなかった。

## 6. UI デザイナーの講演・記事で語られた原則と失敗談

### Takeaway
本文で確認できたのは、ヘブバン(WFS)、プリコネ R(Cygames)、ウマ娘(Cygames)、Balatro(GMTK 経由)、Game Developer の 6 UI 事例記事の 5 件。Supercell・Second Dinner・Riot・Mega Crit・HYPERGRYPH・miHoYo の UI 担当者の講演は、本文を確認できなかった。

### Cited Findings
- ヘブバン(長﨑二郎氏・WFS): 「アニメーションコンセプト」「アニメーションレギュレーション」の文書、UI の課題は「ゲームに組み込んで初めて気づく」ので修正期間を見積もる、関係者全員のプレイ会(UI デザイナーは毎日、エンジニア入りで週 2〜3 回、プランナー入りで週 1 回)、優先度は「高・中」ではなく全体の通し順位で管理、週 2 本のモバイルゲームの UI をレビューする「UI Discussion」を 2015 年から続け 700 本超。【本文確認】 — [4Gamer](https://www.4gamer.net/games/487/G048777/20220826055/)
- ウマ娘(土肥仁氏・Cygames): 画面ごとではなく「情報表示のルール」を先に作ると、途中の仕様変更(月末レース→育成目標)に耐える。【本文確認】 — [GAME Watch](https://game.watch.impress.co.jp/docs/kikaku/1366165.html)
- Balatro(LocalThunk): 点数プレビューを選択肢でも入れない理由は「入れたら人はそれを押してしまう」。GMTK は「情報を隠したつもりでも計算できてしまうと、別の遊び方(電卓)を生み、悪化する」とし、後半で解除する・Mod に任せる案を挙げた。Binding of Isaac の「ブラウザを開かないと遊べない」状態を失敗の前例とする。【本文確認】 — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- Game Developer の UI 事例: 重要な HUD 要素は「プレイヤーが一番見る所へ」「必要なものだけ出し、不要なものは落とす(Half-Life 2)」「音の返事」を挙げる。【本文確認】 — [6 examples of UI design](https://gamedeveloper.com/audio/6-examples-of-ui-design-that-every-game-developer-should-study)
- Brawl Stars は、操作が最初は横画面・タップ移動だったなど、操作を何度も作り直したと第三者の回顧が書く。【要約のみ】 — [Deconstructor of Fun](https://deconstructoroffun.com/blog/2018/5/11/bs)
- CEDEC 2017〜2022 の UI 関連の講演の存在(ドリコム「ダビスタ」の UI フレームワーク、Shadowverse のアニメーション、プリコネ R の画面遷移・プロトタイプ、サイバーコネクトツーの世界観と機能性)。内容は題名と要約のみ。【要約のみ】 — [gamebiz.jp の検索結果](https://gamebiz.jp/news/218678)(取得不可)
- Cygames は Tech Conference のアーカイブ動画を公開している(ウマ娘の UI 講演の動画も含まれると見られるが、動画自体は未確認)。【要約のみ】 — [GAME Watch: アーカイブ公開](https://game.watch.impress.co.jp/docs/news/1368656.html)

### Inferences
- おはじきバトルが借りられる運用: 「アニメーション規則書」「情報表示ルール表」「週 2 本の他社 UI レビュー(の簡易版)」。最後は、PC のセッションで「1 回の見本集めで 5 作品×3 画面」を目標にする運用に落とせる(推論)。
- Balatro の教訓は、おはじきバトルの「予測線で結果を先に見せる」設計と反対向きだが、ゲームの芯が違うので矛盾ではない。ただし「結果が読める分、演出で驚かす余地は小さい」点は、前回の「格表」の設計と整合する(推論)。

### Gaps
- Supercell・Second Dinner・Riot・Mega Crit・HYPERGRYPH・miHoYo の UI 担当者が UI を語った本文の資料は、見つからなかった(あるいは取得できなかった)。GDC Vault の講演ページは説明文のみ。

## 7. Game UI Database など資料集の存在と使い方

### Takeaway
Game UI Database(gameuidatabase.com)が最有力の資料集。無料で、画面種別・HUD 要素・色などで絞れ、動画もある。モバイル作品がどれだけあるかは未確認なので、PC で実際に開いて対象作品を検索して確かめる。

### Cited Findings
- Game UI Database 2.0(2024 年 8 月公開): 55,000 枚超のスクリーンショット、1,700 本超の動画、1,341 作品。画面種別・操作・質感・模様・HUD 要素・色で絞り込み。ギャラリーに「アイコンの使い方」「フォントの大きさ」の情報。色覚フィルターなど見え方の変換。動画は「アニメーション・画面の流れ・ゲーム状態・仕組み・手触り」の参考。作者は Edd Coates、無料。【本文確認】 — [Game Developer](https://www.gamedeveloper.com/design/game-ui-database-relaunches-with-new-features-video-support-and-over-55-000-screenshots)
- 使い方の例(「Main Menu」を雰囲気の近いゲームで探し、質感・色・アニメを見る)。【要約のみ】 — [80.lv](https://80.lv/articles/game-ui-database-collecting-references-to-inspire-designers/)、[Xsolla](https://accelerator.xsolla.com/blog/game-ui-database)
- Marvel Snap のパッチ・UI 資料として Figma 製の UI 分解が存在するらしいという記述(pcper ページ)があるが、確認できなかった。【要約のみ】 — [pcper の同名記事](https://irc.pcper.com/designing-marvel-snap.html)
- 他の資料: GDC Vault(有料が多い)、CEDEC の公式アーカイブ(cedil.cesa.or.jp は検索に出ず)、Cygames Tech Conference のアーカイブ動画。【要約のみ】

### Inferences
- 著作権の観点: 他社画像の持ち込みは禁止(CLAUDE.md)。見本は「構図・配置・段数の観察メモ」にして、画像そのものは作業用の参照に留め、リポジトリや公開物に入れない運用が安全(推論。法的判断ではない)。
- 絞り込みの鍵: 「画面種別=Battle/Results/Collection/Tutorial」「HUD 要素=Health bar/Turn order」「作品=Marvel Snap・Clash Royale…」の組合せ(推論。実サイトのフィルター名は未確認)。

### Gaps
- Game UI Database に、対象 13 作品のうち何作品が載っているかは未確認。

## 8. おはじきバトルの画面ごとに真似られる UI(推論表)と、画像・動画で確かめる見本の一覧

### Takeaway
本調査の本文確認だけで言えるのは「情報表示ルール表を先に作る」「実機で指の隠れを確かめる」「予告・次に押すものへ明暗差で目を誘う」「結果を数える順で見せる」「勝敗など時間の経つ画面は間を取る」「アニメの規則書を作る」。作品ごとの具体的な形は、下の一覧を PC で撮って決める。

### Cited Findings
(上の各節の【本文確認】を参照。以下の表は、それらを元にした推論である。「根拠の強さ」は、強=本文確認が複数、中=本文確認 1 件または要約が複数、弱=推論・要約 1 件)

### Inferences — 真似られる UI の表(推論)

| 画面 | 真似る UI | 作品・具体例 | 根拠の強さ |
|---|---|---|---|
| 戦闘 | 画面を「ヘッダー(全体情報)/サブ/メイン(指の来る位置)/フッター」の 4 段に決め、足す・外すはその中でだけ行う | ウマ娘の育成画面 | 中(本文確認 1 件。育成画面であって戦闘ではない) |
| 戦闘 | 次に押すべきものを、明暗差・形の差で目に入れる(必殺ボタンが溜まったら光る、取り消し範囲の帯) | ヘブバンの「もう一度プレイする」の時間バー | 中(本文確認 1 件) |
| 戦闘 | 引く指で隠れる位置に重要情報を置かない。必ず実機で確認 | ヘブバン講演の「指が隠れる」 | 強(前回のモンストの事例と合わせて) |
| 戦闘 | 「今押せる/誰が危ない」を常に表に出す | Hearthstone の「誰が攻撃できるか・致死か」 | 中(評者の言) |
| 戦闘 | 結果を後で順に足す儀式(数字が上がる・音が高くなる)。ただしおはじきは予測線で先に見せる | Balatro | 中(本文確認 1 件) |
| 戦闘 | ターゲットを 1 タップで優先指定 | Pokémon UNITE モバイル | 弱(要約のみ) |
| 勝敗 | 重要な数字を 1 つ強調する構造(ファン数のピラミッドのような) | ウマ娘のレース結果 | 中(本文確認 1 件) |
| 勝敗 | 負けは間を取り、静かに(前回の報告の方針と合う) | ヘブバンの「間を演出に」 | 中 |
| 勝敗 | リトライ時は説明を省いて 1 タップで再戦 | Royal Match(分析者の観察) | 弱(要約のみ) |
| 図鑑・説明 | 数字は「関連・紐づき」で、残り・差分として出す(例「次の進化まで 2」) | ウマ娘の「目標までの残りファン数」 | 中(本文確認 1 件) |
| 図鑑・説明 | 文言は何が起きるかを動詞で曖昧なく書き、運営で直し続ける | Marvel Snap のカード文言改修 | 弱(要約のみ) |
| 図鑑・説明 | 画面の入口は複数(戦闘中は長押し、勝敗画面から、メニューから) | ヘブバンの「メニュー 3 か所」 | 中(本文確認 1 件。置き場所は推論) |
| 全体 | アニメの規則書(長さ・イージング・音)を 1 枚作る | ヘブバン | 中(本文確認 1 件) |
| 全体 | 切り替えで待たせない(タブ即時表示) | Clash Royale | 中(評者の言・本文確認) |
| 全体 | 重要な要素は一番見る所の近くへ | Overwatch Zarya(評) | 中 |

### Inferences — 画像・動画で確かめる見本の一覧(PC で見る。以下は「見る観点」の提案で、画面の中身は本調査では未確認。作品の画面は筆者の一般的な知識からの当たりであり、事実として書いていない)

見るときは、横に Game UI Database(gameuidatabase.com)を開き、作品名と「画面の種別」で絞る。動画で、押した瞬間からコマ送りで秒数を測る。

| 作品 | どの画面を見るか | 何を数える・測るか |
|---|---|---|
| Clash Royale | 戦闘中(手札 4 枚+次のカード+エリクサー棒)、勝敗(王冠→報酬箱) | 下 1/3 に置かれたものの数、黄色ボタンの数、結果の各段の出る秒数、カードを押したときの沈み |
| Brawl Stars | 戦闘中の操作(左右の円・ボタン)、結果(順位→報酬) | 操作系の大きさ(画面幅に対する割合)、結果が出るまでの秒数、ボタン配置カスタムの画面 |
| Marvel Snap | 対戦盤面(カード・場所)、ターン終了/スナップの位置、結果と「次へ」、カードの長押し説明 | 文字の段数、ボタンの数、長押しの表示位置、カード文言の長さ |
| Pokémon UNITE / Pokémon Masters EX | UNITE の操作・HUD(スキルボタン・ターゲット指定)、Masters EX のバトル(行動順・HP・技ゲージ・シンクロ技の演出) | 味方・敵の体力と行動順の出し方(順番の列の有無)、必殺までの回数の出し方、長押しの説明 |
| モンスターストライク | 戦闘(敵頭上のカウント、味方 4 体の HP とSS、ターゲット矢印)、結果(経験値・報酬の順) | HP 棒の位置・SS の光り方、ダメージ数字の色の数と略し方、結果の各段の秒数 |
| パズル&ドラゴンズ | 戦闘(コンボ数・ダメージ数字・敵の HP とカウント)、結果 | れんさ数字の大きさの段、色分け、数字の略し方 |
| ウマ娘 | 育成トップ→トレーニング(上がる数値)→レース選択→結果(ピラミッド)、育成目標の開始/達成画面 | 4 段構造の固定部分と変化部分、数字の優先順、周回用の短縮(スキップ)の位置 |
| ブルーアーカイブ | 戦闘(スキルボタン・コスト・オート/倍速)、結果(星→報酬)、生徒の説明 | 倍速・オートの位置と大きさ、コスト表示、スキップの設定、星の出し方 |
| 原神 / 崩壊スターレイル | 原神=戦闘中の HUD と元素の表示、スターレイル=戦闘の行動順(上部)・必殺の SP・弱点属性、図鑑 | 行動順の見せ方(スターレイル)、弱点の見せ方、図鑑の一覧の構造と NEW 表示 |
| Slay the Spire(スマホ版) | 戦闘の敵の意図・手札・ターン終了、カード報酬、図鑑 | 敵の意図の数字・アイコンの大きさ、手札の押し方 |
| Balatro(スマホ版) | 手を出した後の数字の上がり方・倍率の炎、ショップ、ジョーカーの長押し説明 | 数字の段階数、音の上がり、説明の出る位置 |
| Into the Breach(スマホ版) | 敵の予告(矢印・攻撃範囲)、折りたたみ UI | 予告の色の数、情報の折りたたみ方 |
| Royal Match | レベルクリア(星・報酬の順)、リトライ、ブースター演出 | 結果の各段の秒数、リトライまでのタップ数、押し心地 |

見るときの共通の観点(おはじきバトル向け): ①下 1/3 に置かれたもの ②文字の段数と数字の略し方 ③結果の出る順番と各段の秒数 ④ボタンを押した後に反応が出るまでと、沈み・縮み ⑤長押しの説明の位置 ⑥NEW の形と消える条件 ⑦味方の順番・体力・必殺までの回数の出し方。

### Gaps
- 上の見本一覧の「画面の中身」は、検索・本文で確かめていない部分が大半。Clash Royale の手札 4 枚・エリクサー棒、スターレイルの行動順などは一般的な記憶による当たりであり、実画面で確認してから使うこと。
- 対象 13 作品のうち、HUD・結果画面・図鑑の具体を一次資料で確認できたのは、ウマ娘(育成画面)、Balatro(結果の見せ方)、プリコネ R(カットイン)、ヘブバン(方針)のみ。
- 次に許可すると進む出典: therookies、mobilegamer.biz、gamebiz.jp、gdcvault.com、80.lv、deconstructoroffun.com、cedil.cesa.or.jp(ネットワーク許可に追加すると、Clash Royale の第三者分析、Marvel Snap の講演要約、CEDEC 要旨が本文で確かめられる)。
