# FINAL DESIGN INTENT REVIEW — 実装者からの申し送り

request_id: `HONMONO-UI-REDESIGN-v4-6bda35f0a5ec`
実装者: Claude Code（Design Authority ではない）

見ていただきたいのは **PIXEL PERFECT ではなく DESIGN INTENT FIDELITY** です。
返していただけるのは `PASS`（REPAIR_SCOPE = NONE）または **最大3件の IMPLEMENTATION_GAP** です。

---

## 1. 実装したもの

11画面すべてを Design Freeze どおりに作り直しました。

- Design Freeze: `frozen_design/`（返却いただいたものをそのまま凍結）
- 実装後のキャプチャ: `implementation_captures/`（**改善前の画面は入れていません**）
- 機械検証の結果: `verification/`

キャプチャ条件: 幅 360 / 390 / 430・DPR2・light と dark。

---

## 2. 機械検証の結果

| 項目 | 結果 |
|---|---|
| FUNCTION_COVERAGE | 100%（93機能・失敗0） |
| STATE_COVERAGE | 100%（56状態・失敗0） |
| UNAUTHORIZED_FUNCTION | 0 |
| RESPONSIVE | 11ページ × 3幅 × light/dark = 66通りで横溢れ0 |
| RUNTIME | JSエラー0・未捕捉例外0・404の0 |
| INTERACTION | 主要フロー4本を自動完走 |
| MOTION | reduced-motion で無限アニメ0・1秒超アニメ0・操作は健在 |
| PERFORMANCE | 再設計前と比較して劣化なし（CLS 0.0149→0 / 最悪 long task 225ms→208ms） |
| CSP | 全ページ違反0。90MBモデルの Worker(blob:) と wasm も生存 |

検査器そのものも確認済みです（期待値を全反転させると F 93/93・S 56/56 が落ちる）。

---

## 3. 実装で判断したこと（Design Decision ではないつもりのもの）

Design Authority の意図を壊していないか、ここだけ見てください。

### 3-1. Hero の可読性のためのスクリム

`HOME_MASTER` では見出しと本文が Evidence Bundle の上に重なります。
実装で同じ配置にしたところ、作品画像の**左3分の1が無地の暗い背景**であるため、
light テーマで本文が読めなくなりました。

- 対応: 作品画像の切り取りを証拠束側へ寄せ（`object-position: 100% 50%`）、
  文字が乗る側だけ canvas 色へ戻す**線形グラデーション**を1枚重ねました。
- **ぼかしは使っていません**（ガラスモーフィズム禁止のため）。
- 根拠: `DESIGN_SYSTEM.md` の「本文と操作ラベルは 4.5:1 以上」。
- 該当: `390_home_light.png` / `390_home_dark.png`

### 3-2. デスクトップ幅のナビゲーション

`DESIGN_DECISION.md` は「Mobileは HONMONO + hamburger」と定めていますが、
広い画面での形は定義されていません。**自分で別の形を発明せず**、
全幅で同じハンバーガー＋グループ分けメニューにしました。
検証幅（360 / 390 / 430）はすべて仕様どおりです。

→ 広い画面で別の形を意図されていた場合は、IMPLEMENTATION_GAP としてご指摘ください。

### 3-3. 実測値の丸め

`PACKAGE_VALIDATION.md` のご指摘どおり、`TRUST_AND_SAFETY_FACTS.json` を正本として
**62.6% / 92.2%** を採用しました（従来ページの表記は 63% / 92%）。
既存の自動検査は丸め値を固定していないことを確認済みです。

### 3-4. 「別のファイルを調べる」

`S-CHK-TOO-LARGE` / `S-CHK-UNSUPPORTED` / `S-CHK-ERROR` の
「別ファイルCTAを同じ面に置く」を満たすため、結果の先頭に導線を1つ足しました。
**新しい機能ではなく、既存のファイル選択（F-CHK-001）への2つ目の入口**です。

### 3-5. 表のスクロール目印

`S-RPT-TABLE-SCROLL` の「右端に静的 fade edge + 横にスクロール text」を実装しました。
ただし**実際にはみ出している表にだけ**出ます（はみ出していない表には出しません）。

### 3-6. OGP画像

`A-OG` は `to_be_authored_by_implementer` かつ "replacement candidate" でしたが、
新しいタグライン（『本物の証拠で、信頼をつなぐ。』）を焼き込んだ画像を作ると
**製品の文言を実装者が決めることになる**ため、**既存のOGP画像のままにしました**。
差し替えをご希望なら指示をください。

---

## 4. 実装しなかったこと

- `A-EVIDENCE-SPINE` の SVG ファイルは同梱しましたが、Task 画面では
  CSS の擬似要素で同じ形（2px の縦線 + 節目の丸）を描いています。
  画像1枚を敷くより、節目の位置を内容に合わせられるためです。見た目の意図は同じです。

---

## 5. 既知の未検査領域（正直に書きます）

- 実機のスマートフォン。検証は Chromium のビューポート再現です
- iOS Safari 固有の挙動（HEIC のプレビュー、`position: sticky` の癖、明朝体の選択）
- 実際に署名された C2PA ファイルでの正常系・異常系（経路の存在のみ確認）
- 明朝体は OS 標準に依存します。`Hiragino Mincho ProN` / `Yu Mincho` /
  `Noto Serif CJK JP` のいずれも無い環境では総称 `serif` になります
