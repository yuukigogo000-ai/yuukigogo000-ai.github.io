// はじきバトル 音の検査(実ブラウザの OfflineAudioContext で波形を作って測る。音は鳴らさない)
//   NODE_PATH=$(npm root -g) node fx/audio-check.mjs [--mutate]
// 測るもの(最終版): 割れない(いちばん重なる場面の最大振幅)/ 立ち上がりで「プチッ」と鳴らない / れんさの音が tokens の音階どおり /
//   引っぱりの段がドミソ / 音の長さが上限以内 / 同時に鳴る数の上限 / 決着が当たりの音に押し出されない /
//   溜め(riser)が当たる瞬間に一番大きくなる / 声の部品が残っていない(発注者「声いらん」)。
//   あわせて、第 2 版(fx/lab/audio-v2.js)との音量・明るさ・長さの比較を出す
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const rd = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const strip = (js) => js.replace(/^import .*$/gm, '').replace(/^export (const|function|let)/gm, '$1');
const wrap = (js) => { const names = [...js.matchAll(/^export (?:const|function|let) (\w+)/gm)].map((m) => m[1]); return 'const { ' + names.join(', ') + ' } = (function () {\n' + strip(js) + '\nreturn { ' + names.join(', ') + ' };\n})();'; };
const code = wrap(rd('./tokens.js')) + '\n' + wrap(rd('./audio.js')) + '\n' + wrap(rd('./lab/audio-v2.js')) +
  '\nglobalThis.FXT = FXT; globalThis.createAudio = createAudio; globalThis.createAudioV2 = createAudioV2; globalThis.FXT_ORIG = JSON.stringify(FXT.sound);';
const MUT = process.argv.includes('--mutate');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: code });

async function run(over) {
  return page.evaluate(async (over) => {
    Object.assign(FXT.sound, JSON.parse(FXT_ORIG)); // 前の自己検査で変えた数値を戻す
    if (over.tamper) over.tamper.split(';').forEach((kv) => { const [k, v] = kv.split('='); const ks = k.split('.'); let o = FXT.sound; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = JSON.parse(v); });
    const SR = 48000;
    const render = async (sec, fn, opt, mk) => {
      const ctx = new OfflineAudioContext(2, Math.round(SR * sec), SR);
      const a = (mk || createAudio)(Object.assign({ ctx, jitter: 0 }, opt || {}, over.opt || {}));
      fn(a);
      const buf = await ctx.startRendering();
      return { d: buf.getChannelData(0), a };
    };
    const peak = (d, i0, i1) => { let m = 0; for (let k = i0 || 0; k < (i1 || d.length); k++) m = Math.max(m, Math.abs(d[k])); return m; };
    const onset = (d) => { const p = peak(d); for (let k = 0; k < d.length; k++) if (Math.abs(d[k]) > p * 0.02) return k; return 0; };
    const lastAudible = (d) => { for (let k = d.length - 1; k >= 0; k--) if (Math.abs(d[k]) > 0.003) return k / SR; return 0; };
    const stat = (d) => { const L = Math.max(1, Math.round(lastAudible(d) * SR)); let ss = 0, num = 0, prev = 0; for (let k = 0; k < L; k++) { ss += d[k] * d[k]; const dx = d[k] - prev; prev = d[k]; num += dx * dx; }
      return { peak: +peak(d).toFixed(2), db: +(10 * Math.log10(ss / L + 1e-12)).toFixed(1), bright: ss ? Math.round(Math.sqrt(num / ss) * SR / (2 * Math.PI)) : 0, len: +(L / SR).toFixed(2) }; };
    const pitch = (d, i0, n, lo) => { // 一番強い山の 9 割以上ある、いちばん短い周期の山を選ぶ(1 オクターブ下に間違えないため)
      const l0 = Math.floor(SR / 1500), l1 = Math.floor(SR / (lo || 120)), c = [];
      for (let lag = l0; lag <= l1; lag++) { let s = 0; for (let k = i0; k < i0 + n; k++) s += d[k] * d[k + lag]; c.push(s); }
      const best = Math.max(...c);
      for (let j = 1; j < c.length - 1; j++) if (c[j] >= best * 0.9 && c[j] >= c[j - 1] && c[j] >= c[j + 1]) return SR / (j + l0);
      return 0;
    };
    const Q = { n: 5, notes: 3, k2: 1, special: true, p: 3, low: true, ms: 400, v: 800 };
    const out = { ids: {}, cmp: {}, hits: [], steps: [], cap: 0 };
    const names = createAudio({ ctx: new OfflineAudioContext(1, 10, SR) }).names();
    out.voiceLeft = names.filter((n) => /callout|voice|say/.test(n));
    // 1・2・5: 全部の音の最大振幅・立ち上がり・長さ(+第 2 版との比較)
    const v2names = createAudioV2({ ctx: new OfflineAudioContext(1, 10, SR) }).names();
    for (const id of names) {
      const { d } = await render(3, (a) => a.play(id, Q));
      const p = peak(d), o = onset(d);
      out.ids[id] = { peak: +p.toFixed(3), click: p ? +(peak(d, o, o + Math.round(SR * 0.00025)) / p).toFixed(2) : 0, len: +lastAudible(d).toFixed(2) };
      if (v2names.includes(id)) out.cmp[id] = { v1: stat((await render(3, (a) => a.play(id, Q), { scale: 'semitone' }, createAudioV2)).d), v2: stat(d) };
    }
    // 3: れんさ 1〜10 の高さ(鳴り始めの粒が消えた 90ms 以降の芯の高さ)
    for (let n = 1; n <= 10; n++) {
      const { d } = await render(0.4, (a) => a.play('hit', { n }));
      const sc = FXT.sound.scales[FXT.sound.scale], k = Math.min(FXT.sound.chainCap, n) - 1, semi = sc[k % sc.length] + 12 * Math.floor(k / sc.length);
      out.hits.push({ n, hz: +pitch(d, onset(d) + Math.round(SR * 0.09), 2400).toFixed(1), want: +(FXT.sound.chainBaseHz * Math.pow(2, semi / 12)).toFixed(1) });
    }
    // 4: 引っぱりの段(3 段目のきらめき(30ms 後)が入る前の芯を、ドミソの音域で測る)
    for (let p = 1; p <= 3; p++) { const { d } = await render(0.3, (a) => a.play('step', { p })); out.steps.push(+pitch(d, onset(d) + Math.round(SR * 0.004), 1000, 300).toFixed(1)); }
    // 割れない: いちばん重なる場面(当たり 20・和音・決着の特別版・花火・強打・溜めを同時に)
    { const { d } = await render(2, (a) => { a.play('riser', { ms: 300 }); for (let k = 0; k < 20; k++) a.play('hit', { n: k % 10 + 1 }); a.play('chord', { notes: 4, n: 10, low: true }); a.play('finale', { special: true }); a.play('blast', { k2: 1 }); a.play('strong'); }); out.stressPeak = +peak(d).toFixed(3); }
    // 決着は当たりの音に押し出されない(優先度)
    { const { d } = await render(1.2, (a) => { a.play('finale', {}); for (let k = 0; k < 20; k++) a.play('hit', { n: 3 }); }); out.finaleKept = +peak(d, Math.round(SR * 0.6), Math.round(SR * 0.9)).toFixed(3); }
    // 溜め: ms かけて上がり、最後の 2 割で一番大きくなる
    { const ms = 400, { d } = await render(0.7, (a) => a.play('riser', { ms })); let pk = 0, at = 0; for (let k = 0; k < d.length; k++) if (Math.abs(d[k]) > pk) { pk = Math.abs(d[k]); at = k; } out.riserPeakAt = +((at / SR) / (ms / 1000)).toFixed(2); }
    // 6: 同時に 20 個鳴らしても上限まで
    { const ctx = new OfflineAudioContext(2, SR, SR); const a = createAudio(Object.assign({ ctx }, over.opt || {})); for (let k = 0; k < 20; k++) a.play('hit', { n: k % 10 + 1 }); out.cap = a.liveCount(); }
    return out;
  }, over || {});
}

function judge(r) {
  const bad = [];
  if (r.voiceLeft.length) bad.push('声の部品が残っている(' + r.voiceLeft.join('・') + ')');
  for (const [id, v] of Object.entries(r.ids)) {
    if (v.click > 0.6) bad.push(id + ' の立ち上がりが急(' + v.click + ')');
    const max = ['finale', 'gauge', 'win', 'ultFire'].includes(id) ? 2.0 : 1.0;
    if (v.len > max) bad.push(id + ' が長い(' + v.len + '秒)');
  }
  for (const h of r.hits) if (Math.abs(h.hz / h.want - 1) > 0.03) bad.push('れんさ ' + h.n + ' の高さ ' + h.hz + 'Hz(予定 ' + h.want + ')');
  const st = r.steps, th = Math.round(12 * Math.log2(st[2] / st[0])), t2 = Math.round(12 * Math.log2(st[1] / st[0]));
  if (th !== 7 || t2 !== 4) bad.push('引っぱりの段が ' + t2 + '・' + th + ' 半音(ドミソなら 4・7)');
  if (r.cap > 6) bad.push('同時に ' + r.cap + ' 音');
  if (!(r.finaleKept > 0.01)) bad.push('決着の音が当たりの音に押し出される');
  if (r.stressPeak > 1.0) bad.push('いちばん重なる場面で割れる(' + r.stressPeak + ')');
  if (!(r.riserPeakAt > 0.8 && r.riserPeakAt < 1.15)) bad.push('溜めの一番大きいところが当たる瞬間からずれる(' + r.riserPeakAt + ')');
  return bad;
}

const base = await run();
const bad = judge(base);
console.log('れんさ 1〜10 の高さ:', base.hits.map((h) => Math.round(h.hz)).join(' '), 'Hz(半音ずつ・10 で頭打ち)');
console.log('引っぱりの段 1・2・3:', base.steps.map((h) => Math.round(h)).join(' '), 'Hz / 同時に鳴る数:', base.cap, '/ いちばん重なる場面の最大振幅:', base.stressPeak, '/ 溜めの山の位置:', base.riserPeakAt);
console.log('第 2 版 → 最終版(音量 dB・明るさ Hz・長さ 秒):');
for (const [id, c] of Object.entries(base.cmp)) console.log('  ' + id.padEnd(8) + ' 音量 ' + String(c.v1.db).padStart(6) + ' → ' + String(c.v2.db).padStart(6) + '  明るさ ' + String(c.v1.bright).padStart(5) + ' → ' + String(c.v2.bright).padStart(5) + '  長さ ' + c.v1.len + ' → ' + c.v2.len);
console.log(bad.length ? '× ' + bad.join(' / ') : '○ すべて合格');
let code2 = bad.length ? 1 : 0;
if (MUT) {
  const muts = [['れんさを 5 音階に戻す(tokens と食い違う)', { opt: { scale: 'pentatonic' } }], ['引っぱりの段を旧(増三和音)にする', { opt: { step: 'legacy' } }],
                ['同時の上限を外す', { opt: { voicesMax: 40 } }], ['響きを 4 秒に伸ばす(音がだらだら残る)', { tamper: 'reverb.seconds=4' }]];
  let caught = 0;
  for (const [name, over] of muts) { const r = await run(over); const b = judge(r); if (b.length) caught++; else console.log('  見逃し: ' + name); }
  console.log(`自己検査: 入れた故障 ${muts.length} 件中 ${caught} 件を検出`);
  if (caught !== muts.length) code2 = 1;
}
await browser.close();
process.exit(code2);
