// はじきバトル 1 手の台本(先読み)。
// 離した瞬間に、盤面の複製で手を最後まで計算する。エンジンは同じ手なら必ず同じ結果になるので、
// 本物の盤面を 1 刻みずつ進めたときに起きることが、この台本と 1 刻み単位で一致する(fx/test.mjs で確認)。
// 演出はこの台本を見て、「この手の最大れんさ」「決着になる当たり」「1 手でまとめて倒した数」を先に知ってから組む。
import { cloneState, shoot, step, chainMult } from '../engine/engine.js';

const ENEMY_ACTIONS = { table: 1, dot: 1, tick: 1, endEnemy: 1 };

/** 出来事が指す駒の、その瞬間の位置と速さ(演出の置き場所) */
function fxSnap(c, e) {
  const at = {};
  for (const k of ['by', 'to', 'id', 'a', 'b', 'from']) {
    const id = e[k];
    if (id === undefined || id < 0 || at[id]) continue;
    const u = c.units[id];
    if (u) at[id] = { x: u.x, y: u.y, vx: u.vx, vy: u.vy, r: u.r, side: u.side, kind: u.kind, hp: u.hp, maxHp: u.maxHp };
  }
  return at;
}

/**
 * state: 狙う番の盤面(変えない) / input: shoot() と同じ { dx, dy, power, ult }
 * 返す: null(受け付けられない手)または
 *  { events: [{ i, e, at, phase }], steps, shotEnd, end: 最後の盤面の複製, summary }
 *  i: その出来事が起きた刻み(-1 = 離した瞬間)。phase: 'shot'(自分の手)/ 'enemy'(敵の番)
 */
export function scriptShot(state, input, opts) {
  const limit = (opts && opts.limit) || 240 * 30;
  const c = cloneState(state);
  c.fx = true;
  const before = c.units.map((u) => ({ alive: u.alive, side: u.side, kind: u.kind, hp: u.hp, maxHp: u.maxHp }));
  if (!shoot(c, input)) return null;
  const events = [];
  for (const e of c.events) events.push({ i: -1, e, at: fxSnap(c, e), phase: 'shot' });
  c.events = [];
  let i = 0, shotEnd = -1;
  while (c.phase === 'resolving' && i < limit) {
    let phase;
    if (c.motion) phase = c.motion.foeShot ? 'enemy' : 'shot';
    else phase = c.queue.length && ENEMY_ACTIONS[c.queue[0].t] ? 'enemy' : 'shot';
    step(c);
    for (const e of c.events) {
      const rec = { i, e, at: fxSnap(c, e), phase };
      if (e.t === 'chain') rec.mult = chainMult(Object.assign({}, c, { chain: e.n })); // その瞬間の倍率(表示用)
      events.push(rec);
    }
    c.events = [];
    if (phase === 'shot') shotEnd = i;
    i++;
  }
  const summary = summarize(events, before, c);
  summary.shooter = state.active; // 弾いた駒(節目の輪や粒を、この駒のまわりに出す)
  return { events, steps: i, shotEnd, end: c, summary };
}

function summarize(events, before, end) {
  let maxChain = 0, dmg = 0, strong = 0, bonusShot = false, chainCharge = false, ult = false;
  const kos = [], gauges = [], blasts = [];
  let lastEnemyKo = null;
  for (const r of events) {
    const e = r.e;
    if (e.t === 'chain' && r.phase === 'shot') maxChain = Math.max(maxChain, e.n);
    if (e.t === 'hit' && r.phase === 'shot' && before[e.to] && before[e.to].side === 1 && e.kind !== 'dot' && e.kind !== 'foe') dmg += e.dmg;
    if (e.t === 'strong' && r.phase === 'shot') strong++;
    if (e.t === 'bonusShot') bonusShot = true;
    if (e.t === 'chainCharge') chainCharge = true;
    if (e.t === 'ult') ult = true;
    if (e.t === 'gaugeBreak') gauges.push(r.i);
    if (e.t === 'blast') blasts.push(r.i);
    if (e.t === 'ko' && before[e.id] && before[e.id].side === 1) { kos.push({ i: r.i, id: e.id, how: e.how, phase: r.phase }); lastEnemyKo = r; }
  }
  const won = end.phase === 'won', lost = end.phase === 'lost';
  let finale = null;
  if (won && lastEnemyKo) {
    const id = lastEnemyKo.e.id;
    // 決着の当たり: 最後の敵が倒れる前の、その敵に触れた最後の接触(なければ倒れた瞬間そのもの)
    let hit = null;
    for (const r of events) {
      if (r.i > lastEnemyKo.i) break;
      if (r.e.t === 'contact' && (r.e.a === id || r.e.b === id)) hit = r;
    }
    const pt = hit ? { x: hit.e.x, y: hit.e.y } : { x: lastEnemyKo.at[id].x, y: lastEnemyKo.at[id].y };
    const inShot = kos.filter((k) => k.phase === 'shot').length;
    finale = {
      koI: lastEnemyKo.i, hitI: hit ? hit.i : lastEnemyKo.i, id, how: lastEnemyKo.e.how, x: pt.x, y: pt.y,
      boss: before[id].kind === 'boss', phase: lastEnemyKo.phase,
      special: lastEnemyKo.phase === 'shot' && inShot >= 3, // 1 手でまとめて 3 体以上(特別版)
      kosInShot: inShot,
    };
  }
  let allyHp = 0, allyMax = 0;
  for (const u of end.units) if (u.side === 0 && u.kind === 'ally') { allyHp += Math.max(0, u.alive ? u.hp : 0); allyMax += u.maxHp; }
  return { maxChain, dmg, strong, bonusShot, chainCharge, ult, kos, gauges, blasts, won, lost, finale,
           allyHpRatio: allyMax ? allyHp / allyMax : 0 };
}
