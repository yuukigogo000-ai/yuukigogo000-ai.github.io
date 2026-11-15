# 物理×ローグライト/はじき(フリック)ゲームの先行事例(はじきバトル設計の検証用ノート)

調査日 2026-11-15。凡例: 【本文確認】=ページ全文を取得して確認、【要約のみ】=検索スニペット/検索要約のみ(未検証)。
取得制約: WebFetchは使えず curl。Steam/BGG/Reddit等は遮断。全文を取れたのは en/ja.wikipedia(API)と gamedeveloper.com の2記事のみ。それ以外のレビュー・インタビューは全て【要約のみ】。ゲーム評価の多くが要約止まりである点を前提に読むこと。

## 1. 物理ローグライト/「物理+ビルド」作品の中核ルール・称賛・批判・アイテムの物理への介入

### Takeaway
Peglin系・ブロック崩し系は「弾き出す入力は1回、あとは物理に任せる」ため、批判は一貫して「運の比重」「照準の意味の薄さ」「反復」に集まる。一方、ビルド(オーブ/レリック)が物理結果を増幅する設計は広く受け入れられている。「ターンごとに自分で駒を選んで弾く」構造に近い作例(Flick Shot Rogues、Critter Crossfire)は存在するが、評価の裏付けは薄い。

### Cited Findings
- Peglin: パチンコ式。オーブを撃ち、ペグに当たった分のダメージが敵に配分されるターン制RPG。オーブ(デッキ構築式)とレリックで強化。ボスは各ステージ末、Cruciball(最大Lv20)で周回ごとにデメリット追加。2022-04 PC早期公開、1年で40万本、2024-08 1.0。Peggle+Slay the Spire着想。 — [Wikipedia Peglin](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Peglin) 【本文確認】
- Peglin批判: 最多の不満は運の比重。レビュアーは「ペグ盤面の繰り返し」「運要素」を減点要因に挙げる。「多くの盤面でボールが囲まれた位置や変な角度から始まり、狙いが実質無意味」との指摘。レリックの設計空間が「最もフラストレーション」との評、Steamでは「レリックの半分は使えない」との声(ユーザー意見)。高難度では運ゲー化との集約サマリ(自動要約サイトなので重みは低い)。擁護側は「運を制御する学習が面白い」「ランダム性が中毒的」。 — [検索要約: thesixthaxis等](https://www.thesixthaxis.com/2025/09/09/peglin-review/) 【要約のみ】
- Roundguard(Wonderbelly): Peggle型で自キャラがボール。敵に当たると反撃を受ける。説明が難しく、演出(画面揺れ・ダメージ数字・振動等)を足しても伝わらず、結局「敵に当たる/殴り返される」を順に教える強めのチュートリアルで解決。マナ消費を全スキル10に固定(跳ね回りながら暗算できないため)。物理は「地球の重力ではない」。シミュレーション速度を約90%に落として手触りを調整、側壁に追加の水平反発を与えるなど「人が期待する挙動」に合わせて嘘をつく。 — [Game Developer(2020-04-22)](https://gamedeveloper.com/design/the-design-of-i-peggle-i--like-dungeon-crawler-i-roundguard-i-) 【本文確認】
- Roundguardで開発側がプレイヤー照準案を試して捨てたとの記述(Rogueの制御的な狙いにしたくなかった等)は検索要約にのみあり、上記Game Developer全文には無い。 — [GamesBeat Roundguardインタビュー](https://gamesbeat.com/roundguard-interview-how-wonderbelly-blended-peggle-with-roguelite-rpgs/2) 【要約のみ・未検証】
- Rack and Slay(ビリヤード・ローグライト): 玉として迷宮を進む。物理の手触りと着想は好評(Game8 66/100、Steam Very Positive 469件)。批判は「敵が単純」「スポーンの改善余地」「能力が控えめ」「ローグライト部分が的を外す」。1ランは約30分以内、クリア約3時間、$5.99。 — [Game8](https://game8.co/articles/reviews/rack-and-slay-review), [Gideon's Gaming](https://gideonsgaming.com/rack-and-slay-review/), [TheSixthAxis](https://www.thesixthaxis.com/2024/07/19/rack-and-slay-review/) 【要約のみ】
- Ball x Pit(Arkanoid型+Vampire Survivors+街づくり。2025-10、Kenny Sun、Devolver): ボール融合・進化。各ステージ末にボス、道中はミニボス。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Ball_x_Pit) 【本文確認】
- Ball x Pit批判: 最大の弱点は反復(GamesRadar見出し、AV Club最厳しい)。ステージ8つで同じ光景を再訪(NicheGamer)。ボスは各自のメカニクスで多様と好評(Fullcleared)。難度は評が割れる(「簡単すぎる」vs街づくり前は「理不尽」)。最終ボスまで17分のランの報告あり。 — [GamesRadar](https://www.gamesradar.com/games/roguelike/ball-x-pit-review), [Siliconera](https://www.siliconera.com/review-ball-x-pit-combines-breakout-and-vampire-survivors/), [Bonus Action](https://bonus-action.com/games/ball-x-pit-review/) 【要約のみ】
- Ballionaire: 「RNGが一日を台無しにしやすい。PachinkoとPeggleに強く依存」「ランダムなTribulationが周回を妨げる」(Siliconera)。 — [Siliconera](https://www.siliconera.com/?p=1071154), [GodIsAGeek](https://godisageek.com/reviews/ballionaire-review/) 【要約のみ】
- Zombie Rollerz: 概ね好意的だが「運に頼る場面がある」「純ピンボールとしては物足りない」「難度バランス不満」(集約サイト)。 — [GeekyHobbies](https://www.geekyhobbies.com/zombie-rollerz-pinball-heroes-nintendo-switch-video-game-review/), [Third Coast Review](https://thirdcoastreview.com/2022/03/03/review-zombie-rollerz-pinball-heroes) 【要約のみ】
- Pinball Spire / Dungeon Clawler: 運・操作性批判は検索で見つからず(Dungeon Clawlerは Steam 89%好評/3,740件との掲載のみ)。 — [Nodal](https://nodal.gg/game/pinball-spire-2601940) 【要約のみ】
- Flick Shot Rogues(Butter by the Fish/Noodlecake、2025-09-17): 英雄を弾いて盤面を回るダンジョン探索。反射と連鎖爆発が魅力、レリック/タレント/呪いでラン形成。プレイ時間平均約19時間との掲載。「Peglin的」と評される。最もはじきバトル案に近い現代の先行例だが、ここで得た情報は紹介記事レベル。 — [TurnBasedLovers](https://turnbasedlovers.com/overview/flick-shot-rogues/), [Noodlecake](https://noodlecake.com/flick-shot-rogues-is-out-now/) 【要約のみ】
- Critter Crossfire(1人開発、2025-07-10 Steam): 命中率%を廃し衝突と運動量だけで解決する戦術ローグライト。アイテム100超との記載(未検証)。 — [FinalBoss](https://finalboss.io/critter-crossfire-drops-rng-for-physics-why-this) 【要約のみ】
- Kirby's Dream Course(1994 SNES、HAL): 力・角度・スピンを決めKirbyを打ち出しミニゴルフ式に敵を倒す。敵に当たってコピー能力を獲得(=当てた相手で効果が変わる)。多人数はターン制で星を奪い合い、能力で相手の手番を飛ばせる。評価は独自性・ばかばかしさ好評、一部が高難度と操作を批判。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Kirby%27s_Dream_Course) 【本文確認】
- Odama(GameCube、2006): フリッパーで巨大玉を弾き、兵士を声で指示する戦術+ピンボール。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Odama) 【本文確認】(評判の記述は取得できず)
- Devil's Crush(1990、Compile): 3画面高の盤面、ナッジ(台揺らし)あり、やりすぎるとTILT。Genesis版はクリア後に小さな台でボス戦。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Devil%27s_Crush) 【本文確認】
- Wizorb(2011、Tribute Games): Breakout+RPG(街の再建、ミニボス/ボス)。プレイヤーが魔法でボールを制御できる。評価は好意的。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Wizorb) 【本文確認】
- Puchi Carat、Holedown、Nubby's Number Factory、Creature in the Well、Pinball Spire詳細: 今回は信頼できる情報を取得できず(Gaps参照)。

### Inferences
- 「入力が少ない物理系は評価の矛先が運と反復に向かう」が横断的パターン。はじきバトルは毎ターンの「誰を・どこへ・どの強さで」という選択が入るため、Peglin型より主体性は高くなりうるが、それを裏付ける直接の評価データは今回得られていない。
- Roundguardの「物理は体感優先で嘘をつく」「スキルのコストを暗算可能に単純化」は、はじきバトルの重さ/形状パラメータや連鎖スキルの設計に転用できる示唆。

### Gaps
- Peglin開発者のランダム性・照準に関する一次インタビューは見つからず。
- Puchi Carat/Holedown/Nubby's/Creature in the Well/Rollerdrome は未調査。
- Flick Shot Rogues・Critter Crossfireの「運/制御」に関するユーザー評(Steam)は遮断で未取得。ここが最重要の未解決点。

## 2. 「ビルドが効く」vs「狙いが効く」vs「物理は混沌」: 開発者の発言・照準プレビュー

### Takeaway
開発者側の証言は断片的。共通するのは(a)見えない補正は露見すると興ざめ、(b)照準ガイドは実シミュレーションと同一にして「嘘をつかない」べき、(c)スキルが早期に頭打ちになるとビルド/メタが勝敗を決め、操作は薄れる、の3点。

### Cited Findings
- Peggle開発者Jason Kapalka: 「幸運バウンス」(死にゾーンに落ちず的ペグに当てる補正)は控えめに使用、最初の約6ステージには多めに運を加えて挫折を防ぐ。一方、プレイヤーは補正のない所にまで操作パターンを感じ取り「不正だ」と主張しがち。Riotのサイドサンティは「疑似ランダムを意識された瞬間、幸運の喜びが損なわれる」と述べる(Nautilus記事の紹介)。 — [Game Developer(2017-01-12)](https://gamedeveloper.com/design/how-and-why-game-devs-manipulate-luck-in-games-like-i-peggle-i-) 【本文確認】(原典Nautilusは未確認)
- Roundguard: 物理定数(重力・質量・反発)の調整が最大の課題の一つで、時間を0.9倍速に落とす等、挙動を「期待」に合わせた。 — [Game Developer(2020)](https://gamedeveloper.com/design/the-design-of-i-peggle-i--like-dungeon-crawler-i-roundguard-i-) 【本文確認】
- Ball x Pit開発者Kenny Sun: スキルカーブは早く頭打ちになり、習熟後に上達余地が少ない(一部は意図的)。照準は少なく、自動化建物で放置寄りに。Kotaku別記事は「勝敗が瞬間瞬間の技量と無関係に見える」と書く。 — [Gamefile](https://www.gamefile.news/p/ball-x-pit-x-interview), [Kotaku](https://kotaku.com/ball-x-pit-vampire-survivors-balatro-roguelike-2000642155) 【要約のみ】(引用の正確な文言は未確認)
- 決定論的な照準線: Godotフォーラムの開発者投稿は、点線の照準を本番と同じ固定ステップのシミュで描き「ガイドは決して嘘をつかない」ようにし、保存もリプレイで再現、ボットで盤面検証もできると説明(インタビューではなく開発者の技術メモ)。 — [Godot Forum](https://forum.godotengine.org/t/peg-drop-physics-in-gdscript-a-fixed-step-sim-an-aim-guide-that-never-lies-and-saves-that-replay-exactly/146405) 【要約のみ】
- Critter Crossfire: 隠れたダイスを廃し決定論的物理にすることで「結果がプレイヤーの選択に依存する」ようにしたとの主張。 — [FinalBoss](https://finalboss.io/critter-crossfire-drops-rng-for-physics-why-this) 【要約のみ】
- itch.io上の物理ローグライトのレビューでは軌道表示(予測線)の要望が多いとの要約(個別投稿は未確認)。 — [itch.io posts](https://itch.io/post/13529510) 【要約のみ】

### Inferences
- 照準プレビューの長さは今回、定量的な業界データを得られなかった。「プレビューを実物と同一シミュレーションにする」「プレビューを短く(最初の1~2回のバウンドまで)して残りの混沌を残す」は設計上の選択肢だが、後者を支持する一次証言は未発見(推測)。
- 隠れた補正(幸運バウンス型)は、露見すると信頼を損なう。はじきバトルで救済を入れるなら、ルールとして明示する方が安全(Kapalka/Sottosantiの発言からの推論)。

### Gaps
- GDC講演(Peggle等)の中身、照準プレビュー長のA/Bデータ、「運と技量の比率」を数値化した資料は見つからず。

## 3. 卓上フリック遊戯・民間遊戯のルール(手番・場外・再配置・先手有利対策・重さ差)

### Takeaway
実物のはじき遊びは「場外=失点/ファウル」「ミスの罰則(出した駒を取り除く)」「手番連続の上限」「隠れ防止ルール」など、先手・守り有利を抑える規則を発達させてきた。軽重の扱いは遊び場ごとのローカルルールで、重い駒は反則化されやすい傾向。

### Cited Findings
- Crokinole: 円盤をはじき、敵駒がある間は必ず接触しないとファウル(撃った円盤と動いた自駒を除去)。敵駒がなければ中央へ撃つ(「隠れ禁止」: 守りの隠れ待ちを防ぐ)。場外はガター。各12枚使い切って得点。粉ワックスの是非で論争。ムスコカ変種は接触義務なし。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Crokinole) 【本文確認】
- Carrom: 勝者のトスで先攻(オープニングブレイク)、先攻側が白。得点できないと手番喪失。入れたら連続して打てる(全部入れ切り相手に手番が回らない可能性あり)。ファウルで駒を戻す、ストライカーを落とすと罰則、女王は「カバー」しないと戻る。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Carrom) 【本文確認】
- Subbuteo: 手番は「ボールに触れ、かつ相手に当たらない限り」継続、同一駒は3連続フリックまで。駒の底の重りで重さが性能に影響。歴史的に重い鉛台座→軽量化、1980年に「ゾンビ」型が不評で軽量型に置換。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Subbuteo) 【本文確認】
- おはじき: 当てた玉を獲得する方式が一般的、区画内に入れる/区画外に出す遊びもあり、地方ごとに細則が違う。奈良時代に中国から伝来とされる。 — [ja.wikipedia](https://ja.wikipedia.org/wiki/%E3%81%8A%E3%81%AF%E3%81%98%E3%81%8D) 【本文確認】
- 消しゴム落とし: アプリ版の説明では、相手を机から落とせば勝ち、両者落ちれば攻撃側の負け。実物は交互手番が主流(Impress Watchレビュー)。ある筆者は、学校で最強消しゴムを求めて30cm超の消しゴムやビー玉入り練り消しが現れ、ローカルルールで制限されたと回想(重量差が勝敗を左右し重い物が反則化)。アプリ版はパーツ数・大きさに制限。先手有利/不利の言及は見つからず。 — [Impress Watch](https://forest.watch.impress.co.jp/docs/review/20100304_352505.html), [App Store](https://apps.apple.com/jp/app/id948089675) 【要約のみ】
- Catacombs(Elzra): 1人がオーバーロード(ボス担当)、最大4人が英雄。英雄が全員フリックしてからオーバーロードが手下をフリックして反撃。オーバーロードがダンジョンとボスを設定。批判: オーバーロードの権限が強く勝敗やテンポを左右できる(でも別レビューは「バランスはちょうど良い」)。フリックの難しさへの不満は見つからず、「技量はあるが苛立つほどではない」との評。 — [therewillbe.games](https://therewillbe.games/boardgames/5215-catacombs-3rd-edition), [BoardGameQuest](https://www.boardgamequest.com/catacombs-third-edition-review/), [boardgaming.com](https://boardgaming.com/games/board-games/catacombs) 【要約のみ】
- Ice Cool: 2~4人、全員が交代でハモニ(監視役)を務める総当たり。技量差は得点カードのばらつきで相殺され勝者が読みにくい、1回が短い。Flick 'em Up!は「ルールの層が多く、シナリオが弱い」との批判。Kabuto Sumoは小箱の珍品として評価。PitchCarの批判は見つからず。 — [Zatu](https://zatu.com/en-us/blogs/reviews/ice-cool-review) 【要約のみ】
- ベイブレード/めんこ/ペケ(ベイ)の規則: ベイブレードja.wikipediaは取得できたが今回精読せず。めんこは取得失敗。 — 未確認

### Inferences
- 先手有利対策として実物は「手番連続の制限(Subbuteo)」「接触義務(Crokinole)」「ファウルで駒を戻す(Carrom)」「同時落ちは攻撃側の負け(消しゴム)」を使う。はじきバトルでも「自駒が同時に場外に出たら撃った側にペナルティ」のような非対称ルールの根拠として使える(推論)。
- Catacombsは「ゲームマスター側の裁量が勝敗を左右する」点が批判される。一人用でAI/ボス側の動きを固定・予告する設計(敵カウントダウンと範囲予告)は、この問題を避ける方向。
- 重さ差は昔から不正の温床になりやすく、一人用なら重さを「ステータス」として公開数値にできる。

### Gaps
- Kabuto Sumoの具体ルール、Flick 'em Up!の詳細、PitchCar公式ルール、メンコ/ベイブレードの勝敗規則は未取得。BGGが遮断で、先手有利・ダウンタイムに関する一次的な不満は確認できず。

## 4. ビデオゲームにおける場外(リングアウト)勝利条件: 公平感と救済

### Takeaway
場外は「蓄積ダメージで吹き飛びやすくなる」(Smash式)が定番だが、遅れている側の復帰がしにくい点は議論される。復帰/救済のレバーは「再出撃」「連続KOで復帰時間延長」「短いラウンドと即再戦」など。

### Cited Findings
- Smash: ダメージ%が上がるほど吹っ飛びが大きくなる。Sakurai自身の解説動画(GoNintendo紹介)や、Kirbyの吹き飛ばし機構が着想源との報道(Shacknews)。「高%側は復帰が難しい」というフォーラムの見解(コミュニティ意見)、シールドの回復が速いことなどが緩和策。Rageは高%で攻撃力を上げる救済的要素。公平性に関するSakurai本人の意図は見つからず。 — [SmashWiki Launch](https://www.ssbwiki.com/Launch), [Shacknews](https://shacknews.com/article/135315/sakurai-details-how-kirby-gameplay-inspired-smash-knockback-mechanic), [Smashboards](https://smashboards.com/threads/comeback-mechanisms-in-fighting-games.454898/) 【要約のみ】
- Kirby Battle Royale: 2度目のKOでは復帰に長くかかる(エスカレートする罰)。ミニゲーム系は短い脱落ラウンドと即再戦(Plushie Party)。Ring-Out Rumbleは%のみ・ルール1つで簡素。 — [Wikirby](https://wikirby.com/wiki/Battle_Arena), [Ring-Out Rumble](https://songkran13.itch.io/ring-out-rumble) 【要約のみ】
- Kirby's Dream Courseの多人数: 能力で相手の手番を飛ばせる(はじき×妨害の先例)。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Kirby%27s_Dream_Course) 【本文確認】

### Inferences
- 一人用はじきバトルでは「味方が場外=戦闘不能」が最大の理不尽感の源になりうる。Smash式の%蓄積ではなく、場外直前の予告(縁の警告表示)や「1回は復帰できる」ルールが救済候補(推論、実証データなし)。

### Gaps
- Smash以外の相撲系ゲームの公平性評価、アンチフラストレーション設計の一次資料は未取得。

## 5. 物理ゲームのボス設計(盤面・ルールを変える)と評価

### Takeaway
ボスは盤面/ルールを変える方向が一般的で、Ball x Pitでは「各ボスが固有メカニクス」と好評。ただし難度の山(最初のボスが強すぎる)も指摘される。

### Cited Findings
- Ball x Pit: 各ステージ末にボス、ミニボスあり。ボスごとにメカニクスが異なると好評。最初のボスSkeleton Kingは街づくり未発達だと熟練者でも歯が立たず「残念」との評。 — [Fullcleared](https://fullcleared.com/reviews/ball-x-pit-review/), [Siliconera](https://www.siliconera.com/review-ball-x-pit-combines-breakout-and-vampire-survivors/) 【要約のみ】
- Peglin: 各ステージ末のボス、全体的に難度が高い敵と記述。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Peglin) 【本文確認】
- Devil's Crush Genesis版: クリア後、小さな台でボスと手下との戦い。 — [Wikipedia](https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Devil%27s_Crush) 【本文確認】
- Catacombs: ボスはオーバーロードが選び、最終部屋で倒す。 — [boardgaming.com](https://boardgaming.com/games/board-games/catacombs) 【要約のみ】

### Inferences
- 吸引・回転床・角度が要るシールドなどの具体例と評価は今回の取得範囲では確認できておらず、この点は一般論としては断言できない。

### Gaps
- 吸引/回転/移動標的ボスの個別レビューは未取得。

## 6. 1戦・ショット数・セッション長、長期の反復疲労

### Takeaway
定量データは乏しい。1ラン約30分(Rack and Slay)、ボス到達17分の報告(Ball x Pit)程度。反復は全作で最頻の批判。

### Cited Findings
- Rack and Slay: 1ランは通常30分以内、クリア約3時間(約$5.99の小作品)。 — [Gideon's Gaming](https://gideonsgaming.com/rack-and-slay-review/), [Game8](https://game8.co/articles/reviews/rack-and-slay-review) 【要約のみ】
- Ball x Pit: 最終ボスまで17分のランの報告。反復が最大の弱点。ステージ数8。 — [Bonus Action](https://bonus-action.com/games/ball-x-pit-review/), [GamesRadar](https://www.gamesradar.com/games/roguelike/ball-x-pit-review) 【要約のみ】
- Flick Shot Rogues: 平均プレイ時間約19時間(掲載値)。 — [GameBrain](https://gamebrain.co/game/flick-shot-rogues) 【要約のみ】
- Ice Cool: 1ゲーム10~12手と短い(ブログ)。 — [Zatu](https://zatu.com/en-us/blogs/reviews/ice-cool-review) 【要約のみ】
- Peglin: ペグ盤面の繰り返しが不満(上記)。 — 【要約のみ】

### Inferences
- 「1戦あたりのショット数」は検索範囲で数値が得られなかった。携帯向け1戦の長さの基準は、参考値として1ラン30分程度が下限寄りという程度しか言えない。

### Gaps
- 戦闘1回あたりのショット数、ターン数、Steam上の離脱/反復疲労を示す数値は未取得。
