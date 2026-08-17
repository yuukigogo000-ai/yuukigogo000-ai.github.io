# パチスロ帝国 — UI素材 制作指示書(外部AI向け)

ブラウザ/デスクトップで動くパチンコホール経営シミュレーション「パチスロ帝国」のUIを作り込むための
**画像素材の発注書**です。画像生成AI(Midjourney / DALL·E 3 / Stable Diffusion / Ideogram / Recraft 等)に
そのまま渡せるよう、共通スタイル・各素材の仕様・英語プロンプト・納品ルールをまとめています。

- 遊べる現物: https://yuukigogo000-ai.github.io/pachinko/ (現在は絵文字で仮置き。これを本素材に差し替える)
- 素材の総数: **約70点**(優先度P0=32点 / P1=26点 / P2=12点)。**P0だけでも先に納品してOK**
- 納品先: `pachinko/assets/` 配下(フォルダ構成は §7)。組み込みはこちらで行う

---

## 1. 世界観とアートスタイル(全素材共通・最重要)

| 項目 | 指定 |
|---|---|
| コンセプト | 「深夜のネオン街に建つパチンコホール」。**ダーク×ネオン×ゴールド**。少しレトロで、少しサイバー |
| 画風 | **フラット寄りの2Dゲームイラスト**(セルシェード+ネオン発光の縁)。写真調・3Dレンダ調・水彩は不可 |
| 基調色 | 背景 `#0d0a1a` / パネル `#1a1430` / 枠 `#3d2f6b` / **ゴールド `#ffc93c`** / **ネオンピンク `#ff3ea5`** / **シアン `#35e0ff`** / 緑 `#4ade80` / 赤 `#ff6b6b` |
| ライティング | 暗い環境に自ら発光している感じ。ハイライトはピンク・シアンの2色光源 |
| 線 | 太めのクリーンなアウトライン(暗紫 `#2a1b52`)、角は丸め |
| トーン | コミカルで景気がいい。ギラつくが下品にならない。ギャンブル依存を煽る表現(札束を抱えて泣く等)は避ける |
| 文字 | **画像内に文字を入れない**(ロゴ以外)。文字はCSSで載せる |
| 背景 | アイコン・キャラ・筐体は**完全透過PNG**。背景画だけ不透過 |
| 統一 | 同カテゴリの素材は**同じ角度・同じ線幅・同じ余白**で。先に1枚作って基準にし、以降はその画像をスタイル参照(Midjourneyなら `--sref`、SDなら同seed+同LoRA)にする |
| 権利 | 実在するパチンコ・スロット機、メーカーロゴ、版権キャラ(海物語・ジャグラー・北斗・エヴァ等)に**似せない**。完全オリジナル。商用利用可の生成条件で |

### マスタープロンプト(全素材の先頭に付ける)

```
flat 2D game UI illustration, cel-shaded with clean thick dark-purple outlines, neon glow accents in hot pink (#ff3ea5) and cyan (#35e0ff) with gold (#ffc93c) highlights, dark navy-purple background (#0d0a1a), Japanese pachinko parlor at night vibe, retro-modern arcade style, vibrant but tasteful, centered composition, no text, no watermark
```

### ネガティブプロンプト(対応AIのみ)

```
photorealistic, 3D render, blurry, watermark, text, letters, logo of real brands, real pachinko machines, cropped, low contrast, pastel, sketch, grainy
```

---

## 2. 優先度と枚数の一覧

| 優先 | カテゴリ | 点数 | 用途 |
|---|---|---|---|
| **P0** | 機種イラスト(筐体) | 10 | ホール/ショップの台カード、試打画面 |
| **P0** | スロット図柄 | 6 | 試打(スロット)のリール |
| **P0** | タブアイコン | 4 | 画面上部タブ |
| **P0** | ステータスアイコン | 7 | 画面上部の資金・評判など |
| **P0** | ロゴ(エンブレム) | 1 | タイトル |
| **P0** | タイトル背景 | 1 | 起動時チュートリアル/難易度選択の背景 |
| **P0** | 試打パーツ | 3 | スロットのランプ(点灯/消灯)、レバー |
| **P0** | アプリアイコン | 1 | PWA/デスクトップアプリ |
| P1 | キャラクター | 6 | 客層3種・店長・銀行員・行政マン |
| P1 | 実績バッジ | 15 | 経営タブの実績一覧、解除トースト |
| P1 | ランクバッジ | 4 | クリア画面 S/A/B/C |
| P1 | シーン画 | 1 | 倒産画面 |
| P2 | 機種キービジュアル | 10 | 試打画面の背景(横長) |
| P2 | 知らせの飾り | 2 | 週次レポート/イベントの飾り(良い知らせ/悪い知らせ) |
| P2 | ホール背景・床タイル | 2 | 画面全体の薄いテクスチャ、日次結果ヘッダー |

---

## 3. P0 素材の仕様

### 3-1. 機種イラスト(筐体) ×10 — `assets/machines/{id}.png`
- **サイズ: 600×900px(縦長)、透過PNG**。台カードでは約80px幅、試打画面では約300px幅で表示するので、**小さくしても機種の違いが分かるシルエットと色**にすること
- 構図: 正面やや俯瞰、筐体全体が入る。上部の役物/液晶と、下部の皿・ボタンまで。**画面部分の絵柄でテーマを表現**する(液晶内には文字を入れない)
- パチンコ(P)は縦長の盤面+液晶、スロット(S)は3リール窓+下部ボタンの筐体、と**シルエットで機種タイプが分かる**ように

| id | 機種名 | タイプ | テーマ/雰囲気 | 個別プロンプト(マスタープロンプトの後ろに追加) |
|---|---|---|---|---|
| p1 | P海のメルヘン 甘デジ | パチンコ | 癒しの海。年配客向け。青〜水色、丸い泡、魚 | `pachinko machine cabinet, marine fantasy theme, cute tropical fish and bubbles on the LCD, soft blue and aqua colors, friendly and relaxing` |
| p2 | CR大江戸花火絵巻 | パチンコ | 江戸の夏、打ち上げ花火。朱・金・紺 | `pachinko machine cabinet, Edo period summer fireworks theme, big chrysanthemum fireworks over a wooden bridge on the LCD, vermilion red, gold and deep indigo` |
| p3 | P戦国プリンセス廻 | パチンコ | 戦国×美少女(顔は描かず後ろ姿やシルエット)。桜・甲冑・ピンク×紫 | `pachinko machine cabinet, sengoku warlord princess anime theme, cherry blossom petals and ornate armor motif on the LCD, pink and violet, glossy` |
| p4 | P新世紀インパクト | パチンコ | 近未来ロボットアニメ、無機質×紫。緊迫感 | `pachinko machine cabinet, futuristic mecha anime theme, giant robot silhouette and hexagonal HUD patterns on the LCD, purple and electric green, dramatic` |
| p5 | P究極神威ゴッドラッシュ | パチンコ | 神話・黄金・稲妻。最上位機種の派手さ | `pachinko machine cabinet, divine mythology theme, golden lightning bolts and radiant halo on the LCD, gold and white with red accents, ultra flashy premium look` |
| s1 | Sラッキーピエロ | スロット | 陽気なピエロ、赤白ストライプ、丸いランプ。**実在の完全告知機に似せない** | `slot machine cabinet, cheerful circus clown theme (original clown, not a mascot), red and white stripes, big round lamp on top, three reel windows, warm and nostalgic` |
| s2 | S押忍!漢気番長 | スロット | 学ラン番長、炎、拳。赤黒 | `slot machine cabinet, Japanese school delinquent boss theme, flames and clenched fist motif, black school uniform colors with red and gold, bold and hot-blooded` |
| s3 | S忍烈伝〜朧の章〜 | スロット | 忍者、月夜、手裏剣。紺×銀 | `slot machine cabinet, ninja legend theme, crescent moon and shuriken motif, dark navy and silver with a hint of crimson, mysterious` |
| s4 | S黄金神話クロニクル | スロット | 黄金の遺跡、宝石。金×エメラルド | `slot machine cabinet, golden mythology chronicle theme, ancient golden ruins and emerald gems, gold and emerald green, treasure-hunt excitement` |
| s5 | スマスロ蛇眼の傭兵 | スロット | 軍用・迷彩・蛇の目。最新機の鋭さ | `sleek modern smart slot machine cabinet, mercenary military theme, snake-eye emblem, camo dark green and gunmetal with neon orange accents, sharp and high-tech` |

### 3-2. スロット図柄 ×6 — `assets/reels/{name}.png`
- **256×256px、透過PNG**。白いリール上に載せるので**濃い色でくっきり**。丸ゴシックな塗り。6つとも同じ線幅・同じ余白(周囲10%)
- 追加プロンプト共通: `single slot machine reel symbol, bold flat icon, thick outline, glossy highlight, on transparent background`

| ファイル | 図柄 | 指定 |
|---|---|---|
| seven.png | 赤7 | `red number seven "7" symbol` ※唯一の例外として数字7は可。太いイタリック赤に金縁 |
| bar.png | BAR | `black BAR bar-shaped symbol with white and gold trim, no letters` ※文字なしの黒い横棒3段でOK |
| grape.png | ぶどう | `bunch of purple grapes with a green leaf` |
| cherry.png | チェリー | `two red cherries with a stem and leaf` |
| bell.png | ベル | `golden bell with a ribbon` |
| replay.png | リプレイ | `blue circular arrow replay symbol` |

### 3-3. タブアイコン ×4 — `assets/ui/tab_{name}.png`
- **128×128px、透過PNG**。**単色ゴールド(#ffc93c)+ネオン発光の線画アイコン**。塗りは最小限。4つ揃えて同じ線幅
- 追加プロンプト共通: `minimal line icon in gold (#ffc93c) with soft neon glow, single color, thick rounded strokes, on transparent background`

| ファイル | 意味 | モチーフ |
|---|---|---|
| tab_hall.png | ホール | パチンコ台が並ぶ島(シマ)の正面 |
| tab_shop.png | 新台購入 | ショッピングカートに載ったスロット筐体 |
| tab_mgmt.png | 経営 | ネクタイ+電卓 or 経営者の胸像 |
| tab_ledger.png | 帳簿 | 折れ線グラフ付きの帳簿 |

### 3-4. ステータスアイコン ×7 — `assets/ui/stat_{name}.png`
- **96×96px、透過PNG**。タブアイコンと同じ線画スタイルだが**塗りあり2色**(ゴールド+シアン)。小さく表示されるので単純に
- 追加プロンプト共通: `small flat icon, two colors gold (#ffc93c) and cyan (#35e0ff), thick outline, simple shape readable at 24px, on transparent background`

| ファイル | 意味 | モチーフ |
|---|---|---|
| stat_day.png | 営業日 | めくりカレンダー |
| stat_money.png | 資金 | 札束+硬貨 |
| stat_rep.png | 評判 | 光る星 |
| stat_regulars.png | 常連 | 3人の頭のシルエット |
| stat_machines.png | 台数 | スロット筐体の正面 |
| stat_debt.png | 借入 | 銀行の建物(柱がある) |
| stat_assets.png | 純資産 | トロフィー |

### 3-5. ロゴ(エンブレム) ×1 — `assets/ui/logo_emblem.png`
- **1024×1024px、透過PNG**。**文字なし**のエンブレム。「777」のリール+王冠+ネオン。ゲーム名「パチスロ帝国」の文字はCSSで横に置く
- プロンプト: `game logo emblem, three slot reels showing lucky sevens topped with a golden crown, neon pink and cyan glow tubes around it, gold metallic trim, no letters, transparent background`
- (任意)文字入りロゴも欲しい場合は **Ideogram / Recraft** で `Japanese text "パチスロ帝国" in bold neon signage font, gold with pink glow` を追加。1600×500px 透過。ファイル名 `logo_full.png`

### 3-6. タイトル背景 ×1 — `assets/bg/title.jpg`
- **1920×1080px、JPG(不透過)**。夜のネオン街に建つパチンコホールの外観。**中央下1/3は暗めにして文字とボタンを載せる余白**にする
- プロンプト: `exterior of a Japanese pachinko parlor at night, glowing neon signage in pink cyan and gold, wet street reflections, wide cinematic composition, dark bottom third for UI overlay, no readable text on signs`

### 3-7. 試打パーツ ×3 — `assets/trial/`
| ファイル | サイズ | 内容 |
|---|---|---|
| lamp_off.png | 128×128 透過 | 消灯した告知ランプ(暗い琥珀色のドーム) |
| lamp_on.png | 128×128 透過 | 点灯した告知ランプ(金色に発光、光芒つき)。**off と同じ形・同じ位置** |
| lever.png | 128×256 透過 | 赤い球のついたスロットのレバー(側面から) |

### 3-8. アプリアイコン ×1 — `assets/ui/app_icon.png`
- **1024×1024px、不透過**(角丸はOS側でつく)。3-5のエンブレムを角丸正方形の紫背景に載せた構図。**中央に大きく、余白は各辺10%**
- プロンプト: 3-5のプロンプト + `on a rounded dark purple square app icon background, centered, large`

---

## 4. P1 素材の仕様

### 4-1. キャラクター ×6 — `assets/chars/{name}.png`
- **512×512px、透過PNG、胸から上のバストアップ、正面やや斜め、全員同じカメラ・同じ頭身**(2.5頭身デフォルメ)。表情は各1種
- 追加プロンプト共通: `chibi bust-up character portrait, 2.5 heads tall, cel-shaded, thick outline, friendly cartoon, facing slightly left, transparent background`

| ファイル | 役割 | 指定 |
|---|---|---|
| customer_casual.png | 一般客 | 普段着の若い男女どちらか、楽しそう |
| customer_regular.png | 常連客 | 中年、ジャンパー、ドル箱を抱えてニコニコ |
| customer_pro.png | プロ(ハイエナ) | サングラス・帽子・無表情、腕組み。ちょい悪 |
| manager.png | 店長(プレイヤー) | ネームプレート付きベスト、やる気の笑顔 |
| banker.png | 銀行員 | スーツ、書類、営業スマイル |
| inspector.png | 行政/組合の人 | 腕章、眼鏡、渋い顔 |

### 4-2. 実績バッジ ×15 — `assets/badges/{id}.png`
- **256×256px、透過PNG**。**円形メダル**の中にモチーフ。金縁+紫地。15個同じ縁・同じサイズ。未解除はCSSでグレースケール化するので**解除状態だけ**作る
- 追加プロンプト共通: `round achievement medal badge, gold rim, dark purple inner face, glossy, centered emblem of:`

| id | 名前 | モチーフ |
|---|---|---|
| first-day | 開店初日 | 開店ベル |
| million | 日給100万 | 札束×3 |
| rep90 | 地域の優良店 | 輝く星と月桂冠 |
| reg50 | 常連の店 | 3人の笑顔シルエット |
| m20 | 中堅ホール | 中規模の建物 |
| m60 | 巨艦店 | 城のような巨大ホール |
| d30 | 1ヶ月経営 | カレンダー30 |
| tokubi-god | 特日の神 | 炎の中の7 |
| shidou | お上の世話 | 赤いサイレン |
| loan-clear | 信用第一 | 握手 |
| asset30m | 軌道に乗る | 右肩上がりの矢印 |
| asset100m | パチスロ帝国 | 王冠 |
| trial-hit | 初当たり体験 | 的の中心に矢 |
| trial-10 | 事故連発生 | 爆発 |
| trial-5k | ドル箱タワー | 積み上がったドル箱の塔 |

### 4-3. ランクバッジ ×4 — `assets/ui/rank_{S,A,B,C}.png`
- **512×512px、透過PNG**。盾型のエンブレム。**S=虹プラチナ、A=金、B=銀、C=銅**。文字S/A/B/Cは**画像内に入れず**CSSで重ねるので、中央を平らな面にしておく
- プロンプト: `shield-shaped rank emblem, {platinum with rainbow sheen | gold | silver | bronze}, ornate border, flat empty center for a letter overlay, glossy, transparent background`

### 4-4. 倒産シーン ×1 — `assets/bg/bankrupt.jpg`
- **1200×800px、JPG**。シャッターの閉まったホール、消えたネオン、雨。悲壮だが可愛げは残す
- プロンプト: `closed pachinko parlor with shutters down, neon signs turned off, rainy night, melancholic but stylized, dark, no text`

---

## 5. P2 素材の仕様(余力があれば)

- **機種キービジュアル ×10** — `assets/kv/{id}.jpg` **1280×720px** 横長。3-1の各テーマを液晶の中の世界として描いた1枚絵(試打画面の背景に暗く敷く)。3-1のプロンプトから `machine cabinet` を外して `key visual artwork of` にする
- **知らせの飾り ×2** — `assets/ui/news_good.png` / `news_bad.png` **256×256** 透過。良い知らせ=紙吹雪と金の封筒、悪い知らせ=雨雲と黒い封筒
- **床タイル ×1** — `assets/bg/carpet_tile.png` **512×512** シームレス。パチンコ屋のカーペット柄(暗い紫地に細かい金の模様)。`seamless tileable pattern, pachinko parlor carpet, dark purple with tiny gold ornaments, low contrast`
- **ホール内観 ×1** — `assets/bg/hall_interior.jpg` **1600×900**。台がずらりと並ぶ島の通路、無人。日次結果画面のヘッダー用

---

## 6. 生成AIごとのコツ

| AI | 向いている素材 | メモ |
|---|---|---|
| Midjourney v6+ | 筐体・背景・キャラ | 最初の1枚を `--sref` にして統一。透過は `--no background` では不十分なので後処理(remove.bg等)。`--ar 2:3`(筐体)/`--ar 16:9`(背景) |
| DALL·E 3 (ChatGPT) | アイコン・バッジ | 「透過PNGで」と明記。同じ会話内で連続生成すると統一しやすい。文字を勝手に入れがちなので「no text」を強調 |
| Stable Diffusion (SDXL) | 大量の同スタイル素材 | 同seed+同プロンプト骨格で回す。透過は `rembg`。図柄・アイコンはControlNetで形を揃えると楽 |
| Ideogram / Recraft | ロゴ(文字入り)、アイコンセット | 日本語文字はIdeogram 2.0以降が比較的正確。Recraftはベクター出力可 |
| 透過処理 | 全て | AIが「透過」と言っても市松模様を描くだけの場合あり。**必ず本物のアルファチャンネル**にする(remove.bg / Photoshop / rembg) |

---

## 7. 納品形式

```
pachinko/assets/
├── machines/   p1.png … p5.png, s1.png … s5.png        (600×900 透過)
├── reels/      seven.png bar.png grape.png cherry.png bell.png replay.png (256×256 透過)
├── ui/         tab_hall.png tab_shop.png tab_mgmt.png tab_ledger.png (128×128)
│               stat_day.png … stat_assets.png (96×96)
│               logo_emblem.png (1024×1024) [logo_full.png 1600×500]
│               app_icon.png (1024×1024 不透過)
│               rank_S.png rank_A.png rank_B.png rank_C.png (512×512)
│               [news_good.png news_bad.png]
├── trial/      lamp_off.png lamp_on.png (128×128) lever.png (128×256)
├── chars/      customer_casual.png customer_regular.png customer_pro.png
│               manager.png banker.png inspector.png (512×512)
├── badges/     first-day.png million.png … trial-5k.png (256×256)
├── bg/         title.jpg (1920×1080) bankrupt.jpg (1200×800)
│               [hall_interior.jpg 1600×900] [carpet_tile.png 512×512]
└── kv/         [p1.jpg … s5.jpg (1280×720)]
```
- ファイル名は**上記どおり小文字・拡張子込み**で(組み込みコードがこの名前を参照する)
- PNGは**8bit RGBA**。1ファイル 500KB 以下を目安(背景JPGは 400KB 以下、品質80)
- zip 1本にまとめて渡してもらえれば、こちらで配置・組み込み・表示調整まで行う

---

## 8. 検収チェックリスト(受け取ったら見る点)

- [ ] 透過PNGが**本当に透過**か(黒/白/市松の背景が焼き付いていないか)
- [ ] 画像内に**文字・ウォーターマーク・実在ブランド**が入っていないか
- [ ] 同カテゴリで**線幅・角度・余白**が揃っているか(並べて見る)
- [ ] 小さく縮小(アイコン24px、筐体80px)しても**判別できる**か
- [ ] 指定サイズ・比率どおりか(トリミングで足を切っていないか)
- [ ] 色が世界観(暗紫×ゴールド×ピンク×シアン)から外れていないか
- [ ] 機種10台の**タイプ(P/S)がシルエットで区別**できるか
- [ ] lamp_on と lamp_off が**同じ位置・同じ形**か(切り替えで動いて見えないように)

---

## 9. こちらで行う組み込み(参考)

素材が届いたら以下を実装する(素材が無い間は現在の絵文字にフォールバックするので、部分納品でも壊れない):
- 台カード/ショップ/試打画面に筐体イラスト、試打スロットに図柄・ランプ・レバー画像
- タブ/ステータスの絵文字をアイコン画像に置換、ヘッダーにエンブレム
- チュートリアルにタイトル背景、倒産/クリア画面にシーン画とランクバッジ
- 日次結果に客層キャラ、週次レポートに店長キャラ、実績一覧にバッジ
- 全体に床タイルの薄いテクスチャ、試打画面にキービジュアル背景

以上。不明点は「素材ID(例: s3, stat_debt)」で聞いてもらえれば即答します。
