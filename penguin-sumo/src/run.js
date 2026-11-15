// ランの進行(フロアの自動生成、強化の候補、クリア後の処理)。画面はここを呼ぶだけ。
import { W, H, ICE, HOLE, ROCK, KINDS, UPGRADES, UPGRADE_KEYS, createFloor, mulberry32 } from './core.js';
import { solve } from './solver.js';

export const AREAS = [
  { ja: 'あさせの氷', text: 'まずは押し出しのけいこ' },
  { ja: 'いわばの氷', text: '岩とばくだんが増える' },
  { ja: 'うすい氷',   text: '氷が割れて、足場がへっていく' },
];
export const FLOORS_PER_AREA = 5, TOTAL_FLOORS = AREAS.length * FLOORS_PER_AREA;
const BOSS_OF_AREA = ['dosukoi', 'yukioroshi', 'nushi'];
// 敵の「強さの点数」。フロアが進むほど使える点数が増える
const COST = { crab: 1, gullH: 1.5, gullV: 1.5, seal: 2, bear: 2.5, walrus: 3 };
const POOL = [['crab', 'seal', 'gullH', 'gullV'], ['crab', 'seal', 'gullH', 'gullV', 'walrus'], ['crab', 'seal', 'gullH', 'gullV', 'walrus', 'bear']];

const hash = (a, b) => { let h = (a ^ 0x9e3779b9) >>> 0; h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0; h ^= h >>> 13; return Math.imul(h, 0xc2b2ae35) >>> 0; };

function emptyCells() { return new Array(W * H).fill(ICE); }

function tryFloor(seed, floor) {
  const rnd = mulberry32(seed), area = Math.floor(floor / FLOORS_PER_AREA), n = floor % FLOORS_PER_AREA;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const cells = emptyCells();
  const start = [ri(1, W - 2), ri(H - 2, H - 1)];
  const used = new Set([start[1] * W + start[0]]);
  const free = (x, y, far) => !used.has(y * W + x) && (!far || Math.abs(x - start[0]) + Math.abs(y - start[1]) >= far);
  const place = (far) => { for (let t = 0; t < 60; t++) { const x = ri(0, W - 1), y = ri(0, H - 1); if (free(x, y, far)) { used.add(y * W + x); return [x, y]; } } return null; };
  const enemies = [];
  if (n === FLOORS_PER_AREA - 1) { // ボス
    const kind = BOSS_OF_AREA[area];
    const bx = ri(2, 3), by = kind === 'yukioroshi' ? 2 : 1;
    used.add(by * W + bx);
    enemies.push({ kind, x: bx, y: by });
    const rocks = kind === 'dosukoi' ? 4 : kind === 'yukioroshi' ? 2 : 1;
    for (let i = 0; i < rocks; i++) { const c = place(2); if (c) cells[c[1] * W + c[0]] = ROCK; }
    if (kind === 'nushi') for (let i = 0; i < 2; i++) { const c = place(2); if (c) cells[c[1] * W + c[0]] = HOLE; }
    const adds = kind === 'dosukoi' ? ['crab', 'crab'] : kind === 'yukioroshi' ? ['bomb', 'bomb', 'gullH'] : ['gullH', 'gullV'];
    for (const k of adds) { const c = place(3); if (c) enemies.push({ kind: k, x: c[0], y: c[1] }); }
    return { cells, start, enemies, boss: kind };
  }
  const rocks = [ri(2, 3), ri(3, 5), ri(2, 4)][area], holes = [ri(0, 1), ri(1, 3), ri(2, 4)][area];
  for (let i = 0; i < rocks; i++) { const c = place(1); if (c) cells[c[1] * W + c[0]] = ROCK; }
  for (let i = 0; i < holes; i++) { const c = place(2); if (c) cells[c[1] * W + c[0]] = HOLE; }
  let budget = 1.5 + floor * 0.5;
  const pool = POOL[area];
  for (let guard = 0; guard < 12 && budget >= 1 && enemies.length < 6; guard++) {
    const k = pool[ri(0, pool.length - 1)];
    if (COST[k] > budget) continue;
    const c = place(3);
    if (!c) break;
    enemies.push({ kind: k, x: c[0], y: c[1], count: KINDS[k].base + (rnd() < 0.3 ? 1 : 0) });
    budget -= COST[k];
  }
  if (area >= 1 && rnd() < 0.6) { const c = place(2); if (c) enemies.push({ kind: 'bomb', x: c[0], y: c[1], count: ri(3, 5) }); }
  if (!enemies.some((e) => !KINDS[e.kind].object)) { const c = place(3); if (c) enemies.push({ kind: 'crab', x: c[0], y: c[1] }); }
  return { cells, start, enemies, boss: null };
}

/**
 * フロアを作る。探索で「ハートを 2 つ以上失わずに勝てる」ことを確かめてから出す。
 * 返り値: { def, par(探索が見つけた手数), tries }
 */
export function makeFloor(runSeed, floor) {
  const boss = floor % FLOORS_PER_AREA === FLOORS_PER_AREA - 1;
  for (let t = 0; t < 60; t++) {
    const def = tryFloor(hash(runSeed, floor * 131 + t), floor);
    const s = createFloor(def, { hearts: 3, maxHearts: 3, ups: {} });
    const r = solve(s, boss ? { beam: 140, depth: 44 } : { beam: 90, depth: 30 });
    if (r.won && r.state.p.hearts >= 2) return { def, par: r.path.length, tries: t + 1 };
  }
  // 見つからなければ、必ず解ける簡単なフロアにする
  const cells = emptyCells();
  return { def: { cells, start: [2, 5], enemies: [{ kind: 'crab', x: 1, y: 1 }, { kind: 'crab', x: 4, y: 1 }], boss: null }, par: 6, tries: 61 };
}

/** 強化の候補を 3 つ(もう上限まで取ったものは出さない) */
export function offerUpgrades(runSeed, floor, ups) {
  const rnd = mulberry32(hash(runSeed, 9000 + floor));
  const pool = UPGRADE_KEYS.filter((k) => (ups[k] || 0) < UPGRADES[k].max);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  return pool.slice(0, 3);
}

export function newRun(seed, mode) {
  return { seed: seed >>> 0, mode: mode || 'normal', floor: 0, hearts: 3, maxHearts: 3, ups: {}, over: null,
           stats: { turns: 0, ringOuts: 0, falls: 0, quick: 0, skipped: 0, by: {} } };
}

/** いまのフロアを始める。返り値: { state, par, quickTurns(はやわざの目標), area, boss } */
export function startFloor(run) {
  const f = makeFloor(run.seed, run.floor);
  const state = createFloor(f.def, { hearts: run.hearts, maxHearts: run.maxHearts, ups: run.ups });
  return { state, par: f.par, quickTurns: f.par + 2, area: Math.floor(run.floor / FLOORS_PER_AREA), boss: f.def.boss };
}

function tally(run, state) {
  run.stats.turns += state.turn; run.stats.ringOuts += state.stats.ringOuts + state.stats.selfKo; run.stats.falls += state.stats.falls;
  for (const k of Object.keys(state.stats.by)) run.stats.by[k] = (run.stats.by[k] || 0) + state.stats.by[k];
}

/** フロアに勝った後。はやわざなら回復。返り値: { quick, healed, finished, offers } */
export function winFloor(run, state, quickTurns) {
  run.hearts = state.p.hearts;
  tally(run, state);
  const quick = state.turn <= quickTurns;
  let healed = 0;
  if (quick) { run.stats.quick++; if (run.hearts < run.maxHearts) { run.hearts++; healed++; } }
  if ((run.ups.heal || 0) > 0 && run.hearts < run.maxHearts) { run.hearts++; healed++; }
  if (state.boss && run.hearts < run.maxHearts) { healed += run.maxHearts - run.hearts; run.hearts = run.maxHearts; } // ボスを倒したら全回復
  const finished = run.floor >= TOTAL_FLOORS - 1;
  if (finished) run.over = 'won';
  return { quick, healed, finished, offers: finished ? [] : offerUpgrades(run.seed, run.floor, run.ups) };
}

export function takeUpgrade(run, key) {
  if (key && UPGRADES[key] && (run.ups[key] || 0) < UPGRADES[key].max) {
    run.ups = Object.assign({}, run.ups, { [key]: (run.ups[key] || 0) + 1 });
    if (key === 'heart') { run.maxHearts++; run.hearts = Math.min(run.maxHearts, run.hearts + 1); }
  }
  run.floor++;
}

export function loseRun(run, state) {
  run.hearts = 0; run.over = 'lost';
  tally(run, state);
}

/** あきらめて次へ: ハートを 1 つ失い、強化はもらえない(詰んだときの逃げ道) */
export function skipFloor(run, state) {
  run.hearts = state.p.hearts - 1; run.stats.skipped++; tally(run, state);
  if (run.hearts <= 0) { run.hearts = 0; run.over = 'lost'; return false; }
  if (run.floor >= TOTAL_FLOORS - 1) { run.over = 'lost'; return false; } // 最後のボスは飛ばせない
  run.floor++;
  return true;
}

/** 日替わりの種(その日の日付から決まる) */
export function dailySeed(dateStr) { let h = 2166136261; for (let i = 0; i < dateStr.length; i++) { h ^= dateStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
