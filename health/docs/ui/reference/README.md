# reference/ — Visual Reference の置き場

> AI UI改善マスタープロトコル v2 §4「Reference は階層化する」/ §21「Asset・Git Policy」。
> **ここに置いた画像が Git 上の正本。** 会話に貼っただけの画像は正本にならない。

---

## 権利のルール(重要)

| 種類 | ここに置いてよいか |
|---|---|
| 自分で生成した Visual Reference(Stitch / 画像生成AI など) | ✅ 置く |
| 自分のアプリのスクリーンショット | ✅ 置く |
| **他社アプリのスクリーンショット(App Store 等)** | ❌ **置かない**。公開リポジトリのため |

他社アプリの参考画像は Git 外の `C:\Users\gogyo\AI_WORKSPACE\ui_toolkit\refs\karada_*` に置き、
索引 `REFS_INDEX.md`(良い点 / 借りる / 借りない)だけを見返す。**画像・アイコンをアプリに持ち込まない。**

---

## 命名

```
ui-master-<name>-v<N>.png          Master Reference（アプリ全体のデザイン言語の正本）
crop-<screen>-<area>-v<N>.png      Supplemental Reference（適用範囲を限定）
accepted-<screen>-v<N>.png         採用済み画面の基準スクショ（visual regression 用）
history-<what>-<YYYYMMDD>.png      経緯として残す過去の状態
```

---

## いま入っているもの(2026-08-21)

| ファイル | 種別 | 適用範囲 | 備考 |
|---|---|---|---|
| `stitch-A-band-marker-v0.1.png` | Supplemental | **画面上半分のみ**(ヘッダー・あいさつ・状態カード・継続カード・下タブ) | Google Stitch 案A「帯マーカー型」。**出力が途中で打ち切られており下半分が無い** |
| `stitch-B-drink-first-v0.1.png` | Supplemental | **晩酌ブロックのみ**(2×2の大ボタン・×2バッジ・集計行・全幅ボタン)+ 曜日ストリップ | 同 案B |
| `stitch-C-record-table-v0.1.png` | Supplemental | **画面下半分のみ**(記録マトリクス・グラフ2枚・健診表・記録一覧行) | 同 案C。3案の中で唯一きれいに完走した |
| `accepted-none-v0.1-implementation-light.png` | 実装の記録 | — | v0.1 実装の全長(ライト・390×844・DPR2・demoデータ)。**まだ accepted ではない**(Phase 6 未承認) |
| `accepted-none-v0.1-implementation-dark.png` | 実装の記録 | — | 同(ダーク・初期表示) |
| `history-old-ui-20260818.png` | 経緯 | — | 作り変える前のUI(同条件・同データ) |

生成元: Stitch project `7000033258657660127` / デザインシステム `Zenith Health Ledger`(シード色 `#1C3160` / Material Design 3)。

---

## ⚠ Master Reference は**まだ無い**

上記はすべて Supplemental(部分)であり、**アプリ全体のデザイン言語を決める Master Reference が存在しない**。
発注者の方針「UIは規約に基づき1から作り直す」に沿って、**次にやることは Master Reference の用意**(プロトコル Phase 2)。

用意できたら:
1. `ui-master-<name>-v1.png` としてここに置く
2. 本 README の表に追記(**適用範囲を必ず書く**)
3. `DESIGN_SYSTEM.md` の B層を、その Reference から抽出したトークンで差し替える
4. `UI_HANDOFF.md` の Phase を更新する

Reference に描かれていても**実装しないもの**(架空機能・取得できないデータ)は
`FEATURE_INVENTORY.md` §2 と §6 を見ること。**実データ仕様が Visual より上。**
