// 「体力が減るほど飛びやすい」ルールの効き方(node verify-hp.mjs)
import './sim.js';
import { writeFileSync } from 'node:fs';
const S = globalThis.FlickSim, L = S.DIRS.length;
function pick(s, policy, rnd) {
  const sc = [];
  for (let i = 0; i < L; i++) for (let j = 0; j < S.POWERS.length; j++) sc.push(S.scoreShot(s, S.DIRS[i][0], S.DIRS[i][1], S.POWERS[j]));
  let best = -1, bv = -Infinity;
  for (let i = 0; i < L; i++) for (let j = 0; j < S.POWERS.length; j++) {
    let v = 0, n = 0;
    for (let k = -policy.robust; k <= policy.robust; k++) { v += sc[((i + k + L) % L) * S.POWERS.length + j]; n++; }
    v /= n; if (v > bv) { bv = v; best = i * S.POWERS.length + j; }
  }
  const i = Math.floor(best / S.POWERS.length), j = best % S.POWERS.length;
  const d = S.DIRS[(i + Math.round((rnd() * 2 - 1) * policy.err) + L) % L];
  return [d[0], d[1], S.POWERS[j]];
}
function run(stage, rules, policy, n) {
  let wins = 0, shots = 0, pko = 0, falls = 0, eRing = 0, eHp = 0, hpLeft = 0, ringAtHp = 0;
  for (let seed = 1; seed <= n; seed++) {
    const rnd = S.mulberry32(7000 + seed), s = S.createState(stage, { rules });
    while (s.phase === 'aim' && s.shots < 80) { const [dx, dy, p] = pick(s, policy, rnd); S.shoot(s, dx, dy, p); S.resolve(s); }
    if (s.phase === 'won') wins++;
    shots += s.shots; pko += s.stats.koHp[0] + s.stats.koRing[0]; falls += s.stats.ringReturns || 0;
    eRing += s.stats.koRing[1]; eHp += s.stats.koHp[1];
    for (const u of s.units) {
      if (u.side === 0 && u.alive) hpLeft += u.hp / u.maxHp;
      if (u.side === 1 && !u.alive && u.hp > 0) ringAtHp += u.hp / u.maxHp; // 場外になった敵の、落ちた時点の残り体力
    }
  }
  return { winRate: +(wins / n).toFixed(2), shotsAvg: +(shots / n).toFixed(1), playerKoPerBattle: +(pko / n).toFixed(2), fallsPerBattle: +(falls / n).toFixed(2),
           enemyKoByRingOut: +(eRing / Math.max(1, eRing + eHp)).toFixed(2), enemyHpWhenRungOut: +(ringAtHp / Math.max(1, eRing)).toFixed(2),
           allyHpLeftPerBattle: +(hpLeft / n).toFixed(2) };
}
const out = {}, N = 20;
const only = process.argv[2]; // 例: node verify-hp.mjs half で「半分以下だけ落ちる」だけ回す
const MODES = { off: {}, enemy: { hpKnockback: 'enemy' }, both: { hpKnockback: 'both' }, half: { ringHalf: true } };
let prev = {};
try { prev = JSON.parse((await import('node:fs')).readFileSync(new URL('./results-hp.json', import.meta.url), 'utf8')); } catch (e) { /* 初回 */ }
Object.assign(out, prev);
for (const stage of ['mob', 'boss']) for (const hk of Object.keys(MODES)) for (const pn of ['safe_err6deg', 'safe_err11deg']) {
  if (only && hk !== only) continue;
  const policy = pn === 'safe_err6deg' ? { err: 2, robust: 2 } : { err: 4, robust: 3 };
  const key = `${stage}/${hk}/${pn}`;
  out[key] = run(stage, Object.assign({ playerRingReturn: true }, MODES[hk]), policy, N);
  console.log(key, JSON.stringify(out[key]));
}
writeFileSync(new URL('./results-hp.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
