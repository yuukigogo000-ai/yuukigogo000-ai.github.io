# モバイル短時間・低入力バトルシステムの先行事例リサーチ

調査上の注意(重要): 実行環境でWebFetchが多くのホスト(mobilegamer.biz / gamedeveloper.com / naavik.co / pocketgamer.com / deconstructoroffun.com)を名前解決できず遮断されており、一次記事の本文は読めていない。以下はWebSearchの要約スニペットに基づく。スニペット由来の主張は「要原典確認」。各ホストをネットワーク許可すれば本文確認を再実行できる。検索で裏付けが取れなかった事項は各節のGapsに明記した(推測で埋めていない)。

## 1. 「少ない入力に大きな意味を持たせる」設計(Marvel Snap / Archero・Survivor.io / Despot's Game / Terra Battle / Octopath CotC)

### Takeaway
成功例は「1回の入力の意味を重く」している。Marvel Snapは同時進行ターン+6ターン固定+スナップ/撤退の2択、Archeroは「止まると撃つ」という移動1本、Despot's Gameは開始時の配置のみ。また、入力を増やす(QTE)案は、周回でオートに頼られるモバイルでは却下された例がある(HSR)。

### Cited Findings
- Marvel Snapは6ターン上限・12枚デッキ・単一カード種で設計され、試合時間の報告値は約3分〜5分と資料により幅がある — [Behind the Design / 検索要約(mobilegamer.biz等)](https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/)(要原典確認)
- 両プレイヤーが同時に行動する同時ターン制が、試合を短く保つ要因とされる — [Game Developer](https://www.gamedeveloper.com/game-platforms/designers-don-t-sleep-on-marvel-snap-s-simultaneous-turns)(要原典確認)
- 撤退すると敗北画面ではなく「Escaped!」と表示され、Brodeは負けの否定感を弱める文言だと述べた。着想元はCard Monsters: 3 Minute Duelsで、負けを戦略的選択として感じさせる狙い — [mobilegamer.biz](https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/)(要原典確認)
- スナップは賭け金を2倍にし相手の撤退を誘える。「いつスナップし、いつ撤退するか」を判断すればほぼどのデッキでも高ランクに行けるという趣旨のレビューがある — [Punished Backlog](https://punishedbacklog.com/marvel-snap-review/)(個別レビューの意見)
- Archeroは「止まっている時だけ自動で狙って撃つ」。移動すると攻撃が止まるため、1本指でもマイクロ判断が常に発生するという分析 — [Naavik](https://naavik.co/deep-dives/survivorio-archeros-footsteps/)(スニペット要約)、[Ease Game](https://easegame.com/blog/from-easy-dodging-to-no-escape-archero-difficulty-guide)
- Survivor.ioは常時オート攻撃+ワンスティックで、単一スティックの操作感を磨き込んだことが評価される。ArcheroとSurvivor.ioはともに1本指・オートエイム・急速な能力成長・ミッドコア要素 — [Naavik](https://naavik.co/deep-dives/survivorio-archeros-footsteps/)、[Global Games Forum](https://www.globalgamesforum.com/news/how-survivor.io-continues-to-pull-in-5-million-a-month-three-years-later)
- 継続率の論点: 低入力ゲームの定着理由はローグライク構造・成長システム・大量の敵であり、操作の簡単さだけではないという主張。Survivor.ioの継続率はArcheroの現在値(40%台中盤)に近いという比較 — [Naavik](https://naavik.co/deep-dives/survivorio-archeros-footsteps/)(スニペット)
- Despot's Gameは戦闘中にプレイヤーが触れられるのは開始時の配置のみ。「機構が単純なのでモバイルが最適」というレビューがある一方、深さ・多様性・リプレイ性の不足、エンゲージメント不足という批判もある — [Super Jump](https://www.superjumpmagazine.com/despots-game-review/)、[Vaporlens(Steamレビュー要約)](https://vaporlens.app/app/1227280)
- テラバトル: 敵を味方2体で挟むと攻撃が発動する(パズドラ風)ドラッグ式。長所は短期戦術に合う点。短所は制限時間で、動かし始めると時計が減り、誤ると手番を丸ごと失い、強いフラストレーションの原因になる — [Pocket Gamer](https://www.pocketgamer.com/terra-battle/review/)、[Pocket Gamer hands-on](https://www.pocketgamer.com/terra-battle/hands-on-with-terra-battle-is-mistwalkers-free-to-play-tactical-rpg-worthy-of-it/)
- Octopath CotC(モバイル)はブースト/ブレイクで「オートが考えなしに勝てる他のモバイルRPGと違い意味のある判断が要る」と評価される一方、オートが無く、戦闘前広告や課金が不満 — [RPGFan](https://www.rpgfan.com/review/octopath-traveler-champions-of-the-continent/)、[GamerBraves](https://gamerbraves.com/?p=123925)、[TapTap](https://www.taptap.io:443/post/1649672)
- Slay the Spireモバイル: カード選択時のスクロールが誤選択になる、UIが小さいという入力面の不満(個別事例) — [Android Central](https://www.androidcentral.com/slay-spire-android-game-week)、[But Why Tho](https://butwhytho.net/2020/06/13/comparison-picking-up-slay-the-spire-on-ios)

### Inferences
- 「1入力=1つの不可逆な賭け」(スナップ/撤退、止まる/動く、配置)が価値を生む。連打ではなく「いつやるか/やるか否か」の1ビット判断が低入力で最大の意味を持つ。
- 「負けを選択に変える文言」は演出コストゼロで試せる。
- 時間制限付きの精密ドラッグ(テラバトル)は、片手・隙間時間では苛立ちの源になりうる。制限時間を課すなら寛容にする。
- タップ対象カードの誤選択(StS)から、片手ポートレートでは決定を「選択→確定」の2段にするかスクロールと選択を分離すべき。

### Gaps
- Marvel Snapの試合時間・入力回数の公式値(GDC/Brode講演)は未確認。報告値は3〜5分で資料間不一致。
- Archero/Survivor.ioの1ステージ時間・ボス戦時間の数値が取れていない。
- Despot's Gameの具体的な戦闘時間は不明。

## 2. ターン制+オート+必殺技タイミング(FGO / プリコネR / グラブル / HSR / ウマ娘 / DQウォーク)

### Takeaway
手動の意味が薄いと「オートで終わる周回作業」になる。長い演出に対するスキップ要望は繰り返し出る。HSRは「ブレイクQTE」を、周回でのオート依存を理由に不採用にした。プリコネは「オート前提+UBの手動タイミング」の2層構造と説明される。

### Cited Findings
- FGO: 初期は演出を飽きさせないほど魅力的にする方針でスキップを提供せず、ユーザー側から宝具演出スキップ要望が出た。2022年10月アップデートでスキル演出中の画面タッチによる短縮などが追加された — [AppMedia(宝具演出スキップ要望)](https://appmedia.jp/?p=413575)、[FGO公式お知らせ 2022/10/25](https://webview.fate-go.us/2022/1025_gameupdate_notice/)、ファンブログの方針推測(URL不明確のため弱い根拠)
- FGOはチュートリアルが戦闘の仕組みをほとんど教えないという批判 — [Raider King](https://raiderking.com/why-is-fate-grand-orders-tutorial-so-bad/)
- プリコネR: 通常攻撃とスキルは自動、プレイヤーはユニオンバーストの発動を手動で操作し、オートで周回・育成を効率化できる(攻略サイトの説明で、開発者インタビューではない) — [Gamepedia](https://gamepedia.jp/archives/72649)、[AppMedia](https://appmedia.jp/?p=3741505)
- HSR: リードデザイナーは、弱点ブレイクのQTEは実際に戦闘を遅くし、周回でオート依存が高いモバイルでは戦闘がぎこちなくなるため不採用にしたと述べた — [Pocket Tactics](https://www.pockettactics.com/honkai-star-rail/quick-time-events)
- HSRのオートは必ずしも勝てず、キャラの使い方を誤る(バフを無関係な味方に付ける等)。Reddit(2023)にはオート前提のターン制はゲームを台無しにするという意見がある — [Pocket Tactics auto-battle](https://www.pockettactics.com/honkai-star-rail/auto-battle)、[EarlyGame](https://earlygame.com/gaming/honkai-star-rail-why-you-should-never-use-auto-battle)、[Reddit r/Genshin_Impact](https://lr.sudovanilla.org/r/Genshin_Impact/comments/140r6cb/star_rail/jmy6u2j/?context=3)
- ターン制の遅さがアクション志向層に合わないという論調 — [Alibaba insights(意見記事・質低め)](https://www.alibaba.com/product-insights/genshin-impact-vs-honkai-star-rail-is-the-turn-based-combat-too-slow-for-action-fans.html)
- グラブル: ターン制コマンド式で召喚/アビリティはターンを消費しない別枠。オート・スキップ対応で手間が少ないという声がある一方、ボスの特殊行動にはフルオートでは対応しづらい — [Altema](https://altema.jp/app/220)、[App-liv レビュー](https://app-liv.jp/4742946/reviews/?cur_page=2)、[Gameranbu](https://gameranbu.jp/granblue/1e49a19a1d81edf4aec4)
- ウマ娘: レースは完全自動で操作不可。観戦かスキップを選べる。プレイヤーの関与は事前の育成・脚質(作戦)選択で、オート選択は不適切になりがちという注意がある — [GameTora](https://gametora.com/umamusume/race-mechanics)、[Game8](https://game8.co/games/Umamusume-Pretty-Derby/archives/563652)、[Goonhammer](https://www.goonhammer.com/preparing-for-pvp-and-the-taurus-cup-in-umamusume-pretty-derby)。育成は毎ターン5択(トレーニング/お出かけ/お休み/保健室/レース) — [Game Watch](https://game.watch.impress.co.jp/docs/kikaku/1366170.html)
- DQウォーク(2019頃のレビュー・要望): ウォークモード(AI)でも選択式イベントで手動が要る、AIが補助スキル前提の敵に対応できず理不尽、倍速設定・技演出オンオフ・弱点可視化の要望 — [App Storeレビュー](https://apps.apple.com/jp/app/%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%82%A6%E3%82%A9%E3%83%BC%E3%82%AF-%E3%83%89%E3%83%A9%E3%82%AF%E3%82%A8%E3%81%AE%E4%BD%8D%E7%BD%AE%E6%83%85%E5%A0%B1%E3%82%B2%E3%83%BC%E3%83%A0/id1439417234)、[9db.jp 改善要望まとめ](https://9db.jp/dqwalk/data/798)
- 一般論: オートで勝てる設計は戦略の意味を薄め、戦闘そのものより戦闘外の選択のほうが面白くなる — [Medium/GG Digest](https://medium.com/ggdigest/auto-battling-your-way-to-victory-is-not-a-good-design-109937a1f236)

### Inferences
- 「演出を短縮不能にして魅力で押す」(FGO初期)は、周回が増えるほど要望に負ける。演出は最初から短縮/スキップ可能にし、初見時のみフル尺にする設計が安全。
- 手動介入を追加(QTE)すると速度/オートと衝突する(HSR)。介入は「戦闘前」か「1回の決定タイミング」に集約するのが整合的。
- オートが意思決定を誤る(HSR/DQウォーク)ことが不満になるため、オート時の振る舞いを予測可能(単純なルール)にし、プレイヤーが事前に「方針」を設定する形(ウマ娘の作戦)が納得されやすい。

### Gaps
- FGOのコマンドカード+NP(1ターン3枚選択)の具体的な戦闘時間・手数に関する裏付けは取れなかった。
- プリコネRの開発者側設計意図(CEDEC等)は見つからなかった。
- ウマ娘のレース長・CEDEC講演は未発見。
- グラブルの周回不満の直接資料は未発見(SNS/掲示板の個別調査が必要)。

## 3. パズル/フリック/リアルタイム(パズドラ / モンスト / クラロワ / ポケモンGOレイド)

### Takeaway
パズドラ・モンストは「1操作が1ターンを決める」直感的アクション。スタミナ制が1セッション長を決める。クラロワは3分固定。ポケモンGOレイドは「連打で終わる」批判が代表的。

### Cited Findings
- パズドラ: スタミナはダンジョン突入ごとに消費され、難度が上がると消費も増えるため上級者のセッションが短くなる。スタミナ上限が育つと回復時間が長くなり課金設計になるという分析(Katkoff) — [Game Developer(Sponsored)/How Puzzle & Dragons does it](https://gamedeveloper.com/business/how-puzzle-dragons-does-it)、[Gamerefinery](https://gamerefinery.com/10-years-of-puzzle-dragons-evolution-of-a-mature-game)
- パズドラの批判: モンスター入手が賭け(ガチャ)、育成素材が限定ダンジョンにあり、スタミナ回復課金に誘導、中盤以降に重い — [Flash Art](https://flash---art.com/2018/04/puzzle-and-dragons/)、[WNHub](https://wnhub.io/news/analytics/item-6547)
- モンスト: ストライクショット(SS)は一定ターン後に発動し、ズーム・ボイス・追加効果が入る。爽快感が魅力として挙げられる。設計意図の一次資料は未発見 — [JoJo Wiki](https://jojowiki.com/Monster_Strike)、[ファミ通 2024](https://www.famitsu.com/article/202408/14351)
- クラロワ: 1試合は最大3分(全タワー破壊で早期終了)、同点は1分延長。エリクサーは2.8秒に1つ、終盤は加速 — [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale)、[Deconstructor of Fun](https://www.deconstructoroffun.com/blog//2016/02/clash-royale-next-billion-dollar-game.html)(後者は内容未確認)。矛盾: dotesports記事の「6分→5分」は他資料と食い違うため信頼しない
- ポケモンGOレイド: 大人数でも画面連打に帰結するという批判、リモートレイド制限(1日5回)への反発、参加者不足、Max Battleの10〜30人推奨への批判 — [Sportskeeda](https://sportskeeda.com/pokemon/tedious-unfriendly-game-design-pokemon-go-players-believe-game-becoming-exclusionary-time)、[Mein-MMO](https://mein-mmo.de/en/trainers-in-pokemon-go-are-angry-about-raid-changes-now-niantic-responds-in-the-interview,989480)

### Inferences
- 本作は対人ではないため、クラロワ式の「3分固定+延長」ではなく「撤退/降参で早期終了」を併設する余地がある(Marvel Snapの撤退と同じ発想)。
- 連打が答えになる設計(ポケモンGO)は「タップの意味がない」の典型。タップを残すなら選択に意味を持たせる。

### Gaps
- パズドラの1戦闘/1ダンジョン時間、モンストの1クエスト時間(例:1周約何分)の裏付けは未取得。
- ポケモンGOレイドの戦闘時間(分)の裏付けなし。
- Supercell/Mixi/GungHo側のGDC/CEDEC一次講演は未発見。

## 4. 倍速・スキップ・オート・掃討と周回疲れ(Epic Seven / Summoners War / AFK Arena / Arknights 他)

### Takeaway
オート/スキップは周回を許容可能にするが、「スタミナ=入力回数」の消費機構に直結すると、戦闘の意味が戦闘外(編成・育成)に移る。苦情の中心は戦闘自体より時間・資源の枯渇設計と周回の作業感。

### Cited Findings
- Summoners War: オートは戦略判断を伴わない周回で使われ、スタミナ消費の副産物という論 — [Twinfinite](https://twinfinite.net/2022/11/summoners-war-chronicles-may-favor-the-whales-dolphins-but-its-still-worth-checking-out/)、[Mobile Free to Play](https://mobilefreetoplay.com/?p=299)
- Epic Seven: ゴールド・スタミナ・時間が意図的に希少、リピート機能なしでAFK向きではない、スキナーボックス的という批判 — [MMOGames](https://www.mmogames.com/articles/archives/play-animation-epic-seven-review)、[GamePress](https://gamepress.gg/node/36861)
- AFK Arena: 5v5自動戦闘で入力が少なく、放置収益で復帰を促す。アイドルRPGは初日継続率が高いが中後期は作業的になり離脱しやすい(一般論) — [Game Developer(Sponsored)/Flexible time session design in AFK Arena](https://gamedeveloper.com/design/flexible-time-session-design-in-afk-arena)、[Udonis](https://blog.udonis.co/mobile-marketing/mobile-games/afk-arena-analysis)、[Chen Yang Huang case study](https://chenyanghuang.portfolio.site/case-study)。広告の過激さへの批判 — [Vaporlens](https://vaporlens.app/app/2426960/summoners_war)(要確認:Summoners Warの要約ページの可能性があり、AFK Arenaの根拠として弱い)
- Arknights: 初回クリア後にオート/即時戦闘が解禁され周回が軽いという説があるが、根拠は一般的なガチャ論でArknights固有か未確認 — [Critical Video Game Studies](https://criticalvideogamestudies.com/gacha-games-not-judging-a-book-by-its-cover/)(弱い根拠)
- DQウォークの倍速/演出オフ要望(上記2節)

### Inferences
- 周回を許容するにはオート/倍速/スキップは必須だが、「スキップ可能」と「戦闘に意味がある」は両立させる必要がある。例: 初回クリア時または未勝利時のみ手動で意思決定があり、2回目以降は前回の配置を再利用して一括解決する。
- 90秒の通常戦は、3倍速で30秒前後に落ちる設計を前提に「見てなくても終わるが、見ると面白い」にすれば苦情を避けられる(推論)。

### Gaps
- 掃討チケットの具体的な知見(プリコネ・ブルアカ等)は未調査。
- 各ゲームの通常/ボス戦の具体的な時間(Arknights、HSR、グラブル)は資料が見つからず、未確認。
- 「画面が小さく見えにくい」「ボタンが多い」といったストアレビューの直接引用は未取得。

## 5. ボス戦をイベントに見せる手法と戦闘時間の目安

### Takeaway
今回の調査では、ボス戦を「イベント」化する手法を直接説明した一次資料は得られなかった。手がかりは、演出(モンストSSのズーム・ボイス)、多人数参加(ポケモンGO)、固有の解決条件(グラブルのボスギミック)に限られる。

### Cited Findings
- モンストSSはズーム・ボイス・追加効果で見せ場を作る — [JoJo Wiki](https://jojowiki.com/Monster_Strike)
- グラブルのボスは特殊行動があり、フルオートでは解除不能なバフ(防御UP)等があるため手動対応を促す — [Gameranbu](https://gameranbu.jp/granblue/1e49a19a1d81edf4aec4)
- ポケモンGOのグループレイドは人を集める社会的イベント性を持つが、参加者確保とリモート制限が不満の的 — [Mein-MMO](https://mein-mmo.de/en/pokemon-go-trainers-want-better-remote-raids-these-are-the-issues,501090)
- Marvel Snapは約3〜5分(資料差)、クラロワは最大3分(+1分延長)が対人の短時間基準 — 前掲

### Inferences
- 7分ボスは3フェーズ前後に分け、フェーズ切替で1回の決定(配置変更/戦術再選択)を挟む構成が、入力を増やさずに「イベント感」を出す候補(推論、出典なし)。
- 通常戦90秒のうち「判断」は開始前に集約し、戦闘中の入力を0〜1回に絞るのが、事例の共通項(推論)。

### Gaps
- 通常戦/ボス戦の長さの出典付き比較表は作れなかった(パズドラ・モンスト・FGO・HSR・Arknights・グラブル・Brave Frontier・Chain Chronicle・Dragon Collection・怪盗ロワイヤル・Dicey系・ハイパーカジュアルは裏付け資料を得られず)。
- 初期モバイル期(2008–2014)の資料はパズドラ(2013)とテラバトル(2014)以外ほぼ未取得。
- 4Gamer/ファミ通/GameBusinessの開発者インタビュー本文は、取得制限のため未確認。

## 参考: 本作への最小限の示唆(推論・出典なし)
- 単発で重い入力: 戦闘前の配置+戦術1つ、戦闘中は「必殺1回のタイミング」または「撤退」のみ、が事例と整合。
- 避けるべき: 周回前提での戦闘中QTE(HSR)、時間制限付き精密操作(テラバトル)、カード誤タップ(StS)、連打が最適解になる設計(ポケモンGO)、オートが愚かな振る舞いをする設計(HSR/DQウォーク)。
