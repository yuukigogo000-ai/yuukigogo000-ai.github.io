// 音の聴き比べ台 第 3 版(fx/lab/build.mjs が tokens.js・audio.js・audio-v2.js・voice-clips.js と 1 つにまとめる)
// 第 2 版への発注者の声: 「よいね」「合成の声は発音がおかしい。英語で自然な声できる?」「もっと爽快感」(2026-11-16)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let NEW = null, OLD = null; // 第 3 版と、第 2 版(前回の音)
  function ensure() {
    if (!NEW) { NEW = createAudio({ clips: VOICE_CLIPS, voiceName: pick.voice || FXT.sound.voiceName }); OLD = createAudioV2({}); }
    NEW.unlock(); OLD.unlock();
  }
  const at = (ms, fn) => setTimeout(fn, ms);
  const with_ = (k, v, ms, fn) => { const prev = NEW.get(k); NEW.set(k, v); fn(); at(ms, () => NEW.set(k, prev)); };
  const KEY = 'flick-lab-picks-v3';
  let pick = {};
  try { pick = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { pick = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch (e) { /* 覚えられなくても続ける */ } };
  const line = (moment) => pick['w_' + moment] || FXT.sound.voiceLines[moment];

  // れんさの手を 1 本まねる(第 3 版は 10 れんさの直前に溜め、掛け声は 1 手に 1 つ)
  function chainShot(a, upto, v3) {
    let t = 0;
    const lead = FXT.sound.riser.leadMs;
    for (let n = 1; n <= upto; n++) {
      if (n === 10) { if (v3) { const tr = t; at(tr, () => a.play('riser', { ms: lead, top: 1760 })); t += lead; } else t += FXT.chain[10].preSilenceMs; }
      at(t, () => {
        a.play('hit', { n, pan: ((n * 37) % 9 - 4) / 10 });
        if (n === 3) a.play('chord', { notes: 2, n });
        if (n === 5) a.play('chord', { notes: 3, n, low: true });
        if (n >= 10) a.play('chord', { notes: 4, n, low: true });
        if (v3) {
          const top = upto >= 11 ? 11 : upto >= 10 ? 10 : upto >= 5 ? 5 : 0;
          if (n === top) a.play('callout', { line: line(top === 11 ? 'chainOver' : top === 10 ? 'chain10' : 'chain5') });
        } else if (n === (upto >= 10 ? 10 : upto >= 5 ? 5 : 0)) a.play('callout', { layers: upto >= 10 ? (upto > 10 ? 3 : 2) : 1 });
      });
      t += 170;
    }
  }
  // 1 手を通しで: 引っぱり(段 3 回)→ 発射 → 当たり 6 つ(2 発目が強打)→ 和音 → 最後に場外 → もう 1 手(掛け声は 1 手に 1 つ: もう 1 手が 5 れんさより上)
  function fullShot(a, v3) {
    [1, 2, 3].forEach((p, k) => at(k * 240, () => a.play('step', { p })));
    at(820, () => a.play('shoot', { p: 3 }));
    let t = 1000;
    for (let n = 1; n <= 6; n++) {
      at(t, () => {
        a.play('hit', { n, pan: ((n * 37) % 9 - 4) / 10 });
        if (n === 2) a.play('strong');
        if (n === 3) a.play('chord', { notes: 2, n });
        if (n === 5) { a.play('chord', { notes: 3, n, low: true }); if (!v3) a.play('callout', { layers: 1 }); }
      });
      t += n === 5 ? 320 : 180;
    }
    at(t, () => a.play('ring'));
    at(t + 650, () => { a.play('bonus'); if (v3) a.play('callout', { line: line('bonus') }); });
  }
  // 決着: 第 3 版は減速と一緒に溜めが上がり、当たった瞬間に解放する
  function finaleShot(a, v3, special) {
    const lead = 750;
    if (v3) a.play('riser', { ms: lead, top: 2093 });
    at(v3 ? lead : 0, () => { a.play(special ? 'break' : 'ring'); a.play('finale', { special }); if (v3) a.play('callout', { line: line(special ? 'special' : 'finale') }); });
    at((v3 ? lead : 0) + 1300, () => a.play('win'));
  }

  const VOICES = [['af_bella', '女性 A(明るい)'], ['af_heart', '女性 B(あたたかい)'], ['am_puck', '男性 A(軽やか)'], ['am_michael', '男性 B(落ち着いた)'], ['bf_emma', '女性 C(イギリス英語)']];
  const MOMENTS = [['chain5', '5 れんさ', ['nice', 'great']], ['chain10', '10 れんさ', ['awesome', 'amazing']], ['chainOver', '11 れんさ以上', ['amazing', 'incredible', 'unstoppable']],
                   ['bonus', 'もう 1 手', ['onemore']], ['gauge', 'ゲージ割り', ['break']], ['finale', '決着', ['finish']], ['special', '決着の特別版', ['sweep']]];
  const CARDS = [
    { id: 'whole', title: '1 手を通しで', tag: '引っぱり → 発射 → 6 れんさ → 場外 → もう 1 手', why: '第 2 版と第 3 版を同じ流れで比べます。第 3 版は、当たりに「ポン」と弾ける粒を足し、れんさが伸びるほど音の層が増えて左右に広がります。一撃には「パシッ」という締まりを足しました。掛け声は 1 手に 1 つで、この手では「もう 1 手」の声になります。',
      plays: [['新', '第 3 版', () => fullShot(NEW, true), true], ['前', '第 2 版', () => fullShot(OLD, false)]],
      picks: ['第 3 版がよい', '第 2 版がよい', 'まだ物足りない'] },
    { id: 'rise', title: '溜めて、放つ', tag: '10 れんさ・決着', why: '10 れんさと決着は、当たる前から先に分かります(台本で計算済み)。そこで当たる直前に「キュイーン」と上がる溜めを入れ、当たった瞬間に一気に放ちます。必ず起きるときだけ鳴らすので、期待させて外すことはありません。',
      plays: [['10', '10 れんさ(第 3 版)', () => chainShot(NEW, 10, true), true], ['決', '決着(第 3 版)', () => finaleShot(NEW, true, false), true], ['特', '決着の特別版(第 3 版)', () => finaleShot(NEW, true, true), true],
              ['前', '10 れんさ(第 2 版)', () => chainShot(OLD, 10, false)], ['前', '決着(第 2 版)', () => finaleShot(OLD, false, false)]],
      picks: ['この溜めがよい', '溜めはいらない', 'もっと長く・大きく'] },
    { id: 'timbre', title: '当たりの音色', tag: '一番よく鳴る音 ・ れんさ 1 → 10', why: '3 つとも「ポン」+澄んだ芯に作り直しました。予定はガラス(おはじき)です。',
      plays: [['A', 'ガラス(予定)', () => with_('timbre', 'glass', 2600, () => chainShot(NEW, 9, false)), true],
              ['B', '木琴', () => with_('timbre', 'marimba', 2600, () => chainShot(NEW, 9, false))],
              ['C', '鈴', () => with_('timbre', 'bell', 2600, () => chainShot(NEW, 9, false))]],
      picks: ['A', 'B', 'C'] },
  ];
  const OTHERS = [['強打', 'strong'], ['場外', 'ring'], ['撃破(割れる)', 'break'], ['花火(1 発目)', 'blast', { k2: 1 }], ['花火(2 発目から)', 'blast', { k2: 2 }], ['必殺を撃つ', 'ultFire'], ['ゲージ割り', 'gauge'],
                  ['節目の和音(5 れんさ)', 'chord', { notes: 3, n: 5, low: true }], ['勝ち', 'win'], ['負け', 'lose'], ['もう 1 手', 'bonus'], ['おやつ', 'pickup'], ['ぶつけ', 'crash'],
                  ['玉突き', 'relay'], ['発射(強)', 'shoot', { p: 3 }], ['味方がやられた', 'harm']];

  // ---- これまでに決めたこと ----
  for (const t of ['れんさの音: 半音ずつ上がる', '引っぱりの段: ドミソ', '立ち上がり: 8 ミリ秒', '高さのゆらし: ±0.5 半音', '声の間は効果音を下げる', '勝ちの音: 最後を伸ばす',
                   '音を層で作る(第 2 版で「よいね」)', '合成の声(ナイス!・すごい!)はやめて、自然な英語の声に替える']) { const li = document.createElement('li'); li.textContent = t; $('applied').append(li); }
  // ---- 声を選ぶ ----
  const vs = $('voices');
  for (const [v, ja] of VOICES) {
    const lab = document.createElement('label'); lab.className = 'pick';
    const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'voice'; inp.id = 'voice-' + v; inp.value = v;
    inp.checked = (pick.voice || FXT.sound.voiceName) === v;
    inp.addEventListener('change', () => { pick.voice = v; save(); summary(); if (NEW) { NEW.set('voiceName', v); } });
    const sp = document.createElement('span'); sp.textContent = ja; lab.append(inp, sp); vs.append(lab);
  }
  const ws = $('words');
  for (const [m, ja, opts] of MOMENTS) {
    const row = document.createElement('div'); row.className = 'wordrow';
    const name = document.createElement('span'); name.className = 'moment'; name.textContent = ja; row.append(name);
    const fs = document.createElement('div'); fs.className = 'wordopts';
    for (const w of opts) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'word' + (line(m) === w ? ' on' : ''); b.id = 'w-' + m + '-' + w;
      b.textContent = FXT.sound.voiceText[w]; b.setAttribute('aria-pressed', line(m) === w ? 'true' : 'false');
      b.addEventListener('click', () => {
        ensure(); NEW.set('voiceName', pick.voice || FXT.sound.voiceName);
        NEW.loadClips((k) => k.endsWith('.' + (pick.voice || FXT.sound.voiceName))).then(() => NEW.play('callout', { line: w }));
        if (opts.length > 1) { pick['w_' + m] = w; save(); for (const x of fs.children) { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); } summary(); }
      });
      fs.append(b);
    }
    row.append(fs); ws.append(row);
  }

  const cards = $('cards');
  for (const c of CARDS) {
    const sec = document.createElement('section'); sec.className = 'card'; sec.setAttribute('aria-labelledby', 'h-' + c.id);
    const h = document.createElement('h2'); h.id = 'h-' + c.id; h.textContent = c.title;
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = c.tag; h.append(tag);
    const why = document.createElement('p'); why.className = 'why'; why.textContent = c.why;
    const plays = document.createElement('div'); plays.className = 'plays';
    c.plays.forEach(([k, label, fn, planned], idx) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'play' + (planned ? ' planned' : ''); b.id = 'p-' + c.id + '-' + idx;
      const badge = document.createElement('b'); badge.textContent = k; b.append(badge, document.createTextNode('聴く: ' + label));
      b.addEventListener('click', () => { ensure(); NEW.loadClips((x) => x.endsWith('.' + (pick.voice || FXT.sound.voiceName))).then(fn); });
      plays.append(b);
    });
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend'); lg.textContent = '選ぶ'; fs.append(lg);
    c.picks.forEach((p, idx) => {
      const lab = document.createElement('label'); lab.className = 'pick';
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'pick-' + c.id; inp.id = 'pick-' + c.id + '-' + idx; inp.value = p; inp.checked = pick[c.id] === p;
      inp.addEventListener('change', () => { pick[c.id] = p; save(); summary(); });
      const sp = document.createElement('span'); sp.textContent = p;
      lab.append(inp, sp); fs.append(lab);
    });
    sec.append(h, why, plays, fs);
    cards.append(sec);
  }
  for (const [label, id, q] of OTHERS) {
    const row = document.createElement('div'); row.className = 'pair';
    const name = document.createElement('span'); name.textContent = label;
    const bn = document.createElement('button'); bn.type = 'button'; bn.textContent = '新'; bn.className = 'planned-mini'; bn.setAttribute('aria-label', label + '(第 3 版)');
    bn.addEventListener('click', () => { ensure(); NEW.play(id, q || {}); });
    const b1 = document.createElement('button'); b1.type = 'button'; b1.textContent = '第 2 版'; b1.setAttribute('aria-label', label + '(第 2 版)');
    b1.addEventListener('click', () => { ensure(); OLD.play(id, q || {}); });
    row.append(name, bn, b1);
    $('others').append(row);
  }
  function summary() {
    const v = VOICES.find((x) => x[0] === (pick.voice || '')) ;
    const lines = ['声: ' + (v ? v[1] + '(' + v[0] + ')' : '(まだ)')]
      .concat(MOMENTS.filter((m) => m[2].length > 1).map((m) => m[1] + 'の掛け声: ' + (pick['w_' + m[0]] ? FXT.sound.voiceText[pick['w_' + m[0]]] : '(まだ)')))
      .concat(CARDS.map((c) => c.title + ': ' + (pick[c.id] || '(まだ)')));
    $('sum').textContent = '音の聴き比べ 第 3 版の結果\n' + lines.join('\n');
  }
  summary();
  $('copy').addEventListener('click', () => {
    const t = $('sum').textContent;
    const done = () => { $('copied').textContent = 'コピーしました。会話に貼り付けてください。'; };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('sum')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('copied').textContent = '選択しました。長押しでコピーしてください。'; };
    try { navigator.clipboard.writeText(t).then(done, fallback); } catch (e) { fallback(); }
  });
})();
