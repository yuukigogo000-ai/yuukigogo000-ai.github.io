
<script>
// 画素判定モデルの設定(自前学習 HONMONO v2・2026-08-18)。数値は学習に使っていない外部545枚での実測。
window.HONMONO_PIXEL_CONFIG = {
  enabled: true,
  name: 'HONMONO自前モデル',
  version: 'v3.1 (2026-08-19)',
  parts: ['../vendor/models/honmono_v31_int8.onnx.part1', '../vendor/models/honmono_v31_int8.onnx.part2'],
  totalBytes: 90283577,
  threshold: 0.8,
  evalNote: '実測(学習に一切使っていない外部545枚): 実写をAIと誤判定 1.8%・AI画像の検出 70.0%。2025年世代の生成器(Seedream 4 / Gemini 2.5 / FLUX Pro 等)の検出は 62.6%(約4割を見逃す)。人物の顔で別に測った615枚では、実在の人の顔の誤判定 1.1%・AI生成の顔の検出 92.2%。学習データは商用利用可のものだけを使用。'
};
</script>
<script src="pixel.js"></script>
<script>
'use strict';

__CHECKER_CORE__
__CHECKER_UI__
</script>
