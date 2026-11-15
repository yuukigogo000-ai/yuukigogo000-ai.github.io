/*
 * はじきバトル 試作 — 物理と戦闘ルールの中核(描画なし)
 *
 * 再現性のための決まり:
 *  - シミュレーション内で使う演算は + - * / と Math.sqrt, Math.round, Math.min/max だけ。
 *    (Math.sin / cos / atan2 / pow / hypot はエンジンごとに結果が違いうるので使わない)
 *  - 時間は固定刻み(1/240 秒)。フレームレートや時計に依存しない。
 *  - 入力は整数(方向ベクトル dx, dy と強さ 10..100)。
 *  - ユニットの処理順は常に id 順。乱数は使わない。
 *
 * ブラウザでは <script src="sim.js"> で globalThis.FlickSim に載る。Node では import './sim.js'。
 */
(function (root) {
  'use strict';

  const DT = 1 / 240;
  const W = 360, H = 520;
  const MAX_MOTION_STEPS = 240 * 12; // 1 回の動きは最長 12 秒で打ち切る(保険)
  const SPEED_CAP = 3000;
  const POWER_TO_SPEED = 14; // 強さ 100 で 1400 単位/秒
  const E_DISC = 0.8, E_RAIL = 0.75;
  const MIN_IMPACT = 40; // これ未満の接触はダメージにしない

  // 灰色の箱の段階なので、系統の代表だけを数体。重さ・摩擦・動き方の違いを確かめるための値。
  const ARCH = {
    pot:     { name: '鍋',         r: 22, mass: 1.0, fric: 800,  move: 'bounce', atk: 20, hp: 80,  skill: 'slash' },
    plush:   { name: 'ぬいぐるみ', r: 18, mass: 0.6, fric: 600,  move: 'bounce', atk: 14, hp: 60,  skill: 'burst' },
    pencil:  { name: 'えんぴつ',   r: 16, mass: 0.7, fric: 700,  move: 'pierce', atk: 16, hp: 55,  skill: 'stun' },
    onigiri: { name: 'おにぎり',   r: 20, mass: 0.9, fric: 800,  move: 'bounce', atk: 12, hp: 90,  skill: 'heal' },
    chair:   { name: 'いす',       r: 28, mass: 2.4, fric: 1100, move: 'bounce', atk: 18, hp: 150, skill: 'slash' },
    sponge:  { name: 'スポンジ',   r: 20, mass: 0.8, fric: 750,  move: 'bounce', atk: 14, hp: 60,  act: 'charge', count: 2 },
    kettle:  { name: 'やかん',     r: 24, mass: 1.4, fric: 900,  move: 'bounce', atk: 18, hp: 90,  act: 'blast', count: 3, blastR: 110 },
    chest:   { name: 'たんす',     r: 30, mass: 2.6, fric: 1100, move: 'bounce', atk: 22, hp: 150, act: 'blast', count: 4, blastR: 120 },
    vacuum:  { name: '掃除機',     r: 50, mass: 1.0, fric: 1000, move: 'bounce', atk: 26, hp: 600, act: 'blast', count: 3, blastR: 170,
               anchored: true, boss: true, pull: 380 },
  };

  // gaps = 柵が切れていて落ちる区間([開始, 終了]。上下は x、左右は y)
  const STAGES = {
    mob: {
      label: 'ザコ戦',
      gaps: { top: [[120, 240]], bottom: [], left: [[190, 300]], right: [[190, 300]] },
      players: [['pot', 110, 440], ['plush', 180, 475], ['pencil', 250, 440], ['onigiri', 180, 400]],
      enemies: [['sponge', 100, 140], ['sponge', 260, 140], ['kettle', 180, 80], ['chest', 180, 200]],
    },
    boss: {
      label: 'ボス戦(掃除機)',
      gaps: { top: [], bottom: [[130, 230]], left: [[240, 340]], right: [[240, 340]] },
      players: [['pot', 110, 440], ['plush', 180, 475], ['pencil', 250, 440], ['onigiri', 180, 400]],
      enemies: [['vacuum', 180, 130], ['sponge', 80, 250], ['sponge', 280, 250]],
    },
  };

  function makeUnit(id, side, key, x, y) {
    const a = ARCH[key];
    return {
      id, side, key, name: a.name, x, y, vx: 0, vy: 0, homeX: x, homeY: y,
      r: a.r, mass: a.mass, invMass: a.anchored ? 0 : 1 / a.mass, fric: a.fric, move: a.move,
      atk: a.atk, hp: a.hp, maxHp: a.hp, alive: true,
      skill: a.skill || null, act: a.act || null,
      count: a.count || 0, baseCount: a.count || 0, blastR: a.blastR || 0,
      anchored: !!a.anchored, boss: !!a.boss, pull: a.pull || 0,
    };
  }

  function createState(stageKey, overrides) {
    const st = STAGES[stageKey];
    const players = (overrides && overrides.players) || st.players;
    const enemies = (overrides && overrides.enemies) || st.enemies;
    const units = [];
    let id = 0;
    for (const p of players) units.push(makeUnit(id++, 0, p[0], p[1], p[2]));
    for (const e of enemies) units.push(makeUnit(id++, 1, e[0], e[1], e[2]));
    return {
      stage: stageKey, w: W, h: H, gaps: st.gaps, units,
      // shooterSafe: 弾いた味方本人は柵の切れ目でも跳ね返る / playerRingReturn: 味方は落ちても最大HPの3割を失って元の位置に戻る
      rules: Object.assign({ shooterSafe: false, playerRingReturn: false }, overrides && overrides.rules),
      phase: 'aim', active: 0, queue: [], motion: null,
      turnNo: 1, shots: 0, events: [],
      stats: { capHits: 0, maxMotionSteps: 0, steps: 0, maxPenetration: 0, dmgDirect: 0, dmgSkill: 0,
               koHp: [0, 0], koRing: [0, 0], selfRing: 0 },
    };
  }

  function cloneState(s) {
    return {
      stage: s.stage, w: s.w, h: s.h, gaps: s.gaps, rules: s.rules,
      units: s.units.map((u) => Object.assign({}, u)),
      phase: s.phase, active: s.active,
      queue: s.queue.map((q) => Object.assign({}, q)),
      motion: s.motion ? { shooter: s.motion.shooter, steps: s.motion.steps, inside: s.motion.inside,
                           hitAllies: s.motion.hitAllies.slice(), touching: s.motion.touching.slice() } : null,
      turnNo: s.turnNo, shots: s.shots, events: [],
      stats: Object.assign({}, s.stats, { koHp: s.stats.koHp.slice(), koRing: s.stats.koRing.slice() }),
    };
  }

  // ---- 戦闘ルール ----------------------------------------------------------

  function knockOut(s, u, how) {
    if (how === 'ring' && u.side === 0 && s.rules.playerRingReturn) {
      s.stats.ringReturns = (s.stats.ringReturns || 0) + 1;
      if (u.side === 0 && s.motion && s.motion.shooter === u.id) s.stats.selfRing++; // 自分で弾いて自分が落ちた回数
      u.hp -= Math.round(u.maxHp * 0.3);
      s.events.push({ t: 'fall', id: u.id });
      if (u.hp > 0) { u.x = u.homeX; u.y = u.homeY; u.vx = 0; u.vy = 0; return; }
      how = 'hp';
    }
    u.alive = false; u.vx = 0; u.vy = 0; u.hp = how === 'ring' ? u.hp : 0;
    if (how === 'ring') {
      s.stats.koRing[u.side]++;
      if (u.side === 0 && s.motion && s.motion.shooter === u.id) s.stats.selfRing++; // 自分で弾いて自分が落ちた回数
    } else s.stats.koHp[u.side]++;
    s.events.push({ t: 'ko', id: u.id, how });
  }

  function damage(s, src, tgt, dmg, viaSkill) {
    if (!tgt.alive || dmg <= 0) return;
    tgt.hp -= dmg;
    if (src.side === 0) { if (viaSkill) s.stats.dmgSkill += dmg; else s.stats.dmgDirect += dmg; }
    s.events.push({ t: 'hit', by: src.id, to: tgt.id, dmg, skill: !!viaSkill });
    if (tgt.hp <= 0) knockOut(s, tgt, 'hp');
  }

  function nearest(s, from, side) {
    let best = null, bd = 0;
    for (const u of s.units) {
      if (!u.alive || u.side !== side) continue;
      const dx = u.x - from.x, dy = u.y - from.y, d = dx * dx + dy * dy;
      if (best === null || d < bd) { best = u; bd = d; }
    }
    return best;
  }

  function fireSkill(s, by) {
    s.events.push({ t: 'skill', by: by.id, kind: by.skill });
    if (by.skill === 'slash') {
      const t = nearest(s, by, 1);
      if (t) damage(s, by, t, Math.round(by.atk * 1.5), true);
    } else if (by.skill === 'heal') {
      let t = null;
      for (const u of s.units) {
        if (!u.alive || u.side !== 0) continue;
        if (t === null || u.hp * t.maxHp < t.hp * u.maxHp) t = u;
      }
      if (t) { const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + 30); s.events.push({ t: 'heal', to: t.id, amt: t.hp - before }); }
    } else if (by.skill === 'stun') {
      const t = nearest(s, by, 1);
      if (t && t.count < t.baseCount + 2) { t.count += 1; s.events.push({ t: 'stun', to: t.id }); }
    } else if (by.skill === 'burst') {
      const R = 130;
      for (const u of s.units) {
        if (!u.alive || u.side !== 1) continue;
        const dx = u.x - by.x, dy = u.y - by.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= R + u.r) continue;
        damage(s, by, u, Math.round(by.atk * 0.5), true);
        if (!u.alive || u.anchored || d === 0) continue;
        const k = 700 * (1 - d / (R + u.r)) * u.invMass / d;
        u.vx += dx * k; u.vy += dy * k;
      }
    }
  }

  function onContact(s, a, b, impact) {
    const m = s.motion;
    if (!m || m.shooter < 0) return;
    if (a.id !== m.shooter && b.id !== m.shooter) return;
    const me = a.id === m.shooter ? a : b, other = me === a ? b : a;
    if (other.side !== me.side) {
      if (impact > MIN_IMPACT) damage(s, me, other, Math.round(me.atk * (0.4 + 0.6 * Math.min(1, impact / 900))), false);
    } else if (me.side === 0 && other.skill && m.hitAllies.indexOf(other.id) < 0) {
      m.hitAllies.push(other.id);
      fireSkill(s, other);
    }
  }

  // ---- 物理 ----------------------------------------------------------------

  function inGap(list, c) {
    for (const g of list) if (c >= g[0] && c <= g[1]) return true;
    return false;
  }

  const NO_GAPS = { top: [], bottom: [], left: [], right: [] };
  function rails(s, u) {
    const g = (s.rules.shooterSafe && u.side === 0 && s.motion && s.motion.shooter === u.id) ? NO_GAPS : s.gaps;
    if (u.x < u.r) {
      if (inGap(g.left, u.y)) { if (u.x < 0) return knockOut(s, u, 'ring'); }
      else { u.x = u.r; if (u.vx < 0) u.vx = -u.vx * E_RAIL; }
    } else if (u.x > s.w - u.r) {
      if (inGap(g.right, u.y)) { if (u.x > s.w) return knockOut(s, u, 'ring'); }
      else { u.x = s.w - u.r; if (u.vx > 0) u.vx = -u.vx * E_RAIL; }
    }
    if (u.y < u.r) {
      if (inGap(g.top, u.x)) { if (u.y < 0) return knockOut(s, u, 'ring'); }
      else { u.y = u.r; if (u.vy < 0) u.vy = -u.vy * E_RAIL; }
    } else if (u.y > s.h - u.r) {
      if (inGap(g.bottom, u.x)) { if (u.y > s.h) return knockOut(s, u, 'ring'); }
      else { u.y = s.h - u.r; if (u.vy > 0) u.vy = -u.vy * E_RAIL; }
    }
  }

  function collide(s, a, b) {
    const m = s.motion;
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    const key = a.id * 64 + b.id;
    const idx = m.touching.indexOf(key);
    if (d2 >= rr * rr) { if (idx >= 0) m.touching.splice(idx, 1); return; }
    const entered = idx < 0;
    if (entered) m.touching.push(key);

    // 貫通タイプは相手陣営をすり抜ける(入った瞬間に 1 回だけ当たり判定)
    const sh = m.shooter;
    if (sh >= 0 && (a.id === sh || b.id === sh)) {
      const me = a.id === sh ? a : b, other = me === a ? b : a;
      if (me.move === 'pierce' && other.side !== me.side) {
        if (entered) onContact(s, a, b, Math.sqrt(me.vx * me.vx + me.vy * me.vy));
        m.inside = true; // 重なっている間は減速させない
        return;
      }
    }

    let d = Math.sqrt(d2), nx = 1, ny = 0;
    if (d > 0) { nx = dx / d; ny = dy / d; }
    const ia = a.invMass, ib = b.invMass, isum = ia + ib;
    if (isum === 0) return;
    const pen = rr - d;
    if (pen > s.stats.maxPenetration) s.stats.maxPenetration = pen;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn < 0) {
      const j = -(1 + E_DISC) * vn / isum;
      a.vx -= j * ia * nx; a.vy -= j * ia * ny;
      b.vx += j * ib * nx; b.vy += j * ib * ny;
      onContact(s, a, b, -vn);
    }
    const k = pen / isum;
    a.x -= nx * k * ia; a.y -= ny * k * ia;
    b.x += nx * k * ib; b.y += ny * k * ib;
  }

  function physStep(s) {
    const us = s.units, n = us.length;
    const inside = s.motion.inside, shooter = s.motion.shooter;
    for (let i = 0; i < n; i++) {
      const u = us[i];
      if (!u.alive) continue;
      const sp2 = u.vx * u.vx + u.vy * u.vy;
      if (sp2 === 0) continue;
      let sp = Math.sqrt(sp2);
      if (sp > SPEED_CAP) { const c = SPEED_CAP / sp; u.vx *= c; u.vy *= c; sp = SPEED_CAP; }
      if (!(inside && u.id === shooter)) {
        const dec = u.fric * DT;
        if (sp <= dec) { u.vx = 0; u.vy = 0; continue; }
        const k = (sp - dec) / sp;
        u.vx *= k; u.vy *= k;
      }
      u.x += u.vx * DT; u.y += u.vy * DT;
    }
    s.motion.inside = false;
    for (let i = 0; i < n; i++) { const u = us[i]; if (u.alive && !u.anchored) rails(s, u); }
    for (let i = 0; i < n; i++) {
      const a = us[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < n; j++) { const b = us[j]; if (b.alive && a.alive) collide(s, a, b); }
    }
    s.motion.steps++;
    s.stats.steps++;
  }

  function anyMoving(s) {
    for (const u of s.units) if (u.alive && (u.vx !== 0 || u.vy !== 0)) return true;
    return false;
  }

  function startMotion(s, shooterId) {
    s.motion = { shooter: shooterId, steps: 0, hitAllies: [], touching: [], inside: false };
  }

  function launch(u, dx, dy, power) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const v = power * POWER_TO_SPEED;
    u.vx = dx / len * v; u.vy = dy / len * v;
  }

  // ---- 進行 ----------------------------------------------------------------

  function aliveCount(s, side) { let c = 0; for (const u of s.units) if (u.alive && u.side === side) c++; return c; }

  function checkEnd(s) {
    if (aliveCount(s, 1) === 0) { s.phase = 'won'; s.queue = []; return true; }
    if (aliveCount(s, 0) === 0) { s.phase = 'lost'; s.queue = []; return true; }
    return false;
  }

  function nextActive(s) {
    const ps = s.units.filter((u) => u.side === 0);
    const start = ps.findIndex((u) => u.id === s.active);
    for (let k = 1; k <= ps.length; k++) {
      const u = ps[(start + k) % ps.length];
      if (u.alive) return u.id;
    }
    return s.active;
  }

  function enqueueEnemyPhase(s) {
    for (const u of s.units) if (u.alive && u.side === 1 && u.pull) s.queue.push({ t: 'pull', id: u.id });
    for (const u of s.units) if (u.side === 1) s.queue.push({ t: 'tick', id: u.id });
    s.queue.push({ t: 'endEnemy' });
  }

  function runAction(s, a) {
    if (a.t === 'stop') { s.phase = 'aim'; return; }
    if (a.t === 'endEnemy') { s.active = nextActive(s); s.turnNo++; s.phase = 'aim'; return; }
    const u = s.units[a.id];
    if (!u.alive) return;
    if (a.t === 'pull') {
      s.events.push({ t: 'pull', by: u.id });
      for (const o of s.units) {
        if (!o.alive || o.anchored || o.id === u.id) continue;
        const dx = u.x - o.x, dy = u.y - o.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) continue;
        const k = u.pull * o.invMass / d;
        o.vx += dx * k; o.vy += dy * k;
      }
      startMotion(s, -1);
      return;
    }
    if (a.t === 'tick') {
      u.count -= 1;
      if (u.count > 0) return;
      u.count = u.baseCount;
      if (u.act === 'charge') {
        const t = nearest(s, u, 0);
        if (!t) return;
        s.events.push({ t: 'charge', by: u.id, to: t.id });
        launch(u, t.x - u.x, t.y - u.y, 70);
        startMotion(s, u.id);
      } else if (u.act === 'blast') {
        s.events.push({ t: 'blast', by: u.id, r: u.blastR });
        for (const o of s.units) {
          if (!o.alive || o.side !== 0) continue;
          const dx = o.x - u.x, dy = o.y - u.y;
          const reach = u.blastR + o.r;
          if (dx * dx + dy * dy <= reach * reach) damage(s, u, o, u.atk, false);
        }
      }
    }
  }

  /** 1 刻み進める。phase が 'resolving' のあいだ呼び続ける。 */
  function step(s) {
    if (s.phase !== 'resolving') return;
    if (s.motion) {
      physStep(s);
      const capped = s.motion.steps >= MAX_MOTION_STEPS;
      if (capped || !anyMoving(s)) {
        if (capped) { s.stats.capHits++; for (const u of s.units) { u.vx = 0; u.vy = 0; } }
        if (s.motion.steps > s.stats.maxMotionSteps) s.stats.maxMotionSteps = s.motion.steps;
        s.motion = null;
        checkEnd(s);
      }
      return;
    }
    if (checkEnd(s)) return;
    const a = s.queue.shift();
    if (!a) { s.phase = 'aim'; return; }
    runAction(s, a);
    if (!s.motion) checkEnd(s);
  }

  /** プレイヤーの 1 手。dx, dy は整数の方向、power は 10..100 の整数。 */
  function shoot(s, dx, dy, power, opts) {
    if (s.phase !== 'aim') return false;
    dx = Math.round(dx); dy = Math.round(dy);
    power = Math.max(10, Math.min(100, Math.round(power)));
    if (dx === 0 && dy === 0) return false;
    const u = s.units[s.active];
    if (!u || !u.alive) return false;
    launch(u, dx, dy, power);
    startMotion(s, u.id);
    s.shots++;
    s.phase = 'resolving';
    if (opts && opts.noEnemyPhase) s.queue.push({ t: 'stop' }); else enqueueEnemyPhase(s);
    return true;
  }

  function resolve(s) { while (s.phase === 'resolving') step(s); return s; }

  // ---- 再現性の確認用ハッシュ(FNV-1a。全ユニットの倍精度ビット列) ----------

  const f64 = new Float64Array(1), u8 = new Uint8Array(f64.buffer);
  function hashState(s, seedHash) {
    let h = seedHash === undefined ? 0x811c9dc5 : seedHash;
    const put = (v) => { f64[0] = v; for (let i = 0; i < 8; i++) { h ^= u8[i]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const u of s.units) { put(u.x); put(u.y); put(u.vx); put(u.vy); put(u.hp); put(u.count); put(u.alive ? 1 : 0); }
    put(s.turnNo); put(s.active);
    return h >>> 0;
  }

  // ---- おまかせ(候補の手を全部シミュレータに通して一番良いものを選ぶ) --------

  // 三角関数を使わずに方向の候補を作る(正方形の周上の整数点)
  const DIRS = (function () {
    const out = [], N = 16;
    for (let x = -N; x < N; x++) out.push([x, -N]);
    for (let y = -N; y < N; y++) out.push([N, y]);
    for (let x = N; x > -N; x--) out.push([x, N]);
    for (let y = N; y > -N; y--) out.push([-N, y]);
    return out;
  })();
  const POWERS = [50, 75, 100];

  function scoreShot(s, dx, dy, power) {
    const c = cloneState(s);
    const before = c.units.map((u) => (u.alive ? u.hp : 0));
    shoot(c, dx, dy, power, { noEnemyPhase: true });
    resolve(c);
    let sc = 0;
    for (const u of c.units) {
      const lost = before[u.id] - (u.alive ? u.hp : 0);
      if (u.side === 1) { sc += Math.min(lost, before[u.id]); if (!u.alive && before[u.id] > 0) sc += 60; }
      else { sc -= lost > 0 ? lost : lost * 0.5; if (!u.alive && before[u.id] > 0) sc -= 120; }
    }
    return sc;
  }

  function bestShot(s) {
    let best = null;
    for (let i = 0; i < DIRS.length; i++) {
      for (const p of POWERS) {
        const sc = scoreShot(s, DIRS[i][0], DIRS[i][1], p);
        if (best === null || sc > best.score) best = { dx: DIRS[i][0], dy: DIRS[i][1], power: p, score: sc, dirIndex: i };
      }
    }
    return best;
  }

  // 整数だけの乱数(検証用)
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  root.FlickSim = { DT, W, H, ARCH, STAGES, DIRS, POWERS, POWER_TO_SPEED,
    createState, cloneState, shoot, step, resolve, hashState, bestShot, scoreShot, mulberry32 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
