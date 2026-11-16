// 音の聴き比べ台(fx/lab/build.mjs が tokens.js・audio.js と 1 つにまとめる)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let NEW = null, OLD = null; // 新しい音(予定)と、今の仮の画面の音に近い設定
  const mk = (o) => createAudio(o);
  function ensure() {
    if (!NEW) { NEW = mk({}); OLD = mk({ attackMs: 0, scale: 'semitone', step: 'legacy', jitter: 0, duck: false }); }
    NEW.unlock(); OLD.unlock();
  }
  const at = (ms, fn) => setTimeout(fn, ms);
  // れんさの手を 1 本まねる: 当たり 1 つごとに音が上がり、3・5・10 で和音、最高の節目で 1 回だけ呼びかけ
  function chainShot(a, upto, opt) {
    let t = 0;
    const top = upto >= 10 ? 10 : upto >= 5 ? 5 : 0;
    for (let n = 1; n <= upto; n++) {
      if (n === 10) t += FXT.chain[10].preSilenceMs;
      const tn = t;
      at(tn, () => {
        a.play('hit', { n });
        if (n === 3) a.play('chord', { notes: 2, n });
        if (n === 5) a.play('chord', { notes: 3, n, low: true });
        if (n >= 10) a.play('chord', { notes: 4, n, low: true });
        if (opt && opt.callout !== false && n === top) a.play('callout', { layers: top === 10 ? (upto > 10 ? 3 : 2) : 1 });
      });
      t += 170;
    }
  }
  const legacyStrong = () => { // 今の仮の画面の強打(2 つの音を同時に、立ち上がりなし)
    const ac = OLD.context, s = ac.currentTime + 0.005;
    for (const [hz, dur, type, vol] of [[110, 0.16, 'sawtooth', 0.12], [220, 0.1, 'triangle', 0.1]]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(hz, s);
      g.gain.setValueAtTime(vol, s); g.gain.exponentialRampToValueAtTime(0.001, s + dur); o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + dur + 0.02);
    }
  };
  const legacyWin = () => { const ac = OLD.context; [523, 659, 784, 1047].forEach((hz, k) => { const s = ac.currentTime + 0.005 + k * 0.09, o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(hz, s); g.gain.setValueAtTime(0.11, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.22); o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + 0.24); }); };
  const steps = (a) => { [1, 2, 3].forEach((p, k) => at(k * 260, () => a.play('step', { p }))); at(900, () => a.play('shoot', { p: 3 })); };
  const hits = (a, n) => { for (let k = 0; k < (n || 6); k++) at(k * 150, () => a.play('hit', { n: 2 })); };

  const CARDS = [
    { id: 'scale', title: 'れんさの音の上がり方', tag: '10 れんさの手', why: '当たるたびに音が上がります。Candy Crush は半音ずつ、Tetris Effect などは音階で上がります。予定は 5 音階(ドレミソラ)です。',
      plays: [['A', '5 音階(予定)', () => chainShot(NEW, 10), true], ['B', '半音ずつ', () => { NEW.set('scale', 'semitone'); chainShot(NEW, 10); at(2400, () => NEW.set('scale', FXT.sound.scale)); }]],
      picks: ['A', 'B', 'どちらでも'] },
    { id: 'callout', title: '呼びかけ(声っぽい合成音)', tag: '5・10・12 れんさ', why: '1 手に 1 回だけ、その手で届いた一番上の節目で鳴ります。10 以上は重ねて高くします。録音の声は使っていません。',
      plays: [['5', '5 れんさの手', () => chainShot(NEW, 7), true], ['10', '10 れんさの手', () => chainShot(NEW, 10), true], ['12', '12 れんさの手', () => chainShot(NEW, 12), true], ['×', '呼びかけなし', () => chainShot(NEW, 10, { callout: false })]],
      picks: ['このままでよい', 'もっと声らしく', 'もっと控えめに', 'なくてよい(文字だけ)'] },
    { id: 'step', title: '引っぱりの段の音', tag: '弱 → 中 → 強 → 発射', why: '今の音は段ごとに長 3 度上がり、3 段そろうと落ち着かない響き(増三和音)になります。予定はドミソです。',
      plays: [['A', 'ドミソ(予定)', () => steps(NEW), true], ['B', '今の音', () => steps(OLD)]],
      picks: ['A', 'B', 'どちらでも'] },
    { id: 'attack', title: '音の立ち上がり', tag: '当たり 6 回', why: '今の音は音量をいきなり最大にしているので、「プチッ」という雑音が混じりやすくなっています。予定は 8 ミリ秒かけて立ち上げます。',
      plays: [['A', '8 ミリ秒(予定)', () => hits(NEW), true], ['B', '0(今の音)', () => { NEW.set('attackMs', 0); hits(NEW); at(1100, () => NEW.set('attackMs', FXT.sound.attackMs)); }], ['C', '20 ミリ秒', () => { NEW.set('attackMs', 20); hits(NEW); at(1100, () => NEW.set('attackMs', FXT.sound.attackMs)); }]],
      picks: ['A', 'B', 'C', 'ちがいが分からない'] },
    { id: 'jitter', title: '同じ音の高さのゆらし', tag: '当たり 6 回', why: '同じ音が続くと機械的に聞こえるので、毎回わずかに高さをずらします。解説記事の目安は ±2 半音ですが、大きめなので ±0.5 から試します。',
      plays: [['A', '±0.5 半音(予定)', () => hits(NEW), true], ['B', 'ゆらさない', () => { NEW.set('jitter', 0); hits(NEW); at(1100, () => NEW.set('jitter', FXT.sound.jitterSemi)); }], ['C', '±1 半音', () => { NEW.set('jitter', 1); hits(NEW); at(1100, () => NEW.set('jitter', FXT.sound.jitterSemi)); }]],
      picks: ['A', 'B', 'C', 'ちがいが分からない'] },
    { id: 'strong', title: '強打の音', tag: '1 回', why: '予定は「立ち上がりの短い雑音・高さが下がる胴・短い余韻」の 3 層です。今の音は 2 つの音を同時に鳴らしています。',
      plays: [['A', '3 層(予定)', () => NEW.play('strong'), true], ['B', '今の音', () => legacyStrong()]],
      picks: ['A', 'B', 'どちらでも'] },
    { id: 'duck', title: '呼びかけの間に効果音を下げる', tag: '5 れんさの手', why: '声が鳴る 0.1〜0.3 秒だけ、当たりの音を 6dB 下げます(ダッキング)。声が埋もれないようにするためです。',
      plays: [['A', '下げる(予定)', () => chainShot(NEW, 7), true], ['B', '下げない', () => { NEW.set('duck', false); chainShot(NEW, 7); at(1500, () => NEW.set('duck', true)); }]],
      picks: ['A', 'B', 'ちがいが分からない'] },
    { id: 'win', title: '勝ちの音', tag: '勝敗の画面', why: '予定は 4 音で上がり、最後の音を長く伸ばします。今の音は 4 音とも同じ長さです。',
      plays: [['A', '最後を伸ばす(予定)', () => NEW.play('win'), true], ['B', '今の音', () => legacyWin()]],
      picks: ['A', 'B', 'どちらでも'] },
    { id: 'finale', title: '決着の音', tag: 'ふつう・特別版', why: '最後の敵を倒した瞬間に鳴ります。1 手で 3 体以上をまとめて倒したときは、上がっていく粒の音を足します(特別版)。',
      plays: [['1', 'ふつう', () => NEW.play('finale', {}), true], ['2', '特別版', () => NEW.play('finale', { special: true }), true]],
      picks: ['このままでよい', 'もっと派手に', 'もっと控えめに'] },
  ];
  const OTHERS = [['当たり', 'hit', { n: 1 }], ['場外', 'ring'], ['花火(1 発目)', 'blast', { k2: 1 }], ['花火(2 発目から)', 'blast', { k2: 2 }], ['必殺を撃つ', 'ultFire'], ['ゲージ割り', 'gauge'],
                  ['ぶつけ', 'crash'], ['玉突き', 'relay'], ['もう 1 手', 'bonus'], ['おやつ', 'pickup'], ['輪ゴムの柱', 'bumper'], ['味方がやられた', 'harm'], ['柵に当たる', 'rail', { v: 900 }], ['駒どうしが触れる', 'tap', { v: 500 }], ['負け', 'lose']];

  const KEY = 'flick-lab-picks';
  let picks = {};
  try { picks = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { picks = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch (e) { /* 覚えられなくても続ける */ } };

  const cards = $('cards');
  cards.style.display = 'flex'; cards.style.flexDirection = 'column'; cards.style.gap = '14px';
  for (const c of CARDS) {
    const sec = document.createElement('section'); sec.className = 'card'; sec.setAttribute('aria-labelledby', 'h-' + c.id);
    const h = document.createElement('h2'); h.id = 'h-' + c.id; h.textContent = c.title;
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = c.tag; h.append(tag);
    const why = document.createElement('p'); why.className = 'why'; why.textContent = c.why;
    const plays = document.createElement('div'); plays.className = 'plays';
    for (const [k, label, fn, planned] of c.plays) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'play' + (planned ? ' planned' : ''); b.id = 'p-' + c.id + '-' + k;
      const badge = document.createElement('b'); badge.textContent = k; b.append(badge, document.createTextNode('聴く: ' + label));
      b.addEventListener('click', () => { ensure(); fn(); });
      plays.append(b);
    }
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend'); lg.textContent = '選ぶ'; fs.append(lg);
    for (const p of c.picks) {
      const lab = document.createElement('label'); lab.className = 'pick';
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'pick-' + c.id; inp.id = 'pick-' + c.id + '-' + p; inp.value = p; inp.checked = picks[c.id] === p;
      inp.addEventListener('change', () => { picks[c.id] = p; save(); summary(); });
      const sp = document.createElement('span'); sp.textContent = p;
      lab.append(inp, sp); fs.append(lab);
    }
    sec.append(h, why, plays, fs);
    cards.append(sec);
  }
  for (const [label, id, q] of OTHERS) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.id = 'o-' + id + (q && q.k2 ? q.k2 : '');
    b.addEventListener('click', () => { ensure(); NEW.play(id, q || {}); });
    $('others').append(b);
  }
  function summary() {
    const lines = CARDS.map((c) => c.title + ': ' + (picks[c.id] || '(まだ)'));
    $('sum').textContent = '音の聴き比べの結果\n' + lines.join('\n');
  }
  summary();
  $('copy').addEventListener('click', () => {
    const t = $('sum').textContent;
    const done = () => { $('copied').textContent = 'コピーしました。会話に貼り付けてください。'; };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('sum')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('copied').textContent = '選択しました。長押しでコピーしてください。'; };
    try { navigator.clipboard.writeText(t).then(done, fallback); } catch (e) { fallback(); }
  });
})();
