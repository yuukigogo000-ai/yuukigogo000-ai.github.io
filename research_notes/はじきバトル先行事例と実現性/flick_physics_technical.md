# はじきバトル(円盤フリック・ターン制)の技術・UX知見

調査方法メモ: WebFetch は使えず、curl で取得できたのは en.wikipedia.org と npm レジストリのみ(gafferongames.com は proxy で拒否を確認)。それ以外は WebSearch の要約のみ【要約のみ】。「一般知識」は出典を開けていない自分の知識【出典なし・一般知識】。実機検証は一切していない。

## (1) JavaScript の数値演算のクロスデバイス決定性

### Takeaway
+ - * / と Math.fround / Math.imul / (実質)Math.sqrt は IEEE-754 通りで端末をまたいで一致すると見てよい(ただし spec 原文は今回開けていない)。sin/cos/atan2/pow/exp/hypot は spec 上「実装近似」で、エンジン・OS・CPU で最下位ビットが変わりうる。ゲームの物理は +-*/sqrt だけで書き、三角関数は初期化時に使うなら自前実装か整数量子化した表にする。

### Cited Findings
- ECMAScript の Math.pow / sin 等は「正確な結果を規定せず、特定の境界入力のみ規定」「implementation-approximated」。sin/cos の値域が [-1,1] である保証すらない、という指摘もある【要約のみ】 — [ES2024 Math object (read262)](https://read262.netlify.app/numbers-and-dates/math-object), [Zenn uhyo 解説](https://zenn.dev/uhyo/articles/javascript-math-accuracy?locale=en)
- `**` と Math.pow が同じ値を返さないケース(V8 で 1.35 ** 92 と変数指数の差)の報告【要約のみ】 — [freeCodeCamp](https://www.freecodecamp.org/news/i-found-a-bug-in-v8s-exponentiation-operator-dcddfa5b8482/)
- SpiderMonkey でプラットフォームにより Math 関数の結果が異なる bug、64bit/32bit シェルで ecma3/Math テスト差の報告【要約のみ】 — [Mozilla bug 521245](https://bugzilla.mozilla.org/show_bug.cgi?id=521245)
- TC39 bugzilla: sin(2π) の具体値を検査するテストは仕様を過剰拘束との議論【要約のみ】 — [tc39 bugzilla 285](https://tc39.es/archives/bugzilla/285/)
- Rapier 公式 JS ドキュメント: 初期値を Math.sin/Math.cos で作ると端末間で異なりうる。決定論な値を使え、と明記【要約のみ】 — [rapier.rs JS determinism](https://rapier.rs/docs/user_guides/javascript/determinism)
- Box2D 作者 Catto(2024): クロスプラットフォーム決定性のために FMA 縮約を無効化(-ffp-contract=off)、fast-math を避け、標準の sinf/cosf/atan2f はコンパイラ依存なので自前近似を実装。x64/ARM、MSVC/GCC/Clang で検証、性能影響は目立たないと報告【要約のみ(検索要約経由の二次記述)】 — [box2d.org determinism 2024](https://box2d.org/posts/2024/08/determinism/)
- Gaffer "Floating Point Determinism": 結果はプラットフォーム依存(x86/x64/PPC)で、著者自身「決着していない」とする。決定性は浮動小数性能を大きく下げうる。**結論部は取得できず未確認**【要約のみ】 — [gafferongames.com](https://gafferongames.com/post/floating_point_determinism)
- Deterministic Lockstep(Gaffer): デバッグ/リリースビルド間でさえ浮動小数最適化で非決定的になりうる、銀の弾丸はない【要約のみ】 — [gafferongames.com](https://gafferongames.com/post/deterministic_lockstep/)
- GDC 2024 "Cross Platform Determinism"(Pollard): 複数コンパイラ環境では堅牢性優先で、可能なら固定小数を推奨【要約のみ】 — [GDC Vault スライドPDF](https://media.gdcvault.com/gdc2024/Slides/GDC+slide+presentations/Pollard_Bradley_CrossPlatformDeterminism+2024-03-26+09.34.19.pdf)
- Riot(LoL)の決定性: 乖離の修正記事あり(内容は未読)【要約のみ】 — [Riot](https://www.riotgames.com/en/news/determinism-league-legends-fixing-divergences)
- 【出典なし・一般知識】ES 仕様は Number を IEEE-754 binary64 として + - * / % を定義しており、エンジンは丸めを変える fused multiply-add への縮約をしてはならない(C と違い式単位の縮約が許されない)。Math.fround(32bit丸め)と Math.imul(32bit整数乗算)は仕様上厳密。Math.sqrt は IEEE の正しい丸めとして実装されるのが実際だが、仕様の文言は今回開いて確認していない。要 test262 / 実機確認。
- 【出典なし・一般知識】対策の定石: 固定タイムステップ、描画と独立、配列順固定の反復、シード付き PRNG(mulberry32 等を Math.imul で)、Date/performance.now/Math.random 不使用、入力(角度・強さ)を整数に量子化、三角関数を使わず方向を (dx,dy) 整数ベクトル→正規化(sqrt のみ)で扱う、必要なら Math.fround や整数/固定小数で全状態を持つ。Object のキー順・Map 反復順は挿入順で決定的だが、配列ソートの不安定性(古い環境)に注意。

### Inferences
- 本件は円と壁だけなので、sqrt と四則のみで衝突処理が書ける。三角関数を完全に排除でき、最小コストで端末間一致を狙える(エンジン同梱ライブラリを使うより有利)。
- 「既存エンジンがシミュレーション結果のハッシュでテスト」している前提なら、同じハッシュ検査を iOS Safari(JSC)/Android Chrome(V8)/Firefox(SpiderMonkey) 実機で回すのが唯一の確証。Node(V8)だけの一致は JSC の保証にならない。
- 「実装近似」関数が現れる箇所の洗い出し(Math.hypot/atan2/pow/exp/sin/cos)を grep で行い、ゼロにする方針が単純。

### Gaps
- ES 仕様の +,*,sqrt,fround,imul に関する原文確認(tc39.es 禁止、検索でも未取得)。
- Gaffer 記事の結論本文と Fix Your Timestep の本文(proxy 拒否)。
- JSC/V8/SpiderMonkey で Math.sqrt が必ず IEEE 準拠かを示す一次情報。
- 実際に iOS/Android 間でシミュレーションハッシュが一致したという公開事例は見つからなかった。

## (2) シンプルで頑強な 2D 円物理

### Takeaway
円-円の弾性衝突は接線(法線)方向の速度成分だけを質量・反発係数で更新する式で足りる。トンネリングはステップ分割(サブステップ)か掃引で防ぎ、終了保証は「速度閾値で停止+最大ステップ数」で担保する。

### Cited Findings
- 2D 弾性衝突は、接触角(法線)方向に回転して 1 次元問題として解き、元の座標に戻す。角度なし表現(ベクトル式)もある。質量 m1,m2 の式が Wikipedia に載る【本文確認】 — [Wikipedia: Elastic collision](https://en.wikipedia.org/wiki/Elastic_collision)
- 衝突の時刻(TOI)を求めて、そこで止める(カクつく)か、そこまで進めてサブステップする(CPU 増)。円では TOI 計算が速く効果的、細長い形状には不向き【要約のみ】 — [Catto GDC2013 Continuous Collision](https://box2d.org/files/ErinCatto_ContinuousCollision_GDC2013.pdf)
- 掃引(swept)CCD は貫通を完全に防げ、speculative は貫通・ゴースト衝突が残る。多数の高速体が近いと掃引はコスト増【要約のみ】 — [Unity CCD docs](https://docs.unity3d.com/2020.2/Documentation/Manual/ContinuousCollisionDetection.html), [Avian ccd 例](https://docs.rs/crate/avian2d/latest/source/examples/ccd.rs)
- 【出典なし・一般知識】公式: 法線 n=(pB−pA)/|…|、相対法線速度 vn=(vA−vB)·n。vn>0(接近中)のときのみ衝撃 j=−(1+e)·vn/(1/mA+1/mB)、vA+=j/mA·n、vB−=j/mB·n。e は 0〜1(ペア反発係数は min か積などで合成)。接線(摩擦)は無視してよい(円の回転を持たない設計なら)。
- 【出典なし・一般知識】減衰: 速度 *= (1−μdt) の指数減衰だと永遠に 0 にならないので、|v|<ε で 0 にスナップ。または一定減速(クーロン摩擦風)v −= a·dt で必ず有限時間で停止し、「停止に必要な最大ステップ数」を上から見積もれる。
- 【出典なし・一般知識】重なり解消: 衝撃後に位置補正(重なり量を質量比で押し戻す)。複数同時衝突は順序依存になるため、(i,j) の添字順で固定処理し、反復を数回回す。連鎖・積み重ならない円なので、反復回数固定で決定性は保てるが「物理的に正しい同時衝突」ではない旨を設計に書く。
- 【出典なし・一般知識】落下判定: 中心が盤の外側(または半径の一定割合が出た)かで判定。開放縁では「中心が縁を越えたら落下確定」とし、境界上の微妙ケースを epsilon で決める。
- 【出典なし・一般知識】トンネリング目安: 1 ステップの移動量が半径(または半径合計の 1/2 程度)を超えないようにステップ数を決める。最大初速を制限しておけば、固定サブステップ数だけで十分なことが多い。

### Inferences
- 最大初速を決め、dt を「最大初速×dt < 半径」にすれば CCD 不要。180〜240Hz 固定ステップで 8 円は計算量的に余裕(ペア 28 組)。
- 終了保証は、(a) 全円の |v|<ε で停止、(b) 最大ステップ数でも強制停止、の二重にして、ハッシュ検査に最大ステップ到達率を記録するとよい。

### Gaps
- 公式の一次出典(教科書・GDD)を開けていない。式は検算(エネルギー・運動量保存の単体テスト)で確認する必要がある。
- 同時多体衝突の順序依存を扱った公開記事は今回見つからなかった。

## (3) ライブラリ vs 自作

### Takeaway
円だけ・8個・決定性必須なら、同梱の汎用エンジンは過剰で、決定性の保証があるのは Rapier の deterministic ビルド(WASM)だけ。planck.js/matter.js は「同一ランタイム内でのみ再現」であって端末間一致は保証外。自作円ソルバが最小で見通しがよい。

### Cited Findings
- npm 実測(2026-11 時点・本文確認): matter-js 0.20.0(unpacked 約 0.93MB、最終更新 2024-06-23)/ planck 1.5.1(約 9.1MB、2026-10-12 更新)/ planck-js 1.3.0(約 9.8MB、2025-02-19)/ @dimforge/rapier2d 0.21.0(約 4.1MB、2026-09-25)/ rapier2d-compat 0.21.0(約 12.1MB、wasm を base64 同梱)/ rapier2d-deterministic 0.21.0(約 4.1MB)/ p2 0.7.1(最終更新 2022-06-23)/ box2d-wasm 7.0.0(約 2.0MB、2022-04-12)【本文確認(npm view の出力)】 — `npm view <pkg> version dist.unpackedSize time.modified`(unpackedSize は配布物の展開サイズで、バンドル後・gzip 後ではない)
- Rapier JS: 既定パッケージは同一マシンでのみ決定的。端末間一致は `-deterministic` 版(最適化が弱い)で保証され、World.takeSnapshot() の MD5 が端末間で一致する、と公式に記載【要約のみ】 — [rapier.rs JS determinism](https://rapier.rs/docs/user_guides/javascript/determinism)
- Rapier の Rust 側: enhanced-determinism は simd8 と併用不可、SIMD/並列なし=性能は落ちる【要約のみ】 — [rapier.rs Rust determinism](https://rapier.rs/docs/user_guides/rust/determinism/), [Godot Rapier 資産記述](https://godot.rapier.rs/docs/documentation/determinism)
- planck.js 公式 limitations: 同一入力・同一 JS ランタイムなら再現。バイナリ/プラットフォーム間は「いいえ」。固定小数は非対応【要約のみ】 — [planck limitations.md](https://app.unpkg.com/planck@1.5.1/files/docs/pages/limitations.md)
- matter.js: 公式の決定性保証は見つからず。固定ステップ runner でも同入力で結果が変わった報告、Common._seed を固定する言及【要約のみ】 — [matter-js issue 1167](https://github.com/liabru/matter-js/issues/1167)
- p2.js: JS エンジン間で三角関数精度の差によるクライアント/サーバー不一致の報告【要約のみ】 — [p2.js issue 155](https://github.com/schteppe/p2.js/issues/155)
- Box2D v2 FAQ: バイナリ・プラットフォーム間の同一結果は保証外。v3 は 2024 年にクロスプラットフォーム決定性を達成(上記 (1))【要約のみ】 — [Box2D FAQ](https://box2d.org/documentation/md__d_1__git_hub_box2d_docs__f_a_q.html)
- Rapier 系は PlayCanvas 比較表でも「公式 WASM はクロスプラットフォーム決定的、ビルド次第」と記載【要約のみ】 — [PlayCanvas ammo alternatives](https://developer.playcanvas.com/user-manual/physics/ammo-alternatives/)

### Inferences
- オフライン PWA なら Rapier は WASM を同梱でき実現可能だが、サイズ(~4MB級)・Vite での WASM 取り扱い・「initial values を Math.sin で作らない」制約・既存ハッシュ試験との相性が代償。円8個のためには過剰。
- 自作なら: 依存ゼロ、サイズ数KB、挙動の全責任を持つ(同時衝突の順序など)代わりに、テストを書く手間は自分持ち。

### Gaps
- 各ライブラリのバンドル後 gzip サイズは未測定(インストール禁止のため)。
- box2d-wasm・p2 の決定性主張は見つからず。planck 1.5.x の最新変更は未確認。

## (4) スマホでのフリック照準 UX

### Takeaway
引っ張って離す(ドラッグバック)は指が標的を隠さないという利点が定番理由とされる。一方、公開されている体系的なユーザー調査は見つからず、多くは開発者の意見。最小ドラッグ距離・キャンセル領域・補助(タップで確定)は自前で試験する前提。

### Cited Findings
- ドラッグバック方式(Angry Birds)は指が狙いを隠さない、という開発者コメント(一個人の意見)【要約のみ】 — [TouchArcade スレッド](https://toucharcade.com/community/threads/thoughts-on-control-scheme.71854/)
- 標準パターン: ドラッグで方向と強さ、離して確定。矢印・軌道・パワーバーのガイド表示。操作対象を指から少しずらして見えるようにする【要約のみ】 — [Cursa: Touch Controls](https://cursa.app/en/page/touch-controls-for-mobile-games-input-patterns-and-feedback)
- 指による隠れ(occlusion)は既知の問題【要約のみ】 — [Game Developer: UX deep dive](https://www.gamedeveloper.com/game-platforms/ux-deep-dive-painful-reality-of-building-fps-experiences-on-mobile-part-1)
- ブラウザジェスチャ: 画面全体の下スワイプ更新は html/body の `overscroll-behavior-y: contain` で無効化(グロー等は維持)。タッチ対象に `touch-action: none` を付けると引っ張り更新を含むタッチの既定動作が無効。ただし canvas 自体の overscroll 指定では効かないとの報告もある【要約のみ】 — [Chrome: overscroll-behavior](https://developer.chrome.com/blog/overscroll-behavior), [Mozilla bug 1807074](https://bugzilla.mozilla.org/show_bug.cgi?id=1807074)
- ターゲットサイズ: WCAG 2.5.8(AA)は 24×24 CSS px 以上(または間隔の例外)、2.5.5(AAA)は 44×44。Material は 48dp 推奨(これは設計指針で適合要件ではない。一部サイトは 44px と書き、二次サイト間で食い違い)【要約のみ】 — [TetraLogical](https://tetralogical.com/blog/2022/12/20/foundations-target-size/), [Deque axe target-size](https://dequeuniversity.com/rules/axe/4.8/target-size)
- 触覚: iOS Safari は navigator.vibrate 未対応(W3C 実装報告で WebKit 全 iOS ブラウザ not implemented)。`'vibrate' in navigator` での検出は iOS で当てにならない。Safari 17.4 の `<input type=checkbox switch>` を使う回避策が存在するが副作用利用【要約のみ】 — [W3C Vibration 実装報告](https://w3c.github.io/vibration/reports/implementation.html), [azukiazusa WebHaptics](https://azukiazusa.dev/blog/ios-safari-web-haptics.md)
- 【出典なし・一般知識】設計論点: 画面下部の盤面外でも引ける「どこからでもドラッグ」 vs ピース上から開始;最小ドラッグ距離(誤タップ防止、例 8〜12px)と元位置付近のキャンセル円;指離しで確定前に取り消す操作(盤外へ戻す);強さの写像はリニア+端のみ飽和、または 2 次曲線で弱い shot を精密化;一手でも片手親指が届く範囲に主操作を置く;Pointer Events(pointerdown/move/up、setPointerCapture)と pointercancel の処理。
- 【出典なし・一般知識】アクセシビリティ案: 「タップで角度・長押しで確定」など代替入力、軌道プレビューの ON/OFF、ドラッグ量を数値表示。

### Inferences
- 引く方向と発射方向が逆であることの学習コストは、軌道プレビュー(最初の接触点まで)で緩和できるが、プレビューは AI/自動操作・難度設計と衝突するので「最初の接触点まで」「何本か点」などに限定する判断が必要。
- 日本の他タイトルや pool/carrom アプリの具体的な不満(レビュー分析)は今回見つからず。

### Gaps
- pool/carrom/弾き系アプリの苦情の体系的情報、Material 3 / Apple HIG のタッチターゲット原典、Pointer Events 仕様の原文は未確認。

## (5) 低スペック端末での描画・性能

### Takeaway
約10スプライトなら Canvas 2D で十分と見込めるが、これは公開ベンチマークではなく推論。DPR を 2 程度に制限するなど解像度を落とす案は未検証。シミュレーションを先に走らせて再生する構成は、決定性と描画の分離に向く。

### Cited Findings
- WebGL は多スプライト(1000 級)で有利との声と、低スペック Mali タブレットで Canvas の方が滑らか/差がなかったとの声が混在(いずれも逸話)【要約のみ】 — [html5gamedevs](https://html5gamedevs.com/topic/26175-game-works-better-in-canvas-than-in-webgl), [OpenFL community](https://community.openfl.org/t/webgl-slower-than-canvas-in-html5-target-and-other-problems-with-canvas/11481)
- PixiJS v4 tips: 古い端末では小さい低解像度テクスチャ推奨【要約のみ】 — [PixiJS wiki](https://www.github.com/pixijs/pixijs/wiki/v4-Performance-Tips)
- Fix Your Timestep: 固定刻み dt で積分し、余りは描画補間に使う。フレーム時間に上限(0.25s)を付けて「死のスパイラル」を避ける。セミ固定刻みは決定性を失う【要約のみ(二次記述)】 — [gafferongames.com/fix_your_timestep](https://gafferongames.com/post/fix_your_timestep/), [gamedev.net 解説](https://www.gamedev.net/blogs/entry/2262574-thoughts-on-fix-your-timestep-and-the-spiral-of-death)
- 【出典なし・一般知識】本件向け: ショットごとに「結果の全軌跡(各ステップの全円位置+イベント列)」を先に決定的に計算し、描画側はその配列を時間で補間して再生すれば、描画のフレーム落ちが結果に影響しない。ハッシュは軌跡/最終状態に対して取る。
- 【出典なし・一般知識】DPR: canvas の幅高さを cssSize×min(devicePixelRatio, 2) に。resize/orientation で再設定。静的な盤面は別 canvas(背景層)にしてフレーム毎の再描画を避ける。ダーティ矩形や offscreen は 10 個程度では不要の可能性が高い。静止中は rAF を止めて電池を節約。
- 【出典なし・一般知識】バックグラウンドで rAF が止まる/タブ復帰時に巨大 dt が来る問題 → 固定ステップなら上限クランプ。

### Inferences
- Canvas 2D+事前シミュ+再生が、決定性・実装量・電池の面で最小構成と見込む。エフェクト(パーティクル)が増えた段階で初めて WebGL を検討。

### Gaps
- 低スペック Android 実機での DPR 別フレーム時間、熱・電池の公開データは見つからず(要実機計測)。

## (6) AI / 自動プレイ

### Takeaway
標準手法は「候補ショット(角度×強さ)を多数サンプルし、決定的シミュレータで結果を採点して最良を選び、難度は狙いへのノイズで調整」。シミュレータが決定的なので追加の探索ほぼ無償で使える。

### Cited Findings
- カロムAI: 乱択した多数のショットをシミュレーションして最良を選ぶ。強さを数段階試す、という助言【要約のみ】 — [gamedev.net pool AI スレ](https://gamedev.net/forums/topic/625601-poolbilliard-ai-new/4944968/)
- 人間らしさ: 角度にノイズを加える/シミュレータが決定的なので不完全な技量はショットパラメータにガウスノイズを加えて模擬(ビリヤードAI研究)【要約のみ】 — [IJCAI 2009 論文](https://meilu.jpshuntong.com/url-687474703a2f2f696a6361692e6f7267/Proceedings/09/Papers/231.pdf), [AAMAS 2010](https://ifaamas.csc.liv.ac.uk/Proceedings/aamas2010/pdf/01%20Full%20Papers/22_05_FP_0677.pdf)
- Carrom_rl: pygame+pymunk による連続行動空間のカロムシミュレータ(強化学習用)【要約のみ】 — [Carrom_rl](https://github.com/samiranrl/Carrom_rl)
- CueTip(2025): 物理を考慮したビリヤード助言。難度をエントロピーで分類【要約のみ】 — [arXiv 2501.18291](https://arxiv.org/pdf/2501.18291)
- 【出典なし・一般知識】コスト見積り: 8 円×数百ステップ×ペア 28 の素朴実装で 1 ショット数万〜数十万演算、JS では概ね 0.1〜1 ms 級(要計測)。300 候補なら数十〜300ms。Web Worker で分離しメインスレッドを止めない。ターンを止めない工夫(思考演出)と、候補数を端末性能に合わせて減らす場合、AI の選択が端末ごとに変わる=ボス日替わり結果の一致に関わるので、**AI の候補数・乱数は固定**し、時間切れで打ち切らない。

### Inferences
- 「日替わりボス」で全員同じ結果にするには、ボスAIの選択も決定的サンプリング(固定シード、固定候補数、固定順)であること。時刻/処理速度依存の打ち切りは禁止。
- 難度調整はスコア関数の重み・ノイズ幅・候補数のどれでも可能だが、ノイズは seeded PRNG で。

### Gaps
- JS での 1 ショット計算コストの実測値の公開例は見つからず(自分で計測する必要)。コンシューマ向け商用タイトルの AI 実装の一次情報は見つからず。
