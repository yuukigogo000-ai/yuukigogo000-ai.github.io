# APP RANK ALPHA v0.1 — 実装・研究 計画書

作成日: 2026-09-04
対象仕様: `config/APP_RANK_ALPHA_v0.1_CANONICAL.md`(SHA256 は `config/SPEC_SHA256.txt`)
実装者: Claude Code(Opus 5)
発注者: リポジトリ所有者
この計画書の目的: **実装者が発注者の承認を一度も待たずに、最終判定(VERDICT_0〜5)まで走りきる**ための手順・判断規則・事前承認をすべて書き切ること。

---

## 0. この文書の位置づけ

- 研究の正本は Canonical Spec(以下「仕様」)。この計画書は仕様を**変更しない**。仕様が曖昧な箇所は §5「事前解釈」で読み方を1つに固定する。事前解釈は仕様の変更ではなく、仕様の範囲内での運用上の決定である。
- 仕様が「人間の承認」「manual audit」「明示実行」を要求する箇所は、§2 の**事前承認**により、この計画書に書かれた条件で実装者が代行してよい。発注者がこの計画書を Opus に渡した時点で、§2 の事前承認は有効とみなす。
- 実装者は本文書を `AGENTS.md` と併せて毎セッション冒頭に読む。矛盾があれば **仕様 > 計画書 > AGENTS.md** の順で優先する。

---

## 1. 発注者の代わりに決めた事項(決定事項)

| # | 項目 | 決定 | 理由 |
|---|---|---|---|
| D-01 | 置き場所 | このリポジトリの `APP_RANK_ALPHA/` 直下 | 発注者の指定ブランチがこのリポジトリのため。`_config.yml` の `exclude` に `APP_RANK_ALPHA/` を追加済みで、GitHub Pages からは配信されない |
| D-02 | 公開リポジトリ対策 | **プロバイダ由来の生データ・加工データ・トレード台帳は一切コミットしない**(`APP_RANK_ALPHA/.gitignore` で `data/`・`results/**/ledger_*`・`results/_synthetic/` を除外)。コミットしてよいのは コード・テスト・設定・登録簿(registry)・監査CSV・集計レポート(md/json/html/集計csv)のみ | このリポジトリは public。AppTweak / J-Quants の利用規約上、取得データの再配布は不可。仕様 §82「API利用条件に抵触」= STOP 条件なので、これを守らないと研究自体が無効になる |
| D-03 | API キーの受け渡し | 環境変数のみ。発注者が自分で設定する。実装者は PC 内の他ソフトの設定や .env を探さない。`APPTWEAK_API_KEY`、J-Quants は `JQUANTS_REFRESH_TOKEN` **または** `JQUANTS_MAIL_ADDRESS` + `JQUANTS_PASSWORD`(コードがリフレッシュトークンを取得する。どちらも無ければ未設定扱い)、任意で `EDINET_API_KEY`。コードは `os.environ` から読む。実装者は値を読まない・表示しない・ログに残さない。`doctor` は「設定されているか(bool)」だけを報告する | 発注者の指示(秘密情報を勝手に読まない)と仕様 §72/§80 |
| D-04 | 課金の範囲 | AppTweak は**無料トライアルの 18,000 credits の範囲内**(仕様 §6 の上限どおり。上限は `config/api_budget.yaml`)。J-Quants は発注者が契約済みのプランをそのまま使う。**実装者は新たな契約・プラン変更・追加購入を一切行わない** | 発注者の「追加料金が発生する操作は確認必須」ルール。上限内の API 呼び出しは、この計画書で事前承認する |
| D-05 | 履歴不足時の扱い | J-Quants のプランで 2018-01-01 以前の日足が取れない、または AppTweak の共通履歴が 2018-01-01 に届かない場合は **INSUFFICIENT_HISTORY → VERDICT_0(DATA_NOT_FEASIBLE)で正常終了**し、必要な履歴と概算コストを `results/API_COST_REPORT.md` に書く。発注者に「契約してよいか」と聞かない | 聞くと止まる。止まらずに「何が足りないか」を残す方が発注者の手間が少ない |
| D-06 | Git 運用 | 作業ブランチ `claude/app-rank-alpha-v01-impl`。ステージ完了ごとにコミットし push。**main へはマージしない**(発注者が行う)。最後に PR を1本作る(マージはしない) | CLAUDE.md「main へ push = 公開」 |
| D-07 | 技術選定 | Python 3.12、`uv`(無ければ venv+pip)、Polars(主)+ DuckDB(集計)+ PyArrow/Parquet、HTTPX、Pydantic v2、NumPy/SciPy/statsmodels、CLI は `typer`、テストは `pytest` | 仕様 §70 の範囲内。typer は無料ライブラリの追加として発注者ルール上許容 |
| D-08 | 合成データ(synthetic)先行 | API キーの有無に関わらず、**合成データでパイプライン全体を先に完成させる**(Stage 0)。合成データの出力は `results/_synthetic/` に隔離し、本番結果と混ざらないよう全ファイル先頭に `data_origin: synthetic` を書く | キー未設定でも進められる部分を最大化する。ルックアヘッド検査・holdout lock は合成データで先に証明できる |
| D-09 | 日次 credit 上限による中断 | AppTweak 日次上限(5,000)に達したら CLI は終了コード 75(`BUDGET_DAY_EXHAUSTED`)で止まり、実装者は **24時間+15分後の自己起床**(`send_later` / Routine など使える手段)を予約して再開する。使える手段が無い場合は `results/RESUME_INSTRUCTIONS.md` に再開コマンドを書いて終了する | 上限は仕様 §6 で固定。連続実行できない以上、自動再開が「走りきる」唯一の方法 |
| D-10 | HTML レポート | サイトには載せない(`exclude` 済み)。CLAUDE.md の UI ルール(M3 見本・uicheck)は**適用外**。仕様 §77 の「static HTML 1枚」を最小限で作る | 仕様 §77「UI開発はしない」 |
| D-11 | 第三者情報の扱い | 経済的帰属(ownership)・重要性(materiality)の根拠は公式 IR / 有価証券報告書 / 決算短信 / 公式ストア掲載の販売元 / 公式サイトのみ。Wikipedia・ニュース記事・まとめサイトは「探す手がかり」にしてよいが根拠にはしない | 仕様 §5.3 |

---

## 2. 自律実行プロトコル(承認待ちを作らない仕組み)

### 2.1 事前承認(発注者 → 実装者)

発注者は、この計画書を実装者に渡すことで以下を**事前に承認**する。実装者は以下について発注者に確認しない。

| 承認 | 内容 | 仕様の該当箇所 |
|---|---|---|
| P-01 | `config/api_budget.yaml` の上限内での AppTweak API 呼び出し(run 2,000 / day 5,000 / total 16,000。2,000 はバッファとして使わない) | §6 |
| P-02 | 発注者が契約済みの J-Quants プランでの API 呼び出し(J-Quants は credit 制ではないため、レート制限順守のみ) | §5.2 |
| P-03 | **Mapping Human Gate(§64)の代行**。実装者が §5.3 の証拠規則に従って監査を行い、`audit/MAPPING_DECISIONS.csv` に1判断1行で根拠を残す。証拠が無いものは A にしない(除外)。監査完了条件(§4 Stage 3)を満たしたら発注者を待たずに次へ進む | §64, §65 |
| P-04 | **`unlock-holdout` の自動実行を1回だけ**。`freeze-candidates` が1つ以上の候補を凍結した直後に実行する。候補ゼロなら実行しない(holdout は閉じたまま) | §10, §55 |
| P-05 | 公式 IR / EDINET / TDnet / 公式ストアページ / 公式サイトへの読み取りアクセス(無料範囲) | §5.3 |
| P-06 | 無料ライブラリの追加、`pyproject.toml`・設定ファイル・テストの作成と修正 | §70 |
| P-07 | 作業ブランチへのコミットと push、最後の PR 作成(main へのマージは含まない) | D-06 |

### 2.2 実装者が絶対にしないこと

- 発注者に質問して待つこと(`AskUserQuestion` を含む)。判断が必要なら §2.3 の順に自分で決める。
- 仕様本文・`SPEC_SHA256.txt` の変更。必要なら `change_requests/SPEC_CHANGE_REQUEST_NNN.md` を書き、**仕様の厳格な読み方のまま続行**する。
- 上限を超える API 呼び出し、新規契約、プラン変更、有料サービスの利用。
- 生データのコミット、API キーの読み取り・表示・ログ出力。
- 結果を見てからのパラメータ・期間・銘柄・変換式の変更(§80)。

### 2.3 判断の優先順位(迷ったときの決め方)

1. 仕様に明記 → そのとおり。
2. 計画書 §5 の事前解釈に明記 → そのとおり。
3. どちらにも無く、**データ側の不明** → fail-closed(§3): 該当データを除外し、`audit/EXCLUSIONS.csv` に理由を1行残す。
4. どちらにも無く、**手順側の不明** → 「より保守的(サンプルが減る・利益が減る・遅く約定する)」方を選び、`change_requests/` に「解釈メモ」として残す。研究は止めない。
5. 仕様の STOP 条件(§82)に該当 → **正常終了**。`results/FINAL_VERDICT.md/.json` に VERDICT_0 と理由を書き、最終報告して終わる。STOP は失敗ではなく仕様どおりの結論である。

### 2.4 終了コード

| code | 意味 | 実装者の対応 |
|---|---|---|
| 0 | 正常 | 次ステージへ |
| 10 | STOP(仕様 §82 の終了条件・VERDICT_0 確定) | 最終報告して終了 |
| 20 | BUDGET_BLOCKED(見積が上限超過) | 実行しない。`API_COST_REPORT.md` を書く。履歴要件を満たす最小範囲で再見積(§4 Stage 1 の決定表) |
| 30 | BACKTEST_INVALID / LOOKAHEAD_FAIL | 修正して再実行(コードのバグ扱い)。修正できなければ STOP |
| 40 | DOCTOR_FAIL(環境・キー・API 到達不能) | キー未設定なら Stage 0 までで終了し、`RESUME_INSTRUCTIONS.md` を書く |
| 75 | BUDGET_DAY_EXHAUSTED | D-09 のとおり自己再開を予約 |

### 2.5 セッションをまたぐ運用

- 進捗は `results/PROGRESS.json`(stage, status, last_command, next_command, updated_at)に毎ステージ書く。新しいセッションはこれを読んで再開する。
- すべての CLI は**冪等・再開可能**に作る(取得済みの日付・コードはスキップ。ただし raw は上書きしない)。

---

## 3. 発注者が Opus 起動前に1回だけやること(事前確認)

これだけは実装者が代行できない。**やらなくても Stage 0(合成データでの完成)までは走る。**

1. 環境(Claude Code の environment / ローカルのシェル)に環境変数を設定する
   - `APPTWEAK_API_KEY` — AppTweak の無料トライアルキー
   - `JQUANTS_REFRESH_TOKEN` — J-Quants のリフレッシュトークン。**代わりに `JQUANTS_MAIL_ADDRESS` と `JQUANTS_PASSWORD`(ログイン情報)でもよい**
   - (任意)`EDINET_API_KEY` — EDINET API v2 の無料キー。無くても公式 IR ページから取る
2. J-Quants のプランを決める(**ここだけ課金判断が要る**。契約済みなら何もしない。プランが足りるかは `doctor` が自動判定する)
   - 研究に必要な履歴: **2018-01-01 以前 〜 2026-08-31** の日足・財務・上場銘柄一覧・取引カレンダー・TOPIX(仕様 §8/§9: TRAIN 48ヶ月 + VALIDATION 36ヶ月 + HOLDOUT 20ヶ月)
   - Free プランは履歴が短く(概ね直近2年・12週遅延)、**INSUFFICIENT_HISTORY → VERDICT_0 で終わる**。10年以上の履歴を含むプラン(公式サイトで現行の名称と料金を確認)が必要
   - 決めなくても Opus は止まらない。足りなければ VERDICT_0 と必要条件を残して終わる
3. AppTweak トライアルの credits 残高が 18,000 前後あることを確認する(不足していれば `config/api_budget.yaml` の `total` を実残高 − 2,000 に書き換えてから渡す)
4. `KICKOFF_PROMPT.md` の本文を Opus 5 に貼って開始する

---

## 4. ステージ計画

各ステージは「目的 / 成果物 / 受入基準 / 自律判断」を持つ。受入基準をすべて満たしたらコミット・push・`PROGRESS.json` 更新のうえ次へ進む。

### Stage 0 — 骨格と合成データでの全工程完成(API キー不要)

目的: 仕様 §69 の構造・§71 の CLI・§74 のテストを、**合成データで end-to-end に通す**。ここで研究ロジックの正しさ(特にルックアヘッド・holdout lock・打ち切り・point-in-time)を証明する。

成果物:
- `pyproject.toml`、`src/app_alpha/...`(§69 のディレクトリ)、`app-alpha` CLI(§71 の 17 コマンドすべて。未対応のものは明示的に `NOT_IMPLEMENTED` を返さず、合成データで動く実装まで作る)
- `config/research_spec.yaml`(仕様の数値・§5 事前解釈の数値を機械可読化)、`config/cost_model.yaml`、`config/api_budget.yaml`
- `src/app_alpha/synthetic/`: 合成データ生成器。iOS/Android の日次 Top200(2014〜2026、欠損日・深さ変化・上場廃止・publisher 譲渡・発売日を含む)、J-Quants 相当(上場マスタ月次スナップショット、日足 adjusted/raw、四半期財務、決算開示日時、カレンダー、TOPIX)。**乱数シード固定(20260904)**
- `tests/`: §74 の全項目 + §66 のデータ品質テスト + §67 ルックアヘッド・カナリア(rank / 財務 / ownership / 株価の4種) + §68 point-in-time assert + §6 credit cap
- `results/_synthetic/` に §76 の全ファイル(先頭に `data_origin: synthetic`)と `report.html`

受入基準:
- `pytest -q` 全 PASS。
- 合成データで `doctor → estimate-cost(dry) → build-app-registry → build-ownership-registry → audit-mapping → build-features → run-confirmatory → run-discovery → validate → freeze-candidates → unlock-holdout → run-holdout → report` が一気通貫で走る。
- ルックアヘッド・カナリア: 2024-01-01 以降の rank を全部 1 位に書き換えても、2023-12-31 以前の features/signals の parquet の SHA256 が**1つも変わらない**(財務・ownership・株価でも同様)。
- holdout lock: `--mode train_validation` で 2025-01-01 以降の株価・rank features を読もうとすると例外。`unlock-holdout` の記録(spec SHA / git commit / candidate SHA / timestamp)が `audit/HOLDOUT_UNLOCK.json` に残る。2回目の `unlock-holdout` は拒否される。
- `estimate-cost` が合成の「1リクエスト当たり credit」から総 credits を算出し、上限超過で終了コード 20 を返す。
- API クライアントは `httpx` ベースで、レスポンスをディスクに直接保存し、manifest(§73 の全項目)を書く。同一クエリ再取得で旧ファイルが残ることをテストで確認。

自律判断: 合成データの分布は「それらしければよい」。合成データの結果に意味は無いので**評価しない**。

### Stage 1 — doctor と Phase 0 プローブ(API キー必要)

目的: 仕様 §7。大量取得の前に、実データで「取れるか・いつから・いくらか」を確定する。

手順:
1. `app-alpha doctor`
   - キーの有無、AppTweak / J-Quants への到達、AppTweak 公式ドキュメントの Top Charts History エンドポイント・パラメータ名・Games の category ID・credit 単価を**ドキュメントから読んで** `config/research_spec.yaml` の値と突き合わせる(不一致 → 設定を直す。読めない → STOP 条件「API仕様不明」)。
   - J-Quants: 取引カレンダー、`listed/info` の日付指定、`prices/daily_quotes` を **code=7203 で 2017-12-01〜2018-01-31** 取得して履歴が届くかを見る(空 → INSUFFICIENT_HISTORY)。最新取得可能日も記録(遅延の把握)。
   - AppTweak の残 credits を API から取れれば取る。取れなければ `api_budget.yaml` の値を信じる。
2. `app-alpha probe-apptweak`
   - 2014〜2026 の各年 1/15 と 7/15、iOS/Android、`limit=10` で取得(最大 52 リクエスト)。加えて「最新日」と「取得できた最古日」で `limit=200` を各プラットフォーム1回ずつ(深さ確認)。
   - 各レスポンスの実 credit 消費を `data/manifests/credit_ledger.csv` に記録。
   - `results/DATA_FEASIBILITY.md`: 最古日・最新日・欠損期間・深さ・スキーマ・1リクエスト当たり credit。
3. `app-alpha estimate-cost`(決定表)
   - `c` = 実測の credits/(platform×day×limit=200)。日付範囲を1リクエストで取れる仕様なら、その単価で換算。
   - `B` = total 上限 − 使用済み。
   - `N_full` = 共通利用可能最古日〜2026-08-31 の日数 × 2 × c
   - `N_min` = 2018-01-01〜2026-08-31 の日数 × 2 × c
   - **N_full ≤ B → 全期間取得。N_full > B ≥ N_min → 2018-01-01 から取得(TRAIN はちょうど 48ヶ月)。N_min > B → 終了コード 20、`API_COST_REPORT.md` に必要 credits を書き、VERDICT_0 で終了。**

受入基準: `DATA_FEASIBILITY.md`、`API_COST_REPORT.md`(見積と実測)、`credit_ledger.csv` が揃い、決定表の結論が明記されている。

自律判断:
- 共通利用可能最古日(§5 I-02)が 2018-01-01 より後 → INSUFFICIENT_HISTORY → VERDICT_0。
- J-Quants の履歴が 2018-01-01 に届かない → VERDICT_0(理由: J-Quants plan)。
- 深さが期間によって 200 未満 → `STRUCTURAL_BREAK_FLAG` を期間つきで記録し、続行(§5 I-04)。

### Stage 2 — Phase 1: Top Grossing 履歴の取得

目的: 決定表の範囲で iOS/Android の日次 Top200 を取得し、raw を immutable に保存する。

手順: `app-alpha ingest-ranks --platform iphone|android --from --to`。日付ごと(または API が許す範囲ごと)に `data/raw/apptweak/<platform>/<date>__<retrieved_at>.json` + manifest。失敗は3回リトライ後 `DATA_MISSING` として `data/manifests/missing_days.csv` に記録(0 で埋めない)。実行前に必ず dry-run で当該 run の見積を出し、run/day/total の3上限を超えるなら実行しない。日次上限に達したら終了コード 75 → D-09。

受入基準: 対象期間の取得率 ≥ 97%(両プラットフォーム)。未満なら不足期間を `DATA_FEASIBILITY.md` に追記し、§5 I-02 の「利用可能」判定で期間を狭める(狭めた結果 TRAIN < 48ヶ月なら VERDICT_0)。`results/DATA_QUALITY.md` の rank 部分(重複日・重複 app・順位範囲外・暦日ギャップ・ストアギャップ)。

### Stage 3 — Phase 2: App 登録簿・経済的帰属登録簿・Mapping 監査(P-03 で代行)

目的: 仕様 §11〜§17, §63〜§65。v0.1 で最も重要な手作業を、証拠付きで実装者が行う。

3-a. App 登録簿(`registry/apps.parquet`)
- 取得した全 Top200 履歴から store_app_id を抽出(現在の有名タイトルを手で選ばない)。first_seen/last_seen はストア別。
- iOS/Android の同一ゲーム統合(共通 `app_entity_id`)は §5 I-05 の規則のみ。タイトル名だけでの自動 merge 禁止。
- verified_release_date: 公式ストアの release date メタデータ、または公式プレスリリース(日付つき)が取れたものだけ `release_confidence=A`。無ければ `UNKNOWN`(first_seen を代用しない)。
- `registry/launches.parquet`: 公式 IR(決算説明資料・プレスリリース)で「当年度の重要タイトル」と明記された発売を `major_launch_confidence=A` で登録。集められた件数を `audit/LAUNCH_REGISTRY_COVERAGE.md` に書く。

3-b. 経済的帰属登録簿(`registry/ownership_history.parquet`)と監査
- 監査対象の優先順位: **2024-12-31 以前**の累積 AppPower(仮に全 app を 1 とみなした単純合計)で app_entity を並べ、上から順に処理する(holdout 期間の rank を優先順位づけに使わない。ただし 2025 年以降に初登場した app も同じ規則で必ず処理する。マッピングは backtest より前に完了させる)。
- 処理範囲(上限): (a) 累積 AppPower シェア 0.1% 以上の app_entity 全部、かつ (b) 最大 600 entity。それ以降は `UNRESOLVED(tail)`。
- 1 app_entity につき `audit/MAPPING_DECISIONS.csv` に1行: 判断(A/B/C/UNRESOLVED)、listed_company_code、relationship_type、effective_from/to、証拠 URL、証拠の引用(原文 200 字以内)、retrieved_at、証拠ファイルの sha256(`data/raw/official_ir/` に保存)。
- A の判定規則(§5 I-06)。連結子会社経由の帰属は「上場会社の有報の関係会社一覧または公式グループ会社ページ」で連結を確認できた場合のみ A。
- publisher 譲渡・子会社売却・上場廃止は公式開示の日付で effective_from/to を切る。日付が分からなければ、その app の当該期間は UNRESOLVED(現在の publisher を過去へ backfill しない)。
- `audit/UNRESOLVED_OWNERSHIP.csv`(§64 の6区分を列に持つ)を生成。

3-c. 会社登録簿・重要性(`registry/companies.parquet`, `registry/materiality_history.parquet`)
- listed_company_code は J-Quants の上場マスタ(Stage 4)で検証する。Stage 3 では公式 IR に書かれた証券コードを暫定登録し、Stage 4 で不一致なら UNRESOLVED に落とす。
- 重要性(U2 判定)は §5 I-07 の規則。対象会社の優先順位は A-mapped 累積 AppPower の上位 40 社まで。それ以降は `UNKNOWN`(U1 のみ)。

3-d. カバレッジ(§65)
- 会社ごとに known / A / B・C / unresolved の app 数と、PortfolioPower のうち A で説明できる比率(B・C・UNRESOLVED を含めた全 app の合計に対する A の比率)。80% 未満の会社は U2 から除外。
- `results/MAPPING_AUDIT.md`, `results/UNIVERSE.md`(U1/U2 の会社一覧、期間、除外理由)。

受入基準(= Human Gate を代行して通過してよい条件):
1. 処理範囲(上限)まで全件に判断が付いている(UNRESOLVED も理由つき)。
2. A のすべてに公式証拠の URL・引用・sha256 がある(欠けた A は自動的に UNRESOLVED へ落とすテストが通る)。
3. U2 会社数 ≥ 6(U2 の定義を満たす期間が TRAIN+VALIDATION 内に 1 四半期以上ある会社)。**未満 → STOP(§82)→ VERDICT_0**。
4. データ品質テスト(ownership overlap / impossible launch date)が PASS。

自律判断: 証拠が公式でない・見つからない・矛盾する → A にしない。「有名だから A」は禁止。判断に 15 分以上かかる 1 entity は UNRESOLVED にして先へ進む(その旨を理由に書く)。

### Stage 4 — Phase 3: J-Quants 取得

目的: 仕様 §5.2/§16。上場廃止を含む point-in-time の市場データ。

手順: `app-alpha ingest-jquants`
- `markets/trading_calendar`(全期間)、`indices/topix`(全期間)
- `listed/info` を **各月の最初の営業日**でスナップショット(2017-01〜実行月)。上場状態は §5 I-08 で判定。
- `prices/daily_quotes` を **U1 候補会社 + Game Basket 候補(U1 全体)** の code ごとに全期間。adjusted と raw の両方が同じレスポンスにある前提。無ければ両方を保存できる形で取得。
- `fins/statements` を同 code ごとに全期間(開示日・開示時刻・期間種別・期間開始/終了・売上・営業利益・予想修正の別)。
- raw は immutable、manifest 必須。レート制限は指数バックオフで順守。

受入基準: `DATA_QUALITY.md` の株価部分(負の出来高・欠損 OHLC・上場期間外の ticker・会計四半期の不整合・非営業日約定)。上場マスタ検証で code が確認できない会社は UNRESOLVED へ。

### Stage 5 — Phase 4: 特徴量構築

目的: 仕様 §18〜§23, §31, §32 の features を **point-in-time** で作る。

- `RankPower`, `AppPower`(§5 I-03 のプラットフォーム配信判定)、`PortfolioPower(c,t)`(A のみ、point-in-time ownership)。
- Family B: 会社ごとの実会計四半期(§5 I-09)、Day60 QTD、前年同期 Day60、B_RAW、rolling 8Q robust Z。Discovery 用に Day45/75 も同時計算(confirmatory は 60 のみ使用)。
- Family A: LAUNCH_AUC3/7、過去コホートのパーセンタイル(D0 より前の launch だけ)。
- Family C: app 年齢 ≥ 90 日、prior 60 暦日の median/MAD(当日を含めない)、C_Z、会社 PortfolioPower の 60 日 median 比。
- Family D: Current7、Baseline60、D_RATIO、rolling robust Z(§5 I-11)。
- すべての feature 行に `feature_timestamp`(known-at、§5 I-01)を持たせ、§68 の assert を build 時と backtest 時の両方で走らせる。
- `--mode train_validation` が既定。holdout 期間の rank/株価/財務は読み込み層で遮断。

受入基準: 実データでルックアヘッド・カナリア 4 種 PASS、point-in-time assert 違反 0、`DATA_QUALITY.md` 完成。

### Stage 6 — Phase 5: Confirmatory backtest(TRAIN + VALIDATION)

目的: 仕様 §24〜§40 の固定ルールを、変更せず走らせる。

- `app-alpha run-confirmatory --mode train_validation`。Family A(Success のみ。Failure は launch registry が §5 I-12 の条件を満たすときだけ)、B(LONG 実行、NEGATIVE は研究記録)、C、D(研究のみ)。
- U2 を Primary、U1 を robustness として両方出す。
- 約定: entry = known-at 後の次の TSE 寄付(§5 I-01)、exit = 各 Family の規則(B は §5 I-10)。adjusted 価格で return、raw で ADV20 と capacity(§38)。
- gross / net50 / net75 / net100、Raw と Abnormal(TOPIX 差、Game Basket 差 §5 I-14)。
- §33 汚染フラグ(取れるものだけ。取れないものは `UNAVAILABLE` と明記 §5 I-13)、ISOLATED_ALPHA サブサンプル。
- §27 Fundamental validation(U2): 売上成長・営業利益成長 ~ B_Z + 会社FE + 会計四半期FE、2-way cluster SE(§5 I-15)、decile(サンプル不足なら quintile/tertile)の単調性。
- §50 月次ブロック・ブートストラップ(10,000 回、シード固定)、§52 集中度テスト、§75 の破壊的テスト(robustness としてすべて実行し、結果はそのまま報告)。
- 結果: `FAMILY_{A,B,C,D}_CONFIRMATORY.csv`、`CONCENTRATION_TESTS.csv`、`COST_STRESS.csv`、`LIQUIDITY_STRESS.csv`。

受入基準: 4 Family とも TRAIN と VALIDATION を分けて出力。サンプル数(§51 を ≥ と読む §5 I-16)未満は `INSUFFICIENT_SAMPLE` を明記。**結果が悪くても何も変えない。**

### Stage 7 — Phase 6: 有限 Discovery(TRAIN のみで候補抽出)

- `app-alpha run-discovery --mode train_validation`。§42〜§45 の grid のみ(B 27 / A 12+8 / C 27 / D 27 = 101 ≤ 120)。追加パラメータ生成禁止。
- 各 config について TRAIN と VALIDATION の両方を**同時に計算して保存する**が、**候補選択は TRAIN の結果だけを見て行う**(§47 の最低条件)。VALIDATION の値は Stage 8 まで判断に使わない(コード上、`validate` コマンドだけが VALIDATION 列を読む)。
- `DISCOVERY_GRID_ALL.csv`、`MULTIPLE_TESTING.csv`(BH-FDR q≤0.10 は TRAIN の月次ブロック・ブートストラップ p 値に対して。DSR、PBO は §5 I-17)、`PARAMETER_STABILITY.csv`(§5 I-18)。

### Stage 8 — Phase 7: Validation と候補凍結

- `app-alpha validate`: Family ごとに §48 の 6 条件をすべて満たす config を列挙し、複数あれば §5 I-19 の決定的タイブレークで**1つ**に絞る。Sharpe 最大を理由にしない。
- `results/VALIDATION_REPORT.md`: Family ごとに「候補あり(config と根拠)/ 候補なし(どの条件で落ちたか)」。
- `app-alpha freeze-candidates`: 候補の rule を JSON 化し SHA256 を `audit/CANDIDATES_FROZEN.json` に記録、コミット。

### Stage 9 — Phase 8: Holdout(1回限り、P-04 で自動)

- 候補が 1 つ以上 → `app-alpha unlock-holdout`(記録 4 項目)→ `app-alpha run-holdout`。候補ゼロ → holdout を開かず Stage 10 へ。
- Holdout ではパラメータを一切変えない。結果は `HOLDOUT_REPORT.md`(§55 の全項目)。
- **Holdout 後の修正は v0.1 では行わない。**気づいた改善点は `change_requests/V02_PROPOSALS.md` に書く。

### Stage 10 — 最終判定とレポート

- `app-alpha report`: `FINAL_VERDICT.md/.json`、`results/report.html`(§77 の項目、最後に VERDICT 名を大きく表示。VERDICT_0 は "DATA NOT FEASIBLE" と表示する §5 I-20)。
- 判定は §5 I-21 の決定手順で機械的に決める。「promising」等の語は使わない。
- §83 の Q1〜Q9 に、それぞれ 1〜3 文で答える節を `FINAL_VERDICT.md` に置く。

### Stage 11 — Phase 9: Paper mode

- `app-alpha paper-signal` は Stage 0 で実装済み(CLI 一覧に含まれるため)。VERDICT_5 のときだけ、`results/PAPER_MODE_SETUP.md` に日次運用手順(10:15 JST 以降に実行、NEXT OPEN 併記、§79 の記録項目)を書く。VERDICT_5 でなければ「未起動」と明記。
- 日次の自動実行(Routine 等)は **credits を継続消費するため v0.1 では設定しない**。手順書だけ残す。発注者が起動を決める。

### 最終報告(発注者へ)

実装者が最後に発注者へ返す報告は以下の形式のみ。

1. **VERDICT**(1行)と、その決め手(3行以内)
2. 到達ステージと、STOP した場合はその条件
3. 変更ファイル一覧(コミット範囲)と PR の URL
4. 確認方法(実行コマンド 3〜5 行)
5. 残っているリスク(証拠が弱い mapping、UNAVAILABLE のフラグ、カバレッジ、履歴の長さ)
6. `change_requests/` の一覧(あれば)

---

## 5. 仕様の事前解釈(実装者はこれを `config/research_spec.yaml` の `interpretations` に転記する)

| ID | 仕様 | 解釈(固定) |
|---|---|---|
| I-01 | §25, §78 known-at | ランキング日 D のデータの known-at = **D+1 10:15 JST**。entry は known-at より後に始まる最初の TSE 営業日の寄付(通常 D+2 の寄付。D+1 が営業日でも D+1 寄付は使わない)。J-Quants の財務データの known-at = 開示日の開示時刻(無ければ開示日 23:59 JST)。株価の known-at = 当日 15:30 JST(2024-11-05 より前は 15:00 JST)。 |
| I-02 | §8/§9 共通利用可能最古日 | iOS・Android それぞれで「その日以降 90 暦日の取得成功率 ≥ 95%」を満たす最初の日の、**遅い方**。この日を勝手に前へ延ばさない。 |
| I-03 | §19 プラットフォーム配信判定 | store 別に、`verified_release_date`(A のとき)または `first_seen` から、`delisted_date` または `last_seen + 30 日` までを「配信中」とみなす。配信中で Top200 に無い日 = 0、その日の当該 store の取得が DATA_MISSING = NA。片方が NA・片方が観測なら **NA**(平均しない)。 |
| I-04 | §12/§61 深さ < 200 の期間 | 返却深さ d < 200 の日は、順位 d+1〜200 が観測不能なので、その日にリストに無い app は **NA**(0 にしない)。当該期間に `STRUCTURAL_BREAK_FLAG`。 |
| I-05 | §13 iOS/Android 統合 | 自動統合は「正規化した販売元名が一致 かつ 正規化したタイトルが一致」のときのみ。それ以外は公式サイトに両ストアのリンクがある等の公式証拠があるときだけ統合(証拠を `MAPPING_DECISIONS.csv` に残す)。証拠なし = 別 entity のまま(同一会社に A で帰属していれば PortfolioPower 上は同じ結果になる)。 |
| I-06 | §14 Mapping A の規則 | 次のいずれかを公式資料で確認: (1) ストアの販売元 = 上場会社本体、(2) 販売元 = 上場会社の連結子会社(連結は有報「関係会社の状況」か公式グループ会社一覧)、(3) 上場会社の IR がそのタイトルを自社(連結)タイトルとして売上に計上していると明記。共同開発・共同運営・レベニューシェア・持分法関連会社経由・IP ライセンス供与元(供与先が別会社)は **B**。名称・IP からの推測は **C**。 |
| I-07 | §17 U2(重要性 20%) | 会社ごとに年度単位。signal date より前に開示された最新の有報または決算短信(セグメント情報)から、モバイルゲーム関連セグメント売上 ÷ 連結売上 ≥ 20% を確認できた年度から次の開示までを U2 期間とする(`effective_from` = 開示日)。セグメントが「ゲーム」でモバイル比率が分離できない場合、同資料に「モバイル/スマートフォン向けが主」等の**定量記述**(比率・金額)があれば採用、定性的記述のみなら UNKNOWN。 |
| I-08 | §16 上場状態 | 月初営業日スナップショットで、signal date の直前と直後の両スナップショットに存在(直後が無い場合は最新スナップショットに存在)して初めて「上場中」。片方でも欠ければ上場中と扱わない。 |
| I-09 | §21 会計四半期 | J-Quants statements の期間開始日から、四半期 k の開始 = 期首 + 3(k−1) ヶ月。四半期長が 3 ヶ月 ± 5 日から外れる四半期(決算期変更等)は「fiscal quarter 不明」として除外。Day1 = 四半期開始日、Day60 = 開始日 + 59 暦日。 |
| I-10 | §21/§22/§26 Family B の計算と exit | QTD_POWER は Day1〜Day60 の PortfolioPower の合計。NA 日が 60 日中 3 日以下なら合計 × 60 / 観測日数として `partial_coverage` フラグ、4 日以上なら NA(当期・前年同期とも同じ規則)。NEW_MONETIZATION_REGIME = `PY_QTD_POWER < 10.0`。rolling は直前 8 四半期の B_RAW(当期を含まない、8 個すべて非 NA)。exit = 当該四半期の決算開示後の最初の TSE 引け。開示時刻が取れて場中(15:30/15:00 より前)なら当日引け、それ以降または時刻不明なら翌営業日引け。80 営業日で強制 exit。 |
| I-11 | §31/§32 Family C/D | C: 「PortfolioPower も +30%」= 当日値 ≥ 1.3 × 直前 60 暦日の median。D: Current7 = 直近 7 暦日の平均、Baseline60 = その直前 60 暦日の median、D_Z は D_RATIO の対数を直前 250 暦日の rolling median/MAD で標準化(当日を含めない)。3 暦日連続。研究用 entry は 3 日目の known-at 後の次寄付。 |
| I-12 | §30/§63 Family A Failure の実行条件 | `registry/launches.parquet` の `major_launch_confidence=A` が **30 件以上かつ 6 社以上** のときだけ実行。未満は `FAMILY_A_FAILURE_NOT_RUN(registry incomplete)`。 |
| I-13 | §33 汚染フラグ | J-Quants から取れるもの: earnings announcement、earnings revision(業績予想修正の開示)、stock split(調整係数 ≠ 1)。取れないもの(M&A、増資、自社株買い、TOB、訴訟、大株主、売買停止、ストップ高安、TSE システム)は `UNAVAILABLE` として列を残す。ISOLATED_ALPHA は取れるフラグだけで作り、名称を `ISOLATED_ALPHA_PARTIAL` とし、使ったフラグを明記する。 |
| I-14 | §35 Game Basket | その日 U1 に属し上場中の銘柄(対象銘柄自身を除く)の等ウェイト日次リターン。構成銘柄 < 5 の日は basket 差分を NA。 |
| I-15 | §27 回帰 | 四半期単独の売上 = 累計値の差分(Q1 はそのまま)。売上成長 = ln(Rev_q / Rev_{q−4})。営業利益成長 = (OP_q − OP_{q−4}) / Rev_{q−4}(赤字対応)。2-way cluster は Cameron–Gelbach–Miller(V_company + V_quarter − V_intersection)を statsmodels の cluster 共分散 3 回で構成。主指標は売上成長、副指標は営業利益成長。§58 の「関係しない」= 売上成長の係数が正でない、または decile 単調性(Spearman ρ ≤ 0)。 |
| I-16 | §51 サンプル数 | 「= 60」等は「≥ 60」と読む。 |
| I-17 | §49 DSR / PBO | DSR は Bailey & López de Prado (2014) をトレード単位リターンで計算(試行数 = その Family の grid 数)。PBO は CSCV(S=16)。Family のプールしたトレード数 < 160 または config 数 < 8 なら `PBO_UNAVAILABLE`。 |
| I-18 | §53 パラメータ安定性 | 選択 config の「1 パラメータだけ隣に動かした config」全部について、TRAIN と VALIDATION の両方で Net50 平均が同符号のものが過半数なら PASS。 |
| I-19 | §48 タイブレーク | 条件を満たす config が複数なら、(1) 隣接同符号数が多い、(2) 最大 1 社集中度が低い、(3) サンプル数が多い、(4) それでも同点なら grid の定義順で先のもの。Sharpe は使わない。 |
| I-20 | §77 HTML の最終表示 | VERDICT_0〜5 の名称をそのまま表示(§77 の 5 語に加え "DATA NOT FEASIBLE" と "OUT OF SAMPLE ALPHA BUT NOT ROBUST" を許容)。 |
| I-21 | §84 判定手順 | 順に評価し最初に該当したもの: (0) §82 の STOP 条件 → VERDICT_0。(1) Family B の §27 が U2 で不成立(I-15) → VERDICT_1。(2) 全 Family・全 config が §47 の TRAIN 最低条件を満たさない → VERDICT_2。(3) TRAIN は満たすが `validate` で候補ゼロ → VERDICT_3。(4) Holdout で Net50 > 0 だが §56 の 13 条件のいずれかが不成立 → VERDICT_4。Holdout Net50 ≤ 0 も VERDICT_4 とする(仕様に「Holdout 失敗」の専用判定が無いため。理由を明記)。(5) §56 の 13 条件すべて PASS → VERDICT_5。 |
| I-22 | §9/§10 期間境界 | トレードの所属期間は **entry 日**で決める。train_validation モードで exit が 2025-01-01 以降になるトレードは 2024 年最終営業日の引けで強制 exit し `TRUNCATED_AT_LOCK` を付ける。Holdout 実行時もこの VALIDATION トレードを再計算しない(VALIDATION 結果は不変)。 |
| I-23 | §38 ADV20 | entry 日を含まない直前 20 営業日の raw 売買代金(終値 × 出来高)の平均。OrderValue = 1,000,000 円(感応度 500,000 / 3,000,000)。 |
| I-24 | §36/§55 指標の定義 | トレード net return = 寄付→引けの adjusted 価格リターン − コスト(50/75/100bp)。Sharpe(主)= トレード単位: mean/sd × √(年間平均トレード数)。副として日次等ウェイト・ブックの時系列 Sharpe。Profit factor = 利益合計 / |損失合計|。Max drawdown = entry 日順の累積 net return の最大下落。 |
| I-25 | §7 プローブ日 | 各年 1/15 と 7/15。休日でもランキングは存在するので日付は動かさない。 |
| I-26 | §10 `–mode` | 仕様の "–mode" は `--mode` のこと。 |

---

## 6. 技術設計の要点

- **読み込み層で守る**: `src/app_alpha/point_in_time/` に `Clock(decision_ts)` と `HoldoutGuard(mode)` を置き、rank・株価・財務・ownership のすべてのローダはこの 2 つを通してしか読めない。features/backtest がファイルを直接開くことをテストで禁止(grep テスト)。
- **known-at 列**: すべての processed テーブルに `known_at`(UTC)を持たせ、`feature_timestamp = max(依存行の known_at)` を伝播させる。§68 の assert はここで機械的に行う。
- **raw immutable**: ファイル名に `retrieved_at` を含め、`open(..., "x")` で作る。manifest は `data/manifests/<source>/<sha256>.json`。
- **credit ledger**: すべての AppTweak 呼び出しを 1 行ずつ記録(endpoint, params, credits_reported, credits_estimated, retrieved_at)。3 つの上限は「実行前に見積 + 実行後に実測」の両方で検査。上限超過が見つかったら以後の呼び出しを拒否。
- **holdout lock**: `audit/HOLDOUT_UNLOCK.json` の存在で判定。存在しない限り `--mode holdout` は起動できない。存在すれば `unlock-holdout` は拒否。
- **決定性**: 乱数シードは `research_spec.yaml` に 1 か所。すべての出力 parquet は列順・行順を固定し SHA256 を manifest に記録(ルックアヘッド・カナリアの比較に使う)。
- **合成データと本番の分離**: `APP_ALPHA_DATA_ROOT` 環境変数でルートを切り替える。合成は `data_synthetic/`、本番は `data/`。results も同様に `results/_synthetic/` と `results/`。

---

## 7. テスト計画

| 種別 | 内容 | 時期 |
|---|---|---|
| unit | §74 の 18 項目 | Stage 0 |
| data quality | §66 の 12 項目(合成に意図的な不良を入れて検出を確認) | Stage 0、実データで Stage 2/4/5 |
| lookahead canary | §67 rank / 財務 / ownership / 株価の 4 種(未来書き換え前後の parquet SHA 比較) | Stage 0(合成)、Stage 5(実データ) |
| point-in-time | §68 assert(違反 1 件で BACKTEST_INVALID) | 常時 |
| destructive | §75 の 12 項目(robustness としてレポートに載せる) | Stage 6 |
| API safety | credit cap 3 種、dry-run 必須、raw 上書き不可、キー非表示(ログとレポートの全文 grep でキー文字列が出ないこと) | Stage 0 |
| holdout lock | 遮断・1 回限り・記録 | Stage 0 |

---

## 8. 成果物

仕様 §76 の全ファイル + 以下。

- `results/PROGRESS.json`(再開用)
- `results/RESUME_INSTRUCTIONS.md`(キー未設定・日次上限で中断したときの再開手順)
- `audit/MAPPING_DECISIONS.csv`, `audit/UNRESOLVED_OWNERSHIP.csv`, `audit/EXCLUSIONS.csv`, `audit/LAUNCH_REGISTRY_COVERAGE.md`, `audit/HOLDOUT_UNLOCK.json`, `audit/CANDIDATES_FROZEN.json`
- `results/report.html`(1 枚)
- `change_requests/`(あれば)

`FINAL_VERDICT.json` の最小スキーマ:

```json
{
  "spec_sha256": "...",
  "code_commit": "...",
  "verdict": "VERDICT_2",
  "verdict_name": "FUNDAMENTAL_EDGE_ONLY",
  "decided_by_rule": "I-21 step 2",
  "stop_condition": null,
  "families": {"A": {...}, "B": {...}, "C": {...}, "D": {...}},
  "holdout_opened": false,
  "data_origin": "real",
  "generated_at": "2026-..."
}
```

---

## 9. 完了の定義

以下のどちらかで「走りきった」とする。

- **通常完了**: Stage 10 まで到達し、`FINAL_VERDICT.json` に VERDICT_1〜5 のいずれかが書かれ、PR が作られている。
- **STOP 完了**: Stage 1〜5 のいずれかで §82 の条件に該当し、`FINAL_VERDICT.json` に VERDICT_0 と条件・不足内容・必要コストが書かれ、PR が作られている。

どちらでもない状態(キー未設定で Stage 0 止まり、日次上限待ち)は「中断」であり、`RESUME_INSTRUCTIONS.md` と `PROGRESS.json` を残す。

---

## 10. 既知のリスクと限界(正直に書く)

1. **AppTweak の履歴の深さ**: 2014 年まで遡れる保証はない。共通最古日が 2018 年より後なら VERDICT_0 で終わる。
2. **credit 単価が未知**: Top Charts History の credit 消費が高いと、最小範囲(2018〜)でも 16,000 credits に収まらない可能性がある。その場合も VERDICT_0(必要 credits を報告)。
3. **J-Quants プラン**: Free では履歴不足。発注者が契約しなければ VERDICT_0。
4. **Mapping の保守性**: 実装者は公式証拠のあるものしか A にしないため、カバレッジが 80% に届かず U2 が 6 社未満になり得る。これは STOP(VERDICT_0)で、研究の失敗ではなく「データ不足」。
5. **汚染フラグの欠落**: M&A・増資フラグは無料ソースで過去分を取れない(TDnet の無料検索は直近 1 か月のみ)。ISOLATED_ALPHA は部分的にしか作れない。
6. **Family A Failure**: launch registry を公式 IR から十分に集められる可能性は低く、実行されない見込み。
7. **Holdout 終端**: J-Quants の遅延により 2026-08-31 まで揃わない場合、揃った最終日までを Holdout とし、レポートに明記(12 ヶ月以上は確保できる)。
8. **1 セッションで終わらない**: 日次 credit 上限により、Stage 2 は少なくとも 2 日にまたがる。自己起床の手段が無い環境では、発注者が翌日に `KICKOFF_PROMPT.md` の「再開」文を貼る必要がある(これは承認ではなく再起動)。
9. **日本ストア限定**(§62)。海外比率の高い会社は過小評価される。結論に「世界需要と無関係」とは書かない。

---

## 11. v0.2 送り(v0.1 では触らない)

Short 実行、Combined portfolio、Revenue Estimate(§59 の条件を満たしたときのみ検討)、海外ストア、TDnet 有料履歴による汚染フラグ完備、Holdout 後の改善案(`change_requests/V02_PROPOSALS.md`)。
