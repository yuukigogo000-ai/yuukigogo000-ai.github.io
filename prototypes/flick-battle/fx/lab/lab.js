// 音の聴き比べ台 第 2 版(fx/lab/build.mjs が tokens.js・audio.js・audio-v1.js と 1 つにまとめる)
// 第 1 版で選んでもらった結果を反映し、音色を層で作り直した(発注者「音色がショボい。もっと爽快感」2026-11-16)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let NEW = null, OLD = null; // 第 2 版と、第 1 版(前回の音)
  function ensure() {
    if (!NEW) { NEW = createAudio({}); OLD = createAudioV1({ scale: 'semitone' }); }
    NEW.unlock(); OLD.unlock();
  }
  const at = (ms, fn) => setTimeout(fn, ms);
  const with_ = (k, v, ms, fn) => { const prev = NEW.get(k); NEW.set(k, v); fn(); at(ms, () => NEW.set(k, prev)); };
  // れんさの手を 1 本まねる: 当たり 1 つごとに音が上がり、3・5・10 で和音、最高の節目で 1 回だけ呼びかけ
  function chainShot(a, upto, opt) {
    let t = 0;
    const top = upto >= 10 ? 10 : upto >= 5 ? 5 : 0;
    for (let n = 1; n <= upto; n++) {
      if (n === 10) t += FXT.chain[10].preSilenceMs;
      at(t, () => {
        a.play('hit', { n, pan: ((n * 37) % 9 - 4) / 10 });
        if (n === 3) a.play('chord', { notes: 2, n });
        if (n === 5) a.play('chord', { notes: 3, n, low: true });
        if (n >= 10) a.play('chord', { notes: 4, n, low: true });
        if (!(opt && opt.callout === false) && n === top) a.play('callout', { layers: top === 10 ? (upto > 10 ? 3 : 2) : 1 });
      });
      t += 170;
    }
    return t;
  }
  // 1 手を通しで: 引っぱり(段 3 回)→ 発射 → 当たり 6 つ(2 発目が強打)→ 和音 → 呼びかけ → 最後に場外 → もう 1 手
  function fullShot(a) {
    [1, 2, 3].forEach((p, k) => at(k * 240, () => a.play('step', { p })));
    at(820, () => a.play('shoot', { p: 3 }));
    let t = 1000;
    for (let n = 1; n <= 6; n++) {
      const tn = t;
      at(tn, () => {
        a.play('hit', { n, pan: ((n * 37) % 9 - 4) / 10 });
        if (n === 2) a.play('strong');
        if (n === 3) a.play('chord', { notes: 2, n });
        if (n === 5) { a.play('chord', { notes: 3, n, low: true }); a.play('callout', { layers: 1 }); }
      });
      t += n === 5 ? 320 : 180;
    }
    at(t, () => a.play('ring'));
    at(t + 650, () => a.play('bonus'));
  }

  const CARDS = [
    { id: 'whole', title: '1 手を通しで', tag: '引っぱり → 発射 → 6 れんさ → 場外 → もう 1 手', why: '前回の音と、作り直した音(第 2 版)を同じ流れで比べます。第 2 版は 1 つの音を「カチッという立ち上がり・音の芯・きらめき・部屋の響き」の層で作り、スマホのスピーカーでも聞こえるように低い音をひずませて倍音を足しています。',
      plays: [['新', '第 2 版', () => fullShot(NEW), true], ['前', '前回', () => fullShot(OLD)]],
      picks: ['第 2 版がよい', '前回がよい', 'まだ物足りない'] },
    { id: 'timbre', title: '当たりの音色', tag: '一番よく鳴る音 ・ れんさ 1 → 10', why: 'おはじきはガラスの玉なので、予定は「ガラス」です。木琴は柔らかく、鈴は長く響きます。高さは選んでもらったとおり半音ずつ上がります。',
      plays: [['A', 'ガラス(予定)', () => with_('timbre', 'glass', 2600, () => chainShot(NEW, 10, { callout: false })), true],
              ['B', '木琴', () => with_('timbre', 'marimba', 2600, () => chainShot(NEW, 10, { callout: false }))],
              ['C', '鈴', () => with_('timbre', 'bell', 2600, () => chainShot(NEW, 10, { callout: false }))]],
      picks: ['A', 'B', 'C'] },
    { id: 'voice', title: '呼びかけ(声)', tag: '5 れんさ「ナイス!」・10 れんさ「すごい!」', why: '「もっと声らしく」を受けて、声の作りを変えました。母音の響きを 3 つの山で作り、ビブラートと息の音を足し、子音(ス・ゴ・ナ)も短い無音や息で作っています。録音の声ではありません。C は端末に入っている読み上げの声で、機種によって声が変わります。',
      plays: [['A', '合成の声で言葉(5 れんさ)', () => with_('voice', 'words', 2000, () => chainShot(NEW, 7)), true],
              ['A', '合成の声で言葉(10 れんさ)', () => with_('voice', 'words', 2600, () => chainShot(NEW, 10)), true],
              ['B', '合成の声・母音だけ(10 れんさ)', () => with_('voice', 'vowel', 2600, () => chainShot(NEW, 10))],
              ['C', '端末の読み上げ(10 れんさ)', () => with_('voice', 'tts', 2600, () => chainShot(NEW, 10))],
              ['前', '前回(10 れんさ)', () => chainShot(OLD, 10)]],
      picks: ['A', 'B', 'C', 'どれもまだ声らしくない'] },
    { id: 'finale', title: '決着の音', tag: '最後の敵を倒した瞬間', why: '「もっと派手に」を受けて、大きな一撃・シンバル・開いていく和音・上がるきらめきを重ねました。1 手で 3 体以上まとめて倒した特別版は、もう一段の低音・きらめき・歓声の「あー」を足します。',
      plays: [['1', 'ふつう', () => NEW.play('finale', {}), true], ['2', '特別版', () => NEW.play('finale', { special: true }), true], ['前', '前回', () => OLD.play('finale', {})]],
      picks: ['このままでよい', 'もっと派手に', '派手すぎる'] },
    { id: 'strong', title: '強打の音', tag: '1 回', why: '「カッ」という立ち上がり、ひずませた低い「ドン」、割れる帯域の「バキッ」、ガラスの響きを重ねました。',
      plays: [['新', '第 2 版', () => NEW.play('strong'), true], ['前', '前回', () => OLD.play('strong')]],
      picks: ['第 2 版がよい', '前回がよい', 'まだ物足りない'] },
  ];
  const OTHERS = [['場外', 'ring'], ['撃破(割れる)', 'break'], ['花火(1 発目)', 'blast', { k2: 1 }], ['花火(2 発目から)', 'blast', { k2: 2 }], ['必殺を撃つ', 'ultFire'], ['ゲージ割り', 'gauge'],
                  ['勝ち', 'win'], ['負け', 'lose'], ['もう 1 手', 'bonus'], ['おやつ', 'pickup'], ['ぶつけ', 'crash'], ['玉突き', 'relay'], ['輪ゴムの柱', 'bumper'],
                  ['発射(強)', 'shoot', { p: 3 }], ['味方がやられた', 'harm'], ['柵に当たる', 'rail', { v: 900 }]];
  const APPLIED = ['れんさの音の上がり方: 半音ずつ(B)', '引っぱりの段の音: ドミソ(A)', '音の立ち上がり: 8 ミリ秒(A)', '同じ音の高さのゆらし: ±0.5 半音(A)',
                   '呼びかけの間に効果音を下げる: 下げる(A)', '勝ちの音: 最後を伸ばす(A)'];

  const KEY = 'flick-lab-picks-v2';
  let picks = {};
  try { picks = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { picks = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch (e) { /* 覚えられなくても続ける */ } };

  const ap = $('applied');
  for (const t of APPLIED) { const li = document.createElement('li'); li.textContent = t; ap.append(li); }
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
      b.addEventListener('click', () => { ensure(); fn(); });
      plays.append(b);
    });
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend'); lg.textContent = '選ぶ'; fs.append(lg);
    for (const p of c.picks) {
      const lab = document.createElement('label'); lab.className = 'pick';
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'pick-' + c.id; inp.id = 'pick-' + c.id + '-' + c.picks.indexOf(p); inp.value = p; inp.checked = picks[c.id] === p;
      inp.addEventListener('change', () => { picks[c.id] = p; save(); summary(); });
      const sp = document.createElement('span'); sp.textContent = p;
      lab.append(inp, sp); fs.append(lab);
    }
    sec.append(h, why, plays, fs);
    cards.append(sec);
  }
  for (const [label, id, q] of OTHERS) {
    const row = document.createElement('div'); row.className = 'pair';
    const name = document.createElement('span'); name.textContent = label;
    const bn = document.createElement('button'); bn.type = 'button'; bn.textContent = '新'; bn.className = 'planned-mini'; bn.setAttribute('aria-label', label + '(第 2 版)');
    bn.addEventListener('click', () => { ensure(); NEW.play(id, q || {}); });
    row.append(name, bn);
    const b1 = document.createElement('button'); b1.type = 'button'; b1.textContent = '前回'; b1.setAttribute('aria-label', label + '(前回)');
    b1.addEventListener('click', () => { ensure(); if (!OLD.play(id, q || {})) { $('copied').textContent = label + 'は前回の音がありません(第 2 版で新しく作った音です)'; } });
    row.append(b1);
    $('others').append(row);
  }
  function summary() {
    const lines = CARDS.map((c) => c.title + ': ' + (picks[c.id] || '(まだ)'));
    $('sum').textContent = '音の聴き比べ 第 2 版の結果\n' + lines.join('\n');
  }
  summary();
  $('copy').addEventListener('click', () => {
    const t = $('sum').textContent;
    const done = () => { $('copied').textContent = 'コピーしました。会話に貼り付けてください。'; };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('sum')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('copied').textContent = '選択しました。長押しでコピーしてください。'; };
    try { navigator.clipboard.writeText(t).then(done, fallback); } catch (e) { fallback(); }
  });
})();
