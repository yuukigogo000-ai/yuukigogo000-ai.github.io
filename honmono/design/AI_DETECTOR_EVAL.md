# 画素ベースAI画像判定 — 公開モデル実測比較と搭載可否(2026-08-17)/ 自前学習モデル v2 の結果(2026-08-18 追記)

来歴チェッカーの「メタデータが消された画像には沈黙する」弱点を埋めるため、
**画像そのもの(画素)からAI生成かを判定する公開モデル**をブラウザ搭載候補として実測した記録。

## 結論(先に)

- 無料公開モデル **9本中8本は実用不可**(実写を10〜88%の割合でAIと誤判定、または最新生成器をほぼ見逃す)
- **1本だけ合格水準**: `haywoodsloan/ai-image-detector-deploy`(Swin v2 Large・2025-06)
  - 実写をAIと誤判定 **3.7%**(しきい値0.95で1.8%)、AIと言った時の的中率 **94〜97%**、AIの見逃し ~40%(最新生成器で多い)
  - int8量子化(199MB)後も精度維持。ブラウザ内(onnxruntime-web / WASM)で **1.5秒/枚**、Python版と判定一致 97.5%
  - **ただしライセンス未記載** → 再配布(当サイトでの同梱)は許諾が取れるまで行わない
- 現状の公開状態(2026-08-18更新): **自前学習モデル HONMONO v2 を同梱して有効化**(下の追記)。借り物モデルは同梱していない

## 追記(2026-08-18): 自前学習モデル HONMONO v2 を搭載した

借り物モデルの作者が13か月無応答(HF Discussions #3/#5/#6)のため、**自前でモデルを学習して同梱**した。重みは自前(再配布の問題なし)。

### 結果(同じ外部545枚・学習には一切使っていない・int8 ONNX 90MB)

| モデル | AUC | 実写誤警報 FPR | AI検出 recall | 的中率 prec | tellif AUC | faces recall |
|---|---|---|---|---|---|---|
| **HONMONO v2**(Swin v2 base・自前・**しきい値0.925**) | **0.929** | **2.2%** | 61.5% | 96.6% | 0.894 | 20% |
| 借り物 haywoodsloan int8(しきい値0.9・比較用) | 0.897 | 2.6% | 62.3% | 96.0% | 0.895 | — |
| 公開ライセンス品の最良(Ateeqq SigLIP2) | 0.737 | 18.4% | 57.5% | — | 0.647 | — |
| HONMONO v1(1回目・参考) | 0.818 | 5.1% | 53.1% | 91.2% | 0.849 | 0% |

しきい値別(v2 int8・ALL): 0.90→FPR 5.9%/recall 71.1% ・ 0.92→2.9%/63.4% ・ **0.925→2.2%/61.5%** ・ 0.93→1.5%/57.1% ・ 0.94→0.7%/40.7%。
出力確率はラベルスムージングの影響で最大0.95付近に張り付く(0.95以上はほぼ出ない)。**しきい値はこの545枚を見て選んでいる**(借り物モデルの0.9も同様)ので、未知データでは誤警報がこれより高く出る前提で読むこと。

生成器別(tellif・しきい値0.925・当てた数/枚数): Gemini 2.5 Flash Image 8/18, Hunyuan 2.1 7/11, HiDream 6/9, Seedream v4 5/20, Qwen-Image 5/12, Imagen 4 4/9, Wan 2.2 4/8, Ideogram v2 3/9, FLUX Pro 1.1 ultra 1/9, Recraft v3 1/9, SD3.5 large 0/9。**2025年世代はまだ半分以上見逃す**。

ブラウザ実装との一致(Edge/WebGPU・80枚): 平均|差| 0.005・判定一致 100%・約0.8秒/枚(読込後)。

### 学習の中身(正本: `AI_WORKSPACE/honmono_train/README_TRAIN.md`)

- データ: 公開データセット31本から **AI 42,411 / 実写 32,920 枚**(評価4セットの出所は不使用)。両クラス同一前処理(最大512px・JPEG q92)。増強=縮小拡大・切り出し・反転・ぼかし・ノイズ・JPEG再圧縮(SNS経由の劣化を模す)。実写側の誤りに重み1.5
- 1回目(3.7万枚)は AUC 0.82 で不合格 → 見逃しが2025年世代の生成器に集中していた → Rapidata の t2i 選好ペア(Imagen4/Seedream3/Recraft3/FLUX2/Ideogram2/HiDream + 相手17モデル)・nano-banana(Gemini)・FLUX 1.1 Pro 人物・StyleGAN顔(TPDNE)+ 実写(FFHQ/COCO/Flickr/bm-real)を追加して2回目 → 合格線
- チェックポイント選択は「学習から外した収集元(oip=AI / flickr8k=実写・3,910枚)」の AUC−2×FPR で行い、外部545枚は報告にのみ使用
- 学習環境: RTX 5060 Laptop 8GB・bs 8・bf16・4 epoch・約2.6時間

### ライセンス(重要・有料化前に要対応)

重み自体は自前だが、**学習データには非商用条件・条件不明のデータセットが含まれる**(Flickr30k, CelebA-HQ, FFHQ(CC BY-NC-SA), JourneyDB, MJHQ-30K, ELSA_D3, bm-real, Hemg系 など。一覧=`design/dataset_licenses.json`)。Rapidata系は CDLA-Permissive-2.0、nano-banana/ehristoforu/TPDNE/julienlucas は MIT、open-image-preferences は Apache-2.0。
日本の著作権法30条の4は情報解析目的の学習を許容するが、データセット利用規約(契約)の観点は別 → **無料提供の間はこのまま。有料化する場合は非商用/不明の源を除いた v3 を再学習してから**(README_TRAIN.md に手順)。

## 評価セット(545枚)

| セット | 内容 | AI | 実写 |
|---|---|---|---|
| mj6 | `zelus82/midjourney-vs-real-full-analysis` — Midjourney v6 vs 実写 | 60 | 60 |
| tellif | `tellif/ai_vs_real_image_semantically_similar_eval` — 2025年の最新生成器(Seedream v4, FLUX Pro, Gemini 2.5, Imagen 4, Ideogram v2, Recraft v3, SD3.5 等)と意味的に似た実写のペア | 123 | 122 |
| eddy | `eddyfox8812/ai-vs-real-2k-images`(test) | 50 | 50 |
| faces | `TheKernel01/140k-Real-and-Fake-Faces`(StyleGAN顔・256px) | 40 | 40 |

指標: acc=正解率 / AUC / **FPR=実写をAIと誤判定した率(最重要・低いほど良い)** / recall=AIを見つけた率。すべて「AI」確率のしきい値0.5(注記あるものは別)。

## 結果一覧

| モデル | 形式 | 全体acc | AUC | **FPR** | recall | tellif AUC | faces FPR | 備考 |
|---|---|---|---|---|---|---|---|---|
| **haywoodsloan/ai-image-detector-deploy** | PyTorch fp32 | **78.7%** | **0.892** | **3.7%** | 61.2% | 0.889 | 7.5% | @0.95: FPR 1.8% / prec 96.9% / recall 57.5%。**ライセンス未記載** |
| 同上 int8 ONNX(自前変換) | ONNX int8 199MB | 79.4% | 0.897 | 4.4% | 63.4% | 0.895 | 7.5% | @0.9: FPR 2.6% / prec 96.0% / recall 62.3% |
| Ateeqq/ai-vs-human-image-detector | SigLIP2 (Apache-2.0) | 69.5% | 0.737 | 18.4% | 57.5% | 0.647 | 0.0% | 実写誤判定が多すぎる |
| Organika/sdxl-detector | Swin fp32 (CC-BY-NC) | 62.6% | 0.662 | 26.8% | 52.0% | 0.639 | 12.5% | 非商用のみ |
| onnx-community/SMOGY-Ai-images-detector | Swin q8 | 63.5% | 0.683 | 46.7% | 73.6% | 0.622 | 87.5% | 実写顔をほぼ全部AI扱い |
| onnx-community/ai-image-detection (capcheck) | ViT q8 | 58.3% | 0.642 | 75.7% | 92.3% | 0.572 | 87.5% | 何でもAI |
| prithivMLmods/AI-vs-Deepfake-vs-Real | ViT q8 | 51.9% | 0.686 | 81.6% | 85.3% | 0.537 | 12.5% | 較正崩壊 |
| prithivMLmods/AI-vs-Deepfake-vs-Real-Siglip2 | SigLIP2 | 39.3% | 0.353 | 27.9% | 6.6% | 0.294 | 2.5% | ランダム以下 |
| onnx-community/deepfake_vs_real_image_detection | ViT q8 | 49.7% | 0.514 | 11.4% | 11.0% | 0.570 | 47.5% | ほぼ見逃す |
| umm-maybe/AI-image-detector | Swin | 56.9% | 0.605 | 19.9% | 33.7% | 0.610 | 47.5% | 2023年モデル・世代遅れ |

### 合格モデルの生成器別の見逃し(tellif・しきい値0.5・当てた数/枚数)
seedream-v4 7/20 · flux-pro-1.1-ultra 1/9 · gemini-2.5-flash-image 8/18 · hidream-i1 8/9 · hunyuan-image-2.1 11/11 · ideogram-v2 2/9 · imagen4 5/9 · qwen-image 9/12 · recraft-v3 1/9 · sd3.5-large 3/9 · wan-2.2 4/8

→ **「AIと言った時はほぼ正しい。ただし最新の写実系生成器は半分以上見逃す」**。この性格に合わせ、UIでは
「AI生成の可能性が高い(≥0.9)/疑いあり(0.5〜0.9)/兆候は薄い(<0.5・ただし見逃しに注意)」の3段で、本判定とは別枠の「参考値」として表示する設計にした。

## ブラウザ実装の検証(ローカル・非公開)

- onnxruntime-web 1.27(`ort.min.js` + jsep WASM)を `honmono/vendor/ort/` に同梱
- モデルは 70MB 分割ファイルを結合して読み込み(GitHub の 100MB/ファイル制限対応)、Cache API で2回目以降は即時
- 前処理: 256×256 リサイズ(縦横比無視)→ /255 → ImageNet mean/std(学習時と同一)
- 検証: 評価画像80枚(4セット×AI/実写×10)で **Python版との判定一致 97.5%(しきい値0.9)/平均誤差 0.027**、
  ブラウザ側 FPR 2.5% / recall 57.5%、**1.45秒/枚(WASM・CPU・単一スレッド)**、初回読込+初回推論 5.4秒(ローカル)
- 実行環境: Windows 11 / Edge(headless)

## ライセンスと次の一手

- `haywoodsloan/ai-image-detector-deploy` は README にライセンス記載なし(HF上のメタデータも無し)。
  **同梱=再配布** になるため、作者の許諾が取れるまで公開しない
- **A. 作者に許諾を依頼**(推奨・即日可): HF の Discussions に投稿(文面は下記)
- **B. 自前学習**: 手元に RTX 5060 (8GB) あり。HF上の公開データセット(数十万枚)で Swin v2 / ConvNeXt を微調整すれば同等品を自前ライセンスで作れる可能性。ただし未知の生成器への汎化が課題で、半日〜数日規模
- **C. 別のライセンス明確な高性能モデルの登場を待つ**

### 許諾依頼の文面(HF Discussions 用・英語)

> **Subject: License for redistribution in a free browser-based tool?**
>
> Hi! Thank you for publishing this detector — in my evaluation on 545 images (Midjourney v6, 2025 generators like Seedream/FLUX/Imagen 4, plus real photos) it was by far the best public model (AUC 0.89, ~4% false-positive rate on real photos), while most other public models fail badly.
>
> I'd like to include an int8 ONNX conversion of it in **HONMONO** (https://yuukigogo000-ai.github.io/honmono/checker/), a free, open, browser-only tool that helps people spot AI-generated persona images (nothing is uploaded; inference runs client-side). The model card currently has no license field. Would you be willing to add a license (e.g. Apache-2.0 / MIT / CC-BY), or explicitly permit redistribution with attribution? I'll credit you prominently and link back to the model card. Thanks!

## 再現方法(手元)

- 評価セット取得: `scratchpad/bakeoff/fetch_eval.py`(HF datasets-server rows API)
- ONNX候補の実測: `bakeoff.js`(transformers.js)/ PyTorch候補: `hbk/eval_pt.py`
- ONNX変換+int8量子化+再測定: `hbk/export_onnx.py`
- ブラウザE2E: `test_pixel.js`(Edge headless・分割モデルをローカル配信)
