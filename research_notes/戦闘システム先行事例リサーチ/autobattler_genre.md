# オートバトラー/「編成+自動戦闘」ジャンルの戦闘システム先行事例

注記(調査の限界): この環境では WebFetch が外部ホスト(gigazine.net, medium.com など)に接続できず、全文取得ができなかった。以下はすべて WebSearch の検索結果要約(スニペット)に基づく。一次資料(開発者ポストモーテム、GDC講演、4Gamer/Famitsu本文)は確認できていない。数値(戦闘秒数など)で出典が取れたものだけを載せ、取れないものはGapsに回した。

## Q1. 各タイトルの仕組み・称賛点・批判点

### Takeaway
称賛は「戦闘前の準備(編成・配置・ビルド・作戦設定)に判断が集約され、戦闘は結果発表の演出」という構造に集まる。批判は「見ているだけ」「RNGで決まる」「雪だるま」「読みにくい」「UIが重い」に集中する。

### Cited Findings
- Unicorn Overlord: 戦闘は自動で進み、キャラクターごとに作戦を事前設定するイメージ。勝敗は兵種の相性(すくみ)が大きい。事前設定と相性の活用で「見ているだけではない奥深さ」がある — [電撃オンライン/ファミ通/4Gamer系検索結果(Denfaminicogamerインタビュー)](https://news.denfaminicogamer.jp/interview/230924c)
- Unicorn Overlord 称賛: 戦術画面は「レース前にハイエンドカーを調整する感覚」で、潜在的に退屈な仕組みを楽しくしている(Destructoid)。配置とガンビットの試行錯誤に何時間も使えるとの声 — [Destructoid](https://destructoid.com/?p=480028)、[Backloggd](https://www.backloggd.com/u/Maradum/review/1495697)
- Unicorn Overlord 批判: FFXIIのガンビットをほぼそのまま借用(ただし悪くはない)、簡単すぎて戦略を変える必要を感じない、複雑でジャンル初心者には多い、メニュー作業が長い — [TheXboxHub](https://www.thexboxhub.com/unicorn-overlord-review/)、[Nintendo World Report](https://www.nintendoworldreport.com/review/66513)、[board-game.co.uk](https://board-game.co.uk/?p=3242727)
- Mechabellum: ユニット配置とRTS的戦術を重視し、TFT/Underlordsよりヒーロー依存が薄い。戦闘前の編成・配置にマイクロ操作が移る。Steam「非常に好評」(約17,840件)。DBLTAP 9/10「最も戦術的なオートバトラー」 — [PC Gamer](https://www.pcgamer.com/games/strategy/strategic-robot-carnage-intensifies-as-autobattler-mechabellum-hits-its-1-0-release)、[Finalboss](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)、[DBLTAP](https://www.dbltap.com/reviews/mechabellum-review)
- Mechabellum 試合長: 1試合10〜20分でスキルと運のバランスが良いとの掲示板証言(個人の体験談) — [Team Liquid](https://tl.net/forum/games/613085-mechabellum)
- Super Auto Pets: 開発者の方針は「能力は短く単純に」「状態を単純に(中断して1時間後に戻っても成立)」「種族シナジーは制約が強すぎるので避ける」。作業の大半はラウンド冒頭の準備にあり、戦闘は自動 — [開発者投稿(Reddit)](https://redlib.belloworld.it/r/superautopets/comments/u9dxg6/developers_perspective_on_game_balance)、[Pocket Gamer](https://ee.pocketgamer.com/articles/084151/super-auto-pets-review-chill-auto-chess-game-with-deep-strategic-gameplay/)
- Backpack Battles: 戦闘は自動、選択はすべて戦闘前(購入と収納配置)。批判は「戦闘で何が起きているか追いにくい」「学習曲線が急でチュートリアルが薄い」。HP/スタミナの減少が戦闘の主な伝達手段 — [Vaporlens レビュー要約](https://vaporlens.app/app/2427700/backpack_battles)、[itch.io コメント](https://itch.io/post/13019732)、[Green Man Gaming](https://www.greenmangaming.com/blog/backpack-battles-turns-inventory-management-into-a-moreish-pvp-game/)
- TFT: 戦闘は約15〜25秒(Mortdog、2025年Paris Openインタビュー)。批判はRNG過多、脱落が1人ずつでゲームが長い。Riotはアイテムのバッドラック保護を導入 — [PCGamesN](https://www.pcgamesn.com/teamfight-tactics/set-16-paris-open-interview)、[ScreenRant](https://screenrant.com/teamfight-tactics-bad-luck-protection-items-rng/)、[Mobalytics](https://mobalytics.gg/blog/tft/3-tft-mechanics-that-need-updating/)
- Hearthstone Battlegrounds: 批判は雪だるま(下位は逆転不能)・運による差・トリンケットRNG。反論として「RNGは他のオートチェスと同程度で習熟すべき技術」 — [Blizzardフォーラム](https://us.forums.blizzard.com/en/hearthstone/t/bg-snowballing-is-worse-than-ever/136610)、[Mein-MMO](https://mein-mmo.de/en/hearthstone-neuer-modus-richtig-laune,440696)
- Storybook Brawl: キャラとヒーローの組み合わせ知識への依存が強く、散漫で雑多。キーカードが来なくて負ける — [PC Gamer](https://www.pcgamer.com/storybook-brawls-tries-to-iterate-on-what-hearthstone-battlegrounds-started)
- The Bazaar: ローンチ時は課金で批判を浴び、その後修正されて評価回復。RNGによるラン毎の多様性を称賛(Mobalytics) — [PC Gamer](https://www.pcgamer.com/games/card-games/after-its-disastrous-launch-last-year-im-here-to-tell-you-that-2025s-most-promising-auto-battler-finally-lives-up-to-its-potential)、[Mobalytics](https://mobalytics.gg/gamebase/guides/the-bazaar-review)
- Despot's Game(PvE ローグライト型オートバトラー): 配置とドラフトが中心。ローグライトとの融合を新鮮と称賛する一方、ランダム性が最大の批判(マップがなく純粋に運に左右される run)。リプレイ性の低さも指摘 — [Superjump](https://www.superjumpmagazine.com/despots-game-review/)、[GertLush](https://gertlushgaming.co.uk/despots-game-review-nintendo-switch-oled/)、[OpenCritic](https://opencritic.com/game/13662/view)、[Vaporlens](https://vaporlens.app/app/1227280)
- Loop Hero: 戦闘は完全に自動で、影響できるのは装備・カード(配置)のみ。称賛=制限された選択に「深さの小さな溜まり」(PC Gamer)、「準備で決まる」(RPGFan/GameSpot)。批判=「祈るだけ」「数字を眺めるだけで遅く退屈」、ボス戦で自動の弱点が出る(Attack of the Fanboy) — [PC Gamer](https://pcgamer.com/loop-hero-review)、[RPGFan](https://rpgfan.com/review/loop-hero)、[Niche Gamer](https://nichegamer.com/reviews/loop-hero-review)、[Attack of the Fanboy](https://attackofthefanboy.com/reviews/loop-hero-review/)、[Twinfinite](https://twinfinite.net/reviews/loop-hero-review-no-control/)
- Ogre Battle(1993系): 戦闘はほぼ完全自動。ユニット(最大5体、大型は2枠)の戦術(Best/Strong/Weak/Leader等のターゲット方針)と編成が影響し、敏捷順に攻撃、与ダメージの大きい側が勝ち、負けた側が撤退。戦闘を一時停止してタロットカードを使える(限定介入)。OB64は向き(側面)の概念を追加 — [HG101](https://www.hardcoregaming101.net/ogre-battle/)、[RPGFan](https://www.rpgfan.com/review/ogre-battle-the-march-of-the-black-queen-2/)、[HG101 OB64](https://www.hardcoregaming101.net/ogre-battle-64-person-of-lordly-caliber/)
- Symphony of War: 分隊カスタマイズが称賛。批判はUIが煩雑でチュートリアルが長いこと、難易度の急上昇。ただし自動戦闘そのものへの言及は検索では確認できず — [TechRaptor](https://Techraptor.net/gaming/reviews/symphony-of-war-nephilim-saga-review)、[Softpedia](https://www.softpedia.com/reviews/games/pc/symphony-of-war-the-nephilim-saga-review-535557.shtml)
- Gladiabots(AIプログラミング): ノード式のビジュアルAIエディタで試作・検証が速いと称賛、深さと入りやすさのバランス。批判=モバイル的な浅さ、プログラミング未経験者には難しい、退屈になりうる — [Game Revolution](https://www.gamerevolution.com/?p=33860)、[Pocket Gamer](https://www.pocketgamer.com/gladiabots/gladiabots-combines-tactical-bot-combat-and-programming-puzzles)
- Carnage Heart: 命令しないと動かないミニオンをプログラムする。ある旧レビューは「戦術面が弱すぎて楽しくない」と評価(一件のみ、単独の意見) — [Gamerevolution系検索結果](https://www.gamerevolution.com/?p=33860)(注: 同ページがCarnage Heartの旧レビューかは未確認。出典の同定は不確実)
- Princess Connect Re:Dive: UB(必殺技)を手動操作できない場面があり、SPバトルではUBタイミング調整・敵UB吸収が攻略の鍵と攻略記事は説明 — [GameRanbu](https://gameranbu.jp/priconne/655148df84778d707465)、[AppMatch](https://games.appmatch.jp/?p=170342)

### Inferences
- 称賛される作品は「ひとつの画面で、少数の意味が明確な選択(配置・作戦・ビルド)」に判断を集約している。ハウス・グランプリの「4体配置+作戦選択」は、Unicorn Overlordのガンビット簡易版、Ogre Battleの戦術選択(Best/Strong/Weak)に近い。
- Super Auto Petsの「能力は1〜2文で書ける」規律は、ステッカーキャラの能力設計(モバイル・中断復帰前提)に直接移植できる。
- Loop Hero評の「準備だけで決まるとボスで自動が弱点になる」は、ボス戦に限定介入(Ogre Battleのタロットのような一時停止介入)を入れる根拠になる。
- Unicorn Overlordの批判(メニューが重い、簡単すぎ)は、低入力負荷とのトレードオフ。プリセット作戦+微調整が安全。

### Gaps
- 開発者一次資料(Riot/Mortdog のdev blog本文、Super Auto Pets・Backpack Battles開発者のポストモーテム、GDC講演、Vanillaware/4Gamer/Famitsuのガンビット設計意図)は取得できず未確認。
- Soul Nomad、Dragon Quest Tact、DQM自動戦闘、Football Manager系、AFK Arena、Dota Auto Chess/Underlords の個別情報は検索していない。
- Carnage Heartの評価は一件のみで、出典の特定も不確実。
- Symphony of Warの自動戦闘に関する評価は確認できなかった(同作は主に手動ターン制の分隊戦闘であり、本ジャンルへの適合自体が要確認)。

## Q2. 面白い判断はどこにあるか/少数の入力を決定的に感じさせる設計

### Takeaway
称賛されるジャンル作品の判断は、戦闘前の準備(編成・配置・アイテム収納・作戦条件)に置かれる。戦闘中は介入を最小限に絞る(Ogre Battleの一時停止カード、PCRのUBタイミング)。

### Cited Findings
- Backpack Battlesは戦闘がすべて自動で、判断は購入と収納配置の準備フェーズに完全集約 — [PC Games](https://www.pcgames.de/Indie-Games-Thema-239276/Specials/Backpack-Battles-Builds-Early-Access-Inventar-getestet-Auto-Battler-1442869/2/)、[Mein-MMO](https://mein-mmo.de/en/in-a-new-game-on-steam-proper-preparation-is-more-important-than-the-battle-and-it-wont-let-go-of-me-anymore,1087848)
- 開発者側の意見として「ドラフトが本当のゲームで、戦闘観戦は付け足し」との主張(itch.io の個別開発者コメント) — [itch.io](https://itch.io/post/13019732)
- Mechabellumは戦闘前の編成・配置にマイクロ操作を寄せ、戦闘中も装備や配置を調整できると謳う — [Finalboss](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and)、[Steam](https://store.steampowered.com/app/669330/Mechabellum/)
- Unicorn Overlordは兵種のすくみ(相性)を基盤に、事前設定の作戦で戦況に対応する — [Denfaminicogamer](https://news.denfaminicogamer.jp/interview/230924c)
- Loop Heroでは「何と遭遇するかを配置する」ことが判断で、戦闘中は無介入 — [GameSpot](https://gamespot.com/reviews/loop-hero-review/1900-6417656/)
- PCRではSPバトルなどでUBタイミングが攻略の鍵 — [AppMatch](https://games.appmatch.jp/?p=170342)

### Inferences
- 「少数の入力が決定的」に感じる条件は、(1) 入力の結果が戦闘で目に見える、(2) 相性やすくみで正解がある、(3) 失敗が原因と結びつく、の3つ。見えない・正解がないと「見ているだけ」になる。(Loop Heroのボス批判はこの例)
- 出典なしの設計提案: 1戦ごとに「作戦」を1つ選ぶ+必殺ボタン1回の限定介入が、低入力負荷と主体性の落としどころ。

### Gaps
- 「1つの必殺ボタン」が決定的に感じられるかを検証した定量資料は見つからなかった。PCRのUB手動操作の面白さを評価した記事も未確認。

## Q3. 戦闘の長さ・スキップ・結果の可読性

### Takeaway
確認できた数値は TFT の約15〜25秒のみ(Mechabellumの10〜20分は1試合全体)。結果の可読性(ダメージ集計・ログ・リプレイ)に関する一次資料は得られなかった。

### Cited Findings
- TFTの戦闘は約15〜25秒で「ちょうどよい位置」とMortdog — [PCGamesN](https://www.pcgamesn.com/teamfight-tactics/set-16-paris-open-interview)
- Mechabellumは1試合10〜20分(戦闘単体ではない) — [Team Liquid](https://tl.net/forum/games/613085-mechabellum)
- Backpack Battlesはプレイヤーが「何が起きているか追えない」と述べた例があり、HP/スタミナ減少が主な伝達手段 — [itch.io](https://itch.io/post/13019732)、[Vaporlens](https://vaporlens.app/app/2427700/backpack_battles)
- Super Auto Petsは中断・復帰を前提に状態を単純化 — [開発者投稿](https://redlib.belloworld.it/r/superautopets/comments/u9dxg6/developers_perspective_on_game_balance)
- Loop Heroは時間を尊重しない(TechRadar) — [TechRadar](https://www.techradar.com/news/i-love-loop-hero-but-it-doesnt-respect-my-time-at-all)(論点は戦闘速度ではなくラン全体の長さの可能性。見出ししか確認できていない)

### Inferences
- TFTの15〜25秒は、ハウス・グランプリの目標90秒(通常戦)よりかなり短い。90秒を保つには、フェーズ分割(開幕・中盤・決着)や能力発動の演出で「見せ場」を複数用意する必要がありそう(推論)。
- 追えない戦闘への対策は、ダメージ数字・主要イベントのハイライト、終了後の1画面要約が有力(推論。出典はない)。

### Gaps
- 各ゲームの早送り/スキップ、戦闘ログ、ダメージ集計、リプレイの実装情報(Underlords、AFK Arena、PCR等)は検索していない。
- Super Auto Petsの戦闘秒数、Hearthstone Battlegroundsのターン時間・戦闘時間は未確認。

## Q4. よくある不満(見ているだけ、RNG、視覚的混乱、固定メタ、雪だるま、長短、配置無意味、ボスがステータスチェック)

### Takeaway
最も裏付けが取れた不満は、RNG/運の大きさ、雪だるま(BG)、エージェンシー不足(Loop Hero、CK3の自動戦闘スレ)、UI/チュートリアルの重さ。ボスのステータスチェック化はLoop Heroで示唆された。

### Cited Findings
- 「自動戦闘は意味ある選択を奪う」とする議論 — [Crusader Kings III Steamスレ](https://steamcommunity.com/app/1158310/discussions/0/4208120159991418387)、[Medium: Auto-Battling your Way to Victory is not a Good Design](https://medium.com/ggdigest/auto-battling-your-way-to-victory-is-not-a-good-design-109937a1f236)(タイトルと要約のみ確認)
- 自動戦闘に対する反論: デッキ構築は戦闘より技術を要することが多い — [同上検索結果](https://medium.com/ggdigest/auto-battling-your-way-to-victory-is-not-a-good-design-109937a1f236)
- 可読性の不満(ステータスの読みにくさ、導入の不足)が小規模作品のフィードバックに頻出 — [itch.io](https://itch.io/post/13314808)、[Order Automatica devlog](https://newbeings.itch.io/order-automatica/devlog/415200/launch-version-feedback-and-plans)
- TFT: RNGが多すぎるという批判、Riotはバッドラック保護で対応 — [ScreenRant](https://screenrant.com/teamfight-tactics-bad-luck-protection-items-rng/)
- BG: 雪だるまの悪化、下位の逆転不能 — [Blizzardフォーラム](https://us.forums.blizzard.com/en/hearthstone/t/bg-snowballing-is-worse-than-ever/136610)
- Loop Hero: ボス戦で自動の弱点が出る(Attack of the Fanboy)、攻撃速度などのステータスが構成によって無意味になる(Niche Gamer) — [Attack of the Fanboy](https://attackofthefanboy.com/reviews/loop-hero-review/)、[Niche Gamer](https://nichegamer.com/reviews/loop-hero-review)
- Despot's Game: マップなしで純粋な運になるとの批判 — [GertLush](https://gertlushgaming.co.uk/despots-game-review-nintendo-switch-oled/)

### Inferences
- 「固定メタ」「配置が無意味」を裏付ける一次資料は集まらなかった。Mechabellumの配置重視の称賛は、配置が効く設計が評価される傍証にとどまる。
- 単人用では雪だるま・PvP不均衡は問題になりにくいが、ランダム報酬による「運ゲー」批判(Despot's Game)は残る。

### Gaps
- 視覚的混乱(ユニット数が多い画面)の具体的な批判記事は見つからなかった。
- 固定メタ・支配的ビルド(TFT等)の一次資料は未取得。

## Q5. 単人用PvEオートバトラーのボス設計(フェーズ・ドラマ)

### Takeaway
今回の調査ではボス設計を直接論じた一次資料は得られなかった。わかったのは、Loop Heroのボスが自動戦闘の弱点を露呈した点、Ogre Battleに戦闘中の限定介入(一時停止+カード)がある点のみ。

### Cited Findings
- Loop Hero: ボス戦は自動システムがプレイヤーに不利に働く場面 — [Attack of the Fanboy](https://attackofthefanboy.com/reviews/loop-hero-review/)
- Ogre Battle: 戦闘を一時停止してタロットカードを使える — [HG101](https://www.hardcoregaming101.net/ogre-battle/)
- Unicorn Overlord: ユニットに移動先を指示、戦況に応じ回復・防御、近接味方との入れ替えが可能 — [Denfaminicogamer](https://news.denfaminicogamer.jp/interview/230924c)

### Inferences(出典なしの設計仮説。検証が必要)
- 7分のボス戦は、HP閾値でのフェーズ移行(ギミック変化)+各フェーズ前の再作戦選択の窓(Ogre Battleの一時停止カード方式)で、入力は少なくドラマを作れる可能性がある。
- 「ボスの予告行動→対応する作戦/UBで受ける」形にすれば、ステータスチェックではなく読み合いになる。

### Gaps
- 単人用PvEオートバトラー(Despot's Game、Loop Hero等)のボス設計の分析記事は見つからなかった。ボスのフェーズ構成の具体例は未収集。
- DQM/DQ Tactの自動戦闘、AFK Arena等のボス設計は未調査。
