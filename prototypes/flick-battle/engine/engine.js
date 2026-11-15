/*
 * おはじきバトル 戦闘エンジン(描画なし・依存なし)
 *
 * 設計は ../DESIGN.md。ここは「ルールと物理」だけを持ち、画面は別。
 *
 * 再現性のための決まり:
 *  - シミュレーション内の演算は + - * / と Math.sqrt / round / floor / min / max だけ
 *    (sin / cos / atan2 / pow / hypot は使わない)
 *  - 時間は固定刻み(1/240 秒)。入力は整数(向き dx, dy と 強さ 1〜3)
 *  - ユニットは常に id 順に処理する。乱数は使わない
 */

export const DT = 1 / 240;
export const W = 360, H = 520;
const MAX_MOTION_STEPS = 240 * 12;
const SPEED_CAP = 3000;
const E_DISC = 0.8, E_RAIL = 0.75;
const MIN_IMPACT = 40;      // これ未満の接触はダメージにしない
const STRONG_IMPACT = 700;  // これ以上は「強打」(1.5 倍)
const HIT_FALLOFF = [1, 0.5, 0.25]; // 1 手の中で同じ敵に当たった 1・2・3 回目の倍率(4 回目以降は押すだけ)
const CHAIN_STEP = 0.15, CHAIN_CAP = 1.0;
const FALL_COST = 0.3;      // 味方が落ちたときに失う体力(最大体力比)
const SHIELD_CAP = 0.5;
const POISON_CAP = 5;

export const POWER_SPEED = [0, 700, 1050, 1400]; // 強さ 1〜3
/** おもさ 1〜5 → 質量・摩擦・半径 */
export const WEIGHT = {
  mass: [0, 0.5, 0.8, 1.2, 1.8, 2.7],
  fric: [0, 600, 680, 760, 900, 1050],
  r: [0, 16, 18, 21, 24, 28],
};

export const DEFAULT_GAPS = { top: [[120, 240]], bottom: [], left: [[190, 300]], right: [[190, 300]] };
const ALLY_SPOTS = [[110, 440], [250, 440], [180, 400], [180, 478]];

// ---- 生成 --------------------------------------------------------------------

function baseUnit(id, side, kind, spec, x, y) {
  const w = Math.max(1, Math.min(5, spec.weight || 3));
  const r = spec.r || WEIGHT.r[w];
  const mass = spec.mass || WEIGHT.mass[w];
  return {
    id, side, kind, name: spec.name || '', lineage: spec.lineage || null,
    x, y, vx: 0, vy: 0, homeX: x, homeY: y,
    weight: w, r, mass, invMass: 1 / mass, fric: spec.fric || WEIGHT.fric[w], move: spec.move || 'bounce',
    atk: spec.atk || 10, hp: spec.hp || 50, maxHp: spec.hp || 50, alive: true,
    shield: 0, poison: 0, poisonDmg: 0, anchored: !!spec.anchored,
    // 味方
    touch: spec.touch || null, ult: spec.ult || null, ultNeed: spec.ultNeed || 3, ultCharge: 0,
    hold: false, noFallTurn: -1,
    // 敵
    action: spec.action || null, count: spec.count || 0, baseCount: spec.count || 0, actR: spec.actR || 110,
    trait: spec.trait || null, minion: !!spec.minion, owner: -1, stagger: 0,
    // ボス
    boss: spec.boss || null, gauges: spec.gauges ? spec.gauges.slice() : null, gaugeIdx: 0,
  };
}

/**
 * cfg: {
 *   allies: [{ name, lineage, hp, atk, weight, move, touch, ult, ultNeed, x?, y? }],  // 並び順 = 弾く順
 *   enemies: [{ name, hp, atk, weight, action, count, actR, trait, x, y, boss?, gauges?, anchored? }],
 *   obstacles: [{ x, y, r }], gaps, patches: [{ x, y, r, kind: 'wet'|'mat'|'stove', turns: -1 }], wind: { ax, ay }
 * }
 */
export function createBattle(cfg) {
  const s = {
    w: W, h: H,
    gaps: cfg.gaps || DEFAULT_GAPS,
    gapCycle: cfg.gapCycle || null, gapCycleIdx: 0,
    patches: (cfg.patches || []).map((p) => Object.assign({ turns: -1 }, p)),
    wind: cfg.wind ? { ax: cfg.wind.ax, ay: cfg.wind.ay } : null,
    windCycle: cfg.windCycle || null, windIdx: 0,
    slickTurns: 0,
    units: [], phase: 'aim', active: 0, queue: [], motion: null, pendingAfter: null,
    turnNo: 1, shots: 0, extraShots: 0, chain: 0, bestChain: 0, events: [],
    stats: { capHits: 0, steps: 0, maxMotionSteps: 0, maxPenetration: 0, allyFalls: 0, allyKo: 0, enemyRing: 0, enemyKo: 0,
             dmgHit: 0, dmgTouch: 0, dmgUlt: 0, dmgTaken: 0, ultsUsed: 0 },
  };
  let id = 0;
  (cfg.allies || []).forEach((a, i) => {
    const sp = ALLY_SPOTS[i % ALLY_SPOTS.length];
    s.units.push(baseUnit(id++, 0, 'ally', a, a.x === undefined ? sp[0] : a.x, a.y === undefined ? sp[1] : a.y));
  });
  for (const e of cfg.enemies || []) {
    const u = baseUnit(id++, 1, e.boss ? 'boss' : 'enemy', e, e.x, e.y);
    if (u.kind === 'boss' && !u.gauges) u.gauges = [u.hp];
    if (u.gauges) { u.hp = u.maxHp = u.gauges[0]; }
    s.units.push(u);
  }
  for (const o of cfg.obstacles || []) {
    const u = baseUnit(id++, 2, 'obstacle', { name: o.name || 'コップ', r: o.r || 18, hp: 1, anchored: true }, o.x, o.y);
    s.units.push(u);
  }
  s.active = firstAlive(s, 0);
  beginAllyTurn(s);
  return s;
}

export function cloneState(s) {
  const m = s.motion;
  return Object.assign({}, s, {
    patches: s.patches.map((p) => Object.assign({}, p)),
    wind: s.wind ? { ax: s.wind.ax, ay: s.wind.ay } : null,
    units: s.units.map((u) => Object.assign({}, u, { gauges: u.gauges })),
    queue: s.queue.map((q) => Object.assign({}, q)),
    motion: m ? Object.assign({}, m, { hitAllies: m.hitAllies.slice(), touching: m.touching.slice(), subs: m.subs.slice(),
                                       hits: Object.assign({}, m.hits), pairs: m.pairs.slice() }) : null,
    pendingAfter: s.pendingAfter, events: [],
    stats: Object.assign({}, s.stats),
  });
}

// ---- 小道具 ------------------------------------------------------------------

const isFoe = (u) => u.side === 1;
const peeled = (u) => u.hp * 2 <= u.maxHp;

function firstAlive(s, side) { for (const u of s.units) if (u.alive && u.side === side) return u.id; return -1; }
function aliveCount(s, side) { let c = 0; for (const u of s.units) if (u.alive && u.side === side) c++; return c; }

function nearest(s, from, side, exceptId) {
  let best = null, bd = 0;
  for (const u of s.units) {
    if (!u.alive || u.side !== side || u.id === exceptId) continue;
    const dx = u.x - from.x, dy = u.y - from.y, d = dx * dx + dy * dy;
    if (best === null || d < bd) { best = u; bd = d; }
  }
  return best;
}
function dist(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }

function chainMult(s) { return 1 + Math.min(CHAIN_CAP, s.chain * CHAIN_STEP); }
function addChain(s, why) {
  s.chain++;
  if (s.chain > s.bestChain) s.bestChain = s.chain;
  s.events.push({ t: 'chain', n: s.chain, why });
}

function addCount(u, n) {
  const cap = u.baseCount + 2;
  if (u.kind === 'boss' || u.count >= cap) return 0;
  const before = u.count;
  u.count = Math.min(cap, u.count + n);
  return u.count - before;
}

function addShield(s, u, ratio) {
  const cap = Math.round(u.maxHp * SHIELD_CAP);
  const before = u.shield;
  u.shield = Math.min(cap, u.shield + Math.round(u.maxHp * ratio));
  if (u.shield > before) s.events.push({ t: 'shield', to: u.id, amt: u.shield - before });
}

function heal(s, u, amt) {
  const before = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + Math.round(amt));
  if (u.hp > before) s.events.push({ t: 'heal', to: u.id, amt: u.hp - before });
}

function addPoison(s, u, stacks, perStack) {
  if (!u.alive || u.kind === 'obstacle') return;
  u.poison = Math.min(POISON_CAP, u.poison + stacks);
  if (perStack > u.poisonDmg) u.poisonDmg = perStack;
  s.events.push({ t: 'poison', to: u.id, n: u.poison });
}

// ---- 退場・ダメージ ----------------------------------------------------------

function onEnemyDown(s, u, how) {
  if (how === 'ring') { s.stats.enemyRing++; addChain(s, 'ring'); return; }
  s.stats.enemyKo++;
  if (u.action === 'bomb') explode(s, u);
  if (u.trait === 'split' && !u.minion) spawnMinis(s, u);
}

function knockOut(s, u, how) {
  if (!u.alive) return;
  u.alive = false; u.vx = 0; u.vy = 0;
  if (how !== 'ring') u.hp = 0;
  s.events.push({ t: 'ko', id: u.id, how });
  if (u.side === 0) s.stats.allyKo++;
  else if (u.side === 1) onEnemyDown(s, u, how);
}

/** 柵の切れ目から出た */
function fallOff(s, u) {
  if (u.side === 0) {
    s.stats.allyFalls++;
    u.hp -= Math.round(u.maxHp * FALL_COST);
    s.events.push({ t: 'fall', id: u.id });
    if (u.hp <= 0) return knockOut(s, u, 'hp');
    u.x = -999; u.y = -999; // いったん盤外に置いてから空き場所を探す
    const spot = freeSpot(s, u.homeX, u.homeY, u.r) || [u.homeX, u.homeY];
    u.x = spot[0]; u.y = spot[1]; u.vx = 0; u.vy = 0;
    return;
  }
  knockOut(s, u, 'ring');
}

/** kind: 'hit' | 'touch' | 'ult' | 'foe' | 'dot' */
function damage(s, src, tgt, raw, kind) {
  if (!tgt.alive || tgt.kind === 'obstacle') return 0;
  let dmg = Math.round(raw);
  if (dmg <= 0) return 0;
  if (tgt.side === 0 && tgt.hold) dmg = Math.round(dmg * 0.7); // 居座り中は 3 割軽減
  if (tgt.shield > 0) {
    const ab = Math.min(tgt.shield, dmg);
    tgt.shield -= ab; dmg -= ab;
    if (ab > 0) s.events.push({ t: 'block', to: tgt.id, amt: ab });
    if (dmg <= 0) return 0;
  }
  tgt.hp -= dmg;
  if (tgt.side === 1) {
    if (kind === 'hit') s.stats.dmgHit += dmg; else if (kind === 'touch') s.stats.dmgTouch += dmg; else if (kind === 'ult') s.stats.dmgUlt += dmg;
  } else if (tgt.side === 0) s.stats.dmgTaken += dmg;
  s.events.push({ t: 'hit', by: src ? src.id : -1, to: tgt.id, dmg, kind });
  if (tgt.hp <= 0) {
    if (tgt.kind === 'boss' && tgt.gaugeIdx < tgt.gauges.length - 1) {
      // 体力ゲージを 1 本割った: ひるんで次の行動を飛ばし、次の段階へ
      tgt.gaugeIdx++;
      tgt.hp = tgt.maxHp = tgt.gauges[tgt.gaugeIdx];
      tgt.stagger = 1; tgt.count = tgt.baseCount; tgt.poison = 0;
      s.events.push({ t: 'gaugeBreak', id: tgt.id, phase: tgt.gaugeIdx });
    } else knockOut(s, tgt, 'hp');
  }
  return dmg;
}

function explode(s, u) {
  const R = u.actR;
  s.events.push({ t: 'explode', by: u.id, r: R });
  for (const o of s.units) {
    if (!o.alive || o.id === u.id || o.kind === 'obstacle') continue;
    const reach = R + o.r, dx = o.x - u.x, dy = o.y - u.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    damage(s, u, o, o.side === 0 ? u.atk : u.atk * 0.75, 'foe');
  }
}

function freeSpot(s, x, y, r) {
  const tries = [[0, 0], [44, 0], [-44, 0], [0, 44], [0, -44], [44, 44], [-44, 44], [44, -44], [-44, -44]];
  for (const t of tries) {
    const px = Math.max(r + 4, Math.min(s.w - r - 4, x + t[0])), py = Math.max(r + 4, Math.min(s.h - r - 4, y + t[1]));
    let ok = true;
    for (const o of s.units) {
      if (!o.alive) continue;
      const dx = o.x - px, dy = o.y - py, rr = o.r + r;
      if (dx * dx + dy * dy < rr * rr) { ok = false; break; }
    }
    if (ok) return [px, py];
  }
  return null;
}

function spawn(s, spec, x, y) {
  const spot = freeSpot(s, x, y, spec.r || WEIGHT.r[spec.weight || 1]);
  if (!spot) return null;
  const u = baseUnit(s.units.length, 1, 'enemy', spec, spot[0], spot[1]);
  s.units.push(u);
  s.events.push({ t: 'spawn', id: u.id });
  return u;
}

function spawnMinis(s, u) {
  for (const off of [-1, 1]) {
    spawn(s, { name: u.name + '(小)', weight: Math.max(1, u.weight - 1), hp: Math.max(8, Math.round(u.maxHp * 0.3)), atk: Math.round(u.atk * 0.6),
               action: u.action, count: u.baseCount, actR: Math.round(u.actR * 0.7), minion: true }, u.x + off * (u.r + 4), u.y);
  }
}

// ---- タッチ技(味方にぶつけられたときに出す) ----------------------------------

function pushOut(s, from, R, power, side) {
  for (const u of s.units) {
    if (!u.alive || u.side !== side || u.anchored) continue;
    const dx = u.x - from.x, dy = u.y - from.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d >= R + u.r || d === 0) continue;
    const k = power * (1 - d / (R + u.r)) * u.invMass / d;
    u.vx += dx * k; u.vy += dy * k;
  }
}

function fireTouch(s, by) {
  const mult = chainMult(s);
  s.events.push({ t: 'touch', by: by.id, kind: by.touch });
  switch (by.touch) {
    case 'slash': { // 一閃: 一番近い敵に大ダメージ
      const t = nearest(s, by, 1);
      if (t) damage(s, by, t, by.atk * 1.5 * mult, 'touch');
      break;
    }
    case 'feed': { // 給食: 一番弱った味方を回復し、毒を消す
      let t = null;
      for (const u of s.units) { if (!u.alive || u.side !== 0) continue; if (t === null || u.hp * t.maxHp < t.hp * u.maxHp) t = u; }
      if (t) { heal(s, t, t.maxHp * 0.25); t.poison = 0; }
      break;
    }
    case 'snipe': { // 狙撃: 一番はがれかけた敵にダメージ(どこにいても)
      let t = null;
      for (const u of s.units) { if (!u.alive || u.side !== 1) continue; if (t === null || u.hp * t.maxHp < t.hp * u.maxHp) t = u; }
      if (t) damage(s, by, t, by.atk * 1.2 * mult, 'touch');
      break;
    }
    case 'read': { // 読み聞かせ: 一番近い敵のカウント+1
      const t = nearest(s, by, 1);
      if (t && addCount(t, 1)) s.events.push({ t: 'stun', to: t.id });
      break;
    }
    case 'spore': { // 胞子: 周りの敵に毒
      for (const u of s.units) { if (u.alive && u.side === 1 && dist(by, u) < 120 + u.r) addPoison(s, u, 2, Math.max(1, Math.round(by.atk * 0.2))); }
      break;
    }
    case 'chase': { // 追撃: 自分が一番近い敵へ飛び出す
      const t = nearest(s, by, 1);
      if (t && !by.anchored) { launchAt(by, t.x - by.x, t.y - by.y, POWER_SPEED[2]); if (s.motion.subs.indexOf(by.id) < 0) s.motion.subs.push(by.id); }
      break;
    }
    case 'boot': { // 起動: 周りの敵を外へ吹き飛ばす
      for (const u of s.units) { if (u.alive && u.side === 1 && dist(by, u) < 130 + u.r) damage(s, by, u, by.atk * 0.5 * mult, 'touch'); }
      pushOut(s, by, 130, 800, 1);
      break;
    }
    case 'charge': { // 充電: 次に弾く味方の必殺を 1 つ進める
      const nx = s.units[nextAllyId(s)];
      if (nx && nx.alive) { nx.ultCharge = Math.min(nx.ultNeed, nx.ultCharge + 1); s.events.push({ t: 'charge', to: nx.id }); }
      break;
    }
    case 'layer': { // 重ね着: 近くの味方に盾
      for (const u of s.units) { if (u.alive && u.side === 0 && dist(by, u) < 140 + u.r) addShield(s, u, 0.2); }
      break;
    }
    case 'sit': { // 居座り: 次の自分の番まで動かない壁になる
      by.hold = true; by.anchored = true; by.vx = 0; by.vy = 0;
      break;
    }
    case 'pop': { // びっくり箱: 周りを弾き飛ばし、カウント+1
      for (const u of s.units) { if (u.alive && u.side === 1 && dist(by, u) < 120 + u.r && addCount(u, 1)) s.events.push({ t: 'stun', to: u.id }); }
      pushOut(s, by, 120, 600, 1);
      break;
    }
    case 'wash': { // 洗浄: 味方の毒を消し、足元に石けん(滑る床)を作る
      for (const u of s.units) if (u.alive && u.side === 0) u.poison = 0;
      s.patches.push({ x: by.x, y: by.y, r: 60, kind: 'wet', turns: 3 });
      s.events.push({ t: 'patch', kind: 'wet', x: by.x, y: by.y });
      break;
    }
    default: break;
  }
}

// ---- 必殺技 ------------------------------------------------------------------

function applyUlt(s, u, m) {
  s.stats.ultsUsed++;
  s.events.push({ t: 'ult', by: u.id, kind: u.ult });
  m.ult = u.ult;
  switch (u.ult) {
    case 'sweep': m.pierce = true; m.dmgMul = 2; break;                 // 大なぎ払い
    case 'feast':                                                        // おかわり
      for (const a of s.units) if (a.alive && a.side === 0) { heal(s, a, a.maxHp * 0.3); a.poison = 0; }
      break;
    case 'ruler': m.freeBounces = 3; m.execute = true; break;           // 定規ショット
    case 'recital':                                                      // 朗読会
      for (const e of s.units) if (e.alive && e.side === 1) addCount(e, 2);
      break;
    case 'bloom':                                                        // 大繁殖
      for (const e of s.units) if (e.alive && e.side === 1) addPoison(s, e, 3, Math.max(1, Math.round(u.atk * 0.2)));
      break;
    case 'rampage': s.extraShots = 2; break;                             // 大暴れ
    case 'fullpower': m.massMul = 2; m.peelHit = true; break;            // フルパワー
    case 'discharge': m.lightning = true; break;                         // 放電
    case 'layers':                                                       // 総重ね着
      for (const a of s.units) if (a.alive && a.side === 0) { addShield(s, a, 0.3); a.noFallTurn = s.turnNo; }
      break;
    case 'rearrange': s.pendingAfter = { kind: 'shove', id: u.id }; break; // 模様替え
    case 'bigpop': s.pendingAfter = { kind: 'bigpop', id: u.id }; break;   // 大びっくり箱
    case 'bubbles': s.slickTurns = 2; break;                             // 泡まみれ
    default: break;
  }
}

function runAfter(s, a) {
  const u = s.units[a.id];
  if (!u.alive) return false;
  s.events.push({ t: 'ultAfter', by: u.id, kind: a.kind });
  if (a.kind === 'shove') pushOut(s, u, 400, 1100, 1);
  else {
    for (const e of s.units) if (e.alive && e.side === 1) addCount(e, 1);
    pushOut(s, u, 400, 900, 1);
  }
  startMotion(s, -1, {});
  return true;
}

function lightning(s, src, from, mult) {
  let cur = from;
  const seen = [from.id];
  for (let i = 0; i < 3; i++) {
    let nx = null, bd = 0;
    for (const e of s.units) {
      if (!e.alive || e.side !== 1 || seen.indexOf(e.id) >= 0) continue;
      const d = dist(cur, e);
      if (d > 170) continue;
      if (nx === null || d < bd) { nx = e; bd = d; }
    }
    if (!nx) break;
    seen.push(nx.id);
    s.events.push({ t: 'bolt', from: cur.id, to: nx.id });
    damage(s, src, nx, src.atk * mult, 'ult');
    cur = nx;
  }
}

// ---- 接触の処理 --------------------------------------------------------------

function shooterHitsFoe(s, sh, en, impact) {
  const m = s.motion;
  const n = m.hits[en.id] || 0;
  if (n >= HIT_FALLOFF.length || impact <= MIN_IMPACT) return;
  m.hits[en.id] = n + 1;
  const mult = chainMult(s);
  if (n === 0) addChain(s, 'hit');
  if (!m.bankUsed && m.bounces > 0) { m.bankUsed = true; addChain(s, 'bank'); }
  let dmg = sh.atk * HIT_FALLOFF[n] * (impact >= STRONG_IMPACT ? 1.5 : 1) * (m.dmgMul || 1) * mult;
  const fromBehind = sh.y < en.y; // 敵は手前(下)を向いている。奥(上)側から当てると「背中」
  if (en.trait === 'hard' && !peeled(en)) dmg *= 0.5;
  if ((en.trait === 'back' || en.kind === 'boss') && fromBehind) dmg *= 2;
  if (impact >= STRONG_IMPACT) s.events.push({ t: 'strong', to: en.id });
  damage(s, sh, en, dmg, m.ult ? 'ult' : 'hit');
  if (en.trait === 'spike' && !fromBehind && en.alive) damage(s, en, sh, en.atk * 0.5, 'foe');
  if (!en.alive) return;
  if (m.execute && en.kind !== 'boss' && peeled(en)) { s.events.push({ t: 'execute', to: en.id }); knockOut(s, en, 'hp'); return; }
  if (m.peelHit && n === 0) {
    if (en.kind === 'boss') damage(s, sh, en, sh.atk * 2 * mult, 'ult');
    else if (!peeled(en)) { const cut = en.hp - Math.floor(en.maxHp / 2); damage(s, sh, en, cut, 'ult'); }
  }
  if (m.lightning && n === 0) lightning(s, sh, en, mult);
}

function onContact(s, a, b, impact) {
  const m = s.motion;
  if (!m) return;
  // 敵同士がぶつかった(プレイヤーの手の最中だけ、組ごとに 1 回)
  if (!m.foeShot && isFoe(a) && isFoe(b) && impact > 200) {
    const key = a.id * 64 + b.id;
    if (m.pairs.indexOf(key) < 0) { m.pairs.push(key); addChain(s, 'crash'); }
    return;
  }
  const sh = m.shooter;
  if (sh >= 0 && (a.id === sh || b.id === sh)) {
    const me = a.id === sh ? a : b, other = me === a ? b : a;
    if (m.foeShot) { // 敵のたいあたり
      if (other.side === 0 && impact > MIN_IMPACT && m.hitAllies.indexOf(other.id) < 0) { m.hitAllies.push(other.id); damage(s, me, other, me.atk, 'foe'); }
      return;
    }
    if (isFoe(other)) shooterHitsFoe(s, me, other, impact);
    else if (other.side === 0 && other.touch && m.hitAllies.indexOf(other.id) < 0) {
      m.hitAllies.push(other.id);
      addChain(s, 'touch');
      fireTouch(s, other);
    }
    return;
  }
  // 追撃で飛び出した味方
  if (!m.foeShot) {
    const sa = m.subs.indexOf(a.id) >= 0, sb = m.subs.indexOf(b.id) >= 0;
    if (sa === sb) return;
    const me = sa ? a : b, other = sa ? b : a;
    if (!isFoe(other) || impact <= MIN_IMPACT) return;
    const key = 4096 + me.id * 64 + other.id;
    if (m.pairs.indexOf(key) >= 0) return;
    m.pairs.push(key);
    const mult = chainMult(s);
    addChain(s, 'chase');
    damage(s, me, other, me.atk * mult, 'touch');
  }
}

// ---- 物理 --------------------------------------------------------------------

function invM(s, u) {
  if (u.anchored) return 0;
  const m = s.motion;
  if (m && m.massMul && u.id === m.shooter) return u.invMass / m.massMul;
  return u.invMass;
}

function inGap(list, c) { for (const g of list) if (c >= g[0] && c <= g[1]) return true; return false; }

function canFall(s, u) {
  if (u.kind === 'boss' || u.anchored) return false;
  if (!peeled(u)) return false; // 体力が半分より多い駒は貼りついていて落ちない
  if (u.side === 0 && u.noFallTurn === s.turnNo) return false;
  return true;
}

function rails(s, u) {
  const g = s.gaps, m = s.motion, open = canFall(s, u);
  let bounced = false;
  if (u.x < u.r) {
    if (open && inGap(g.left, u.y)) { if (u.x < 0) return fallOff(s, u); }
    else { u.x = u.r; if (u.vx < 0) { u.vx = -u.vx * E_RAIL; bounced = true; } }
  } else if (u.x > s.w - u.r) {
    if (open && inGap(g.right, u.y)) { if (u.x > s.w) return fallOff(s, u); }
    else { u.x = s.w - u.r; if (u.vx > 0) { u.vx = -u.vx * E_RAIL; bounced = true; } }
  }
  if (u.y < u.r) {
    if (open && inGap(g.top, u.x)) { if (u.y < 0) return fallOff(s, u); }
    else { u.y = u.r; if (u.vy < 0) { u.vy = -u.vy * E_RAIL; bounced = true; } }
  } else if (u.y > s.h - u.r) {
    if (open && inGap(g.bottom, u.x)) { if (u.y > s.h) return fallOff(s, u); }
    else { u.y = s.h - u.r; if (u.vy > 0) { u.vy = -u.vy * E_RAIL; bounced = true; } }
  }
  if (bounced && m && u.id === m.shooter) m.bounces++;
}

function collide(s, a, b) {
  const m = s.motion;
  const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
  const key = a.id * 64 + b.id;
  const idx = m.touching.indexOf(key);
  if (d2 >= rr * rr) { if (idx >= 0) m.touching.splice(idx, 1); return; }
  const entered = idx < 0;
  if (entered) m.touching.push(key);

  // つきぬける: 弾いた駒は相手陣営をすり抜ける(入った瞬間に 1 回だけ当たり判定)
  const sh = m.shooter;
  if (sh >= 0 && !m.foeShot && (a.id === sh || b.id === sh)) {
    const me = a.id === sh ? a : b, other = me === a ? b : a;
    if ((me.move === 'pierce' || m.pierce) && isFoe(other)) {
      if (entered) onContact(s, a, b, Math.sqrt(me.vx * me.vx + me.vy * me.vy));
      m.inside = true;
      return;
    }
  }

  const d = Math.sqrt(d2);
  let nx = 1, ny = 0;
  if (d > 0) { nx = dx / d; ny = dy / d; }
  const ia = invM(s, a), ib = invM(s, b), isum = ia + ib;
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
  // 重なりをほどく。接触の処理で「動かない壁」になった駒は動かさないので、ここで取り直す
  const pa = invM(s, a), pb = invM(s, b), psum = pa + pb;
  if (psum === 0) return;
  const k = pen / psum;
  a.x -= nx * k * pa; a.y -= ny * k * pa;
  b.x += nx * k * pb; b.y += ny * k * pb;
}

function patchAt(s, u) {
  for (const p of s.patches) {
    const dx = u.x - p.x, dy = u.y - p.y;
    if (dx * dx + dy * dy <= p.r * p.r) return p;
  }
  return null;
}

function physStep(s) {
  const us = s.units, n = us.length, m = s.motion;
  const inside = m.inside, shooter = m.shooter;
  const windA = s.wind ? Math.sqrt(s.wind.ax * s.wind.ax + s.wind.ay * s.wind.ay) : 0;
  for (let i = 0; i < n; i++) {
    const u = us[i];
    if (!u.alive || u.anchored) continue;
    const sp2 = u.vx * u.vx + u.vy * u.vy;
    if (sp2 === 0) continue;
    let sp = Math.sqrt(sp2);
    if (sp > SPEED_CAP) { const c = SPEED_CAP / sp; u.vx *= c; u.vy *= c; sp = SPEED_CAP; }
    const free = u.id === shooter && (inside || (m.freeBounces > 0 && m.bounces < m.freeBounces));
    if (!free) {
      let fr = u.fric;
      const p = patchAt(s, u);
      if (p) fr *= p.kind === 'wet' ? 0.4 : p.kind === 'mat' ? 2 : 1;
      if (s.slickTurns > 0) fr *= 0.5;
      if (fr < windA + 120) fr = windA + 120; // 風より必ず強くして、いつか止まるようにする
      const dec = fr * DT;
      if (sp <= dec) { u.vx = 0; u.vy = 0; continue; }
      const k = (sp - dec) / sp;
      u.vx *= k; u.vy *= k;
    }
    if (s.wind) { u.vx += s.wind.ax * DT; u.vy += s.wind.ay * DT; }
    u.x += u.vx * DT; u.y += u.vy * DT;
  }
  m.inside = false;
  for (let i = 0; i < n; i++) { const u = us[i]; if (u.alive && !u.anchored) rails(s, u); }
  for (let i = 0; i < n; i++) {
    const a = us[i];
    if (!a.alive) continue;
    const aStill = a.vx === 0 && a.vy === 0;
    for (let j = i + 1; j < n; j++) {
      const b = us[j];
      if (!b.alive || !a.alive) continue;
      if (aStill && b.vx === 0 && b.vy === 0) continue;
      collide(s, a, b);
    }
  }
  m.steps++;
  s.stats.steps++;
}

function anyMoving(s) { for (const u of s.units) if (u.alive && (u.vx !== 0 || u.vy !== 0)) return true; return false; }

function startMotion(s, shooterId, opts) {
  s.motion = Object.assign({ shooter: shooterId, steps: 0, hitAllies: [], touching: [], subs: [], hits: {}, pairs: [],
                             inside: false, bounces: 0, bankUsed: false, foeShot: false, ult: null,
                             pierce: false, dmgMul: 0, massMul: 0, freeBounces: 0, execute: false, peelHit: false, lightning: false }, opts);
}

function launchAt(u, dx, dy, speed) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  u.vx = dx / len * speed; u.vy = dy / len * speed;
}

// ---- 敵の番 ------------------------------------------------------------------

function nextAllyId(s) {
  const al = s.units.filter((u) => u.side === 0);
  const start = al.findIndex((u) => u.id === s.active);
  for (let k = 1; k <= al.length; k++) { const u = al[(start + k) % al.length]; if (u.alive) return u.id; }
  return s.active;
}

function beginAllyTurn(s) {
  const u = s.units[s.active];
  if (!u || !u.alive) return;
  if (u.hold) { u.hold = false; u.anchored = false; }
  if (u.ult) u.ultCharge = Math.min(u.ultNeed, u.ultCharge + 1);
}

function enqueueEnemyPhase(s) {
  s.queue.push({ t: 'table' });
  s.queue.push({ t: 'dot' });
  for (const u of s.units) if (u.side === 1) s.queue.push({ t: 'tick', id: u.id });
  s.queue.push({ t: 'endEnemy' });
}

function bossRule(s) {
  const b = s.units.find((u) => u.alive && u.kind === 'boss');
  if (!b) return false;
  let moved = false;
  if (b.boss === 'vacuum') {
    // 吸い寄せる。2 本目からは逆に吹き出す
    const sign = b.gaugeIdx === 0 ? 1 : -1;
    s.events.push({ t: 'bossRule', kind: sign > 0 ? 'pull' : 'blow', by: b.id });
    for (const o of s.units) {
      if (!o.alive || o.anchored || o.id === b.id) continue;
      const dx = b.x - o.x, dy = b.y - o.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0) continue;
      const k = sign * (sign > 0 ? 380 : 260) * o.invMass / d; // 吹き出しは弱め(近づけなくなって長引くため)
      o.vx += dx * k; o.vy += dy * k; moved = true;
    }
  } else if (b.boss === 'washer') {
    // 卓が回る: 切れ目の位置が順に変わる。2 本目からは脱水で全員が外へ振られる
    if (s.gapCycle) { s.gapCycleIdx = (s.gapCycleIdx + 1) % s.gapCycle.length; s.gaps = s.gapCycle[s.gapCycleIdx]; s.events.push({ t: 'bossRule', kind: 'spin', by: b.id }); }
    if (b.gaugeIdx > 0) {
      const cx = s.w / 2, cy = s.h / 2;
      for (const o of s.units) {
        if (!o.alive || o.anchored) continue;
        const dx = o.x - cx, dy = o.y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) continue;
        const k = 320 * o.invMass / d;
        o.vx += dx * k; o.vy += dy * k; moved = true;
      }
    }
  } else if (b.boss === 'fan') {
    // 風向きが毎ターン変わる。2 本目からは風が強くなる
    if (s.windCycle) {
      s.windIdx = (s.windIdx + 1) % s.windCycle.length;
      const w = s.windCycle[s.windIdx], pw = b.gaugeIdx > 0 ? 1.5 : 1;
      s.wind = { ax: w[0] * pw, ay: w[1] * pw };
      s.events.push({ t: 'bossRule', kind: 'wind', by: b.id });
    }
  }
  return moved;
}

function foeAct(s, u) {
  u.count = u.baseCount;
  s.events.push({ t: 'act', by: u.id, kind: u.action });
  switch (u.action) {
    case 'charge': { // たいあたり
      const t = nearest(s, u, 0);
      if (!t || u.anchored) return;
      launchAt(u, t.x - u.x, t.y - u.y, POWER_SPEED[2]);
      startMotion(s, u.id, { foeShot: true });
      return;
    }
    case 'blast': { // はんい攻撃
      for (const o of s.units) {
        if (!o.alive || o.side !== 0) continue;
        const reach = u.actR + o.r, dx = o.x - u.x, dy = o.y - u.y;
        if (dx * dx + dy * dy <= reach * reach) { damage(s, u, o, u.atk, 'foe'); if (u.lineage === 'plant') addPoison(s, o, 1, Math.max(1, Math.round(u.atk * 0.15))); }
      }
      return;
    }
    case 'beamH': case 'beamV': { // ビーム(横 / 縦の帯)
      const half = u.r + 12;
      for (const o of s.units) {
        if (!o.alive || o.side !== 0) continue;
        const off = u.action === 'beamH' ? o.y - u.y : o.x - u.x;
        if (off <= half + o.r && off >= -(half + o.r)) damage(s, u, o, u.atk, 'foe');
      }
      return;
    }
    case 'gust': case 'pull': { // ふきとばし / ひきよせ
      const sign = u.action === 'gust' ? 1 : -1;
      let moved = false;
      for (const o of s.units) {
        if (!o.alive || o.side !== 0 || o.anchored) continue;
        const dx = o.x - u.x, dy = o.y - u.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0 || d > u.actR + 120) continue;
        const k = sign * 300 * o.invMass / d; // 軽い駒で約 220、ふつうの駒で約 40 動く強さ
        o.vx += dx * k; o.vy += dy * k; moved = true;
        if (u.action === 'gust') damage(s, u, o, u.atk * 0.5, 'foe');
      }
      if (moved) startMotion(s, -1, { foeShot: true });
      return;
    }
    case 'summon': { // なかま呼び(同時に 2 体まで)
      let mine = 0;
      for (const o of s.units) if (o.alive && o.minion && o.owner === u.id) mine++;
      if (mine >= 2) return;
      const nu = spawn(s, { name: 'ちび', weight: 1, hp: Math.max(10, Math.round(u.maxHp * 0.3)), atk: Math.max(4, Math.round(u.atk * 0.6)),
                            action: 'charge', count: 2, minion: true }, u.x, u.y + u.r + 24);
      if (nu) nu.owner = u.id;
      return;
    }
    case 'mend': { // 回復・盾
      let t = null;
      for (const o of s.units) { if (!o.alive || o.side !== 1 || o.id === u.id) continue; if (t === null || o.hp * t.maxHp < t.hp * o.maxHp) t = o; }
      if (t && t.hp < t.maxHp) heal(s, t, t.maxHp * 0.2); else addShield(s, t || u, 0.2);
      return;
    }
    case 'bomb': // 自爆
      knockOut(s, u, 'hp');
      return;
    default: return;
  }
}

function runAction(s, a) {
  if (a.t === 'afterShot') {
    if (s.pendingAfter) { const p = s.pendingAfter; s.pendingAfter = null; s.queue.unshift({ t: 'afterShot' }); runAfter(s, p); return; }
    // 続けて弾ける(大暴れ)。ただし本人が退場していたら打ち切って敵の番へ
    if (s.extraShots > 0 && s.units[s.active].alive) { s.extraShots--; s.chain = 0; s.phase = 'aim'; return; }
    s.extraShots = 0;
    enqueueEnemyPhase(s);
    return;
  }
  if (a.t === 'stop') { s.phase = 'aim'; return; }
  if (a.t === 'table') { if (bossRule(s)) startMotion(s, -1, { foeShot: true }); return; }
  if (a.t === 'dot') {
    for (const u of s.units) {
      if (!u.alive || u.kind === 'obstacle') continue;
      if (u.poison > 0) { damage(s, null, u, u.poison * u.poisonDmg, 'dot'); u.poison -= 1; }
      if (!u.alive) continue;
      const p = patchAt(s, u);
      if (p && p.kind === 'stove') damage(s, null, u, p.dmg || 10, 'dot'); // コンロの上で止まっている
    }
    return;
  }
  if (a.t === 'tick') {
    const u = s.units[a.id];
    if (!u.alive) return;
    if (u.stagger > 0) { u.stagger--; return; }
    u.count -= 1;
    if (u.count <= 0) foeAct(s, u);
    return;
  }
  if (a.t === 'endEnemy') {
    for (const p of s.patches) if (p.turns > 0) p.turns--;
    s.patches = s.patches.filter((p) => p.turns !== 0);
    if (s.slickTurns > 0) s.slickTurns--;
    s.active = nextAllyId(s);
    s.turnNo++;
    s.chain = 0;
    s.phase = 'aim';
    beginAllyTurn(s);
  }
}

function checkEnd(s) {
  if (aliveCount(s, 1) === 0) { s.phase = 'won'; s.queue = []; s.motion = null; return true; }
  if (aliveCount(s, 0) === 0) { s.phase = 'lost'; s.queue = []; s.motion = null; return true; }
  return false;
}

// ---- 進行 --------------------------------------------------------------------

/** 1 刻み進める。phase が 'resolving' のあいだ呼び続ける */
export function step(s) {
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
  if (!s.motion && s.phase === 'resolving') checkEnd(s);
}

export function resolve(s) { while (s.phase === 'resolving') step(s); return s; }

export function canUlt(s) {
  const u = s.units[s.active];
  return !!(u && u.alive && u.ult && u.ultCharge >= u.ultNeed);
}

/**
 * プレイヤーの 1 手。
 * input: { dx, dy(整数の向き), power(1〜3), ult(必殺で弾くか) }
 * opts.preview = true のとき、敵の番を回さずに止まる(予測線・おまかせの評価用)
 */
export function shoot(s, input, opts) {
  if (s.phase !== 'aim') return false;
  const dx = Math.round(input.dx), dy = Math.round(input.dy);
  const power = Math.max(1, Math.min(3, Math.round(input.power || 2)));
  if (dx === 0 && dy === 0) return false;
  const u = s.units[s.active];
  if (!u || !u.alive) return false;
  startMotion(s, u.id, {});
  if (input.ult && canUlt(s)) { u.ultCharge = 0; applyUlt(s, u, s.motion); }
  launchAt(u, dx, dy, POWER_SPEED[power]);
  s.shots++;
  s.phase = 'resolving';
  s.queue.push(opts && opts.preview ? { t: 'stop' } : { t: 'afterShot' });
  return true;
}

// ---- 予告(次の敵の番で動く敵の、攻撃の形) -----------------------------------

export function telegraphs(s) {
  const out = [];
  for (const u of s.units) {
    if (!u.alive || u.side !== 1 || u.count !== 1 || u.stagger > 0) continue;
    if (u.action === 'blast' || u.action === 'bomb') out.push({ id: u.id, shape: 'circle', x: u.x, y: u.y, r: u.actR });
    else if (u.action === 'beamH') out.push({ id: u.id, shape: 'band', x: 0, y: u.y - u.r - 12, w: s.w, h: (u.r + 12) * 2 });
    else if (u.action === 'beamV') out.push({ id: u.id, shape: 'band', x: u.x - u.r - 12, y: 0, w: (u.r + 12) * 2, h: s.h });
    else if (u.action === 'charge') { const t = nearest(s, u, 0); if (t) out.push({ id: u.id, shape: 'line', x: u.x, y: u.y, x2: t.x, y2: t.y }); }
    else if (u.action === 'gust' || u.action === 'pull') out.push({ id: u.id, shape: u.action, x: u.x, y: u.y, r: u.actR + 120 });
    else out.push({ id: u.id, shape: 'mark', x: u.x, y: u.y, kind: u.action });
  }
  return out;
}

// ---- 再現性の確認用ハッシュ(FNV-1a) -----------------------------------------

const f64 = new Float64Array(1), u8 = new Uint8Array(f64.buffer);
export function hashState(s, seedHash) {
  let h = seedHash === undefined ? 0x811c9dc5 : seedHash;
  const put = (v) => { f64[0] = v; for (let i = 0; i < 8; i++) { h ^= u8[i]; h = Math.imul(h, 0x01000193) >>> 0; } };
  for (const u of s.units) {
    put(u.x); put(u.y); put(u.vx); put(u.vy); put(u.hp); put(u.maxHp); put(u.count); put(u.alive ? 1 : 0);
    put(u.shield); put(u.poison); put(u.ultCharge); put(u.anchored ? 1 : 0); put(u.gaugeIdx);
  }
  put(s.turnNo); put(s.active); put(s.units.length); put(s.patches.length); put(s.slickTurns);
  return h >>> 0;
}

/** 整数だけの乱数(検証用) */
export function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
