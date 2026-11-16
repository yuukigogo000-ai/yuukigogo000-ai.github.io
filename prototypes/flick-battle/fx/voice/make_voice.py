# はじきバトル 掛け声(英語)を、Kokoro-82M で事前に作って fx/voice-clips.js に埋め込む。
# ゲームは音源ファイルを外から読まない(オフライン)。ここで作った短い MP3 を base64 で JS に入れる。
#
# 使うもの(すべて無料・手元で動く。外部のサービスには何も送らない):
#   モデル: Kokoro-82M の q8 ONNX(Apache-2.0)。npm の kokoro-q8-shards を `cat kokoro-q8.part{0..5}.bin > model.onnx`
#   声:     npm の kokoro-js 1.2.1 の voices/*.bin(Apache-2.0)
#   実行:   pip install onnxruntime numpy kokoro-onnx lameenc
#   python -I make_voice.py <model.onnx> <kokoro-js の voices フォルダ> <出力 voice-clips.js> [声の名前,...]
import sys, json, base64, io
import numpy as np
import lameenc
from kokoro_onnx import Kokoro

LINES = {  # 掛け声の候補(発注者が選ぶ)。キー = 使う場面
    'nice': 'Nice!', 'great': 'Great!',                # 5 れんさ
    'awesome': 'Awesome!', 'amazing': 'Amazing!',      # 10 れんさ
    'incredible': 'Incredible!', 'unstoppable': 'Unstoppable!',  # 11 れんさ以上
    'onemore': 'One more!',                            # もう 1 手
    'break': 'Break!',                                 # ボスのゲージ割り
    'finish': 'Finish!',                               # 決着
    'sweep': 'Clean sweep!',                           # 決着の特別版(1 手で 3 体以上)
}
VOICES = ['af_bella', 'af_heart', 'am_puck', 'am_michael', 'bf_emma']

def load_voices(folder, names):
    v = {}
    for n in names:
        a = np.fromfile(f'{folder}/{n}.bin', dtype=np.float32)
        v[n] = a.reshape(-1, 1, 256)
    path = '/tmp/kokoro_voices_subset.npz'
    np.savez(path, **v)
    return path

def trim(x, sr, db=-42):
    th = 10 ** (db / 20) * np.max(np.abs(x))
    idx = np.where(np.abs(x) > th)[0]
    if len(idx) == 0: return x
    a, b = max(0, idx[0] - int(sr * 0.008)), min(len(x), idx[-1] + int(sr * 0.06))
    y = x[a:b].copy()
    fi, fo = int(sr * 0.003), int(sr * 0.03)
    y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
    return y

def master(x):
    # 音量をそろえる(RMS を -16 dBFS 前後に)+ やわらかい頭打ち
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    y = x * (10 ** (-16 / 20) / rms)
    return np.tanh(y * 1.2) / np.tanh(1.2)

def mp3(x, sr):
    enc = lameenc.Encoder(); enc.set_bit_rate(64); enc.set_in_sample_rate(sr); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    return enc.encode(pcm) + enc.flush()

def main():
    model, folder, out = sys.argv[1], sys.argv[2], sys.argv[3]
    voices = sys.argv[4].split(',') if len(sys.argv) > 4 else VOICES
    k = Kokoro(model, load_voices(folder, voices))
    clips, meta = {}, {}
    for v in voices:
        for key, text in LINES.items():
            samples, sr = k.create(text, voice=v, speed=1.1, lang='en-us')
            y = master(trim(np.asarray(samples, dtype=np.float32), sr))
            data = mp3(y, sr)
            clips[f'{key}.{v}'] = base64.b64encode(data).decode()
            meta[f'{key}.{v}'] = {'text': text, 'ms': round(len(y) / sr * 1000), 'bytes': len(data)}
    js = ('// make_voice.py が作った掛け声(英語)。Kokoro-82M(Apache-2.0)で手元で作った。手で直さない\n'
          '// キー = 掛け声.声の名前。値 = MP3 の base64\n'
          'export const VOICE_META = ' + json.dumps(meta, ensure_ascii=False) + ';\n'
          'export const VOICE_CLIPS = ' + json.dumps(clips) + ';\n')
    open(out, 'w', encoding='utf-8').write(js)
    tot = sum(m['bytes'] for m in meta.values())
    for key in meta: print(key.ljust(22), meta[key]['ms'], 'ms', meta[key]['bytes'], 'B')
    print('合計', round(tot / 1024), 'KB')

if __name__ == '__main__':
    main()
