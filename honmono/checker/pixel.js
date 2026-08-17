/* HONMONO 実験機能: 画素からのAI判定(ブラウザ内推論・画像は送信しない)
 * - 既定では無効(window.HONMONO_PIXEL_CONFIG が enabled:true を持つ時だけ有効)
 * - モデルは分割ファイル(parts)を結合して onnxruntime-web に渡す。Cache API で2回目以降は即時
 * - 判定は「参考値」。本判定(メタデータ)とは別枠で表示する
 */
(function () {
  'use strict';
  const DEFAULTS = {
    enabled: false,
    name: '',            // 表示用モデル名
    version: '',
    parts: [],           // 分割モデルのURL配列(相対可)
    totalBytes: 0,       // 進捗表示用(省略可)
    ortScript: '../vendor/ort/ort.min.js',
    ortWasmDir: '../vendor/ort/',
    inputName: 'pixel_values',
    size: 256,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    aiIndex: 0,          // ソフトマックス出力のうち「AI」ラベルのインデックス
    threshold: 0.9,      // これ以上で「AIの可能性が高い」と表示
    evalNote: '',        // 実測精度の説明文(正直に表示)
    cacheName: 'honmono-pixel-model-v1',
  };
  const cfg = Object.assign({}, DEFAULTS, window.HONMONO_PIXEL_CONFIG || {});
  let session = null, backend = '', loading = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (window.ort) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('ランタイム読み込み失敗'));
      document.head.appendChild(s);
    });
  }

  async function fetchPart(url, onBytes) {
    const abs = new URL(url, location.href).href;
    let cache = null;
    try { cache = await caches.open(cfg.cacheName); } catch {}
    if (cache) {
      const hit = await cache.match(abs);
      if (hit) { const buf = await hit.arrayBuffer(); onBytes(buf.byteLength); return new Uint8Array(buf); }
    }
    const res = await fetch(abs);
    if (!res.ok) throw new Error('モデル取得失敗: ' + res.status);
    const reader = res.body.getReader();
    const chunks = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); total += value.length; onBytes(value.length);
    }
    const out = new Uint8Array(total); let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    if (cache) { try { await cache.put(abs, new Response(out, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch {} }
    return out;
  }

  async function load(onProgress) {
    if (session) return session;
    if (loading) return loading;
    loading = (async () => {
      await loadScript(new URL(cfg.ortScript, location.href).href);
      ort.env.wasm.wasmPaths = new URL(cfg.ortWasmDir, location.href).href;
      ort.env.wasm.numThreads = 1; // GitHub Pages は COOP/COEP を出せないため単一スレッド
      let got = 0;
      const parts = [];
      for (const u of cfg.parts) parts.push(await fetchPart(u, n => { got += n; onProgress && onProgress(got, cfg.totalBytes || 0); }));
      const total = parts.reduce((s, a) => s + a.length, 0);
      const model = new Uint8Array(total); let p = 0;
      for (const a of parts) { model.set(a, p); p += a.length; }
      const eps = [];
      if (navigator.gpu) eps.push('webgpu');
      eps.push('wasm');
      for (const ep of eps) {
        try {
          session = await ort.InferenceSession.create(model, { executionProviders: [ep], graphOptimizationLevel: 'all' });
          backend = ep; break;
        } catch (e) { console.warn('EP failed', ep, e && e.message); }
      }
      if (!session) throw new Error('推論エンジンを初期化できませんでした');
      return session;
    })();
    try { return await loading; } finally { loading = null; }
  }

  async function preprocess(file) {
    const bmp = await createImageBitmap(file);
    const S = cfg.size;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, S, S); // 学習時と同じく縦横比を無視して正方形にリサイズ
    bmp.close && bmp.close();
    const d = ctx.getImageData(0, 0, S, S).data;
    const out = new Float32Array(3 * S * S);
    const n = S * S;
    for (let i = 0; i < n; i++) {
      out[i]         = (d[i * 4]     / 255 - cfg.mean[0]) / cfg.std[0];
      out[n + i]     = (d[i * 4 + 1] / 255 - cfg.mean[1]) / cfg.std[1];
      out[2 * n + i] = (d[i * 4 + 2] / 255 - cfg.mean[2]) / cfg.std[2];
    }
    return new ort.Tensor('float32', out, [1, 3, S, S]);
  }

  async function predict(file, onProgress) {
    const sess = await load(onProgress);
    const t0 = performance.now();
    const x = await preprocess(file);
    const out = await sess.run({ [cfg.inputName]: x });
    const logits = out[Object.keys(out)[0]].data;
    let m = -Infinity; for (const v of logits) m = Math.max(m, v);
    let s = 0; const e = []; for (const v of logits) { const t = Math.exp(v - m); e.push(t); s += t; }
    const probs = e.map(v => v / s);
    return { pAI: probs[cfg.aiIndex], probs, backend, ms: Math.round(performance.now() - t0) };
  }

  window.HonmonoPixel = { cfg, available: () => !!(cfg.enabled && cfg.parts.length), load, predict, get backend() { return backend; } };
})();
