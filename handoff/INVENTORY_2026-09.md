# 棚卸し 2026-09 — Claude Code と行った作業の全記録(ChatGPT 引き継ぎ用)

<!-- 生成: Claude Code / 対象リポジトリ yuukigogo000-ai.github.io
     対象コミット: 4ca7d68 (2026-09-09) / ブランチ claude/pc-inventory-and-history-f48zkr
     リポジトリ側はここで実測して書いた。PC側(~/.claude、AI_WORKSPACE 等)はこの環境から届かないため
     [PC側で記入] のマーカーを残している。埋め方は同じフォルダの PC_INVENTORY_HOWTO.md -->

---

## 0. ChatGPT への前置き(先に読む)

**この文書は何か**: 発注者(yuukigogo000-ai)が Claude Code と一緒に作ってきたソフトと、その作り方のルール、いまどの段階にあるかを、一人の相談役(あなた=ChatGPT)に引き継ぐための事実記録です。書いたのは Claude Code。根拠はすべてリポジトリの実物(ファイルパスと git 履歴)で、推測で埋めていません。

**役割分担(これまでの運用)**:
- 発注者 = 決める人。拒否権を持つ。無料の通常作業は確認なしで進めさせ、課金・削除・公開範囲の変更だけ事前確認を求める
- Claude Code = 実装者。設計文書・コード・検査器・レビュー依頼書を書く
- ChatGPT = これまでは「Design Authority」(パチスロ帝国の UI 再設計・アートワーク発注先)と「外部レビュー先」(HONMONO の UI 改善案)。Codex = 破壊的コードレビュー(Replier で r1〜r7)

**表記の約束**:
- 断定して書いてあることはリポジトリで実測した事実
- `UNVERIFIED` = この環境からは確認できなかったもの。`[PC側で記入]` = 発注者のPCにしか無い情報
- 日付はすべて 2026 年。年表は §3

**この文書に含めていないもの**: APIキー・トークン・`.env`・秘密鍵(そもそもリポジトリに無い)、ソースコード本体、画像アセットの実体。必要なら発注者がファイル単位で渡す。

**あなたに期待すること**: この記録を前提知識として保持し、以後の相談(次に何を作るか、どこを直すか、公開の判断)で「いま何がどこまでできているか」を毎回説明し直さなくて済むようにすること。

---

## 1. 全体像

### 1.1 リポジトリとサイト

| 項目 | 内容 |
|---|---|
| リポジトリ | `yuukigogo000-ai/yuukigogo000-ai.github.io`(**public**) |
| 公開形態 | GitHub Pages(Jekyll、primer テーマ)。**main へ push = 公開** |
| 構造 | 1ディレクトリ = 1アプリ。ビルドが要るのは Replier のソース `reply-ai-app/` だけ。他はビルド工程なしの静的 HTML/JS |
| 初回コミット | 2026-07-21(JAN→楽天価格ツールの単一 HTML) |
| 最新コミット | 2026-09-09(パチスロ帝国、PR #7) |
| 総コミット | 126(main 72 + 未マージ 54)。著者は Claude 87 / 発注者 39。99 件に Co-Authored-By |
| タグ | なし(バージョンはコミットメッセージ内の v2/v3/V5/V6 のみ) |
| 入口 `/` | 「つくったもの置き場」= 公開中アプリの一覧ページ(2026-08-25〜) |

### 1.2 公開面の地図(2026-08-25 整理、`CLAUDE.md` が正本)

| URL / パス | 状態 | 備考 |
|---|---|---|
| `/band/` セトリズム | **公開中** | サイトトップ掲載 |
| `/honmono/` HONMONO | **公開中** | サイトトップ掲載。sitemap はここの6ページのみ |
| `/pachinko/` パチスロ帝国 | **公開中** | サイトトップ掲載。9月分の追加はまだ main に無い(§4) |
| `/line-auto-reply/` | **公開中** | 手順書+GAS コード |
| `/surf/` 波チェック | **公開停止** | 告知ページ1枚のみ。noindex + robots Disallow |
| `/reply-ai/` Replier | **公開停止+墓標** | 告知ページ + 後始末 SW。`sw.js` は消してはいけない |
| `tools/jan/` JAN→楽天 | **配信停止** | `_config.yml` exclude。使う場所は PC 側のコピー |
| `reply-ai-app/` `tests/` `honmono/tests/` `desktop/` `pachinko/desktop/` `CLAUDE.md` 各種設計文書 | 配信除外 | リポジトリには残る。public なので GitHub 上では読める |

### 1.3 横断的な仕組み

- **CSP**: 全公開ページの charset 行直後に同一の CSP meta(`default-src 'self'` / `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:` / `worker-src 'self' blob:`)。Jekyll 生成ページには `_includes/head-custom.html` で注入。2026-08-25 に一斉導入
- **GitHub Actions**(2本、いずれもデスクトップ版ビルド。テスト用 CI は無い):
  - `.github/workflows/desktop-build.yml` セトリズム Electron。`desktop-v*` タグで 3OS ビルド → Release 自動添付
  - `.github/workflows/pachinko-desktop-build.yml` パチスロ帝国 Electron。`pachinko-desktop-v*` タグで 3OS ビルド → Artifacts のみ(Release 添付なし)
- **横断テスト**(`tests/`、すべて手動実行。全部「わざと壊すと落ちるか」を自己検証できる):
  - `tests/site_surface.mjs` 実サイトに対し「開くべき物/閉じるべき物」を両方検査(整理前は 55件中30件不合格だった記録つき)
  - `tests/csp_check.mjs` 全公開ページを実ブラウザで開いて CSP 違反0・JS エラー0。HONMONO は実画像を流して Worker/wasm 生存まで確認
  - `tests/reply_ai_tombstone.mjs` Replier 墓標ページの後始末スクリプトを偽 localStorage 上で実行

---

## 2. アプリ別カルテ

すべて同じ8項目: 何か / 主な機能 / 技術と保存形式 / デスクトップ版 / テスト / **現在の段階** / 残作業・判断待ち / 既知の不整合。

### 2.1 パチスロ帝国 — `pachinko/`(公開中・最も活発)

**何か**: ホール経営シミュレーションゲーム。出玉設定のジレンマが核。純資産(資金+台資産−借金)1億円でクリア、資金マイナス+融資枠切れで倒産。架空設定と明記。タイトル表示は「パチンコ店経営シミュレーション 〜目指せ、純資産1億円〜」。

**主な機能**:
- 経営: 客層3種(一般/常連/プロ)、行政ヒート、銀行融資(枠=台資産×70%+200万、金利0.25%/日)、週替わりトレンド、シマ効果、交換率、新装開店フェア、特日、スタッフ配置、広告3種、店舗拡張(上限60台)、週次レポート+アドバイス、損益グラフ、クリア評価 S/A/B/C
- イベント: 運イベント80 + 数値依存50 = 130種(V3)。その後 選択イベント15本、「大事件」システムを追加(9月)
- 9月に入った新要素(main 未反映): 全国制覇モード(地方15分割・地域一番店争い・国取り)、機種10→20、スタッフ採用ランダム化+名鑑200人+壊れ人材5人(SSランク)、地元ライバル10人プール+人物画像94点、日にち制限(のんびり90/標準120/修羅150)、修羅の「腕を選ぶ」段+商機デッキ30枚、「台の荒さ」、シマ増設費の店舗簿価計上、支店と支店長(店長を外せる)、客層把握まで機種相性を伏せる、実績56種、全台設定の一括変更、試打の廃止
- 画面は6パネル: ホール / 新台購入 / 店長室 / 営業記録 / 実績 / 全国マップ

**技術と保存形式**:
- 単一 HTML(`pachinko/index.html` 約438KB / 7,142行)に HTML+CSS+JS 全部入り。Vanilla JS、フレームワーク・ビルド・実行時外部依存すべてゼロ
- 状態は単一グローバル `state`。**localStorage キー `pachi-teikoku-save-v1`**。スキーマ23キーを `pachinko/guard/protected-spec.json` が固定
- Service Worker あり(`pachinko/sw.js`、`pachi-teikoku-v8`)。PRECACHE は `art/` 肥大で 500件超。http(s) のときだけ登録
- PWA manifest あり(icon 192/512、maskable)。描画は HTML+CSS+インライン SVG、Canvas/音声なし

**デスクトップ版**: `pachinko/desktop/` Electron 33、`PachiSlotTeikoku` v1.0.0、win nsis / mac dmg / linux AppImage。`sandbox: true`

**テスト**: `tests/` にはパチンコ用が無い。検査器は `pachinko/guard/` の2本のみ。
- `regression-guard.js` 保護関数(`simulateDay` `weeklyReport` `save` `load` `sanitizeState` 等)を Protected Region 単位でハッシュ比較(`baseline` / `verify`)
- `runtime-guard.js` Playwright で 機能到達性39機能 / 外部リクエスト0 / オフライン起動 / Electron・file モード / レスポンシブ / セーブ互換。実測ログは `pachinko/review/REGRESSION_AFTER.txt` `RUNTIME_GUARD_AFTER.txt`(PASS)

**現在の段階**: 公開中(main = 8/25 時点の V3 相当)。**V5→V6(9/4)以降の54コミットは作業ブランチにあり未公開**。FEATURE_ROADMAP の B-01〜B-20 は全て「実装」。

**残作業・判断待ち**:
- `pachinko/review/README.md`: GATE A PASS / GATE B 供給素材のみ使用 / **GATE C は自己採点せず Human Verdict 待ち**(発注者の最終判定がまだ)
- `pachinko/redesign/PIPELINE_STATE.md`: UI REDESIGN PIPELINE v4.0 の **Gate H3 = AWAITING_CHATGPT_DESIGN で停止中**。`CHATGPT_DESIGN_REQUEST.zip` を渡し、返却物を `pachinko/redesign/return/` に展開して Phase 5 から再開する設計。**返却物は未着**(ChatGPT 側で「Candidate 03 営業中の戦い」を選定済みだが仕様はリポジトリに無い)
- FEATURE_ROADMAP C. NEXT PHASE(未実装): C-02 作戦プリセット(複数台一括設定)/ C-03 EVENT CENTER / C-04 LEGACY・RECORD / C-05 REPORT CENTER / C-06 SOUND DESIGN
- D. DEFERRED(実装禁止と決めたもの): 物理フロアマップ / 客エンティティ / リアルタイム稼働 / オンラインランキング / ログイン / クラウドセーブ / マルチプレイ / プッシュ通知 / 課金 / ログインボーナス など15件
- 54コミットを main に上げる(=公開する)なら、`CLAUDE.md` の工程4ラウンド2+工程7(Codex PASS)を通す約束

**既知の不整合**:
- `FEATURE_ROADMAP.md` が参照する `pachinko/review/ACCEPTANCE_REPORT.md` は存在しない
- `PIPELINE_STATE.md` が記す `handoff.html`(73,936字)は存在しない
- `DESIGN.md` に「主要数値」表が2つ重複し、客数式・難易度係数・ヒート減衰が矛盾(v3 調整前後が両方残っている)
- `DESIGN_INPUT_PACKET/` は 9/4 時点(index.html 94KB)の記録で、現行(438KB)と大きく乖離(§2.8)
- `CHATGPT_ARTWORK_REQUEST.md` が指す `art/hall.jpg` は既に無い(V6 で役目を終えた発注書)

**内部文書**(配信除外): `DESIGN.md`(設計書 v3)/ `FEATURE_ROADMAP.md` / `CAPABILITY_AUDIT.md`(9/4、Claude Code Remote 環境の実測: 画像生成 AI・外部画像 API・HuggingFace はすべて接続不可、GPU なし)/ `ASSET_BRIEF.md`(外部 AI 向け素材発注、約70点)/ `CHATGPT_ARTWORK_REQUEST.md` / `review/`(V6 実装報告・アセット対応表・スクショ59枚・レビューパケット zip)/ `redesign/`(役割定義 `CHATGPT_INSTRUCTIONS.md`、`BLIND_DESIGN_BRIEF.md`、JSON 7点、自己検証 `validate_request.js` 48 PASS)

### 2.2 セトリズム(SETLISM)— `band/` + `desktop/`(公開中)

**何か**: バンドのライブ準備を1つに束ねるスマホ向け PWA。サーバー不要・インストール不要。

**主な機能**:
- セトリ設計: 曲ライブラリ(BPM/キー/チューニング/長さ/盛り上がり度/転換チェックリスト/メモ)、並べ替え・複製・Undo/Redo、持ち時間シミュレーション(転換・MC 合算)、エナジーフロー曲線(理想型テンプレート重ね・A/B 比較)、セトリ診断(チューニング連続・同キー連続・BPM 単調・エナジー急落・時間オーバー)、持ち替えプランナー
- 練習: 通し練習モード(自動進行+カウントイン+転換タイマー)、メトロノーム(タップテンポ・拍子・段階テンポアップ・抜き練習)、チューナー(ACF 自己相関+放物線補間)、耳コピ A-B ループ(ピッチ維持速度変更+波形)、リハ録音
- 本番: Now Playing(押し/巻き表示・リロード復元)、イベントタイムテーブル、ステージシート A4 印刷
- 共有・保存: 共有リンク(URL 埋め込み+QR)、オフライン PWA、バックアップ書き出し/読み込み

**技術と保存形式**: Vanilla JS(ES Modules)。ベンダは QR 生成 `band/vendor/qrcode.mjs` のみ。**localStorage キー `setlism:v1`**(中身の `v` フィールドで世代管理、v1→v2 自動移行)。IndexedDB `setlism-rec`(録音 Blob)。SW あり(`setlism-v2`、stale-while-revalidate)。共有リンクは CompressionStream(deflate-raw)+base64url。

**デスクトップ版**: `desktop/` Electron 37、`setlism-desktop` v1.0.0。`app://setlism/` 独自スキームで配信(file:// では ESM が読めないため)。3OS ビルド+Release 自動添付。

**テスト**(`tests/`): `smoke.mjs` **87項目**(時間計算・共有リンク往復・QR 実デコード・v1 移行・通し練習・録音・本番モード復帰)/ `torture.mjs` **42項目**(壊れた保存データ・共有リンクファズ・XSS 注入・80曲・Undo 枯渇・保存失敗)/ `electron-smoke.mjs` **14項目**。実行 `cd tests && npm install && npm test`。

**現在の段階**: 公開中・機能的に完成。最終変更 2026-08-25(共有リンク経由の HTML 注入を塞いだ)。ROADMAP 文書なし。

**残作業・判断待ち**: `navigator.share()` が解決しないと共有が無反応になる既知欠陥(WO UI-band-setlistedit の見送り事項)。

**既知の不整合**: manifest のアイコンが SVG 1件のみ(PNG 192/512 が無く、一部ブラウザで PWA インストール要件を満たさない可能性)。

### 2.3 HONMONO — `honmono/`(公開中)

**何か**: 「AI が美女を無限に作る時代」に、画像や作品が人の作った本物かを確かめる道具4種をまとめた静的サイト。全処理が端末内完結、画像はサーバーへ送らない。

**主な機能**(全10ページ):
- `/checker/` 画像来歴チェッカー: C2PA 署名検証、メタデータ全文、生成 AI ツール既知パターン照合(Midjourney/DALL·E/SD/ComfyUI 等)、実験扱いの画素 AI 判定
- `/badge/` 実在証明バッジ(相互リンク証明)、`/aicheck/` AI アカウント鑑定(加減点式)、`/creators/` 実在クリエイター名鑑(現在は見本4件のみ、実登録ゼロ)
- `/docs/` 説明書、`/report/` 実測レポート(公開モデル9本の実測、自前モデル、訂正の履歴)、`/business/` 法人向け(先に弱点・価格レンジ・お引き受けしないこと)、`/legal/` プライバシー・規約(10条)・クレジット

**技術と保存形式**: Vanilla HTML/CSS/JS、ビルドなし。wasm 2種(Adobe c2pa-js、onnxruntime-web)。**自前モデル `honmono_v31_int8.onnx`(90,283,577 bytes、2分割ファイルを結合)**。設定 `window.HONMONO_PIXEL_CONFIG`(threshold 0.8、version 'v3.1 (2026-08-19)')。実測: 外部545枚で実写誤判定1.8%・AI 検出70%、2025年世代生成器63%、顔615枚で誤判定1.1%・検出92%。**localStorage キー `honmono_pixel_auto`**。Cache API `honmono-pixel-model-v1`。**SW なし**(「オフラインでも動作」は虚偽だったため 8/20 に削除)。

**デスクトップ版**: なし。

**テスト**(`honmono/tests/`): `verify_site.py` 静的検査 11ページ PASS(`--selftest` 6/6)/ `test_pages_smoke.js` 実ブラウザ 32項目 PASS(`--mutate` 32/32)/ `test_overflow.js` 360×800・390×844 で横スクロールなし 18通り PASS。※後2本は PC の Edge 実行ファイルと `C:\Users\gogyo\AppData\Local\Temp\hbk\site` をハードコード(`SITE_ROOT` で差替可)。

**現在の段階**: 公開中・全機能稼働。利用者ほぼゼロ(告知していない)。収益化まだ。名鑑登録ゼロ。画像素材ゼロ(`honmono/assets/` 空)。8/20 に法務是正(免責限定、「偽造できない」→「難しい」、架空クリエイター削除、OSS ライセンス表示、学習データ帰属公開)を完了。

**残作業・判断待ち**(`honmono/design/PLAN_RELEASE_PREP.md` §8):
- 発注者にしかできない: 法人向け専用メール / GitHub Sponsors 有効化 / **インボイス登録の判断(経過措置80%が 2026-09-30 で終了)** / 商標調査(J-PlatPat 第9類・第42類)/ B2B 営業
- 工程5(UI 改善)のあと: A1 検証レポートの書き出し(有料版の原型)/ **A8 PWA 化 未着手** / **B8 ホスティング移転(Cloudflare Pages + R2。課金1円でも受け取る前に必須。Pages の 25MiB 上限でモデルが載らないため R2 併用)** / A6 Cookie レス計測
- 学習の正本 `AI_WORKSPACE/honmono_train/README_TRAIN.md` は PC 側(§6)

**既知の不整合**: `README.md`(リポジトリ直下)が HONMONO に触れていない。

**内部文書**: `design/AI_DETECTOR_EVAL.md`(公開ページからリンク、exclude 禁止)/ `dataset_licenses.json`(同)/ `PLAN_RELEASE_PREP.md` / `UI_REVIEW_BRIEF.md`(ChatGPT 等に UI 改善案を出させる現状説明書)/ `IMAGE_BRIEF.md`(画像生成 AI 向け、必須10点+13点)/ `vendor/models/LICENSE.md`(モデル利用条件、日英)

### 2.4 Replier(リプライア)— `reply-ai/`(公開停止)+ `reply-ai-app/`(ソース)

**何か**: マッチングアプリ・LINE の会話(スクショ最大6枚 or テキスト)からデートに繋がる返信を3案提案する「返信コーチ」PWA。当初の「LINE 全自動返信」は規約違反・垢 BAN リスクで商品化不可と判断し、「AI が提案し送信は本人」へ転換(米 Rizz / YourMove AI 型)。

**主な機能(実装済み)**: 返信3案+文体ミラーリング+AI 臭ブラックリスト / ゴール8種・トーン4種 / 脈あり度メーター+戦略アドバイス / 吹き出し分割3方式 / 採用学習(コピーした返信を最大30件記憶、直近8件を次回に渡す)/ プロフィール添削・診断・ゼロから作成 / LINE スクショ特化読み取り(既読・時刻→温度感、スタンプ解釈、複数枚の時系列)/ サンプル会話8パターン。**作らないと決定**: AI 写真生成 / iOS キーボード拡張 / 自動送信。

**技術と保存形式**: React 19 + TypeScript + Vite 8 + Tailwind v4 + Radix UI + vite-plugin-pwa(`registerType: 'prompt'`)。`base: '/reply-ai/'`、`outDir: '../reply-ai'`。バックエンドなし(利用者自身の Anthropic API キー方式)。**localStorage キー** `reply_ai_key` / `reply_ai_adopted` / `reply_ai_install_hint_closed` / `reply_ai_onboarded`(+テスト用 `reply_ai_timeout_ms`)。

**デスクトップ版**: なし。

**テスト**: `reply-ai-app/tests/e2e.test.js` **131項目**(モック API。401・refusal・途中切断・壊れた画像・7枚超過・XSS・ネットワーク断・ダークモード・PWA 配信物)。`pretest` で必ずビルド(変異検査が古いバンドルで緑になった事故の再発防止)。実行 `cd reply-ai-app && npm test`。Codex 破壊的検証 r1〜r6: 指摘34件 → 修正31件 / 理由つき見送り3件 → 最終 PASS(`REVIEW_LOG.md`)。

**現在の段階**: **公開停止(2026-08-25)**。理由「ログインと利用料の仕組みが用意できていない」。`reply-ai/` は告知 `index.html` と墓標 `sw.js` の2ファイルのみ。告知ページのインラインスクリプトが `reply` で始まる localStorage を全消去し、全 Cache と SW 登録を解除する。**`sw.js` は消さない**(消すと端末に残った旧 PWA が API キーを預かる画面ごとオフラインで動き続ける)。

**残作業・判断待ち**(`DESIGN.md` §5): Phase 1.5 = 実機(iPhone/Android)確認と実ユーザー検証が残 / **Phase 2 = Cloudflare Workers バックエンド+認証+無料枠+Stripe 課金+独自ドメイン → 一般公開(未着手)** / Phase 2.5 特商法・規約・プラポリ・SEO / Phase 3 サーバー側パーソナライズ。未検証リスク: 実 API での通し確認は所有者の数回のみ、応答本文の受信停止経路に自動テストなし。

**既知の不整合**: なし(公開停止時に整理済み)。

**内部文書**: `README.md`(事業計画・料金モデル案)/ `DESIGN.md` / `RESEARCH.md`(競合)/ `RESEARCH_LINE_STYLE.md`(文体調査)/ `REVIEW_REQUEST.md` `REVIEW_RESPONSE.md`(PASS)`REVIEW_LOG.md` / `CODEX_REPLIER_PROMPT.txt` / `docs/ui/WO_UI_replier_reply.md`(UI Work Order の書式見本)/ `baselines/replier.json`(uicheck 基準線 2026-08-17)

### 2.5 波チェック — `surf/`(公開停止)

**何か**: 波・風・水温スコアリング+ウェットスーツ助言のサーフィン判定ツールだった。
**現在の段階**: 2026-08-20 に公開停止。`surf/index.html`(告知1枚、noindex)しか残っていない。実装・設計・テスト・ロードマップは**一切残っていない**。SW も後始末スクリプトも無し(元々 PWA ではなかったと推定)。
**残作業**: 「内容の見直し」の中身は文書化されていない(`UNVERIFIED`)。再開するなら作り直し。

### 2.6 LINE 自動返信ボット — `line-auto-reply/`(公開中)

**何か**: Google Apps Script(GAS)でサーバー代ゼロの LINE 自動返信ボットを立てる**手順書+コード配布**(アプリではない)。
**主な機能**: キーワード部分一致の `RULES`(既定4ルール)、`DEFAULT_REPLY`、友だち追加時 `FOLLOW_GREETING`、6ステップ手順(20〜30分)、トラブル表。トークンは GAS スクリプトプロパティ(`setToken` / `checkToken`)。
**技術**: `code.gs`(5.8KB)、`doPost` → LINE reply API。ブラウザ側保存なし。
**現在の段階**: 公開中。**コミット1件(2026-08-16)以降未変更**。テストなし。
**既知の制限**: GAS はリクエストヘッダを受け取れないため **LINE 署名検証をしていない**(業務利用なら Cloudflare Workers / Node へ移行と README に明記)。

### 2.7 JAN→楽天価格 取得ツール — `tools/jan/`(配信停止・個人用)

**何か**: JAN コードから楽天市場 API で価格を引く単一 HTML(11KB)。リポジトリ最古の成果物(2026-07-21)。
**技術と保存形式**: Vanilla JS。**localStorage キー** `rk_remember` / `rk_appId` / `rk_accessKey`。API URL は `IchibaItem/Search/20260701`。CSP meta なし(`file://` 実行前提)。
**現在の段階**: 2026-08-25 にサイトから降ろした(公開オリジンに置くと保存した楽天 API キーがサイト内の XSS 1箇所から読めるため)。**使う場所は `C:\Users\gogyo\tools\jan\index.html`**(リポジトリ側を直したらコピーし直す運用)。`file://` から楽天 API に到達することは実測済み(403 Invalid Access Key が返る=CORS は通る)。**有効な鍵での通しは未実施**。
**禁止**: サイトに戻すと `connect-src 'self'` で楽天 API が遮断される。

### 2.8 DESIGN_INPUT_PACKET/ — パチスロ帝国 UI 再設計用フォレンジクス(アプリではない)

**何か**: 2026-09-04 に Claude Code が READ-ONLY で `pachinko/` を調査し、ChatGPT(Design Authority)へ渡すために作った19ファイル。全ファイルに「対象コミット f71190b / 根拠のないものは UNKNOWN と書く」のヘッダ規約。
**中身**: 01 リポジトリマップ / 02 製品の事実 / 03 機能39 / 04 凍結33項目 / 05 画面12 / 06 状態62 / 07 表示データ62 / 08 操作35 / 09 遷移24エッジ / 10 技術制約 / 11 アセット3 / 12 必須コピー40 / 13 ゲームルール50 / 14 デザインリスク12 / 15 TRUTH_MATRIX.csv 374行 / 16 返却要件 JSON(`frozen_design_intent: "Candidate 03 「営業中の戦い」"`)/ 17 自動受け入れ20+3 / 18 抽出報告(UNKNOWNS 10・CONFLICTS 5)。
**現在の段階**: 役目は V6 実装(9/4)で一区切り。**現行コードの 1/4.6 の規模の時点の記録**なので、再利用するなら作り直しが要る。UNKNOWN のうち U-01「対象ビューポートの明示的定義」は今も宣言されていない(`UNVERIFIED`)。

---

## 3. 年表

| 日付 | 出来事 |
|---|---|
| 07-21 | 初回コミット。JAN→楽天価格ツール(ルート index.html) |
| 08-16 | **1日で6アプリ投入**(27コミット): セトリズム、パチスロ帝国、LINE 自動返信、HONMONO、Replier MVP、波チェック、Electron 化、UI Workbench |
| 08-17 | PR #1〜#3 マージ。Replier を React+Vite で作り直し、製品名 Replier に。Codex r1〜r6(指摘34/修正31)。UI WO(Replier・セトリズム)。HONMONO 公開モデル9本実測 |
| 08-18 | Replier UI を M3/Stitch 見本に合わせ作り直し(UI_PLAYBOOK 工程5)。HONMONO 自前モデル v2 → v3。`tests/` 初出 |
| 08-19 | HONMONO v3.1 搭載。UI_REVIEW_BRIEF 作成 |
| 08-20 | 波チェック公開停止。HONMONO 法務是正・`/report/`・`/business/`・法務3ページ(PLAN_RELEASE_PREP 第1波・第2波) |
| 08-23 | UI Workbench 削除(企画凍結、発注者判断) |
| 08-25 | **公開面の大整理**: ルートをランディングに、JAN を `tools/` へ退避、Replier 公開停止+墓標、`_config.yml` exclude、全ページ CSP、`site_surface.mjs`、共有リンク HTML 注入対策。**main はここで止まっている** |
| 09-04 | パチスロ帝国 能力監査、DESIGN_INPUT_PACKET 19本、V5(Presentation Layer 再実装)、V6(供給 Artwork 全画面適用)、実績56種 |
| 09-05 | 全国制覇モード、地方15、機種20、スタッフ採用ランダム化・名鑑200・壊れ人材、難易度再調整(17コミット) |
| 09-06〜07 | 経済モデル作り直し(資金の動き、試打廃止、機種スペック実効化、中古相場、スタッフ40台/人) |
| 09-08 | 地元ライバル+画像94点、選択イベント15本、日にち制限、店舗簿価 |
| 09-09 | 災厄→「大事件」、腕を選ぶ+商機デッキ30、台の荒さ、PR #4〜#7 マージ(作業ブランチ内)。**最新** |

月別コミット数: 7月 2 / 8月 70 / 9月 54。8月は全アプリ横断、9月はパチスロ帝国のみ(コミット書式も Conventional Commits に変化)。

---

## 4. 未マージ作業(main に無いもの)

- 現ブランチ `claude/pc-inventory-and-history-f48zkr` は main を完全に含み、**+54コミット**(2026-09-04〜09-09)。逆方向の差分ゼロ
- 中身: `DESIGN_INPUT_PACKET/` 19本、`pachinko/` の V5/V6 と上記9月機能すべて、PR #4〜#7 のマージコミット、`_config.yml` への pachinko 内部文書の exclude 追加
- **公開されていない**= サイトの `/pachinko/` は 8/25 版。公開するには main へ push が必要で、その前に `CLAUDE.md` の約束(工程4ラウンド2+工程7 Codex PASS、uicheck GREEN、横並び画像3問)を通す
- リポジトリ内に `health/`(おじさん健康手帳)の痕跡はゼロ(全 ref 走査)。`CLAUDE.md` は「ブランチ」と書いているが、別リポジトリか削除済み。`[PC側で記入]`

---

## 5. 開発の仕組みとルール(Claude Code が従っている約束)

**正本の所在**: リポジトリ直下 `CLAUDE.md`(配信除外)。ここから PC 側の `~/.claude/playbooks/UI_PLAYBOOK.md`(UI 規則、例外なし)と `APP_DEV_WORKFLOW.md`(公開前工程)を参照している。

**UI(見た目)の規則**:
- 見本なしで発明しない。見本 = Material Design 3 公式 + Google Stitch から Claude が用意。「もっと良く」には見本生成で答える
- 交通整理(主操作1つ・上位3タスク・格下げ・状態一覧)は Claude が決めて Work Order(WO)に理由つきで記録し発注者に見せる(発注者は拒否権)
- トークン以外の生値を書かない(文字階層≤5・角丸≤3)
- 自己採点しない: `AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs` GREEN + 発注者の一言(横並び画像に3問)で完了。検査器を直したら `--mutate` 4/4
- 完了報告は数字(before/after)+横並び画像+見送り事項。部分完了を完了と言わない
- 1WO = 1アプリ×1画面。固定条件 360×800 / 390×844・DPR3・light+dark
- 禁止: 外部 CDN / Web フォント / 外部アイコン(オフライン PWA)、見た目 WO でのロジック・保存形式・localStorage キー変更、他社画像の持ち込み

**公開の規則**: main へ push = 公開。公開前は工程4ラウンド2+工程7(Codex PASS)。リポジトリは public なので秘密は絶対に置かない。

**レビュー運用の実績**: Codex(`codex exec -s read-only`)に `CODEX_REPLIER_PROMPT.txt` 型のプロンプト(APPROVED DESIGN / WHAT COUNTS AS CRITICAL / OUTPUT FORMAT `PASS` or `FIX_REQUIRED`)を渡して r1〜r7。ChatGPT には「役割宣言 + 受け取っている物/受け取っていない物 + 境界 + 返却物 + 返却後の流れ」型(`pachinko/redesign/request/CHATGPT_INSTRUCTIONS.md`)で依頼。

**発注者の確認方針**(この棚卸し依頼時点): 無料の通常作業(コード修正・UI 改善・テスト追加・文書・ローカル実行・無料ライブラリ・設定変更)は確認なしで進める。課金が生じうる操作、API キー・`.env` の読み取り、既存データ削除、DB 初期化、認証情報変更、セキュリティ設定、公開範囲変更、既存仕様を大きく変える設計変更は事前確認。報告は 変更ファイル / 変更内容 / 確認方法 / 残リスク だけ簡潔に。

---

## 6. リポジトリ外の資産(PC 側にあるもの)

リポジトリから参照されているが、この環境からは中身を確認できない。**状態列は PC 側で埋める**。

| # | パス(PC) | 役割 | 参照元 | 状態 |
|---|---|---|---|---|
| A-1 | `~/.claude/playbooks/UI_PLAYBOOK.md` | UI 規則の正本 | `CLAUDE.md:5`、`reply-ai-app/docs/ui/WO_UI_replier_reply.md:3` | [PC側で記入] |
| A-1 | `~/.claude/playbooks/APP_DEV_WORKFLOW.md` | 公開前工程(工程1〜7)の正本 | `CLAUDE.md:12` | [PC側で記入] |
| A-2 | `AI_WORKSPACE/ui_toolkit/uicheck/uicheck.mjs` | UI 検査器(GREEN 判定、`--mutate`) | `CLAUDE.md:9` | [PC側で記入] |
| A-2 | `AI_WORKSPACE/honmono_train/README_TRAIN.md` | HONMONO モデル学習の正本(v3 再学習手順) | `honmono/design/AI_DETECTOR_EVAL.md:35` | [PC側で記入] |
| A-3 | `ui-workbench/PLAYBOOK.md` | WO の順序・基準線・テスト所在の固有メモ | `CLAUDE.md:11`(リポジトリ内の `ui-workbench/` は 8/23 に削除済み) | [PC側で記入] |
| A-4 | `C:\Users\gogyo\tools\jan\index.html` | JAN ツールの実使用コピー | `CLAUDE.md:35-37` | [PC側で記入] |
| A-4 | `C:\Users\gogyo\AppData\Local\Temp\hbk\site` | HONMONO 検査器の対象サイトルート(ハードコード) | `honmono/tests/verify_site.py:155`、`test_overflow.js:4` | [PC側で記入] |
| A-5 | `scratchpad/bakeoff/`(`fetch_eval.py` `bakeoff.js` `hbk/eval_pt.py` `export_onnx.py`)| HONMONO モデル評価・ONNX 書き出しの実体 | `AI_DETECTOR_EVAL.md:168-173` | [PC側で記入] |
| A-5 | `scratchpad/shots5/compare_*.png` | Replier UI WO の横並び画像 | `WO_UI_replier_reply.md:126` | [PC側で記入] |
| A-6 | ChatGPT 側「Candidate 03 営業中の戦い」の Visual Intent | パチスロ帝国 UI 再設計の意匠正本 | `DESIGN_INPUT_PACKET/14`、`16` | ChatGPT 側にのみ存在 |
| A-6 | HANDOFF v6 パッケージ(`REFERENCE/USER_APPROVED_VISUAL_TARGET.jpeg`、ATLAS 原本88点+12クロップ)| V6 の供給 Artwork 原本 | `pachinko/review/IMPLEMENTATION_REPORT_V6.md`、`ASSET_MAPPING.md` | [PC側で記入] |
| A-6 | `CHATGPT_DESIGN_RETURN.zip` | Gate H3 の返却物 | `pachinko/redesign/PIPELINE_STATE.md` | **未着** |
| — | `health/` おじさん健康手帳 | `CLAUDE.md:3` に「ブランチ」とあるがこのリポジトリに痕跡なし | | [PC側で記入] |
| — | Claude Code のメモリ(`~/.claude/CLAUDE.md`、`~/.claude/projects/*/memory/`)| Claude が覚えている発注者の好み・約束 | | [PC側で記入] |
| — | Claude Code の設定(`~/.claude/settings.json` の hooks / permissions / MCP)| 自動化と権限 | | [PC側で記入] |

---

## 7. 期限つき・判断待ち事項(発注者が決めるもの)

| 期限 | 事項 | 出典 |
|---|---|---|
| **2026-09-30** | HONMONO: インボイス登録の判断(経過措置80%終了) | `honmono/design/PLAN_RELEASE_PREP.md` |
| なし | パチスロ帝国 V6 の GATE C Human Verdict(発注者の最終判定) | `pachinko/review/README.md` |
| なし | パチスロ帝国 UI 再設計 Gate H3: ChatGPT からの返却物を受け取るか、パイプラインを閉じるか | `pachinko/redesign/PIPELINE_STATE.md` |
| なし | 9月分54コミットを main に上げる(公開する)か、その前に工程4/7 を回すか | §4 |
| なし | Replier Phase 2(バックエンド+課金)に進むか、凍結のままか。進むなら Cloudflare Workers / Stripe = **課金が生じる操作** | `reply-ai-app/DESIGN.md` §5 |
| なし | HONMONO B8 ホスティング移転(Cloudflare Pages + R2 = **課金が生じうる**)、GitHub Sponsors、専用メール、商標調査 | `PLAN_RELEASE_PREP.md` §8 |
| なし | 波チェックを作り直すか捨てるか | §2.5 |
| なし | `README.md`(リポジトリ直下)の旧記述を直すか(現物と食い違い) | §8 |
| なし | 健康手帳(`health/`)の所在確認 | §4 |

---

## 8. 文書と実体の食い違い(直していない。記録のみ)

1. `README.md` が「ルートの index.html は個人用の価格取得ツール」と書いているが、実際は 8/25 からランディング。HONMONO・パチスロ帝国・波チェック・Replier に触れていない
2. `pachinko/FEATURE_ROADMAP.md` が参照する `pachinko/review/ACCEPTANCE_REPORT.md` が無い
3. `pachinko/redesign/PIPELINE_STATE.md` が記す `handoff.html` が無い
4. `pachinko/DESIGN.md` の「主要数値」表が2つ重複し値が矛盾
5. `DESIGN_INPUT_PACKET/` が 9/4 時点の旧コミット基準
6. `band/manifest.webmanifest` に PNG アイコンが無い
7. `CLAUDE.md` の `health/` 記述に裏付けが無い

---

## 9. PC 側の記入欄

<!-- ここから下は PC の Claude Code か発注者が埋める。埋め方: PC_INVENTORY_HOWTO.md -->

### 9.1 Claude Code のメモリ(発注者の好み・約束として覚えていること)
[PC側で記入] `~/.claude/CLAUDE.md` と `~/.claude/projects/<このリポジトリ>/memory/*.md` の要約。秘密は書かない。

### 9.2 playbooks の要約
[PC側で記入] `UI_PLAYBOOK.md` の工程一覧(工程1〜?)と各工程の完了条件。`APP_DEV_WORKFLOW.md` の工程1〜7 と「ラウンド2」「Codex PASS」の定義。

### 9.3 AI_WORKSPACE の中身
[PC側で記入] `ui_toolkit/uicheck/` の使い方と最終実行日、`honmono_train/` の学習データ置き場と最終学習日、その他のサブフォルダ。

### 9.4 このリポジトリ以外のプロジェクト
[PC側で記入] Claude Code で触った git リポジトリの一覧(パス / 最終コミット日 / 一言)。`health/` 健康手帳の所在。

### 9.5 Claude Code の設定
[PC側で記入] hooks(何が自動で走るか)、permissions の allow/deny の要点、MCP サーバー、使っているスキル。

### 9.6 ChatGPT に伝えたい癖・好み
[PC側で記入] 例: 日本語で答える / 確認の手間を減らす / 課金だけ止まる / 報告は4項目 / 数字で報告 / 部分完了を完了と言わない。
