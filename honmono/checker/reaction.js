/* Additional local sensitivity analysis. No model, threshold, or metadata scoring changes. */
(function () {
  'use strict';
  const GRID = 3;
  const DISPLAY_DELTA = 2; // Display filter in points, not a statistical significance threshold.
  const LABELS = ['左上', '上中央', '右上', '左中央', '中央', '右中央', '左下', '下中央', '右下'];
  const canceled = () => new DOMException('追加解析を中止しました', 'AbortError');
  function checkAbort(signal) { if (signal && signal.aborted) throw canceled(); }
  function canvas(size) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    return c;
  }
  function toBlob(c) {
    return new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('比較用の画像を作れませんでした。')), 'image/png'));
  }
  function validScore(result) {
    if (!result || !Number.isFinite(result.pAI) || result.pAI < 0 || result.pAI > 1) throw new Error('追加解析が有効な数値を返しませんでした。');
    return result.pAI;
  }
  function rect(index, size) {
    const x = index % GRID, y = Math.floor(index / GRID);
    return { x0: Math.floor(x * size / GRID), y0: Math.floor(y * size / GRID), x1: Math.floor((x + 1) * size / GRID), y1: Math.floor((y + 1) * size / GRID) };
  }
  function replaceBlock(data, original, size, x0, y0, x1, y1) {
    const sums = [0, 0, 0], count = (x1 - x0) * (y1 - y0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) sums[channel] += original[offset + channel];
    }
    const means = sums.map(sum => Math.round(sum / count));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) data[offset + channel] = means[channel];
    }
  }
  function altered(original, size, area, method) {
    const data = new Uint8ClampedArray(original);
    const r = rect(area, size), step = method === 'flat' ? size : 8;
    for (let y = r.y0; y < r.y1; y += step) for (let x = r.x0; x < r.x1; x += step) {
      replaceBlock(data, original, size, x, y, Math.min(x + step, r.x1), Math.min(y + step, r.y1));
    }
    return new ImageData(data, size, size);
  }
  function summarize(baseline, flat, coarse, index) {
    const drops = [(baseline - flat) * 100, (baseline - coarse) * 100];
    const direction = drops.every(d => d >= DISPLAY_DELTA) ? 'down' : drops.every(d => d <= -DISPLAY_DELTA) ? 'up' : 'mixed';
    return { index, label: LABELS[index], flat, coarse, drops, direction, strength: direction === 'mixed' ? 0 : Math.min(...drops.map(Math.abs)) };
  }
  async function analyze(file, primaryScore, options = {}) {
    const P = window.HonmonoPixel, signal = options.signal;
    if (!P || !P.available()) throw new Error('画像判定モデルを利用できません。');
    const size = P.cfg.size;
    if (size !== 256) throw new Error('このモデルの入力サイズでは追加解析を利用できません。');
    validScore({ pAI: primaryScore }); checkAbort(signal);
    const image = await createImageBitmap(file), source = canvas(size);
    try {
      const ctx = source.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, size, size);
    } finally { image.close && image.close(); }
    checkAbort(signal);
    const ctx = source.getContext('2d', { willReadFrequently: true });
    const raw = ctx.getImageData(0, 0, size, size);
    // The model consumes RGB only. Make RGB opaque before lossless round-trip to avoid alpha premultiplication drift.
    for (let i = 3; i < raw.data.length; i += 4) raw.data[i] = 255;
    ctx.putImageData(raw, 0, 0);
    async function predict(c) {
      checkAbort(signal); const blob = await toBlob(c); checkAbort(signal);
      const score = validScore(await P.predict(blob)); checkAbort(signal);
      return score;
    }
    const start = performance.now();
    options.onProgress && options.onProgress(0, 19);
    const baseline = await predict(source);
    // A nonmatching round-trip cannot explain the user's displayed result.
    if (Math.abs(baseline - primaryScore) > 0.005 || (baseline >= P.cfg.threshold) !== (primaryScore >= P.cfg.threshold)) throw new Error('比較用画像で元のスコアを再現できませんでした。この画像の反応場所は説明できません。元の判定結果はそのまま残ります。');
    options.onProgress && options.onProgress(1, 19);
    const work = canvas(size), workCtx = work.getContext('2d'), regions = [];
    let done = 1;
    for (let index = 0; index < GRID * GRID; index++) {
      const scores = [];
      for (const method of ['flat', 'coarse']) {
        checkAbort(signal);
        workCtx.putImageData(altered(raw.data, size, index, method), 0, 0);
        scores.push(await predict(work));
        done++;
        options.onProgress && options.onProgress(done, 19);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      regions.push(summarize(baseline, scores[0], scores[1], index));
    }
    return { baseline, primaryScore, regions, ms: Math.round(performance.now() - start), evaluations: done, displayDelta: DISPLAY_DELTA, inputSize: size, grid: GRID };
  }
  const api = { analyze, rect, altered, summarize, labels: LABELS, displayDelta: DISPLAY_DELTA };
  let current = null, controller = null, generation = 0, displayURL = null;
  const get = id => document.getElementById(id);
  const point = score => (score * 100).toFixed(1);
  function reset() {
    generation++;
    if (controller) controller.abort();
    controller = null; current = null;
    if (displayURL) URL.revokeObjectURL(displayURL);
    displayURL = null;
    const panel = get('reactionPanel'); if (!panel) return;
    panel.hidden = true;
    panel.dataset.state = 'ready';
    get('reactionImage').removeAttribute('src');
    get('reactionGrid').replaceChildren(); get('reactionRows').replaceChildren();
    get('reactionResults').hidden = true;
    get('reactionCancel').hidden = true;
    get('reactionRun').disabled = false;
    get('reactionRun').textContent = '反応した場所を調べる';
    get('reactionProgress').hidden = true;
    get('reactionStatus').textContent = '場所はまだ調べていません。追加解析で、画像の一部を加工したときにスコアがどう動くかを確かめます。';
  }
  function setResult(file, prediction) {
    reset();
    if (!get('reactionPanel')) return;
    current = { file, score: validScore(prediction), ms: prediction.ms };
    get('reactionPanel').hidden = false;
  }
  function interpretation(region, base) {
    const measured = `「${region.label}」を単色にすると${point(base)}→${point(region.flat)}点、粗くすると${point(base)}→${point(region.coarse)}点でした。`;
    if (region.direction === 'down') return measured + ' どちらの加工でもAIスコアが下がりました。この区画の情報を変えると、モデルのAI判定が弱まることを確認できました。';
    if (region.direction === 'up') return measured + ' どちらの加工でもAIスコアが上がりました。この区画をAI判定の根拠とは説明できません。';
    return measured + ' 変化が小さい、または加工方法によって反応が異なります。この区画を判定の根拠とは特定できません。';
  }
  function render(result, file) {
    get('reactionResults').hidden = false;
    displayURL = URL.createObjectURL(file); get('reactionImage').src = displayURL;
    const grid = get('reactionGrid'), rows = get('reactionRows');
    grid.replaceChildren(); rows.replaceChildren();
    const positives = result.regions.filter(r => r.direction === 'down').sort((a, b) => b.strength - a.strength);
    const selected = positives[0] || [...result.regions].sort((a, b) => Math.max(...b.drops.map(Math.abs)) - Math.max(...a.drops.map(Math.abs)))[0];
    function select(region) {
      for (const button of grid.children) button.setAttribute('aria-pressed', String(Number(button.dataset.index) === region.index));
      get('reactionSelected').textContent = interpretation(region, result.baseline);
    }
    for (const region of result.regions) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'reaction-cell'; button.dataset.index = String(region.index); button.dataset.direction = region.direction;
      const direction = region.direction === 'down' ? '↓' : region.direction === 'up' ? '↑' : '・';
      const label = document.createElement('span'); label.textContent = `${region.index + 1} ${direction}`; button.append(label);
      button.setAttribute('aria-label', `${region.index + 1} ${region.label}。${region.direction === 'down' ? '加工でAIスコア低下' : region.direction === 'up' ? '加工でAIスコア上昇' : '小さな変化または不一致'}。測定値を見る`);
      button.addEventListener('click', () => select(region)); grid.append(button);
      const row = document.createElement('tr');
      for (const text of [`${region.index + 1} ${region.label}`, point(result.baseline), point(region.flat), point(region.coarse)]) {
        const cell = document.createElement(row.children.length ? 'td' : 'th');
        if (cell.tagName === 'TH') cell.scope = 'row';
        cell.textContent = text; row.append(cell);
      }
      rows.append(row);
    }
    select(selected);
    const variants = result.regions.flatMap(r => [r.flat, r.coarse]);
    const threshold = window.HonmonoPixel.cfg.threshold;
    const above = variants.filter(p => p >= threshold).length;
    get('reactionRange').textContent = `加工前は${point(result.baseline)}点。18通りの加工後は${point(Math.min(...variants))}〜${point(Math.max(...variants))}点でした。AI判定の基準（${point(threshold)}点）以上になったのは18通り中${above}通りです。`;
    const unchanged = result.primaryScore >= threshold ? above : 18 - above;
    get('reactionStability').textContent = (unchanged === 18
      ? '18通りすべてで、加工前と同じ判定でした。'
      : `18通り中${18 - unchanged}通りで、加工前と判定が変わりました。加工の影響を受けています。`)
      + ' ただし、18枚は同じ画像の加工版です。独立した18個の証拠でも、判定が正しい保証でもありません。';
    get('reactionStatus').textContent = positives.length
      ? `追加解析が完了しました。2通りの加工でAIスコアが下がった区画は${positives.length}か所です。最も変化がそろって大きかった「${selected.label}」を選択しています。`
      : `追加解析が完了しました。2通りとも2点以上下がる区画はありませんでした。判定の根拠を1か所に特定できません。最も変化が大きかった「${selected.label}」の数値を表示しています。`;
    get('reactionPanel').dataset.state = 'complete';
  }
  async function run() {
    if (!current || controller) return;
    const target = current, token = ++generation;
    const active = new AbortController(); controller = active;
    get('reactionPanel').dataset.state = 'running';
    get('reactionRun').disabled = true; get('reactionCancel').hidden = false;
    get('reactionResults').hidden = true; get('reactionProgress').hidden = false;
    get('reactionProgress').value = 0;
    if (displayURL) URL.revokeObjectURL(displayURL);
    displayURL = null; get('reactionImage').removeAttribute('src');
    get('reactionStatus').textContent = '元のスコアを確認しています。通常の判定結果はそのまま読めます。';
    try {
      const result = await analyze(target.file, target.score, { signal: active.signal, onProgress(done, total) {
        if (token !== generation || active.signal.aborted) return;
        get('reactionProgress').max = total; get('reactionProgress').value = done;
        get('reactionStatus').textContent = done === 0 ? '元のスコアを確認しています。' : `画像の反応を比較中… ${done} / ${total}。元の判定結果は変わりません。`;
      }});
      if (token !== generation || active.signal.aborted) return;
      render(result, target.file);
      get('reactionRun').textContent = '追加解析をやり直す';
    } catch (error) {
      if (token !== generation) return;
      const stopped = error && error.name === 'AbortError';
      get('reactionPanel').dataset.state = stopped ? 'canceled' : 'error';
      get('reactionStatus').textContent = stopped ? '追加解析を中止しました。元の判定結果は残っています。もう一度調べられます。' : `追加解析を完了できませんでした。${error && error.message || 'もう一度お試しください。'}`;
      get('reactionRun').textContent = '追加解析を再試行';
    } finally {
      if (token === generation) {
        controller = null; get('reactionRun').disabled = false;
        get('reactionCancel').hidden = true; get('reactionProgress').hidden = true;
      }
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!get('reactionPanel')) return;
    get('reactionRun').addEventListener('click', run);
    get('reactionCancel').addEventListener('click', () => {
      if (controller) { controller.abort(); get('reactionStatus').textContent = '中止しています。実行中の1回の判定が終わるまでお待ちください。'; }
    });
  });
  Object.assign(api, { reset, setResult, interpretation });
  window.HonmonoReaction = api;
})();
