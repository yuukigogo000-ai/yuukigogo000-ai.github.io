# ローグライク/ローグライト/デッキ構築/コンパクト戦術ゲームの戦闘システム先行事例

調査上の制約(先に明記): 本セッションでは WebFetch が全ホストで名前解決失敗(gamedeveloper.com, gmtk.substack.com, rogueliker.com 等が許可ドメイン外)となり、原典ページ本文を直接読めなかった。以下はすべて WebSearch が返した検索結果要約(引用句)に基づく。GDC講演本編・開発者インタビュー本文は未確認。1ソース=1要約のため、数値(戦闘秒数・決定回数)の一次データはほぼ取れていない。取れなかったものは各 Gaps に明記した。

## Q1. 各タイトルの戦闘メカニクス、評価点、批判点

### Takeaway
行動予告(Slay the Spire / Into the Breach)・スコア追従(Balatro)・カウンター式(Wildfrost)・ダイス再ロール(Slice & Dice)など、「情報の見せ方」か「少数の決定に絞る仕組み」が評価の中心。批判はほぼ「運(RNG)」「難易度」「単調さ」に集中する。

### Cited Findings
**Slay the Spire / StS2**
- 敵の頭上に次の行動のアイコン(攻撃+防御なら剣と盾)を出す。開発者の語りとして「インテント公開がローグライクとデッキ構築の発想を結びつけた転機」とされる(要約ソース、講演の場は未確認) — [lilys.ai 要約](https://lilys.ai/notes/1046045)
- 共同創業者インタビュー(Ars Technica、ファンサイト経由)ではインテントは Twitch 時代に攻撃を分かりやすく伝える手段と説明される — [design tensions(ファンサイト)](https://saschb2b.github.io/game-mechanics/games/slay-the-spire/design-tensions)(本文未読・検索要約のみ)
- 続編 StS2 は「ほぼ完全情報」で、攻撃予定なら受けるダメージ値を常に正確に知れる。召喚専用アイコンも追加(初代にはなかった)。数ターン先まで精密に計画できるのが楽しさの核 — [StS2 インテントガイド](https://sts2.untapped.gg/guides/how-to-read-enemy-intent)
- GDC 2019 Giovannetti「Metrics Driven Design and Balance」はデータ駆動のバランス調整が主題(インテントの講演ではない) — [GDC](https://gdconf.com/news/learn-slay-spires-successful-metrics-driven-approach-game-balancing-gdc-2019)
- 批判: 50枚超デッキでは通常速度のアニメが引く/混ぜるで間延びする、との Steam 議論。返信は「既に速い」と反論 — [Steam議論](https://steamcommunity.com/app/646570/discussions/0/2549465882935485677)

**Into the Breach**
- 全敵攻撃が事前に見える。Justin Ma「死が自分のミスだと感じられるものにしたかった」「FTLよりランダム性を減らしたかった」 — [Game Developer 要約](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)(検索要約経由)
- GDC 2019 ポストモーテム: 開発4年、当初は都市建設・技術ツリー・ユニット被害の持ち越しがあったが削った。「RNGをどれだけ使うか」が論点 — [GDC Vault](https://www.gdcvault.com/play/1026333/contactUs)、[PC Gamer](https://pcgamer.com/into-the-breach-originally-had-city-building-and-tech-trees-creators-reveal)
- 「チェスのように全情報が見える」との解説はあるが、講演で確認できていない(要注意) — [Into the Breach 解説(検索要約)](https://games.gg/into-the-breach/)
- 「5ターン戦闘」「やり直し機能」は検索結果から裏取りできず(Gaps)。

**Monster Train**
- 敵は最下階から上へ進みパイア(炎)を攻撃。パイアと敵が殴り合うを敵全滅/パイア消火まで繰り返す。ボスは通常戦と違い往復の攻防が続く — [Rogueliker系要約](https://rogueliker.com/monster-train-review/)
- 評価: 縦横2軸で StS とは別物。PC Gamer 77点「HP計算を楽しませる」 — [PC Gamer](https://www.pcgamer.com/monster-train-is-a-deckbuilder-that-tries-to-do-it-all-and-actually-pulls-it-off)
- 批判: 序盤数時間は選択肢の多さで散らかり理解まで苦行、との指摘。ラン長を延ばすオプション希望(=標準は短め) — [Russell Troxel](https://www.russelltroxel.com/writing/2020/5/30/monster-train-review)
- 「StSより速い」とする明確な記述は見つからず。

**Balatro**
- 敵HPではなくラウンドの目標スコアを追う。スコア予告を意図的に隠す。GMTK(Mark Brown)は「素早く行動させ、毎手にサスペンスを生む」意図と整理 — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- LocalThunk: ルーブ・ゴールドバーグ装置を組んで、勝てるか分かる前に動かして眺めるのが楽しい。オプションで出せばクリックされるだけで意図した体験を損なう — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- 批判: 結果を知るため外部計算ツールに頼ることになり、楽しさを最適化で消す。折衷案(後半アンロックのプレビュー等)が提案されている — 同上

**Wildfrost**
- 各カードのカウンターが0になると行動。カウンターを読んで先を計画できる。慣れに時間がかかる — [Wildfrost レビュー群](https://opencritic.com/game/14507/wildfrost/reviews?page=2)
- 批判: 難易度が最大の不満、最終ボスのバランス、ランダムな引きでデッキが噛み合わない、序盤運で止まる。評価は発売時 Steam 約60%→後に83% — 同上
- 進行(マップ・店・戦闘)はテンポが良いと評された(プレビュー) — [ScreenRant](https://screenrant.com/wildfrost-game-preview/)

**Slice & Dice**
- 5人のパーティ、各キャラ1個のダイス。敵が先にロール→プレイヤーがロール→再ロールで調整してから確定。「時間を無駄にしない」と評価。批判は運の不公平感と高難度(プレイヤー要約) — [AUTOMATON](https://automaton-media.com/en/news/slice-dice-strategic-monster-battling-roguelike-with-tons-of-variety/)、[Vaporlens](https://vaporlens.app/app/1775490/slice_dice)

**Darkest Dungeon**
- 隊列位置が重要(特定ランクからしか使えない技、最後尾の敵のみを攻撃する技など)。評価: 戦術の深さ — [Steamレビュー要約(honestgamers 等)](https://www.honestgamers.com/13265/pc/darkest-dungeon/review.html)
- 批判: RNGと反復が二大欠点とされる。ストレス(発狂で味方に連鎖ストレス、行動スキップ、位置入れ替え)が理不尽に感じられる。損失からの回復難。後に開発者が不評機構をオフにするオプションを追加 — [Gamers Decide(二次)](https://gamersdecide.com/pc-game-news/darkest-dungeon-s-3000-negative-reviews-too-difficult-be-fun)

**FTL**
- リアルタイム+一時停止。プレイヤーは決断時・状況確認時に止め、実質ほぼターン制として遊ぶ。新規には慌ただしく見える懸念 — [Subsetフォーラム](https://subsetgames.com/forum/viewtopic.php?p=58929)(フォーラム投稿、批評ではない)
- サブシステム狙撃を使いこなすには完全一時停止が必要、リアルタイムだと反射テストに落ちる(別ゲーのdevlogの主張) — [The Outer Line devlog](https://theouterline.vercel.app/devlog/devlog05-thepausethatwinswars)

**Peglin**
- 玉がペグに当たるほど威力が上がり、クリティカルペグで倍率。眺めて爽快。批判: 運依存(ペグ配置次第)。ボスは最高に楽しい区間と同時に不満の源(ボスがペグ間に粘着線を張り盤面を乱す)。ボス撃破時の極端な低FPSは小標本のAI要約で未確認 — [God is a Geek](https://www.godisageek.com/reviews/peglin-review)、[Nintendo World Report](https://nintendoworldreport.com/review/69288)、[Vaporlens](https://vaporlens.app/app/1296610/peglin)

**Backpack Hero / Dicey Dungeons / Luck be a Landlord**
- Backpack Hero: 最大の問題は戦闘そのもの。反復的、UIがぎこちない。バッグ管理は好評 — [Prima Games](https://primagames.com/gaming/backpack-hero-review-room-to-improve)、[Turn Based Lovers](https://turnbasedlovers.com/review/backpack-hero-impressions/)
- Dicey Dungeons: 運が熱くもあり腹立たしくもある。「負けた時、50%は勝てなかった」との声。序盤数時間は優しく手応え薄い。6キャラが別ゲームのように変わる点は高評価 — [Thinky Games](https://thinkygames.com/games/dicey-dungeons/)、[GameSpot](https://www.gamespot.com/reviews/dicey-dungeons-review/1900-6417267/)
- Luck be a Landlord: 戦闘ではなくスロット型。ループの満足感と後半のシナジーが評価、実質的な批判は見つからず — [Rogueliker](https://rogueliker.com/luck-be-a-landlord-review/)

**Inscryption / Dream Quest / Cobalt Core / One Step From Eden**
- Inscryption: カードバトルは好評。決勝ボス到達時ランは20〜30分。「どのカードを取っても結果が変わらない」との批判。ボスは2ライフ制で、1度目撃破後に混乱させる能力を出す — [GameSpot](https://gamespot.com/reviews/inscryption-review-house-of-cards/1900-6417788/)、[Well-Played](https://www.well-played.com.au/inscryption-review/)
- Dream Quest: 一部の敵/ボス(Lord of the Dream)が不快/理不尽との集計(プレイヤー要約) — [Vaporlens](https://vaporlens.app/app/557410/dream_quest)
- Cobalt Core: 2Dグリッド上のドッグファイト。PC Gamer 87点。批判(ユーザー要約): 内容量不足、反復 — [PC Gamer](https://www.pcgamer.com/cobalt-core-review/)、[Card Gamer](https://cardgamer.com/?p=22810)、[Vaporlens](https://vaporlens.app/app/2179850/cobalt_core/stats/analysis)
- One Step From Eden: ボスが最強の要素だがローグライト構造が足を引っ張る。カード系が分かりにくい。難しすぎる(Prima「A step too hard」) — [GameGrin](https://cdn.gamegrin.com/reviews/one-step-from-eden-review)、[Prima](https://primagames.com/?p=313322)
- Astrea: Six-Sided Oracles: ダイス構築が革新的、ダイス運が過剰との評(ユーザー要約) — [Vaporlens](https://vaporlens.app/app/1755830/astrea_six_sided_oracles)

**Shiren / Mystery Dungeon**
- 全行動が1ターン、敵は後から反応。シリーズのプロデューサー永端は「緊張感」と「推論」を柱に置く。チェスに喩えた(Chunsoft)。マス数を数えて何ターン耐えられるか計算する体験、巨大な資源管理テスト — [Wikipedia](https://en.wikipedia.org/wiki/Shiren_the_Wanderer)、[CGMagazine](https://www.cgmagonline.com/game/shiren-the-wanderer-the-mystery-dungeon-of-serpentcoil-island/)
- 批判: 完全ターン制ゆえ遅い、MDシリーズ共通の反復、戦闘曲がなく劇的でない — [Nintendo Life](https://www.nintendolife.com/reviews/2008/03/mystery_dungeon_shiren_the_wanderer_ds)、[Critical Gaming](https://critical-gaming.squarespace.com/blog/2010/4/23/shiren-the-wandering-review.html)
- 設計原則: アイテムはプレイヤー・モンスター・NPCに同じ効果 — [Game Developer](https://gamedeveloper.com/design/roguelike-item-and-monster-design-revisited)

### Inferences
- 好評作は「戦闘中の入力を減らす(Balatro/Slice & Dice/Peglin/Wildfrost)」か「入力は多いが全情報を見せて考える価値を担保する(StS/ITB)」のどちらかで、中途半端(情報が曖昧で入力も多い)が不満を生む。本件(低入力・自動戦闘)は前者側。
- 不満の最頻出は運の不公平感で、緩和策は「予告」「再ロール」「ビルド選択で結果を左右」。自動戦闘では事前の編成/戦術選択に因果が見えることが重要。

### Gaps
- Hades、Loop Hero、Dungeon Encounters、Dungeons of Dredmor は有用な検索結果が得られなかった(Loop Hero は検索に出ず)。
- GDC講演の本編(StSインテント、ITB 5ターン・完全情報の明言)は原典未確認。

## Q2. 短い戦闘に必ず面白い決定を入れる方法

### Takeaway
手法は4系統: (1)敵の行動予告で「今ターンの正解」を作る (2)HPなどラン通しの資源で毎戦の損得を作る (3)リスク/リワード選択 (4)ビルドの噛み合い(ビルドの見せ場)。

### Cited Findings
- 予告→数ターン先まで計画できる(StS2) — [untapped.gg](https://sts2.untapped.gg/guides/how-to-read-enemy-intent)
- 全攻撃の予告でミスを自分の責任にする(ITB) — [Game Developer 要約](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)
- カウンターを読んで先読み(Wildfrost) — [OpenCritic](https://opencritic.com/game/14507/wildfrost/reviews?page=2)
- 再ロールで運を調整(Slice & Dice) — [AUTOMATON](https://automaton-media.com/en/news/slice-dice-strategic-monster-battling-roguelike-with-tons-of-variety/)
- 結果を隠し、仕込んだ機械を走らせる緊張と見せ場(Balatro) — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- 資源管理の緊張・どれだけ投資するか(Shiren) — [CGMagazine](https://www.cgmagonline.com/game/shiren-the-wanderer-the-mystery-dungeon-of-serpentcoil-island/)
- 隊列位置が戦術の核(Darkest Dungeon) — [HonestGamers](https://www.honestgamers.com/13265/pc/darkest-dungeon/review.html)
- 反例: 「どのカードを選んでも影響が薄い」(Inscryption)、序盤が優しく手応えがない(Dicey Dungeons) — [Well-Played](https://www.well-played.com.au/inscryption-review/)、[Thinky Games](https://thinkygames.com/games/dicey-dungeons/)

### Inferences
- 自動戦闘の本件では「決定」を戦闘開始前(4体の配置・戦術選択)に集約し、戦闘中は予告(敵の特殊行動の事前表示)と見せ場(コンボ発火)で見せるのが整合的。
- 戦闘結果が配置・戦術選択のどれに由来したかを戦闘後に示さないと、Inscryption型の「何を選んでも同じ」感が出る恐れ。

### Gaps
- 1戦あたりの決定回数の実測値は一次情報なし。

## Q3. ボスを通常戦と差別化する設計と所要時間

### Takeaway
ボスは「ルール/盤面を乱す」「フェーズ/2ライフ」「往復の攻防が長い」で差別化される。ボスが最高の見せ場でありつつ不満の源にもなる(Peglin, One Step From Eden)。実測の所要時間は得られなかった。

### Cited Findings
- Inscryption: ボスは2ライフ。1度目撃破後に混乱させる能力を発動。ボスごとにテーマ一致のメカニクス — [Well-Played](https://www.well-played.com.au/inscryption-review/)
- Peglin: ボスが粘着線で盤面を乱す。ボス戦は最も楽しい区間とされる一方、特定ビルドがないと罰が重いとの声 — [God is a Geek](https://www.godisageek.com/reviews/peglin-review)、[Nintendo World Report](https://nintendoworldreport.com/review/69288)、[GamingHQ](https://gaminghq.eu/2025/05/31/peglin-mobile-review-a-perfect-shot-of-pachinko-and-roguelike-strategy)
- One Step From Eden: ボスが最強の要素 — [GameGrin](https://cdn.gamegrin.com/reviews/one-step-from-eden-review)
- Monster Train: ボスは通常戦(1ターンで終わる)と違い往復の攻防が続く — [Rogueliker系](https://rogueliker.com/monster-train-review/)
- StS2: 儀式の獣(Ceremonial Beast)は2フェーズで長く過酷、Vantom は速度が重要(傷が山札を詰まらせる)。ガイドの記述 — [allthings.how](https://allthings.how/every-boss-in-slay-the-spire-2-organized-by-act-and-location/)
- Wildfrost: 最終ボスのバランスが不満 — [OpenCritic](https://opencritic.com/game/14507/wildfrost/reviews?page=2)
- Dream Quest: 一部ボスが不快/理不尽 — [Vaporlens](https://vaporlens.app/app/557410/dream_quest)
- Inscryption: 決勝ボス到達時でラン全体20〜30分 — [GameSpot](https://gamespot.com/reviews/inscryption-review-house-of-cards/1900-6417788/)

### Inferences
- 7分ボスは「フェーズ分割(2〜3段)+各段で盤面ルールを変える」ことで、1つの長い戦闘ではなく3つの短い戦闘の連続として体感させられる(Inscryption 2ライフ、StS2 2フェーズの例からの推論)。
- ボス撃破に特定ビルドを要求する設計(Peglin)は不満になりやすい。ビルドに依らず突破できる逃げ道を残す方が安全。

### Gaps
- ボス戦の実秒数(StS, Monster Train, Hades 等)は一次データなし。ソフトエンレイジ/スケーリングタイマーの具体例も未取得(Hades のフェーズ設計は検索ヒットせず)。

## Q4. プレイヤー・批評家の不満

### Takeaway
最頻出は (1)RNGの不公平感 (2)難易度/バランス (3)戦闘/序盤の反復 (4)情報不足による外部ツール依存。

### Cited Findings
- RNG不公平: Dicey Dungeons「50%は勝てなかった」 — [Thinky Games](https://thinkygames.com/games/dicey-dungeons/)。Peglin 運依存 — [Vaporlens](https://vaporlens.app/app/1296610/peglin)。Slice & Dice — [Vaporlens](https://vaporlens.app/app/1775490/slice_dice)。Darkest Dungeon「RNGと反復が二大欠点」 — [HonestGamers](https://www.honestgamers.com/13265/pc/darkest-dungeon/review.html)。Astrea — [Vaporlens](https://vaporlens.app/app/1755830/astrea_six_sided_oracles)
- 反復: Backpack Hero の戦闘 — [Prima](https://primagames.com/gaming/backpack-hero-review-room-to-improve)。Cobalt Core — [Vaporlens](https://vaporlens.app/app/2179850/cobalt_core/stats/analysis)。Mystery Dungeon の反復 — [Critical Gaming](https://critical-gaming.squarespace.com/blog/2010/4/23/shiren-the-wandering-review.html)
- 序盤の散らかり/学習コスト: Monster Train — [Russell Troxel](https://www.russelltroxel.com/writing/2020/5/30/monster-train-review)。Wildfrost の慣れ — [OpenCritic](https://opencritic.com/game/14507/wildfrost/reviews?page=2)
- 情報不足→外部ツール依存: Balatro — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- 遅さ: Shiren は完全ターン制で遅い — [Nintendo Life](https://www.nintendolife.com/reviews/2008/03/mystery_dungeon_shiren_the_wanderer_ds)。StS の大デッキでアニメが間延び — [Steam議論](https://steamcommunity.com/app/646570/discussions/0/2549465882935485677)
- 理不尽な状態異常機構: Darkest Dungeon のストレス。開発者が無効化オプションを追加 — [Gamers Decide](https://gamersdecide.com/pc-game-news/darkest-dungeon-s-3000-negative-reviews-too-difficult-be-fun)

### Inferences
- 「勝敗確定後も戦闘が続く」不満や「分析麻痺」は本調査では直接の記述を取れなかった。ただ上記の遅さ批判と整合する。本件では勝敗が見えた時点で早期決着(スロー演出→即リザルト)にする検討余地あり(推論)。

### Gaps
- 「勝敗確定後の引き延ばし」「1ターンの決定過多」を直接述べた一次ソース未取得。
- 日本語ソース(4Gamer, AUTOMATON, Game*Spark, note.com)の戦闘設計分析は、検索で Game*Spark のスレスパライク特集一覧([記事](https://www.gamespark.jp/article/2025/08/11/155947.html))が出たのみで本文未読。

## Q5. 標準的なQoL(ペース機能)

### Takeaway
裏が取れたのは「一時停止(FTL)」「スコア予告を出すか論争(Balatro)」「不評機構のオフ設定(Darkest Dungeon)」程度。高速モード/アニメスキップ/オートエンド/アンドゥ/ダメージ予告の標準化を示す一次ソースは取れていない。

### Cited Findings
- FTL の一時停止でリアルタイムを事実上ターン制化 — [Subsetフォーラム](https://subsetgames.com/forum/viewtopic.php?p=58929)
- 詳細な狙撃には完全ポーズが要る(別ゲーdevlog) — [The Outer Line](https://theouterline.vercel.app/devlog/devlog05-thepausethatwinswars)
- Balatro: プレビューをオプションにすると押されるだけ(開発者)vs 外部ツール依存(批判) — [GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)
- Darkest Dungeon: 不評機構を無効化できるオプション — [Gamers Decide](https://gamersdecide.com/pc-game-news/darkest-dungeon-s-3000-negative-reviews-too-difficult-be-fun)
- StS: アニメ速度への意見は割れる(速い vs 大デッキで間延び) — [Steam議論](https://steamcommunity.com/app/646570/discussions/0/2549465882935485677)

### Inferences
- 自動戦闘では「1.5x/2x速度」「スキップ(結果のみ表示)」「一時停止」を最初から用意するのが安全(上記の遅さ批判からの推論)。

### Gaps
- StS の高速モード設定、ITB のターンやり直し、ダメージ予告等の標準性は未確認。
- 戦闘所要時間(秒/分)と1戦あたり決定数の比較表は一次データ不足で作れなかった。
