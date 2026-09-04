# VISUAL_ITERATION_01 — GAME CORE

- Screenshot: 中間キャプチャは同一ファイルへ上書きしながら反復したため保持していない(最終は `screens/01-home-390.jpg`)。
  以下のスコアはその時点の画面を Target と並置して採点した記録である
- Target再確認: 済(`USER_APPROVED_VISUAL_TARGET.png` / `TARGET_GAME_CORE_REGION.png` を実装着手前に再オープン)

## 13軸スコア

| 軸 | 点 | 軸 | 点 |
|---|---|---|---|
| 01 Hall Dominance | 4.2 | 08 Numerical Hierarchy | 4.3 |
| 02 Apparent Hall Density | 3.6 | 09 Typography Force | 4.0 |
| 03 Machine-light Richness | 3.8 | 10 Material Richness | 3.4 |
| 04 Depth / Perspective | 4.2 | 11 CTA Impact | 4.4 |
| 05 Dark × Warm Contrast | 4.0 | 12 Owner / Empire | 3.6 |
| 06 Gold / Neon | 4.2 | 13 Production Value | 3.8 |
| 07 Game HUD Feeling | 4.2 | | |

- CHEAPER-THAN-TARGET: YES(アートワークとマテリアル)
- THUMBNAIL: PASS / BLUR: PASS
- VERDICT: **FAIL**

## GAP分類(上位3件)

1. **DENSITY_GAP / ARTWORK_GAP** — ホール画に人物がおらず、1台あたりのディテールが不足。
   色が金一色に寄り、Targetの局所ネオン(緑/紫/赤/青)の分布が再現できていない。
2. **MATERIAL_GAP** — パネルが単色グラデのみでガラス/金属の層がない。
3. **HUD_GAP** — ステージ上のオーバーレイが3枚で、Targetの情報量に対して薄い。

## 実施した修復

- ホールアートの島カラーを距離依存の重み付けに変更(近景=暖色主体、中〜遠景にアクセント島)
- 台のアンダーグロー/上部サイン/リール窓/サイドランプを追加
- 人物の配置をカメラ前方の可視域へ限定し、接地影とリムライトを強化
- 表示専用の配分サマリ(方針/平均設定/高低設定/前日客数)を4セルで追加(B-14)
- KPIストリップをステージ下端へ移し、ステージ高さを 365px(43%)へ拡大

→ ITERATION_02 へ
