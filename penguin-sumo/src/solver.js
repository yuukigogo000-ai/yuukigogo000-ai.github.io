// 探索(フロアが解けるかの確認、目標ターン数、ヒント、バランス確認用の打ち手)
import { act, cloneState, stateKey, brakesLeft, intents, DIR_KEYS } from './core.js';

export function moves(s) {
  const out = [];
  for (const d of DIR_KEYS) out.push({ dir: d, brake: false });
  if (brakesLeft(s) > 0) for (const d of DIR_KEYS) out.push({ dir: d, brake: true });
  return out;
}

/** 盤面の良さ(大きいほど良い) */
export function evalState(s) {
  if (s.phase === 'won') return 100000 + s.p.hearts * 500 - s.turn * 10;
  if (s.phase === 'lost') return -100000;
  let v = s.p.hearts * 400 - s.turn * 2;
  for (const e of s.enemies) {
    if (!e.alive || e.object) continue;
    v -= e.boss ? e.hp * 120 : 80 + e.hp * 60;
    // 近いほど手が届きやすい
    v -= (Math.abs(e.x - s.p.x) + Math.abs(e.y - s.p.y)) * 2;
  }
  for (const it of intents(s)) for (const c of it.cells) if (c[0] === s.p.x && c[1] === s.p.y) { v -= 150; break; }
  return v;
}

/** 幅を絞った探索で勝ち筋を探す。見つかれば手順を返す */
export function solve(start, opts) {
  const beam = (opts && opts.beam) || 80, depth = (opts && opts.depth) || 28;
  let layer = [{ s: start, path: [] }];
  const seen = new Set([stateKey(start)]);
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const node of layer) {
      for (const m of moves(node.s)) {
        const c = cloneState(node.s);
        act(c, m.dir, m.brake);
        if (c.phase === 'won') return { won: true, path: node.path.concat([m]), state: c };
        if (c.phase === 'lost') continue;
        const k = stateKey(c);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: c, path: node.path.concat([m]), v: evalState(c) });
      }
    }
    if (!next.length) break;
    next.sort((a, b) => b.v - a.v);
    layer = next.slice(0, beam);
  }
  return { won: false, path: [], state: null };
}

/** 数手先まで読んで一番良い 1 手を返す(ヒント用、打ち手の模擬用) */
export function bestMove(s, depth) {
  const D = depth || 3;
  function rec(st, d) {
    if (st.phase !== 'play' || d === 0) return evalState(st);
    let best = -Infinity;
    for (const m of moves(st)) {
      const c = cloneState(st);
      act(c, m.dir, m.brake);
      const v = rec(c, d - 1);
      if (v > best) best = v;
    }
    return best;
  }
  let bm = null, bv = -Infinity;
  for (const m of moves(s)) {
    const c = cloneState(s);
    act(c, m.dir, m.brake);
    const v = rec(c, D - 1) - (m.brake ? 5 : 0); // ブレーキは差が出るときだけ使う
    if (v > bv) { bv = v; bm = m; }
  }
  return bm;
}
