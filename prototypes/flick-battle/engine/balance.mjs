// バランスの確認(node balance.mjs)。「安全な手を選ぶが狙いがずれる人」を回して、勝率・手数・落下などを出す。
import * as E from './engine.js';
import { ally, mobBattle, bossBattle, LINEAGE_KEYS } from './data.js';
import { humanShot, bestShot } from './ai.js';
import { writeFileSync } from 'node:fs';

const TEAMS = {
  // 重量級で押し出す / 軽い駒で連鎖 / 毒で削って狙撃 / 貫通で一掃 / ばらばら
  heavy: ['machine', 'furniture', 'bath', 'kitchen'],
  chain: ['creature', 'toy', 'book', 'kitchen'],
  poison: ['plant', 'stationery', 'bath', 'food'],
  pierce: ['stationery', 'electronic', 'kitchen', 'clothing'],
  mixed: ['kitchen', 'food', 'creature', 'machine'],
};
const MOBS = [['kitchen', 'plant', 'creature'], ['machine', 'food', 'stationery', 'toy'], ['book', 'electronic', 'furniture', 'clothing'], ['bath', 'creature', 'creature', 'plant']];
const TABLE = ['kitchen', 'living', 'attic'];

function play(cfg, seed, err, robust) {
  const rnd = E.mulberry32(seed), s = E.createBattle(cfg);
  while (s.phase === 'aim' && s.shots < 60) { E.shoot(s, err < 0 ? bestShot(s) : humanShot(s, rnd, err, robust)); E.resolve(s); }
  return s;
}
function summarize(name, mk, n, err, robust) {
  let wins = 0, shots = 0, falls = 0, ko = 0, ring = 0, eko = 0, ults = 0, chain = 0, hit = 0, touch = 0, ult = 0, unfinished = 0, hpLeft = 0;
  const list = [];
  for (let i = 0; i < n; i++) {
    const s = play(mk(i), 3000 + i, err, robust);
    if (s.phase === 'won') wins++; else if (s.phase === 'aim') unfinished++;
    shots += s.shots; list.push(s.shots); falls += s.stats.allyFalls; ko += s.stats.allyKo; ring += s.stats.enemyRing; eko += s.stats.enemyKo;
    ults += s.stats.ultsUsed; chain += s.bestChain; hit += s.stats.dmgHit; touch += s.stats.dmgTouch; ult += s.stats.dmgUlt;
    for (const u of s.units) if (u.side === 0 && u.alive) hpLeft += u.hp / u.maxHp;
  }
  list.sort((a, b) => a - b);
  const tot = Math.max(1, hit + touch + ult);
  const r = { n, win: +(wins / n).toFixed(2), shots: +(shots / n).toFixed(1), shotsRange: [list[0], list[n - 1]], unfinished,
              allyFalls: +(falls / n).toFixed(2), allyKo: +(ko / n).toFixed(2), allyHpLeft: +(hpLeft / n).toFixed(2),
              enemyRingShare: +(ring / Math.max(1, ring + eko)).toFixed(2), ults: +(ults / n).toFixed(1), bestChain: +(chain / n).toFixed(1),
              dmgShare: { hit: +(hit / tot).toFixed(2), touch: +(touch / tot).toFixed(2), ult: +(ult / tot).toFixed(2) } };
  console.log(name.padEnd(34), JSON.stringify(r));
  return r;
}
const team = (k, pct) => TEAMS[k].map((l) => ally(l, { pct: pct || 0 }));
const out = {};
const N = +(process.argv[2] || 8);
const ONLY = process.argv[3] || ''; // 'boss' か 'mob' を渡すと片方だけ回す
// 狙いのズレ: 1 候補 = 5.6 度。err=1 → ±5.6 度、err=2 → ±11 度
for (const [label, err, robust] of [['ずれ±6度', 1, 1], ['ずれ±11度', 2, 2]]) {
  for (const tk of ONLY === 'boss' ? [] : Object.keys(TEAMS)) {
    out[`ザコ/${tk}/${label}`] = summarize(`ザコ/${tk}/${label}`, (i) => mobBattle(TABLE[i % 3], team(tk), MOBS[i % MOBS.length], {}), N, err, robust);
  }
  for (const b of ONLY === 'mob' ? [] : ['vacuum', 'washer', 'fan']) {
    out[`ボス/${b}/mixed/${label}`] = summarize(`ボス/${b}/mixed/${label}`, () => bossBattle(b, team('mixed')), N, err, robust);
  }
}
if (!ONLY) writeFileSync(new URL('./results-balance.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
