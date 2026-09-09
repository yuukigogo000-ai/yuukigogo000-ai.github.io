# 12_REQUIRED_COPY

<!-- 生成: リポジトリ・フォレンジクス / READ-ONLY 調査 / 対象コミット: f71190b50a118dad4fa2adb5531541ae36875eb3
     根拠のないものは UNKNOWN / UNVERIFIED / NOT_FOUND と記載する -->

TOTAL_REQUIRED_COPY: **40**(EXACT 13 + SEMANTIC 27)

総エントリ数 46(参考として FLEXIBLE 5 / DEBUG 1 を含む)

分類の定義:

- **EXACT_REQUIRED_COPY**: 文字列として一致させる必要がある(製品名・固有名・固定ラベル)
- **SEMANTIC_REQUIRED_COPY**: 意味を保つ必要がある(言い換えは可、意味の変更は不可)
- **FLEXIBLE_COPY**: 表現の自由度が高い
- **DEBUG / INTERNAL COPY**: 利用者には表示されない

注記: 既存実装ではラベル先頭に絵文字が付与されているものがあるが、
本ファイルは**意味の保持対象**を示すものであり、絵文字の採否を要求するものではない。

## EXACT_REQUIRED_COPY (13件)

| COPY_ID | 対象 | SOURCE |
|---|---|---|
| CP-01 | パチスロ帝国 (製品名) | `pachinko/index.html:244, pachinko/manifest.webmanifest:3` |
| CP-02 | 機種名10件(CATALOG[].name) | `pachinko/index.html:398-421` |
| CP-03 | 機種スペック表記10件(CATALOG[].spec.label) | `pachinko/index.html:398-421` |
| CP-04 | 実績15件の名称と条件文(ACHIEVEMENTS) | `pachinko/index.html:604-620` |
| CP-05 | イベント文130件(LUCK_EVENTS 80 / COND_EVENTS 50) | `pachinko/index.html:450-601` |
| CP-06 | 広告プラン名4件(広告なし/チラシ配布/SNSキャンペーン/ローカルTV CM) | `pachinko/index.html:425-430` |
| CP-07 | ブーム名7件(TRENDS[].name) | `pachinko/index.html:433-441` |
| CP-08 | 難易度名3件(のんびり/標準/修羅)と初期資金表記 | `pachinko/index.html:392-394,1770-1774` |
| CP-09 | 交換率ポリシー名2件(等価交換 / 低換金 (5.6枚)) | `pachinko/index.html:1165` |
| CP-10 | 機能領域名4件(ホール/新台購入/経営/帳簿) | `pachinko/index.html:258-261` |
| CP-11 | 営業開始(主要アクション) | `pachinko/index.html:369` |
| CP-12 | 備考の値(特日 / 週末) | `pachinko/index.html:925` |
| CP-13 | STOP / BIG BONUS! / REG BONUS / リーチ!! / オート | `pachinko/index.html:1381-1383,1467-1468,1580,1547` |

## SEMANTIC_REQUIRED_COPY (27件)

| COPY_ID | 対象 | SOURCE |
|---|---|---|
| CP-14 | ホールの遊び方説明(設定のメリハリ/行政指導/プロ/シマ効果/ブーム) | `pachinko/index.html:268` |
| CP-15 | カタログの導入戦略説明(新台効果/シマ効果/売却45%/フェア併用) | `pachinko/index.html:277` |
| CP-16 | スタッフ要件の説明(台8台につき1人/不足時の影響/日給) | `pachinko/index.html:286` |
| CP-17 | 広告の効果説明(未設定時 / 選択時) | `pachinko/index.html:1139-1142` |
| CP-18 | 新装開店フェアの条件と効果の説明 | `pachinko/index.html:301` |
| CP-19 | 店舗拡張の注意(家賃・光熱費が増える) | `pachinko/index.html:310` |
| CP-20 | 融資の説明(利息の重さ/純資産がクリア条件/緊急融資) | `pachinko/index.html:321` |
| CP-21 | 借入枠の算出根拠(台資産×70%+200万)と金利(0.25%/日) | `pachinko/index.html:315-316` |
| CP-22 | 交換率の損得説明(等価 / 低換金) | `pachinko/index.html:1170-1172` |
| CP-23 | 警戒度の3段階説明(平常 / 警戒 / 危険) | `pachinko/index.html:1174-1179` |
| CP-24 | 自動セーブの説明(このブラウザ内) | `pachinko/index.html:343` |
| CP-25 | 試打が経営収支に影響しない旨と無償補充(スロット/パチンコ) | `pachinko/index.html:1387,1531` |
| CP-26 | 釘が良いほど玉持ちが良い旨 | `pachinko/index.html:1531` |
| CP-27 | 当日結果の項目名(来店客数/総売上(打ち込み)/出玉払出/経費/本日の純利益/台別収支) | `pachinko/index.html:1324-1330` |
| CP-28 | 週次レポートの項目名(週間純利益/平均客数/常連客) | `pachinko/index.html:980-983` |
| CP-29 | 週次の助言8件 | `pachinko/index.html:962-978` |
| CP-30 | クリア告知と評価基準(S:65日以内 / A:85日 / B:120日) | `pachinko/index.html:1317-1318` |
| CP-31 | 倒産告知(資金が尽き融資枠も限界 / 経営日数) | `pachinko/index.html:1279,1313` |
| CP-32 | 台0台での営業ブロック案内 | `pachinko/index.html:1792-1793` |
| CP-33 | 空状態の案内(設置台なし / 損益推移 / 営業記録) | `pachinko/index.html:1005,1198,1256` |
| CP-34 | 破壊的操作の確認文(売却 / やり直し) | `pachinko/index.html:1047,1841` |
| CP-35 | オンボーディングの5ブロック(目的/ジレンマ/特日ブームシマ/融資/試打) | `pachinko/index.html:1763-1769` |
| CP-36 | 状態標識の語(NEW / ブーム中 / シマ+N% / プロ警戒 / 設置中×N / 不足中) | `pachinko/index.html:1019-1025,1070,1113` |
| CP-37 | 実行不可の理由表記(資金不足/設置枠なし/拡張上限に到達/あとN日で開催可能/新台導入直後のみ開催可) | `pachinko/index.html:1086-1089,1116-1122,1145-1152` |
| CP-38 | 帳簿の列名8件(日/客数/一般・常連・プロ/売上/出玉(払出)/経費/純利益/備考) | `pachinko/index.html:358` |
| CP-39 | ステータス指標名7件(営業日/資金/評判/常連/台数/借入/純資産) | `pachinko/index.html:248-254` |
| CP-40 | 遊技の指標名(枚/G/BIG/REG/差枚 / 持ち玉/回転/当り/最高N連/差玉) | `pachinko/index.html:1391-1396,1535-1540` |

## FLEXIBLE_COPY (5件)

| COPY_ID | 対象 | SOURCE |
|---|---|---|
| CP-41 | dayNoteの助言文(特日 / 通常) | `pachinko/index.html:995-996` |
| CP-42 | タグライン(ホール経営シミュレーション 〜 目指せ純資産1億円!) | `pachinko/index.html:245` |
| CP-43 | 各セクション見出し(設置中の台/メーカーカタログ/スタッフ/広告 等) | `pachinko/index.html:267,276,285,295,300,305,313,324,329,334,338,350,355` |
| CP-44 | 損益推移の判別方法の説明(表現方式に従属) | `pachinko/index.html:352` |
| CP-45 | 手動セーブ完了の通知(セーブしました!) | `pachinko/index.html:1839` |

## DEBUG_INTERNAL_COPY (1件)

| COPY_ID | 対象 | SOURCE |
|---|---|---|
| CP-46 | ソースコード内の日本語コメント(利用者には表示されない) | `pachinko/index.html:40-238,382-449 他` |

## デザイン都合で変更してはならない代表例

- 機種名10件・スペック表記10件(架空の固有名。短縮する場合も原文への到達経路を残す / RK-11)
- 実績15件の名称と条件文(解除条件そのものを示す)
- イベント文130件(製品の創発コンテンツ。最長29字)
- 難易度名と初期資金の表記(ゲーム条件を示す)
- 借入枠の算出根拠・金利・売却率45%・シマ効果+6%/台などの**数値を含む説明**
  (数値はゲームロジックと一致している必要がある / P-06〜P-19)

**TOTAL_REQUIRED_COPY = 40**
