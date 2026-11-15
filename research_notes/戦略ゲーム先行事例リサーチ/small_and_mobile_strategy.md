# 小規模・短時間・モバイル戦略ゲームと少人数開発戦略ゲームの「ジャンル圧縮」先行事例

調査方法の注記: WebFetch は不可のため curl で取得。全文を読めたものは【本文確認】、検索スニペット(要約)のみは【要約のみ】。Steam/Reddit/BGG/TouchArcade/PocketGamer/開発者ブログ/itch.io 等はブロックのため全て【要約のみ】。Wikipedia は本文確認だが二次情報。調査は15回程度の呼び出しで打ち切ったため、Slay・Hexonia・Plague Inc・Mini Metro・Reigns・微型4Xボドゲ・日本の小型国盗りアプリは薄い(Gapsに明記)。

## Q1. The Battle of Polytopia の構造・開発者発言・賛否

### Takeaway
Polytopia は「通貨=星1種類・全部族共通の小さい技術ツリー・都市は村の占領で増える・30ターンのスコア戦(Perfection)」で4Xを携帯向けに圧縮した。入門しやすさは評価されたが、全部族が同じ技術ツリーで後半が単調、後半はマップが読みにくい、という批評が一貫している。

### Cited Findings
- 構造: プレイヤーは部族を選び、帝国を築く。各部族は固有能力を1つ持って開始するが、全員が同じ技術ツリーにアクセスできる。【本文確認】 — [Wikipedia: The Battle of Polytopia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia)
- 手番の中身: 手番にできることは「全ユニットを動かす」と「星(stars)という資源を使う」。都市が星を生み、星は技術解放・ユニット生産・資源採取(都市アップグレード用)に使う。都市のアップグレードは2択(例: 毎ターンの星増加か、探索する使者)。新都市は地図上の定位置の「村」を占領して得る。【本文確認】 — 同上
- 2モード: Perfection は30ターン制限でハイスコアを競う(探索や資源採取などで得点、トレード路を繋ぐ等の課題で強力な建物と得点)。Domination は全部族を倒すのが勝利条件で、少ないターン数で勝つほど高評価。【本文確認】 — 同上
- 初期リリースは部族5つと30ターンモードだったとされる(その後、部族追加・外交拡張等)。【本文確認】 — 同上
- 作者発言(Wikipedia経由): Felix af Ekenstam は2012年にコンセプト画を描き始め、空き時間に開発。モバイルゲームに共通する単純さを持ち、課金重視でない戦略ゲームを意図。CEO Lövstedt は、試した新案の「90%を捨てる」と述べた。【本文確認】 — 同上
- 作者発言(検索スニペット): PC型4Xをそのまま移植すると「何ページものチュートリアル」が要るので、ジャンルをプラットフォームに合わせて作り直した。「モバイル由来の難しさが特にあったか分からない」とも。「単純さ・アクセスの良さは取り入れ、攻撃的課金は入れない」。インタビュー原文(Cubed3, Mobidictum, Pocket Tactics, PC Invasion)は未取得。【要約のみ】 — [Cubed3](https://www.cubed3.com/features/interviews/interview-with-midjiwan-ceo-christian-lovstedt-on-the-battle-of-polytopia) / [Mobidictum](https://mobidictum.com/interview-with-midjiwan-developer-of-the-battle-of-polytopia/)
- 規模: 2024年時点でモバイル累計2,000万DL、のち2,500万DL。毎週チャレンジ(各自同一マップでスコア競争)や大会も実施。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia)
- 評価(賛): 簡単に学べる入門4X(Gamezebo)、「圧倒的に複雑なジャンルへの穏やかな入口」(Nintendo Life)、単純なルールなのに歯ごたえ(Nintendo World Report)、グラフィックは携帯向き(TouchArcade)。【本文確認】 — 同上
- 評価(否): 技術ツリーが単純すぎ(PCMag)。全部族が同じ技術を使うので後半が魅力に乏しい(Nintendo Life, NWR)。4Xに慣れた人はすぐ飽きる(Nintendo Life)。ユニットが増えると地図が読みにくい(NWR)。部族に固有リーダーがなく退屈(NWR)。戦争が煩わしく他の作業への集中を妨げる(PCMag)。Metacritic は PC/Switch で mixed。【本文確認】 — 同上
- 評価(検索スニペット): 30ターンの Perfection の方が満足度が高く、Domination は「だれる」との評。AIは「高難度でも弱い」「複数でプレイヤーを狙い撃つ・不合理な判断」と評価が割れる。ラウンドが進むと繰り返し感。約15ターン以降マップが乱雑で読みにくいとの評も。【要約のみ】 — [レビュー検索結果: Nintendo World Report](https://nintendoworldreport.com/review/63151), [Nintendo Life](https://nintendolife.com/reviews/switch-eshop/the-battle-of-polytopia), [Gamebrain](https://gamebrain.co/game/the-battle-of-polytopia)

### Inferences
- 「資源1種+ターン上限30」で短時間・低学習コストを成立させた一方、全勢力同一ツリーが「後半の単調」の原因として複数レビューに共通して出る。設計時は、勢力差を技術ではなく開始条件・固有ルールで出すこと、ターン上限で終わらせて「後半」自体を作らないこと、が示唆される。
- 一人開発者の発言「新案の90%を捨てる」は、削る判断が設計の中心であることを示す。

### Gaps
- Ekenstam本人の言葉による「何を削ったか」の一次資料(インタビュー全文、星の初期値/技術ツリーの総数/マップの辺長)は取得できず。技術数・マップサイズの具体数値は未確認。
- 「30ターンで何点が上限か」「最適解がつまらないか」の批評は見つからなかった。

## Q2. その他のコンパクト戦略(Slipways, Ozymandias, Into the Breach, Kingdom, Bad North, Civ Revolution ほか)

### Takeaway
圧縮の手口は、(a)資源を数種類へ、(b)戦闘を地形単位の数値などへ抽象化、(c)盤を小さく・情報を全公開、(d)ターン数や1回の長さに上限を置く、に集約される。弱点は「繰り返しで解けてしまう」「運」「後半が遅い/単調」。

### Cited Findings
- Ozymandias(The Secret Games Company, 2022): 4X の欠点である「ルールの複雑さ」と「プレイ時間」を補い、細かい戦術より戦略を重視、少ない操作で遊べるようにした、とGame*Spark記事。資源は食糧・知識・資産・武力の4種類(軍事力も「武力」という資源で表現)。戦闘はユニット同士の衝突ではなく、地形ごとの「武力」を比較し、隣接する敵地形の武力を超えると自動占領。勝利は敵殲滅でなく、指定数の「偉業」(ピラミッド等)を先に達成。土地は旗を購入して拡張、遠いほど高い。カードは3枚までストック。マップは実在地域(インダス川流域、ガンジス平原、中国など)。マルチは3〜4人が適当。評者は「勝てる状況になったら一直線に勝利を目指すのが良い、いかに無駄な行動を無くすかが勝敗を分ける」と述べ、勝利条件の競走ゲームである点を指摘。【本文確認】 — [Game*Spark](https://www.gamespark.jp/article/2022/10/23/123719.html)
- Ozymandias の試合時間: 1時間以内(GOG掲載)、約1.5時間(PocketGamer)、約30分(低品質源)と食い違い。評価: Steamで "Very Positive"(1,287件)。批判: 戦闘のぎこちなさ、相手の勝利条件を阻止しにくく自分の達成を急ぐ方が良い、サブタイトルが誤解を招く、ボドゲ的で大規模帝国シムではない。【要約のみ】 — [GOG](https://www.gog.com/en/game/ozymandias_bronze_age_empire_sim?page=6), [Wasdland](https://www.wasdland.com/game/ozymandias-bronze-age-empire-sim-1768280)
- Slipways(Jakub Wasilewski, itch.io/Steam): 約30分で帝国を作る触れ込み(itchページ)、レビューでは「4Xではなくパズル」(Filmstories)、「グランドストラテジー風パズル」(RPS)。Steam約93%好評(第三者推計・2,277件)。弱点として、数回遊ぶと核メカニクスが似通う、高難度で挫折、運(RNG)依存、コンテンツ量が少ない。設計者が「何を削ったか」を語る文書は見つからず(私の想定していた人名とも一致せず)。【要約のみ】 — [itch.io devlog](https://krajzeg.itch.io/slipways/devlog), [Filmstories](https://filmstories.co.uk/?p=83273), [Vaporlens](https://vaporlens.app/app/1264280/slipways/stats/analysis)
- Civilization Revolution(Firaxis, 2008/iOS 2009): 1ターンが年数換算で序盤100年→終盤2年。勝利は4種(征服=全首都を1ラウンド保持、文化=偉人等20+国連、経済=2万ゴールド+世界銀行、技術=宇宙船)。文明16、固有ユニットは多くが改名版で同一能力。蛮族活動量は調整不可。Edge は「PCファンは眉をひそめるかもしれないが、Civの体験を薄めず凝縮した」、別評は「縮小された感じ、マップが窮屈」。Metacritic 80〜85。マルチは遅いと批判があり、ターンタイマーを追加。【本文確認】 — [Wikipedia: Civilization Revolution](https://en.wikipedia.org/wiki/Civilization_Revolution)
- Kingdom Two Crowns(Noio/Coatsink, 2018, モバイル2020): コイン1種で雇用・建築。昼は探索と建設、夜は敵襲。王冠を奪われると敗北(後継者が引き継ぐ形)、5島。好評だが「ペースが遅い」が批判。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/Kingdom_Two_Crowns)
- Bad North(Plausible Concept, 2018, モバイル2019): 小島のリアルタイム戦術。Metacritic 65〜74で mixed(Destructoid 5.5〜Nintendo Life 9)。開発側は携帯機での短時間プレイに適するが長時間向きではないと発言(Nintendo公式インタビューの検索スニペット)。【本文確認(Wikipedia)】【要約のみ(開発者発言)】 — [Wikipedia: Bad North](https://en.wikipedia.org/wiki/Bad_North), [Nintendo UK interview](https://www.nintendo.co.uk/News/2018/April/Interview-Taking-on-hordes-of-invading-Vikings-in-Bad-North-1368315.html)
- Into the Breach(Subset Games, 2018, モバイル2022): 3体のメカ、各マップに固定ターン数、敵の攻撃予告が表示され完全情報に近い。チェスに例えられる。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/Into_the_Breach)
- ITB 設計者発言: 「メカを失うことが最悪」という戦略ゲームの常識を捨てさせる。守る対象を都市にし、電力グリッド(最大7)が体力。敵が脅威にならない問題を、盤面を敵と危険地帯で埋めると「過度に複雑で解析困難」になるので都市を標的にして解決。電力バーを成長させると後半に価値が薄れ決断が消えたため断念。【本文確認】 — [Game Developer: Reimagining failure](https://www.gamedeveloper.com/design/reimagining-failure-in-strategy-game-design-in-i-into-the-breach-i-)
- ITB 設計原則: 「明快さのためなら面白いアイデアを毎回犠牲にする」(Justin Ma)。【本文確認は見出し・リード引用のみ】 — [Game Developer](https://gamedeveloper.com/design/-i-into-the-breach-i-dev-on-ui-design-sacrifice-cool-ideas-for-the-sake-of-clarity-every-time-)
- ITB の削減: 計画の約60%を削除(都市建設、ツリー、複数スクワッド等)、盤は8x8で、手作りマップの方が手続き生成より安い、との発言。GDC 2019 postmortem の本文は未取得。【要約のみ】 — [PC Gamer](https://pcgamer.com/into-the-breach-originally-had-city-building-and-tech-trees-creators-reveal), [GDC Vault](https://www.gdcvault.com/play/1026333/contactUs)
- Northgard(Shiro Games): 勝利条件を複数(Lore/Trade/Fame等)用意し、プレイ中に適応させる設計。簡単な操作とUIが目標の一つ。【本文確認(部分)】 — [Game Developer](https://gamedeveloper.com/design/crafting-the-multiple-victory-states-of-the-rts-i-northgard-i-)
- Antiyoy(yiotro, ウクライナの個人開発): Slay(Sean O'Connor)に着想を得た六角ターン制。ユニットは農民・槍兵・男爵・騎士の4種、マップはモバイルでランダム生成、広告・課金なし、500万DL超、2024年にSteam版。【要約のみ】 — [yiotro](https://yiotro.com/pr_antiyoy_demo/), [indie-hive](https://indie-hive.com/antiyoy)
- Reigns(Nerial): スワイプ2択ループ。開発者は「プロジェクトの範囲を整理し終わりを見通す力」が個人開発者の最重要スキルと発言。【要約のみ】 — [Game Developer](https://gamedeveloper.com/design/why-being-trapped-in-a-loop-makes-i-reigns-her-majesty-i-so-satisfying)
- Mini Metro / Dorfromantik / Islanders: 再プレイ性は配置のランダムとハイスコア追求に依存。批判は長時間での反復、単純すぎて持続しない、Islandersは読みにくく成就が運頼み。敵なしのスコア追求系は資料が薄い。【要約のみ】 — [Gaming Trend](https://gamingtrend.com/reviews/metro-mania-mini-metro-review/), [Nintendo Life: Dorfromantik](https://www.nintendolife.com/reviews/switch-eshop/dorfromantik), [Vaporlens: Islanders](https://vaporlens.app/app/1046030/islanders)

### Inferences
- Ozymandias は「戦闘を地形ごとの数値比較に抽象化」し「勝利=先着の偉業」にしているため、殲滅の掃討が構造上発生しない。信長風の国盗りでも「石高/勢力値の比較で自動占領」「先に規定数の達成で勝利」に置き換えられる。
- Into the Breach の教訓(敵の意図の予告、盤を埋めずに脅威の質で難しくする、成長で数値が膨らむと決断が消える)は、既存の「決断は少なく重く、敵意図を予告」という方針の裏付けになる。
- 少人数作は共通して「弱点=後半の単調・運・コンテンツ量」を抱える。

### Gaps
- Slipways設計者の「4Xを削った理由」、Ozymandias開発者の発言(Game*Sparkは紹介記事で開発者発言ではない)は未取得。
- Rebel Inc./Plague Inc.(Ndemic)、Hexonia、Hexarchy、Tinyfolks、8-Minute Empire、Tiny Epic Kingdoms、Slay、Islanders、Mini Motorways、Shogun Showdown、Pawnbarian は具体的な数字・評判を取れず(未調査または結果なし)。

## Q3. ラン制・短期キャンペーンと「毎回違う」ための工夫

### Takeaway
裏付けが取れた範囲では、(1)マップや配置のランダム生成、(2)固定ターン上限の得点戦、(3)毎週同一マップのスコア競争、(4)勝利条件の複数化、が「毎回違う」手段。メタ進行の効果を検証できた一次資料は得られていない。

### Cited Findings
- Polytopia: 30ターンの得点モード、毎週チャレンジ(全員同一マップでハイスコア競争)、ランクマッチ。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia)
- Ozymandias: 実在地域ごとのマップ、勝利条件が複数の「偉業」から選択、カードの2択。【本文確認】 — [Game*Spark](https://www.gamespark.jp/article/2022/10/23/123719.html)
- Northgard: 複数の勝利状態に適応させることで試合を差別化。【本文確認(部分)】 — [Game Developer](https://gamedeveloper.com/design/crafting-the-multiple-victory-states-of-the-rts-i-northgard-i-)
- Kingdom Two Crowns: 手続き生成レベル、5島。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/Kingdom_Two_Crowns)
- 弱点: Slipways は繰り返しで似通う・運依存、Mini Metro は長時間で反復、Dorfromantik は単純すぎるとの声。【要約のみ】 — 上記Q2のURL

### Inferences
- 短ランで差を出すには、地図ランダムより「勝利条件の抽選」「開始時カード/特性」が効く可能性。ただし本調査で効果を実証した資料はない(推測)。

### Gaps
- Slipways/Ozymandias/Northgard のメタ進行と解放要素の詳細、ランの平均時間、リプレイ率は未確認。

## Q4. マップ規模・手番の行動数・ターン数・霧・AI・チュートリアル・縦画面・中断再開

### Takeaway
確認できた具体数値は少ない。Polytopia(30ターン・星1種)、Ozymandias(資源4種・偉業競争)、Civ Revolution(年/ターンが100→2年)、ITB(8x8・固定ターン)が柱。AIは「単純化ルールにAIが追従できない/弱い」という論点が複数に出る。縦画面での可読性と中断再開は、一次資料が得られなかった。

### Cited Findings
- ターン上限: Polytopia 30ターン(Perfection)。ITB はマップごとに固定ターン数。【本文確認】 — [Wikipedia: Polytopia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia), [Wikipedia: ITB](https://en.wikipedia.org/wiki/Into_the_Breach)
- 盤サイズ: ITB 8x8(開発者発言・スニペット)。Civ Revolution は「マップが窮屈」との評。【要約のみ】【本文確認】 — [PC Gamer](https://pcgamer.com/into-the-breach-originally-had-city-building-and-tech-trees-creators-reveal), [Wikipedia](https://en.wikipedia.org/wiki/Civilization_Revolution)
- 可読性: Polytopia は後半ユニットが増えると地図が読みにくい(NWR)。ITB は盤を敵で埋めると複雑で解析困難と判断し回避。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia), [Game Developer](https://www.gamedeveloper.com/design/reimagining-failure-in-strategy-game-design-in-i-into-the-breach-i-)
- チュートリアル: Ozymandias はシナリオ形式のチュートリアル「ショートストーリー」で資源を1種ずつ段階導入(食糧→知識→資産→武力)。【本文確認】 — [Game*Spark](https://www.gamespark.jp/article/2022/10/23/123719.html)
- AI: Polytopia は弱い/ずるい/理不尽の評価が割れる。Civ Revolution は蛮族の挙動を調整不可。【要約のみ】【本文確認】 — [Gamebrain](https://gamebrain.co/game/the-battle-of-polytopia), [Wikipedia](https://en.wikipedia.org/wiki/Civilization_Revolution)
- 4X後半の問題: 2/3〜3/4地点で戦略の勝敗は事実上決まり、残りは「次のターン」連打の掃討作業になる。原因は個々のユニットを毎ターン動かす設計。提案は(1)個別ユニットを廃す、(2)連続的・委任型の指示、(3)人事(将・人物の性格)、(4)敵戦略が知覚でき理にかなって見えること。「万人が納得する解は未だ無い」との留保つき(Bart Stewart, 2017, ブログ記事)。【本文確認】 — [Game Developer: Five Suggestions for 4X Fun](https://gamedeveloper.com/design/five-suggestions-for-4x-fun)

### Inferences
- Stewart の「ユニット個別移動が掃討作業を生む」は、信長型で「軍団/方面に命令して自動進行」「勝敗が見えた時点で終了させる」設計を支持する。人事(武将の性格)は信長ジャンルと相性が良い。ただし提案者自身が未実装の仮説と述べている。
- 縦画面は Polytopia 等の可読性問題から、ユニット数と地図の密度に上限を置く必要がある(推測)。

### Gaps
- 各ゲームのマップの具体的タイル数、1ターンの行動数、霧(fog of war)の扱い、中断再開(セーブ)の仕様、縦画面UI の評価は信頼できる資料を取れず。
- 日本の携帯・ガラケー期の小型国盗りアプリは、検索で「獅子の如く」「戦国クイズ型」等の名前が出たのみで、仕様・評価は未確認(アプリストア/個人サイト由来)。

## Q5. 小規模戦略で起きる失敗(解けてしまう・単調・AI・運・スコア最適化)

### Takeaway
複数レビューに共通する失敗は「後半の単調」「全勢力が同質」「ランダム/運」「AIの弱さ」「繰り返しで似てくる」。決定的な「スコア戦の最適解が退屈」という批評は見つからなかった。

### Cited Findings
- 全部族が同じ技術ツリーで後半がつまらない、星が使い切れないほど出て単調(NWR要旨は検索経由)。【本文確認(Wikipedia)】【要約のみ(NWR詳細)】 — [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia), [NWR](https://nintendoworldreport.com/review/63151)
- Civ Revolution: 固有ユニットは改名で同性能、マップが窮屈、マルチは遅い。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/Civilization_Revolution)
- Ozymandias: 相手の勝利を阻止しづらく自分の達成を急ぐ方が良い(競走化)、戦闘がぎこちない。【要約のみ】 — [GOG](https://www.gog.com/en/game/ozymandias_bronze_age_empire_sim?page=6)
- Slipways: RNG依存、高難度の挫折、数回で似通う。【要約のみ】 — [Vaporlens](https://vaporlens.app/app/1264280/slipways/stats/analysis)
- Kingdom Two Crowns: 遅いペース。Bad North: mixed(5.5〜9)。【本文確認】 — [Wikipedia: Kingdom](https://en.wikipedia.org/wiki/Kingdom_Two_Crowns), [Wikipedia: Bad North](https://en.wikipedia.org/wiki/Bad_North)
- ITB: 成長で防御バーが長くなると損害が気にならなくなり決断が消える(成長のインフレで選択が潰れる例)。【本文確認】 — [Game Developer](https://www.gamedeveloper.com/design/reimagining-failure-in-strategy-game-design-in-i-into-the-breach-i-)

### Inferences
- 「数値インフレで決断が消える」(ITB)と「星が余る」(Polytopia)は同根。資源を常に不足させる設計が有効かもしれない(推測)。
- 勝利条件競走型(Ozymandias)は、勝てる時に一直線になる=選択肢が減るリスクがある。

### Gaps
- 「数回で解けた感」を具体的に論じた一次資料、ターン数上限モードでスコア最適解が単調になる事例の検証は未取得。

## Q6. 開発者の発言(なぜ削ったか)

### Takeaway
取得できた発言はITBが最も具体的(明快さ優先、盤を埋めない、成長でバーが無意味化、計画の約60%削除)。Polytopiaは断片的(90%を捨てる、チュートリアル、課金なし)。

### Cited Findings
- ITB Justin Ma: 「明快さのためなら面白いアイデアを毎回犠牲にする」。盤を敵で埋めるのは「分かりづらさの対極」。【本文確認(部分)】 — [Game Developer](https://gamedeveloper.com/design/-i-into-the-breach-i-dev-on-ui-design-sacrifice-cool-ideas-for-the-sake-of-clarity-every-time-), [Game Developer](https://www.gamedeveloper.com/design/reimagining-failure-in-strategy-game-design-in-i-into-the-breach-i-)
- ITB: 計画の約60%を捨てた(都市建設・ツリー含む)。【要約のみ】 — [PC Gamer](https://pcgamer.com/into-the-breach-originally-had-city-building-and-tech-trees-creators-reveal)
- Polytopia CEO: テストした案の90%を捨てる。Ekenstam: 空き時間で開発。【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia)
- Polytopia: 「PC4Xをそのまま持ち込むとチュートリアルが何ページも要る」ためジャンルを作り直した。【要約のみ】 — [Cubed3](https://www.cubed3.com/features/interviews/interview-with-midjiwan-ceo-christian-lovstedt-on-the-battle-of-polytopia)
- Northgard Vidal: 新鮮味のない戦略ジャンルで「簡単な操作と簡素なUI」「サバイバル要素と雰囲気」を狙った。【本文確認(部分)】 — [Game Developer](https://gamedeveloper.com/design/crafting-the-multiple-victory-states-of-the-rts-i-northgard-i-)
- Bart Stewart(開発者ではなく設計論者): 4Xの掃討作業は個別ユニット操作が原因。【本文確認】 — [Game Developer](https://gamedeveloper.com/design/five-suggestions-for-4x-fun)

### Inferences
- 少人数開発の共通原則は「明快さ>新奇さ」「削る」「量でなく決断の質」。

### Gaps
- Slipways/Ozymandias/Antiyoy/Slay 開発者の削減理由、GDC講演(ITB postmortem 等)の本文、日本語の開発者インタビュー(4Gamer/ファミ通/電ファミ等)は未取得。
