# 戦闘システム設計理論リサーチ(短時間戦闘・低入力・ボス戦ペース配分)

## 調査上の制約(必ず先に読むこと)
- この環境では WebFetch が許可ドメイン外で全滅した(gamedeveloper.com / pcgamer.com / zenofdesign.com 等が名前解決不可)。そのため **一次資料の本文は1本も読めていない**。以下の「Cited Findings」はすべて WebSearch が返した要約(検索結果スニペット相当)に基づく二次情報である。
- 検索結果の要約自体が「二次資料」「未確認」と注記している箇所は、その注記ごと転記した。
- 一次資料(GDC Vault の Meier 講演、Burgun の著書、Cook の Lost Garden 原典、Yano/Davis の GDC 講演など)の本文は未確認。gamedeveloper.com 等を許可すれば再調査できる。
- 数値(戦闘時間の分数・1分あたり決定数など)の裏付けは**ほぼ得られなかった**。Gaps に明記。

---

## 1. 「面白い戦闘判断」とは何か(Meier、Burgun、Cook、明瞭性・テレグラフ)

### Takeaway
広く共有された原則は「ゲームは興味深い決定の連続」(Meier)で、決定が「システム内で結果に響く」ことが要点(Burgun)。情報の可視化(敵の次の行動を見せる)が決定の質を上げる実例として Slay the Spire / Into the Breach が挙がる。ただし本セッションでは原典本文を読めておらず、すべて二次要約。

### Cited Findings
- Meier の GDC 2012 講演「Interesting Decisions」は、1989年頃に彼が口にした「A game is a series of interesting decisions」を出発点にした。言い回し(decisions/choices)は資料により揺れる。 — [Game Developer: GDC 2012 Sid Meier](https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions) / [GDC Vault](https://gdcvault.com/play/1015756/Interesting)(検索要約のみ、本文未読)
- ある要約は Meier の挙げる「興味深い選択」の4性質を「トレードオフ・状況依存・個人的・持続的(persistent)」としている。 — [Game Developer(上記と同記事の検索要約)](https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions) ※4性質の出典が当該記事か別の要約かは未確認。単一要約者の整理として扱うこと。
- Meier は講演内でパズル/リズムゲームのように一見決定がなさそうなジャンルにも触れた。 — [Escapist: GDC 2012 Sid Meier sees interesting decisions even in rhythm games](https://www.escapistmagazine.com/v2/gdc-2012-sid-meier-sees-interesting-decisions-even-in-rhythm-games/)
- Keith Burgun の立場: 良いゲームの決定は「興味深く、難しく、より良い答えが曖昧」であり、「意味がある(meaningful)」とは決定がゲーム内システムで反響し最終結果に関わること。Guitar Hero は決定がほぼ無く「ゲームというよりコンテスト」と評する(Burgun 個人の強い定義であり、広く合意された見解ではない)。 — [検索要約(Burgun関連、Game Developer "What makes a game" 等)](https://gamedeveloper.com/design/what-makes-a-game-)
- Daniel Cook の Loops and Arcs: ループ=行動→反応の反復でマスタリーを作る、アーク=一度きりの意味/感情の展開。「ループ-アークのサンドイッチ」構造。アークは繰り返すと燃え尽きやすく、アークの連なりで対処する、という整理がある。いずれも学生ノート等の二次要約で、Cook 原典は Lost Garden(lostgarden.com)とされるが未読。 — [mechanicsofmagic sketchnote](https://mechanicsofmagic.com/2026/05/13/sketchnote-loops-arcs-49/) / [Advanced Game Design 第7章](https://www.oreilly.com/library/view/advanced-game-design/9780134668185/ch7.xhtml)
- 敵の「意図(intent)」アイコンの導入が Slay the Spire を成立させた鍵だったとする Yano 講演のメモ。複数敵戦で敵を逐一クリックして確認するのが煩雑だったことが理由。続編 StS2 はさらに情報を開示している。 — [lilys.ai の講演メモ(自動要約的、二次)](https://lilys.ai/notes/1046045) / [StS2 敵意図ガイド](https://sts2.untapped.gg/guides/how-to-read-enemy-intent) / [Game Developer: Yano 講演告知](https://gamedeveloper.com/game-platforms/watch-casey-yano-break-down-the-design-decisions-behind-i-slay-the-spire-i-)
- Into the Breach: 開発チームが当初計画の約6割を削った時が「ひらめき」に最も近かったと報じられる(都市建設・複数部隊などを削除)。「戦術の選択肢が常に明白、規則が一貫」という記述もあるが出典不明の要約で、GDC 講演(登壇者は Matthew Davis と記載)の内容と確認できていない。 — [PC Gamer](https://www.pcgamer.com/into-the-breach-originally-had-city-building-and-tech-trees-creators-reveal) / [GDC Vault 'Into the Breach' Design Postmortem](https://www.gdcvault.com/play/1026333/contactUs)

### Inferences
- 低入力ゲームでは「入力回数」でなく「1回の決定の重さ(トレードオフ・結果の反響)」を設計対象にする、というのが Meier/Burgun 双方と整合する。
- 敵の次行動を事前に見せる(intent)ことは、決定を「情報が足りる状態」にする最も実績ある手段で、事前配置型の本作では「敵の編成・次ラウンドの予告」の事前開示に相当しうる。

### Gaps
- Meier 講演の本文、Burgun の著書原典、Cook の Lost Garden 原典、Raph Koster、Extra Credits、Game Maker's Toolkit(ボス戦回など)は本文を確認できなかった。GMTK のボス戦動画は検索でヒットすらしなかった。
- 「juice/フィードバック」「直交的ユニット設計」「支配戦略回避」の一次資料は未取得。
- 日本語のバトルデザイン一次資料(CEDEC 等)は、検索で観戦・オートバトルに直接触れたものが見つからなかった(Gaps は質問5にも共通)。

---

## 2. 戦闘が退屈になる文書化された原因

### Takeaway
RPG 制作コミュニティの定番指摘は「通常攻撃連打が最適解になる」「敵が単調(通常攻撃+回復だけ)」「予告のない脅威」「戦闘が長すぎる/報酬がない」。これらはフォーラム/コミュニティ記事レベルで、形式的な研究ではない。

### Cited Findings
- 戦闘が「敵を殴って必要に応じ回復するだけ」に落ちるのが退屈の核、という記事。 — [rpgmaker.net: Things That Make Combat Boring + Solutions](https://rpgmaker.net/articles/1147)
- 敵が通常攻撃・単一属性魔法・回復しか持たないことが多く、テレグラフされた脅威がなければ戦略は「早く倒す+回復で相殺」に収束する。 — [rpgmaker.net: Proper Enemy Design I](https://www.rpgmaker.net/articles/279)
- ボスの行動が乱数任せより、読める攻撃サイクルの方が有用。 — [rpgmaker.net: Using Enemy Attack Patterns](https://www.rpgmaker.net/articles/698)
- 複雑なスキル回しでも、大半の相手に最適解が同じなら退屈になる。最適戦略は遭遇ごとに変わるべき、という意見(フォーラム単独意見)。多くの修正案は「1手連打」を「2〜3手連打」にするだけ、という批判も。 — [rpgmaker.net フォーラム: Button Mash](https://rpgmaker.net/forums/topics/8542/?p=3) / [rpgmaker.net 検索結果群](https://rpgmaker.net/forums/topics/21446)
- 戦闘が長すぎる、報酬がないと「逃げる」連打になる、という実作者の注意。 — [rpgmaker.net Tips for Making Battles Interesting](https://rpgmaker.net/forums/topics/12103)
- 退屈の例: 戦闘が似通って予測可能で惰性になる/弱すぎて脅威にならない/ランダム遭遇の頻度が高すぎて探索が中断される/Xenosaga II で戦闘が長く方向を忘れる/Persona で戦闘後の自動回復が戦略を奪う、との不満。 — [検索結果群: Witcher 3 批判](https://pcgamesn.com/the-witcher-3-wild-hunt/over-100-hours-later-the-witcher-3s-battles-are-tiring-me-out) / [Random encounters, less is more](https://matthewmarchitto.substack.com/p/random-encounters-less-is-more)(いずれも個人意見)
- 現代 JRPG の対策例: Metaphor: ReFantazio のバトル企画 Goto 氏は、日本の RPG プレイヤーは死亡時に「時間を無駄にした」感覚に非常に敏感と述べ、頻繁なオートセーブ・バトル即リスタートで対処。弱い敵はフィールド上でリアルタイムに即倒し、強敵だけターン制にする。初期案は SMT3 風の過酷さだったが論理的に妥当な範囲へ緩和。 — [Push Square](https://pushsquare.com/news/2025/03/rpg-fans-very-sensitive-to-feeling-like-they-wasted-time-says-atlus-battle-designer) / [PC Gamer](https://www.pcgamer.com/games/rpg/todays-rpg-fans-are-very-sensitive-to-feeling-like-they-wasted-time-when-they-die-says-metaphor-refantazio-battle-planner-but-atlus-still-made-combat-hard-anyway) / [GamingBolt](https://gamingbolt.com/?p=573491)
- 旧来のボス戦は決まった攻撃パターンを順にこなすだけで対話に乏しい、という指摘(GamesRadar)。 — [GamesRadar: 7 golden rules for a better boss fight](https://gamesradar.com/7-golden-rules-for-building-a-better-boss-fight-in-2016)

### Inferences
- 通常戦(約90秒)の最大の敵は「所要時間に見合う決定がない」状態。Metaphor の「弱敵は即決着・強敵だけ本戦」は、雑魚戦を省略/短縮して決定密度を保つ前例として利用できる。
- 「勝敗が序盤で決まる(mop-up phase)」「ダメージスポンジ」「偽の選択」「過剰なRNG」「長い演出」については、今回の検索で一次的な裏付けを得られなかった。

### Gaps
- mop-up phase(決着後の消化試合)、false choice、excessive RNG、long animations の出典は未取得(自分の背景知識としては知られた論点だが、出典を示せないため断定しない)。
- 日本語の「戦闘が退屈になる原因」の体系的な記事は見つからなかった。

---

## 3. 戦闘時間・ペース配分・ボス戦構造

### Takeaway
「何分が理想か」を示す信頼できる数値は見つからなかった。ボス戦構造については、テレグラフ→反応→報酬、HP閾値によるフェーズ移行(75%/50%等の提案)、フェーズ移行を「イベント」にする、といった実務ガイド(質のばらつく二次記事)が得られた。

### Cited Findings
- 「ターン制戦闘の標準的な長さ(分)/TTK の基準値」は検索で見つからなかった(検索ツール自身が「標準的ベンチマークは見つからない」と報告)。 — [検索結果群](https://gameanalytics.com/?p=2931)(関連記事が出ただけで、数値は未確認)
- テレグラフ設計: 重要なボス技には「予告・反応窓・見返り」があり、予告の長さは危険度に比例させる。死亡リプレイを見て「何をすべきだったか分かる」なら予告は機能、「どうやって知れと?」なら失敗、というテスト。プレイテストで理由なく被弾するなら予告を長くする。 — [Wayline: Crafting Legendary Boss Battles](https://www.wayline.io/blog/crafting-legendary-boss-battles) / [Ziva boss fight generator](https://ziva.sh/tools/boss-fight-idea-generator)(実務ブログ/ツールページで信頼性は中〜低)
- フェーズ構成の一案: HP約75%で新メカニクス1つ、50%でより大きな変化(新アリーナ・技セット)。各フェーズは「適応できるだけ長く、だれない長さ」に。HP閾値だけのフェーズは盛り上がりの弧に欠ける、という指摘。 — [salt-and-steel boss design](https://salt-and-steel.pages.dev/docs/15/boss-design) / [bugnet.io: multi-phase boss](https://bugnet.io/blog/how-to-design-a-multi-phase-boss-fight)
- 序盤ボスにはスタッガー(体勢崩し)の機会を複数・明確に与え、成功を報いる(Black Myth: Wukong 分析)。 — [uxdesign.cc: Wandering Wight](https://uxdesign.cc/how-to-design-an-early-boss-fight-wandering-wight-boss-in-black-myth-wukong-6ec8408d06e0)
- ボスは通常戦の延長でなく「試験/試練」として、ゲームのメカニクスを試し、通常戦と違う手触りにすべき(Halo のボスが「ただの通常戦」で凡庸という批判)。 — [PC Gamer: How to make a great boss fight](https://www.pcgamer.com/how-to-make-a-great-boss-fight) / [Game Developer: 3 Elements That Every Great Boss Fight Needs](https://www.gamedeveloper.com/design/3-elements-that-every-great-boss-fight-needs)(要旨は検索要約のみ)
- 日本語: ゲームデザイナーによるボスの役割・面白さの構造解説(Automaton コラム)。フェーズ設計の詳細は本文未確認。 — [Automaton](https://automaton-media.com/articles/columnjp/nununu-20260830-464035/)
- ボス戦はテンション→適応→解放の循環という説明(信頼性低めの記事)。 — [Contra](https://contra.com/p/YkEmQBmZ-the-psychology-of-boss-battles-why-we-love-the-struggle)

### Inferences
- 7分ボスを「1フェーズ=約2分×3〜4」に割り、各フェーズ頭で新ギミック提示、中盤で変化、終盤で総合試験とする設計は上記ガイドと整合するが、7分という数値自体の根拠は取れていない。
- enrage タイマー、コメバック機構、「オープニング/転換点/クライマックス」の戦闘内ペース曲線は、今回確認できた出典がごく薄い(enrage は Roblox 解説の1行のみ)。

### Gaps
- 1分あたりの意味ある決定数、各ゲームの実戦闘時間、TTK 概念の原典は未取得。
- enrage、break/stagger ゲージの設計論の一次資料、Death's Gambit ボス設計記事(https://gamedeveloper.com/design/die-die-die-boss-battle-design-in-i-death-s-gambit-i-)は検索に出たが未読。

---

## 4. 低入力・オート戦闘で「関与感」を与える方式

### Takeaway
最も明確に得られた証拠は「準備フェーズが本体、戦闘は見せ場」というオートバトラーの構造(Super Auto Pets / Backpack Battles / The Bazaar)と、FF12 ガンビットの「ゲームが勝手にやる」批判と「設定という作業に重心が移る」反論。方式別の好悪を示す定量データは得られず。

### Cited Findings
- オートバトラーは準備(購入・配置)と観戦のセットで、戦闘中は直接操作なし。楽しみは構築側にあり戦闘は報酬。 — [PC Gamer: autobattler 概観](https://www.pcgamer.com/games/strategy/from-competitive-inventory-rearranging-with-cheese-eating-slimes-to-roguelike-pokemon-combat-the-autobattler-genre-is-more-alive-than-everand-theres-never-been-a-better-time-to-jump-in)
- Backpack Battles は配置が購入と同じくらい重要、試合が速くチュートリアル不要と評される。Super Auto Pets は同一プールからのドラフト力で勝つ公平感。多くのオートバトラーは運ゲーに見えるが、The Bazaar は技量の披露に見える、という評者もいる(単一評者の意見)。 — [PC Gamer: Backpack Battles](https://pcgamer.com/games/action/steams-latest-breakout-indie-hit-is-a-fantasy-autobattler-about-how-many-magic-items-you-can-fit-in-your-backpack) / [vaporlens: Backpack Battles](https://vaporlens.app/app/2427700/backpack_battles)
- TFT は Auto Chess から、8x8 盤を 7x6 の六角盤に、プレイヤー軍同士の直接対戦へ変更。設計の柱は mastery / playful competition / discovery。 — [TFT dev: design pillars](https://teamfighttactics.leagueoflegends.com/en-au/news/dev/dev-design-pillars-of-tft/) / [検索要約: usgamer 等](https://www.usgamer.net/articles/we-played-teamfight-tactics-riots-new-auto-chess-and-its-looking-like-a-real-competitor)
- TFT は RNG(運)への不満が指摘される(PC Gamer)。 — [PC Gamer: TFT basic overview](https://www.pcgamer.com/teamfight-tactics-basic-overview/)
- FF12 ガンビット: 「うまく設定するとゲームが勝手にプレイする」批判、「作業が設定に移るだけで主体性は失われない」反論(レビュー・ブログ・ユーザーレビューの意見で、形式的分析ではない)。 — [GamesRadar](https://www.gamesradar.com/final-fantasy-xii-review/2/) / [Slant](https://www.slantmagazine.com/games/final-fantasy-xii-the-zodiac-age/) / [Push Square](https://www.pushsquare.com/news/2017/07/hands_on_final_fantasy_xii_on_ps4_is_a_strong_reminder_of_how_great_the_series_used_to_be)
- Metaphor の「弱敵即倒+強敵のみターン制」は、入力を戦闘の重要度に比例させる例。 — [Push Square](https://pushsquare.com/news/2025/03/rpg-fans-very-sensitive-to-feeling-like-they-wasted-time-says-atlus-battle-designer)

### Inferences
- 本作(4体配置+戦術選択→オート)は、オートバトラー型(準備が本体)に属する。退屈の原因が「準備の決定が浅い」か「結果が見えて意味を感じない」かの切り分けが先決。
- 単一介入リソース、一時停止コマンド、予測/賭け、ラウンド間イベントといった方式の好悪は、今回の検索では出典を得られなかったため推奨はできない。

### Gaps
- pre-battle planning / 介入リソース / pause-and-command / 予測・賭け / ラウンド間選択イベントの個別評価データは未取得(Dragon Age、Darkest Dungeon、Slay the Spire 系などを今後の調査候補とする)。
- ガンビットの実装論、開発者側の意図は見つからず。

---

## 5. オート戦闘を「見て面白く・分かりやすく」する方法

### Takeaway
今回の検索では、観戦性(予兆・ビルド発動の可視化・接戦調整・ハイライト・戦後内訳)を扱った信頼できる出典はほぼ得られなかった。得られたのは、敵意図の可視化(Slay the Spire)とテレグラフの検証テスト、およびオートバトラーの「相手の編成を見る」慣行のみ。

### Cited Findings
- 敵の次行動アイコンは、情報を一目で読める形にして決定を成立させた(質問1参照)。 — [lilys.ai メモ](https://lilys.ai/notes/1046045)
- テレグラフの検証法「死亡リプレイを見て何をすべきだったか分かるか」は、オート戦闘の結果の読解性テストにも転用可能な基準。 — [Wayline](https://www.wayline.io/blog/crafting-legendary-boss-battles)
- オートバトラーでは他プレイヤーの編成・位置を見るのが定石。 — [Den of Geek](https://www.denofgeek.com/games/how-to-play-auto-chess-guide-teamfight-tactics-dota-underlords-tips/)
- データ駆動で演出を量産する CEDEC(2026)の Granblue Fantasy: Relink 講演(アルティメットスキルを3段階で全28体中25体が共通形式)。操作型アクションの話だが、演出の制作効率の参考にはなる。 — [Inven Global](https://www.invenglobal.com/articles/24043/endless-ragnarok-battle-and-game-design-philosophy-for-character-driven-games)

### Inferences
- 「プレイヤー自身のビルド決定が発動した瞬間を見せる(スキル名・シナジーのポップアップ)」「戦後に貢献度の内訳を出す」は設計案として自然だが、本調査では出典がなく、あくまで推論。

### Gaps
- 観戦性・ハイライト・接戦チューニング・戦後ブレークダウンの出典は未取得。TFT の GDC 講演(David Abecassis)、Dota Underlords、Hearthstone Battlegrounds 等が候補。
- 日本語出典(CEDEC / 4Gamer / 電ファミ)で観戦性を扱うものは見つからなかった。

---

## 6. データに裏付けられた知見(戦闘時間・複雑さと満足度/継続率)

### Takeaway
この問いに答える定量データ(プレイテスト指標・リテンション・ポストモーテム統計)は今回得られなかった。

### Cited Findings
- 定量データは見つからず。質的な証言として、Atlus のバトル企画は「RPG プレイヤーは時間を無駄にしたと感じることに敏感」と述べている(統計ではなく設計者の所感)。 — [Push Square](https://pushsquare.com/news/2025/03/rpg-fans-very-sensitive-to-feeling-like-they-wasted-time-says-atlus-battle-designer)
- 「2025年、RPGはもっと速くあるべき」という論説(AV Club)がヒットしたが、本文未読。 — [AV Club](https://www.avclub.com/game-theory-rpgs-faster-quartet)

### Inferences
- 本作のように1戦90秒という短さは、上記の「時間感覚への敏感さ」「戦闘の速さ志向」の流れと方向は整合するが、効果量は示せない。

### Gaps
- GameAnalytics 等のリテンション分析、Slay the Spire / Backpack Battles のテレメトリ、学術 HCI 論文は未調査/未取得。
- gamedeveloper.com / pcgamer.com / automaton-media.com などが取得可能になれば、最優先で読むべき一次資料: Meier GDC 2012、Yano 講演、Into the Breach postmortem、AV Club 記事、Automaton ボス解説コラム、"Designing interesting decisions in games and when not to"(https://www.gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to-)。
