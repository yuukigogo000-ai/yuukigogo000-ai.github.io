// 音の一覧 最終版(fx/lab/build.mjs が tokens.js・audio.js と 1 つにまとめる)
// 歩み: 第 1 版 → 第 2 版「よいね」→ 第 3 版(爽快感)→ 最終版(発注者「声いらん。声なしで最終版」2026-11-16)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let A = null;
  const ensure = () => { if (!A) A = createAudio({}); A.unlock(); };
  const at = (ms, fn) => setTimeout(fn, ms);
  const pan = (n) => ((n * 37) % 9 - 4) / 10;

  // れんさの手を 1 本(10 れんさの直前に溜め)
  function chainShot(upto) {
    let t = 0;
    for (let n = 1; n <= upto; n++) {
      if (n === 10) { const tr = t; at(tr, () => A.play('riser', { ms: FXT.sound.riser.leadMs, top: 1760 })); t += FXT.sound.riser.leadMs; }
      at(t, () => {
        A.play('hit', { n, pan: pan(n) });
        if (n === 3) A.play('chord', { notes: 2, n });
        if (n === 5) A.play('chord', { notes: 3, n, low: true });
        if (n >= 10) A.play('chord', { notes: 4, n, low: true });
      });
      t += 170;
    }
  }
  // 1 手を通しで: 引っぱり → 発射 → 6 れんさ(2 発目が強打)→ 場外 → もう 1 手
  function fullShot() {
    [1, 2, 3].forEach((p, k) => at(k * 240, () => A.play('step', { p })));
    at(820, () => A.play('shoot', { p: 3 }));
    let t = 1000;
    for (let n = 1; n <= 6; n++) {
      at(t, () => {
        A.play('hit', { n, pan: pan(n) });
        if (n === 2) A.play('strong');
        if (n === 3) A.play('chord', { notes: 2, n });
        if (n === 5) A.play('chord', { notes: 3, n, low: true });
      });
      t += n === 5 ? 320 : 180;
    }
    at(t, () => A.play('ring'));
    at(t + 650, () => A.play('bonus'));
  }
  // 決着: 減速と一緒に溜めが上がり、当たった瞬間に放つ → 勝ち
  function finaleShot(special) {
    const lead = 750;
    A.play('riser', { ms: lead, top: 2093 });
    at(lead, () => { A.play(special ? 'break' : 'ring'); A.play('finale', { special }); });
    at(lead + 1300, () => A.play('win'));
  }

  const SCENES = [
    { title: '1 手を通しで', tag: '引っぱり → 発射 → 6 れんさ → 場外 → もう 1 手', why: '引っぱりの段はドミソで上がり、当たりは「ポン」と弾けて半音ずつ高くなります。れんさが伸びるほど音の層が増えて、左右に広がります。', play: fullShot },
    { title: '10 れんさ', tag: '溜めて放つ', why: '10 れんさになる当たりは、離した時点で先に分かっています。その直前に「キュイーン」と溜め、当たった瞬間に厚い和音で放ちます。', play: () => chainShot(10) },
    { title: '決着', tag: '最後の敵', why: '当たる前から減速し、溜めが上がりきったところで決着の一撃、続けて勝ちの音です。', play: () => finaleShot(false) },
    { title: '決着の特別版', tag: '1 手で 3 体以上', why: '割れる音と、もう一段の低音・きらめき・開いていく和音を重ねます。', play: () => finaleShot(true) },
  ];
  const ONES = [['当たり(れんさ 1)', 'hit', { n: 1 }], ['当たり(れんさ 9)', 'hit', { n: 9 }], ['強打', 'strong'], ['節目の和音(3 れんさ)', 'chord', { notes: 2, n: 3 }],
                ['節目の和音(5 れんさ)', 'chord', { notes: 3, n: 5, low: true }], ['場外', 'ring'], ['撃破(割れる)', 'break'], ['花火(1 発目)', 'blast', { k2: 1 }],
                ['花火(2 発目から)', 'blast', { k2: 2 }], ['必殺を撃つ', 'ultFire'], ['ゲージ割り', 'gauge'], ['もう 1 手', 'bonus'], ['おやつ', 'pickup'], ['ぶつけ', 'crash'],
                ['玉突き', 'relay'], ['輪ゴムの柱', 'bumper'], ['発射(強)', 'shoot', { p: 3 }], ['引っぱりの段(強)', 'step', { p: 3 }], ['取り消し', 'cancel'],
                ['味方がやられた', 'harm'], ['柵に当たる', 'rail', { v: 900 }], ['勝ち', 'win'], ['負け', 'lose']];

  const cards = $('cards');
  SCENES.forEach((c, idx) => {
    const sec = document.createElement('section'); sec.className = 'card'; sec.setAttribute('aria-labelledby', 'h-s' + idx);
    const h = document.createElement('h2'); h.id = 'h-s' + idx; h.textContent = c.title;
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = c.tag; h.append(tag);
    const why = document.createElement('p'); why.className = 'why'; why.textContent = c.why;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'play planned'; b.id = 'p-s' + idx;
    const badge = document.createElement('b'); badge.textContent = String(idx + 1); b.append(badge, document.createTextNode('聴く'));
    b.addEventListener('click', () => { ensure(); c.play(); });
    const row = document.createElement('div'); row.className = 'plays'; row.append(b);
    sec.append(h, why, row);
    cards.append(sec);
  });
  for (const [label, id, q] of ONES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'one'; b.id = 'o-' + id + (q ? '-' + Object.values(q).join('-') : '');
    b.textContent = label;
    b.addEventListener('click', () => { ensure(); A.play(id, q || {}); });
    $('others').append(b);
  }
})();
