// はじきバトル 演出の土台の検査(node fx/test.mjs)。--mutate で検査器自身が違反を見つけられるか確かめる。
//  1. 台本(先読み)が本物の進行と 1 刻み単位で一致する
//  2. 台本の計算が十分に速い
//  3. 指示表が演出の決まり(格表・色の意味・予算・呼びかけ 1 回)を守る
import * as E from '../engine/engine.js';
import { ally, mobBattle, bossBattle, LINEAGE_KEYS, ITEM_KEYS, PASSIVE_KEYS, EVOLUTIONS } from '../engine/data.js';
import { DIRS, POWERS } from '../engine/ai.js';
import { scriptShot } from './script.js';
import { planShot, auditPlan } from './director.js';
import { FXT } from './tokens.js';
import { SCENES, sceneState } from './scenes.js';
import { SCENE_INPUTS } from './scenes-inputs.js';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }
const NOGAP = { top: [], bottom: [], left: [], right: [] };
const dummy = (x, y, o) => Object.assign({ name: 'まと', hp: 100, atk: 10, weight: 3, action: 'blast', count: 9, actR: 10, x, y }, o);

function randomCfg(seed) {
  const rnd = E.mulberry32(seed);
  const pick = () => LINEAGE_KEYS[Math.floor(rnd() * LINEAGE_KEYS.length)];
  const gear = () => ({ item: ITEM_KEYS[Math.floor(rnd() * ITEM_KEYS.length)], passives: [PASSIVE_KEYS[Math.floor(rnd() * PASSIVE_KEYS.length)]] });
  const team = [ally(pick(), gear()), ally(pick(), gear()), ally(pick(), gear()), ally(pick(), gear())];
  if (seed % 3 === 0) { const e = EVOLUTIONS[seed % EVOLUTIONS.length]; team[0] = ally(pick(), { item: e.item, passives: [e.passive] }); }
  const kind = seed % 5;
  const cfg = kind === 0 ? bossBattle('vacuum', team) : kind === 1 ? bossBattle('washer', team) : kind === 2 ? bossBattle('fan', team)
    : mobBattle(['kitchen', 'living', 'attic'][seed % 3], team, [pick(), pick(), pick(), pick()], { traits: [null, 'hard', 'split', 'back'] });
  return { cfg, rnd };
}

// ---- 1・2・3: でたらめな手で、台本と本物を突き合わせる ---------------------------------
const plans = [];
{
  let shots = 0, sameEvents = 0, sameHash = 0, sameSteps = 0, tMax = 0, tSum = 0, audits = 0, firstBad = null;
  for (let seed = 1; seed <= 40; seed++) {
    const { cfg, rnd } = randomCfg(seed);
    const s = E.createBattle(cfg);
    s.fx = true;
    const memory = {};
    while (s.phase === 'aim' && s.shots < 40) {
      const d = DIRS[Math.floor(rnd() * DIRS.length)], p = POWERS[Math.floor(rnd() * 3)];
      const input = { dx: d[0], dy: d[1], power: p, ult: rnd() < 0.5 };
      const t0 = performance.now();
      const sc = scriptShot(s, input);
      const dt = performance.now() - t0; tSum += dt; if (dt > tMax) tMax = dt;
      if (!E.shoot(s, input)) break;
      const live = [];
      for (const e of s.events) live.push({ i: -1, e });
      s.events = [];
      let i = 0;
      while (s.phase === 'resolving') { E.step(s); for (const e of s.events) live.push({ i, e }); s.events = []; i++; }
      shots++;
      if (JSON.stringify(live) === JSON.stringify(sc.events.map((r) => ({ i: r.i, e: r.e })))) sameEvents++;
      if (E.hashState(s) === E.hashState(sc.end)) sameHash++;
      if (i === sc.steps) sameSteps++;
      for (const level of ['full', 'low', 'off']) for (const fast of [false, true]) {
        const plan = planShot(sc, { level, fast, memory: Object.assign({}, memory) });
        const v = auditPlan(plan);
        if (v.length) { audits++; if (!firstBad) firstBad = { seed, shot: s.shots, level, fast, v: v.slice(0, 3) }; }
        if (level === 'full' && !fast) plans.push({ sc, plan });
      }
      Object.assign(memory, planShot(sc, { memory }).memory);
    }
  }
  ok('台本の出来事が本物の進行と 1 刻み単位で一致(' + shots + ' 手)', sameEvents === shots, [sameEvents, shots]);
  ok('台本の最後の盤面が本物と同じ(ハッシュ)', sameHash === shots, [sameHash, shots]);
  ok('台本の刻みの数が本物と同じ', sameSteps === shots, [sameSteps, shots]);
  ok('台本の計算は 1 手あたり平均 4ms 未満(node)', tSum / shots < 4, +(tSum / shots).toFixed(2));
  ok('指示表はどの手でも演出の決まりを守る(演出の強さ 3 段 × 早送りの有無)', audits === 0, firstBad);
  console.log('  台本: ' + shots + ' 手 / 平均 ' + (tSum / shots).toFixed(2) + 'ms / 最長 ' + tMax.toFixed(1) + 'ms');
}

// ---- 実際の手で、格表どおりに振り分けているか -------------------------------------------
const run = (cfg, input, ctx) => { const s = E.createBattle(cfg); const sc = scriptShot(s, input); return { sc, plan: planShot(sc, ctx) }; };
const one = (allies, enemies, extra) => Object.assign({ gaps: NOGAP, allies, enemies }, extra);
const A = (o) => Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null }, o);
{
  const { plan } = run(one([A()], [dummy(180, 250)]), { dx: 0, dy: -1, power: 1 });
  const stops = plan.cues.filter((c) => c.k === 'stop');
  ok('ふつうの当たり: 1 発目だけ短く止める(30ms)', stops.length === 1 && stops[0].ms === FXT.tiers[0].firstHitStopMs, stops);
  const num = plan.cues.find((c) => c.k === 'text' && c.key === 'dmg');
  ok('敵に与えたダメージの数字は通常の色(危険色にしない)', num && num.color === 'plain' && num.size === 4, num);
  ok('当たりの音は れんさ 1 の高さ', plan.cues.some((c) => c.k === 'sound' && c.id === 'hit' && c.n === 1));
  ok('当たった 2 つの駒がつぶれる', plan.cues.filter((c) => c.k === 'body' && c.anim === 'squash').length === 2);
}
{
  const { plan } = run(one([A()], [dummy(180, 250)]), { dx: 0, dy: -1, power: 3 });
  const stops = plan.cues.filter((c) => c.k === 'stop');
  ok('強打: 止めは 1 回だけ(1 発目の止めは強打に吸収)', stops.length === 1 && stops[0].ms === FXT.tiers[1].hitstopMs, stops);
  const t = plan.cues.find((c) => c.k === 'text' && c.str === '強打!');
  ok('強打の文字は段 3・味方の手柄の色', t && t.size === 3 && t.color === 'good', t);
  const sh = plan.cues.find((c) => c.k === 'shake');
  ok('強打の揺れは当たった向き(上)', sh && sh.ny < -0.9, sh);
}
{ // 最後の敵を倒す手: 決着(減速・寄りは条件つき)
  const { plan } = run(one([A()], [dummy(180, 250, { hp: 10 })]), { dx: 0, dy: -1, power: 2 });
  const slow = plan.cues.find((c) => c.k === 'slow');
  ok('決着: 当たる前から減速する', slow && slow.i0 < plan.finale.koI && slow.rate === FXT.tiers[4].slowRate, slow);
  ok('決着の余韻は上限以内', plan.finale.ms <= FXT.budget.finaleMaxMs, plan.finale.ms);
  ok('ザコ 1 体・余裕のある決着では寄らない', !plan.cues.some((c) => c.k === 'zoom'));
  ok('決着の瞬間に、ほかの止めを重ねない', plan.cues.filter((c) => c.k === 'stop').length === 1);
}

// ---- 作った台本で、れんさ 10 段・呼びかけ・予算・敵の番を確かめる ------------------------
function fakeScript(n, extra) {
  const events = [{ i: -1, e: { t: 'ult0' }, at: {}, phase: 'shot' }];
  for (let k = 1; k <= n; k++) {
    const i = k * 30;
    events.push({ i, e: { t: 'contact', a: 0, b: k, x: 100, y: 100, nx: 0, ny: -1, v: 800 }, at: {}, phase: 'shot' });
    events.push({ i, e: { t: 'chain', n: k, why: 'hit' }, at: {}, phase: 'shot', mult: 1 + Math.min(0.6, k * 0.2) });
    events.push({ i, e: { t: 'hit', by: 0, to: k, dmg: 20, kind: 'hit' }, at: { 0: { x: 100, y: 120, r: 15, side: 0 }, [k]: { x: 100, y: 80, r: 15, side: 1 } }, phase: 'shot' });
  }
  if (extra) extra(events);
  return { events, steps: n * 30 + 100, shotEnd: n * 30 + 60, end: { units: [] }, summary: { maxChain: n, dmg: 20 * n, chainCharge: n >= 3, won: false, finale: null, allyHpRatio: 1 } };
}
{
  const plan = planShot(fakeScript(12), {});
  const chainText = (n) => plan.cues.find((c) => c.k === 'text' && c.key === 'chain' && c.str.startsWith(n + ' '));
  ok('れんさ 2 は小さな数字だけ', plan.cues.some((c) => c.k === 'text' && c.key === 'chain' && c.str === '2' && c.size === 4));
  ok('れんさ 3 は「3 れんさ 必殺+1」(段 3・手柄の色)', chainText(3) && chainText(3).str === '3 れんさ 必殺+1' && chainText(3).size === 3 && chainText(3).color === 'good', chainText(3));
  ok('れんさ 4 から倍率を添える', chainText(4) && /×\d\.\d$/.test(chainText(4).str), chainText(4));
  ok('れんさ 5 は段 2・必殺色', chainText(5) && chainText(5).size === 2 && chainText(5).color === 'great');
  ok('れんさ 10 は段 1 の札(必殺色)', chainText(10) && chainText(10).size === 1 && chainText(10).plate === true);
  ok('れんさ 11 以上は言葉を増やさない(段 1 の札のまま)', chainText(12) && chainText(12).str === '12 れんさ' && chainText(12).size === 1);
  const co = plan.cues.filter((c) => c.k === 'callout');
  ok('呼びかけは 1 手に 1 回、最高の節目(10)で、11 以上なら重ねは 3', co.length === 1 && co[0].layers === 3 && co[0].i === 300, co);
  ok('暗くするのは 5 と 10 だけ', plan.cues.filter((c) => c.k === 'dim').length === 2);
  ok('10 れんさの前に一瞬の静けさを置く', plan.cues.some((c) => c.k === 'pause' && c.why === 'preSilence' && c.i === 300 && c.pre));
  ok('1 手の待ちは予算以内', plan.stats.shotWaitMs <= FXT.budget.addedWaitPerShotMs, plan.stats.shotWaitMs);
  ok('危険色は 1 つも使わない(全部こちらの手柄)', !plan.cues.some((c) => c.color === 'harm'));
  const p7 = planShot(fakeScript(7), {});
  const c7 = p7.cues.filter((c) => c.k === 'callout');
  ok('最高が 5〜9 の手は、5 で 1 回だけ呼びかける', c7.length === 1 && c7[0].i === 150 && c7[0].layers === 1, c7);
  ok('最高が 4 以下の手は呼びかけない', planShot(fakeScript(4), {}).cues.every((c) => c.k !== 'callout'));
  const s10a = planShot(fakeScript(10), {}).cues.find((c) => c.why === 'chain10');
  const s10b = planShot(fakeScript(10), { memory: { chain10: 1 } }).cues.find((c) => c.why === 'chain10');
  ok('10 れんさの止めは 0.3〜0.5 秒(予算に収めるため下の格から先に削る)', s10a && s10a.ms >= 300 && s10a.ms <= 500, s10a && s10a.ms);
  ok('10 れんさの止めは、同じ戦闘の 2 回目から半分', s10b && Math.abs(s10b.ms - FXT.chain[10].stopMs * FXT.chain[10].repeatMul) < 1e-6, s10b && s10b.ms);
  const fastP = planShot(fakeScript(5), { fast: true }).cues.find((c) => c.why === 'chain5'), slowP = planShot(fakeScript(5), {}).cues.find((c) => c.why === 'chain5');
  ok('早送りでは止めが半分', fastP && slowP && Math.abs(fastP.ms - slowP.ms / 2) < 1e-6);
  ok('演出「なし」では揺れの幅 0・粒 0', planShot(fakeScript(10), { level: 'off' }).cues.every((c) => (c.k !== 'shake' || c.px === 0) && (c.k !== 'part' || c.mul === 0)));
}
{ // 同時に 5 発 → ダメージの数字は合計 1 つ
  const sc = fakeScript(0, (ev) => { for (let k = 1; k <= 5; k++) ev.push({ i: 40, e: { t: 'hit', by: -1, to: k, dmg: 10, kind: 'blast' }, at: { [k]: { x: 60 * k, y: 100, r: 15, side: 1 } }, phase: 'shot' }); });
  const nums = planShot(sc, {}).cues.filter((c) => c.k === 'text' && c.key === 'dmg');
  ok('同じ瞬間の 4 つ以上の数字は合計 1 つにまとめる', nums.length === 1 && nums[0].str === '-50', nums.map((c) => c.str));
}
{ // 敵 12 体が順に動く → 敵の番の間は 3 秒以内に縮める
  const sc = fakeScript(0, (ev) => { for (let k = 1; k <= 12; k++) ev.push({ i: 100 + k * 40, e: { t: 'act', by: k, kind: 'blast' }, at: { [k]: { x: 100, y: 100, r: 15, side: 1 } }, phase: 'enemy' }); });
  const p = planShot(sc, {});
  ok('敵の番の間は 3 秒以内', p.stats.enemyTurnMs <= FXT.budget.enemyTurnMaxMs + 0.5, p.stats.enemyTurnMs);
  ok('敵の行動の文字は危険色(味方への脅威)', p.cues.filter((c) => c.k === 'text').every((c) => c.color === 'harm' && c.who === 'ally'));
}

// ---- 場面カタログ: どの場面も、記録した手で今も同じ場面になる(エンジンを変えたら find-scenes.mjs で作り直す) ----
{
  let broken = [], bad = [];
  const rows = [];
  for (const sc of SCENES) {
    if (!sc.want) continue;
    const inp = SCENE_INPUTS[sc.id];
    if (!inp) { broken.push(sc.id + '(手がない)'); continue; }
    const s = scriptShot(sceneState(sc), inp);
    if (!s || !(sc.want(s) > 0)) { broken.push(sc.id); continue; }
    if (sc.kind !== 'shot') continue;
    const plan = planShot(s, {});
    const v = auditPlan(plan);
    if (v.length) bad.push(sc.id + ': ' + v[0]);
    rows.push(sc.id.padEnd(11) + ' 格' + (sc.tier === null || sc.tier === undefined ? '-' : sc.tier) + ' 待ち ' + String(Math.round(plan.stats.shotWaitMs)).padStart(3) + 'ms 敵 ' + String(Math.round(plan.stats.enemyTurnMs)).padStart(4) +
              'ms 決着 ' + String(Math.round(plan.stats.finaleMs)).padStart(4) + 'ms 呼びかけ ' + plan.stats.callouts + ' 最大れんさ ' + plan.stats.maxChain);
  }
  ok('場面カタログ: すべての場面が記録した手で再現する', broken.length === 0, broken);
  ok('場面カタログ: すべての場面で指示表が決まりを守る', bad.length === 0, bad);
  if (process.env.SCENES) console.log(rows.join('\n'));
}

// ---- 検査器の自己検査: わざと決まりを破った指示表を、auditPlan が落とせるか --------------
if (process.argv.includes('--mutate')) {
  const base = () => { const p = planShot(fakeScript(7), {}); return JSON.parse(JSON.stringify(p)); };
  const muts = [
    ['敵に与えた数字を危険色にする', (p) => { p.cues.push({ i: 30, k: 'text', str: '-20', size: 4, color: 'harm', who: 'enemy' }); }],
    ['呼びかけを 2 回にする', (p) => { p.stats.callouts = 2; }],
    ['1 手の待ちを 900ms にする', (p) => { p.stats.shotWaitMs = 900; }],
    ['離した瞬間に 320ms 止める(今の仮の画面の必殺)', (p) => { p.cues.push({ i: -1, k: 'pause', ms: 320, why: 'ult' }); }],
    ['文字の段を 6 種類にする', (p) => { for (let z = 1; z <= 5; z++) p.cues.push({ i: 1, k: 'text', str: 'x', size: z, color: 'plain', who: 'enemy' }); p.cues.push({ i: 1, k: 'text', str: 'y', size: 6, color: 'plain', who: 'enemy' }); }],
    ['同じ瞬間に止めを 2 回入れる', (p) => { p.cues.push({ i: 151, k: 'stop', ms: 90, tier: 1 }); }],
    ['暗転を 1 秒に 4 回入れる', (p) => { for (let z = 0; z < 4; z++) p.cues.push({ i: 10 + z * 20, k: 'dim', pct: 20, ms: 100 }); }],
  ];
  let caught = 0;
  for (const [name, f] of muts) { const p = base(); f(p); if (auditPlan(p).length) caught++; else console.log('  見逃し: ' + name); }
  console.log(`自己検査: 壊した ${muts.length} 件中 ${caught} 件を検出`);
  if (caught !== muts.length) process.exitCode = 1;
}

console.log(`\n${pass} 件合格 / ${fail} 件不合格`);
for (const f of failures) console.log('  不合格: ' + f);
if (fail) process.exitCode = 1;
