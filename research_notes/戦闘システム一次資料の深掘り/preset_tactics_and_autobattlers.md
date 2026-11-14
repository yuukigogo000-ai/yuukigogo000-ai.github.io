# 事前設定型(陣形・作戦)+自動戦闘とオートバトラーの一次資料深掘り

凡例: 【本文確認】=記事全文を取得して該当箇所を読んだ。【要約のみ】=検索スニペットまたは百科事典の要約のみ。
取得方法の注記: WebFetch は対象ホストを解決できず失敗したため、curl で全文を取得して本文テキストを抽出した(電ファミ・4Gamer・ファミ通・GIGAZINE・Game*Spark・Game Watch・Wikipedia・gamedeveloper.com・pcgamer.com は curl で 200 を確認)。teamfighttactics.leagueoflegends.com、gamesbeat.com は未取得(gamesbeat は空応答)。時間の都合で未着手の対象は各節の Gaps に明記した。

## Unicorn Overlord: 開発者は戦闘の自動化・作戦・スキップをどう語ったか

### Takeaway
開発者の公開発言で確認できたのは、(1)戦闘は自動で、キャラごとに作戦を設定する、(2)勝敗の主因は兵種の相性で、作戦は「あえてこれをやりたい」独自戦略のための細かい層、(3)戦闘アニメのスキップは「なしはまずい」で入れたが、スキップし続けると負けた理由が分からなくなるので悩んだ、の3点。「なぜ自動にしたか」を直接説明した発言は、今回取得した記事には見つからなかった。

### Cited Findings
- 戦闘そのものはオートで進む。「キャラクターごとに作戦を設定しておくようなイメージ」(野間氏)。基本は兵種の相性が勝敗の大きな要因で、SRPGの「すくみ」が基盤、敵構成に合わせて編成するのが基本の遊び方(山本氏)。そのうえで「あえてこれをやりたい」というオリジナル戦略を練れるよう細かな作戦システムを入れた(野間氏)。【本文確認】 [電ファミ TGS2023インタビュー](https://news.denfaminicogamer.jp/interview/230924c)
- フィールド上の敵はシンボルエンカウントで、一戦で全滅させるか「優勢勝ち」ならそのまま探索を続けられる(中西氏)。【本文確認】 同上
- フィールド戦闘は「SRPGパートでの1回の戦闘を切り出したようなもの」で、1回で倒し切れないとシンボルは消えない(ワンターンキル要求)。戦闘後、倒されていなければ両者全回復するため、これは「その地域に自分の部隊が勝てるかの目安」になる。ただし敵が強くても必ず勝てないわけではなく「あくまで目安」(野間・中西)。【本文確認】 [ファミ通 TGS2023インタビュー](https://www.famitsu.com/news/202309/25318154.html)。※これは実質的な「戦闘前の勝てそうか判断の目安」だが、数値による事前勝率予測の機能を語った発言ではない。
- 戦闘アニメのスキップは「慣れてきた人のために」用意した。最初は「スキップさせない方がいいんじゃないか」という話もあったが「スキップのないシミュレーションゲームは流石にマズい」と判断。一方「スキップし続けていると、部隊が負け始めた時に『勝敗の理由』がわからなくなる」ので、「強制で見せれば勝ち方がわかるが、スキップも用意したい」点はかなり悩んだ(野間氏)。【本文確認】 [電ファミ 開発史インタビュー](https://news.denfaminicogamer.jp/interview/240308u)
- 戦闘中に飽きが来ないよう背景・音楽を国ごとに変えた(音楽約90曲)。【本文確認】 同上
- 「バトルの作戦はカードゲームのデッキビルドのような遊びの要素もある」(山本氏)。ステージはリアルタイムで進むが指示を出すときは時間を止められる(中西氏)。仲間キャラは事前に個別に設定した作戦に従って行動(中西氏)。難度選択(CASUAL等)やルート自由、負けても近くの拠点に戻って再開できる点を「SRPGが難しそう」への配慮として挙げた。【本文確認】 [4Gamer TGS2023インタビュー](https://www.4gamer.net/games/739/G073904/20230922082/)
- 戦闘の構造(取材者の記述): 開始すると自動進行。キャラは行動順速度の順に「AP」を消費してアクティブスキル、条件達成時に「PP」を消費してパッシブスキルが自動発動。両部隊の全員のAPが尽きるか片方が全滅で1回の戦闘が終わり、与ダメージ総量などで勝敗が決まる。始まれば介入要素はほぼない。部隊は最大5人(体験範囲では3人)。【本文確認】 [Game Watch](https://game.watch.impress.co.jp/docs/kikaku/1556336-2.html)
- 作戦の具体例: 作戦=スキルごとに「狙う対象/発動条件」を設定。「HPが最も低い敵」優先、「重装系の敵を優先」、味方庇いを「HPが50%以下の味方」で発動、自爆防止に「自身のHPが50%以上」、などを同時セットする。ナイトの例では「前後に並んだ敵がいれば貫通攻撃→いなければ斥候を狙う→どちらでもなければ最もHPの低い敵を単体攻撃」と優先順位つきで複数の作戦を重ねる。GIGAZINEはこれをFF12のガンビットに近いと位置づけた。【本文確認】 [Game Watch](https://game.watch.impress.co.jp/docs/kikaku/1556336-2.html)、[GIGAZINE](https://gigazine.net/news/20240323-unicorn-overlord-battle/)
- 戦闘前の試行錯誤は楽しく時間がかかりがちだが、ステージに入れば移動先指定・戦力投入タイミング・相性比較くらいで、あとは移動から戦闘までオートでサクサク進む(レビュー記者の評価)。【本文確認】 [Game*Spark](https://www.gamespark.jp/article/2024/04/07/140133_2.html)
- Game Watch の記者は、最も易しいCASUALは「作戦」を使いこなせなくてもクリアできるよう調整されていると述べつつ、体感ではCASUALが他作品のNormal程度だったと書く(記者の所感)。【本文確認】 同 Game Watch

### Inferences
- 「判断を戦闘前の編成・作戦に集め、戦闘は結果確認」という分業は、開発者発言(戦闘はオート、作戦は独自戦略のため)と記者評価(戦闘前の試行錯誤が本体)の両方と整合する。
- スキップと「勝敗の理由が分からなくなる」のトレードオフは、本作の戦闘にも直接当てはまる。スキップを入れるなら、スキップ後でも敗因が分かる要約表示が必要になる(推論)。
- 戦闘が時間単位で何秒かの数値は、今回の取得記事に一切出ていない。

### Gaps
- 「なぜ自動にしたか」の設計意図を直接語る発言、作戦スロット数、戦闘秒数、事前勝敗予測の仕様の一次証言は見つからなかった(取得した4記事に無い)。電ファミ2024年開発史記事(240308u)は先頭の一部以外は詳細に精読していない。
- 4Gamer・ファミ通の別号インタビュー(発売後)は未取得。

## FF12ガンビット、DQ作戦、Ogre Battle、Soul Nomad、Carnage Heart 等

### Takeaway
古典側は、ガンビット(条件→行動の優先順位リスト)、DQの作戦(少数のプリセット+学習AI)、Ogre Battle(4種のターゲット方針+タロット介入)と、「設定の粒度」が異なるだけで同じ構造(戦闘前に方針を決める)。ただし開発者インタビュー本文は今回取得できず、百科事典の記述中心である。

### Cited Findings
- FF12: ガンビットは「ターゲット(条件)・アクション・優先度」の3要素で、条件付きの自律行動を設定し、プレイヤーの直接指示が常に最優先。【本文確認(Wikipedia)】 [Wikipedia FF12](https://en.wikipedia.org/wiki/Final_Fantasy_XII)
- FF12: ランダムエンカウント廃止の意図から、シームレス戦闘(ADB)を可能にする手段としてガンビットは開発初期に構想された。戦闘システム設計の友松氏は「複雑で硬直した式から柔軟な最終形に徐々に移った」と述べ、伊藤氏はアメフトのプレー(状況に応じて各人の役割が決まる)から着想を得たと説明(Wikipediaが引く元インタビューを経由する二次記述)。【本文確認(Wikipedia)、元インタビューは未確認】 同上
- FF12の評価: GameSpotは「革新的で奥深いが複雑で、新規には調整が難しい」と批判。IGNは「ゲームが勝手にプレイする」批判に対し「ガンビットはプレイヤーなしでは機能しない」と反論。【本文確認(Wikipedia要約)】 同上
- DQ4(第5章): 主人公以外の仲間はAIがコマンド入力し、作戦は「さくせん」コマンドで移動中・戦闘中を問わず変更できる。作戦は「みんながんばれ」「ガンガンいこうぜ」「いのちだいじに」「じゅもんせつやく」「じゅもんをつかうな」「いろいろやろうぜ」など。AIは戦闘経験でモンスターの弱点を学習し、馬車で待機中のキャラにも適用される。この学習の意図は「役に立つキャラの使用が固定化し、使わないキャラが育たない悪循環を防ぐ配慮」とされる(出典[3]に拠る記述)。【本文確認(ja.wikipedia)】 [DQ4 ja.wikipedia](https://ja.wikipedia.org/wiki/%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88IV_%E5%B0%8E%E3%81%8B%E3%82%8C%E3%81%97%E8%80%85%E3%81%9F%E3%81%A1)
- Ogre Battle(1993): 戦闘中は直接操作せず、ユニットが従う方針(Best/Strong/Weak/Leader の4種)を選ぶ。蓄えたタロットカードの使用(ダメージ、敵を味方化、敵の陣形変更など)が戦闘中の限定介入。部隊は5人以下(大型キャラは2枠)。全25ステージ。【本文確認(Wikipedia)】 [Wikipedia Ogre Battle](https://en.wikipedia.org/wiki/Ogre_Battle:_The_March_of_the_Black_Queen)
- Carnage Heart: メカ(OKE)は戦闘中に直接操作できず、事前のプログラミングと資源管理で計画する。複雑さのため、通常より多量の資料(58ページの攻略本と30分の音声チュートリアルディスク)を同梱した。【本文確認(Wikipedia)】 [Wikipedia Carnage Heart](https://en.wikipedia.org/wiki/Carnage_Heart)
- Soul Nomad: 分隊を編成して指揮する(最大25種のキャラタイプ)。レベル上げの反復を不要にする改善が入った、というゲーム紹介の記述は得たが、戦闘の自動度や批評は取得できなかった。【本文確認(Wikipedia、浅い)】 [Wikipedia Soul Nomad](https://en.wikipedia.org/wiki/Soul_Nomad_%26_the_World_Eaters)

### Inferences
- 作戦の粒度は「プリセット名数個(DQ)→優先順位つき条件リスト(FF12、Unicorn Overlord)」の2層で、プリセットは学習コストが低く、条件リストは深いが重い(FF12の「複雑」、UOの「メニューが重い」批判と整合)。
- Carnage Heart の大量チュートリアルは、「事前プログラム型」は学習コストが最大の壁になることの傍証。

### Gaps
- Ogre Battle / 64、Soul Nomad、DQ Tact、DQ Monsters、Carnage Heart の開発者インタビュー全文は未取得(今回は百科事典のみ)。DQ Tact の ja.wikipedia は取得したが戦闘の自動度の記述は拾えなかった。FF12の Gambit 設計意図の元インタビュー(ファミ通・ゲーマー等)は検索で見つからず、Wikipedia の二次記述止まり。ga mer.ne.jp の記事は検索でヒットしたが未取得。

## オートバトラー: 判断の所在・戦闘時間・可読性補助

### Takeaway
全文確認できたのは「判断は準備フェーズに集約」「ジャンルの1試合は30〜45分で、モバイルには長すぎる」「RNGは負けても勝ち筋が見えることが必要」といった一般論で、1回の戦闘の秒数や、ダメージ集計・リプレイ等の可読性補助の設計は、取得した全文からは確認できなかった。

### Cited Findings
- Hearthstone Battlegrounds: Dota Auto Chess系を取り込んだのは、勝つことが前提でない競技モード(負けても早く脱落して再キューすればよい、バトルロイヤルに近い)が理由の一つ。8人対戦が必要で、シングル版プロトからサーバ側まで大きな投資が必要だった(Corning/Ayala)。【本文確認】 [Game Developer](https://gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler)
- TFT: 初期ビルドは30秒のタイマー内でクリックして駒を出し入れする「ジャグリング」を許していたが、情報処理やクリック速度が遅い人を罰するため、購入上限を設けて廃止した。プレイテスターは「最上位が浮上する仕組みだった」と反発した。【本文確認】 [Game Developer(GDC 2020 Abecassis講演の記事)](https://gamedeveloper.com/design/how-i-teamfight-tactics-i-was-designed-to-target-former-i-league-of-legends-i-players)
- ジャンル分析: 1試合は30〜45分(あるいは平均30〜40分)で、同期プレイが必要なためモバイルに不向き。早期の幸運が雪だるま式に効く。10〜15分の短縮モードの提案がある。Underlordsは「ボス」と「Knockout(短時間・高速成長)」が特色とされる。RNGは「運に任せきりだと人が離れる。必ず勝ち筋が見えること」。【本文確認(論者の意見)】 [Game Developer 市場分析](https://gamedeveloper.com/design/autochess-market-status-and-design-analysis)、[Game Developer 提言](https://gamedeveloper.com/business/rise-of-the-autobattlers-and-learnings-for-world-domination)
- Dota Underlords: 8x8盤に配置→準備フェーズ後は入力なしで自動戦闘。Knockout は高速な短縮モード。【本文確認(Wikipedia)】 [Wikipedia Underlords](https://en.wikipedia.org/wiki/Dota_Underlords)
- Super Auto Pets: 準備フェーズ(購入・配置・食べ物)→バトルは自動、最右の駒が最左の敵と戦い、倒れたら次が出る。非同期で他人のチームと戦う。ターン数・Tier制(2ターンごとに昇格、最大6)。【本文確認(Wikipedia)】 [Wikipedia SAP](https://en.wikipedia.org/wiki/Super_Auto_Pets)
- Backpack Battles: 最大18ラウンド(ショップ/バトルの2フェーズ)、10勝(5敗未満)で勝利。バトルは非同期で操作なし、アイテムは個別間隔で発動し隣接で効果が変わる。早期アクセス中に「戦闘ごとの性能評価のための戦闘ログ」を実装する計画が記録されている。【本文確認(Wikipedia)】 [Wikipedia Backpack Battles](https://en.wikipedia.org/wiki/Backpack_Battles)
- Mechabellum: ラウンド制で、配置後はユニットを動かせず操作もできない。毎ラウンドのカードは全プレイヤーに同じ選択肢が提示され、相手の選択肢を推理できる。相手の配置は戦闘開始まで見えないため予測が重要。PC Gamer は「因果が明快で、失敗の原因が見える、情報の隠しが少ないので上達が公平に感じられる」と評価し、「試合は短く完結し時間を尊重する」と書く(具体秒数なし)。【本文確認】 [PC Gamer 1](https://www.pcgamer.com/games/strategy/mechabellum-is-a-conversation-you-should-be-having)、[PC Gamer 2](https://www.pcgamer.com/i-cant-stop-playing-this-autobattling-strategy-masterpiece)、[Wikipedia](https://en.wikipedia.org/wiki/Mechabellum)
- TFT: 1ステージ7ラウンド、キャルーセルは3ラウンド後。ユニットはマナが満タンで固有スキル発動。【本文確認(Wikipedia)】 [Wikipedia TFT](https://en.wikipedia.org/wiki/Teamfight_Tactics)

### Inferences
- 一人用の本作では雪だるま・対人のメタ問題は小さいが、「負けても勝ち筋が見える」「準備の判断で結果が決まる」「操作が戦闘中に入らない」は共通する設計原則に見える。
- 戦闘ログ(Backpack Battles)や「失敗の原因が見える」(Mechabellum評)は、本作の「見ているだけ」問題に対する可読性補助の先例として使える(推論)。

### Gaps
- 戦闘1回の秒数、ダメージ集計UI、リプレイ、倍速の設計意図を述べた開発者の全文資料は取得できなかった。The Bazaar、Dota Auto Chess 創作者の発言、TFTの戦闘15〜25秒(旧レポートの Mortdog 発言)は今回未検証。Super Auto Pets 開発者の「能力は単純に」発言は引き続き要約のみ。Mechabellum開発者(Game River / Bearlike)のポッドキャストは未取得。

## AFK Arena など放置系の「戦闘」

### Takeaway
放置系の戦闘は、編成・配置(前列後列)と育成が本体で、戦闘は自動。ただし手動で必殺を発動できる。戦闘秒数・スキップ・批判の一次資料は取得できていない。

### Cited Findings
- AFK Arena: 全戦闘は事前に選んだ5人のヒーローで自動進行し、必殺スキルのみ手動発動可能。陣営ごとの戦闘バフや、ヒーローの得意な位置があるため配置が重要。離席中も資源・経験値が得られる。2019年6月時点で660万プレイヤー、累計約10億ドル近い売上。【本文確認(Wikipedia)】 [Wikipedia AFK Arena](https://en.wikipedia.org/wiki/AFK_Arena)

### Inferences
- 「自動戦闘+必殺だけ手動」は、プリコネR(旧レポート)と同型の2層構造。

### Gaps
- 戦闘秒数、スキップ、批評(単調さ・作業感)は未取得。

## 全体を通した総括

### Takeaway
今回、全文で裏付けられた最も具体的な知見は Unicorn Overlord のスキップ議論(見せれば勝ち方が分かるがスキップも必要)と、作戦が「条件付き優先順位リスト」であること。戦闘秒数、作戦スロット数、判断回数の数値は、今回の取得資料からは得られなかった。

### Gaps
- 数値(秒数・スロット数・決定回数)は、取得した全文のどれにも出てこなかった。旧レポートの「戦闘時間の出典はほぼ皆無」という結論は、今回も覆らない。
- 時間不足で未取得: gdcvault、cedil.cesa.or.jp、automaton-media.com、wikiwiki.jp(UOの作戦枠数の攻略記述が見込める)、4Gamer/ファミ通の発売後UO記事、DQ Tact/DQM の開発者記事、Soul Nomad の戦闘詳細。次はこれらを優先する。
