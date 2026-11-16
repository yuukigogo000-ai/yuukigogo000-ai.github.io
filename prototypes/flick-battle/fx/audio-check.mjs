// はじきバトル 音の検査(実ブラウザの OfflineAudioContext で波形を作って測る。音は鳴らさない)
//   NODE_PATH=$(npm root -g) node fx/audio-check.mjs [--mutate]
// 測るもの: 割れない(最大振幅) / 立ち上がりで「プチッ」と鳴らない / れんさの音が 5 音階どおり / 引っぱりの段がドミソ /
//           音の長さが上限以内 / 同時に鳴る数の上限 / 呼びかけの間に効果音が下がる
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const rd = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const strip = (js) => js.replace(/^import .*$/gm, '').replace(/^export (const|function|let)/gm, '$1');
const wrap = (js) => { const names = [...js.matchAll(/^export (?:const|function|let) (\w+)/gm)].map((m) => m[1]); return 'const { ' + names.join(', ') + ' } = (function () {\n' + strip(js) + '\nreturn { ' + names.join(', ') + ' };\n})();'; };
const code = wrap(rd('./tokens.js')) + '\n' + wrap(rd('./audio.js')) + '\nglobalThis.FXT = FXT; globalThis.createAudio = createAudio;';
const MUT = process.argv.includes('--mutate');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: code });

async function run(over) {
  return page.evaluate(async (over) => {
    const SR = 48000;
    const render = async (sec, fn, opt) => {
      const ctx = new OfflineAudioContext(1, Math.round(SR * sec), SR);
      const a = createAudio(Object.assign({ ctx, jitter: 0 }, opt || {}, over.opt || {}));
      fn(a);
      const buf = await ctx.startRendering();
      return { d: buf.getChannelData(0), a };
    };
    const peak = (d, i0, i1) => { let m = 0; for (let k = i0 || 0; k < (i1 || d.length); k++) m = Math.max(m, Math.abs(d[k])); return m; };
    const onset = (d) => { const p = peak(d); for (let k = 0; k < d.length; k++) if (Math.abs(d[k]) > p * 0.02) return k; return 0; };
    const lastAudible = (d) => { for (let k = d.length - 1; k >= 0; k--) if (Math.abs(d[k]) > 0.003) return k / SR; return 0; };
    // 基本の高さ(自己相関)
    const pitch = (d, i0, n) => {
      let best = 0, bl = 0;
      for (let lag = Math.floor(SR / 1500); lag < Math.floor(SR / 80); lag++) { let s = 0; for (let k = i0; k < i0 + n; k++) s += d[k] * d[k + lag]; if (s > best) { best = s; bl = lag; } }
      return bl ? SR / bl : 0;
    };
    const out = { ids: {}, hits: [], steps: {}, cap: 0, duck: null };
    // 1・2・5: 全部の音の最大振幅・立ち上がり・長さ
    for (const id of createAudio({ ctx: new OfflineAudioContext(1, 10, SR) }).names()) {
      const { d } = await render(2.5, (a) => a.play(id, { n: 5, notes: 3, layers: 2, v: 800, k2: 1, special: true, p: 3 }));
      const p = peak(d), o = onset(d);
      out.ids[id] = { peak: +p.toFixed(3), click: p ? +(peak(d, o, o + Math.round(SR * 0.0008)) / p).toFixed(2) : 0, len: +lastAudible(d).toFixed(2) };
    }
    // 3: れんさ 1〜10 の高さ
    for (let n = 1; n <= 10; n++) { const { d, a } = await render(0.2, (a) => a.play('hit', { n })); const o = onset(d) + Math.round(SR * 0.012); const sc = FXT.sound.scales[FXT.sound.scale], k = Math.min(FXT.sound.chainCap, n) - 1, semi = sc[k % sc.length] + 12 * Math.floor(k / sc.length); // 予定の高さは正本(tokens)から
      out.hits.push({ n, hz: +pitch(d, o, 1200).toFixed(1), want: +(FXT.sound.chainBaseHz * Math.pow(2, semi / 12)).toFixed(1) }); }
    // 4: 引っぱりの段(新旧)
    for (const set of ['new', 'legacy']) { out.steps[set] = []; for (let p = 1; p <= 3; p++) { const { d } = await render(0.12, (a) => a.play('step', { p }), set === 'new' ? {} : { step: set }); const o = onset(d) + Math.round(SR * 0.01); out.steps[set].push(+pitch(d, o, 1000).toFixed(1)); } }
    // 割れない: いちばん重なる場面(当たり 20・和音・決着・呼びかけを同時に)
    { const { d } = await render(1.5, (a) => { for (let k = 0; k < 20; k++) a.play('hit', { n: k % 10 + 1 }); a.play('chord', { notes: 4, n: 10, low: true }); a.play('finale', { special: true }); a.play('callout', { layers: 3 }); }); out.stressPeak = +peak(d).toFixed(3); }
    // 呼びかけは当たりの音に押し出されない(優先度)
    { const ctx = new OfflineAudioContext(1, SR, SR); const a = createAudio(Object.assign({ ctx }, over.opt || {})); a.play('callout', { layers: 1 }); for (let k = 0; k < 20; k++) a.play('hit', { n: 3 }); const d = (await ctx.startRendering()).getChannelData(0); out.calloutKept = +peak(d, Math.round(SR * 0.2), Math.round(SR * 0.35)).toFixed(3); }
    // 6: 同時に 20 個鳴らしても上限まで
    { const ctx = new OfflineAudioContext(1, SR, SR); const a = createAudio(Object.assign({ ctx }, over.opt || {})); for (let k = 0; k < 20; k++) a.play('hit', { n: k % 10 + 1 }); out.cap = a.liveCount(); }
    // 7: 呼びかけの間の効果音(呼びかけなしと比べた音量)
    {
      const hitsOnly = (await render(0.6, (a) => { for (let k = 0; k < 4; k++) a.play('hit', { n: 3 }); })).d;
      const both = (await render(0.6, (a) => { a.play('callout', { layers: 1 }); for (let k = 0; k < 4; k++) a.play('hit', { n: 3 }); }, {})).d;
      const voice = (await render(0.6, (a) => a.play('callout', { layers: 1 }))).d;
      // 効果音の成分 ≒ both − voice。0.1 秒時点の付近で、呼びかけなしの効果音と比べる
      let e1 = 0, e2 = 0; const i0 = Math.round(SR * 0.08), i1 = Math.round(SR * 0.12);
      for (let k = i0; k < i1; k++) { e1 += hitsOnly[k] * hitsOnly[k]; const x = both[k] - voice[k]; e2 += x * x; }
      out.duck = +(10 * Math.log10((e2 + 1e-12) / (e1 + 1e-12))).toFixed(1);
    }
    return out;
  }, over || {});
}

function judge(r) {
  const bad = [];
  for (const [id, v] of Object.entries(r.ids)) {
    if (v.peak > 1.0) bad.push(id + ' が割れる(' + v.peak + ')');
    if (v.click > 0.6) bad.push(id + ' の立ち上がりが急(' + v.click + ')');
    const max = id === 'callout' || id === 'finale' || id === 'gauge' || id === 'win' ? 1.6 : 0.8;
    if (v.len > max) bad.push(id + ' が長い(' + v.len + '秒)');
  }
  for (const h of r.hits) if (Math.abs(h.hz / h.want - 1) > 0.03) bad.push('れんさ ' + h.n + ' の高さ ' + h.hz + 'Hz(予定 ' + h.want + ')');
  const ratio = (a, b) => 12 * Math.log2(b / a);
  const st = r.steps.new, th = Math.round(ratio(st[0], st[2]));
  if (th !== 7) bad.push('引っぱりの段の 1→3 が ' + th + ' 半音(ドミソなら 7)');
  if (r.cap > 6) bad.push('同時に ' + r.cap + ' 音');
  if (!(r.calloutKept > 0.01)) bad.push('呼びかけが当たりの音に押し出される');
  if (r.stressPeak > 1.0) bad.push('いちばん重なる場面で割れる(' + r.stressPeak + ')');
  if (r.duck > -3) bad.push('呼びかけの間に効果音が下がらない(' + r.duck + 'dB)');
  return bad;
}

const base = await run();
const bad = judge(base);
const st = base.steps, rr = (a, b) => (12 * Math.log2(b / a)).toFixed(1);
console.log('れんさ 1〜10 の高さ:', base.hits.map((h) => Math.round(h.hz)).join(' '), 'Hz(5 音階・10 で頭打ち)');
console.log('引っぱりの段 1→2→3: 新 ' + rr(st.new[0], st.new[1]) + ' / ' + rr(st.new[0], st.new[2]) + ' 半音、旧 ' + rr(st.legacy[0], st.legacy[1]) + ' / ' + rr(st.legacy[0], st.legacy[2]) + ' 半音(旧は増三和音)');
console.log('同時に鳴る数(20 個鳴らしたとき):', base.cap, '/ いちばん重なる場面の最大振幅:', base.stressPeak, '/ 呼びかけの間の効果音:', base.duck, 'dB');
console.log('音ごと(最大振幅・立ち上がり・長さ):', Object.entries(base.ids).map(([k, v]) => k + ' ' + v.peak + '/' + v.click + '/' + v.len + 's').join('  '));
console.log(bad.length ? '× ' + bad.join(' / ') : '○ すべて合格');
let code2 = bad.length ? 1 : 0;
if (MUT) {
  const muts = [['立ち上がりを 0 にする(今の仮の画面と同じ)', { opt: { attackMs: 0 } }], ['れんさを半音にする', { opt: { scale: 'semitone' } }], ['ダッキングを外す', { opt: { duck: false } }], ['引っぱりの段を旧(増三和音)にする', { opt: { step: 'legacy' } }]];
  let caught = 0;
  for (const [name, over] of muts) { const r = await run(over); const b = judge(r); if (b.length) caught++; else console.log('  見逃し: ' + name); }
  console.log(`自己検査: 入れた故障 ${muts.length} 件中 ${caught} 件を検出`);
  if (caught !== muts.length) code2 = 1;
}
await browser.close();
process.exit(code2);
