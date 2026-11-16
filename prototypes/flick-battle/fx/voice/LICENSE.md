# 掛け声(英語の声)の出どころと権利

`fx/voice-clips.js` の音声は、`fx/voice/make_voice.py` で手元で作ったもの。外部のサービスには何も送っていない。

| もの | 出どころ | ライセンス |
|---|---|---|
| 音声合成モデル Kokoro-82M(q8 ONNX) | 作者 hexgrad。npm パッケージ `kokoro-q8-shards` 1.0.0 の分割ファイルを結合して使った(PyPI `kokoro-ja-voice-model-1〜4` にも同じモデルの別の書き出しがある) | Apache-2.0 |
| 声のデータ(af_bella・af_heart・am_puck・am_michael・bf_emma) | npm パッケージ `kokoro-js` 1.2.1 の `voices/*.bin` | Apache-2.0 |
| 推論のライブラリ | PyPI `kokoro-onnx` 0.6.1(MIT)、`onnxruntime`(MIT)、英語の発音辞書に `espeakng-loader`(eSpeak NG、GPL-3.0。生成のときだけ使い、ゲームには入れない) | — |
| MP3 への変換 | PyPI `lameenc`(LAME、LGPL。生成のときだけ使う) | — |

- Apache-2.0 はモデルと声のデータの利用・改変・再配布(商用を含む)を認めていて、作った音声の使い道を制限する条項はない(法的な確認ではなく、ライセンス文の読み取り)。念のため、ゲームのクレジットに「Voice: Kokoro-82M (Apache-2.0)」と書いておくとよい
- モデル(約 92MB)はリポジトリに入れていない。作り直すときは `make_voice.py` の先頭の手順で取ってくる
- 作った日: 2026-11-16。声の速さ 1.1、音量を -16 dBFS 前後にそろえ、頭と終わりの無音を詰めて、64kbps の MP3 にした
