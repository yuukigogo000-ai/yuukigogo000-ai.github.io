# HONMONO 画像制作 指示書 v1.0

- 対象: 画像生成AI(ChatGPTの画像生成 / Adobe Firefly / Recraft / Midjourney など)に貼って使う指示書
- 作成日: 2026-08-16
- 納品先: このリポジトリの `honmono/assets/`(アップ方法は §6)
- 全部で **必須10点 + あると良い13点**。まず必須(A)だけ揃えばUIは完成できます

---

## 使い方(あなたへ)

1. §1「絶対ルール」を画像AIとの会話の**冒頭に1回**貼る
2. §3「共通スタイル」の英文を、**各アセットのプロンプトの先頭に毎回**付ける(画風を揃えるため)
3. §5から欲しいアセットのプロンプトを1つずつ貼って生成 → 気に入るまで再生成
4. §7チェックリストで確認 → §6の方法で納品
5. 迷ったら「必須(A)」だけ先に。Bは後回しでOK

---

## §1 絶対ルール(画像AIにそのまま貼る)

```
これから、実在性を証明するWebサービス「HONMONO」の装飾画像を作ります。以下は絶対条件です。

1. 人物・顔・シルエット・手・指を一切描かない(抽象的な物・図形・記号のみ)
2. 文字・数字・アルファベットを一切入れない(文字はあとでHTMLで重ねます)
3. 実在企業のロゴ(X, Instagram, YouTube等)を描かない(SNSは無地の丸や四角で抽象化)
4. 全画像を同じ画風・同じ配色で統一する(フラットなベクター風、ティール系2色+差し色)
5. 「透過PNG」指定のものは背景を透明にする(できないツールなら純白 #FFFFFF ベタ背景)
6. 透かし・署名・額縁・余計な装飾を入れない
```

英語版(英語プロンプト主体のツール用):

```
We are creating decorative images for "HONMONO", a web service that verifies authenticity of real human creators. Absolute rules for every image:
1. NO people, faces, silhouettes, hands, or fingers — abstract objects, shapes and symbols only.
2. NO text, letters, numbers, or typography of any kind.
3. NO real brand logos (X, Instagram, YouTube...) — represent social networks as plain circles/squares.
4. Keep ONE consistent style across all images: flat vector illustration, two-tone teal palette with an amber accent.
5. Where "transparent PNG" is specified, output a transparent background (if impossible, pure white #FFFFFF).
6. No watermark, signature, frame, or extra ornament.
```

---

## §2 スタイルガイド

| 項目 | 指定 |
|---|---|
| 画風 | フラットなベクターイラスト。角丸・シンプルな幾何形状・ごく薄い粒状感。写真風/3Dテカテカ/サイバーパンク風はNG |
| メイン色 | 深いティール `#0E7490` / 明るいティール `#22A7C9` / 淡いシアン `#67CFE8` |
| 背景色 | ダーク `#151A21`(ヒーロー・OGP用)/ ライト `#FAFAF9`(サイトの地色) |
| 差し色 | アンバー `#F59E0B`(注意・強調に少量)|
| 判定色 | AI検出=赤 `#B91C1C` / 実写材料=緑 `#15803D` / 注意=アンバー `#B45309` / 情報=グレー `#6B7280` |
| 雰囲気 | 信頼できる・清潔・少し技術的・落ち着き。かわいすぎない、怖すぎない |
| 構図 | 中央配置・余白たっぷり・要素は1〜3個まで |
| NG | 人物/顔/手、文字、ブランドロゴ、写真風、ネオンだらけ、グラデ多用、透かし |

---

## §3 共通スタイル・プロンプト(各プロンプトの先頭に毎回付ける)

```
STYLE: flat vector illustration, minimal, clean geometric shapes, soft rounded corners, very subtle grain, two-tone teal palette (deep teal #0E7490, bright teal #22A7C9, light cyan #67CFE8) with occasional amber #F59E0B accent, centered composition, generous negative space, modern trustworthy tech-brand look, no text, no letters, no people, no faces, no hands, no logos, no watermark.
```

ネガティブプロンプト(対応ツールでは毎回付ける):

```
NEGATIVE: text, letters, typography, numbers, watermark, signature, human, person, face, portrait, silhouette, hands, fingers, photo-realistic, glossy 3D render, cyberpunk neon clutter, brand logos, frame, border
```

---

## §4 アセット一覧

| ID | 用途 | サイズ(px) | 背景 | 優先 |
|---|---|---|---|---|
| A1 | ロゴマーク(ファビコン・アプリアイコン) | 1024×1024 | 透過 + ティール角丸版 | **必須** |
| A2 | トップページのヒーロー画像 | 1920×1080 + 1080×1350 | ダーク不透明 | **必須** |
| A3-1〜5 | ツールアイコン5種(来歴/バッジ/鑑定/名鑑/説明書) | 各1024×1024 | 透過 | **必須** |
| A4 | チェッカーのドロップ枠イラスト | 1200×900 | 透過 | **必須** |
| A5-1〜5 | 判定バナー用アイコン5種 | 各512×512 | 透過 | **必須** |
| B1 | 実在証明バッジのエンブレム | 1024×1024 | 透過 | あると良い |
| B2 | 名鑑用の抽象アバター8種 | 各512×512 | 不透明可 | あると良い |
| B3 | OGP用の背景 | 1200×630 | ダーク不透明 | あると良い |
| B4 | 鑑定結果カードの背景 | 1200×630 | ダーク不透明 | あると良い |
| B5 | 検索0件の空状態イラスト | 900×600 | 透過 | あると良い |
| B6 | 相互リンク図 | — | — | **AI不向き → 私がSVGで描く** |

---

## §5 各アセットの指示

### A1 ロゴマーク
- 用途: ブラウザタブのアイコン、ヘッダー、アプリアイコン、SNSプロフィール
- サイズ: 1024×1024。**2版**作る: (a) ティール単色・透過背景 (b) 白抜き・ティール `#0E7490` の角丸四角背景
- プロンプト:
```
[STYLE] App icon logo mark for an authenticity-verification service: a bold checkmark fused with a round wax-seal / stamp shape, subtle concentric fingerprint-like ridges inside the seal, single solid deep teal (#0E7490) silhouette, perfectly centered, transparent background, square 1:1.
```
- 意図: 「✓(検証)」+「印章(証明)」+「指紋(実在)」を1つの記号に
- 確認: 小さく(32px)縮めても形が判別できるか / 文字が入っていないか
- SVGが出せるツール(Recraft・Firefly Vector)なら **SVGも欲しい**

### A2 ヒーロー画像(トップページ)
- 用途: トップページ最上部の大きなビジュアル。上に見出し文が重なるので**主役は右側に寄せ、左側は暗くシンプルに**
- サイズ: 1920×1080(PC)と 1080×1350(スマホ)。同じコンセプトで2枚
- 背景: ダーク `#151A21` 不透明
- 案1(推し)「本物の刻印」:
```
[STYLE] Wide abstract key visual on a dark slate background (#151A21): a single glowing teal wax-seal stamp mark pressed onto the surface, positioned right of center, surrounded by a drifting cloud of tiny hollow duplicate outlines that dissolve into pixel noise toward the edges, soft cinematic rim light, shallow depth, left third kept dark and empty for text overlay, no text, no people. 16:9
```
- 案2「量産の中の本物」:
```
[STYLE] Wide abstract composition on dark slate (#151A21): an endless orderly grid of identical translucent glass tiles fading into fog, and one tile in the right foreground that is a hand-fired ceramic tile with visible texture and warm amber light catching its imperfections, teal and slate palette, left third dark and empty for text overlay, no text, no people. 16:9
```
- スマホ版はプロンプト末尾を `4:5, subject centered in the lower half, upper half dark and empty for text` に変える
- 確認: 左1/3に見出しを置いて読めるか / 人物っぽい形が紛れていないか

### A3 ツールアイコン(5種)
- 用途: トップページのツールカード、各ページの見出し横(いまの絵文字を置き換え)
- サイズ: 各1024×1024、透過。**5つは必ず同じセッション・同じ画風で**
```
[STYLE] Icon 1 of 5, "provenance checker": a magnifying glass hovering over a photo frame, inside the lens a small glowing seal mark, two-tone teal, transparent background, 1:1.
```
```
[STYLE] Icon 2 of 5, "proof-of-existence badge": an ID card with a large round checkmark seal on it and a small ribbon tail, two-tone teal, transparent background, 1:1.
```
```
[STYLE] Icon 3 of 5, "account inspector": a magnifying glass scanning an abstract profile card (a plain empty circle and two horizontal bars — no face), a tiny amber caution triangle glint at the corner, two-tone teal, transparent background, 1:1.
```
```
[STYLE] Icon 4 of 5, "verified creators directory": a ring of small stars connected by thin lines like a constellation, one star larger and brighter, two-tone teal, transparent background, 1:1.
```
```
[STYLE] Icon 5 of 5, "manual / documentation": an open book with a bookmark ribbon and a small checkmark floating above, two-tone teal, transparent background, 1:1.
```
- 確認: 5つ並べて太さ・色・角丸感が揃っているか / 3の丸が顔になっていないか

### A4 ドロップ枠イラスト
- 用途: チェッカーの「画像をここにドロップ」の枠の中
- サイズ: 1200×900、透過
```
[STYLE] Illustration for a file drop area: a photo frame and a small film-clip icon gently floating down toward a flat scanner tray that emits a thin teal light beam upward, a faint dashed rounded rectangle around them, light and airy, two-tone teal, transparent background, 4:3.
```

### A5 判定バナー用アイコン(5種)
- 用途: 「🤖 AI生成の痕跡」「📜 C2PA」「📷 カメラ撮影」「🟡 弱い疑い」「❓ 判定材料なし」の絵文字の置き換え
- サイズ: 各512×512、透過。**それぞれ判定色を主色に**
```
[STYLE] Verdict icon "AI-generated": a microchip with a small sparkle and a few glitch fragments, main color red #B91C1C with light tint, transparent, 1:1.
```
```
[STYLE] Verdict icon "content credentials": a rolled certificate/scroll with a wax seal and a small chain link, main color teal #0E7490, transparent, 1:1.
```
```
[STYLE] Verdict icon "camera original": a classic camera front with a round lens and shutter blades, main color green #15803D, transparent, 1:1.
```
```
[STYLE] Verdict icon "weak suspicion": a magnifying glass over a caution triangle, main color amber #B45309, transparent, 1:1.
```
```
[STYLE] Verdict icon "unknown": a question mark inside a dashed photo frame, main color neutral gray #6B7280, transparent, 1:1.
```

### B1 バッジのエンブレム
- 用途: 「実在クリエイター宣言」バッジと証明ページの印章。**中央は空けておく**(あとで文字を重ねる)
- サイズ: 1024×1024、透過
```
[STYLE] Circular emblem for a "verified real creator" seal: an outer ring made of many tiny checkmarks like a laurel wreath, the center kept completely empty (plain disc) for text overlay, two short ribbon tails at the bottom, deep teal and light cyan, transparent background, 1:1.
```

### B2 抽象アバター(8種)
- 用途: 名鑑のサンプルカードと、写真のないクリエイターの初期アイコン。**顔は絶対NG**
- サイズ: 各512×512。不透明でOK(角丸はCSSで付ける)
```
[STYLE] Set of 8 abstract avatar tiles for placeholder profile pictures: each a different geometric composition (overlapping circles, arcs, stripes, dots, quarter-circles), palette teal / cyan / amber / slate, flat, square, no faces, no letters. Output each tile separately.
```

### B3 OGP背景
- 用途: SNSでリンクを貼った時のカード画像の下地。**左2/3は文字を置くので空ける**
- サイズ: 1200×630、ダーク不透明
```
[STYLE] Wide dark slate background (#151A21) with a soft teal seal glow on the right third and a few drifting dissolving pixel fragments, the left two-thirds kept clean, dark and empty for text overlay, no focal object on the left, no text. 1200x630
```

### B4 鑑定結果カードの背景
- 用途: 「結果画像を保存」で出るカードの下地。文字が全面に載るので**極めて控えめに**
- サイズ: 1200×630、ダーク不透明
```
[STYLE] Extremely subtle low-contrast decorative background: dark slate (#151A21), a faint teal radial glow in the bottom-right corner, a barely visible fine grid, no focal objects, no text. 1200x630
```

### B5 空状態イラスト
- 用途: 名鑑で検索結果0件のとき
- サイズ: 900×600、透過
```
[STYLE] Empty-state illustration: a magnifying glass looking at an empty dashed card outline, a few tiny floating dots, calm and friendly, two-tone teal, transparent background, 3:2.
```

### B6 相互リンク図
- 「SNS ⇄ 証明ページ ⇄ バッジ」の輪の図。**矢印と配置の正確さが要るので画像AIには不向き**。私がSVGで描きます(依頼不要)

---

## §6 納品方法

- 形式: **PNG**(透過指定は透過PNG)。SVGが出せたものはSVGも一緒に。1枚あたり5MB以下目安(重くても私が圧縮します)
- ファイル名(この名前で保存してもらえると私の作業が速いです):

```
logo-mark.png            logo-mark-square.png     logo-mark.svg(あれば)
hero-16x9.png            hero-4x5.png
icon-checker.png  icon-badge.png  icon-aicheck.png  icon-creators.png  icon-docs.png
dropzone.png
verdict-ai.png  verdict-c2pa.png  verdict-camera.png  verdict-weak.png  verdict-unknown.png
emblem-badge.png
avatar-01.png 〜 avatar-08.png
og-bg.png                sharecard-bg.png
empty-search.png
```

- 渡し方(どれでもOK):
  1. **このチャットに画像を添付**する(いちばん簡単)
  2. GitHubのサイトで `honmono/assets/` を開き「Add file → Upload files」でまとめてアップ → 「Commit changes」
- 届いたら私が: 圧縮・WebP化 → サイトに配置 → 白背景/黒背景の両方で表示確認 → 公開、までやります

---

## §7 受け入れチェックリスト(納品前に自分で見る)

- [ ] 人物・顔・シルエット・手が**どこにも**紛れていない(背景の小さな形も含めて)
- [ ] 文字・数字・それっぽい記号の羅列が入っていない
- [ ] SNSやカメラの**実在ロゴ**が描かれていない
- [ ] 透過指定のものは、市松模様の上で見て背景が抜けている(白ベタなら「白ベタです」と一言添える)
- [ ] 白い背景と黒い背景の両方に置いて、輪郭が潰れない
- [ ] 5種セット(A3・A5)は並べて見て太さ・色・角丸が揃っている
- [ ] 指定サイズ以上で出ている(小さい分には拡大できないので大きめが安全)
- [ ] 透かし・署名・額縁が入っていない

---

## §8 ツール別のコツ

| ツール | 向いているもの | 注意 |
|---|---|---|
| **ChatGPTの画像生成** | 全般。「背景は透明で」が効く | 出力にContent Credentials(C2PA)が付く=**当サイトの来歴チェッカーで来歴が表示される**。本プロジェクトの趣旨に合うので推奨 |
| **Adobe Firefly** | 全般・「ベクター」モードでアイコン | 商用利用OK・C2PA付き。透過は「背景を削除」で |
| **Recraft** | ロゴ・アイコン(A1/A3/A5) | **本物のSVGが出せる**唯一級。アイコン類はここが最良 |
| **Midjourney** | ヒーロー(A2)・背景(B3/B4) | 透過不可 → `isolated on pure white background` で出して私が切り抜く。末尾に `--ar 16:9 --style raw --no text,people,face,hands,logo` |
| Kling / Dreamina | ヒーロー・背景 | 商用利用条件を規約で確認してから。透過不可 |

- どのツールでも、**商用利用が許されるプラン・規約**かだけ確認してください(Midjourneyは有料プラン必須)
- 生成物はサイトの説明書に「装飾画像は生成AIで制作(人物は含みません)」と正直に明記します(このプロジェクトは隠さないのが信用の源です)

---

## §9 届いたあと私がやること(参考)

1. 圧縮・WebP変換・2倍解像度(Retina)対応
2. ヒーロー付きトップページ、アイコン差し替え、ドロップ枠、判定バナー、名鑑カードへ配置
3. ライト/ダーク両テーマで確認、スマホ表示確認
4. 相互リンク図(B6)をSVGで作成
5. 来歴チェッカーで自サイトの画像を検査 → C2PAが付いていれば「自分の画像にも来歴あり」を説明書に記載
6. テスト → 公開
