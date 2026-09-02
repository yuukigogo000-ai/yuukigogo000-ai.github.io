# DESIGN_DECISION

## VISUAL_DIRECTION — 何を目指すか

**HONMONOを「判定アプリ」ではなく、デジタル上の証拠を扱う静かな証拠保全室として見せる。**  
Homeは、半透明の証拠スリーブ・赤い来歴紐・封印を主役にした高密度なブランド画面。Taskはその物理感を縮約し、赤い一本線と小さな封印ノードを「根拠→限界→次の行動」を結ぶEvidence Spineとして使う。

FROZEN WINNERは `FROZEN_WINNER_REFERENCE.png`。ユーザー指示により、初期案にあった波状の装飾線・「来歴をたどる／証拠をつなぐ／真実を明らかにする」等の周辺装飾は**不採用**。Heroは証拠資料のArtworkをシンプルに置き、Winner下半分の「3本柱→主なツール→その他の機能・情報」の構造と温度感を維持する。

## RATIONALE — この製品に合う理由

1. **断定しない**  
   判定を「赤か緑の巨大判定器」にしない。封印は“真偽の認証印”ではなく、**いま手元にある証拠束を閉じるための目印**として扱う。Taskでは結論の直後に限界を置き、UNKNOWNを失敗にも安心にも見せない。

2. **端末内完結**  
   物理的な証拠袋・封緘という比喩は「自分の手元に留まる」と相性が良い。入力画面では `端末内処理` を短い常設サインとして見せ、長いプライバシー文言だけに依存しない。

3. **実測のみ**  
   Report / Businessは装飾を減らし、Dossier（資料束）として数字・弱点・訂正履歴を同じ階層で扱う。都合の良い数値だけをHero化しない。

4. **行動は決められる**  
   Checkerでは `結論 → 限界 → 根拠 → 次の一手 → 生データ → 実験機能` の順。AICHECKではスコアを固定的に見せつつ、帯ごとの次行動を常に同じ場所に置く。

## PERSONALITY

### Color Personality
**Charcoal / paper / aged brass / restrained red.**  
Darkは墨黒に生成り・鈍い金・封印赤。Lightは黄味のある紙色に黒インク・古金・深い朱。LightをDarkの反転にしない。状態色はブランド色とは分離し、色 + 形 + 語で識別する。

### Typography Personality
**Editorial evidence.**  
見出しはOSにある日本語明朝系、操作・本文・数値はOS標準ゴシック。Homeの見出しだけ大きな明朝を許し、Taskでは明朝の使用量を減らす。文字階層は5段固定。

### Motion Personality
**Seal / file / reveal.**  
静かで短い。物が「置かれる」「封印点が定まる」「資料が開く」感覚を `transform + opacity` だけで表す。常時動く背景は作らない。

## SIGNATURE_ELEMENT — Sealed Evidence System

Signatureは1個の画像ではなく、以下の3点セット。

1. **Evidence Bundle** — Home専用の半透明証拠スリーブ + 赤い紐 + 封印Artwork。
2. **Evidence Spine** — Task内の縦の細い赤線。結果・限界・次行動の主要節目だけに小さな封印ノードを置く。
3. **Seal Mark** — 六角形の `本` マーク。ロゴ、状態遷移、コピー完了等で小さく使う。認証マークには見せない。

禁止: 波状ライン、星座線、常時発光、過剰な封蝋スタンプ、金色の乱用。

## VISUAL_METAPHOR

**証拠保全袋 / 調査資料 / 来歴を束ねる赤い紐。**  
人物・顔・手を使わない。Hero Artworkは `assets/hero_evidence_bundle_*.webp` を使用。Taskでは写真Artworkを原則使わず、Evidence Spineと資料面の言語へ抽象化する。

## SCREEN_ROLE_MAP

| Screen | Role | 重点 |
|---|---|---|
| HOME | BRAND_CRITICAL | 世界観、欲しさ、4能力の認知 |
| CHECKER | TASK_CRITICAL / PRIMARY TASK MASTER | 結論、限界、根拠、次行動 |
| AICHECK | TASK_CRITICAL | 22項目の継続性、暫定スコア、晒し防止 |
| BADGE | TASK_CRITICAL | 仕組み理解、生成後の最後の1手 |
| CREATORS | TASK_CRITICAL | 0件を正直に見せ、募集を前向きに成立 |
| REPORT | DOCUMENT | 実測・弱点・訂正履歴 |
| BUSINESS | DOCUMENT | 弱点先出し、導入判断、問い合わせ |
| DOCS | DOCUMENT | 読みやすさ、目次 |
| LEGAL_PRIVACY | DOCUMENT | 正確な長文 |
| LEGAL_TERMS | DOCUMENT | 正確な長文 |
| LEGAL_CREDITS | DOCUMENT | 帰属表示 |

## SHARED_DESIGN_LANGUAGE

- Color: paper / charcoal / aged brass / seal red。
- Typography: 明朝Display + system sans本文。
- Signature: Home=Evidence Bundle、Task=Evidence Spine、Document=赤い細い索引線。
- Icon: 1.5px〜2px相当の単色線画。丸いSaaSアイコン背景は禁止。
- Surface: “紙・透明スリーブ・資料箱”を抽象化した低彩度の面。ガラスモーフィズムは禁止。
- Motion: 110〜420ms、transform / opacity中心。
- State: bad/warn/ok/info は専用形状 + ラベル併用。
- Radius: 0 / 8 / 18 の3種だけ。

## INFORMATION_ARCHITECTURE

### Global navigation

Mobileは `HONMONO` + hamburger。メニューを開くと以下の順。

**調べる**
1. 画像来歴チェッカー
2. AIアカウント鑑定

**証明・探す**
3. 実在証明バッジ
4. クリエイター名鑑

**理解する**
5. 使い方

下段に `実測レポートを読む` / `法人・開発者の方へ`。  
Footerに Privacy / Terms / Credits。ブランド名は常にHomeリンク。現在地は `aria-current=page` と左側の赤い索引線で示す。

### Home
Hero → 3本柱 → 3つの主ツール → `クリエイター名鑑` を含むその他導線 → 実測/法人 → 参考情報・晒し禁止の注意。  
「4つのツール」は Checker / AICHECK / Badge / Creators。Creatorsは一次タスクではないため主3カードと同じ面積にはしないが、Home上で明確に認識できる。

### Task
Taskは“資料を読む順番”を優先する。HomeのArtworkを持ち込まず、Evidence Spineだけを継承。

### Document
本文幅を絞り、目次と章番号を資料索引として扱う。Business / Reportの表はローカル横スクロール容器を使い、ページ全体を横スクロールさせない。

## REJECTED_ALTERNATIVES

- 波状の来歴ライン: Product-specificに見えたが装飾の自己主張が強く、ユーザー指示でも削除。再導入禁止。
- 星座/Orbit: “データが端末内”は表現できるが、抽象図形が主役となり安価なAI UIに寄りやすい。
- Optical Bench全面展開: Checkerには合うが、Badge / Creatorsまで計測器にするとProduct全体が「判定器」に寄りすぎる。
- 封印テープの巨大演出: 一撃は強いが、警告/危険表示と混同しやすい。
