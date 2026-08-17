# 画素ベースAI画像判定 — 公開モデル実測比較と搭載可否(2026-08-17)

来歴チェッカーの「メタデータが消された画像には沈黙する」弱点を埋めるため、
**画像そのもの(画素)からAI生成かを判定する公開モデル**をブラウザ搭載候補として実測した記録。

## 結論(先に)

- 無料公開モデル **9本中8本は実用不可**(実写を10〜88%の割合でAIと誤判定、または最新生成器をほぼ見逃す)
- **1本だけ合格水準**: `haywoodsloan/ai-image-detector-deploy`(Swin v2 Large・2025-06)
  - 実写をAIと誤判定 **3.7%**(しきい値0.95で1.8%)、AIと言った時の的中率 **94〜97%**、AIの見逃し ~40%(最新生成器で多い)
  - int8量子化(199MB)後も精度維持。ブラウザ内(onnxruntime-web / WASM)で **1.5秒/枚**、Python版と判定一致 97.5%
  - **ただしライセンス未記載** → 再配布(当サイトでの同梱)は許諾が取れるまで行わない
- 現状の公開状態: 推論コード(`checker/pixel.js`)は同梱・**機能は無効**・モデル未同梱。許諾が下りるか自前学習モデルができ次第、設定を入れて有効化

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
