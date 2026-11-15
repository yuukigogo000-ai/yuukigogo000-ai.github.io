# 戦略ゲーム(国盗り/4X)設計理論・批評リサーチ

調査日: 2026-11-15。凡例: 【本文確認】=本文を全文取得して確認。【要約のみ】=検索スニペット/検索要約のみ(未検証、引用前に原典確認)。
【共通認識】=複数の著者が同趣旨を述べる原則、【個人意見】=一人の著者の主張。
取得制約: designer-notes.com / kajsotala.fi / civfanatics / Reddit は取得不可(DNS/ブロック)。これらは検索スニペットのみ。
注意: gamedeveloper.com の記事は本文取得できたが、ページ内の「Nov 2026」等のナビ日付は取得日の表示で記事日付ではない。記事日付は各記事冒頭の日付を使用。

---

## 1. 名前のついた問題(終盤の消化試合/雪だるま/最適解/AIのチート等)と、原典が何を言っているか

### Takeaway
「勝敗は2/3〜3/4地点で決まっているのに、終盤は作業で続く」(Bart Stewart)、「プレイヤーは機会があれば面白さを最適化し尽くす」(Soren Johnson)、「AIは対称ゲームで不可避に弱くなるかチートする」(Johnson)が、このジャンルの三大慢性病として原典が確認できた。Firaxis自身が「Civ VIは完走率50%未満」と公言している。

### Cited Findings

**終盤の消化試合(mop-up)**
- Bart Stewartの診断: 根本原因は「終盤のマイクロ管理」ではなく、戦略というものの性質として「良い戦略は、勝った/負けたと分かるずっと前に勝って/負けている。残りは待つだけで、待つのは楽しくない」。4Xでは2/3〜3/4地点で最終戦略が動き出し、以後は「Next Turn」連打。Civ・MoO2も同病。「それを解決した開発者は私の知る限りいない」と本人が述べる。【本文確認・個人意見(ただし同趣旨は多数)】 — [Five Suggestions for 4X Fun (Game Developer, 2017-05-15)](https://gamedeveloper.com/design/five-suggestions-for-4x-fun)
- 同記事の処方5案: (1)個別ユニットを廃し「提督にこの3拠点を月内に確保せよ」のように目標を委任 (2)頻繁な操作を「この目標を達成/不可能/停止命令までやり続けろ」の継続的選択に (3)人事(指揮官の性格)で個別ユニット操作の代替の面白さを作る (4)敵の戦略が「知覚可能かつもっともらしい」こと (5)**ゲーム自身が勝敗確定を検知し、勝率を表示/「ほぼ決着」と告げ、止める・続ける・数ターンシミュレートを選ばせる**。本人は未実装・未検証と明記。【本文確認・個人意見】 — 同上
- Firaxis側の一次証言: Ed Beach(Civ VI/VIIクリエイティブディレクター)は「Civ VIで1ゲームを完走した人の数は驚くほど、がっかりするほど低かった。50%未満」「平均15〜20時間」「帝国が育つほど管理が増え、1ターンの作業量が指数的に増える」「5〜10分に一度で足りる戦略判断と、『ここをクリック』の連続を仕分けるシステム別ポストモーテムをした」と述べた。対策がCiv VIIの「時代(Age)」: ゲームを3章に分け、章間でマップを再構成し「盤面を少しリセットして単純化しルールも変える」(例: 交易が時代ごとに別仕様)。【本文確認】 — [Firaxis' big swing with Civilization VII (Game Developer, 2024-08-23)](https://gamedeveloper.com/design/firaxis-big-swing-with-civilization-vii-convincing-players-to-actually-finish-their-games)
- Wikipedia(4X項): ターン制4Xは数百ターンに分かれ、反復と長時間のため過剰なマイクロマネジメントを批判される。序盤は問題なく、後半は1ターンに数分かかる。これへの対応として4XはAI総督(governor)による自動化を提供し始めた、と記述。【本文確認・二次情報】 — [4X (Wikipedia)](https://en.wikipedia.org/wiki/4X)
- フォーラムの要約(Sorcerer King/Paradox/CivFanatics)は「複雑さが指数的に増える」「雪だるまで中盤の勝者が終盤の勝者」「ミニゲーム化・マクロ選択+ミクロ自動化」「最終クエストでmop-upを置換(Warlock 2, Eador 2)」等を挙げる。フォーラム発言であり研究ではない。【要約のみ】 — [検索結果: Endgame Predictability (Or: The "Mop-Up" Phase)](https://forums.sorcererking.com/452575/page/1)、[CivFanatics: core of 4X boring endgame problem](https://forums.civfanatics.com/threads/the-core-of-4x-games-boring-endgame-problem-a-short-essay-about-rapidly-increasing-complexity.677400/)
- Kaj Sotala「Fixing the 4X end-game boringness by simulating legibility」(2017): 終盤の退屈の論点を扱う個人ブログ。【要約のみ】 — [kajsotala.fi](https://kajsotala.fi/2017/04/fixing-the-4x-end-game-boringness-by-simulating-legibility/)

**「プレイヤーは面白さを最適化して消す」(boring optimal strategy)**
- 出典の特定: この公理は Soren Johnson の Game Developer コラム「Water Finds a Crack」(2011年6月、designer-notes.com の GD Column 17)が原典(「Given the opportunity, players will optimize the fun out of a game」)。検索結果上で出典は確認できたが原文ページは取得不可。【要約のみ】 — [GD Column 17: Water Finds a Crack](https://www.designer-notes.com/game-developer-column-17-water-finds-a-crack/)
- GDC 2022講演(Old Worldでの再考): 一つの支配的戦略が他をかき消す。Civ 3の交渉テーブルでAIが技術を売り合い、プレイヤーには「技術カルテル」に見えたが、AIは「最適戦略を実行しただけ」。プレイヤーも同じ最適解へ収束し「それは楽しくない」。解決は「全ての行動にコスト(トレードオフ)」。交渉テーブルを廃し、買値が売値の2倍の単純な市場+ランダムイベントに外交を織り込んだ(例: バビロニアと結婚→後年その縁で戦争の陣営選択を迫られる)。Alex Jaffeの「呪われた設計問題」(後述)に該当すると本人が整理。【本文確認(PC Gamer記事)】 — [Soren Johnson says Civ 3's bargaining table was a 'big mistake' (PC Gamer)](https://www.pcgamer.com/soren-johnson-says-civ-3s-bargaining-table-was-a-big-mistake)
- 同講演より: AIが「人間のように」メタゲーム(勝っている人を理由なく袋叩き)をすると、プレイヤーは不公平/キャラらしくないと感じる。プレイヤーが望むのは虚構の文脈に沿った行動であって最適戦略ではない。【本文確認】 — 同上

**AIとチート/対称ゲーム問題**
- Chick Parabola: 好感度が「習得とともに上がり、AIが馬鹿だと露見して下がる」曲線(Tom Chickが2009年Three Moves Aheadで命名)。AIが同じゲームを遊ぶ「対称ゲーム」で顕著。AIは「信頼と裏切り、長期投資、多正面戦争、人間に自明の罠回避」が苦手。→ 設計段階でAIが扱える機構だけを置く。例: Rise of Nationsは陸上部隊が岸に近づくと船に変身し輸送船を廃止、Civ 3/4はグローバルユニット維持・生産オーバーフローでAI管理とプレイヤーのマイクロ管理を同時に削減。Civ 1の核はAIに使わせなかった(終盤の悪ふざけとして)。「AIの不利をチートで埋める」は人間専用機構が増えるほど対称性を壊すので不可。【本文確認】 — [AI Fallibility And The Chick Parabola (Johnson, 2010)](https://www.gamedeveloper.com/game-platforms/analysis-ai-fallibility-and-the-chick-parabola)
- チートの知覚: 「チートか否かは公平の客観基準より人間心理で決まる」「透明性が疑念の解毒剤」。Civの難易度ボーナス(段階的なユニット/建物/技術割引)は漸進的で怒りを買わなかった一方、霧の下で無料ユニット生成・AIへの即時の驚異完成は不公平に感じられた。Civ 1はプレイヤーが1900年までリードすると人間に宣戦する設定で「袋叩き」と受け取られ、Civ 3以降AIは相手が人間かを区別しない。Mario Kartのように「追い上げを明示的な機構にする」と不正に感じられにくい。【本文確認・共通認識に近い】 — [Game AI & Our Cheatin' Hearts (Johnson, 2009)](https://www.gamedeveloper.com/game-platforms/analysis-game-ai-our-cheatin-hearts)
- Jon Shafer(Civ 5): 「AIを人間らしく」を狙い、曖昧で気まぐれな外交は「ランダムで非生産的なノイズ」にしかならなかった。AIはRNG加重で戦略間を漂い一貫性がない。「ゲームで重要なのはプレイヤーの頭の中の体験だけ」。ATGでは「関係値」を数値で明示(-5以下は取引せず、+10なら参戦要請に応じる)、指導者ごとに明確な性格、危機時の要請を満たして好感を稼ぐ設計、AIは単純化して「何をしているか開発者自身が分かる」ようにする。【本文確認・個人意見(ただし透明AI支持は後述の通り多数)】 — [Revisiting the Design of Civ 5 (Shafer, 2013)](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5)
- 同記事: 1UPT(1タイル1ユニット)は戦闘は良くなるが、戦闘AIの難度・マップの渋滞・生産速度を下げざるを得ない副作用(「バケツが満ちるのを待つ」ターン増)があった。【本文確認・個人意見】 — 同上

**雪だるま・暴走するリーダー/フィードバック**
- 用語整理: 正のフィードバック(得た者がさらに得る)、負のフィードバック(サーモスタットのように平衡へ戻す)。負側を強くしすぎると膠着。「下降スパイラル」(負けている側がさらに弱る、Monopoly)の対策: ダメージで性能を落とさない、回復機構を入れる、等。Marc LeBlancのMario Kart例。【本文確認】 — [Designer's Notebook: Preventing the Downward Spiral (Ernest Adams, 2010)](https://www.gamedeveloper.com/design/the-designer-s-notebook-preventing-the-downward-spiral)
- 雪だるまは常に欠陥とは限らない: 勝負がついたゲームを速く終わらせる手段になりうる、「20時間遊んだ後の敗北は体験を壊す」ので終盤に正のスノーボールで破局確率を下げる設計もありうる、ただし「選択の面白いゲームを退屈な作業に変えることが多い」と留保。【本文確認・個人意見】 — [Second Looks At Snowballing (Nikhil Murthy, 2019)](https://www.gamedeveloper.com/design/second-looks-at-snowballing)
- 追い上げの分類(システム型=Power Grid等/社会圧力型=Catan等)と「社会圧力型は真の追い上げではなく先頭への罰」という整理。【要約のみ・個人意見】 — [Catch Me If You Can: The Runaway Leader and Catch-Up Mechanics](https://fantastic-factories.medium.com/catch-me-if-you-can-the-runaway-leader-and-catch-up-mechanics-53f0356c440d)
- Dynamic difficulty(ラバーバンドAI等)の総説。【本文確認・二次情報】 — [Dynamic game difficulty balancing (Wikipedia)](https://en.wikipedia.org/wiki/Dynamic_game_difficulty_balancing)

**キングメイキング(多人数/AI外交)**
- Alex Jaffe(Riot)GDC 2019「Cursed Problems in Game Design」: 「プレイヤー技能を強調したいがFFAのPvPは政治を促し技能を損なう」=キングメイカー問題を、解のない「呪われた問題(目標間の本質的矛盾)」の例に挙げ、4つの設計パラダイムで生き延びる方法を示す。講演要旨のみ取得、スライド/本編は未確認。【本文確認(講演概要)】 — [GDC Vault: Cursed Problems in Game Design](https://gdcvault.com/play/1025756/Cursed-Problems-in-Game)
- ※ 単独プレイの国盗りではキングメイキングはほぼ無関係(AI同士の談合/袋叩きの知覚の問題に置き換わる。上記Johnsonの記述参照)。

**「複雑さ過剰」・「ストーリー」・「ブラックボックス」(Johnson「7つの大罪」2008)**
- 過剰なスクリプト(人間が負けられないシナリオ)、物が多すぎる(Blizzardは兵種を陣営あたり約12に抑える)、プレイ変化が乏しい、ブラックボックス機構(「教える層」と「参照層」の二層UIを推奨)、データの囲い込み、ストーリーを戦略ゲームに入れる誤り(「戦略ゲームのストーリーはゲーム自体」)など。【本文確認・個人意見】 — [7 Deadly Sins For Strategy Games (Johnson, 2008)](https://gamedeveloper.com/game-platforms/opinion-7-deadly-sins-for-strategy-games)
- 「ゲームは興味深い決定の連続」(Sid Meier): 二次的な要約ブログで確認(決定が重い=投資感・決定疲労)。Silent Serviceのデモ中にAIに瞬殺された逸話から「最初の数分は誰でも勝てるように」。同ブログは「戦闘確率は偽装されている」と書くが一次ソースで未確認のため採用しない。【本文確認・二次(書評ブログ)】 — [Just one more turn - tips from Sid Meier's Memoir (Darenn Keller, 2021)](https://www.gamedeveloper.com/game-platforms/just-one-more-turn---game-development-tips-and-tricks-from-the-creator-of-civilization-sid-meier-)

**Minmax論(参考)**
- ターン制は原理的にミニマックスで最適手が出る、という個人ブログ。「Civも結局同じパズルか」と問う。価値は低い。【本文確認・個人意見】 — [Minmaxing - Is turn-based fun anymore? (2012)](https://gamedeveloper.com/design/minmaxing---is-turn-based-fun-anymore-)

### Inferences
- 小規模ブラウザゲームでは、Stewartの「ゲームが勝敗確定を検知して告げる」案が最も安価に実装できる(勝率の計算+「天下統一確定」演出+次の周回へ)。ただし本人も未検証。
- Johnsonの「全行動にコスト」+「交渉テーブルを作らずイベントで外交」は、コンテンツ量が制約の開発者にとって「UIを作らず、イベント1本で外交を表す」省力設計にもなる。
- 「AIが理解できない機構は入れない」(Chick Parabola)は、ソロ開発のAI実装コストを下げる設計基準としてチェックリストに使える。

### Gaps
- 「分析麻痺」「ビルドオーダー」「亀(turtling)」「セーブスカム」について、原典となる体系的エッセイは今回の取得範囲で見つからなかった(Wikipediaのジャンル項目にturtling/micromanagementの語はあるが定義のみ)。
- 「ゲームの雪だるま」のWikipedia記事は存在しなかった(404相当)。Marc LeBlanc「MDA/Tournament Chess」等の一次文献は今回未取得。
- Alex Jaffeの講演本編と4つのパラダイムの中身は未確認。

---

## 2. 名前のついた対策とその根拠(行動数制限/時代リセット/委任/イベント/追い上げ等)

### Takeaway
実際に出荷された対策として根拠が追えたのは: 行動数制限(Old Worldの「Orders」、信長の野望の「行動回数/労力/奉行」)、時代による盤面リセット(Civ VII、完走率<50%への回答)、委任/AI総督、ランダムイベントでの物語注入、固定ターン(Polytopiaの30ターン)。効果の定量データは公開されていない(Civ VIIの完走率改善値も未取得)。

### Cited Findings
- **行動数制限(Orders)**: Old World(Soren Johnson)はターンごとに有限の「Orders」を持ち、ユニットは1回ではなく命令が尽きるまで何度でも動かせる。ボードゲームの行動ポイントに近い。「したいこと」ではなく「やらねばならないこと」を選ばせる、帝国が育ち法律を採用すると増える。【要約のみ】 — [Old World Designer Notes #1: Orders](https://www.designer-notes.com/old-world-designer-notes-1-orders/)、[PC Gamer: Old World preview](https://www.pcgamer.com/old-world-4x-preview)
- **イベント/キャラクター**: Old Worldは1000以上の手書きイベント連鎖。ランダムイベントが「どのバケツをどの速度で満たすか」になりがちな4Xの流れを破る。【要約のみ】 — [Old World Designer Notes #9: Events](https://www.designer-notes.com/?p=1733)
- **エンディング設計**: Johnsonは「4Xで最も難しいのは終わり方」と述べる(Designer Notes #11)。【要約のみ】 — [Old World Designer Notes #11: The End](https://www.designer-notes.com/?p=1748)
- **時代(Age)による章分け+サドンデス勝利**: Ed Beachは「遅れていても勝ちの可能性が常にある、最終時代にサドンデス型の勝利」と発言(Future Games Show経由)。Legacy Pathsは助言システム(Advisor)の構造的支えだった、という説明もあるが詳細は未確認。【要約のみ】 — [Interview: Ed Beach on Civilization VII Ages (TheSixthAxis)](https://www.thesixthaxis.com/2024/08/30/interview-ed-beach-on-civilization-vii-ages-diplomacy-security-blankets/)、[Firaxis dev diary: Ages](https://civilization.2k.com/civ-vii/game-guide/gameplay/ages-explanation)
  - 反対論: ファンの間で「文明を途中で切り替えるのは没入を損なう」と割れる(要約のみ)。 — [spilled.gg: How Civilization VII's Ages System Works and Why It's Split the Community](https://spilled.gg/civilization-7-ages)
- **委任と「プレイヤーがいらなくなる」逆効果**: Sid Meierが未発売の恐竜RTSで退屈作業を全てAIに任せたところ、プレイヤーのやることがなくなった(二次ブログ経由)。小笠原賢一P(『新生』)も「AIをしっかり作るほど『プレイヤーがいなくてもいいのでは?』になり、根本から作り直した」と述べる。委任は便利だが、どこまで任せるかが設計の核心。【本文確認(両方)】 — [Keller blog (Meier Memoir)](https://www.gamedeveloper.com/game-platforms/just-one-more-turn---game-development-tips-and-tricks-from-the-creator-of-civilization-sid-meier-)、[Game*Spark 小笠原Pインタビュー(2021)](https://www.gamespark.jp/article/2021/10/02/112364.html)
- **固定ターン数**: The Battle of Polytopia の「Perfection」モードは30ターン制限でスコアを競う。設計意図は開発者の一次発言を確認できず、「カジュアル向け」はレビュー者の解釈。【要約のみ】 — [The Battle of Polytopia (Wikipedia)](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia)
- **ターン制限撤廃の例**: 『ギレンの野望 ジオン独立戦争記』は100ターン制限を廃止し、和平派が多数になると強制休戦(最大291ターン)で終戦。【要約のみ】 — [note/4Gamer系検索結果](https://note.com/fmasashi_game/n/n98d11a05c12c)
- **追い上げ・先頭への抑制**: 前節のErnest Adams、Johnsonの「明示的な自己均衡機構ならチートに感じにくい」を参照。連合・共通の敵(コアリション)の効果を示す原典は今回見つからなかった。

### Inferences
- 「時代で盤面を一度リセットする」は、小さな国盗りなら「章(地方)制」や「天下三分→統一」の段階分けとして縮小適用できる。ただしCiv VIIの是非は割れており、完走率の改善値も未公開。
- 「行動数制限」は国産シリーズで一貫して使われてきた(次節5)ため、国盗りの文脈でも自然。

### Gaps
- 市民/都市の不満・汚職・維持費のスケーリング、連合戦、同時ターン、陣営の非対称性、カタチの上での「戦略ゲーム向けのイベント頻度」の定量評価は一次文献が取れず未調査。

---

## 3. 「もう1ターン」の心理と短時間セッションでの作り方

### Takeaway
Sid Meier自身の説明は「将来が常にあと1ターン先にある(期待の構造化)」。批判側は「スロットマシンのような操作」と言う。短いセッション化の裏付けデータは見つからなかった。

### Cited Findings
- Meier(GDC 2010「Psychology of Game Design」)の説明: 勝利が「あと少し先」に見える期待構造、角を曲がった先を知りたい好奇心。リアルタイム版を作ったがターン制に変えたことで「もう1ターン」が生まれた。AIは人間らしく見えるべきで馬鹿に見えてはいけない。出典はKotaku/Medium/Ars Technicaの二次記述。【要約のみ】 — [GDC10 Notes: Sid Meier on Why Everything You Know is Wrong (Medium)](https://medium.com/ada-chen-rekhi/gdc10-notes-sid-meier-on-why-everything-you-know-is-wrong-53d7bc889419)(取得時にJS必須ページで本文不可)、[Kotaku](https://kotaku.com/civilization-creator-explains-why-everything-game-devs-5492078)
- 書評ブログ版: 「プレイヤーの注意を『この先』に向け続ける。ご褒美は与えるが、次にやることへ焦点を移す(連続ドラマのクリフハンガー)」「負けは報酬が確立した後に来させる」。【本文確認・二次】 — [Keller blog](https://www.gamedeveloper.com/game-platforms/just-one-more-turn---game-development-tips-and-tricks-from-the-creator-of-civilization-sid-meier-)
- 批判: 「もう1ターン」は操作でスロットマシンに近い、数値が少し動くたびに押させられているだけ(Aftermath Hours podcast、意見)。【要約のみ・個人意見】 — [Aftermath Hours: Civilization VII One More Turn](https://aftermath.site/aftermath-hours-podcast-civilization-vii-one-more-turn)
- Beachの観察: 4Xの面白さの核は探索で、最初の50ターンの「自分の位置と周りを知る」楽しさが再プレイ(途中放棄)の理由。そこで時代ごとに探索の楽しさを「小分けにして全体に散らす」。【本文確認】 — [Game Developer 2024-08-23](https://gamedeveloper.com/design/firaxis-big-swing-with-civilization-vii-convincing-players-to-actually-finish-their-games)
- Reigns(Nerial)の短ループ: 自明な操作(スワイプ)と大きな結果の落差が魅力、ループは常に「もう一度スワイプ」できる形。カード抽選は状態に合わないカードを毎回袋から除外して組み直す。4つのパワー軸に重みづけすると単純なスワイプに意味が出る。【要約のみ】 — [Game Design Deep Dive: Creating an adaptive narrative in Reigns](https://www.gamedeveloper.com/design/game-design-deep-dive-creating-an-adaptive-narrative-in-i-reigns-i-)、[How Reigns make their 'Tinderocracy' work (PC Gamer)](https://www.pcgamer.com/how-reigns-and-its-forthcoming-sequel-make-their-tinderocracy-work/)

### Inferences
- 重なり合う短期・中期・長期目標(「あと1ターンで城が完成/あと2ターンで同盟成立/あと5ターンで次の国」)が「もう1ターン」の構造。Meierの「未来はあと1ターン先」と整合。
- 一次ソースでの「セッション長と継続率」の相関データは見つかっていないので、設計判断は仮説扱い。

### Gaps
- 可変報酬・進捗の可視化の効果に関する、戦略ゲーム固有の実証研究は未発見。

---

## 4. 経済設計の基本

### Takeaway
今回の範囲では「資源の数は少なく、トレードオフを本物にする」を一次文献で直接裏付けるものは薄い。Johnsonの「物が多すぎる」と「全行動にコスト」が最も近い。

### Cited Findings
- 「物が多すぎる: ゲームは『興味深い決定の集合』で、物はその実行のためにある。選択肢は少なすぎるより多すぎるほうが一般的。プレイヤーが頭に保持できる数はおよそ12(Blizzard)」。【本文確認・個人意見】 — [7 Deadly Sins](https://gamedeveloper.com/game-platforms/opinion-7-deadly-sins-for-strategy-games)
- Old World: 資源は市場で売買でき、買値は売値の2倍でトレードオフが明確。「全行動にコスト」。【本文確認】 — [PC Gamer: bargaining table](https://www.pcgamer.com/soren-johnson-says-civ-3s-bargaining-table-was-a-big-mistake)
- Civ 5のストックパイル/ポップキャップ資源の比較: ポップキャップ型(鉄8個=8体まで)は管理は単純だが、ストックパイル型(貯めてまとめて使う)は管理が増える、とShafer。数量化した資源は良い判断としつつ実装は不満。【本文確認・個人意見】 — [Revisiting the Design of Civ 5](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5)
- 内政コマンド8種(開発/投資/治安/治水/徴兵/徴収/施し/税率)のうち実質重要は2つ、という『天下創世』レビュー評(4Gamer)。取得時に文字化けして本文確認不可、検索要約のみ。【要約のみ】 — [4Gamer 天下創世レビュー](https://www.4gamer.net/review/tenkasousei/sousei.html)
- 『天下創世』の「まず『投資』だけで発展を進められ、細かい特殊建造物は流れを掴んでからでよい」という観察(徳岡正肇)。【本文確認】 — [4Gamer 信長の野望14タイトル(2016)](https://www.4gamer.net/games/268/G026859/20160317049/index_2.html)

### Inferences
- 「数値遊びではなく判断の余地を残す」(次節)と同じ方向。資源は2〜3種(例: 米/兵/金)程度でも、行動数と維持費に本物の二択があれば成立する、というのは仮説であって原典の主張ではない。

### Gaps
- 指数 vs 線形成長、源泉と消費先(sources/sinks)、「大砲かバターか」の定量的な設計論は一次資料が取れず。

---

## 5. マップとスケール(拠点数、ノード/グリッド/ヘクス、霧、生成の公平性)

### Takeaway
1UPT(Civ 5)の経験は「地図が戦闘形式を決める」ことを示す。国盗り系の日本作品は「1枚マップ」「城ノード+城下ミニマップ」と段階的に変遷した。適正拠点数の一般則は見つからなかった。

### Cited Findings
- Shafer: 1UPTには地図の広さが必要で、最大マップを4倍以上にし隘路を大きく少なくする生成が要ると見積もる。【本文確認・個人意見】 — [Revisiting the Design of Civ 5](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5)
- 国盗り系の構造史(徳岡正肇, 2016): 『天下創世』=領地(城)の連絡関係を示す2Dマップ+各領地の3D町並みマップ+戦闘専用マップの3層、1年を8ターンに分割、アクション管理は「行動回数」(初期の信長は4回)で、大名のいる城のみ実行可能、他は城主に委任。『嵐世記』=個別コマンドを廃し「奉行」を事業(農業/商業/普請)に割り当てて自動進行、奉行数は大名の能力で変わり(信長で7人)、足りなければ「軍団」を分けて枠を増やす(分権のリスクを伴う)。『創造』=行動を人口に依存する「労力」で縛る。【本文確認】 — [4Gamer 徳岡正肇「信長の野望14タイトル」(2016)](https://www.4gamer.net/games/268/G026859/20160317049/index_2.html)
- 『天下への道』(Kingnet): 初期の野外マップが霧で覆われ、拠点解放・山賊討伐で段階的に開く(探索で資源/建築物/ランダムイベント)。戦国拠点の座標を1:1で再現。争覇地域/不可侵地域でPvP強度を分離。【本文確認(インタビュー)】 — [ファミ通 Kingnetインタビュー(2025-06-18)](https://www.famitsu.com/article/202506/45086)
- 『真戦』(Qookka): 「シンプルなルール設計の中に深い戦略性」「公平性」。小笠原P「単なる数値遊びではなくプレイヤーが戦略的な判断を下す余地を必ず残すことを条件にした」。【本文確認(PRインタビュー)】 — [4Gamer(2025-12-22)](https://www.4gamer.net/games/915/G091513/20251119030/)

### Inferences
- 「奉行(割り当てで自動進行)」「労力(行動資源)」「行動回数」は、モバイル縦持ち・片手の国盗りで1ターンの操作回数を抑える既存の日本語圏の前例として使える。

### Gaps
- 手続き的生成の公平な開始位置、チョークポイント理論、ノード vs ヘクスの比較研究は未調査(原典を取得できず)。

---

## 6. 外交とAI(性格、記憶、見える好感度、透明なAI、難易度の付け方)

### Takeaway
現場の設計者(Johnson, Shafer)が揃って「透明で一貫した、読める」AIを支持。小笠原P(『新生』)も同方向(性格・相性・忠誠・拒否権)。難易度はボーナスで付けるのが業界慣行で、段階的・明示的なら受容されやすい。

### Cited Findings
- 前掲Shafer/Johnsonに加え、Civ 6の「アジェンダ」(各指導者に発見可能な目標)は透明性路線の製品化例(PC Gamer)。AI指導者が人間のように振る舞うのは無理があるという論調だが、論者の意見。【要約のみ】 — [How Civilization 6 changes war for the better (PC Gamer)](https://www.pcgamer.com/how-civilization-6-changes-war-for-the-better/)
- Stewart: 敵の戦略は「検出可能・もっともらしい・(いつか)対処可能」であるべき、変われば新しいパズルになる。【本文確認】 — [Five Suggestions for 4X Fun](https://gamedeveloper.com/design/five-suggestions-for-4x-fun)
- 『新生』: 武将が意思を持ち、大名の命令を拒否する場合もあるAI。武将同士の仲の悪さ・反抗的な個性・忠誠度・好戦性の属性を設定。AIは「コンパニオン的」で、プレイヤーの意図を汲み提案する。「命令しないと何もしない配下」を変えたい。序盤はミクロ、慣れた中盤以降は城単位のマクロ。【本文確認】 — [Game*Spark 小笠原Pインタビュー(2021)](https://www.gamespark.jp/article/2021/10/02/112364.html)
- AIの質の議論: Shafer GDC 2011「良いAIを作るのは採算が合わない」、Browder「難しいのはAIを人間らしく感じさせること」。Johnsonは「透明なルールで単純に」と主張。【本文確認】 — [GDC 2011: Strategy Game Veterans Look At The Genre's Biggest Challenges](https://www.gamedeveloper.com/game-platforms/gdc-2011-strategy-game-veterans-look-at-the-genre-s-biggest-challenges)
- Meier系の助言: 「賢いAIより楽しいAI。プレイヤーはAIの挙動を予測して勝つことに喜びを見出す」(Keller書評ブログ)。【本文確認・二次】 — [Keller blog](https://www.gamedeveloper.com/game-platforms/just-one-more-turn---game-development-tips-and-tricks-from-the-creator-of-civilization-sid-meier-)
- 敵意図の予告(テレグラフ)の最も明確な例: Into the Breach。「全ての死がプレイヤー自身のせいに感じるように」敵攻撃を予告。明快さのために面白い武器パターンを削った。ほぼパズルになり、経験者は「より解けるゲーム」になったと認める。【要約のみ】 — [Road to the IGF: Into the Breach](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)、[Into the Breach dev on UI design](https://www.gamedeveloper.com/design/-i-into-the-breach-i-dev-on-ui-design-sacrifice-cool-ideas-for-the-sake-of-clarity-every-time-)
- 一般的なAIアーキテクチャ(utility scoring、性格重み)を直接扱う原典は今回見つからず。Shafer「RNG加重はバラバラな行動の原因、強いAIには特定の行動を強制する場面が必要」が間接的な警告。【本文確認】

### Inferences
- 「性格(固定の重み)+見える好感度+理由の見える行動」の3点は、Johnson/Shafer/小笠原の発言が重なる実装方針。「敵が次に何をするか(攻め先)を前もって表示」は既存調査の「意図の予告」と同じ原則。

### Gaps
- utility AIや難易度のボーナス/行動別の比較研究、AIの「記憶」(過去の裏切り)の設計文献は未取得。

---

## 7. 小画面でのオンボーディングとUI(段階的開示、助言者、事前予測、アンドゥ)

### Takeaway
Shafer(Civ 5)は「要素の大きさを重要度に比例」「稀な操作は下層に」を実践。Johnsonは「教える層/参照層」の二層UIを提唱。助言者と事前予測(勝率・収入変化)の効果の実証は見つからない。

### Cited Findings
- Civ 5 UI: 重要度で大きさを決める(ターン終了ボタンは地図オプションより大きい)、稀な操作(ユニット解散)は下層へ、玄人向けの「エキスパートスイッチ」を計画したが実現できなかった。【本文確認・個人意見】 — [Revisiting the Design of Civ 5](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5)
- Johnson: ブラックボックス化を戒め「教える層+参照層」。Rise of Legendsはキーを押すと詳細が出るポップアップヘルプ。【本文確認】 — [7 Deadly Sins](https://gamedeveloper.com/game-platforms/opinion-7-deadly-sins-for-strategy-games)
- Into the Breach: 「明快さのために面白い案を毎回犠牲にする」(UI設計)。【要約のみ】 — 上記リンク
- Shafer(GDC 2011): YouTubeで攻略を見ないと遊べないうちは玄人向けに留まる。【本文確認】 — [GDC 2011 panel](https://www.gamedeveloper.com/game-platforms/gdc-2011-strategy-game-veterans-look-at-the-genre-s-biggest-challenges)
- 日本の例: 『天下への道』は「一括任命」ボタン、部隊情報の確認UIの追加などβ後に調整。【本文確認】 — [ファミ通](https://www.famitsu.com/article/202506/45086)

### Gaps
- アンドゥ、勝率/収入予測表示の効果、モバイル戦略のオンボーディング定量データは見つからず。

---

## 8. セッション長・完走率のデータ

### Takeaway
公開された数値は実質Civ VIの「完走率50%未満・平均15〜20時間」(Ed Beach)のみ。

### Cited Findings
- 上記Beach発言。【本文確認】 — [Game Developer 2024-08-23](https://gamedeveloper.com/design/firaxis-big-swing-with-civilization-vii-convincing-players-to-actually-finish-their-games)
- Steamの実績統計から勝利率を推計するCivFanaticsスレ(2018年「勝ったのは40%未満」)は存在するが、中身は取得できず数字は未確認。【要約のみ】 — [CivFanatics thread](https://forums.civfanatics.com/threads/under-40-of-players-have-won-a-game-from-steam-global-achievements.626992/page-3)
- 4X一般の「数百ターン」。【本文確認・二次】 — [4X (Wikipedia)](https://en.wikipedia.org/wiki/4X)

### Gaps
- モバイル戦略の完走率、セッション長の分布は未発見。

---

## 9. 日本語圏の設計論(国盗り/歴史シミュレーション)

### Takeaway
日本語で見つかったのは設計論そのものというより、開発者インタビューと徳岡正肇のシリーズ史レビュー。共通して「行動管理(コマンド回数/奉行/労力)」「委任」「配下AI」が国盗り設計の中心課題として現れる。CEDEC講演・Den-fami記事は今回見つけられなかった。

### Cited Findings
- 徳岡正肇「アクション管理問題」: 「内政が事実上ターン制なら、行動回数をどう縛るのか?という、恒例のアクション管理システム問題」。『創造』では「労力」(働く人口が多いほど多くのアクションを実行)で表現し、武将ステータス依存の制限から根本変更。【本文確認・個人(ライター)意見】 — [4Gamer(2016-03-23)](https://www.4gamer.net/games/268/G026859/20160317049/index_2.html)
- 小笠原P『新生』: 「命令する大名と、命令されるだけの武将」の関係を変える。委任機能は「設定して任せるだけ」の閉じた状態だったため、大名と武将が適宜やり取りする設計に。後半の作業量を委任でさばく、という過去作の評価も言及。【本文確認】 — [Game*Spark](https://www.gamespark.jp/article/2021/10/02/112364.html)
- 『信長の野望』ja Wikipediaの沿革(未精読)。取得済みだが今回は未使用。
- 『真戦』『天下への道』などスマホ版は課金/PvP/シーズン制が前提で、シングルの国盗り設計の参考としては限定的。【本文確認】 — 上記ファミ通/4Gamer
- 最新作『飛翔』(2026-06)電撃オンライン: 「大義名分」「町づくり内政」「ストーリーモード」。劉迪P=ゲームバランス重視、小笠原=史実再現重視の分担。【要約のみ】 — [電撃オンライン](https://dengekionline.com/article/202606/77829)

### Gaps
- CEDEC、Den-fami、4Gamerの「国盗り終盤のだれ」を直接論じた文章は見つからなかった(日本語検索で該当なし)。cedil.cesa.or.jpは検索に出ず未確認。

---

## 付録: 失敗モード候補(チェックリスト素案、出典は上記各節)
1. 勝敗確定後も終わらない(→勝利確定検知・自動終了、Stewart/Beach)
2. 領地数に比例して1ターンの入力数が増える(→奉行/軍団/委任の枠制、徳岡/Beach)
3. 人間用の最適解(交渉の無限微調整等)が見つかる(→行動にコスト、Johnson)
4. AIが理解できない機構を入れる(→AI可能性で機構を絞る、Chick Parabola)
5. 隠れたチート/即時ボーナス(→段階的で説明可能な難易度、Johnson)
6. 気まぐれな外交AI(→性格固定+見える好感度、Shafer/小笠原)
7. 物が多すぎる(→約12の目安、Johnson)
8. 委任しすぎてプレイヤーが不要になる(→小笠原/Meier)
9. 長時間投資後の敗北(→正のスノーボールでの安全弁、Murthy)
