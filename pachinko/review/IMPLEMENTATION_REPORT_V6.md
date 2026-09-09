# V6 IMPLEMENTATION REPORT

Visual Acceptance Target: `REFERENCE/USER_APPROVED_VISUAL_TARGET.jpeg`(HANDOFF v6 同梱)
Design/Artwork Authority: ChatGPT / Implementation Authority: Claude Code

## 0. 実行順序(CLAUDE_CODE_MASTER_PROMPT v6.0 準拠)

| 手順 | 内容 | 結果 |
|---|---|---|
| §2 CAPABILITY AUDIT | 実装前に能力を実測 | `../CAPABILITY_AUDIT.md`(画像生成は不可だが、パッケージに素材があるためBlockerではない) |
| §3 REGRESSION GUARD FIRST | 検査を先に作り、現状Baselineを取得 | 静的45項目 PASS / 実行時55項目 PASS |
| §4 FIRST SCREEN | HOME/HALLのみ実装 | 完了 |
| §5 ONE SCREEN OBSERVATION | 390×844を1枚提示し、rollback checkpointを保存して継続 | commit `81ff9cc` |
| §6 SCREENSHOT LOOP | 撮影→Target比較→上位Gap修正→再撮影 | ホールアートを`hall_wide`→`hall_crowd`へ差し替え等 |
| §8 ASSET | COVERAGE MATRIX に従い PRIMARY→SECONDARY | `ASSET_MAPPING.md` |
| §13 VALIDATION | 下記 | 全項目PASS |

## 1. MOBILE_MAPPING への適合(390×844)

| 指定帯 | 実装 |
|---|---|
| 0–86px Top HUD(DAY/資金/純資産) | 実装(DAY・特日/週末・資金・前日収支。純資産は640–710帯へ再配置) |
| 86–400px Full-bleed Hall Artwork | 実装(`art/hall_crowd.jpg` を画面幅100%・高さ314pxで全面表示。小さいHero Boxではない) |
| 115–340px 実データのHUDをArtwork上へ重畳 | 実装(島オーバーレイ2枚 + 店舗評価クレスト + KPI3セル = 実データのみ) |
| 400–640px 設置台・設定判断 | 実装(1台フォーカス + 設定1〜6 + 試打/売却 + 横スクロールの台ストリップ) |
| 640–710px Goal/boom/特日/warning/strategy | 実装(純資産ゲージ + 方針/平均設定/高低設定 + 前日客数・収支。特日/ブーム/スタッフ不足はステージ上のバッジ) |
| 710–780px Primary CTA(52px以上) | 実装(営業開始 60px・赤ネオン) |
| 780–844px 4領域Bottom Navigation | 実装(ホール/新台購入/経営/帳簿。実績は店長室から到達) |

左右の大型Panelは残さず、Top HUD・下段compact status・帳簿画面へ再配分した(§3)。
キャラクター4人は**実機能へのショートカット**として店長室に配置(fake routeなし)。

## 2. 使用したArtwork

`ASSET_MAPPING.md` を参照。要点:

- ホール俯瞰、機種10種の筐体、キャラクター4種、画面背景4種、演出背景、クリア評価バッジ S/A/B/C を使用
- **CSS/SVGでのArtwork再制作はしていない**(§11 遵守)
- Target画像そのものの貼り付けはしていない
- 焼き込み文字のある素材(UI FRAMES / SPECIAL SCREEN / 供給クロップ)は不使用

## 3. VALIDATION(§13)

| 項目 | 結果 |
|---|---|
| 360×800 / 390×844 / 430×932 の横スクロール | すべて 0 |
| タップ44px未満 | 0件 |
| 主要CTA | 60px(要件52px以上) |
| safe-area | `env(safe-area-inset-*)` 対応 |
| reduced-motion | 演出短縮・カーテン非表示を確認 |
| console error | 0 |
| broken asset | 0 |
| 実行時の外部リクエスト | 0 |
| offline | SW登録後にオフラインで起動・アート表示を確認 |
| Electron / file モード | 起動・1営業日・保存まで確認(PAGEERR none) |
| protected regression | 静的45 PASS / 実行時55 PASS |
| 破壊的検証 | 27 PASS / 0 FAIL |
| ゲームバランス回帰 | 熟練プレイ中央値 71日(V5:72 / V4:72 と同水準) |

## 4. GATE A / GATE B / GATE C

- **GATE A(UI/操作/レスポンシブ/機能/状態)**: Claude側でPASS。上記VALIDATIONのとおり。
- **GATE B(Artwork)**: 供給パッケージの素材を使用。独自制作なし。
- **GATE C(最終判定)**: `screens/compare-target-vs-impl.jpg` を提示。
  自己採点は行わず、**Human Verdict を待つ**。
