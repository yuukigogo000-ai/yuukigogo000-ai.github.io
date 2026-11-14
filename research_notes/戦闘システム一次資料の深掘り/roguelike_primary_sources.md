# ローグライク/デッキ構築/コンパクト戦術ゲームの戦闘設計: 一次資料の深掘り

方法と範囲(先に明記): WebFetch ツールは gamedeveloper.com / gmtk.substack.com / pcgamer.com を名前解決できず失敗したが、Bash の curl では許可ホスト(gamedeveloper.com、gmtk.substack.com、en/ja.wikipedia.org、news.denfaminicogamer.jp、automaton-media.com、gdcvault.com)の本文を取得でき、全文を読んだ。ラベル規則: 【本文確認】=取得した全文を読んで確認、【要約のみ】=検索結果スニペットのみ(ブロックされたホストや本文を取れなかったもの)。【本文確認】でも Wikipedia は二次資料(開発者発言の再録)であり、その旨を付す。pcgamer.com は DD 記事のみ curl で取得でき、ITB 記事は取得不可。gonintendo、80.lv、slaythespire.wiki.gg は curl も接続不可。GDC 講演の動画・スライド本体は一度も閲覧できていない(gdcvault は要約ページのみ)。講演の中身は二次記事経由。

先行調査(reports/戦闘システム先行事例リサーチ.md)との差分: 先行調査は全件スニペットだった。本ノートで【本文確認】に格上げできたのは、StS の intent 導入経緯、StS のデータ駆動バランス(Game Developer 2018)、StS の Act3 ボス設計意図(電ファミ)、ITB の「戦闘を短く保つための固定ターン+予告」(Wikipedia 経由の開発者発言)、Balatro の GMTK 記事全文、Loop Hero ポストモーテム、Darkest Dungeon の Affliction 解説記事と後日の「不評機構をオプション化」、Vampire Survivors のセッション長、Slice & Dice の AUTOMATON 記事。戦闘秒数・ボス所要時間は、依然としてほぼ一次資料なし(後述)。

## Q1. Slay the Spire: 敵の行動予告(intent)の導入理由、戦闘の長さ、エリート/ボスの違い、データ駆動バランス

### Takeaway
intent は「事前に見せるほうが、永久死のあるローグライクと噛み合う」という判断で生まれ、まず「次の行動を個別クリックで見る方式」を試して複数敵で破綻し、アイコン方式に移り、最終的に攻撃ダメージの数値まで見せる形に落ち着いた(数値を隠すより見せるほうがプレイヤーに好まれ、戦略を生んだ)。ボスは「特定ビルドを潰す尖った性質」を意図的に持たせた設計(Act3)で、データで調整された。戦闘の秒数・ターン数の一次データは得られなかった。

### Cited Findings
- 当初、敵は次の行動を表示しなかった(多くのターン制RPGと同様)が、永久死のあるローグライクと噛み合わなかった。プレイテストで、プレイヤーはカードの多様な効果をどんな状況で使うべきか分からず混乱した。そこでまず、対象を選んで「Next Turn」で行動を見る方式を作った(Giovannetti によればこれが独自性を生み、説明しやすいバフ/デバフを作れるようにした)が、複数の敵がいると UI 上の問題が残り、アイコンで次の行動を示す「Intents」に移行した。初期のアイコンは攻撃数値を出さず、武器の絵で威力帯を示すだけだった。Giovannetti は数字を出し過ぎるとプレイヤーを圧倒して敬遠させると考えていたが、プレイテストの結果、数値を見せたほうが「より面白く」「各記号の意味を覚える必要がなく」「新しい戦略が生まれる」と分かった 【本文確認・二次(Wikipedia が Giovannetti 発言を要約。GDC/インタビュー原典ではない)】 — [Wikipedia: Slay the Spire](https://en.wikipedia.org/wiki/Slay_the_Spire)
- 現行の戦闘は毎ターン手札を引き直し、エネルギー3で任意のカードを出す。各敵は次の行動(攻撃と威力/ブロック/バフ/デバフ)を予告する。「ターン終了後に一切ダメージを受けない戦略を自分で見つけられる」とされる 【本文確認・二次】 — [Wikipedia: Slay the Spire](https://en.wikipedia.org/wiki/Slay_the_Spire)
- 先行調査にあった「intent は Twitch 時代に攻撃を分かりやすく伝える手段」「複数敵だと毎回クリックが必要だった」という説明は、ファンサイトや要約サイト(lilys.ai)由来で、一次の講演・記事は得られていない 【要約のみ】 — [lilys.ai 要約](https://lilys.ai/notes/1046045)(WebSearch 結果。上の Wikipedia の経緯と矛盾はしない)
- データ駆動バランス(Game Developer, 2018): プロトタイプ段階(Netrunner のプレイテスター)からメトリクスサーバーでプレイヤーの全判断を記録した。取る指標は、カードが提示されたときの選択率、何と比較して選ばれたか、勝利デッキへの出現率、特定の敵から受けたダメージ平均。最重要の2指標は「選択率(低すぎると事実上ゲームに存在しないカード)」と「勝利デッキへの出現率(高すぎると強すぎる)」。最初のメトリクスは3つのグラフだったが2018年時点で90以上。「1時間で、プロトタイプ期間中に得たデータより多く集まる」。ただし数学的に直すのではなく、パターンを見て直感で調整した。「データは感触を教えてくれない」ので Discord の定性フィードバックも併用 【本文確認】 — [Game Developer: How Slay the Spire's devs use data...](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)
- ボスの調整事例: データで、Power カードの多いデッキが Act3 のボス「Awakened One」(Power を使うたびに筋力を得る)に苦戦していると分かり、筋力の増加率を下げ、代わりに全体のダメージを上げた。Yano「Act3最初に当たるボスなので弱くしたくなかった」。再テストで突破率が上がったことを確認した 【本文確認】 — 同上
- ボス設計の意図(電ファミ, 2020, Anthony 氏): Act3 の最終ボスは3種類で、それぞれ特定戦略を潰す尖った性質を持つ(例: Power 大量ビルドには、Power を使うたび攻撃力が上がる「目覚めし者」、大量ドロー手数ビルドには12枚使うと強制ターン終了の「タイムイーター」)。「プレイヤーに体験してほしいのは、Act3 ボスに合わせてデッキ構成を調整すること。決められたことを毎回こなすのではなく、よりダイナミックであることが重要」。ボス難度は高く、対ボス用に構築しても負けうる。さらに新 Act に入った時点で、最後に待つボスがどのタイプか分かる(=事前に対策を立てられる) 【本文確認】 — [電ファミ: StS 開発者インタビュー](https://news.denfaminicogamer.jp/interview/200117b)
- 同インタビューで、デッキ設計の基準: 「シングルプレイなので圧倒的な強さの体験はあるべき。ただしそれは特定の強いカードではなく、プレイヤーの工夫で勝ち取るものだと考える」。ローグライク要素でカードが毎回違うので、「ブロックや毒を2倍にする」ような対戦ゲームなら壊れになるカードを出せる、という発想(強いコンボを許す自由)。Giovannetti 自身は Game Developer でも「コンボと強いシナジーは設計の柱。シングルプレイなので強コンボで相手が不快になる心配はない」と述べた 【本文確認】 — [電ファミ](https://news.denfaminicogamer.jp/interview/200117b)、[Game Developer: Road to the IGF (2020)](https://www.gamedeveloper.com/disciplines/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-)
- 敵の設計意図: 「多様な戦略を異なる形で試す幅広い敵が欲しかった。常に支配的な単一戦略が存在しないようにしたかった」 【本文確認】 — [Game Developer: Road to the IGF](https://www.gamedeveloper.com/disciplines/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-)
- 構造: 各階層は分岐マップで、モンスター(強さが異なる)、エリート(強化された報酬)、焚き火(回復/強化)、店、宝箱、イベント、最後にボス。マップの分岐は FTL に着想を得た。Giovannetti は「経路選択は、複雑さを増やさずに戦略の層とリスク/リワードを足す」と述べた。1戦勝つたび3択でカード1枚を取る(取らない選択も重要) 【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)、[Game Developer: Road to the IGF](https://www.gamedeveloper.com/disciplines/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-)、[電ファミ](https://news.denfaminicogamer.jp/interview/200117b)
- カード数: 1キャラのプールは約75枚が適量(増やすとデッキ構築が散らかる。Netrunner の教訓)【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)
- GDC 2019 の講演 'Slay the Spire': Metrics Driven Design and Balance の存在は GDC Vault ページで確認したが、講演本体(動画/スライド)は未閲覧。講演の中身(選択率・勝利率など2指標)の要約は検索結果のみで、2018年の Game Developer 記事と同内容 【要約のみ】 — [GDC Vault](https://www.gdcvault.com/play/1025731/contactUs)
- エリートがボスや通常戦とどう違うか(HP・長さ・リスク/リワード設計)についての開発者の一次発言は見つからなかった。公式ウィキ的な記述としては「エリートは強化された報酬」のみ(上記 Wikipedia)。
- StS の高速モード: 「Weekly Patch 11 – A Library of Features」で、スピードランナー向けとして設定画面のチェックボックスで入る Fast Mode が追加され、以後の更新で個別の演出が高速化されている(例: Grand Finale が Fast Mode で0.3秒速く、Gremlin Leader の召喚が高速)との検索結果。実際の追加日は特定できず、ページ(wiki.gg)は取得不能 【要約のみ】 — [StS wiki Weekly Patch 11](https://slaythespire.wiki.gg/wiki/Weekly_Patch_11_-_A_Library_of_Features)、[Weekly Patch 14](https://slaythespire.wiki.gg/wiki/Weekly_Patch_14_-_Bullet_Time)
- 続編 StS2 はマルチプレイを加え、協力時は「敵のHPを増やし、攻撃が全プレイヤーを対象にして」バランスを取る、との記述。早期アクセスの初期パッチで強すぎるループを作れるカードを修正したところレビュー爆撃を受けた 【本文確認・二次】 — [Wikipedia: Slay the Spire II](https://en.wikipedia.org/wiki/Slay_the_Spire_II)

### Inferences
- intent の本質は「相手の手を見せて、プレイヤーの手を『答え』にする」ことで、最初は数値を隠すつもりだったのに数値を出したほうが戦略が生まれた、という経緯は、本作の自動戦闘でも「敵の予告は曖昧にせず具体値で見せる」根拠になる(自作への応用に関する推論)。
- Act3 ボス設計は「ボスの種類が事前に分かる→編成を調整して挑む」構造で、これは「準備に判断を集約」する設計と整合する。本作では「ボス戦前に弱点が見える→作戦と並びを組み直す」にそのまま転用できる(推論)。
- 選択率・勝利デッキ出現率の2指標は、本作でも「作戦/配置の選択率」と「勝利時の使用率」で測れば、配置や作戦が無意味になっていないか検出できる(推論)。

### Gaps
- GDC 講演本体の内容(戦闘の長さ、エリート/ボスの設計意図、intent の経緯の原話)は未取得。
- 1戦の秒数/ターン数の公式な数値なし。

## Q2. Into the Breach: 完全情報、予告された攻撃、固定ターン数、削ったもの

### Takeaway
ITB は「戦闘を短く保つ」ために制限ターン数(固定)を導入し、敵の動きを予告表示することで進行がさらに速くなった、と Wikipedia が開発者発言として記す(XCOM は1戦1時間に及ぶことがあるのに対する意識)。「完全情報」という語そのものを開発者が講演で明言したことは今回確認できなかった。削った内容は GDC 告知と二次記事で確認(都市建設・技術ツリーなど)。

### Cited Findings
- 各マップに目標と固定の制限ターン数がある。敵は毎ターン移動して攻撃し、攻撃の方向、移動数、残HPが画面に表示される。新しい敵が各ターン後に出現。プレイヤーは各メカを動かし1武器を撃つ。メカのダメージは戦闘後に完全回復。戦闘は 8×8 グリッド 【本文確認・二次(Wikipedia)】 — [Wikipedia: Into the Breach](https://en.wikipedia.org/wiki/Into_the_Breach)
- 「XCOM では単純な戦闘でも最大1時間かかり得るのに対し、Subset は各戦闘のプレイ時間を比較的短くしたかった。制限ターンカウンターが戦闘を短く保つために使われ、敵の動きの予告がさらに進行を速めると分かった」 【本文確認・二次(Wikipedia が開発者発言を要約。原典の講演/インタビューは未確認)】 — [Wikipedia: Into the Breach](https://en.wikipedia.org/wiki/Into_the_Breach)
- 設計のフック: 映画(『マン・オブ・スティール』『パシフィック・リム』)の「街が壊滅しても勝ったから誰も気にしない」への反応で、付随被害(建物=電力網)を守ることを優先事項にした。建物が壊れるとメカを動かす電力が落ちる。これにより「短期の優位のために建物を壊すか」という難しい決断が生まれた 【本文確認・二次(Wikipedia)】 — [Wikipedia: Into the Breach](https://en.wikipedia.org/wiki/Into_the_Breach)
- 負けた場合は、パイロット1人を過去へ送って最初のミッション前から経験とスキルを引き継いで再スタートする(ラン構造)。島ごとに複数のシナリオ(島の数は本文未確認) 【本文確認・二次(Wikipedia)】 — [Wikipedia: Into the Breach](https://en.wikipedia.org/wiki/Into_the_Breach)
- GDC 2019「'Into the Breach' Design Postmortem」(Matthew Davis): 4年間の削除と反復を扱い、「どの機能を切るか」「ほかのゲームの要素をどう『盗む』か」「正しい難易度をどう決めるか」「どれだけ RNG を使うか」を論じる、という GDC の告知文 【本文確認(告知文)】。講演本体は未閲覧 — [Game Developer: GDC 2019 告知](https://gamedeveloper.com/design/get-an-inside-look-at-the-making-of-i-into-the-breach-i-at-gdc-2019-)
- 開発者の別の討議(2018, Twitch): 絶え間ないプレイテストで分刻みの手触りが良くなった反面、戦闘外のメタ戦略は「長い制作工程を信じて早く決める」必要があり「フラストレーション」だった。分隊(スクワッド)を最初から定義しておくことは、ビルド変動を減らしてランダム性を下げ、バランス調整も楽にする、と Davis が述べた 【本文確認】 — [Game Developer: Into the Breach's designers explain...](https://gamedeveloper.com/design/-i-into-the-breach-s-i-designers-explain-how-to-follow-up-from-a-hit-game)
- 「全情報が見える」「死が自分のミスだと感じられるものにしたかった」という引用は先行調査にあるが、gamedeveloper.com の元記事(Road to the IGF)は今回取得していない。検索要約で、GDC 2019 のパネルで「60%を切った」ことが「closest thing to our eureka moment」だったとの引用があり、都市建設・複数スクワッドが初期案だったとされる 【要約のみ】 — [GoNintendo(全文記事)](https://gonintendo.com/stories/334421-full-gdc-2019-dev-panel-into-the-breach-design-postmortem)、[PC Gamer](https://pcgamer.com/into-the-breach-originally-had-city-building-and-tech-trees-creators-reveal)
- 先行調査にあった「5ターン戦闘」は、今回の本文確認でも「固定ターン数(ある)」止まりで、数値(5)は確認できなかった。やり直し(アンドゥ)機能の導入時期・経緯も未確認。

### Inferences
- 「固定ターン数+予告」で1戦を短くする設計は、本作の「雑魚90秒」を守る装置として直接参照できる。自動戦闘なら「ターン上限+上限に近づくと敵が強まる(あるいは時間切れ判定)」が対応物になりうる(推論)。
- ITB の1戦は入力のたびに考えるので「1戦の中の判断数」は多いが、戦闘自体を短くすることで負担を抑えている。本作は逆に判断数を戦闘前に寄せるので、ITB の技法(予告・短さ)だけを借り、「毎ターン入力」は借りないのが整合的(推論)。

### Gaps
- 講演本体と Road to the IGF 記事本文(「死は自分のミス」の原文)は未閲覧。5ターン、アンドゥの経緯、1戦の実時間は未取得。

## Q3. Balatro / Slice & Dice / Wildfrost / Monster Train / Inscryption / Peglin(戦闘の見せ方と間)

### Takeaway
Balatro は「結果を隠して装置が動くのを眺める緊張」を意図し、その副作用(外部計算ツール)も開発者が認識している。1ラウンドは「限られた手数(hands)と捨て札(discards)で目標点を超える」短い単位。Slice & Dice は「敵が先にロール→再ロールで調整」で運を調整可能にしている。他タイトルは本文取得が限られ、構造の確認にとどまる。

### Cited Findings
- Balatro(GMTK, Mark Brown, 2024-04-02): 開発者 LocalThunk は「ルーブ・ゴールドバーグ装置を組んで、ラウンドに勝つか分かる前に動かして眺めるほうがゲームは楽しいと個人的に信じている」と述べた。スコア表示を出さない理由は、(1) 演出の盛り上がりを損なう、(2) ランダム性のあるカードでレンジ表示が難しく UI が煩雑になる、(3) 全手を確認させて遅くなる、(4) 「穏やかにカードで遊ぶゲーム」から「表計算的な戦略ゲーム」に変わる。Mark Brown は「スコア予告を隠すのは、プレイヤーを素早く行動させ、サスペンスとドラマを生むため」と整理 【本文確認】 — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- 同記事: 情報は「隠されているが計算すれば得られる」半端な状態で、計算機アプリや表計算を使うプレイヤーが出ている(Soren Johnson の「機会があればプレイヤーはゲームから楽しさを最適化で消す」)。プレイテスト時は山札の残りが見えなかったが、多くのプレイヤーが数えていたため、LocalThunk が Deck Peek を追加した。スコア予告をオプションにすると「みんなそれをクリックして、意図した体験をしなくなる」と LocalThunk は拒否(Eggplant ポッドキャスト発言の引用)。Brown の折衷案: 後半解放、オプションの説明文(Celeste の Assist Mode 方式)、MOD に任せる、チートコード 【本文確認】 — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- Balatro の構造: ラン = 8つの「ante」、各 ante は Small/Big/Boss の3ブラインド。1ラウンドで限られた hands と discards で目標チップを超える。Small/Big はスキップ可(報酬と引き換え)、Boss Blind を倒すと次 ante へ。ラウンドごとにショップ。Ante 8 を超えるとクリア、以降エンドレス 【本文確認・二次(Wikipedia)】 — [Wikipedia: Balatro](https://en.wikipedia.org/wiki/Balatro)
- Slice & Dice(AUTOMATON, 2024): 5人パーティ、各ヒーロー/モンスター6面ダイス。敵が先にロールして行動を決め、プレイヤーはその行動を見てダイスを振り、1ターンに決まった回数まで一部または全部を再ロールできる(「小さなミスでランが台無しになる心配がない」)。全20戦+最終ボス。難易度は「Heaven」から「Hell」の7段階、Raid モードは10人で敵2倍 【本文確認】 — [AUTOMATON: Slice & Dice](https://automaton-media.com/en/news/slice-dice-strategic-monster-battling-roguelike-with-tons-of-variety/)
- Wildfrost: 6スロットの盤面で2レーン、カードがカウンターを持ち0で行動、味方は動かして回避/ブロック。最終ボスは Emperor Shade(Frost Guardian に憑依)。倒すと自分のリーダーが次の守護者になり、解放される Storm Bell で難易度を段階調整できる。Rock Paper Shotgun は「運の比重が時に大きい」、Siliconera は「バランスに難」と評した(Wikipedia の評価一覧) 【本文確認・二次】 — [Wikipedia: Wildfrost](https://en.wikipedia.org/wiki/Wildfrost)
- Monster Train: 4階建ての縦盤面。最上階のパイアを守る。召喚は下3階のみ 【本文確認・二次】 — [Wikipedia: Monster Train](https://en.wikipedia.org/wiki/Monster_Train)(ボスが「往復の攻防を長く続ける」という先行調査の記述は Rogueliker 要約のままで未確認)
- Inscryption: 3×4グリッド(第3幕で3×5)。3幕構成で、同じ基本ルールの上でゲーム性が変わる。出自は2018年 Ludum Dare 作品(Sacrifices Must Be Made)の拡張 【本文確認・二次】 — [Wikipedia: Inscryption](https://en.wikipedia.org/wiki/Inscryption)(「ボスは2ライフ」は Well-Played 要約で、今回は未再確認)
- Peglin: パチンコ式で玉を撃ち、ペグに当たった数で威力が決まる。4クラス。「プレイヤー自身の攻撃とHPをバランスする」ターン制RPG 【本文確認・二次】 — [Wikipedia: Peglin](https://en.wikipedia.org/wiki/Peglin)(ボスが粘着線で盤面を乱す等は God is a Geek 要約のまま)

### Inferences
- Balatro の知見は「結果を予告するか隠すか」で、隠すなら『見せ場(演出)を厚くする』のが必須条件。本作の自動戦闘は元から「結果を見る」形なので、演出と因果表示(どの設定が効いたか)を戦闘後に出す設計が、Balatro の最大のリスク(外部ツール依存=最適化で楽しさが消える)を避けつつ緊張を保つ折衷になりうる(推論)。
- Slice & Dice の「敵が先にロール→再ロール」は、運の分散を事前に抑える装置で、本作では「戦闘前に敵の編成/特性を見せ、並びと作戦で調整する」と同型(推論)。

### Gaps
- Monster Train / Inscryption / Peglin / Wildfrost の開発者インタビュー本文は取得できず、戦闘の長さ、ボス構造の設計意図は未確認。
- Balatro の1ラウンドの実時間は一次資料なし。

## Q4. Darkest Dungeon: ストレス/配置と、不評機構の扱い

### Takeaway
ストレスは「戦う意志(willingness)」をモデル化するために入れた、制御を奪う機構で、意図的に不透明にした部分と、メーターだけは完全に見せた部分がある。ただしEarly Accessで追加した「死体」と「ストレスによる心臓発作即死」は不評で、オプション化された。

### Cited Findings
- Affliction システム(2015年の自作解説): 英雄のストレスが100に達すると「Affliction チェック」。失敗(よくある)で一時的な行動不能的状態(利己的/絶望/偏執/臆病/マゾ的/不合理など)、成功で Heroic(周囲を鼓舞)になる。ストレスは町での休息(酒、賭博、瞑想、祈りなど)で下げるが、町の施設枠に限りがあり、ボードゲーム的な割り当て問題になる 【本文確認】 — [Game Developer: Darkest Dungeon's Affliction System](https://gamedeveloper.com/design/game-design-deep-dive-i-darkest-dungeon-s-i-affliction-system)
- 設計意図: 「戦う能力は方程式の半分。戦う意志はどうか」「コントロールを完全には持てない居心地の悪い状況に置く。これは中心の柱で、全機構がそれを補強する」。Affliction は戦闘/野営/探索でそれぞれ異なる効果で、英雄が勝手に動く。ストレスメーターは「当初は避けたかった」が数値(+20 Stress など)で完全に見せた。「ゲームにできる対象になり、明確なフィードバックと結果を与える」。一方、各 Affliction の挙動は意図的に列挙しない 【本文確認】 — 同上
- Tyler Sigman の GDC ポストモーテム(PC Gamer 報道): 講演の相当部分が Affliction/ストレスで、Early Access の1年でほとんど変わらなかった。「ターン制戦闘ゲームでDPSが5%低いことを気にするのに、ターンを丸ごと奪うシステムがある。このバランスは難しく、期待値を作るのが難しかった」と、エージェンシー(主体性)を奪う機構の難しさを述べた 【本文確認(PC Gamer 記事の本文は curl で取得した全文)】 — [PC Gamer: How Darkest Dungeon got inspiration from Band of Brothers and Aliens](https://www.pcgamer.com/how-darkest-dungeon-got-inspiration-from-band-of-brothers-and-aliens)
- 不評機構とその対応: 2015年7月ごろ Early Access で追加した、(1)死体が戦闘の位置取りに影響、(2)高ストレスで心臓発作により即死、の2つに「すでに難しいゲームに対し不利が過ぎる」と苦情が出た。開発側は議論の末、この2つを「オプション」にした。変更は概ね歓迎されたが、一部のプレイヤーは以後も不満を引きずった。2016年5月の更新(Everything Burns)で追加した町イベントも、オプションで無効化や頻度低下が可能 【本文確認・二次(Wikipedia)】 — [Wikipedia: Darkest Dungeon](https://en.wikipedia.org/wiki/Darkest_Dungeon)
- Darkest Dungeon は4人パーティの隊列位置が戦術の中心(位置に依存する技が多い)。これは先行調査の Steam レビュー要約。Wikipedia の本文は、探索はリアルタイム、戦闘はターン制で、4人を選んで手続き生成ダンジョンに入る、と記す 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Darkest_Dungeon)

### Inferences
- 「運に近い強制介入(ストレスの発狂)」は、理不尽感の源になりやすく、Red Hook 自身がオプション化で対処した。本作でも、プレイヤーの作戦を覆す要素(敵の妨害など)を入れる場合は、予告が出せるか、オフにできるかを先に決めるべき(推論)。
- ストレスを「HP以外のラン通しの資源」とする点は、短い戦闘に意味を持たせる(戦闘が終わっても消費が持ち越される)好例(推論)。

### Gaps
- 講演本体は未閲覧。「不評だった機構」の講演内容(Sigman が何を不評と認識したか)は Wikipedia 経由のみ。

## Q5. Loop Hero / Vampire Survivors / Hades / FTL / Shiren / Dungeon Encounters / Luck be a Landlord

### Takeaway
自動戦闘/低入力系は「戦闘を見ているだけ」にならないよう、(a)長い戦闘を避ける仕組み(Loop Hero の昼夜と出現頻度制御)、(b)セッション長の上限(Vampire Survivors は15〜30分で死神)、(c)難易度を後から調整できる救済(Hades の God Mode、DD のオプション)、を持つ。開発者の戦闘設計意図に直接触れた一次資料は薄い。

### Cited Findings
- Loop Hero ポストモーテム(Four Quarters, 2021): 元は「ヒーローが自動で道を歩き敵を斬り、プレイヤーは装備と道の構築だけをする放置系」の Ludum Dare 作品。最初のモックアップの説明に「墓地は n 日に1回スケルトンを出す(長い戦闘にさまよい込みたくないので)」とあり、戦闘が長引かないよう出現の頻度を設計していた。インベントリは満杯になると最古のアイテムが破棄され、「考える時間はあるが時間を無駄にはできない」ようにした。ボスは最初の計画「ボス4体、キャンプ、無限に周回するヒーロー」の中核。トレイトは開発の3分の2地点、ボス撃破の恒久パークは最終盤に追加された 【本文確認】 — [Game Developer: Postmortem: Loop Hero](https://gamedeveloper.com/design/postmortem-loop-hero)
- 同ポストモーテム「小規模チームでは要素を少なく絞って各々を磨く」。バンディットのメカニクス(盗む等)をリリース直前の最終週にテスト後に追加し、バグが多発した、という失敗も記す 【本文確認】 — 同上
- ゲーム概要(Wikipedia): 敵に出会うと自動戦闘。勝てば資源、負けると獲得資源の70%を失って拠点に戻る。ランドスケープカードを置くとボスゲージが上がり、満ちるとキャンプタイルにボスが出現。ボスを倒すとストーリーが進む 【本文確認・二次】 — [Wikipedia: Loop Hero](https://en.wikipedia.org/wiki/Loop_Hero)。Loop Hero の自動戦闘/ボスの設計意図に関する開発者インタビュー本文は取得できず(検索では Windows Central / GamesBeat の存在のみ確認、本文未読)。 【要約のみ】 — [Windows Central 開発者インタビュー](https://www.windowscentral.com/loop-hero-interview)、[GamesBeat](https://gamesbeat.com/the-d20-beat-loop-hero-has-cast-a-calm-strategic-spell-over-me/)
- Vampire Survivors: プレイヤーは移動のみ、武器は自動攻撃。1セッションに「ソフト制限時間」15/20/30分(ステージによる)があり、時間が来ると敵が一掃され死神が出現、以降1分ごとに追加される。時間到達でクリア。ハイパーモード(速度上昇)、エンドレスモードなどを後から追加。作者は2020年に失業中に Magic Survival(2019年のモバイルゲーム)に着想を得て作り始めた 【本文確認・二次】 — [Wikipedia: Vampire Survivors](https://en.wikipedia.org/wiki/Vampire_Survivors)
- Vampire Survivors の作者 Luca Galante は「なぜ成功したか分からない」「ビジョンなく、要素を足して楽しくなるか試した」と述べた(複数媒体の要約)。「なぜ楽しいか」の設計意図的な一次の説明は得られていない 【要約のみ】 — [PCGamesN](https://www.pcgamesn.com/vampire-survivors/creator-roguelike-successful)、[PC Gamer](https://pcgamer.com/vampire-survivors-creator-didnt-have-a-vision-when-he-started-making-the-game-that-allowed-him-to-quit-his-job)
- Hades: 部屋を進み、ボスは各セクションの最後。Pact of Punishment でボス戦にフェーズを追加できる(例: Hades に追加フェーズ)。God Mode は失敗のたびにプレイヤーが強くなる設定で、苦戦する人が物語を最後まで体験できるようにする 【本文確認・二次】 — [Wikipedia: Hades](https://en.wikipedia.org/wiki/Hades_(video_game))。Kasavin の発言「最終ボスは3フェーズ」「God Mode は Hades の構造に特化して設計したので他のゲームに転用できるか分からない」は検索要約のみ 【要約のみ】 — [Inlander](https://inlander.com/culture/hades-writer-greg-kasavin-on-how-he-made-video-game-deaths-drive-a-feel-good-story-22725237)、[Inverse](https://inverse.com/gaming/hades-god-mode-interview)。Game Developer の Hades 早期アクセス記事は取得したが、ボス設計には触れていない(「複数の重なり合う系が相互作用して豊かさが出る。同じ体験の繰り返しにならず新しい周回をしたくなる」程度)【本文確認】 — [Game Developer: Supergiant's fourth outing](https://www.gamedeveloper.com/design/supergiant-s-fourth-outing-i-hades-i-introduces-a-more-mature-organized-dev-process)
- FTL: リアルタイム戦闘で、プレイヤーは一時停止して状況評価と命令入力ができる 【本文確認・二次】 — [Wikipedia: FTL](https://en.wikipedia.org/wiki/FTL:_Faster_Than_Light)。批評で「難しすぎる、時に懲罰的」(GameCritics、Edge)。StS は FTL の「分岐マップとランダムイベント」を参考にしたと Anthony 氏が語った 【本文確認】 — [電ファミ](https://news.denfaminicogamer.jp/interview/200117b)
- Dungeon Encounters(2021、伊藤裕之ディレクター): 4人パーティで100階層を降りる、ミニマルな見た目と装飾の少なさ。戦闘は ATB。評論は「ミニマルなアプローチ」が好評。開発意図の詳細は本文に無し 【本文確認・二次】 — [Wikipedia: Dungeon Encounters](https://en.wikipedia.org/wiki/Dungeon_Encounters)
- Shiren / Mystery Dungeon: 日本語 Wikipedia は、中村光一が「トルネコに入れられなかった要素をシレンに入れた(壺など)」と述べたことと、電ファミ 2016 年の記事「不思議のダンジョンの絶妙なバランスは一枚のエクセルから生まれる」を出典として挙げる。この記事本文(バランスの作り方)は今回取得していない 【本文確認(Wikipedia の記述のみ)】 — [ja.wikipedia: 風来のシレン](https://ja.wikipedia.org/wiki/%E4%B8%8D%E6%80%9D%E8%AD%B0%E3%81%AE%E3%83%80%E3%83%B3%E3%82%B8%E3%83%A7%E3%83%B3_%E9%A2%A8%E6%9D%A5%E3%81%AE%E3%82%B7%E3%83%AC%E3%83%B3)。シレン6の開発者インタビュー(Game Watch、AUTOMATON、ファミ通)は存在を検索で確認したが戦闘の設計論は未読 【要約のみ】 — [AUTOMATON](https://automaton-media.com/articles/interviewsjp/20231122-273067/)
- Luck be a Landlord: 今回は本文を取得せず、新規の確認事項なし(先行調査のまま)。

### Inferences
- Vampire Survivors の「15〜30分で死神」は、戦闘を無限に伸ばさず「終わりの圧力」を与える設計で、本作のボス7分に「時間切れで敵が強化される/特殊行動が加速する」仕組みを入れる際の前例になる(推論)。
- Loop Hero は「長い戦闘にさまよい込みたくない」ので出現頻度を設計に組み込み、戦闘長をシステム側で抑えている。本作も「雑魚90秒」を保つなら、戦闘そのものの長さを敵のHP/火力の設計で一定にするのが基本(推論)。

### Gaps
- 戦闘の実時間(Loop Hero の1戦の秒数、Vampire Survivors の入力頻度、シレンの1フロア)に関する開発者の数値は得られず。
- Hades のボスフェーズ設計意図の一次資料は未取得(Pact of Punishment の事実のみ)。

## Q6. 数値(戦闘の秒数・ターン数・1戦の判断数・ラン長)と、その決め方

### Takeaway
開発者自身が語った実数は少ない。確認できた「数」は、StS の選択率と勝利デッキ出現率という指標の取り方、ITB の「制限ターン」、Vampire Survivors の15/20/30分、Balatro の8 ante×3ブラインド、StS のカード約75枚、Slice & Dice の全20戦、など「構造の数」で、「戦闘◯秒」を決めた根拠は見つからなかった。

### Cited Findings
- ITB: 「XCOM は1戦最大1時間に及び得るが、短くしたかったので制限ターンを入れた」(戦闘の長さの決め方の唯一の明確な記述) 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Into_the_Breach)
- Vampire Survivors: 1セッション15/20/30分のソフト制限 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Vampire_Survivors)
- Balatro: 1ラン=8 ante×3ブラインド(うちボス1)=24ラウンド、勝利は ante 8 のボス撃破 【本文確認・二次】 — [Wikipedia: Balatro](https://en.wikipedia.org/wiki/Balatro)
- Slice & Dice: 全20戦+ボス 【本文確認】 — [AUTOMATON](https://automaton-media.com/en/news/slice-dice-strategic-monster-battling-roguelike-with-tons-of-variety/)
- StS: エネルギー3、カード約75枚/キャラ(Giovannetti の意図)、アセンション20段階、StS ラン全体が日課として「毎日数十分」遊べる(電ファミ筆者の感想で、開発者の数値ではない) 【本文確認】 — [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)、[電ファミ](https://news.denfaminicogamer.jp/interview/200117b)
- Inscryption: 決勝ボス到達までのラン約20〜30分(GameSpot レビュー。先行調査から継承) 【要約のみ】 — [GameSpot](https://gamespot.com/reviews/inscryption-review-house-of-cards/1900-6417788/)

### Inferences
- 「雑魚90秒/ボス7分」を先行事例の数字で裏付けることはできない。確認できた最も近い設計思想は「戦闘を短く保つために上限(ターン数/時間)を置く」(ITB、Vampire Survivors)で、秒数は自作の実測で決めるしかない。
- 目標値を決める際は、StS が使った「選択率/勝利時使用率」の指標で、短い戦闘の中でも「選択が結果に結びついているか」を測れる(推論)。

### Gaps
- 戦闘◯秒、ボス◯分、1ターンの判断数の開発者発言は、本調査でも見つからなかった。

## Q7. 短い戦闘を意味あるものにする(HPがランを通した資源、リスク/リワード、ビルドの見せ場)と、勝敗確定後の消化試合

### Takeaway
確認できたのは、リスク/リワードとラン通しの資源の設計(StS の経路選択と焚き火、DD のストレス、Loop Hero の撤退ペナルティ)と、ビルドの見せ場(Balatro、StS のコンボ)。「勝敗が決まったのに戦闘が続く」ことへの開発者の対処を述べた一次資料は見つからなかった。

### Cited Findings
- StS: 経路選択は「リスク/リワードと計画の要素を、複雑さをほとんど足さずに加える」(Giovannetti)。エリートは強化報酬、焚き火は回復か強化の二択 【本文確認】 — [Game Developer: Road to the IGF](https://www.gamedeveloper.com/disciplines/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-)、[Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)
- StS: 戦闘後の3択カード(取らない選択も重要)で、毎戦に「ビルドをどう変えるか」の決定が入る 【本文確認】 — [電ファミ](https://news.denfaminicogamer.jp/interview/200117b)
- ITB: 戦闘ごとの体力は完全回復する代わりに、守る対象(建物=電力網)が戦闘をまたいで残る資源 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Into_the_Breach)
- Loop Hero: 敗北時は獲得資源の70%を失う(撤退しても同じ) = リスクの重み付け 【本文確認・二次】 — [Wikipedia: Loop Hero](https://en.wikipedia.org/wiki/Loop_Hero)
- Darkest Dungeon: ストレスは戦闘後も持ち越し、休息枠は限られる(ラン外資源の配分) 【本文確認】 — [Game Developer](https://gamedeveloper.com/design/game-design-deep-dive-i-darkest-dungeon-s-i-affliction-system)
- Balatro: 「ラウンドに勝つか分かる前に装置を動かして眺める」= 結果が出る瞬間に価値がある 【本文確認】 — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- Slice & Dice: 再ロール回数の上限、敵が先に行動を決める 【本文確認】 — [AUTOMATON](https://automaton-media.com/en/news/slice-dice-strategic-monster-battling-roguelike-with-tons-of-variety/)
- 「勝敗確定後も戦闘が続く」(mop-up)問題に関する開発者の対処は、今回読んだ全文のどこにも出てこなかった(ITB の固定ターンは戦闘長の上限として働くが、決着後の短縮を明言した記述ではない)。

### Inferences
- 本作が採りうる対応(スロー演出→即リザルト、スキップ)は、先行事例の裏付けがなく、自作での検証事項。
- 「戦闘後にどの選択が効いたかを示す」は、Balatro の演出(結果を見せる瞬間の価値)と StS のメトリクス思想(選択と結果の結びつき)の両方から支持される(推論)。

### Gaps
- mop-up への対策、判断麻痺(ターン内の判断過多)に関する開発者の記述は取得できず。

## Q8. ペース QoL(高速化、アニメスキップ、オートエンド、アンドゥ、ダメージ予告)と、苦情への対応

### Takeaway
確認できたのは、StS の Fast Mode(2018年の週次パッチ、検索要約のみ)、ITB のターン制限・予告表示(速度の工夫、Wikipedia 経由)、Balatro の Deck Peek 追加(ユーザーが手作業で数えていたため)と「スコア予告は拒否」、Darkest Dungeon の不評機構のオプション化。アンドゥ、オートエンドの導入時期は取れなかった。

### Cited Findings
- StS: 設定のチェックボックスで入る Fast Mode が追加(スピードランナー向け)。以後のパッチで Fast Mode 時の個別演出の速度が調整された 【要約のみ】 — [StS wiki Weekly Patch 11](https://slaythespire.wiki.gg/wiki/Weekly_Patch_11_-_A_Library_of_Features)(取得不能)。Steam 議論でも大デッキではアニメが間延びするとの声(先行調査から継承)【要約のみ】 — [Steam 議論](https://steamcommunity.com/app/646570/discussions/0/2549465882935485677)
- ITB: 戦闘を短くする目的の制限ターン+予告表示(上記 Q2) 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Into_the_Breach)
- Balatro: Deck Peek を追加(プレイヤーが手で数えるのが面白くなかったため)。一方、スコア予告は「オプションでも提供しない」。Brown は「オプションを出すとデフォルトの体験が壊れる」との LocalThunk の懸念を紹介しつつ、後半解放等を提案 【本文確認】 — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- Darkest Dungeon: 不評機構をオプション化、町イベントの頻度/無効化を設定に追加 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Darkest_Dungeon)
- Vampire Survivors: 後からハイパーモード(速度上昇)、エンドレスモード(時間制限なし)をモディファイアとして追加 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Vampire_Survivors)
- Loop Hero: 速度設定(1x 等)と、オートポーズ機能(歯車の演出が出る機能)がある。開発者はポストモーテムで「自動ポーズ歯車に光の帯シェーダーを1日かけて作ったが、気づく人はほとんどいない」と述べた(=機能の存在は確認、導入時期・設計意図は不明) 【本文確認】 — [Game Developer: Postmortem: Loop Hero](https://gamedeveloper.com/design/postmortem-loop-hero)。GamesBeat の要約には「1x に設定してくつろいで遊べる」との開発者発言あり 【要約のみ】 — [GamesBeat](https://gamesbeat.com/the-d20-beat-loop-hero-has-cast-a-calm-strategic-spell-over-me/)
- Hades: God Mode(失敗するたび強くなる)。ただし発言は「他のゲームに転用できるか分からない」 【要約のみ】 — [Inverse](https://inverse.com/gaming/hades-god-mode-interview)
- StS の数値付き intent(数値を出したほうが「より面白く、記号を覚えなくてよい」)は、ダメージ予告の導入経緯の一次近似 【本文確認・二次】 — [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)

### Inferences
- 「Fast Mode は速さを求めるプレイヤー向けに後から足された」「Balatro/DD はオプションで体験を壊す/救う」のように、ペース QoL は「全員に出す」か「条件付きで出す」かの判断が要る。本作は高速化・スキップを最初から用意し、演出は初回のみフル尺にするほうが安全(先行調査の推論を補強するが、どれも事例の因果は未確認)。

### Gaps
- StS の Fast Mode の追加日、ITB のアンドゥ(ターンのやり直し)の経緯、オートエンドターンの導入時期は一次資料が得られなかった。

## 付記: 使った/使えなかった情報源

本文確認に使った一次/準一次: Game Developer(StS データ記事 2018、StS Road to the IGF 2020、ITB の GDC 告知 2019 と Twitch 討議 2018、Loop Hero ポストモーテム 2021、DD Affliction 解説 2015、Hades 早期アクセス記事)、GMTK Substack(Balatro)、電ファミ(StS 開発者インタビュー 2020)、AUTOMATON(Slice & Dice)、GDC Vault(StS 講演ページ)、PC Gamer(DD の GDC 報道)。二次: Wikipedia(StS、StS2、ITB、Balatro、FTL、Monster Train、Inscryption、Peglin、Wildfrost、Loop Hero、Darkest Dungeon、Hades、Vampire Survivors、Dungeon Encounters、ja: シレン)。

取得不能(要許可または接続不可): WebFetch ツールは gamedeveloper.com / gmtk.substack.com / pcgamer.com に対して名前解決エラー(環境のネットワーク許可外の挙動)だったが、curl では取得できた。pcgamer.com の ITB 記事、gonintendo.com、80.lv、slaythespire.wiki.gg、windowscentral.com 等は取得せず【要約のみ】扱い。GDC 講演の動画・スライド本体(StS、ITB、DD)は未閲覧。
