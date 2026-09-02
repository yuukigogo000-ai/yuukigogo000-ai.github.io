/* ========== UI ========== */
/* 解析ロジック(この上の部分)は一切変えていない。ここは「結果をどう見せるか」だけ。 */
const $ = id => document.getElementById(id);
const drop = $('drop'), fileInput = $('file');

drop.addEventListener('click', e => { if (e.target !== fileInput) fileInput.click(); }); // inputからのバブリングで再帰しないようガード
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('over');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) handle(f);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handle(fileInput.files[0]); });
$('pickAnother').addEventListener('click', () => fileInput.click()); // 入口をもう1つ置くだけ。機能は同じ

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* 状態は「色 + 形 + 言葉」で示す。色だけに意味を持たせない */
const GLYPH = {
  bad:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5 14.5 8 8 14.5 1.5 8z"/><path d="M8 5v3.5M8 11h.01"/></svg>',
  warn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11 2 5 14"/></svg>',
  ok:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2H2v12h2M12 2h2v12h-2"/><path d="m5.5 8 1.8 2L10.5 6"/></svg>',
  info: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/></svg>',
};
const chip = (level, label) =>
  `<span class="chip chip--${level}"><span class="glyph" aria-hidden="true">${GLYPH[level]}</span>${esc(label)}</span>`;

const VERDICTS = {
  ai:      { cls: 'bad',  tag: 'AI痕跡', title: 'AI生成の痕跡があります',
             body: '生成AIツールの記録・申告がこの画像に埋め込まれています。何が見つかったかは下の「根拠」で1件ずつ確認できます。' },
  c2pa:    { cls: 'info', tag: '来歴',   title: 'コンテンツ来歴（C2PA）付き',
             body: '来歴データが埋め込まれています。良い・悪いの判定ではありません。署名が本物かどうかは下の「C2PA署名の検証」に出ます。' },
  camera:  { cls: 'ok',   tag: '実写材料', title: 'カメラ撮影の痕跡があります',
             body: 'カメラ機種や撮影日時のメタデータが残っており、実写である可能性を高めます。ただしEXIFは偽装できます。すぐ下の「判定の限界」も読んでください。' },
  stock:   { cls: 'warn', tag: '注意',   title: 'ストック素材サイト由来',
             body: '素材サイトで配布されている画像の痕跡があります。実在アカウントの「本人写真」としては不自然で、流用または架空人物の疑いがあります。悪意があると断定するものではありません。' },
  weak:    { cls: 'warn', tag: '弱い手がかり', title: 'AI生成を疑う手がかり（弱）',
             body: '決定的な証拠はありませんが、注意すべき特徴が見つかりました。逆画像検索や元データの入手で追加検証してください。' },
  unknown: { cls: 'info', tag: '中立 / INFO', title: '判定材料がありません',
             body: 'メタデータが見つからなかった、という事実です。SNSやスクリーンショット経由では珍しくありません。「AIではない」「本物である」という意味ではありません。可能なら投稿前の元データで再チェックを。' },
};

/* 結論の位置に出す警告(受け取れなかった・解析できなかった)。UIはロックしない */
function stateDossier(level, title, body) {
  return `<div class="verdict verdict--${level} state-motion">${chip(level, level === 'bad' ? 'エラー' : '注意')}` +
    `<h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;
}

/* ========== 実験: 画素判定のUI ========== */
let pixelCurrentFile = null;
function setupPixel(file, res) {
  const P = window.HonmonoPixel;
  const card = $('pixelCard');
  const isVideoFile = (file.type && file.type.startsWith('video/')) || /[.](mp4|mov|m4v)$/i.test(file.name);
  if (!P || !P.available() || isVideoFile || res.format === '不明') { card.style.display = 'none'; return; }
  pixelCurrentFile = file;
  card.style.display = 'block';
  $('pixelResult').style.display = 'none';
  $('pixelProgress').style.display = 'none';
  $('pixelDlRail').style.display = 'none';
  $('pixelControls').style.display = '';
  if (P.cfg.totalBytes) {
    const mb = '約' + Math.round(P.cfg.totalBytes / 1e6) + 'MB';
    $('pixelSize').textContent = mb;
    $('pixelRun').textContent = mb + 'を読み込んで実行';
  }
  $('pixelEval').textContent = P.cfg.evalNote || '';
  const auto = localStorage.getItem('honmono_pixel_auto') === '1';
  $('pixelAuto').checked = auto;
  $('pixelAutoState').textContent = auto ? 'ON' : 'OFF';
  if (auto) runPixel();
}
async function runPixel() {
  const P = window.HonmonoPixel;
  const file = pixelCurrentFile;
  if (!P || !file) return;
  $('pixelControls').style.display = 'none';
  $('pixelProgress').style.display = 'block';
  $('pixelDlRail').style.display = 'block';
  $('pixelDlFill').style.transform = 'scaleX(0)';
  $('pixelProgress').textContent = 'モデルを読み込み中…';
  try {
    const r = await P.predict(file, (got, total) => {
      $('pixelProgress').textContent = total
        ? `モデルを読み込み中… ${Math.round(got / 1e6)} / ${Math.round(total / 1e6)} MB`
        : `モデルを読み込み中… ${Math.round(got / 1e6)} MB`;
      if (total) $('pixelDlFill').style.transform = 'scaleX(' + Math.min(1, got / total) + ')';
      if (!total || got >= total) $('pixelProgress').textContent += ' / 端末内で推論中…';
    });
    if (file !== pixelCurrentFile) return; // 別ファイルに切り替わっていたら捨てる
    const pct = Math.round(r.pAI * 100);
    const thr = P.cfg.threshold;
    let label, level, note;
    if (r.pAI >= thr) { label = 'AI生成の可能性が高い'; level = 'bad'; note = 'このモデルが「AI」と言った場合の的中率は外部評価で約97%です。ただし誤りもあります(実在の人の顔写真を誤判定する割合は実測1.1%、古いGAN風に切り取られた顔では5%)。他のシグナルと合わせて判断してください。'; }
    else if (r.pAI >= 0.5) { label = 'AI生成の疑いあり（弱）'; level = 'warn'; note = '判定が割れる領域です。単独では根拠になりません。'; }
    else { label = 'AI生成の兆候は薄い'; level = 'info'; note = '注意: このモデルはAI画像の約3割(2025年世代の生成器は約4割)を見逃します。「AIではない」証明にはなりません。'; }
    const color = 'var(--c-' + level + ')';
    $('pixelScore').textContent = pct + '%';
    $('pixelScore').style.color = color;
    $('pixelLabel').innerHTML = chip(level, label);
    $('pixelBar').style.transform = 'scaleX(' + (pct / 100) + ')';
    $('pixelBar').style.background = color;
    $('pixelMeta').textContent = `AIらしさスコア / ${r.backend === 'webgpu' ? 'GPU' : 'CPU'} ${r.ms}ms / ${P.cfg.name}${P.cfg.version ? ' ' + P.cfg.version : ''}`;
    $('pixelNote').textContent = note;
    $('pixelProgress').style.display = 'none';
    $('pixelDlRail').style.display = 'none';
    $('pixelResult').style.display = 'block';
    $('pixelResult').classList.remove('state-motion');
    void $('pixelResult').offsetWidth;
    $('pixelResult').classList.add('state-motion');
  } catch (e) {
    // 実験区画の中だけで失敗を伝える。メタデータの本判定は壊さない
    $('pixelProgress').innerHTML = chip('bad', 'エラー') + ' 画素判定を実行できませんでした: ' + esc(e && e.message || e);
    $('pixelDlRail').style.display = 'none';
    $('pixelControls').style.display = '';
  }
}
$('pixelRun').addEventListener('click', runPixel);
$('pixelAuto').addEventListener('change', () => {
  localStorage.setItem('honmono_pixel_auto', $('pixelAuto').checked ? '1' : '0');
  $('pixelAutoState').textContent = $('pixelAuto').checked ? 'ON' : 'OFF';
});

async function handle(file) {
  $('result').style.display = 'block';
  $('fileName').textContent = file.name;
  $('verdict').innerHTML = '';
  $('findings').innerHTML = '';
  $('metaTable').innerHTML = '';
  $('metaCount').textContent = '';
  $('xmpDetails').style.display = 'none';
  $('c2paCard').style.display = 'none';
  $('pixelCard').style.display = 'none';

  if (file.size > 300 * 1024 * 1024) {
    $('fileMeta').textContent = 'ファイルが大きすぎます（300MBまで）';
    $('verdict').innerHTML = stateDossier('warn', 'このファイルは受け取れません',
      '300MBを超えています。上限は300MBです。動画は冒頭部分を切り出してからお試しください。別のファイルを選び直せます。');
    return;
  }
  $('fileMeta').textContent = '解析中…（数秒で終わります）';
  $('verdict').innerHTML =
    '<div class="wait-rail"><div class="wait-rail__highlight"></div></div>' +
    '<p class="note" style="margin:0">解析中…</p>';

  for (const el of [$('preview'), $('previewVid')]) {
    if (el.src && el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
  }
  const isVideoFile = (file.type && file.type.startsWith('video/')) || /\.(mp4|mov|m4v)$/i.test(file.name);
  $('preview').style.display = isVideoFile ? 'none' : '';
  $('previewVid').style.display = isVideoFile ? '' : 'none';
  if (isVideoFile) {
    $('previewVid').src = URL.createObjectURL(file);
  } else {
    $('preview').onerror = () => { $('preview').style.display = 'none'; }; // HEIC等ブラウザ非対応形式
    $('preview').src = URL.createObjectURL(file);
  }

  let res;
  try {
    res = await analyze(file);
  } catch (err) {
    $('fileMeta').textContent = '解析エラー: ' + err.message;
    $('verdict').innerHTML = stateDossier('bad', '解析できませんでした',
      '原因: ' + (err && err.message || err) + '。ファイルが壊れている可能性があります。別のファイルで試せます。');
    return;
  }

  $('fileMeta').textContent = `${res.format} / ${(file.size / 1024).toFixed(1)} KB`;

  if (res.format === '不明') {
    // 「判定材料なし」とは別の状態。対応形式を出して、変換すれば試せることを示す
    $('verdict').innerHTML = stateDossier('warn', '対応していないファイル形式です',
      '画像は JPEG / PNG / WebP / HEIC / AVIF、動画は MP4 / MOV に対応しています。変換してから再試行してください。');
  } else {
    const v = VERDICTS[res.verdict] || VERDICTS.unknown;
    $('verdict').innerHTML =
      `<div class="verdict verdict--${v.cls} state-motion">${chip(v.cls, v.tag)}` +
      `<h2>${esc(v.title)}</h2><p>${esc(v.body)}</p></div>`;
  }

  $('findings').innerHTML = res.findings.map(f => {
    const label = { bad: 'AI痕跡', ok: '実写材料', warn: '注意', info: '情報' }[f.level] || '情報';
    return `<div class="finding">${chip(f.level, label)}` +
      `<div><b>${esc(f.title)}</b><span class="detail">${esc(f.detail)}</span></div></div>`;
  }).join('');

  const rows = Object.entries(res.meta);
  $('metaCount').textContent = rows.length + '件';
  $('metaTable').innerHTML = rows.length
    ? '<div class="scroll"><table><tbody>' + rows.map(([k, v2]) => `<tr><th>${esc(k)}</th><td>${esc(v2)}</td></tr>`).join('') + '</tbody></table></div>'
    : '<p class="note">メタデータは検出されませんでした。</p>';

  if (res.xmp) {
    $('xmpDetails').style.display = 'block';
    $('xmpRaw').textContent = res.xmp.slice(0, 20000);
  }

  setupPixel(file, res);

  if (res.hasC2PA) {
    $('c2paCard').style.display = 'block';
    $('c2paBody').innerHTML =
      '<div class="wait-rail"><div class="wait-rail__highlight"></div></div>' +
      '<p class="note" style="margin:0">署名検証エンジンを読み込み中…（初回は数秒かかります）</p>';
    verifyC2pa(file)
      .then(html => { $('c2paBody').innerHTML = html; })
      .catch(() => { $('c2paBody').innerHTML = '<p class="note">署名検証中に予期しないエラーが発生しました。</p>'; });
  }
}
