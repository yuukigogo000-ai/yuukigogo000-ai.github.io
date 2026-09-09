# SELECTED ASSET MAPPING

供給パッケージ(HANDOFF v6)の Artwork を、**アトラス原本からキャプション帯を除いて切り出し**、
`pachinko/art/` に配置して使用した。CSS/SVGによる再制作は行っていない。

| 製品内ファイル | 切り出し元 | 使用箇所 |
|---|---|---|
| `art/atm_smoke.jpg` | ATLAS_04 §08 ATMOSPHERE | 倒産モーダル/赤字結果の背景 |
| `art/bg_data.jpg` | ATLAS_04 §14 SCREEN BG | 帳簿 画面背景 |
| `art/bg_home.jpg` | ATLAS_04 §14 SCREEN BG | 実績 画面背景 |
| `art/bg_shop.jpg` | ATLAS_04 §14 SCREEN BG | 新台購入 画面背景 |
| `art/bg_strategy.jpg` | ATLAS_04 §14 SCREEN BG | 経営 画面背景 |
| `art/c_player_f.jpg` | ATLAS_04 §05 PLAYER/CHARACTER | 店長室ショートカット(新装フェア) |
| `art/c_player_m.jpg` | ATLAS_04 §05 PLAYER/CHARACTER | 店長室ショートカット(銀行融資) |
| `art/c_staff_f.jpg` | ATLAS_04 §05 PLAYER/CHARACTER | 店長室ショートカット(広告宣伝) |
| `art/c_staff_m.jpg` | ATLAS_04 §05 PLAYER/CHARACTER | 店長室ショートカット(スタッフ) |
| `art/fx_bonus.jpg` | ATLAS_04 §09 EFFECT | 当日結果(黒字)の背景 |
| `art/fx_win.jpg` | ATLAS_04 §09 EFFECT | クリア時の背景 |
| `art/hall_crowd.jpg` | ATLAS_04 §01 HALL ENVIRONMENT | HOME/HALL 全面アート(86–400px) |
| `art/m_at.jpg` | ATLAS_04 §04 MACHINE VARIATION | 機種 s2 筐体 |
| `art/m_go.jpg` | ATLAS_04 §04 MACHINE VARIATION | 機種 p5 筐体 |
| `art/m_juggler.jpg` | ATLAS_04 §04 MACHINE VARIATION | 機種 s1 筐体 |
| `art/m_neon.jpg` | ATLAS_04 §04 MACHINE VARIATION | 機種 s3 筐体 |
| `art/m_normal.jpg` | ATLAS_04 §04 MACHINE VARIATION | 機種 s4 筐体 |
| `art/m_okislot.jpg` | ATLAS_04 §04 MACHINE VARIATION | 機種 s5 筐体 |
| `art/m_p_a.jpg` | ATLAS_03 §03 MACHINE | 機種 p1 筐体 |
| `art/m_p_b.jpg` | ATLAS_03 §03 MACHINE | 機種 p4 筐体 |
| `art/m_p_c.jpg` | ATLAS_03 §03 MACHINE | 機種 p2 筐体 |
| `art/m_p_d.jpg` | ATLAS_03 §03 MACHINE | 機種 p3 筐体 |
| `art/rank_a.jpg` | ATLAS_03 §08 BADGE/RANK | クリア評価 A |
| `art/rank_b.jpg` | ATLAS_03 §08 BADGE/RANK | クリア評価 B |
| `art/rank_c.jpg` | ATLAS_03 §08 BADGE/RANK | クリア評価 C |
| `art/rank_s.jpg` | ATLAS_03 §08 BADGE/RANK | クリア評価 S |

**使用 26点 / 切り出し済み 50点 / 供給原本 88点+12クロップ**

## 未使用(パッケージ方針どおりの余剰)

`atm_blue`, `atm_gold`, `atm_neon`, `atm_purple`, `atm_red`, `bg_news`, `bg_staff`, `c_group`, `c_regular`, `fx_at`, `fx_coin`, `fx_freeze`, `fx_light`, `hall_aisle`, `hall_calm`, `hall_left`, `hall_right`, `hall_wide`, `tex_carbon`, `tex_glass`, `tex_gold`, `tex_leather`, `tex_metal`, `tex_plastic`

## 供給された個別JPEGを直接使わなかった理由

`ARTWORK/*.jpg`(88点)と `CROPS/HALL_MOBILE_*.jpg`(12点)は、アトラスからの機械的な切り出しのため、
多くにキャプション文字(例:「01 全景(メイン・軍配)」)や隣接セルの写り込みがある。
`ASSET_MANIFEST.json` にも `text_baked_in: "inspect before PRIMARY use"` と明記されている。
焼き込み文字を製品UIへ持ち込まないため、**同じ原本 `REFERENCE/GENERATED_ATLAS_0*.png` から
文字を含まない写真領域のみを切り出して**使用した。

また `ATLAS_02 §04 UI FRAMES` と `§08 SPECIAL/SCREEN` には、実在しないデータ
(資金128,450,000円 / ランキング12位 / お知らせ3件)が焼き込まれているため製品には使用していない。
数値・文字はすべて Live DOM で描画している。