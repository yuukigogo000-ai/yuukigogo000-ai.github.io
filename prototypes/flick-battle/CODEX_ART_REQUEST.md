# Codex への依頼: おはじきバトルの足りない絵の試作(見本画像 8 枚ずつ)

- 作成日: 2026-11-17(発注者「足りない絵 → コーデックスに試作してもらおう。モデル画像 8 枚づつつくってもらって」)
- 対象: Codex(画像生成ができる状態で)。この md を渡すか、§1〜§4 をそのまま貼る
- 作るもの: **8 種類 × 8 枚 = 64 枚**(卓の天板 3・卓の物 4・ボスの洗濯機 1)
- 使い道: ハウス・グランプリの新しい戦闘「おはじきバトル」の画面(`prototypes/flick-battle/UI_ANIM_PROCEDURE.md` のフェーズ 4・6)
- 試作なので、**ここで作った絵はまだ公開しない**。発注者が 1 種類につき 1 枚(または「どれも違う」)を選んでから、PC の Claude が本体に入れる

---

## 使い方(あなたへ)

1. Codex に、このファイルの場所を伝えて「§1 から順にやって」と頼む(または §1〜§4 を貼る)
2. Codex が `art_candidates/battle/` に 64 枚と一覧画像を出す
3. 一覧画像を見て、種類ごとに 1 枚選ぶ(「A は 3 番、B は 6 番、D はどれも違う」のように)
4. 選んだ結果を PC の Claude に伝える → §7 の手順で本体に入る

---

## §1 Codex への依頼文(そのまま貼る)

```
ハウス・グランプリ(家の中のモノがキャラになって戦うスマホゲーム)の新しい戦闘画面で使う絵を試作してください。
足りない絵が 8 種類あります。§4 の種類ごとに、見本画像を 8 枚ずつ、合計 64 枚作ってください。

絶対条件:
1. 画風は、いまのゲームの絵に合わせる。必ず先に次の参照画像を開いて見る:
   photo-roguelike/art/forms/mug_0.webp, forms/microwave_0.webp, forms/electricfan_0.webp, forms/dryer_3.webp,
   art/items/item_pot_lid.webp, art/backdrops/bg_kitchen.webp, art/backdrops/bg_living.webp
   (このリポジトリ yuukigogo000-ai.github.io の中。本体のソースの public/art にも同じものがあるはず)
2. 文字・数字・ロゴ・商標を入れない(しょうゆ差しなども、実在のメーカーの形や柄をまねない)
3. 人物・人の手を描かない
4. 「背景透明」の指定があるものは、本物の透明(アルファ)で出す。白い背景で塗らない
5. 影を絵に入れない(影は画面側で描く)。卓の天板だけは、ごく薄い光のむらは可
6. 透かし・署名・枠を入れない
7. 同じ種類の 8 枚は、§4 の「8 枚の変え方」に従って少しずつ変える(同じ絵の色違いばかりにしない)
8. 出力の置き場所・ファイル名は §5 のとおり。最後に種類ごとの一覧画像(8 枚を 4×2 に並べ、番号を付ける)も作る
9. 使ったプロンプトを 1 枚ずつ notes.md に残す(選ばれた絵を作り直せるように)
```

## §2 共通スタイル(各プロンプトの先頭に毎回付ける)

いまのゲームの絵を見て、こちらでまとめた特徴:

| 項目 | いまのゲームの絵 |
|---|---|
| 画風 | 写実寄りの 3D レンダー。使い込まれた家庭用品の質感(小さな傷・ほこり・角の摩耗・少しのさび) |
| キャラの顔 | 黒い小さな玉の目が 2 つ(口はないか、ごく小さい)。怒ると眉や牙が付く |
| キャラの手足 | 細い焦げ茶の金属線の腕と脚、丸い関節、小さなミトンの手、丸い足 |
| 光 | 夜の家の中の、あたたかい電球色。やわらかい影(ただし今回は影を描かない) |
| 背景(部屋) | 夜の台所・リビングの床。茶色〜橙の暖色、窓の外は暗い |

英語の共通プロンプト(各プロンプトの先頭に付ける):

```
Style: match the existing game art exactly — photorealistic-leaning 3D render of a well-used household object with small scratches, dust, worn edges and a little rust; warm tungsten night-time indoor lighting; rich but slightly muted colors; clean silhouette; centered; no text, no letters, no numbers, no logos, no brand shapes, no people, no hands, no watermark, no frame, no drop shadow.
```

## §3 作るものの一覧

| 記号 | 種類 | ゲームでの役目 | 大きさ・背景 | 枚数 |
|---|---|---|---|---|
| A | 卓の天板: 台所のテーブル | 戦う卓(真上から見た板) | 1080×1560(縦横 9:13)・不透明 | 8 |
| B | 卓の天板: リビングのローテーブル | 同上 | 1080×1560・不透明 | 8 |
| C | 卓の天板: 屋根裏の作業台 | 同上 | 1080×1560・不透明 | 8 |
| D | コップ | 卓の物(動かない。跳ね返りに使う) | 1024×1024・背景透明 | 8 |
| E | 輪ゴムの柱 | 卓の物(当たった駒を強く弾き返す) | 1024×1024・背景透明 | 8 |
| F | しょうゆ差し | 卓の物(押すと動く。敵にぶつけるとダメージ) | 1024×1024・背景透明 | 8 |
| G | お皿(小皿) | 卓の物(3 つ並べて、全部倒すと柵が開く) | 1024×1024・背景透明 | 8 |
| H | ボスの洗濯機 | 章末のボス(決まり: 敵の番ごとに卓が回る) | 768×1024(縦 3:4)・背景透明 | 8 |

**ゲーム側の事情(絵の決まりの理由)**:
- 卓は**真上から**見る。駒は丸い当たり判定で動くので、卓の物(D〜G)も**真上から見て丸く収まる形**にする(画面では、絵を当たり判定の円の中に描く)
- 卓のふち(柵)と、落ちる切れ目は画面側で描く。切れ目の位置は卓ごとに違い、洗濯機のボス戦では回って変わるので、**天板にはふちを描かない**
- 卓の上には、駒・数字・文字・光の演出が重なる。**天板は模様が細かすぎず、明るすぎない**(駒が読める中くらいの暗さ)
- 卓の物と床の仕掛け(すべる水たまり・とまるマット・あついコンロ)も画面側で描くので、**天板には何も置かない**

## §4 種類ごとの指示

### A 卓の天板: 台所のテーブル

```
A wooden kitchen dining table top seen exactly from directly above (orthographic top-down), filling the whole 1080x1560 frame edge to edge, no table edges, no frame, no legs, no objects on it. Warm honey-colored wood planks running vertically, subtle everyday wear: faint cup rings, tiny scratches, slightly faded center. Medium brightness so small game pieces stay readable on top. Warm tungsten night-time light, very soft vignette.
```
8 枚の変え方: 木の種類(オーク・パイン・ブナ・ナラ)× 傷み(少ない・多い)。2 枚は板の継ぎ目を横向きに。1 枚はビニールのテーブルクロス風(無地・柄は控えめ)

### B 卓の天板: リビングのローテーブル

```
A living-room low table top seen exactly from directly above (orthographic top-down), filling the whole 1080x1560 frame edge to edge, no table edges, no frame, no objects on it. Dark walnut-brown wood with a soft satin finish, gentle wood grain, a few soft scratches. Medium-dark but not black, so small game pieces stay readable. Warm lamp light from one side, very soft vignette.
```
8 枚の変え方: ウォールナット・チーク・こたつの天板(木目プリント調)・古い座卓(漆風の濃い茶)× 光の向き(左・右)。1 枚はレース風の敷物が下の端にだけ少し見える

### C 卓の天板: 屋根裏の作業台

```
An old attic workbench top seen exactly from directly above (orthographic top-down), filling the whole 1080x1560 frame edge to edge, no edges, no frame, no tools or objects on it. Rough pine planks with gaps between boards, old paint drips, pencil marks, a few small nail heads, light sawdust. Dim warm light from a single bulb, slightly darker corners, still medium brightness in the center so small game pieces stay readable.
```
8 枚の変え方: 粗い松板・合板・古い天板に塗料の跡・カッターマット風の一部・木箱のふた風 × 明るさ(やや明るい・やや暗い)。鉛筆の線は文字や数字に見えないように

### D コップ

```
A small drinking glass tumbler seen from directly above at a slight angle (about 70 degrees looking down), round footprint, fully contained in a circle filling about 80% of the 1024x1024 canvas, transparent background, no shadow. Thick clear glass with a faint amber tint, a little water inside catching warm light, small chips on the rim.
```
8 枚の変え方: 透明なガラス・すりガラス・湯のみ(陶器)・マグを真上から(取っ手は円からはみ出さない)× 目なし / 黒い玉の目だけ(眠っている顔。手足は付けない)を 4 枚ずつ

### E 輪ゴムの柱

```
A short sturdy post wrapped tightly with many colorful rubber bands, seen from directly above at a slight angle (about 70 degrees looking down), round footprint, fully contained in a circle filling about 80% of the 1024x1024 canvas, transparent background, no shadow. The rubber bands look springy and slightly stretched, warm indoor light.
```
8 枚の変え方: 芯を 木の丸棒・糸巻き・コルク栓・鉛筆の束・消しゴムの塔・空き缶 に替える。輪ゴムの色(赤・黄・緑を中心に、多すぎない)。目なし / 玉の目だけ を混ぜる

### F しょうゆ差し

```
A classic small soy sauce dispenser (generic design, no brand shape, no label, no text), seen from directly above at a slight angle (about 70 degrees looking down), round footprint, fully contained in a circle filling about 80% of the 1024x1024 canvas, transparent background, no shadow. Glass body with dark soy sauce inside, a colored plastic cap with a short spout, a few sticky drips, warm indoor light.
```
8 枚の変え方: ガラス+赤いふた・ガラス+緑のふた・白い陶器・青い染付の陶器・木のふた・小さめの醤油瓶 × 目なし / 玉の目だけ。**実在の商品のボトルの形をまねない**

### G お皿(小皿)

```
A small round ceramic saucer (soy sauce dish), seen from directly above at a slight angle (about 70 degrees looking down), round footprint, fully contained in a circle filling about 80% of the 1024x1024 canvas, transparent background, no shadow. Off-white glaze with a thin blue rim line, a small chip on the edge, warm indoor light. It must read clearly even when drawn very small (about 20 pixels wide).
```
8 枚の変え方: 白無地・青い縁・染付の花(線は太めに)・小さな豆皿・木の小皿・金属の小皿 × 目なし / 玉の目だけ。**とても小さく描くので、細かい柄は入れない**

### H ボスの洗濯機

```
A boss character version of a washing machine in exactly the same style as the existing game characters (see photo-roguelike/art/forms/microwave_0.webp and forms/dryer_3.webp): a well-used vintage front-loading washing machine body with a round glass porthole door, small black bead eyes with angry eyebrows, thin dark-brown metal wire arms with ball joints and small mitten hands, wire legs with round feet, standing, full body, front three-quarter view, centered in a 768x1024 portrait canvas with a small margin, transparent background, no shadow. Soapy water swirling inside the porthole, a few soap bubbles floating around it. Menacing but still cute.
```
8 枚の変え方: ドラム式・縦型(ふたが上)・昔の二槽式 × 普通の姿 / 強い姿(泡をまとう・渦が光る・角や鋲が付く。forms の 3〜6 番の姿の強さを参考に)。表情は 怒り・にやり・目が回っている を混ぜる

## §5 納品の仕方

PC の作業場所(本体のソースの近く。**公開のフォルダには置かない**):

```
AI_WORKSPACE/photo-roguelike/art_candidates/battle/
  A_table_kitchen/   A_01.png … A_08.png   sheet.png   notes.md
  B_table_living/    B_01.png … B_08.png   sheet.png   notes.md
  C_table_attic/     C_01.png … C_08.png   sheet.png   notes.md
  D_cup/             D_01.png … D_08.png   sheet.png   notes.md
  E_band_post/       E_01.png … E_08.png   sheet.png   notes.md
  F_soy_bottle/      F_01.png … F_08.png   sheet.png   notes.md
  G_saucer/          G_01.png … G_08.png   sheet.png   notes.md
  H_boss_washer/     H_01.png … H_08.png   sheet.png   notes.md
  ALL_sheet.png      (全 64 枚を種類ごとに 1 行ずつ並べた一覧。番号つき)
```

- 画像は PNG(背景透明のものはアルファつき)
- `sheet.png` は 8 枚を 4×2 に並べ、左上に番号(1〜8)。背景透明の絵は、暗い背景(いまのゲームの画面に近い `#1a1714` くらい)の上に並べる
- `notes.md` に、1 枚ごとのプロンプト全文と、変えた点(例: 「3: 湯のみ・目あり」)

## §6 受け取ったときの確認(あなたと Codex で)

- [ ] 64 枚そろっている(8 種類 × 8 枚)
- [ ] 文字・数字・ロゴ・人の手が入っていない
- [ ] 背景透明の指定(D〜H)が本物の透明になっている
- [ ] 影が描かれていない
- [ ] 天板(A〜C)にふち・脚・物が描かれていない。駒が読める明るさ
- [ ] 卓の物(D〜G)が、真上から見て円の中に収まっている
- [ ] 洗濯機(H)が、いまのゲームのキャラと同じ画風(玉の目・針金の手足)に見える

## §7 選んだあと(PC の Claude がやること)

1. 選ばれた絵を、いまのゲームの絵と同じ形式にする: WebP・画質 80 前後。キャラ(H)は高さ 384px、卓の物(D〜G)は 256px 四方、天板(A〜C)は 720×1040
2. 本体のソースの `public/art/battle/` に入れる(名前の例: `table_kitchen.webp` `obj_cup.webp` `obj_band_post.webp` `obj_soy_bottle.webp` `obj_saucer.webp` `boss_washer.webp`)
3. 戦闘画面で使う: 天板は卓の塗りの代わり、卓の物は当たり判定の円の中に描く、洗濯機はボスの駒の絵
4. `licenses.html` の「画面の絵」の説明に、戦闘の絵の作り方(Codex の画像生成で作り、作者が選んだ)を足す
5. 選ばれなかった絵は `art_candidates/` に残したまま(公開しない)
6. 手順書のフェーズ 4(見本)で、選んだ絵を Stitch の生成指示に入れる

---

## §8 PC の Claude が Codex に頼む手順(発注者「あなたがコーデックスに指示して」2026-11-17)

クラウドの Claude からは PC の Codex に届かなかったため、PC の Claude がこの手順で Codex を動かす。発注者は PC の Claude に「`prototypes/flick-battle/CODEX_ART_REQUEST.md` の §8 をやって」と言うだけでよい。

1. **料金の確認(必ず最初に)**: `codex login status` を実行する。
   - 「ChatGPT でログイン」なら月額プランの範囲なので先へ進む
   - **API キーでログインしているなら止まる**(従量課金になる)。発注者に確認してから進む
   - 認証ファイル(`~/.codex/auth.json` など)は開かない
2. **画像が作れるかの試し(1 枚だけ)**: Codex に「§4 の D(コップ)を 1 枚だけ作って `art_candidates/battle/_trial/D_trial.png` に保存して」と頼む。
   - 作れない(画像生成の機能がない・断られる)なら**そこで止めて発注者に報告**する。ほかの有料の画像サービスで代わりに作らない
   - 試しの 1 枚を見て、§2 の画風から大きく外れていたら、§2 の共通プロンプトに足すことを 1 行決めてから本番へ
3. **本番(64 枚)**: 本体のソースの場所で、書き込みを許して実行する。プロンプトは REVIEW_LOG と同じくファイルで渡す:
   ```
   codex exec -s workspace-write -C C:/Users/gogyo/AI_WORKSPACE/photo-roguelike "<この md のパス> を読んで、§1 から §5 のとおりに 8 種類 × 8 枚の見本画像を作り、§5 の置き場所に納品して。参照画像は public/art/ の下にある(§1 の photo-roguelike/art/ と同じ絵)。§6 の表で自分の出力を確かめ、足りないものは作り直して。"
   ```
   - 1 回で 64 枚が終わらないときは、種類ごと(A〜H)に分けて 8 回実行してよい
   - `art_candidates/` は本体の公開物(`dist/`・このリポジトリ)に入れない。git に入れるなら `.gitignore` に足す
4. **受け取りの確認**: §6 の表を PC の Claude が画像を開いて確かめる(Codex の自己申告で済ませない)。合わない絵は番号を控えて Codex に作り直しを頼む
5. **発注者に見せる**: `ALL_sheet.png` と種類ごとの `sheet.png` を見せ、「種類ごとに 1 枚(または どれも違う)」を選んでもらう → §7 へ
