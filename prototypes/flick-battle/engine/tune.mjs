// 調整用の速い集計(node tune.mjs '{"foeHp":1.3,"foeAtk":1.1}' [戦闘数])。4 つの処理に分けて同時に回す。
// 打ち手は 2 種類: うまい人(盤面を全部読んで、少しずれても損をしない手を選ぶ。狙いは ±11 度ずれる)
//                  ふつうの人(全部は読まず、でたらめな 24 手の中で一番良いものを選ぶ。狙いは ±11 度ずれる)
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const TEAMS = {
  mixed: ['kitchen', 'food', 'creature', 'machine'], chain: ['creature', 'toy', 'book', 'kitchen'], heavy: ['machine', 'furniture', 'bath', 'kitchen'],
  evo: [['kitchen', 'blade', 'strong'], ['stationery', 'mirror', 'nimble'], ['creature', 'fan', 'cheer'], ['machine', 'dumbbell', 'sturdy']],
  evo2: [['machine', 'match', 'grit'], ['kitchen', 'battery', 'early'], ['furniture', 'whistle', 'stunRes'], ['food', 'magnifier', 'strong']],
};
const MOBS = [['kitchen', 'plant', 'creature'], ['machine', 'food', 'stationery', 'toy'], ['book', 'electronic', 'furniture', 'clothing'], ['bath', 'creature', 'creature', 'plant']];
const TABLE = ['kitchen', 'living', 'attic'];

if (isMainThread) {
  const tune = JSON.parse(process.argv[2] || '{}'), N = +(process.argv[3] || 3);
  const jobs = [];
  for (const who of ['skilled', 'casual']) {
    for (const tk of ['mixed', 'chain', 'heavy', 'evo', 'evo2']) for (let i = 0; i < N; i++) jobs.push({ who, kind: 'mob', tk, i });
    for (const b of ['vacuum', 'washer', 'fan']) for (const tk of ['mixed', 'evo2']) for (let i = 0; i < Math.max(2, N - 1); i++) jobs.push({ who, kind: b, tk, i });
  }
  const P = 4, res = [];
  await Promise.all([...Array(P).keys()].map((w) => new Promise((ok, ng) => {
    const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { tune, jobs: jobs.filter((_, j) => j % P === w) } });
    wk.on('message', (m) => res.push(...m)); wk.on('exit', ok); wk.on('error', ng);
  })));
  const groups = {};
  for (const r of res) { const k = `${r.who}/${r.kind === 'mob' ? 'ザコ' : 'ボス:' + r.kind}/${r.tk}`; (groups[k] = groups[k] || []).push(r); }
  const out = {};
  for (const k of Object.keys(groups).sort()) {
    const g = groups[k], n = g.length, avg = (f) => +(g.reduce((a, r) => a + f(r), 0) / n).toFixed(2);
    out[k] = { n, win: avg((r) => (r.won ? 1 : 0)), shots: avg((r) => r.shots), hpLeft: avg((r) => r.hpLeft), ko: avg((r) => r.ko), turns: avg((r) => r.turns),
               bestChain: avg((r) => r.bestChain), bestShotDmg: avg((r) => r.bestShotDmg), relays: avg((r) => r.relays), blasts: avg((r) => r.blasts) };
    console.log(k.padEnd(22), JSON.stringify(out[k]));
  }
  if (process.argv[4]) (await import('node:fs')).writeFileSync(process.argv[4], JSON.stringify({ tune, out }, null, 1) + '\n');
} else {
  const D = await import('./data.js'), E = await import('./engine.js'), A = await import('./ai.js');
  Object.assign(D.TUNE, workerData.tune);
  const mk = (tk) => TEAMS[tk].map((e) => (Array.isArray(e) ? D.ally(e[0], { item: e[1], passives: [e[2]] }) : D.ally(e)));
  const casual = (s, rnd) => { const all = A.allShots(s); let best = null, bv = -Infinity; for (let k = 0; k < 24; k++) { const sh = all[Math.floor(rnd() * all.length)]; const v = A.scoreShot(s, sh); if (v > bv) { bv = v; best = sh; } }
    const L = A.DIRS.length, off = Math.round((rnd() * 2 - 1) * 2), d = A.DIRS[(best.dir + off + L) % L]; return { dx: d[0], dy: d[1], power: best.power, ult: best.ult }; };
  const out = [];
  for (const j of workerData.jobs) {
    const cfg = j.kind === 'mob' ? D.mobBattle(TABLE[j.i % 3], mk(j.tk), MOBS[j.i % MOBS.length], {}) : D.bossBattle(j.kind, mk(j.tk));
    const s = E.createBattle(cfg), rnd = E.mulberry32(5000 + j.i * 7 + (j.who === 'casual' ? 1 : 0));
    while (s.phase === 'aim' && s.shots < 50) { E.shoot(s, j.who === 'skilled' ? A.humanShot(s, rnd, 2, 2) : casual(s, rnd)); E.resolve(s); s.events = []; }
    let hp = 0, max = 0; for (const u of s.units) if (u.kind === 'ally') { max += u.maxHp; if (u.alive) hp += u.hp; }
    out.push({ who: j.who, kind: j.kind, tk: j.tk, won: s.phase === 'won', shots: s.shots, turns: s.turnNo, hpLeft: hp / max, ko: s.stats.allyKo, bestChain: s.bestChain,
               bestShotDmg: s.stats.bestShotDmg, relays: s.stats.relays, blasts: s.stats.blasts });
  }
  parentPort.postMessage(out);
}
