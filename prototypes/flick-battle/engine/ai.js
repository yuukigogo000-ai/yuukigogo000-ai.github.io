// おまかせ(候補の手を全部シミュレータに通して一番良いものを選ぶ)。「いっきに勝つ」とバランス確認にも使う。
import { cloneState, shoot, resolve, canUlt, createBattle } from './engine.js';

// 三角関数を使わずに向きの候補を作る(正方形の周上の整数点)
export const DIRS = (function () {
  const out = [], N = 8;
  for (let x = -N; x < N; x++) out.push([x, -N]);
  for (let y = -N; y < N; y++) out.push([N, y]);
  for (let x = N; x > -N; x--) out.push([x, N]);
  for (let y = N; y > -N; y--) out.push([-N, y]);
  return out; // 64 方向
})();
export const POWERS = [1, 2, 3];

function value(s) {
  let v = 0;
  for (const u of s.units) {
    if (u.side === 1) v -= u.alive ? (u.kind === 'boss' ? (u.gauges.length - 1 - u.gaugeIdx) * 200 + u.hp : 30 + u.hp) : 0;
    else if (u.side === 0) v += u.alive ? 40 + u.hp + u.shield * 0.5 : 0;
  }
  return v;
}

/** 手を 1 つ評価する。敵の番まで回した後の盤面で点を付ける(止まった場所の安全さも入る) */
export function scoreShot(s, input) {
  const c = cloneState(s);
  shoot(c, input);
  resolve(c);
  let v = value(c);
  if (c.phase === 'won') v += 10000; else if (c.phase === 'lost') v -= 10000;
  if (input.ult) v -= 6; // 必殺は、差が出るときだけ使う
  return v;
}

export function allShots(s) {
  const out = [], ult = canUlt(s);
  for (let i = 0; i < DIRS.length; i++) for (const p of POWERS) {
    out.push({ dx: DIRS[i][0], dy: DIRS[i][1], power: p, ult: false, dir: i });
    if (ult && p === 3) out.push({ dx: DIRS[i][0], dy: DIRS[i][1], power: p, ult: true, dir: i });
  }
  return out;
}

export function bestShot(s) {
  let best = null;
  for (const sh of allShots(s)) {
    const sc = scoreShot(s, sh);
    if (best === null || sc > best.score) best = Object.assign({ score: sc }, sh);
  }
  return best;
}

/**
 * 人間っぽい打ち手: 少しずれても損をしない手を選び、狙いが ±err 候補ぶんずれる。
 * (1 候補 = 360/64 = 5.6 度)
 */
export function humanShot(s, rnd, err, robust) {
  const shots = allShots(s), L = DIRS.length, by = {};
  for (const sh of shots) by[sh.dir + ':' + sh.power + ':' + (sh.ult ? 1 : 0)] = scoreShot(s, sh);
  let best = null, bv = -Infinity;
  for (const sh of shots) {
    let v = 0, n = 0;
    for (let k = -robust; k <= robust; k++) { const key = ((sh.dir + k + L) % L) + ':' + sh.power + ':' + (sh.ult ? 1 : 0); if (key in by) { v += by[key]; n++; } }
    v /= n;
    if (v > bv) { bv = v; best = sh; }
  }
  const off = Math.round((rnd() * 2 - 1) * err);
  const d = DIRS[(best.dir + off + L) % L];
  return { dx: d[0], dy: d[1], power: best.power, ult: best.ult };
}

/**
 * 「いっきに勝つ」: おまかせで最後まで回して結果だけ返す。
 * 返り値: { won, shots, state }。同じ盤面なら必ず同じ結果になる。
 */
export function autoResolve(cfg, maxShots) {
  const s = createBattle(cfg), cap = maxShots || 40;
  while (s.phase === 'aim' && s.shots < cap) { shoot(s, bestShot(s)); resolve(s); s.events = []; }
  return { won: s.phase === 'won', shots: s.shots, state: s };
}

/** 戦力の比(味方 ÷ 敵)。体力 × 攻撃力の合計で比べる、ごく粗い目安 */
export function powerRatio(cfg) {
  const sum = (list) => list.reduce((t, u) => t + (u.gauges ? u.gauges.reduce((a, b) => a + b, 0) : u.hp) * u.atk, 0);
  return sum(cfg.allies) / Math.max(1, sum(cfg.enemies));
}
/** 格下かどうか(「いっきに勝つ」を出してよいか)。ボス戦では出さない */
export function isTrivial(cfg) { return !cfg.enemies.some((e) => e.boss) && powerRatio(cfg) >= 2.5; }
