# ボス戦設計・戦闘ペース配分・オート戦闘の観戦性(一次資料の深掘り)

## 調査方法と信頼度の凡例(先に読むこと)
- WebFetch は gamedeveloper.com / automaton-media.com で名前解決エラーになったが、**Bash の curl では同ホストが取得できた**。以降の【本文確認】は curl で取得した全文(HTML→テキスト化)を読んだもの。
- 【要約のみ】= WebSearch の検索結果要約だけ。本文は読んでいない。
- curl でも取得できなかったホスト(dengekionline.com, gamesradar.com, pcgamer.com/.../2 など)は【要約のみ】扱い。
- 前回調査(reports/戦闘システム先行事例リサーチ.md と research_notes/戦闘システム先行事例リサーチ/battle_design_theory.md)の未読項目のうち、今回本文を読めたのは: Meier GDC 2012 記事、Rempton「interesting decisions」記事、Death's Gambit ボス記事、Automaton ヌヌヌ氏のボスコラム2本、Game Developer のボス構造/ペース記事数本、HotS/Clash Royale の観戦性記事。
- **最重要の未解決点**: 「ボス7分/雑魚90秒」を裏付ける**戦闘時間の実測値・設計者の目標時間は、今回も一次資料で得られなかった**(Gaps参照)。

---

## (a) 数分続く・入力の少ないボス戦の構造(フェーズ、メカニクスの導入、予兆、ブレイク、時間制限)

### Takeaway
ボス戦の構造は「試練(学習確認/技量確認)+守護(報酬)」(ヌヌヌ氏)、「8ビート構造:準備→登場→通常→エスカレート→中間点→全開→撃破演出→報酬」(Mike Stout)、「導入→開始→エスカレート→中間の息継ぎ→クライマックス」(Birkhead/Game Developer ペース記事)で語られ、広く共有されている骨子は「ボスはそれまでに学んだことの試験であり、強度を上げ中盤に山谷を作り最後に最大強度に持っていく」。ただし**いずれも数分という長さには触れておらず、ターン制/オート戦闘への適用は筆者の推論**になる。

### Cited Findings
**広く共有されている原則(複数の独立した筆者が同方向)**
- ボスの役割を「門番」とし、機能は「試練」(これまで学んだことの確認=学習確認型と、プレイスキルを問う技量確認型)と「守護」(報酬を守る。ボスは大きなストレス源なので緊張と解放のため報酬とセットにする)と定義。「ボスの強さは門番にするための手段でしかなく、極論、強くなくてもよい。『強い』と感じられればいい」 【本文確認】 — [AUTOMATON ヌヌヌ「ボス戦が担う重要な役割」](https://automaton-media.com/articles/columnjp/nununu-20260830-464035/)
- 学習確認型の例: マリオ オデッセイのマダム・ブルード(道中で覚えたワンワン操作を問う)、SEKIRO の河原田直盛(弾きと「危」の学習確認)。技量確認型の例: ロックマン(ボスと初対面、純粋にプレイスキル)、フロム作品。 【本文確認】 — 同上
- 同コラム: 技量確認型は「ボスがステージと断絶した完全な新規要素で、新鮮な驚きと期待感がある」。ホロウナイト シルクソングはチェックポイントが遠く、道中がボス戦の学習に寄与しないため「報酬までの距離」が長く、余計な時間に感じられた可能性がある、という分析。 【本文確認】 — 同上
- ボスは「試験」: 「Like a test at the end of a semester」、ボスはプレイヤーが習得したスキルを見せる場。設計手順として「テストしたいスキルを列挙→各スキルを試す攻撃を、ボスの見た目とは独立にブレスト→ボスのテーマに着せる→ボスが攻撃を中断されないための防御手段を設計」。「プレイヤーがボスを永久に攻撃不能状態に固定できると、ボスの攻撃(=試験問題)が出せず退屈になる」。 【本文確認】 — [Game Developer: Mike Stout "Boss Battle Design and Structure"](https://www.gamedeveloper.com/design/boss-battle-design-and-structure)
- 同記事の8ビート: Build-up(戦闘前に脅威を宣伝しスキルを訓練する)/ 登場の一撃 /「Business as Usual」(基本攻撃のみでパターンを学ばせる)/ 新攻撃と複雑化 / **中間点(「感情的な転換点」。賭け金を大きく上げつつ、同時に一瞬の息継ぎを与える)** / 全攻撃解禁 / 撃破シーケンス(ボスが追い詰められた姿を見せる)/ 報酬。Ocarina の Phantom Ganon は「本番ボスの攻略法を教えるために作られた別ボス」。 【本文確認】 — 同上
- 戦闘のペース=「強度×時間」。強度は「プレイヤーが再計画(re-plan)を迫られる頻度」と定義(0〜10)。典型パターン=敵を見せる→開始→エスカレート→**中間点で小休止→最難関のクライマックス**。「全てが同じ型である必要はないが、強度が上がることは守る」。敵数の増減には三角形パターン(敵数を増やす)とダイヤモンド型(途中から数を減らし質を上げる。**ダイヤモンドはボス/中ボスに多い**)がある。 【本文確認】 — [Game Developer: The Art and Science of Pacing and Sequencing Combat Encounters](https://www.gamedeveloper.com/design/the-art-and-science-of-pacing-and-sequencing-combat-encounters)(ブログ投稿。God of War の Birkhead を引用)
- 同記事: 新しい敵タイプの投入は強度を上げる最も簡単な手段で、補完的な組合せ(近距離+遠距離)ほど再計画を要求する。ただし一度に多くの型を出すと過剰になる。スポーン間隔が短すぎると各パターンを認識できず、長すぎると強度が落ちて退屈。 【本文確認】 — 同上
- ボスの各フェーズに「新しいことを投げ続ける」「反射神経だけに依存せず、戦略性を持たせる」「ワンミスで即死しにくくする」「ボスの配置(最初のボスと最終ボスは別設計)を考える」。ボスには必ず固有の特徴(暗闇フェーズ、傾く足場など)を戦闘の中心に置く。Forgotten Gaian は2つのフェーズを別々に導入してから合体させる。 【本文確認】 — [Game Developer: Die, die, die: Boss battle design in Death's Gambit](https://www.gamedeveloper.com/design/die-die-die-boss-battle-design-in-i-death-s-gambit-i-)(White Rabbit 共同創業者 Kubodera 談)
- 同記事: 初期案(重力が反転する列車、極性切替)は「概念は素晴らしいが機械的には悪夢」で簡素化した。「ほとんどのボスは当初想定通りには遊べなかった。何が楽しいかに立ち返った」。 【本文確認】 — 同上
- ボスが勝敗に関わるルールの外から勝つのは安っぽい: 全状態異常無効のボスは選択肢の大半を無効にし、HP最大値を超えるダメージの技はルール違反。ボスは「通常戦と違う試験」であるべきで、1回きりの戦闘とし使い回さない(再登場させるなら中ボス)。 【本文確認】 — [Game Developer: 3 Elements That Every Great Boss Fight Needs](https://www.gamedeveloper.com/design/3-elements-that-every-great-boss-fight-needs)(Josh Bycer。個人ブログの意見)
- 「ボス戦は、プレイヤーに『自分がどれだけすごいか』を証明させる場。ボスがどれだけすごいかを証明する場ではない」。誇張が足りないことはあっても過剰になることはない。God of War のボス戦ではプレイヤーが派手にやられても体力バーはほとんど減らず、無敵に見えるが実は安全という設計。体力バーを何度も確認させるなら設計が悪い。 【本文確認】 — [Game Developer: Mike Birkhead "Boss Design - Tips From A Combat Designer"](https://gamedeveloper.com/design/opinion-boss-design---tips-from-a-combat-designer)(個人の実務者意見)
- 予兆(テレグラフ): 「ここで何を問われているのか」をプレイヤーが知らないとゲームにならない(Avoidance型の系のとき)。予兆時間は「長いほど良いが約2秒が限界、1〜1.5秒が最適」(Birkhead個人の経験則)。2つの攻撃の予兆が似て見分けにくい=「muddy reads」と、予兆が重ならないことの重要性。「隙(hold)」は少なくとも1コンボ分必要。 【本文確認】 — Birkhead 同上 / [Game Developer: Enemy Attacks and Telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)(冒頭のみ読了)
- 時間制限の代替: ヨッシーアイランドのビッグけめくじは、画面端の奈落へ押し出す「体を使った制限時間」。「制限時間が緊張感を生むのは常識的な手法だが、数字ではなく『なんとなく把握できる敵の位置』であることに意味がある。曖昧さは想像力を刺激し、焦りに繋がる」。計4回ダメージで撃破。 【本文確認】 — [AUTOMATON ヌヌヌ第2回](https://automaton-media.com/articles/newsjp/nununu-20260906-465429/)
- ホロウナイト シルクソングの「第四の合唱者」: 腕ごとに役割があり、攻撃の瞬間にその腕が光る(予兆エフェクト)。基本難易度を低くしつつ後半で攻撃速度や地形変化で緊張を上げる。「その場での学習難易度を下げることで、変化・増加しても『目まぐるしい忙しさ』を感じるだけで『難しい!』という辛さにならない」。 【本文確認】 — 同上
- Shadow Fight 3(モバイル)の設計者談: 記憶に残るボスは「戦闘の途中でプレイヤーにプレイの仕方を変えさせる」(武器を投げ捨てて素手になる/無敵+突進/低HPで再生姿勢を取り、背後から攻撃して中断しないと全回復)。「内蔵パズル」は、ガイド無しで解ける分かりやすさが必須。 【本文確認】 — [Game Developer: Creating Cool Boss Fights](https://www.gamedeveloper.com/design/creating-cool-boss-fights)(冒頭〜中盤を読了。具体的な戦闘時間は記載なし)
- ボスはフェーズ制で、追加/異なる危険を出し、見た目の変化や苛立ちで示すことが多い(定義的な記述)。 【本文確認】 — [Wikipedia: Boss (video games)](https://en.wikipedia.org/wiki/Boss_(video_games))

**ターン制/オート戦闘の事例(一部のみ)**
- オクトパストラベラー0: 「ブレイク&ブーストで弱点をつけば倒せる」ルールの分かりやすさ、8人編成のシナジー(プロデューサー鈴木氏の発言とされる)。ブレイク=弱点を突いてシールドを削る、ブースト=ターン毎に溜まるBPで行動強化。 【要約のみ】 — [電撃オンライン 2025年11月](https://dengekionline.com/article/202511/56835) / [Gamer.ne.jp](https://www.gamer.ne.jp/news/202508020009/)
- FF7リメイクのスタッガー: 「敵がスタン(スタッガー)するまでに受けるダメージ量」を規定する戦闘の柱の一つ。バトルディレクター遠藤氏はMonster Hunter の経験をコマンド式のアクション化に活かした。ただし設計意図を詳細に語ったインタビュー本文は未確認。 【要約のみ】 — [GamesRadar: Tifa](https://gamesradar.com/tifas-fighting-style-was-the-hardest-to-build-for-final-fantasy-7-remake)
- Metaphor: ReFantazio の超ボス: 開発側は意図的にPersona/SMTより易しくしたわけではなく、新ジョブが易しく感じさせた、とリード。 【要約のみ】 — [GamesRadar](https://www.gamesradar.com/games/jrpg/metaphor-refantazios-superbosses-werent-intentionally-easier-than-persona-or-shin-megami-tenseis-but-the-jrpgs-lead-says-new-classes-made-them-feel-that-way)
- FF14のバトルデザイナーは、近接職が待機時間でフラストレーションを感じないよう、面白いメカニクス案の一部を却下した。 【要約のみ】 — [GamesRadar](https://www.gamesradar.com/games/final-fantasy/final-fantasy-14-battle-designer-admits-the-team-vetoed-some-interesting-ideas-for-endwalker-fight-mechanics-so-melee-players-wouldnt-be-frustrated-by-periods-of-downtime)
- プリコネ クランバトル/グラブル: 開発者がボス設計を語った一次資料は見つからなかった(検索で出たのは攻略サイトのみ)。 【要約のみ】

### Inferences
- 「7分ボス」を3〜4フェーズ(例: 基本パターン学習→新ギミック→中間点で賭け金上げ+小休止→全開)に割る、という設計は Stout の8ビートと Game Developer ペース記事の「導入→エスカレート→中間点→クライマックス」と整合する(ただし分数の根拠ではない)。
- オート戦闘では「プレイヤーの再計画頻度(=強度)」がゼロになりがちなので、強度の代理指標としては、敵の新技投入の頻度と「予兆→被害/反撃」の可視的な山(視覚的イベント)を使うほかない。
- 「ボスはそれまでの試験」を本作に当てはめるなら、ボスに「プレイヤーの編成/戦術選択の特定の決定(例: 前衛配置、戦術)を問う問題(例: 後衛狙い技、状態異常)」を仕込み、結果が配置/戦術に関係して見えるようにすることになる(推論)。
- ビッグけめくじ型の「数字でない時間制限」(ソフトタイマー)は、オート戦闘では「迫ってくる敵/増える危険」の可視化に置き換えられる(推論)。

### Gaps
- GMTK のボス/ターン制戦闘の動画・記事: 検索で該当せず。
- Persona/SMT、Dragon Quest、Bravely Default、Xenoblade、Monster Train、Unicorn Overlord、グラブル、プリコネのボス設計について、設計者本人の一次資料(本文)は得られなかった。
- enrage/ソフトタイマーやコメバック機構の設計論の原典(本文)は未取得。ヨッシー例のみ。

---

## (b) 戦闘時間・ペース配分

### Takeaway
**設計者が公表した「ボス戦◯分が適正」という数値・実測は今回も見つからなかった。** 得られたのは(1)強度の曲線(上昇→中間点で下降→最大のクライマックス)、(2)短い試合形式の実例(Clash Royale は3分制で、2分経過後にエリクサー生成速度が倍になり「戦術的な攻防から全面衝突」に切り替わる)、(3)オートバトラーの1セッションは30〜40分でモバイルには長いという指摘。

### Cited Findings
- ペース=強度×時間。強度は再計画の頻度。中間点を挟んだクレッシェンド型が標準パターン。【本文確認】 — [Game Developer: Art and Science of Pacing](https://www.gamedeveloper.com/design/the-art-and-science-of-pacing-and-sequencing-combat-encounters)
- Clash Royale: 1試合3分(同点なら1分延長)。「最初の2分はエリクサーが2秒毎に1。2分以降は生成速度が倍になり、勢いが戦術的なターン制風の攻防から全面衝突に切り替わる」。試合は「観戦しても面白い」とされ、その理由は観戦者が盤面と双方の手札は見えるが思考は見えない=非対称な情報。 【本文確認】 — [Game Developer: Clash Royale - Deconstructing Supercell's Next Billion Dollar Game](https://www.gamedeveloper.com/design/clash-royale---deconstructing-supercell-s-next-billion-dollar-game)(筆者は外部分析者)
- 現行オートバトラーのセッションは平均30〜40分で、「PC/コンソールには良いがモバイル層には全く不向き」、ラウンド間に店のランダム性があり、運が下位者に勝利を与える。 【本文確認】 — [Game Developer: Rise of the Autobattlers](https://www.gamedeveloper.com/business/rise-of-the-autobattlers-and-learnings-for-world-domination)(ビジネス寄りの意見記事)
- Heroes of the Storm: 試合が約25分で終わることは「カジュアルには良いが、観戦では『試合中の見せ場/待ち時間(ピックバン・試合間)』の比率を悪化させる」、という批判。 【本文確認】 — [Game Developer: On the eSports Failure of Heroes of the Storm](https://www.gamedeveloper.com/design/on-the-esports-failure-of-heroes-of-the-storm)(個人の批評)
- Death's Gambit の GDC 講演系記事・Shadow Fight 3 記事は、フェーズ数や HP 閾値に言及するが、戦闘の長さ(分)は示さない。 【本文確認】 — 上記各記事
- 「戦闘が長すぎる/ボス戦の報酬までの距離が遠いと余計な時間に感じる」(シルクソング分析)。 【本文確認】 — [AUTOMATON ヌヌヌ](https://automaton-media.com/articles/columnjp/nununu-20260830-464035/)
- 前回調査で得た、Atlus のバトル企画「プレイヤーは死んで時間を無駄にした感覚に敏感」(Metaphor)は今回も二次資料のみ。 【要約のみ】 — [Push Square](https://pushsquare.com/news/2025/03/rpg-fans-very-sensitive-to-feeling-like-they-wasted-time-says-atlus-battle-designer)

### Inferences
- Clash Royale の「中間点で全体の速度を倍にする」は、**オート戦闘で「ペース曲線を時間設計だけで作る」具体例**として使える(例: 90秒雑魚戦の後半で速度/ダメージ倍率を上げる)。ただし同記事は設計者本人の説明ではなく外部分析。
- 数値目標(90秒/7分)は、この調査では根拠が取れないので、プレイテストで「再計画の山(視覚的イベント)の数」を測るしかない(Game Developer ペース記事の方法論はプレイテスト値で曲線を描くこと)。

### Gaps
- 名作の通常戦/ボス戦の実測時間、1分あたりの意味ある決定数、TTK の設計者発言: 一次資料なし。
- CEDEC/4Gamer/電ファミで戦闘時間を扱った記事: 見つからず。

---

## (c) オート戦闘の観戦性

### Takeaway
オート戦闘そのものの観戦設計を扱った一次資料は**見つからなかった**。代替として、観戦性に関する外部事例(Clash Royale の非対称情報、HotS の「個人の物語が語れない」批判)と、読みやすさ/予兆の論(Death's Gambit)が得られた。ウマ娘のCEDEC講演は映像制作ツールの話で、レース展開の観戦設計ではなかった。

### Cited Findings
- 観戦が面白くなる条件: 観戦者は盤面と双方の手札(手の内)が見えるが、プレイヤーの頭の中は見えない。この「非対称な知識」+「手札が見えること」がeスポーツやポーカーの観戦性の理由。 【本文確認】 — [Game Developer: Clash Royale](https://www.gamedeveloper.com/design/clash-royale---deconstructing-supercell-s-next-billion-dollar-game)
- HotS批判: 個人の統計がなく、「序盤に苦戦して劇的に巻き返す選手」「序盤に支配して失速する選手」などの物語が語れない。「優れた個人プレー」を示すUIがなく、プレイが逸話的になる。 【本文確認】 — [Game Developer: On the eSports Failure of HotS](https://www.gamedeveloper.com/design/on-the-esports-failure-of-heroes-of-the-storm)(個人の批評。一部の見解)
- 「読みやすさ(readability)」=予兆(何が起きる前に)+期待(起きた後に)。「死ぬのが分からずに死ぬと炎上動画になる」。 【本文確認(冒頭のみ)】 — [Game Developer: Designing for Difficulty: Readability in ARPGs](https://www.gamedeveloper.com/game-platforms/designing-for-difficulty-readability-in-arpgs)
- 敵の予兆が重ならず区別できること(muddy reads の回避)と、重要な物だけ見せること(staging: 重要でない対話可能物を置くとプレイヤーはそれだけをいじる)。 【本文確認】 — [Birkhead](https://gamedeveloper.com/design/opinion-boss-design---tips-from-a-combat-designer)
- ウマ娘: CEDEC2025「躍動感はどのように生まれたのか」は、ゲーム外映像制作(Unity素材撮影ツール、デプスバッファ/マスク出力、AfterEffects合成)の話。レースの観戦設計ではない。【本文確認】 — [電ファミ](https://news.denfaminicogamer.jp/kikakuthetower/2507222p)。走りモーションは手付けという報道もある 【要約のみ】 — [CGWORLD](https://cgworld.jp/article/202508-cedec-umamusume.html)
- 競馬を知らない人でも魅力を楽しめるものを目指した、というファミ通インタビュー。 【要約のみ】 — [ファミ通](https://www.famitsu.com/news/202203/10253665.html)

### Inferences
- 「観戦者に手の内(編成・スキル・敵の予告)を見せ、結果への期待(アンチシペーション)を作る」という方針は、本作の「4体配置+戦術選択」後にオートで進む構造と相性がよい。ただし出典は外部分析で、一般化は慎重に。
- 戦闘中の「誰が貢献したか」を物語化する表示(貢献、起死回生の場面)が無いと、HotS と同じ「個の物語が語れない」状態になる可能性がある(推論)。

### Gaps
- オートバトラー(TFT/Underlords 等)、スポーツ/経営シム、ウマ娘のレース演出における観戦設計の一次資料、eスポーツ観戦ツールの本文: 取得できず。
- 接戦の演出、ハイライト、戦後ブレークダウンの裏付け: なし。

---

## (d) 失敗パターンの出典付け/低入力のエージェンシー

### Takeaway
**決着後の消化試合(mop-up)、偽の選択、支配戦略は、定義・理由づけの出典が得られた。ダメージスポンジ、過剰RNG、長い演出、配置が効かない問題は一次資料なし。** 低入力設計(介入リソース、一時停止命令、プログラム可能な条件、予測/賭け)の評価は得られていない。

### Cited Findings
**広く共有された原則**
- 興味深い決定の条件: トレードオフがある、状況依存、個人の好みが出る、持続的(後で効く)。「いつも3つの選択肢の最初を選ぶ、またはランダムなら興味深くない」。情報は多めに出す方が良い(「too much information の側に誤る方がまし」)。 【本文確認】 — [Game Developer: GDC 2012 Sid Meier](https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions)(前回の4性質は確認できた)
- 決定が興味深くなる条件(結果がある/結果が予測できる/自明でない)。自明でない例: 劣った選択肢(Big Burn / Bad Burn)が単純に劣位なら「興味深い決定ではない」=**支配される選択肢**。結果が変わらない物語選択(Telltale)は、気づくと興味を失う=**偽の選択**。分析麻痺、選択のパラドックス(選択肢が多いほど満足度が下がる)と、ブレイムの感覚(情報が多すぎるとミスが自己責任に感じる)。「決定が楽しさの邪魔なら簡素化/削除すべき」。 【本文確認】 — [Game Developer: Designing Interesting Decisions in Games (And When Not To)](https://www.gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to-)(Rempton Games の再掲。個人の意見だが Meier と同方向)
- Death's Gambit: 「メイン攻撃の連打が最適にならないよう、クールダウン中のスキルがあると3段目が大ダメージ、等の上乗せ」を設計し、連打が最適戦略になるのを回避。防御手段(回避/パリィ/ブロック)も状況により最適が変わるようにしている。 【本文確認】 — [Game Developer: Death's Gambit](https://www.gamedeveloper.com/design/die-die-die-boss-battle-design-in-i-death-s-gambit-i-)
- 「強度=再計画の頻度」の定義は、プレイヤーが同じ行動を続けられる状況(選択が実質1つ)は強度が下がる、という含意を持つ。 【本文確認】 — [Pacing 記事](https://www.gamedeveloper.com/design/the-art-and-science-of-pacing-and-sequencing-combat-encounters)
- 序盤に勝敗が分かる/消化試合: 「ゲームの結果は定義上不確実であり、途中で結果が分かるとプレイは『mop-up』になる」、スノーボールは勝負を早く終わらせる設計として有効だが単純化しすぎることもある。 【要約のみ】 — [pcgamesn 等の検索結果群](https://code.tutsplus.com/the-snowball-effect-and-how-to-avoid-it-in-game-design--cms-21892a) / [Sirlin: Slippery Slope and Perpetual Comeback](https://www.sirlin.net/articles/slippery-slope-and-perpetual-comeback)(検索結果にリンクが出ただけで本文未読。「mop-up」という名前の権威ある単一出典は見つからなかった)
- 圧倒的に有利になった時点で試合を終えるべきだ(Pulsipher の主張)。コメバック/キャッチアップ機構が標準的な対処。 【要約のみ】 — 同上(スノーボール関連の検索結果群)

**低入力設計(今回は出典なし/限定的)**
- 敵の意図(intent)アイコンの話は前回の二次メモのみ。Yano 講演の本文は未確認で、GDC Twitch の告知記事は本文が短い。 【要約のみ】 — [Game Developer: Watch Casey Yano](https://www.gamedeveloper.com/game-platforms/watch-casey-yano-break-down-the-design-decisions-behind-i-slay-the-spire-i-)
- Yano は Slay the Spire 2 のQ&Aで、ランが長引くほどデッキ構築が面白くなくなる、と語ったとされる(検索結果要約)。 【要約のみ】

### Inferences
- 「敗北/勝利がほぼ確定した後の残り時間」は、観戦型のオート戦闘で最もテンポを損なう要素。Clash Royale 型の「時間経過で全体加速」か、勝負確定時に演出を切り上げる(スキップ/倍速)かを選ぶ設計になる(推論)。
- Meier/Rempton の3条件(結果がある・予測可能・自明でない)は、本作の「配置」「戦術選択」を点検する基準になる: 配置を変えても結果が変わらなければ偽の選択、常に同じ戦術が最良なら支配戦略(推論)。

### Gaps
- ダメージスポンジ、過剰RNG、長いスキップ不可の演出、配置が影響しない問題の一次資料。
- 介入リソース(必殺ボタン)、一時停止命令、プログラム可能条件(FF12ガンビット論)、事前の予測/賭け、フェーズ間の選択イベントの評価: 設計者発言・実証データなし。FF12は前回の二次レビューのみ。
- Keith Burgun、Raph Koster、Daniel Cook 原典、Schreiber & Romero "Game Balance" の本文: 今回も未取得(Cook はホスト許可外の可能性)。

---

## 追加メモ(再調査のとき)
- curl で本文を取得できた gamedeveloper.com のページは、WebSearch で候補URLを出してから curl で取る方法が有効。未取得でヒットだけした候補: Angelical Echo ボス記事(3つのHP閾値でフェーズ難度調整とされる)、"Examining Game Pace: How Single-Player Levels Tick"、"The Evolution of Boss Designs in Video Games"、"video game boss design for shmups"(いずれも【要約のみ】: https://www.gamedeveloper.com/design/design-deep-dive-angelical-echo-boss-fight など)。
- 公開前の一次資料として優先度が高いのは、GDC Vault の Meier 講演(未確認)、Into the Breach / Slay the Spire の GDC 講演、TFT の GDC 講演、ウマ娘の別CEDEC講演(レース演出系)。
