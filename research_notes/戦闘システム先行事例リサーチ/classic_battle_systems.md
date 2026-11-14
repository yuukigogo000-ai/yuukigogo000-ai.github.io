# 古典(1986–2010)名作の戦闘システム: 賞賛点・批判点・低入力オートバトルへの転用可能性

調査上の注意(全体): WebFetch が gamedeveloper.com / pcgamer.com / hardcoregaming101.net / wikiwiki.jp 等でネットワーク制限(名前解決失敗)になり、本文の精読ができなかった。以下は WebSearch の要約結果に基づく。一次インタビュー(伊藤裕之・金子一馬・堀井雄二本人の発言)の原文は未確認で、二次引用のものはそう明記する。各ゲームの「平均戦闘時間・入力回数」を実測/出典付きで示した資料は見つからなかった(Gaps 参照)。

## Q1. 各名作の具体メカニクスと賞賛点(DQ作戦AI / FF ATB・CTB / FF12ガンビット / Press Turn・One More / グランディア / クロノ / マリオRPG / ポケモン / サガ / オウガバトル / ヴァルキリープロファイル / 世界樹)

### Takeaway
賞賛されている仕組みの共通点は、(1)入力を「毎ターンの操作」ではなく「事前の方針設定」や「1つの意味ある選択」に寄せる(DQ作戦、ガンビット、オウガバトルの編成+戦術)、(2)弱点・割込み・順序といった「読める」ルールで少ない入力に重みを持たせる(Press Turn、グランディア、CTBの順番表示、ポケモン相性)、(3)演出を短く保ちつつ参加感を残す(タイミング入力、連携技)の3系統。

### Cited Findings
**ドラクエ(作戦/AI戦闘)**
- DQ4 第5章からAI戦闘が登場し、以降のナンバリング全作品とモンスターズに引き継がれた。公式ガイドでは細かく指示する方式を「マニュアル戦闘」、その対義語を「AI戦闘」と呼ぶ。DQ5以降の「めいれいさせろ」は命令でありAI任せではないが、賢さ次第で従わないこともある — [DQ辞典(wikiwiki)の検索要約](https://wikiwiki.jp/dqdic3rd/【AI】)(※本文は未精読。検索結果の要約のみ)
- 作戦の仕組みは、堀井雄二の発言によるとDQ4開発中に「プレイヤーの意図をAIに伝える手段」として加えられたもの(攻略サイト経由の二次情報) — [攻略系まとめ検索結果](https://wikiwiki.jp/dqdic3rd/%E3%80%90%E4%BD%9C%E6%88%A6%E3%80%91)
- 「ガンガンいこうぜ」はMP度外視で最大火力、「いのちだいじに」は回復・蘇生優先で、HPが少しでも減ると回復する傾向。作戦を使うとコマンド入力の手間が省け、レベル上げの周回が効率化する。DQ3リメイクでは「基本オートのままで問題ない」との評価もある — [kamigame](https://kamigame.jp/%E3%83%89%E3%83%A9%E3%82%AF%E3%82%A811/%E6%94%BB%E7%95%A5%E3%82%AC%E3%82%A4%E3%83%89/%E4%BD%9C%E6%88%A6.html), [game8](https://game8.jp/dq3/654246)
- 批判面(AI): DQ4の35周年記事が「延々とザラキを唱えるクリフト」を愛される(ネタ的に)要素として扱っている — [GAME Watch](https://game.watch.impress.co.jp/img/gmw/docs/1660/147/html/2_o.jpg.html)(見出しのみ確認。AIの愚かさがネタ化されつつ愛された例)

**FF ATB / CTB**
- ATBは伊藤裕之の考案、FF4(1991)で初採用、1995年に伊藤・坂口で特許(2010年失効)。時田貴司によれば初期案はF1レースがモデルで、キャラ差やバランスが考慮されず「FF4がボタン連打ゲームのようになった」、坂口も試作は面白くなかったと回想。吉井清が洗練を担当。FF5で個別ゲージ、FF6で滑らかな動きになった — [Den of Geek](https://www.denofgeek.com/games/final-fantasy-creators-secret-origins-atb-system-explained), [Giant Bomb](https://giantbomb.com/wiki/Concepts/Active_Time_Battle)
- クロノ・トリガーのATBは「テンポが良く、今でも通用する」「素早い判断と集中を要求する」と評価される一方、「他作品と同じATB」「最もつまらない戦闘システムの一つ」との個人レビューもある — [RPGamer](https://rpgamer.com/review/chrono-trigger-playstation-review/), [MobyGames検索経由](https://www.mobygames.com/game/4501?s=platform)
- FFXのCTBは画面右にターン順を表示し、メニューでコマンドを選択(ハイライト)するだけで順番への影響がリアルタイムに更新される。後にTrails、オクトパストラベラー、アトリエ等が似た表示を採用。Cross Reverieの開発者は「攻撃順を事前に見られる」点を評価してCTB風を採用 — [Turnbasedlovers](https://turnbasedlovers.com/originals/from-dd-to-today-the-shifts-of-turn-based-combat-in-rpgs/), [Siliconera](https://siliconera.com/?p=472369), [Gamerguides](https://www.gamerguides.com/final-fantasy-x-hd/guide/introduction/gameplay/battle-system)

**FF12 ガンビット**
- 設計側の動機(PlayStation Blog 記事の要約): リアルタイム要素を従来のコマンド式に足すと「全部を操作するのは速すぎて難しくなる」ためガンビットを採用 — [PlayStation Blog(検索要約)](https://blog.playstation.com/?p=192698)
- 賞賛: 戦略は「ガンビットを組むこと」にあるという擁護、スキル解放に従い創造的に遊べるというKotaku評 — [RPGSite](https://www.rpgsite.net/review/2789-final-fantasy-xii-review), [Kotaku](https://kotaku.com/final-fantasy-xii-the-zodiac-age-the-kotaku-review-1796816046), [PC Gamer(見出し:「15年経っても最高の戦闘」)](https://pcgamer.com/15-years-on-final-fantasy-12s-combat-system-is-still-the-best)
- 批判: 「プレイヤーの責任をシステムが奪う」「後半はAIがほぼ勝手に遊ぶ」。擁護側は「リーダーのガンビットをOFFにして操作感を作る人の不満だ」と反論 — [RPGSite](https://www.rpgsite.net/review/2789-final-fantasy-xii-review), [Push Square](https://www.pushsquare.com/news/2017/05/final_fantasy_xii_ps4_trailer_shows_one_of_the_series_most_divisive_gameplay_systems), [Obsidian Publish 論考](https://publish.obsidian.md/taniynquest/Final+Fantasy+XII+and+the+Illusion+of+Free+Will)

**SMT III / ペルソナ Press Turn・One More**
- 全アクションは Press Turn を消費。弱点・クリティカルは半ターンしか消費せず追加行動が得られる(ミス・無効・反射等はペナルティ)。敵も同じ規則を使うため「敵に弱点を突かれる」リスクが対称にある。ノクターンは味方全員→敵全員のラウンド制。ペルソナは簡略化した「1 More」 — [MegaTen Wiki](https://megatenwiki.com/wiki/Press_Turn_System), [Giant Bomb](https://giantbomb.com/wiki/Concepts/Press_Turn_System), [Final Weapon](https://finalweapon.net/2024/06/07/metaphor-refantazio-smt-press-turn-system/)
- 設計意図の評: 「オート攻撃連打で勝てる」ことを防ぎ、MPを温存してボス戦に持ち越すような遊び方も許さない — [Samurai Gamers(要約経由)](https://samurai-gamers.com/?p=209367), [RPGamer: P5Rは“決して崩れない仕組みの塔”](https://rpgamer.com/?p=73615)
- 批判: TV TropesがSMTシリーズの「ScrappyMechanic(嫌われる仕組み)」として扱う(詳細未確認。敵に弱点を突かれて連続行動されると全滅しうる運ゲー感が指摘されることが多いが、本調査では本文未確認) — [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/ScrappyMechanic/ShinMegamiTensei)

**グランディア**
- 行動ゲージ(IP)がタイムライン。クリティカル(や特定条件)で敵の行動をキャンセル/後ろへ押し戻せる。GrandiaIIではクリティカルは追加ダメージなしでキャンセルのみ(ガイド情報)、GrandiaIIIではゲージが円形になりシステムは大きく変わらず。批評は総じて好意的で、HG101は「バトルシステムが主に称賛される作品」と述べる — [LP Archive](https://lparchive.org/Grandia/Update 07), [GameSpot III](https://www.gamespot.com/reviews/grandia-iii-review/1900-6144367/), [Hardcore Gaming 101](https://www.hardcoregaming101.net/grandia-iii/), [RPGFan III(バランスに問題との指摘)](https://www.rpgfan.com/review/grandia-iii-2/)

**クロノ・トリガー**
- 敵がマップ上で見え、ランダムエンカウントなし。キャラ毎8技、組合せで二人技・三人技。パーティ編成で連携技が解放されるのが「絆の表現」と評価 — [RPGamer](https://rpgamer.com/review/chrono-trigger-playstation-review/), [Inverse](https://www.inverse.com/gaming/chrono-trigger), [RPGFan](https://www.rpgfan.com/review/chrono-trigger-4/)

**スーパーマリオRPG/ペーパーマリオ(アクションコマンド)**
- SMRPGが「タイミングヒット」(ボタンのタイミングで攻撃ダメージ増/防御軽減)を導入したと広く説明される。「コマンドを選んでアニメを待つだけ」を避け、関与を保つとの評。ペーパーマリオはタイミング習熟で難度が大きく下がる。Sticker Starは入力を1ボタン化し批判された。SMRPGスイッチ版は成功連鎖でアクションゲージが溜まりバフ解放 — [ComicBook](https://comicbook.com/gaming/feature/the-30-year-old-rpg-mechanic-that-still-defines-the-best-games-today/), [RPGFan Paper Mario](https://www.rpgfan.com/review/paper-mario-3/), [Dampfkraft: Notes on Combat Systems in Paper Mario](https://www.dampfkraft.com/games/paper-mario-combat.html), [CGMagazine](https://www.cgmagonline.com/review/super-mario-rpg-nintendo-switch/)

**ポケモン**
- 技は4つ上限が初代から続き、開発側は「4が現システムに適切」とし、剣盾でも岩尾和政ディレクターが増減はバランスを損なうと判断。相違のある手作り相性表が各タイプの個性を作り、反復プレイで暗黙に習得される。一方、積み上がった隠れ計算(個体値等)は新規参入の壁との分析もある — [DoTA Esports(検索要約)](https://dotesports.com/?p=178501), [DualShockers](https://www.dualshockers.com/pokemon-sword-shield-major-battle-revamps/), [saschb2b分析](https://saschb2b.github.io/game-mechanics/games/pokemon-rse/type-chart)(個人ブログ。信頼度は中)

**ロマンシング サ・ガ / サガフロ(閃き・陣形)**
- 閃き(戦闘中にランダムで新技習得)は発見の楽しさと評価される一方、RS3リメイク評では「強さが運に依存」「システムと戦っている気分」「不透明な成長」と批判 — [RPGFan RS3](https://www.rpgfan.com/review/romancing-saga-3-2019/), [Nintendo Life](https://www.nintendolife.com/reviews/switch-eshop/romancing_saga_3), [The Outer Haven](https://www.theouterhaven.net/2024/10/romancing-saga-2-revenge-of-the-seven-review-pc/)
- ミンストレルソングRemaster評: 戦闘回数に連動する「イベントランク」で敵が急速に強化、システム過複雑でガイド必須 — [RPGamer](https://rpgamer.com/review/romancing-saga-minstrel-song-remastered-review/)

**オウガバトル/オウガバトル64**
- ユニット(リーダー含め最大5人)が出会うと自動戦闘。陣形(隊列)で攻撃の種類・数・順序が変わり、同クラス/同種の隣接で強力な連携魔法が出る。戦闘前にターゲット方針(リーダー狙い/弱敵狙い等)を設定し、任意に変更可。向き(正面/側面/背後)で陣形が崩れる。クリティカルは敵を後列へ押す。習得対象は陣形・地形・時間帯・カオスフレーム — [Wikipedia](https://en.wikipedia.org/wiki/Ogre_Battle_64), [LP Archive](https://lparchive.org/Ogre-Battle-64/Update 02), [HG101](https://www.hardcoregaming101.net/ogre-battle-64-person-of-lordly-caliber/)(いずれも検索要約経由)

**ヴァルキリープロファイル**
- 4人パーティがひし形陣形、各キャラが1ボタンに割当てられ連携で大ダメージ。コンボ巧者は追加経験値・アイテムで報われ、単純連打を超える動機づけがある。ただし「最初の章は楽しいが後は見るのが飽きる」「戦闘がぎこちない」 — [RPGFan](https://www.rpgfan.com/review/valkyrie-profile-3/), [RPGamer](https://rpgamer.com/review/valkyrie-profile-lenneth-ps4-review/), [HonestGamers](https://www.honestgamers.com/409/playstation/valkyrie-profile/review.html)

**世界樹の迷宮**
- 前列/後列の配置、列/隣接への範囲攻撃、部位狙い。FOE(マップ上を徘徊する強敵)が戦闘に乱入する緊張感が最も盛り上がる場面とされる。難度・グラインドは賞賛と欠点の両面(FOE撃破に経験値なしなど) — [RPGamer](https://rpgamer.com/review/etrian-odyssey-review/), [Nintendo Life EO4](https://www.nintendolife.com/reviews/3ds/etrian_odyssey_iv_legends_of_the_titan), [ANN](https://animenewsnetwork.com/review/game/nintendo-3ds/etrian-odyssey-iv/legends-of-the-titan)

**FE/FFT**: 時間の都合で調査せず(依頼上「簡潔に」の範囲)。

### Inferences
- 戦闘時間・入力数の概算(出典なし・一般知識に基づく推測。要検証): DQ/FF/ポケモン系の雑魚戦は通常20〜60秒・数〜十数回の入力、ボスは数分・数十回以上。作戦/ガンビット/オウガ系は雑魚の入力を数回(ほぼ0)に圧縮できる。ヴァルキリープロファイルは1ターンに数回のボタンだが演出が長い。
- 「事前に方針を決め、実行は自動」(DQ作戦・ガンビット・オウガ)が本案(4体配置+戦術選択→オート)に最も近い先行例。賞賛点は「方針設計に深さがある」ことで、批判点は「何もしてない感(FF12)」と「AIの愚行(クリフト)」に二分される。
- ポケモン相性とPress Turnは「規則が少なく読める」ため、ステッカー(キャラ)に属性/弱点を付けると配置・戦術判断の質を上げやすい。

### Gaps
- 各ゲームの雑魚/ボス戦闘時間と1戦あたり入力回数の出典付き実測値は見つからなかった(Wiki・攻略は戦闘時間を記載しない)。
- 伊藤裕之・金子一馬・橋野桂・堀井雄二本人の日本語一次インタビュー本文は未取得(ネットワーク制限と検索の限界)。
- FE/FFT、ペルソナ3〜5の具体的な賞賛記事、DQ4のAI評価の4Gamer/ファミ通記事は未取得。

## Q2. 当時の戦闘システムでよく批判された点(具体例つき)

### Takeaway
批判は(a)頻度・長さ・読み込み(ランダムエンカウント、遅い演出、読み込み)、(b)「作業感」(グラインド、FF8のドロー、繰り返しの手順)、(c)不透明さ(閃き、成長)、(d)自動化に対する「プレイしていない感」(FF13、FF12)、(e)追加入力が冗長(Legend of Dragoonの追加ボタン)に整理できる。

### Cited Findings
- ランダムエンカウント: 「資源が潤沢で敗北は稀なためフィラー(水増し)に過ぎない」「探索の感覚を断つ」「80年代でも良い発想ではなかった」という批判。一方「戦闘と探索の分離や不意の緊張感を好む」擁護も。改善案: 低頻度+高難度、倒した敵が復活しない、回数制限、乗り物でも固有の敵が出る(PSO4) — [Game Developer: Revisiting Random Encounters(検索要約)](https://www.gamedeveloper.com/game-platforms/revisiting-random-encounters), [Gfinity](https://www.gfinityesports.com/article/modern-jrpgs-must-kill-random-battles-for-better-gameplay), [Chikorita157: JRPG pet peeves](https://chikorita157.com/2014/04/19/japanese-rpg-pet-peeves-thoughts-about-annoyances-and-inconveniences-in-role-playing-games)
- グラインド: 「問題は遭遇そのものよりレベル上げ(グラインド)」「戦闘はレベルゲートでなく戦略の技量であるべき」 — [RPG Maker Forums](https://rpgmaker.net/forums/topics/24683), [Game Informer 2016](https://gameinformer.com/b/features/archive/2016/10/16/rpg-grind-time-rpgs-shouldnt-feel-like-work)
- FF8 ドロー/ジャンクション: 強い魔法を99個集めるため繰り返し敵から吸い出す退屈さが「広く批判」。要点を説明しないためレベル上げ(敵もレベル連動)がかえって不利に。一方「敵がレベル連動なので単純グラインドの得は小さく、管理が報われる」「リメイク版は緩和」との見方も。召喚魔法がジャンクション後に無用との指摘 — [Cubed3](https://www.cubed3.com/games/reviews/pc/final-fantasy-viii), [RPGamer Remastered](https://rpgamer.com/review/final-fantasy-viii-remastered-review/), [Push Square](https://pushsquare.com/reviews/ps4/final_fantasy_viii_remastered)
- FF13: 最多の批判は「戦っている感がない」で、メニューの主コマンドが「オートバトル」と名付けられたこと自体が不運との指摘(名前が実態以上の深みを隠した)。序盤は敵が弱くパラダイムシフトの必要が乏しい、「最初の2時間は楽しめなかった」(Game Informer)。ただし中盤以降は「ミクロ操作からマクロ制御への移行」と評価され、後にステイガー(スタッガー)がFF7R/FF16に継承 — [RPGSite](https://www.rpgsite.net/feature/14545-final-fantasy-xiiis-combat-continues-to-influence-the-series), [Bitmob](https://bitmob.com/articles/real-time-battles-in-final-fantasy-13), [Game Informer](https://gameinformer.com/blogs/editors/b/gimiller_blog/archive/2010/03/12/the-five-things-i-love-about-final-fantasy-xiii-and-the-five-things-i-dont.aspx), [Kotaku](https://kotaku.com/final-fantasy-best-worst-game-rpg-square-enix-ff-16-1850567242/14)
- FF12: 「AIが後半を勝手にプレイする」(上述)。
- Xenosaga Episode II: ランダム戦闘が長い、「ストック→ブースト→ブレイク→放出」手順の繰り返し、戦闘前の長いロード。Episode IIIでストック廃止・ブレイクを単純な1ゲージ化して高速化したが、連携攻撃など楽しい要素が削られた/ストーリーのテンポと衝突との声も — [RPGamer(アーカイブ)](https://archive.rpgamer.com/games/xeno/xenosaga/reviews/xenosagardrev8.html), [GameRevolution EP3](https://www.gamerevolution.com/review/37439-xenosaga-episode-iii-also-sprach-zarathustra-review), [RPGFan EP2](https://www.rpgfan.com/review/xenosaga-episode-ii-jenseits-von-gut-und-bose-3/), [xenoserieswiki](https://www.xenoserieswiki.org/wiki/Combat_(XS2))
- Legend of Dragoon: タイミング入力「Additions」が「面倒」「ゲーム終盤には飽きる」「ひとつ余計な手順」、コマンド実行がもっさり、戦闘画面への遷移が11秒(Icicle Disaster)、経験値が遅く最初の数レベルに数十戦必要。一方ドラグーン変身が数時間後に戦略層を加えると好意的評価も、変身中は回復アイテムが使えない/ダメージ増が後で陳腐化との指摘 — [RPGFan](https://www.rpgfan.com/review/the-legend-of-dragoon-2/), [Inverse](https://www.inverse.com/gaming/the-legend-of-dragoon-playstation-anniversary), [Push Square](https://pushsquare.com/reviews/ps5/the-legend-of-dragoon), [Icicle Disaster](https://icicledisaster.com/274), [HonestGamers](https://www.honestgamers.com/4870/playstation/the-legend-of-dragoon/review.html)
- ペーパーマリオ系: タイミング習熟ですぐ易しくなる、StickerStarの1ボタン化批判(上述)。
- サガ系: 運依存・不透明な成長・イベントランクで敵が急強化(上述)。ヴァルキリープロファイル: コンボ演出に見飽きる(上述)。世界樹: 難度/グラインド、FOEが経験値を落とさない(上述)。
- Lunar / Suikoden のオート戦闘: 該当する出典を得られなかった(Gaps)。

### Inferences
- 「長いアニメ+頻度」が最大の共通敵。本案の90秒/7分という目標は、これらの批判を避ける設計制約として有効。
- 自動化批判(FF12/FF13)は「プレイヤーの判断が見えない」ことに由来する。作戦AIの実行結果をログ・ハイライトで「あなたの設定が効いた」と見せることが重要(FF13のラベル問題が示唆)。
- 追加ボタン入力(LoD Additions)は繰り返しで摩耗する。入力を足すなら毎戦ではなく見せ場(ボス・必殺)に限定すべき。
- 「雑魚を省略可能にする」(クロノのマップ上の敵、ドロップ復活なし)は、雑魚90秒戦を許容させる周辺設計として有望。

### Gaps
- 「状態異常がボス戦で無効」「支配的戦略」「不透明なダメージ式」「遅いATB待ち」を扱った具体的な記事を、今回の検索では独立に確認できなかった。
- Lunar、Suikoden のオート戦闘に関する批判・評価の出典なし。
- 5ch・ResetEra・Reddit の議論は検索に出てこず(ミラーサイトのみ)未確認。日本語圏の批判(ドラクエのエンカウント率、FF8、FF13)は英語圏経由の情報が中心。

## Q3. 「入力あたりの判断の質が高い」ため低入力オートバトルへ転用しやすい仕組み

### Takeaway
最有力は(1)戦前の編成・隊列と戦術方針設定(オウガバトル、DQ作戦、ガンビット)、(2)弱点/相性ルール(Press Turn、ポケモン)、(3)順番表示による見える戦況(FFX CTB、グランディアのタイムライン)、(4)1〜2か所の短いタイミング入力(マリオRPG)、(5)隣接配置で連携が出る(クロノ、オウガ64、ヴァルキリープロファイル)。

### Cited Findings
- 上記 Q1 の各出典に基づく。特に:
  - オウガバトル64は「戦闘前の陣形と戦術設定が結果を決める自動戦闘」で、本案(4体配置+戦術選択→自動戦闘)の最も近い先例 — [Wikipedia](https://en.wikipedia.org/wiki/Ogre_Battle_64)
  - ガンビット: 設計動機は「全操作だと速すぎて難しい」ため — [PlayStation Blog(検索要約)](https://blog.playstation.com/?p=192698)
  - DQ作戦は少ない選択で全員を動かし、リメイクでは基本オートで足りるとの評価 — [game8](https://game8.jp/dq3/654246)
  - Press Turn は弱点を突くほど行動数が増え、オート連打を抑制する — [MegaTen Wiki](https://megatenwiki.com/wiki/Press_Turn_System)
  - FFXの順番表示は入力中に結果をプレビュー — [Gamerguides](https://www.gamerguides.com/final-fantasy-x-hd/guide/introduction/gameplay/battle-system)
  - ポケモン: 4技制限とタイプ相性という少数の規則で深さ — [DualShockers](https://www.dualshockers.com/pokemon-sword-shield-major-battle-revamps/)

### Inferences(転用案・推測)
1. 「戦術」を DQ作戦のような少数プリセット+条件付き(ガンビット的)1〜2枠にし、ボス前に差し替えさせる。判断は戦前に集中、戦闘中の入力はゼロ〜1。
2. 弱点システムを簡素化して導入: 家庭用品の属性(水/熱/鋭/柔らか…)に3〜5種の相性。「弱点を突くと次の行動が早まる」(Press Turn簡易版)で、オート戦闘でも結果が視覚的に伝わる。
3. 画面上部にターン順/ゲージ(CTB・グランディア式)を表示し、観戦のみでも「なぜ勝ったか/負けたか」が読める。割込み(キャンセル)は1回の見せ場として十分。
4. 隣接配置で連携技(クロノ/オウガ64)が出る:4体の並べ方に意味が生まれ、写真由来ステッカーという題材にも合う。
5. ボス(7分)にはFFXIII/世界樹的な「段階(ステイガー/FOE)」を1つ置き、フェーズ毎に戦術差し替えの窓を作る(入力は数回)。
6. 避けるべき: 閃き型の純ランダム成長(不透明)、毎戦の長い必殺演出、毎戦必須のタイミング入力、AIが愚行を繰り返す設計(ログ化・停止条件で対処)。

### Gaps
- 上記はすべて出典付き事例からの推論であり、本ゲームでの検証はされていない。90秒/7分に収まる戦闘のターン数・テンポの実例(例: Auto Chess系、Ogre Battleの1戦闘秒数)は未調査(新しいゲームは他担当)。
