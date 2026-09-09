# FEATURE ROADMAP — パチスロ帝国(V6)

`FEATURE_SCOPE_v1.0.md` に対する実装結果。

## A. EXISTING — 維持(39機能)

4領域切替 / 設定1〜6 / 設置台試打 / 売却 / カタログ試打 / 新台購入 / staff雇用・解雇 /
広告 / 新装フェア / 店舗拡張 / 借入・返済 / 交換率 / save・reset / 1営業日実行 / 当日結果 /
週次report / clear rank / bankruptcy / 損益推移 / 営業成績 / achievement / 常時status /
difficulty / slot trial / pachinko trial / autosave・restore / offline / Electron

→ 自動検証で全機能の到達性を確認済み(`review/ACCEPTANCE_REPORT.md`)。

## B. IMPLEMENT NOW — 今回実装(B-01〜B-20)

| ID | 内容 | 状態 |
|---|---|---|
| B-01 | Approved Target のArt DirectionへPresentation全面刷新 | 実装 |
| B-02 | ホール俯瞰アートによる apparent density | 実装(供給パッケージの写真アセット `hall_crowd`) |
| B-03 | 設定1〜6を主Interactionへ / 機種・スペック・人気・前日収支・客数・状態の可視化 | 実装 |
| B-04 | 店長室(staff/広告/fair/拡張/finance/交換率/警戒度/実績/save)の統合 | 実装 |
| B-05 | 1営業日実行の遷移(開店演出 800ms) | 実装 |
| B-06 | 当日結果の演出(純利益をヒーロー表示 + スラム) | 実装 |
| B-07 | スロット試打の実機化(ランプ/リール/レバー/STOP/5指標) | 実装 |
| B-08 | パチンコ試打の実機化(デジタル/リーチ/RUSH/オート/5指標) | 実装 |
| B-09 | ショップの「看板機種を選ぶ」体験 | 実装 |
| B-10 | 帳簿のGame Record化(0基線グラフ+▲▼+営業日ログ) | 実装 |
| B-11 | 実績のReward Feedback(トースト)と独立一覧 | 実装 |
| B-12 | ブーム/特日/週末/フェア/警戒度のUI利用 | 実装 |
| B-13 | 純資産1億円へのGoal Progress | 実装 |
| B-14 | 表示専用の作戦サマリ(方針/平均設定/高低設定) | 実装(ロジック非干渉) |
| B-15 | Primary 390×844 / 360・430 検証 | 実装 |
| B-16 | safe-area | 実装 |
| B-17 | touch ≥44px / Primary CTA ≥52px(実装は56px) | 実装 |
| B-18 | prefers-reduced-motion | 実装 |
| B-19 | インラインSVGアイコン体系(外部library禁止・主要UIの絵文字終了) | 実装(34種) |
| B-20 | ローカルArtwork資産をSW PRECACHEへ | 実装(`art/*.jpg` 50点・PRECACHE 55件) |

## C. NEXT PHASE — 今回は実装しない

C-01 疑似シマ表示(同一機種のGroup化を強化) / C-02 作戦プリセット(複数台一括設定) /
C-03 EVENT CENTER / C-04 LEGACY・RECORD / C-05 REPORT CENTER / C-06 SOUND DESIGN

※ C-01 の一部(同一機種グループの集計表示)は、既存データのみで成立する
「島オーバーレイ」としてホール上に実装している。設定の一括変更(C-02)は未実装。

## D. DEFERRED — 実装禁止(今回も未実装)

D-01 物理floor map / machine coordinate ・ D-02 customer entity simulation ・
D-03 customer movement ・ D-04 realtime operating simulation ・ D-05 live floor heatmap ・
D-06 multi-store ・ D-07 regional map ・ D-08 store acquisition ・ D-09 online ranking ・
D-10 login/account ・ D-11 cloud save ・ D-12 multiplayer ・ D-13 push notification ・
D-14 monetization ・ D-15 mission/daily login bonus

Target画像に描かれているランキング・お知らせ・ミッション・稼働率ヒートマップ等は、
**機能としてもダミーのボタン・ラベルとしても配置していない。**
Targetのそれらの Visual Mass は、実在するデータ(実績 / clear rank / 純資産Goal /
週次助言 / 帳簿 / 当日結果 / 同一機種グループの集計)へ置き換えている。


---

## V6 での変更点(HANDOFF v6 適用)

- 左ナビレールを廃止し、`MOBILE_MAPPING.md` の帯構成(Top HUD / Hall / 台フォーカス /
  status / CTA / Bottom Nav)へ再構成
- ホール俯瞰・機種筐体・キャラクター・画面背景・演出・クリア評価バッジを
  **供給Artworkの実写素材へ置換**(CSS/SVGによる再制作を廃止)
- 台一覧を「1台フォーカス + 横スクロールのサムネイルストリップ」へ変更
- 実績は店長室からの到達に変更(ボトムナビは実在4領域のみ)
