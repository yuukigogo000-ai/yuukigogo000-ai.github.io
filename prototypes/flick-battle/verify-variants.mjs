// 場外ルールの変種と「狙いの誤差」に対する勝率(node verify-variants.mjs)
import './sim.js';
import { writeFileSync } from 'node:fs';
const S = globalThis.FlickSim;
const L = S.DIRS.length;

// policy: { err: 狙いの誤差(候補数), robust: 近くの候補の平均点で選ぶ幅(0 なら最善手そのもの) }
function pick(s, policy, rnd) {
  const sc = [];
  for (let i = 0; i < L; i++) for (let j = 0; j < S.POWERS.length; j++) sc.push(S.scoreShot(s, S.DIRS[i][0], S.DIRS[i][1], S.POWERS[j]));
  let best = -1, bv = -Infinity;
  for (let i = 0; i < L; i++) for (let j = 0; j < S.POWERS.length; j++) {
    let v = 0, n = 0;
    for (let k = -policy.robust; k <= policy.robust; k++) { v += sc[((i + k + L) % L) * S.POWERS.length + j]; n++; }
    v /= n;
    if (v > bv) { bv = v; best = i * S.POWERS.length + j; }
  }
  const i = Math.floor(best / S.POWERS.length), j = best % S.POWERS.length;
  const off = Math.round((rnd() * 2 - 1) * policy.err);
  const d = S.DIRS[(i + off + L) % L];
  return [d[0], d[1], S.POWERS[j]];
}

function run(stage, rules, policy, n) {
  let wins = 0, shots = 0, pko = 0, self = 0, falls = 0;
  for (let seed = 1; seed <= n; seed++) {
    const rnd = S.mulberry32(7000 + seed);
    const s = S.createState(stage, { rules });
    while (s.phase === 'aim' && s.shots < 80) { const [dx, dy, p] = pick(s, policy, rnd); S.shoot(s, dx, dy, p); S.resolve(s); }
    if (s.phase === 'won') wins++;
    shots += s.shots; pko += s.stats.koHp[0] + s.stats.koRing[0]; self += s.stats.selfRing; falls += s.stats.ringReturns || 0;
  }
  return { winRate: +(wins / n).toFixed(2), shotsAvg: +(shots / n).toFixed(1), playerKoPerBattle: +(pko / n).toFixed(2),
           selfRingOutPerBattle: +(self / n).toFixed(2), fallsPerBattle: +(falls / n).toFixed(2) };
}

const RULES = {
  base: {},                                   // 味方も落ちたら即KO
  shooterSafe: { shooterSafe: true },         // 弾いた本人は落ちない
  ringReturn: { playerRingReturn: true },     // 味方は落ちても傷を負って戻る
};
const POLICIES = {
  'greedy_err6deg': { err: 2, robust: 0 },    // 最善手を狙うが ±6 度ずれる
  'safe_err6deg': { err: 2, robust: 2 },      // ずれても大丈夫な手を選ぶ人が ±6 度ずれる
  'safe_err11deg': { err: 4, robust: 3 },     // 同じく ±11 度ずれる
};
const N = 20, out = {};
for (const stage of ['mob', 'boss']) for (const r of Object.keys(RULES)) for (const p of Object.keys(POLICIES)) {
  const key = `${stage}/${r}/${p}`;
  out[key] = run(stage, RULES[r], POLICIES[p], N);
  console.log(key, JSON.stringify(out[key]));
}
writeFileSync(new URL('./results-variants.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
