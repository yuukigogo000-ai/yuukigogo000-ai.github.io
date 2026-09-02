# SCREEN_SPEC
## GLOBAL SHELL / GLOBAL STATES

**Header:** HONMONO logo link + mobile menu button。Menu内のprimary 5 destinationsは Checker / AICHECK / Badge / Creators / Docs。Report / Businessはevidence/business group、legal 3 linksはfooter DOM。  
**Current location:** `aria-current="page"` + visual red index。  
**Privacy line:** 入力を受け取るHOME/CHECKER/AICHECK/BADGEではheader直下またはintro内で「端末内」を短く可視化。全page footerに `FOOT-PRIVACY-LINE` の意味（ブラウザ内完結 / 画像・フォーム入力を送信しない）を常設。ページ読込そのものには通信が必要で、オフライン動作を主張しない。

### Global state presentation
- **S-THEME-LIGHT** — Warm-paper theme tokens only。Dark色の単純反転は禁止。Stateは色+glyph+labelで識別。
- **S-THEME-DARK** — Charcoal theme tokens only。本文はcream、brand accentはaged brass。State色はDark専用値。
- **S-MOTION-REDUCED** — Hero/section entryとstaggerを停止。待機は静止したprogress rail + 数値/文言で進行を示す。操作機能は不変。
- **S-FOCUS-VISIBLE** — 操作要素の外側に2px gap + 2px seal-red ring。aria-currentとは別表現。

### Global responsive
360 / 390 / 430でheader height 56–64px。LogoはHome link、menu target 44x44以上。Overlay menuはviewport内scroll可、body scroll lockは可だがscroll hijackは禁止。

---

## HOME

### SCREEN_ROLE
BRAND_CRITICAL

### PRIMARY_ACTION
画像を調べる（CHECKERへ）

### COMPOSITION
Evidence Bundleを右側のDominant Visual。左Hero copy。Hero後に3本柱、主3ツール、Creators/Report/Business/Docs、参考情報notice。その下に「現在地 / Phase 1 / 今後の予定」を小さなDossier Indexとして置き、F-HOME-004を到達可能にする。

### CAPABILITY_PRESENCE
CAP-CHECKER / CAP-ACCOUNT / CAP-BADGEを主3ツール。CAP-DIRECTORYを「探す」secondary。CAP-EVIDENCE / CAP-BUSINESSを明示リンク。CAP-DOCSを「使い方」。CAP-LEGAL-*はfooter DOM。CAP-GLOBALはheader/menu/privacy line。

### STATE_PRESENTATION
- **S-HOME-DEFAULT** — Evidence Bundleを右側Dominant Visualにし、左にhero copy。下に3本柱、主3ツール、Creators/Report/Business/Docs。参考情報・晒し禁止をページ末のDossier noteで読ませる。

### RESPONSIVE
360: 16px side gutter、Hero artworkは右52–56%幅、3主カードは3列維持（各約98px）しlabelを2行。390: master。430: gutter 20px、Hero artworkを少し右へ。横スクロール禁止。

### COPY_PLACEMENT
- `HOME-HERO` meaning-protected: AI生成コンテンツが増えるほど、実在することの価値が上がるという逆張りの立場
- `HOME-TAGLINE` meaning-protected: 無料であること / ツール群であること / ブラウザ内で動くこと / データが送信されないこと
- `HOME-LINK-REPORT` verbatim: 「実測レポートを読む」
- `HOME-LINK-BUSINESS` verbatim: 「法人・開発者の方へ」
- `HOME-DISCLAIMER` meaning-protected: 判定は参考情報 / メタデータは編集削除可能 / 痕跡の有無で人間・悪意を断定しない / 特定個人を断定公表する目的で使わない / 製品の存在理由 Placement: トップページ内に到達可能であること
- `HOME-PILLARS` meaning-protected: 3本柱の名称と各1文の説明

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## CHECKER

### SCREEN_ROLE
TASK_CRITICAL / PRIMARY_TASK_MASTER

### PRIMARY_ACTION
ファイルを選ぶ / Dropする

### COMPOSITION
Header→lead/private sign→drop zone。解析後はResult Dossierへ置換し、verdict→limits→evidence→next step→raw→LAB。

### CAPABILITY_PRESENCE
CAP-CHECKER全F-ID。Global header/menuから他主要4 nav、footerでReport/Business/Docs/legalへ。

### STATE_PRESENTATION
- **S-CHK-IDLE** — Hero Artworkは使わない。上部lead→端末内サイン→大きなEvidence Drop Zone。Zone中央に「ファイルを選ぶ」、下端に対応形式。
- **S-CHK-DRAGOVER** — Drop Zoneのborderを`--c-brass`へ、Evidence Spineが入口まで伸びる。文言を「ここで離して解析」に変更。背景色だけで示さない。
- **S-CHK-ANALYZING** — Drop Zoneを結果領域へ変形させず、同じ場所に「解析中」。赤い短い光帯が縦railをCSS transformで移動。数秒で終わる旨を併記。
- **S-CHK-TOO-LARGE** — Result位置にwarn dossier。「300MBを超えています」→上限→「動画は冒頭を切り出して試す」。Drop Zone/別ファイル操作は残す。
- **S-CHK-UNSUPPORTED** — warn dossier。対応形式を本文に列挙し「変換して再試行」。別ファイルCTAを同じ面に置く。
- **S-CHK-ERROR** — bad dossierだが全面赤にしない。「解析できませんでした」+ 原因情報 + 別ファイル。UIをロックしない。
- **S-CHK-RESULT** — 順序固定: verdict → limits(PL-3) → evidence → next step → raw metadata → experimental pixel。Resultの頭からEvidence Spineを開始。
- **S-CHK-V-AI** — bad。大見出し「AI生成の痕跡があります」。断定語「AI画像です」は使わない。最上位根拠へ視線をつなぐ。
- **S-CHK-V-C2PA** — info。大見出し「コンテンツ来歴(C2PA)付き」。良い/悪い判定に見せず、署名検証statusを別行で示す。
- **S-CHK-V-CAMERA** — ok。大見出し「カメラ撮影の痕跡があります」。直後limitsで偽装可能を必ず読ませる。
- **S-CHK-V-STOCK** — warn。大見出し「ストック素材サイト由来」。本人写真としての不自然さを説明し、悪意の断定はしない。
- **S-CHK-V-WEAK** — warn。タイトルに「弱」を含め、決定的でないことを同じ視線範囲に置く。
- **S-CHK-V-UNKNOWN** — info/neutral。緑を使用しない。「判定材料がありません」。SNS経由では通常・本物の意味ではない・元データ再確認を同じResult blockに置く。
- **S-CHK-META-EMPTY** — raw metadata disclosureの件数を0件。空白表示にせず「検出されませんでした」と事実を表示。
- **S-CHK-C2PA-LOADING** — Result内のC2PA rowだけをloading。ページ全体を待機状態にしない。短いCSS rail + 「初回は数秒」。
- **S-CHK-C2PA-OK** — ok glyph + 「署名後の改ざんなし」。直下に「発行者の信頼性照合は別」とinfo行。
- **S-CHK-C2PA-BAD** — bad glyph + 「署名検証で問題」。エラーコードはmonospace風system fontのsubrowで全件読める。
- **S-CHK-C2PA-UNREADABLE** — warn。「C2PAらしきデータはあるが読めない」。破損/非標準の可能性。
- **S-CHK-C2PA-ENGINE-FAIL** — warn。エンジン取得失敗理由 + contentcredentials.org公式検証への代替リンク。
- **S-CHK-PIXEL-HIDDEN** — 区画ごとDOM/visualを出さない。動画等で利用不可の場合にdisabled placeholderは作らない。
- **S-CHK-PIXEL-IDLE** — 本判定から破線と`LAB / 実験`見出しで分離。90MB・2回目キャッシュ・PC推奨・実測値・限界を実行ボタンより前(PL-6)。
- **S-CHK-PIXEL-LOADING** — download bytes/totalをprogress elementと数値で表示。rail animationはCSSのみ。推論中は「端末内で推論中」に切替。
- **S-CHK-PIXEL-HIGH** — badだが「可能性が高い」。実測の誤り率と他signal併用を同ブロック。
- **S-CHK-PIXEL-MID** — warn。「判定が割れる領域」「単独では根拠にならない」を結果と同サイズ帯で表示。
- **S-CHK-PIXEL-LOW** — info。緑にしない。「兆候は薄い」+ 見逃し + 「AIではない証明にはならない」を同じblock。
- **S-CHK-PIXEL-ERROR** — lab区画内だけbad。「実行できませんでした」+ 再試行。メタデータ本判定は壊さない。
- **S-CHK-PIXEL-AUTO-ON** — switch + 明示テキスト「次回から自動で実行: ON」。localStorage stateを反映。
- **S-CHK-PIXEL-AUTO-OFF** — 既定。switch + 「毎回自分で実行」。

### RESPONSIVE
360/390/430すべてsingle column。Result titleはclamp。Finding rowはtagを上段へwrap可。逆画像search chipsはwrap。LAB buttonは360で縦積み。

### COPY_PLACEMENT
- `CHK-LEAD` meaning-protected: 何を解析するか / メタデータが消えていても経緯を推定すること / ファイルがアップロードされないこと Placement: ファイルを渡す操作の前に読めること
- `CHK-FORMATS` meaning-protected: 対応形式の一覧 Placement: ファイルを渡す操作の近く
- `CHK-V-AI` meaning-protected: 生成AIツールの記録・申告が埋め込まれている。詳細は根拠一覧にある
- `CHK-V-C2PA` meaning-protected: 来歴データが埋め込まれている。良い/悪いの判定ではない
- `CHK-V-CAMERA` meaning-protected: 実写の可能性を高めるが偽装可能
- `CHK-V-STOCK` meaning-protected: 本人写真としては不自然。流用または架空人物の疑い
- `CHK-V-WEAK` meaning-protected: 決定的な証拠はない。追加検証が要る
- `CHK-V-UNKNOWN` meaning-protected: メタデータが見つからなかった。SNS経由では普通のこと。『AIではない』の意味ではない。可能なら元データで再チェック
- `CHK-FINDING-TAGS` meaning-protected: 根拠1件ごとの4段階の重み付け。この4段階を減らさない
- `CHK-LIMITS` meaning-protected: 痕跡なしは証明にならない / カメラ情報も偽装可能 / 公式検証ツールという代替の存在 Placement: 結果を読んだ直後に読める位置
- `CHK-NEXT-STEP` meaning-protected: メタデータが消えていても打てる次の手があること。4つの逆画像検索サービスへ画像をドラッグする手順
- `CHK-PIXEL-TITLE` meaning-protected: これが実験機能であり参考値であること。メタデータによる本判定とは別枠であること Placement: 本判定と混ざらない・同格に見えないこと
- `CHK-PIXEL-INTRO` meaning-protected: 何を見ているか / 送信されないこと / 90MBの初回ダウンロード / 2回目以降はキャッシュ / PC推奨 Placement: 実行ボタンより前
- `CHK-PIXEL-EVAL` measured-number copy: request-side数値保護。ただしTRUST_AND_SAFETY_FACTSのsource-of-truthと矛盾する場合はTRUST exact valueを優先（下記NOTE参照）。
- `CHK-PIXEL-HIGH` meaning-protected: 高い可能性であって断定ではないこと。実測の誤り率
- `CHK-PIXEL-MID` meaning-protected: 単独では根拠にならない
- `CHK-PIXEL-LOW` meaning-protected: 見逃し率。『AIではない』証明にならないこと。この注意を弱めない

**PL-3:** verdict直後にlimits。**PL-4:** LAB/実験区画を破線と見出しで本判定から格下げ。**PL-6:** 約90MB/実験/参考/PC推奨/実測限界を実行buttonより前。

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## AICHECK

### SCREEN_ROLE
TASK_CRITICAL

### PRIMARY_ACTION
22項目をチェックして暫定/最終スコアを更新する

### COMPOSITION
上部intro。sticky Score Docket。4 risk chapters + 1 trust chapterのLedger。各rowにweightと理由。結果→晒し警告→copy/save。

### CAPABILITY_PRESENCE
CAP-ACCOUNT全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-AIC-NONE-CHECKED** — 上部sticky Score Docketは「未判定 / 0項目確認」。0点を低リスクとして緑表示しない。22項目Ledgerを開始。
- **S-AIC-PARTIAL** — Score Docketに「暫定」+ checked/22。現在bandと次行動は表示するが、未完であることを常時併記。
- **S-AIC-LOW** — ok帯。ただし文言で「強い危険信号なし / 安全宣言ではない」。金銭話で再評価を同block。
- **S-AIC-MID** — warn帯。ビデオ通話・逆画像検索・Checkerの3行動をResult Docket内に。
- **S-AIC-HIGH** — bad帯。「典型的特徴に多数一致」で止め、AI/詐欺と断定しない。金銭・個人情報を渡さない、block/report。
- **S-AIC-TRUST-APPLIED** — Trust chapterは緑インクではなくok glyph + 「減点材料」。Score差分を`-n`で透明化。
- **S-AIC-COPIED** — Exposure warning(PL-1)を通過した後のbuttonのみ「コピーしました ✓」へ約2秒。

### RESPONSIVE
single column。Score Docketはviewport下部sticky(max 76px)だが入力を隠さないようpadding-bottomを同高以上。360ではscore/metaを2行。

### COPY_PLACEMENT
- `AIC-LEAD` meaning-protected: 自己申告のチェックリストであること / スコアが出ること / 送信されないこと
- `AIC-BAND-LOW` meaning-protected: 低でも安全宣言ではないこと
- `AIC-BAND-MID` meaning-protected: 次にとる具体的な検証行動
- `AIC-BAND-HIGH` meaning-protected: 断定ではなく『特徴への一致』であること / とるべき行動
- `AIC-EXPOSURE-WARNING` protected fragments: 「断定して晒す使い方はしないでください」 / 「名誉毀損」 Placement: REQUIRED: 結果を持ち出す操作(コピー・画像保存)より DOM 順で前。折りたたみの中に入れない。持ち出しボタンより小さく目立たなくしない
- `AIC-DISCLAIMER` meaning-protected: 参考情報であること / 金銭の話はスコアより優先 / 相談先(#9110・警察庁窓口)

**PL-1:** exposure warningはcopy/saveよりDOM順で前、折りたたみ不可、buttonより視覚的に弱くしない。

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## BADGE

### SCREEN_ROLE
TASK_CRITICAL

### PRIMARY_ACTION
証明ページとバッジを生成する

### COMPOSITION
4-step mechanism→生成物preview（入力前にも薄いwire preview）→6項目form→generated preview/download/snippets→最後の封印。

### CAPABILITY_PRESENCE
CAP-BADGE全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-BDG-EMPTY** — 最初に4-step mechanism、次に「生成すると何が手に入るか」の小プレビュー、最後に6入力。Form前に仕組みを理解できる。
- **S-BDG-FILLED** — 入力ごとに右端の小さなseal indexが未完→完了へ。必須不足はテキストで示す。
- **S-BDG-INVALID** — 活動名input直下にbad text、上部summaryは作らない。focusを対象fieldへ。
- **S-BDG-GENERATED** — Preview → Download/snippet → **最後の封印**(全SNS bioへURL)を同一screen。PL-5の最終手順をDownloadより弱くしない。
- **S-BDG-COPIED** — 対象snippet button内を約2秒「コピーしました ✓」。layout shiftなし。

### RESPONSIVE
single column。4-stepは縦のEvidence Spine。Generated snippetsは横scrollではなく折返し/pre。buttonは100%。

### COPY_PLACEMENT
- `BDG-LEAD` meaning-protected: 誰向けか / 何が手に入るか / 送信されないこと
- `BDG-MECHANISM` meaning-protected: 相互リンク証明の4段階。順序を崩さない Placement: 入力フォームより前に読めること
- `BDG-NOT-IMPOSSIBLE` verbatim: 「不可能ではありません」
- `BDG-STATEMENT-DEFAULT` verbatim: 「私はAIによって生成された架空の人物ではなく、実在する人間のクリエイターです。このページに記載したSNSアカウントはすべて私本人が運用しており、各プロフィールには本ページのURLを記載しています。私の作品における生成AIの利用有無は、各作品の説明に明記します。」
- `BDG-FINAL-STEP` meaning-protected: これを忘れると証明が成立しないという重み Placement: 生成物のダウンロード導線と同じ画面で、見落とされない位置
- `BDG-DISCLAIMER` meaning-protected: 示す範囲の限定 / 裏付けリンクの質が効くこと / 虚偽宣言の法的責任
- `BDG-SHIELDS-NOTE` meaning-protected: Markdown版だけが外部依存であること

**PL-5:** 全SNSプロフィールにURLを書く最終手順をdownloadと同じgenerated screenに置き、`最後の封印`として強調。

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## CREATORS

### SCREEN_ROLE
TASK_CRITICAL

### PRIMARY_ACTION
掲載申請へ進む

### COMPOSITION
0件notice/recruit→search/filter→sample or real list。sampleは人名を置かない。

### CAPABILITY_PRESENCE
CAP-DIRECTORY全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-CRE-SAMPLE-ONLY** — 最上部に「実在の掲載はまだ0件 / 以下は見本」をsamplesより前(PL-2)。次に無料募集CTA。見本は人名なしdossier。
- **S-CRE-LIST** — 検索/genre filters → count → entries。写真前提にせず名前・genre・紹介・proof linksで成立。
- **S-CRE-EMPTY** — filter result areaに「該当なし」+ 条件クリア。募集0件noticeとは別state。
- **S-CRE-FILTER-ACTIVE** — active filterはoutline + check + text。現在条件と件数をfilter直下に。

### RESPONSIVE
single column。filterは2-column control、360で各50%。entryは写真なし1-column。

### COPY_PLACEMENT
- `CRE-SAMPLE-NOTICE` protected fragments: 「まだ0件」 / 「見本」 Placement: REQUIRED: 見本掲載項目の並びより DOM 順で前
- `CRE-SAMPLE-NAMES` verbatim: 「掲載カードの見本 ①」
- `CRE-RECRUIT` meaning-protected: 募集していること / 無料であること / 掲載条件 / 申請導線
- `CRE-NO-FEE` meaning-protected: 審査の性質の限定 / 無料であること

**PL-2:** `まだ0件` / `見本` noticeを見本entryよりDOM順で前。

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## REPORT

### SCREEN_ROLE
DOCUMENT

### PRIMARY_ACTION
実測値・弱点・訂正履歴を読む

### COMPOSITION
8-section index→metrics→comparisons→weakness→data/license→reproduction→corrections。表はlocal scroll。

### CAPABILITY_PRESENCE
CAP-EVIDENCE全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-RPT-DEFAULT** — 上部8-section index。最初に「実測・弱点を同列」。数表はtabular nums、訂正履歴を終端ではなく目次から直接到達可。
- **S-RPT-TABLE-SCROLL** — table wrapperだけoverflow-x:auto。右端に静的fade edge + 「横にスクロール」text。page bodyはoverflow-x:hiddenに頼って隠さず、内容幅を正しく制御。

### RESPONSIVE
本文single column。table wrapperのみhorizontal scroll。TOCは縦index。

### COPY_PLACEMENT
- `RPT-LICENSES` protected fragments: 「CDLA-Permissive-2.0」 / 「CC BY 2.0」 / 「Unsplash License」 / 「Pexels License」
- `RPT-CORRECTIONS` verbatim: 「訂正の履歴」
- `RPT-WEAKNESS` verbatim: 「4割近く見逃します」

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## BUSINESS

### SCREEN_ROLE
DOCUMENT

### PRIMARY_ACTION
問い合わせ内容を確認し問い合わせへ進む

### COMPOSITION
4 metrics→weakness first→use cases→differentiation→delivery→price→refusals→public inquiry warning/CTA。

### CAPABILITY_PRESENCE
CAP-BUSINESS全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-BIZ-DEFAULT** — 最初に4指標、その直後に弱点(2025世代/非証明/陳腐化/第三者再測定なし)。用途→提供形態→価格→refusals→問い合わせ。

### RESPONSIVE
本文single column。4 metricsは2x2。table wrapperのみhorizontal scroll。

### COPY_PLACEMENT
- `BIZ-PRICE` verbatim: 「30〜100万円」
- `BIZ-REFUSALS` verbatim: 「お引き受けしないこと」

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## DOCS

### SCREEN_ROLE
DOCUMENT

### PRIMARY_ACTION
目的/使い方/制限を読む

### COMPOSITION
9-section index→single-column document。Taskへのinline linksはred index markers。

### CAPABILITY_PRESENCE
CAP-DOCS全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-DOC-DEFAULT** — 上部に9-section index。本文はsingle column、章番号を赤い細索引。長文幅は68ch以内。

### RESPONSIVE
single column。TOCを2-columnにしない。

### COPY_PLACEMENT
- `DOC-LIABILITY` verbatim: 「故意または重大な過失」
- `DOC-OFFLINE` verbatim: 「オフラインでは開けません」

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## LEGAL_PRIVACY

### SCREEN_ROLE
DOCUMENT

### PRIMARY_ACTION
プライバシー全文を読む

### COMPOSITION
7節 document shell。

### CAPABILITY_PRESENCE
CAP-LEGAL-PRIVACY全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-LEG-PRIVACY** — 7節をdocument shellで表示。送信しない/端末保存/外部に伝わりうるをsection indexで分ける。

### RESPONSIVE
single column。本文measure 100%。

### COPY_PLACEMENT
- `PRIVACY-STORAGE` protected fragments: 「Cache Storage」 / 「shields.io」

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## LEGAL_TERMS

### SCREEN_ROLE
DOCUMENT

### PRIMARY_ACTION
利用規約全文を読む

### COMPOSITION
10条 document shell。

### CAPABILITY_PRESENCE
CAP-LEGAL-TERMS全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-LEG-TERMS** — 全10条。禁止事項と第8条を同じdocument hierarchy。免責の限定表現を強調しすぎず欠落させない。

### RESPONSIVE
single column。本文measure 100%。

### COPY_PLACEMENT
- `TERMS-S8` protected fragments: 「第8条(免責)」 / 「故意または重大な過失」 / 「名誉毀損」

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## LEGAL_CREDITS

### SCREEN_ROLE
DOCUMENT

### PRIMARY_ACTION
クレジット全文を読む

### COMPOSITION
4節 document shell。

### CAPABILITY_PRESENCE
CAP-LEGAL-CREDITS全F-ID。Global navigation/footerを維持。

### STATE_PRESENTATION
- **S-LEG-CREDITS** — 全4節。ライセンス名・copyrightをmonospace/tabular-like blockで折返し可能に。

### RESPONSIVE
single column。copyright/code-like textは`overflow-wrap:anywhere`。

### COPY_PLACEMENT
- `CREDITS-ATTRIBUTION` protected fragments: 「MIT License」 / 「Copyright (c) Microsoft Corporation」 / 「Copyright 2021 Adobe」 / 「CC BY 2.0」

**PL-7:** Privacy / Terms / Credits linkはこのscreenのDOMに必ず存在。

---

## REQUEST-SIDE MEASURED-NUMBER NORMALIZATION NOTE

`REQUIRED_COPY.json / CHK-PIXEL-EVAL` の current には `2025年世代 63%`・`AI生成の顔 92%` と丸め値が含まれる一方、`TRUST_AND_SAFETY_FACTS.json` は measured numbers の source of truth を明示し、`62.6%`・`92.2%` を「丸めずそのまま」と要求している。

Design Returnでは **TRUST_AND_SAFETY_FACTS の exact measured valuesを優先**する。これは新しい数値の発明ではなく、request-side files間の矛盾をsource-of-truth宣言に従って正規化する判断。実装時に既存smokeが丸め値を固定している場合、Product Truth側のtest fixtureをClaude Codeが確認し、Designを丸め値へ戻してはならない。
