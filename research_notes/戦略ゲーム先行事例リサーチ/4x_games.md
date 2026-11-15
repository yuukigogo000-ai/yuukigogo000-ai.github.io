# 4X戦略ゲーム(Civilization I〜VII ほか)の具体的な仕組みと賛否

調査日: 2026-11-15 / 凡例: 【本文確認】=ページ本文を取得して確認、【要約のみ】=検索スニペット(ブロック対象ホスト含む)のみ。
取得経路メモ: WebFetch不可のため curl で取得。Wikipedia は MediaWiki API。designer-notes.com / CivFanatics / Steam / Reddit / PCGamesN 等は取得不可のため検索スニペットのみ。

## Q1. Civilization 各作のシグネチャ変更と評価(最良/最悪とされる作品)

### Takeaway
Civ III=文化国境、Civ IV=宗教・市民政策・「何もデフォルトにしない」再設計、Civ V=ヘクス+1UPT+都市国家(AIと渋滞で不評も「最高峰」とする声も)、Civ VI=都市のアンスタック(区域)、Civ VII=3つの「時代」+文明切替(最も割れた)。ファンの最良は IV か V が多く(要約のみ)、VII は「完走率を上げる」目的の大改造が最も強く反発された。

### Cited Findings
- 【Civ III】設計は Jeff Briggs と Soren Johnson。文化(都市の影響範囲=国境)は新要素。戦略/贅沢資源が追加。発売時は好評だがバグ、マルチは「Play the World」で酷評。 — [Wikipedia: Civ III](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_III) 【本文確認】
- 【Civ III】Briggs 本人の回想: 「腐敗(corruption)システムをCiv IIIから外せばよかった。遠隔地に都市を広げる障害になった。皆が当然のものとして受け入れ、いじるのを怖がった」。偉人・芸術システムも時間・資源制約で多くが削られた(後の作品で復活)。 — [PC Gamer: The complete history of Civilization](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】(p.3相当)
- 【Civ IV】2005年、Soren Johnson設計。Metacritic 94。宗教(7宗教)は「ゲーム全体の深さを増すため」(プロデューサー Barry Caudill)。市民政策(civics)・宗教が外交関係と連動。Johnsonは「前作の機能を一切デフォルトで引き継がない、全部再評価する」方針で、腐敗を削除し宗教を導入。地形・市民管理に「選ぶ理由」を増やし、毎回違うプレイをする理由を作ることを狙った。 — [Wikipedia: Civ IV](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_IV)、[PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- 【Civ IV】最初からマルチプレイ前提で構築し、開発2〜3か月目から毎週対戦して検証した(Johnson談)。 — [PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- 【Civ IV】批判点(Wikipedia所載): 敵の達成通知が目立たない等。大筋は絶賛。 — [Wikipedia: Civ IV](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_IV) 【本文確認】
- 【Civ V】ヘクス採用(Panzer General 由来、Shafer談)、1タイル1軍事ユニット+1民間ユニット、都市国家(新規。勝利不可・同盟/買収で恩恵)、社会制度(Civ IVの切替式civicsを「累積式」に変更。Shafer: 「"どのカッコいい効果が欲しいか"と考えさせたい」)。Metacritic 90。最頻出の批判は **AI**(1UP「プレイできないAI」、Eurogamer「奇妙なほどひどい」、G4「外交は貧弱」、IGN「攻撃的すぎ」)。Civ IVの宗教・スパイが無いことへの不満(IGN)。後に Kotaku は「シリーズの頂点」、RPS は「シリーズの高水準点」と再評価。 — [Wikipedia: Civ V](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_V) 【本文確認】
- 【Civ V 開発事情】プロデューサー談: 1UPT導入で全く新しいAIが必要になり、後期の時代が軽視され、他の系統を削る必要が出た。 — [Wikipedia: Civ V](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_V) 【本文確認】
- 【Civ VI】区域(districts)で都市をアンスタック。Ed Beach談: 「地図を探索の場としてだけでなく、タイル単位で自分の痕跡を残す場にしたかった。だから都市のアンスタック、隣接ボーナス、区域を入れた」。ボードゲーム(配置パズル)の影響。起源は2010年のCiv V Spain/Inca シナリオ。批評: GameSpot「新たな戦略層」、Destructoid「宗教勝利は"迷惑"、オフにせよ」「外交勝利の欠落」。市民政策ツリー(文化を科学と同格に)も導入。 — [Wikipedia: Civ VI](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_VI)、[PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- 【Civ VI ブースト(eureka)】Beach は boosts を「マップ上のミニクエスト/目的」と説明。「ブーストがある道だけ研究すればよい」とプレイヤーに思わせたくなかった(Dennis Shirk インタビュー)。 — [ブースト関連 検索結果: thesixthaxis / gamesbeat 等](https://www.thesixthaxis.com/2016/08/03/interview-dennis-shirk-on-civilization-vi-and-finding-new-ways-to-play/) 【要約のみ】
- 【Civ VII】2025/2発売。3つの時代(古代・探索・現代)+時代ごとに文明を乗り換え。危機イベント、独立勢力→都市国家化。Metacritic「generally favorable」、OpenCritic推奨77%。賛: ビジュアル・音楽・外交と経済の刷新。批判: **UI(情報が説明されない)**、簡略化されすぎ、時代システム+文明切替が割れる、技術ツリーが1960年頃で終わる、DLC依存。Steam は Mixed、発売数か月後も好評率48%。同接は発売週8万超→2025年5月に5000割れ。 — [Wikipedia: Civ VII](https://en.wikipedia.org/wiki/Civilization_VII) 【本文確認】(※Wikipediaのタイトルは取得時 "Civilization VII")
- 【Civ VII 後日談】2026/5/19の無料更新「Test of Time」で単一文明のまま全時代を通す選択肢を追加。Beach談: 「当初のビジョンではなく個人的に苦しい決断だった。ただ多くのファンが"始めた民族の物語を最後まで見たい"と望んでいた」。Dennis Shirk: 古参は「同じものをずっと通して遊ぶ幻想」を求めた。Sid Meier の長年の不満(自文明の特色が1時代しか効かず、残りは"素のCiv"になる)が文明切替の源流。 — [PC Gamer](https://www.pcgamer.com/games/strategy/civilization-7s-game-changing-update-was-personally-challenging-for-its-creative-director-as-being-able-to-play-as-a-single-civ-wasnt-part-of-the-original-vision/) 【本文確認】
- 【Civ VII 設計規則】Firaxis は新作に「新規1/3・刷新1/3・既存1/3」の割合規則を使うが、Beachは「Civ VIIは超過した」と後に認めた(Ars Technica インタビュー)。 — [CivFanatics要約](https://civfanatics.com/?p=11642) 【要約のみ】
- 【Civ VII Steam反応】初期は「Mostly Negative」で、主な不満はUI・時代・文明切替・マップサイズ・カスタマイズ。「時代転換は発想は良いが実装が悪い」というレビューあり。 — [Windows Central](https://www.windowscentral.com/gaming/civilization-vii-steam-rating-mostly-negative)、[Gamereactor](https://www.gamereactor.eu/civilization-vii-early-access-opens-to-mostly-negative-steam-reviews-1493163/) 【要約のみ】
- 【最良/最悪】PC Gamer読者投票では Civ V が1位、Civ IV が2位(対象は旧作のみ、Beyond Earth が最悪)。Civ IVは「AIと再プレイ性のベンチマーク」と称される。VI は「複雑さとUI」への不満と「最も深く再プレイ性が高い」の両論。出典はリスト記事・フォーラム中心で品質は低め。 — [PC Gamer ranking(検索結果)](https://pcgamer.com/ranking-the-best-and-worst-of-the-civilization-series) 【要約のみ】
- 【原点】Meier談: 初代でRTS化も試したが「多数のシステムを理解する時間を与えない」ためターン制にした。ヘクスは初代で却下。 — [PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- 【Civ II】Reynolds: ユニットにHPを導入(「ファランクスが戦艦に勝つ場面をなくしたかった」)、外交AIの実装でコード量が4倍に。 — [PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】

### Inferences
- シリーズの転機は、毎回「前作の不満を正す」大改造が別の不満を生む構図(V:AIと渋滞、VI:複雑さ、VII:切替とUI)。小規模ゲームでは「改造を1つに絞る」のが妥当。
- 好評な作品(IV、V後期)は、システム数は多くても「見て分かる・効果が明確」。Civ VIIの最大傷はUIの説明不足で、仕組みの量より説明の質が評価を決めた。

### Gaps
- Civ III 文化国境・戦略資源の個別の評価、Civ IV 宗教・偉人の賛否の具体的な引用は一次的に確認できていない。
- Civ VI の eureka に対する賛否(「作業感」「クエスト感」)を示す記事は未取得。
- Civ I/II の個別評価、日本語媒体(4Gamer等)は未取得。

## Q2. 「もう1ターン」効果の源泉

### Takeaway
初代の開発中に同僚の「Just one more turn」から発見された副作用で、設計者の一次発言は少ない。短期・長期目標が重なり、完成タイマーがずれて次の報酬が常に見える構造が通説だが、今回その言説の一次出典は確認できていない。

### Cited Findings
- Meierは、社内で他人がプレイしているのを見て「Just one more turn」「止められない」と聞いて初めて特別さに気づいた。 — [PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- Brian Reynolds: Civ初代は「Empireの"もう1ターン"と、都市・ユニット、ボードゲームのCivilizationの体験を組み合わせたもの」で2時までプレイした。 — [PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- Civ IV の販促は "CivAnon / No More Turns" で「中毒性」を風刺。 — [Wikipedia: Civ IV](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_IV) 【本文確認】
- 批判的見方: 「ターンを進め続けるのは良質さの証拠ではない。楽しんでいるかが問題」(Aftermath podcast)。 — [Aftermath](https://aftermath.site/podcasts/aftermath-hours-podcast-civilization-vii-one-more-turn/) 【要約のみ】
- Old World では「移動回数が毎ターン一定なのでCivより序盤の"何もしない死んだターン"が少ない」(Johnson)。構造的に「毎ターン何かが起こる」設計。 — [designer-notes 検索結果要約](https://www.designer-notes.com/?p=1748) 【要約のみ】

### Inferences
- 「次の報酬が見える」ことは、短時間セッション向けの小規模版では「あと1回で何かが完成」の表示が主操作になる。Old Worldの「毎ターンの選択は少数で重い」はこの原則とも整合する。
- 「完成タイマーのずれ」の通説は本調査で一次ソース未確認。報告書では「通説」と付記して扱うべき。

### Gaps
- 設計者による「もう1ターン」の構造分析(重なる目標・ずらしたタイマー)の一次出典は見つからなかった。GDC Vault の講演は未取得。

## Q3. ジャンルの定番課題と各ゲームの対策・受容

### Takeaway
後半の作業量爆発(完走率50%未満)、勝敗が早期に決まる問題、AIの弱さ/ランダムさ、1UPTの渋滞、ターン時間が主要課題。対策はCiv VIIの時代リセット、Old Worldの命令数制限と野望勝利、Humankindの名声、Civ Revolutionの簡略化など。成否は「何を失うか(没入・自文明の連続性)」で割れた。

### Cited Findings
**後半の作業量・完走率**
- Beachは Civ VI を完走したプレイヤーの割合は「驚くほど、憂鬱なほど低い。50%未満」と述べた。原因は「ペース配分」。平均15〜20時間かかり、帝国が育つと管理要素が増えて1ターンの作業が指数的に増える。Firaxisは各システムを事後検証し、「5〜10分に一度で済む戦略的決定」と「面白くない"ここをクリック"の連打」を区別した。対策として「ゲームを章(時代)に分けて盤面をリセットし簡素化」。時代は3つのみ(転換時に地図の再構成が必要なため)。 — [Game Developer: Firaxis' big swing with Civilization VII](https://www.gamedeveloper.com/design/firaxis-big-swing-with-civilization-vii-convincing-players-to-actually-finish-their-games) 【本文確認】(※括弧内の「Civ VI」は記事側の補足挿入)
- 探索の楽しさ(最初の50ターン)が完走されない一因として、Civ VIIでは古代は自陸地のみ探索可能にし、「探索の楽しさを瓶詰めして全体に薄く広げる」と説明。 — 同上 【本文確認】
- Bart Stewart: 2/3〜3/4時点で戦略は決着しており、残りは「次ターン」を連打するだけ。根本問題は戦略の性質(良い戦略は結果が分かる前に勝敗が決まる)で、末期の細かい管理が症状。ユニット管理を中心に据えた設計が戦略ゲームの深い思考と噛み合わない。目標単位の命令に切替える提案。 — [Game Developer: Five Suggestions for 4X Fun](https://www.gamedeveloper.com/design/five-suggestions-for-4x-fun) 【本文確認】
- Stellaris のセクター(委任)は「情報を隠し、一部の操作だけ遮断して他は要求するため、むしろ負担を増やす」との批評。Endless Space 2 は「後半が単調」「AIターンが遅い」。 — [検索結果: PCGamesN / Quarter to Three / Amplitude forum](https://pcgamesn.com/civilization-vi/strategy-game-endgame-design) 【要約のみ】(フォーラム/アグリゲータ中心で品質低)
**スノーボール・勝敗の早期決着**
- Johnson(Old World): 特化型勝利条件はプレイヤーを最初から1本道に向かわせ「予定調和」にする。勝利点は単純で多様なプレイに対応し、優勢側は早く終えられるが「王朝の物語」には面白みが薄い。そこで「10の野望を達成」が勝利。1人の支配者の期間は50〜500ターンとランダム。 — [Designer Notes #11 の要約](https://www.designer-notes.com/?p=1748) 【要約のみ】
- Old World の勝利: 都市拡大・驚異などの勝利点条件、もう一つは10野望(軍の規模、宗教と神話など)。野望は選択式で、戦争をすれば「敵ユニット10体撃破」などが出る。 — [PC Gamer: Old World preview](https://www.pcgamer.com/old-world-4x-preview) 【本文確認】
- Humankind: 勝利は名声(Fame)のみで、決まったターン数後など。名声は偉業(影響力蓄積、ユニット撃破、技術初到達、驚異建設)で得る持続的な相対評価。文明を時代ごとに変える。 — [Wikipedia: Humankind](https://en.wikipedia.org/wiki/Humankind_(video_game)) 【本文確認】
- Humankind の評価: IGN「興味深いが安全策で潜在力に届かず」、PC Gamer「数値重視で個性と物語に欠ける」、RPS「軍事・外交より領土開発が効率的」、Kotaku「文化を途中で乗り換えられるのは最も賢い新機軸」。 — 同上 【本文確認】
- Civ V の勝利は首都支配に簡略化され、ターン上限(2050年)のスコア勝利あり。 — [Wikipedia: Civ V](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_V) 【本文確認】
**AI・外交**
- Shafer(Civ V振り返り): 「AIをもっと人間らしく曖昧に」としたが、「AIが人間を模すと、ただの無意味なノイズになり、楽しくする方法はない」。同盟を結んだ相手も終盤に平然と裏切るので「関係を築く意味がない」。敵の目的と行動が明確でないと何をすべきか分からない。AIは「状況に縛られて行動がランダムに見え、全員が同じ形で狂っていた」「戦略が一貫せず飛び回った」。次作 At the Gates では関係値を明示(-5で絶対に交易しない、+10で必ず援軍)。 — [Game Developer: Revisiting the Design of Civ 5](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5) 【本文確認】
- Endless Legend: GameSpot は「受動的で弱いAI」を指摘しつつ高評価。 — [Wikipedia: Endless Legend](https://en.wikipedia.org/wiki/Endless_Legend) 【本文確認】
**1UPT vs 大軍スタック、都市乱立 vs 少数都市**
- Shafer: 1UPT は戦闘は最良だが、(1)戦闘AIが極端に難しい、(2)マップが狭く隘路で「面白い部分をやる余地がない」、(3)渋滞で生産速度を下げざるを得ず「バケツが満ちるのを待つ」時間が増えた。成立には最大マップを4倍以上にする必要。別の場で「スタック方式のほうがCivの規模には向いている」とも述べた。 — [Game Developer](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5)、[PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- Shafer: Civ V のグローバル幸福度は「小国でも戦える」狙いだったが「拡張(4Xの2つ目のX)に逆行し、巨大帝国が事実上不可能になった」。「ペナルティは乗り越える課題であるべきで、越えられない壁であってはならない」。スライダー(研究/文化)削除でプレイヤーが方針転換できなくなった副作用も。 — [Game Developer](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5) 【本文確認】
- Civ VI は限定的スタック(同種のみ)を許可して混雑を緩和。 — [Wikipedia: Civ VI](https://en.wikipedia.org/wiki/Sid_Meier%27s_Civilization_VI) 【本文確認】
- Old World は「1UPT思想だがスタック可」。実際には被害を避けるため1ユニットずつ置くのが主流。 — [designer-notes #3 要約](https://www.designer-notes.com/?p=1696) 【要約のみ】
- Humankind: 1領域に1都市(Endless Legend 由来)で都市乱立を抑制、戦闘は最大3戦闘ターンで戻る。 — [Wikipedia: Humankind](https://en.wikipedia.org/wiki/Humankind_(video_game))、[Endless Legend](https://en.wikipedia.org/wiki/Endless_Legend) 【本文確認】
**ターン時間・簡略化**
- Civ Revolution: 1ターンの年数が100年→2年へ圧縮、時代ごとにユニット/建物コストを調整。「Civ Lite」で通勤中に遊べるという評価。DSは「縮小感」「マップが窮屈」と批判。Edge は「雑多な細部を省いた"速さ"は…PC勢は戸惑うがCivの体験を薄めずに濃縮した」。 — [Wikipedia: Civ Revolution](https://en.wikipedia.org/wiki/Civilization_Revolution) 【本文確認】
- Civ Revolution の対戦は遅いとの評があり、ターンタイマーオプションを追加。 — 同上 【本文確認】

### Inferences
- 小規模ゲームの方針: (1) 章分け・早期終了条件で完走率を設計、(2) 敵の意図が読める(数値を見せる)外交、(3) 都市数を少数に固定(1領域1都市型)、(4) 最後の掃討を作らない(勝利が確定した時点で終了)。
- Shafer の「ランダムな人間らしいAIは楽しくならない」は、プロジェクトの教訓「敵の意図は予告する」と同じ方向。
- 「完走率<50%」は最も使える数字だが、元の文脈はCiv VI(PC)。短時間モバイルの目標完走率は別途設計が必要。

### Gaps
- 「ステック・オブ・ドゥーム」の批判の一次資料は今回未取得(Shafer のコメントで間接的に確認)。
- チート型AI(ボーナス付き高難度)への不満を示す一次的な出典は取得できなかった。
- スコア勝利・ターン上限の受容(不評/好評)を直接示すものは未取得。

## Q4. 設計者の発言(Johnson, Meier, Shafer, Beach, Reynolds)

### Takeaway
Meier/Johnson は「プレイヤーが主役、設計者やコンピュータではない」「選択は"影響が大きく、かつ理解できる"ときだけ面白い」。Shafer は自作の失敗(ランダムすぎるAI、渋滞、グローバル幸福)を率直に総括。Beach は完走率データでCiv VIIを設計。Reynolds は自分でプレイし AI に自分の判断理由を教える。

### Cited Findings
- Meier の格言「良いゲームは面白い選択の連続」。他の規則(Johnson解説): 「倍にするか半分にせよ」(小さな調整は無駄。初代ではペースが遅すぎてマップを半分にした)、「1つの良いゲームは2つの偉大なゲームに勝る」(Covert Actionの教訓。戦略ゲームを選ぶなら戦術ゲームは選ばない=Civに詳細な戦術戦闘が無い理由)、「調査はゲーム完成後に」(プレイヤーが設計者と同じ本を読む必要はない)。 — [Game Developer: Analysis: Sid Meier's Key Design Lessons](https://www.gamedeveloper.com/game-platforms/analysis-sid-meier-s-key-design-lessons) 【本文確認】
- 「プレイヤーが楽しむべきで、設計者でもコンピュータでもない」: Civ IV 開発中に、隠れた内部モデルが技術選択・建設・ユニット訓練を代行する(生産ボーナス付き)政府形態を試したが「プレイヤーが置いていかれた(楽しんでいるのはコンピュータ)」ため削除。「結果のある決定を、理解できない状態で与えるのは楽しくない」「選択は影響が大きく、かつ理解できる情報があるときだけ面白い」。 — 同上 【本文確認】
- Johnson(Civ IV): 「何もデフォルトで引き継がない」。ユニットアップグレードは Alpha Centauri の兵器工房に着想し、簡略化して要点(重要な決定と複数の道)を残した。タイルがダイヤ型だと距離が分かりにくいと批判。ヘクスを恐れていたことを悔いた。 — [PC Gamer 歴史](https://www.pcgamer.com/the-complete-history-of-civilization/) 【本文確認】
- Johnson(Old World): 「50の技術と30のユニットを倍にしてもゲームは良くならず圧倒的になるだけ。だがイベントは数を増やすほど広がる」(Mohawk は1200以上を執筆、最終2000超を想定)。命令システムで分かったこと: 「従来の4Xの選択の多くは、したいからではなく、しなければならないからしている」。「全ユニットを毎ターン動かせるなら、そうするだけ。それは面白いのか?」。命令数は盤ゲームの行動ポイントに似るが、PCのターン制では見たことがなく、着想は約10年前、Facebookゲームのエナジー制から得た。 — [PC Gamer: Old World preview](https://www.pcgamer.com/old-world-4x-preview) 【本文確認】
- Shafer: 上記Q3の通り。UIでは「ターン終了ボタンは地図オプションボタンより大きい」のように重要度に応じたサイズを徹底。 — [Game Developer](https://www.gamedeveloper.com/design/revisiting-the-design-of-civ-5) 【本文確認】
- Shafer: 資源は「資源が2か5かは大差なく、0かどうかが大差」で、数量は少なく強力にすべきだった。Civ Vではほぼ全資源が手に入り交易の理由が消えた。 — 同上 【本文確認】
- Beach: 新作の割合規則(新1/3・刷新1/3・既存1/3)、「ripples」手法(核心アイデアを検証する最小実装)、定期的な単独/マルチのプレイテスト。 — [Game Developer: Firaxis' big swing](https://www.gamedeveloper.com/design/firaxis-big-swing-with-civilization-vii-convincing-players-to-actually-finish-their-games) 【本文確認】
- Reynolds(Alpha Centauri): 「最も重要な原則は設計者自身が開発中にプレイすること」。自分の判断と理由を記録し、AIの「愚かな」行動の理由を探り、自分の思考過程をAIに教えた。「陣営が特定戦略に固定されないこと」を目標にした。社会工学(政策の組合せ)と自作ユニット(兵器工房)が賞賛点。 — [Wikipedia: Alpha Centauri](https://en.wikipedia.org/wiki/Sid_Meier%27s_Alpha_Centauri) 【本文確認】
- Reynolds: 重要でない選択は「マイクロマネジメント」と不満を呼び、答えがいつも同じ選択も避けるべきという趣旨(Game Developer の podcast 書き起こしの要約)。 — [Game Developer: Brian Reynolds podcast transcript](https://www.gamedeveloper.com/game-platforms/column-podcast-transcript-brian-reynolds-on-how-ai-enables-designers-) 【要約のみ】
- Beach は Civ VI で「ゲーム全体を簡略化して深みを失うことは望まなかった」と述べた(インタビュー要約)。 — [PCGamesN / GamesBeat等](https://pcgamesn.com/civilization-vi/making-of-civilization-6) 【要約のみ】

### Inferences
- 全員に共通する原則: 「決定は少なく、効果が見え、理解できる」「隠れたシミュレーションはプレイヤーを置いていく」。本プロジェクトの「決定は少数で重く、敵の意図は予告する」に直接合致する。
- 命令数制限(Old World)は着想がソーシャルゲームのエナジー制であり、モバイルの短時間セッションとの相性は構造的に良い。ただし課金ではなく選択の重みとして使う点が要点。

### Gaps
- Meier の GDC 講演(Interesting Decisions)の全文、Reynolds / Beach の一次インタビュー(GameSpot, CivFanatics)は今回取得できず。
- 日本語の開発者発言(4Gamer / ファミ通等)は未調査。

## Q5. Old World(命令・キャラクター・イベント・野望)

### Takeaway
命令=毎ターンの希少な行動資源。キャラクターは老い・死に、イベントで物語を生む。野望は「プレイヤーの王朝の物語」に合わせて動的に生成される勝利条件。評価は高い(PC Gamer 2021年最優秀戦略)が、複雑さへの指摘もある。

### Cited Findings
- 概要: 古代〜古典期、Crusader Kings 的な王朝シミュレーション要素。指導者が老い死に、後継者の教育で特性が決まる。指導者の命令数は有限で、大軍は複数の命令を要するが、1ユニットが複数命令を使える(疲れるまで)。 — [Wikipedia: Old World](https://en.wikipedia.org/wiki/Old_World_(video_game)) 【本文確認】
- 評価: Metacritic「generally favorable」。IGN(8/10)「Civより小規模だが新しいアイデアが"面白い深さと威圧的な複雑さ"の両方を加える」。PC Gamer 2021年ベスト戦略。GOG 2022年売上上位3。 — 同上 【本文確認】
- PC Gamerのプレビュー: 毎ターンの命令数は有限。斥候移動、労働者の施設建設で消費。聖域や駐屯地など建物は命令生産量の一部を恒久的に消費。序盤は命令が余るが、兵を増やすと半分を動かせず、より戦術的になる。ただし序盤の数時間は「進みが苦痛なほど遅く、ユニット建造に5〜10ターン」、戦闘は「地味」と記者は不満。 — [PC Gamer](https://www.pcgamer.com/old-world-4x-preview) 【本文確認】
- 設計理由(Johnson): 「プレイヤーの選択に重みを置く」「全ユニットを毎ターン動かすのは"そうしなければならない"からで、それが面白いのかを問うた」。 — 同上 【本文確認】
- イベント: 1200以上の手書きイベント連鎖(Leyla Johnsonほか)。史実を機構化。特定の材料(若い後継者、独身の女王、蛮族)が揃うと特定の連鎖(オルガ連鎖)が起こる。イベントの決定は経済・科学・政治を変え、指導者に「賢者」「勇者」などの称号・特性を付与。記者は「数値だらけのゲームに人格を与える」と好意的。 — 同上 【本文確認】
- 野望: 10個達成で勝利(選択式、プレイ内容に応じて提示)。イベントやキャラクターの欲求から動的に生成され、達成するほど難度が上がる。野望は指導者に紐付く。AIは野望もイベントも持たない(「人間が中心のゲームでは意味を成さないため」)。 — [PC Gamer](https://www.pcgamer.com/old-world-4x-preview) 【本文確認】、[designer-notes / CivFanatics 要約](https://civfanatics.com/2021/10/14/old-world-designer-notes-11-soren-johnson-on-the-game-end/) 【要約のみ】
- 命令に偏った軍事重視は序盤に優位でも最終的に劣勢になり得る(コミュニティAMA要約)。 — [AMA mirror](https://bestofama.com/amas/gftr6m) 【要約のみ】
- 反応: 「AIを野望から締め出すことに反対」というフォーラム意見。 — [CivFanatics要約](https://forums.civfanatics.com/threads/old-world-designer-notes-11-soren-johnson-on-the-game-end.673707/page-2) 【要約のみ】

### Inferences
- 野望方式は「勝利条件=プレイヤーの物語」で、特化型勝利の一本道を避けつつ、スコア勝利の味気なさも避ける。小規模ゲームでは、少数のテンプレートから状況に応じて3〜5個を提示する簡易版が現実的(全10個+AI対応は大きな作業)。
- 序盤の遅さ・複雑さは Old World の弱点として残っている。短時間セッションでは序盤の立ち上がりを速くする必要。
- イベント数が「増やすほど広がる」唯一の領域という Johnson の指摘は、コンテンツ量リスクの高い一人開発者にとって、データ駆動でイベントを積む方針の裏付け。ただし1200件は一人では非現実的で、テンプレート化が必須。

### Gaps
- 命令数の具体的な数値バランス(1ターン何命令か)は未確認。
- Old World の全体的な完走率・平均プレイ時間のデータは未取得。
- GDC 2022 ポストモーテム「My Elephant in the Room」の内容は未取得(告知ページのみ)。

## Q6. Civilization Revolution 等の小規模4X

### Takeaway
Civ Revolution は「Civ Lite」(Retro Gamer)。ターン年数の圧縮、システム簡略化で短時間化。評価は概ね好意的だが、DS版は「縮小感」「マップが窮屈」、PC古参は戸惑った。

### Cited Findings
- 2008年、Firaxis/Meier設計。PS3/Xbox360/DS/iOS ほか。ターンは100年→2年に変化。Metacritic「generally favorable」。 — [Wikipedia: Civ Revolution](https://en.wikipedia.org/wiki/Civilization_Revolution) 【本文確認】
- Edge(PS3 8/10): 「細部を省く"簡潔で素早い"手法はPC古参には不満かもしれないが、Civ体験を薄めず"濃縮"した」。DS 7/10。GameZone: DSは「縮小感」「マップが窮屈」。Retro Gamer 70%: 「通勤中に遊ぶCiv Lite。期待値を下げれば楽しい」。 — 同上 【本文確認】
- iPhone版(Knutson 8.7/10): 良いが「グラフィックが単純・不具合」。Xbox360 北米7月で14.76万本、iOS版は2009年iPhone売上9位。ただし2016年にiOSストアから削除。 — 同上 【本文確認】
- 対戦は「遅い」ためタイマーオプションを追加。 — 同上 【本文確認】
- Humankind の戦闘は最大3戦闘ターンで戻り、長い戦争を俯瞰スケールに任せる。 — [Wikipedia: Humankind](https://en.wikipedia.org/wiki/Humankind_(video_game)) 【本文確認】
- Civ VII の Apple Arcade版(2026/2)は機能制限・DLCなし。 — [Wikipedia: Civ VII](https://en.wikipedia.org/wiki/Civilization_VII) 【本文確認】

### Inferences
- Civ Revolution の「何を切ったか」の具体リスト(宗教、腐敗など)は今回未確認。評価の傾向は「簡略化は許容されるが、小さい盤面・縮小感は不満」。小規模版では、盤面の窮屈さより「少数の決定を重く」を軸にすべき。

### Gaps
- Civ Revolution で削られた具体的システムの一覧、Johnson/Meier の開発談は未取得。
- Master of Orion(1993、Wikipedia確認)は ‘4X’ の語源となった作品で、COM(AI性格)・スライダー式配分が特徴だが、プレイヤーの不満点は未確認。
- Master of Magic, Galactic Civilizations, Age of Wonders 4 の評価・不満の具体は十分に取得できなかった(AoW 4 は Wikipedia に仕様のみ: 同時ターン、Tomes による技術ツリー、帝国資源 Imperium 等)。

## Q7. セッション長・ターン数・完走率

### Takeaway
公式に近い唯一の数字は Beach の「Civ VI の完走は50%未満、平均15〜20時間」。他はフォーラムの推定で幅がある。

### Cited Findings
- Beach: 完走した人は「50%未満」、平均的プレイヤーは1ゲームに15〜20時間。 — [Game Developer](https://www.gamedeveloper.com/design/firaxis-big-swing-with-civilization-vii-convincing-players-to-actually-finish-their-games) 【本文確認】
- Steamフォーラムの推定: 標準速度(約300ターン)で5〜10時間、オンライン速度で約半分、マラソン・巨大マップ・神難度は約700ターン・約100時間。RAWG平均プレイ時間15時間。 — [Steam discussion等(検索結果)](https://steamcommunity.com/app/289070/discussions/0/154644705028657540) 【要約のみ】
- Civ VI の実績勝利率に関するCivFanatics集計(「勝利したことがあるプレイヤーは40%未満」)。ただし集計は実績データ由来の推定で信頼度は低い。 — [CivFanatics thread](https://forums.civfanatics.com/threads/under-40-of-players-have-won-a-game-revisited.643935/page-2) 【要約のみ】
- ターン時間: 数分、終盤は長い(AI待ち)。 — [CivFanatics: how long should a civ turn take](https://forums.civfanatics.com/threads/how-long-should-a-civ-turn-take.670475/) 【要約のみ】
- Old World: 10人の支配者の在位は50〜500ターンとばらつく(Johnson)。 — [designer-notes #11 要約](https://www.designer-notes.com/?p=1748) 【要約のみ】

### Inferences
- 目標セッション(モバイル数分〜数十分)に対し、1ゲーム全体が数時間の Civ とは設計尺が2桁違う。「章(時代)ごとに完結する短編」+「世代・物語の継続」が現実的。
- Beach の「5〜10分に一度の戦略的決定で済むもの」という基準は、モバイル向けには「1ターン数十秒、重い決定は1〜3個」に縮める指針として使える。

### Gaps
- Civ 全作の公式完走率、Humankind/Old World/Stellaris の完走率データは見つからなかった。
- 各作の標準ターン数(Civ VII の各時代のターン数等)は未確認。
