# HONMONO 画素判定モデル ライセンス v1.0

対象: `honmono_v31_int8.onnx.part1` / `.part2`(結合すると `honmono_v31_int8.onnx`)
発行 2026-08-20 / HONMONO プロジェクト

---

## 1. 無償で許可されること

以下は許可を求める必要がありません。

- **HONMONO のウェブサイト上で来歴チェッカーを使うこと。** 目的を問いません(業務での利用を含みます)
- **モデルをダウンロードして、個人の利用・学術研究・評価・検証・報道のために実行すること**
- 上記の目的で得た**測定結果を公表すること**(むしろ歓迎します。反証も同様です)

## 2. 別途の合意が必要なこと

以下は、事前の書面による合意が必要です。

- 自社の**製品・サービス・アプリ・社内システムに組み込むこと**
- **再配布すること**(そのまま・改変後・再学習後・蒸留後を問いません)
- **サービスとして提供すること**(API・SaaS・受託解析など)
- 上記に付随して**HONMONO の名称や実測値を宣伝に使うこと**

ご相談: https://yuukigogo000-ai.github.io/honmono/business/

## 3. 保証しないこと(重要)

このモデルは**確率を出す道具であって、真偽の判定装置ではありません。**
公開されている実測値(学習に一切使っていない外部545枚・顔615枚)は次のとおりです。

| 測定 | 値 |
|---|---|
| 実写をAIと誤判定する割合 | 1.8%(顔だけを測った615枚では 1.1%) |
| AI画像を検出できる割合 | 70.0%(顔だけを測った615枚では 92.2%) |
| 2025年世代の生成器(Seedream 4・Gemini 2.5・FLUX Pro 等)の検出 | 62.6%(**4割近く見逃します**) |
| 古いGAN風に切り取られた顔での誤判定 | 5.0% |

つまり **「AIではない」ことの証明には使えません。**
また、**特定の個人について不利益な判断(採用・取引の可否・アカウント停止・詐欺の断定など)を、
このモデルの出力だけを根拠に行わないでください。**
本モデルの利用によって生じた損害について、HONMONO プロジェクトは、
故意または重大な過失による場合を除き、責任を負いません。

## 4. 学習データについて

学習には、**商用利用が明示的に許諾されたデータのみ**を使用しています。
ライセンスが未記載・非商用・研究目的限定のデータセットは、22件を明示的に除外しました。
内訳と除外理由は [学習データの出典](https://yuukigogo000-ai.github.io/honmono/report/#data) に公開しています。

学習に使った画像そのものは配布していません(配布権を持たないため)。

---

# HONMONO Pixel Detector — License v1.0 (English summary)

**Free, no permission needed:** using the HONMONO website for any purpose including at work;
downloading and running the model for personal, academic, evaluation, verification or journalistic
purposes; publishing measurements you obtain (including negative results).

**Requires a written agreement:** embedding it in a product, service, application or internal system;
redistribution in any form (as-is, modified, retrained or distilled); offering it as a service
(API/SaaS/analysis-for-hire); using the HONMONO name or its published figures in marketing.
Contact: https://yuukigogo000-ai.github.io/honmono/business/

**No warranty.** This model outputs a probability, not a verdict. It misses roughly 40% of images from
2025-generation generators and cannot be used to prove that something is *not* AI-generated.
Do not make adverse decisions about an identifiable person based on this model alone.
Except in cases of wilful misconduct or gross negligence, the HONMONO project accepts no liability.

**Training data:** only datasets whose terms explicitly permit commercial use. 22 datasets with
missing, non-commercial or research-only terms were excluded. The training images themselves are
not redistributed.
