// 通しプレイのバランス確認(node balance.mjs [ラン数])
// 「数手先まで読むが、ときどき適当に動く人」を模した打ち手でランを最後まで回す。
import * as C from './src/core.js';
import * as R from './src/run.js';
import { bestMove, moves, solve } from './src/solver.js';
import { writeFileSync } from 'node:fs';

function playRun(seed, depth, mistake) {
  const rnd = C.mulberry32(seed * 7919), run = R.newRun(seed);
  let fl = R.startFloor(run), guard = 0, plan = [];
  const perFloor = [];
  while (!run.over && guard++ < 1500) {
    const ms = moves(fl.state);
    let m;
    if (depth === 99) { // 上級者: 探索で見つけた勝ち筋をなぞる(見つからなければ 3 手読み)
      if (!plan.length) { const r = solve(fl.state, { beam: 120, depth: 40 }); plan = r.won ? r.path.slice() : []; }
      m = plan.length ? plan.shift() : bestMove(fl.state, 3);
    } else m = rnd() < mistake ? ms[Math.floor(rnd() * ms.length)] : bestMove(fl.state, depth);
    C.act(fl.state, m.dir, m.brake); fl.state.events = [];
    if (fl.state.phase === 'won') {
      perFloor.push({ floor: run.floor, turns: fl.state.turn, par: fl.par, heartsLost: 0 });
      const w = R.winFloor(run, fl.state, fl.quickTurns);
      if (!w.finished) {
        // 強化は「ハートが少なければ回復系、それ以外は先頭」を選ぶ
        const pick = w.offers.find((k) => run.hearts <= 1 && (k === 'heart' || k === 'shield' || k === 'heal')) || w.offers[0];
        R.takeUpgrade(run, pick); fl = R.startFloor(run); plan = [];
      }
    } else if (fl.state.phase === 'lost') R.loseRun(run, fl.state);
  }
  return { run, perFloor };
}

const N = +(process.argv[2] || 30), out = {};
for (const [label, depth, mistake] of [['上級者(勝ち筋どおり)', 99, 0], ['3手読み・ミスなし', 3, 0], ['2手読み・1割ミス', 2, 0.1], ['1手読み・2割ミス', 1, 0.2], ['でたらめ', 0, 1]]) {
  let wins = 0, floors = 0, turns = 0, quick = 0, falls = 0; const by = {}, diedAt = new Array(R.TOTAL_FLOORS).fill(0); const reach = new Array(R.TOTAL_FLOORS + 1).fill(0), ratio = [];
  const t0 = Date.now();
  for (let i = 1; i <= N; i++) {
    const { run, perFloor } = playRun(i, depth || 1, mistake);
    if (run.over === 'won') wins++;
    const cleared = run.over === 'won' ? R.TOTAL_FLOORS : run.floor;
    floors += cleared; turns += run.stats.turns; quick += run.stats.quick; falls += run.stats.falls;
    for (let f = 0; f <= cleared; f++) reach[f]++;
    if (run.over === 'lost') diedAt[run.floor]++;
    for (const k of Object.keys(run.stats.by)) by[k] = (by[k] || 0) + run.stats.by[k];
    for (const p of perFloor) ratio.push(p.turns / p.par);
  }
  const r = { runs: N, winRate: +(wins / N).toFixed(2), floorsCleared: +(floors / N).toFixed(1), turnsPerRun: Math.round(turns / N), quickPerRun: +(quick / N).toFixed(1), fallsPerRun: +(falls / N).toFixed(1),
              turnsVsPar: ratio.length ? +(ratio.reduce((a, b) => a + b) / ratio.length).toFixed(2) : 0,
              reachArea2: +(reach[5] / N).toFixed(2), reachArea3: +(reach[10] / N).toFixed(2), hurtBy: by, diedAtFloor: diedAt.join(' '), sec: +((Date.now() - t0) / 1000).toFixed(1) };
  out[label] = r;
  console.log(label.padEnd(12), JSON.stringify(r));
}
writeFileSync(new URL('./results-balance.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
