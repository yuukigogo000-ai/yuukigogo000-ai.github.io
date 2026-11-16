# スマホ縦画面・片手のターン制戦闘ゲームの UI(おはじきバトル向け調査)

調査の限界(先に): この環境は DNS 制限で WebFetch がほぼ失敗し、curl で本文が取れたのは Wikipedia(ja/en)のみ。gamedeveloper.com・nintygamer・smashingmagazine・gamebiz は本文取得不可。
よって下の【要約のみ】は WebSearch の要約文に基づき、原文未確認。CEDEC・GDC の UI 講演の本文は 1 件も確認できていない。
Slay the Spire / Into the Breach 以外(Marvel Snap・Hearthstone・Pokémon Unite/Masters・ウマ娘・ブルアカ・Monster Train・Wildfrost・Balatro)の「UI の具体的な作り」は、実質的に出典が取れなかった(各 Gaps 参照)。

## 1. モンスターストライクの戦闘画面(順番・HP・SS・敵ターン・弱点・ギミック・引っぱり)

### Takeaway
モンストは「画面のどこを触っても矢印を引ける」「敵の頭のカウントで攻撃ターンを見せる」「SS は画面下のアイコンが光ったらタップ」という最小構成。WO の「どこでも引ける」「必殺は溜まったら光る 1 ボタン」「敵の数字の丸」の裏づけになる。ただし位置・大きさ・キャンセルの具体は取れなかった。

### Cited Findings
- 【本文確認】引く操作は「矢印を表示できる範囲内であれば画面のどこに触れても矢印を引っ張ることができる」。発射は引いた方向と逆(ゴムパチンコ・弓と同じ要領)。矢印の長さではなく、離すタイミングで速度・攻撃力が変わるキャラがいる — [ja.wikipedia モンスターストライク](https://ja.wikipedia.org/wiki/モンスターストライク)
- 【本文確認】敵の攻撃ターンは「敵の周りに表示されている数字のカウント」で確認。プレイヤーのターンごとに 1 減り、0 で攻撃してくる — 同上
- 【本文確認】SS は「画面下のモンスターアイコンが光っているときに、そのアイコンをタップ」で使う。SS は各モンスターごとのターン経過で使用可能(強力なほど長い)。アイテム「砂時計」で SS ターンが縮む — 同上
- 【本文確認】弱点は「黄色や赤の三角形のマーク」で表示。ボスの周り 3 か所のうちターンで変わり、当てると通常 3 倍ダメージ — 同上
- 【本文確認】ギミック(重力バリア=遅くなる、ダメージウォール等)はステージ内の物として出る。プレイヤーの邪魔が多いが活用できるものもある — 同上
- 【本文確認】一部モンスターは引っぱる間、画面上部にゲージが出て、最大のタイミングで離すと追加アビリティ(ゲージショット) — 同上。【要約のみ】満タンで「FANTASTIC!」表示、攻撃力 1.2 倍 — [検索結果の要約(altema/game8 等・原文未取得)](https://altema.jp/monsuto/gageshot-2382)
- 【本文確認】守護獣スキルは「守護獣のアイコンをタップしつつモンスターを引っ張る」で発動(タップ+引くの同時操作) — ja.wikipedia 同上
- 【要約のみ】モンスト UI チームは UX と要件を整理して設計する体制。戦闘画面の設計詳細には触れていない — [Wantedly mixi 記事](https://www.wantedly.com/companies/mixi/post_articles/308003)

### Inferences
- 「どこを触っても引ける」は、親指で駒を直接触ると駒が指で隠れる問題を、設計で消している例(推論。公式がそう語った出典は無し)。WO の「卓の下端より下でも引ける」と同じ方向。
- 敵の頭のカウントは 20 年近い(2013 年〜)量産実績のある表現で、WO の「右上に数字の丸」の裏づけ(強い)。

### Gaps
- HP バー・SS ゲージの位置と大きさ、引っぱり矢印の太さ・色・ガイド線(反射予測の有無)、キャンセル方法(引いた位置を戻せば取り消せる等)は、検索で確認できなかった。「引きすぎて画面外に出たとき」も不明。
- CEDEC/UI 講演の本文は未確認(cedil.cesa.or.jp は検索で当たらず)。

## 2. 他作品の戦闘 UI(意図の予告・数値・長押し・ダメージ予測・ターン順)

### Takeaway
確認できた一次寄りの事例は Slay the Spire(意図に数値を入れた経緯)と Into the Breach(明快さのために凝った案を捨てる、敵の予告)、Fire Emblem Heroes(危険範囲の一括表示)のみ。「予告には数値を出す」が最も裏づけが強く、WO の方針(数字は長押しで出す)と一部ぶつかる。

### Cited Findings
- 【本文確認】Slay the Spire は最初「Next Turn」方式(対象を選ぶと敵の行動が見える)だったが、敵が複数だと UI 上の問題が残った。次に「Intents」(次の行動をアイコンで表す)へ。最初は攻撃値の正確な数字を出さず武器アイコンで範囲を示した。数字が多いと敬遠されると考えたが、プレイテストで「数字があるほうが魅力的」「各記号の意味を覚えずに済む」「新しい戦略を作れる」と分かった — [en.wikipedia Slay the Spire](https://en.wikipedia.org/wiki/Slay_the_Spire)(元は Ars Technica "War Stories" と記載。原文は未取得)
- 【要約のみ】StS2 では、敵が攻撃するなら赤い武器アイコン+下に数字で正確なダメージ、複数回攻撃は倍率で出る — [untapped.gg StS2 guide](https://sts2.untapped.gg/guides/how-to-read-enemy-intent)(ファン系ガイド)
- 【要約のみ】StS で、カードを敵に使う前に、敵の頭上のダメージ表示が修正値込みの実数に変わる(フォーラム投稿の言及) — [検索結果の要約・stimhack フォーラム等](https://forum.stimhack.com/t/slay-the-spire-sneakyslys-game/8871?page=7)。信頼度低
- 【本文確認】Into the Breach は敵の動きを予告(telegraph)することで 1 戦を短くできた。ターン数制限も戦闘を短く保つため — [en.wikipedia Into the Breach](https://en.wikipedia.org/wiki/Into_the_Breach)
- 【要約のみ】Justin Ma は UI について「見せられるなら採用、明快さのために凝った案は毎回犠牲にする」旨(見出しは "sacrifice cool ideas for the sake of clarity every time")。敵が次にすることを全ユニットについて事前に明示 — [Game Developer(RPS 対談の要約)](https://gamedeveloper.com/design/-i-into-the-breach-i-dev-on-ui-design-sacrifice-cool-ideas-for-the-sake-of-clarity-every-time-)。本文は取得失敗
- 【要約のみ】Into the Breach モバイル版で Ma は「全情報を常時出すのは諦め、折りたたみ UI か不要情報の削減にした」と語った — [TouchArcade 2022 インタビュー](https://toucharcade.com/2022/08/08/into-the-breach-mobile-interview-subset-games-ftl-nintendo-switch-netflix-games-ipad-iphone/)。本文未確認
- 【要約のみ】Fire Emblem Heroes: 画面下の「危険範囲」ボタンで敵が攻撃できるマスを赤く一括表示。敵 1 体をタップするとその敵の範囲を表示 — [FEH 公式ガイド・各攻略(要約)](https://new-guide.fire-emblem-heroes.com/en-GB/feh-1110.html)
- 【要約のみ】itch.io の開発者投稿: 敵の頭上の情報を HP・状態異常・意図に分け、敵の周りの別の位置に置くとよい(特定作品ではなく一般論) — [itch.io](https://itch.io/post/13092079)

### Inferences
- 【強】「予告の数値は隠さず出す」: StS が逆(数字を隠す)から出発して戻した。おはじきの「敵の数字の丸=あと何ターン」は良いが、「誰に何点」を長押し専用にするのは危ない(下の 5 節)。
- 【中】FEH の「危険範囲を押している間だけ全部出す」ボタンは、WO の「カウント 1 の敵だけ範囲を淡く塗る」の補完案になりうる。ただし下 1/3 のボタンを増やすことになり主操作が薄まる。長押しで済ませるのが筋。
- 【弱】Marvel Snap・Hearthstone・Pokémon Unite/Masters・ウマ娘・ブルアカ・Monster Train・Wildfrost・Balatro は具体事例を取れず、ここから言えることは無い。

### Gaps
- 上記 8 作品の「意図アイコンの形・数値・長押し・ターン順表示」の一次資料(開発者発言)は見つからなかった。Wildfrost は PC Gamer レビューが「色つきアイコンで一目で分かる」と評すのみ【要約のみ】([pcgamer.com/wildfrost-review](https://www.pcgamer.com/wildfrost-review/))。
- StS の Ars Technica 原文、GDC 2019 "Slay the Spire: Metrics Driven Design"、Into the Breach の GDC 2019 postmortem(Matthew Davis)は説明文しか見えていない(gdcvault は有料)。

## 3. 指で隠れる問題・サムゾーン・片手・誤タップ・最小サイズ

### Takeaway
最小サイズは Material 48dp(間隔 8dp)・iOS 44pt が定説。サムゾーンは「端末と手で変わる」と注意書きつき。「引っぱる指が狙いを隠す」問題そのものを扱った出典は取れなかった。

### Cited Findings
- 【要約のみ】Material: タッチ対象は 48×48dp 以上、対象間は 8dp 以上。見た目が 24dp のアイコンでも周囲の余白込みで 48dp にできる。iOS は 44×44pt。WCAG 2.2 AA は 24×24 CSS px(下限) — [material.io spacing-methods](https://material.io/design/layout/spacing-methods.html)、[Google アクセシビリティ ヘルプ](https://support.google.com/accessibility/android/answer/7101858?hl=en)
- 【要約のみ】片手の親指用のターゲットサイズ研究(MobileHCI 2006, Parhi ら): 単発タスク 9.2mm、連続タスク 9.6mm で十分 — [Microsoft Research](https://www.microsoft.com/en-us/research/?p=155150)
- 【要約のみ】サムゾーンの概念は Steven Hoober 由来。同氏は後に元の図を誤りとしたとの記述あり。手の大きさ・端末・利き手で変わる。大きい端末の上隅は届きにくく、頻繁な操作は下の帯へ — [Smashing Magazine(要約)](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users)
- 【要約のみ】縦持ちのアクションゲームを Fitts の法則で調べた学会論文(AHFE 2026)。縦画面では中央付近が正確で、四隅ほど精度が低い — [cms-conferences.org](https://openaccess-api.cms-conferences.org/articles/download/978-1-964867-13-7_13)
- 【要約のみ】Marvel Snap の開発者のモバイル向け助言: 縦持ちを使い、画面の回転を強いない。実機で触感を試す — [outof.games](https://outof.games/news/6233-ben-brode-marvel-snap-devs-provide-game-design-tips-for-mobile-gaming/)。UI の配置の語りではない
- 【要約のみ】一般の UX 記事: HUD は両手・片手の持ち方で試す — [game-ace.com](https://game-ace.com/blog/mobile-game-design/)(質は低め)

### Inferences
- 【強】WO の「卓の中の駒は tap<44 の対象外、どこでも引ける」は、モンストの前例(どこでも引ける)があり妥当。ただし「引き始めの位置」を駒から離す設計だと、駒との対応(どの駒を弾くか)は光る駒 1 つに固定されているので混乱しにくい。
- 【中】必殺ボタン(高さ 56)は 48dp 超でよい。「…」ボタンは右上(親指が最も届かない位置)にあり、頻度が低い物を遠くに置く方針とは合う。ただし「やめる」「早送り」が戦闘中に何度も要るなら、右上は片手で遠い。→ 早送りの頻度次第で見直し。
- 【中】引っぱり中の「強さ 中(離すと発射)」を下の 1 行に出す案は、引く親指の真下にあたり隠れやすい(推論。この近辺の出典は無し)。親指の逆側(卓の上端寄り)か、駒の近くのほうが見える可能性。実機で確かめる項目。
- 誤タップ対策(確認ダイアログ、遅延など)の事例は取れなかった。

### Gaps
- 「引っぱるときに指が駒・敵を隠す」問題の研究(オフセット照準など)を直接扱う出典は未取得。
- Smashing の本文、Hoober の原資料は取得不可。数値は要約経由。

## 4. エフェクトが多いときの見やすさ

### Takeaway
明確な事例は少ない。「ダメージ数字は大きさ・数・色を抑える」「アクセシビリティ指針は揺れ・点滅を切れるように」という一般論のみ。

### Cited Findings
- 【要約のみ】Xbox Accessibility Guideline 117: 画面揺れ・カメラの揺れ・モーションブラーは避けるか、切れるようにする。Halo Infinite は 0〜100% のスライダー — [Microsoft Learn XAG 117](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)
- 【要約のみ】XAG 118(光過敏): 点滅の明暗差を下げる・頻度を下げる・面積を小さくする — [Microsoft Learn XAG 118](https://learn.microsoft.com/en-ie/gaming/accessibility/xbox-accessibility-guidelines/118)
- 【要約のみ】Marvel Rivals(NetEase)が 2026 年にアビリティ VFX を減らし、6 対 6 の戦いを読みやすくする更新を出した — [comicshoplocator.com](https://www.comicshoplocator.com/2026/07/17/marvel-rivals-vfx-clarity-update-battlefield-chaos-2026/)。二次的な媒体で、別ジャンル。
- 【要約のみ】開発者向けガイド: ダメージ数字は「知らせるが、覆わない」。大きさ・数・色を抑える — [bugnet.io](https://bugnet.io/blog/how-to-build-a-damage-number-system)(ブログ、質は低い)
- 【要約のみ】Mighty Bear Games の記事「UX デザインが VFX を助ける方法」が存在(本文未取得) — [medium.com/mighty-bear-games](https://medium.com/mighty-bear-games/how-ux-design-can-help-with-vfx-a0925f80e0f0)

### Inferences
- 【中】WO の「引っぱっている間は何も重ねない」「敵の番 3 秒以内」「動きを減らすで揺れ・スロー・点滅を止める」は XAG の方向と合う。WO に「演出を重ねない領域(敵の予告・体力の棒)を決める」という描画順の決まりが無いので、追加を勧める(推論)。
- 【弱】「透明度の目安」の数値出典は取れず、WO にも数値を足せない。

### Gaps
- 予告・体力が演出で隠れない工夫(開発者談)の一次資料は未取得。透明度の具体数値も無し。

## 5. 情報の段階的な見せ方・チュートリアル

### Takeaway
StS の経緯が、WO の「数字は長押し」への最大の反証。Ma の「全部は常時出せないので折りたたむ」はモバイルでの支持材料。

### Cited Findings
- StS: 数字を隠して簡素にする案より、数字を出す案のほうが魅力的だった(2 節の Wikipedia【本文確認】)
- 【要約のみ】Into the Breach モバイル: 全情報の常時表示を諦め、折りたたみ UI や削減で対応(2 節 TouchArcade)
- 【要約のみ】itch.io の開発者投稿: 情報をカテゴリに分け、敵の周囲の別位置に置く(2 節)

### Inferences
- 【中】分け方: 毎手の判断に要る情報(敵の次の行動・ダメージ・次に動く駒・危険な場所)は常時、そうでない情報(持ち物・パッシブの説明・図鑑)は長押し、という線引きが事例と合う。WO は「体力の数字」を長押しに回しているが、**敵の与ダメージの数字**は WO のどこにも無い(カウントと範囲のみ)。→ 見直し候補。
- チュートリアルの入れ方(最初の数戦だけ矢印で教える等)の出典は取れず。

### Gaps
- Pokémon Masters、ウマ娘、ブルアカのチュートリアル・段階開示の事例は未取得。

## 6. アクセシビリティ(色覚・動き・文字・音なし)

### Takeaway
指針は一致: 色だけに頼らない(形・縁・数字を足す)、動きは切れる、文字は拡大できる、音の情報は視覚でも出す。WO はこの方向を既に採っている。

### Cited Findings
- 【要約のみ】色だけで重要情報を伝えない。形・アニメ・縁取りを足す — [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone/)
- 【要約のみ】WCAG 1.4.11: 情報を持つ UI 部品・図形は 3:1 以上のコントラスト — 同要約(accessible.games / 複数)
- 【要約のみ】Unity の入門: 文字は標準で読める大きさ、拡大可能に。本文 4.5:1・大きい文字 3:1 — [unity.com/blog/video-game-accessibility-basics](https://unity.com/blog/video-game-accessibility-basics)
- 【要約のみ】Steam 文書: 重要な効果音には視覚の目印も用意。画面揺れなどは調整可能に — [partner.steamgames.com](https://partner.steamgames.com/doc/accessibility_features)
- 【要約のみ】「Xbox は 1080p で 28px 以上」という二次情報あり。Xbox の一次ページで確認できず、使わない — 同検索

### Inferences
- 【強】WO §4 の「味方=太い縁、敵=数字の丸」「危険は色+点線+『落ちる』の文字」は指針に沿う。ライト・ダーク両方でのコントラストは uicheck の contrast_low=0 が担う。
- 【中】「文字の拡大」は WO に無い。文字階層を 5 つ以内に絞る規則と衝突しうる(OS の文字拡大に追従するか)。決める価値あり。

### Gaps
- 日本語圏のゲームでの色覚配慮の具体例は未取得。

## 7. 開発者・デザイナーが語った失敗と改善

### Takeaway
裏づけが取れたのは StS の「数字を隠す→出す」と Into the Breach の「明快さのために捨てる」。いずれも「予告は正確に見せる」の方向。

### Cited Findings
- StS: Next Turn → Intents(数値なし)→ Intents(数値あり)の変遷(2 節【本文確認】、en.wikipedia)
- 【要約のみ】Into the Breach: 凝った案より明快さを毎回選んだ(2 節 Game Developer)
- 【要約のみ】Into the Breach は敵の全行動を事前に明示し、そのために試行錯誤が多かった — [gamespot.com レビュー等の要約](https://gamespot.com/reviews/into-the-breach-review-a-mechanized-masterpiece/1900-6416865/)
- 【要約のみ】Ma は「味方を失うのが最悪」という思い込みを捨てさせるのが要る、と語った — [Game Developer "Reimagining failure"](https://www.gamedeveloper.com/design/reimagining-failure-in-strategy-game-design-in-i-into-the-breach-i-)

### Inferences
- WO の「小型の戦略ゲームで『駒が増えると地図が読めない』という批判があった」という記述は、今回の調査で出典を確認できなかった(WO 側の出典を明記するか、削るか)。

### Gaps
- Marvel Snap の UI 設計の失敗談は未取得("Designing Marvel Snap" の GDC 講演があるらしいが本文なし)。

## 8. Material Design 3 などのガイドラインで当てはまる部分

### Takeaway
当てはまるのは、タッチ領域 48dp・間隔 8dp、見た目より当たり判定を広げる考え方。状態の表し方の仕様は取れなかった。

### Cited Findings
- 【要約のみ】48×48dp・間隔 8dp・見た目より広い当たり領域は 3 節の出典と同じ
- 【要約のみ】密度を上げた部品は 48dp を満たさない、と明記 — [material.io applying-density](https://material.io/design/layout/applying-density.html)

### Inferences
- 【中】WO の「角丸 3 つ以内・文字階層 5 つ以内」は自作規則で、M3 とは別物。M3 は卓の中のような「自由な操作面」には規定を持たない(推論)。

### Gaps
- M3 の状態レイヤー(押下・フォーカス・無効)の数値は未取得。

---

# まとめ: おはじきバトルへ移せそうなもの / 発注書で見直したほうがよい点(推論。根拠の強さつき)

## 移せそうなもの
1. 【強・本文確認】引き始めは「画面のどこでも」可、矢印で方向を示す(モンスト)。WO の「卓の下端より下で引ける」を維持してよい。
2. 【強・本文確認】敵の頭上の「あと何ターン」の数字(モンスト 2013 年〜)。WO §5-4 を維持。
3. 【強・本文確認】SS=溜まったら光る 1 つのアイコンをタップ(モンスト)。WO §5-6 を維持。
4. 【中・本文確認】弱点は三角マーク、ギミックは盤面上の物として見せる(モンスト)。WO の「柵の切れ目=危険色の点線」「床の仕掛け=淡い円」と同じ発想。
5. 【中・要約のみ】敵 1 体を押すと、その敵の範囲だけ出る(FEH)。WO の「長押しで説明」と相性がよい。
6. 【中・要約のみ】情報をカテゴリ別に別位置へ(itch.io の開発者投稿)。WO の「体力の棒は駒の下、ターン数は右上」と合致。
7. 【中・要約のみ】揺れ・点滅は切れるように、色以外の手がかりを足す(XAG・GAG)。WO §5b の共通決まりと合致。
8. 【中・要約のみ】タッチ領域 48dp+間隔 8dp(M3)。必殺ボタン高さ 56 は可。

## 発注書で見直したほうがよい点
1. 【強・本文確認】**敵の予告に「与ダメージの数字」が無い**。WO は「数字は長押しで出す」+敵はターン数と範囲のみ。StS は数字を隠す案から出して戻した(プレイテストで、数字のほうが魅力的・記号を覚えずに済む)。範囲を塗るだけだと「何点食らうか」が読めない。→ カウント 1 の敵だけでも、範囲内の味方駒の上に予想ダメージ(例 -3)を常時出す案を A/B に追加。
2. 【中・推論】「体力の数字は長押しだけ」(§6)は、棒+半分の目印で足りるか未検証。StS の教訓(数字が要る)は敵の意図の話で、味方 HP には直接当てはまらない。実機で A/B を撮って決めるのが妥当(出典では決められない)。
3. 【中・推論】引っぱり中の「強さ 中(離すと発射)」の文字を下の 1 行に置くと、引く親指の近くで隠れる恐れ。位置は実機で確認(出典なし)。
4. 【中・推論】「…」に「早送り」を入れているが、右上は片手で最も遠い。戦闘中に何度も使うなら、置き場を再検討。
5. 【中・推論】描画順の決まりを追加: 演出(数字・輪・カットイン)より下に、敵のカウント・予告範囲・体力の棒を描く。
6. 【弱・推論】文字の拡大(OS 設定への追従)の扱いが WO に無い。
7. 【出典不明】§2 の「駒が増えると地図が読めない批判」は今回の調査で確認できなかった。WO に出典を書くか、削る。
8. 【未確認】モンストの矢印・ガイド線・キャンセルの具体、および Marvel Snap/Hearthstone/Pokémon/ウマ娘/ブルアカ/Monster Train/Wildfrost/Balatro の UI は未調査同然。PC のセッションで実画面(スクショ)を集める(WO §3a の既存計画)ほうが早い。ネットワーク許可に gamedeveloper.com・nintygamer・arstechnica・smashingmagazine・gdcvault を足せば、原文確認がかなり進む。
