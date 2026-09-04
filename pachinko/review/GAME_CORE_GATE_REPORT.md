# GAME CORE GATE REPORT — HOME / HALL

対象: `pachinko/index.html`(V5 LIVE-VISUAL IMPLEMENTATION)
比較対象: `USER_APPROVED_VISUAL_TARGET.png` / `TARGET_FRAGMENTS/TARGET_GAME_CORE_REGION.png`
Runtime Screenshot: `screens/01-home-390.jpg`(390×844, 2倍解像度)
並置シート: `screens/compare-target-vs-impl.jpg`

判定手順は `0H_GAME_CORE_GATE.md` に従い、Target と Runtime Screenshot を同縮尺で並べて採点した。
採点は実装者(Claude Code)による自己評価であり、Design Authority のレビューを代替しない。

## 13軸スコア(0〜5)

| # | 軸 | 点 | 根拠 |
|---|---|---|---|
| 01 | Hall Dominance | 4.2 | ホールが第1ビューポートの中心。高さ365px(=43%)、上部HUDと下部CTAに挟まれた主役。Targetの約55%には届かない |
| 02 | Apparent Hall Density | 4.0 | 手続き生成で約7,000台を配置し、島・通路・奥行きを構成。ただしTargetにある人物の存在感と写実的な密度には未達 |
| 03 | Machine-light Richness | 4.0 | 金/琥珀を主体に紫・緑・赤・青の島を配置。1台あたりの発光要素はTargetより少ない |
| 04 | Depth / Perspective | 4.2 | 斜め1点透視・前景クロップ・被写界の減光まで再現 |
| 05 | Dark × Warm-light Contrast | 4.2 | dark_ratio 0.754(Target 0.753)。暗部主体+暖色の光溜まり |
| 06 | Gold / Neon Intensity | 4.2 | 全パネルに金のヘアラインとコーナー金具。ネオンはバッジ/CTA/島チップに限定 |
| 07 | Game HUD Feeling | 4.2 | 常時14項目の数値を金枠パネルで提示。Targetの密度(約20項目)にはやや届かない |
| 08 | Numerical Hierarchy | 4.3 | 資金→前日収支→4指標→方針の順に明確な段差。等幅数字 |
| 09 | Typography Force | 4.0 | 見出し900・字間拡張・金グラデ。Targetの太さにはわずかに及ばない |
| 10 | Cabinet / Material Richness | **3.5** | パネルは多層グラデ+織りテクスチャ+ベベルまで作り込んだが、筐体アートが手続き生成のため写実的な質感が不足 |
| 11 | Primary CTA Impact | 4.4 | 赤ネオン枠+二重枠+リベット+脈動。全幅56px |
| 12 | Owner / Empire Feeling | **3.7** | 王冠マーク・店舗評価クレスト・縦レールで「所有感」を作ったが、Targetのキャラクター立ち絵に相当する要素がない |
| 13 | Overall Production Value | **3.9** | UI側は商用モバイルゲーム水準に近いが、ホール画が写実に届かない分だけ全体の格が下がる |

## PASS条件との対照

- 全軸 ≥ 4.0 → **未達**(10: 3.5 / 12: 3.7 / 13: 3.9)
- Hall Dominance ≥ 4.5 → 未達(4.2)
- Apparent Hall Density ≥ 4.5 → 未達(4.0)
- Game HUD Feeling ≥ 4.5 → 未達(4.2)
- Overall Production Value ≥ 4.5 → 未達(3.9)

**VERDICT: FAIL**

## CHEAPER-THAN-TARGET TEST

並置した状態で「実装のほうが明らかに安く作られている」と言えるか:

- UI(HUD・パネル・CTA・タイポグラフィ・レール): **NO**(同水準と判断)
- ホールのアートワーク: **YES**(写実CG → 手続き生成のスタイライズCGへ落ちている)

したがって総合では **CHEAPER と判定せざるを得ない**。原因はアートワーク1点に集中している。

## THUMBNAIL TEST(25%表示)

`screens/thumbnail-test.jpg` を参照。25%でも
「暗いホールの塊 / 金の枠 / 局所ネオン / 大きなHUD数値 / 赤い強いアクション」
は残り、generic mobile web app には見えない。→ **PASS**

## BLUR TEST

`screens/blur-test.jpg` を参照。強いぼかしでも
上=ブランド帯 / 中央=ホールの発光塊 / 下=金枠HUD群 / 最下部=赤い塊
という視覚マスの構成がTargetと同系統である。→ **PASS**

## 3回のSelf Repairの記録

`VISUAL_ITERATION_01.md` / `02` / `03` を参照。
3回の修復後も上記4軸が閾値未達のため、`0G_FIRST_IMPLEMENTATION_MILESTONE.md` の規定により
**GAME_CORE_VISUAL_BLOCKER** として停止し、Gap evidence を提出する。

支配的なGapは単一である:

> **ARTWORK_GAP** — Target品質のホール俯瞰アート(写実・人物あり・素材感あり)が存在せず、
> Claude Code の制作手段(Canvas 2D 手続き生成)では到達できない。

このアートワークが差し替われば 01 / 02 / 03 / 10 / 13 が同時に改善する見込みであり、
他の11軸はすでに 4.0〜4.4 に到達している。発注書は `../CHATGPT_ARTWORK_REQUEST.md`。
