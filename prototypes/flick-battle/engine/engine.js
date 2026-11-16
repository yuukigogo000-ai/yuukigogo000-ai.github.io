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
const CHAIN_STEP = 0.2, CHAIN_CAP = 0.6; // 3 れんさで足し算の上限(1.6 倍)に届き、そこからは「あふれれんさ」で掛け算
const FALL_COST = 0.3;      // 味方が落ちたときに失う体力(最大体力比)
const SHIELD_CAP = 0.5;
const POISON_CAP = 5;
// 2026-11-16 の追加(reports/はじきバトルの進化案.md)
const CRASH_MIN = 350;      // ぶつけダメージ: 敵が柵・障害物・ほかの敵にこの速さ以上でぶつかるとダメージ
const CRASH_MIN_BOSS = 150; // ボスは重くて速く動かないので、ゆっくりぶつけてもダメージ(柵や物で削る遊びのため)
const CRASH_K = 0.5;        // ぶつけダメージ = 手番の味方の攻撃力 × これ ×(強打なら 1.5)× れんさ
const FRIENDLY = 1.0;       // 敵の攻撃が敵に当たったときの倍率(攻撃した敵の攻撃力 × これ)
const BUMPER_KICK = 650;    // 輪ゴムの柱: 当たった駒をこの速さ以上で弾き返す
const BUMPER_MAX = 4;       // 1 回の動きで、同じ柱が弾き返す回数の上限(必ず止まるようにする)
const PICKUP_HEAL = 0.25;   // 回復のおやつ: 最大体力のこれだけ回復
const CHAIN_CHARGE_AT = 3;  // この数以上のれんさを出した手は、弾いた駒の必殺が 1 つ進む
const OVERFLOW = 1.15;      // あふれれんさ: 上乗せが上限に届いたあとは、れんさ 1 つごとにダメージ × これ(掛け算で伸びる)
const RELAY_K = 0.6;        // 玉突き: 押されて動いた味方が敵に当たったときのダメージ(その味方の攻撃力 × これ × れんさ)
const BLAST_R = 90;         // 花火(進化): 倒した敵の爆発の半径
export const PIN_OPEN_TURNS = 2; // お皿を全部倒すと、決まった柵がこのターン数だけ開く

/** 卓の上の物(障害物)。movable は押すと動く物 */
export const OBJ = {
  cup:    { ja: 'コップ',       r: 18 },                                      // 動かない。跳ね返りに使える
  bumper: { ja: '輪ゴムの柱',   r: 14 },                                      // 動かない。当たった駒を強く弾き返す
  bottle: { ja: 'しょうゆ差し', r: 15, movable: true, mass: 2.4, fric: 1000 }, // 押すと動く。敵にぶつけるとダメージ
  lid:    { ja: '鍋のふた',     r: 20 },                                      // 味方が当てると開いて、回復のおやつが出る
  pin:    { ja: 'お皿',         r: 10 },                                      // 何かが当たると倒れる。全部倒すと柵が開く
};

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
    // 持ち物・パッシブの効果(data.js の buildMods が作る)と、1 回きりの効果を使ったかどうか
    mods: spec.mods || null, used: {},
    // 卓の上の物
    obj: null, group: 0,
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
    pickups: (cfg.pickups || []).map((p) => ({ x: p.x, y: p.y, r: p.r || 12, amt: p.amt || PICKUP_HEAL })),
    pinOpen: cfg.pinOpen || null, bonusGaps: [],
    units: [], phase: 'aim', active: 0, queue: [], motion: null, pendingAfter: null,
    turnNo: 1, shots: 0, extraShots: 0, chain: 0, bestChain: 0, events: [],
    bonusShot: false, bonusUsed: false,
    stats: { capHits: 0, steps: 0, maxMotionSteps: 0, maxPenetration: 0, allyFalls: 0, allyKo: 0, enemyRing: 0, enemyKo: 0,
             dmgHit: 0, dmgTouch: 0, dmgUlt: 0, dmgTaken: 0, dmgCrash: 0, dmgFriendly: 0, dmgBlast: 0, dmgRelay: 0, ultsUsed: 0, relays: 0, blasts: 0, bestShotDmg: 0,
             bonusShots: 0, chainCharges: 0, crashRing: 0, bankDouble: 0, pickups: 0, lids: 0, pinsDown: 0, splits: 0 },
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
    const obj = OBJ[o.obj] ? o.obj : 'cup', D = OBJ[obj];
    const u = baseUnit(id++, 2, 'obstacle', { name: o.name || D.ja, r: o.r || D.r, hp: 1, anchored: !D.movable,
                                              mass: D.mass || 1, fric: D.fric }, o.x, o.y);
    u.obj = obj; u.group = o.group || 0;
    s.units.push(u);
  }
  setupTeam(s);
  // 子駒(二枚刃)の枠を先に 2 つ作っておく。使わないときは盤外で眠らせる(番号を増やさないため)
  if (s.units.some((u) => u.side === 0 && md(u, 'splitOnRail', false))) {
    for (let k = 0; k < 2; k++) {
      const m = baseUnit(id++, 0, 'mini', { name: '小さな刃', weight: 1, r: 10, hp: 1, atk: 1 }, -999, -999);
      m.alive = false;
      s.units.push(m);
    }
  }
  s.active = firstAlive(s, 0);
  beginAllyTurn(s);
  s.events = [];
  return s;
}

/** 持ち物・パッシブの効果を読む(なければ既定値) */
const md = (u, k, d) => (u && u.mods && u.mods[k] !== undefined ? u.mods[k] : d);

function setupTeam(s) {
  const al = s.units.filter((u) => u.side === 0), cnt = {};
  for (const a of al) if (a.lineage) cnt[a.lineage] = (cnt[a.lineage] || 0) + 1;
  // 同じ系統 2 体以上で「2 体ボーナス」、4 体全員が同じなら「純血」(純血のときは 2 体ボーナスは付かない)
  s.team = { pair: {}, pure: null, fallen: 0 };
  for (const k of Object.keys(cnt)) { if (al.length >= 4 && cnt[k] === al.length) s.team.pure = k; else if (cnt[k] >= 2) s.team.pair[k] = true; }
  const T = s.team;
  for (const a of al) {
    if (T.pure) { a.hp = a.maxHp = Math.round(a.maxHp * 1.06); a.atk = Math.round(a.atk * 1.06); } // 純血: 全員の体力・攻撃力 +6%
    a.ultNeed = Math.max(1, a.ultNeed + md(a, 'ultNeedAdj', 0) + (T.pure === 'electronic' ? -1 : 0));
    a.ultCharge = md(a, 'ultStart', 0) + (T.pair.electronic && a.lineage === 'electronic' ? 1 : 0);
    if (md(a, 'startShield', 0)) addShield(s, a, md(a, 'startShield', 0));
    if (T.pure === 'food') addShield(s, a, 0.15);
    if (md(a, 'startStun', 0)) { const t = nearest(s, a, 1); if (t) addCount(t, md(a, 'startStun', 0)); }
  }
  if (T.pure === 'toy') for (const e of s.units) if (e.alive && e.side === 1) addCount(e, 1);
}

/** 敵に動かされる力の効き方(0 = 動かされない) */
function forceFactor(s, u) {
  if (u.side !== 0) return 1;
  if (md(u, 'forceImmune', false) || s.team.pure === 'bath') return 0;
  return md(u, 'forceResist', 1);
}

export function cloneState(s) {
  const m = s.motion;
  return Object.assign({}, s, {
    patches: s.patches.map((p) => Object.assign({}, p)),
    pickups: s.pickups.map((p) => Object.assign({}, p)),
    bonusGaps: s.bonusGaps.map((g) => Object.assign({}, g, { range: g.range.slice() })),
    wind: s.wind ? { ax: s.wind.ax, ay: s.wind.ay } : null,
    units: s.units.map((u) => Object.assign({}, u, { gauges: u.gauges, used: Object.assign({}, u.used) })),
    queue: s.queue.map((q) => Object.assign({}, q)),
    motion: m ? Object.assign({}, m, { hitAllies: m.hitAllies.slice(), touching: m.touching.slice(), subs: m.subs.slice(),
                                       hits: Object.assign({}, m.hits), pairs: m.pairs.slice(), kicks: Object.assign({}, m.kicks),
                                       crashed: m.crashed.slice(), lastBy: Object.assign({}, m.lastBy), bankHits: m.bankHits.slice(), relay: m.relay.slice() }) : null,
    pendingAfter: s.pendingAfter, events: [], team: Object.assign({}, s.team),
    stats: Object.assign({}, s.stats), fx: false, // 演出用の出来事は複製に持ち越さない(予測線・おまかせを軽く保つ)
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

export function chainMult(s) {
  const step = s.chainStep || CHAIN_STEP, cap = CHAIN_CAP + (s.chainCapAdd || 0);
  let v = 1 + Math.min(cap, s.chain * step);
  // あふれれんさ: 上乗せが上限に届いたあとは、れんさ 1 つごとに掛け算で伸びる(長いれんさほど数字が爆発する)
  const over = s.chain - Math.ceil(cap / step - 1e-9);
  if (over > 0) { const r = OVERFLOW + (s.overflowAdd || 0); for (let i = 0; i < over; i++) v *= r; }
  if (s.chainLateFrom && s.chain >= s.chainLateFrom) v *= s.chainLateMul; // 大応援: ○れんさ目からさらに掛け算
  return v;
}
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
  if (u.kind === 'mini') return;
  const cap = Math.round(u.maxHp * SHIELD_CAP);
  const before = u.shield;
  u.shield = Math.min(cap, u.shield + Math.round(u.maxHp * ratio * md(u, 'shieldGainMul', 1)));
  if (u.shield > before) s.events.push({ t: 'shield', to: u.id, amt: u.shield - before });
}

function heal(s, u, amt) {
  if (u.kind === 'mini') return;
  const before = u.hp;
  let v = amt * md(u, 'healGainMul', 1);
  if (u.side === 1 && s.team.pure === 'plant' && u.poison > 0) v *= 0.5; // 植物の純血: 毒を受けた敵は回復が半分
  u.hp = Math.min(u.maxHp, u.hp + Math.round(v));
  if (u.hp > before) s.events.push({ t: 'heal', to: u.id, amt: u.hp - before });
}

function addPoison(s, u, stacks, perStack) {
  if (!u.alive || u.kind === 'obstacle') return;
  if (md(u, 'poisonImmune', false) || (u.side === 0 && s.team.pure === 'bath')) return;
  u.poison = Math.min(POISON_CAP, u.poison + stacks);
  if (perStack > u.poisonDmg) u.poisonDmg = perStack;
  s.events.push({ t: 'poison', to: u.id, n: u.poison });
}

// ---- 退場・ダメージ ----------------------------------------------------------

function onEnemyDown(s, u, how) {
  if (how === 'ring') {
    s.stats.enemyRing++; addChain(s, 'ring');
    const m = s.motion;
    if (m && !m.foeShot) { // プレイヤーの手の中で落とした
      if (m.lastBy[u.id] === 'thing') { s.stats.crashRing++; s.events.push({ t: 'trick', kind: 'crashRing', to: u.id }); } // ぶつけ落とし
      const src = s.units[s.active];
      if ((!s.bonusUsed || md(src, 'bonusUnlimited', false)) && !s.bonusShot) { s.bonusShot = true; s.events.push({ t: 'bonusShot' }); } // もう 1 手(大号令なら何回でも)
      if (src && md(src, 'onRingStun', 0)) for (const e of s.units) if (e.alive && e.side === 1 && addCount(e, md(src, 'onRingStun', 0))) s.events.push({ t: 'stun', to: e.id }); // びっくり笛
    }
    return;
  }
  s.stats.enemyKo++;
  if (u.action === 'bomb') explode(s, u);
  if (u.trait === 'split' && !u.minion) spawnMinis(s, u);
}

function knockOut(s, u, how) {
  if (!u.alive) return;
  if (u.kind === 'mini') { u.alive = false; u.vx = 0; u.vy = 0; u.x = -999; u.y = -999; return; } // 子駒は消えるだけ
  u.alive = false; u.vx = 0; u.vy = 0;
  if (how !== 'ring') u.hp = 0;
  s.events.push({ t: 'ko', id: u.id, how });
  if (u.side === 0) {
    s.stats.allyKo++; s.team.fallen++;
    if (md(u, 'onDownCharge', 0)) for (const a of s.units) if (a.alive && a.side === 0) a.ultCharge = Math.min(a.ultNeed, a.ultCharge + md(u, 'onDownCharge', 0)); // 予備電池
  } else if (u.side === 1) onEnemyDown(s, u, how);
}

/** 柵の切れ目から出た */
function fallOff(s, u) {
  if (u.kind === 'mini') return knockOut(s, u, 'ring');
  if (u.side === 0) {
    s.stats.allyFalls++;
    u.hp -= Math.round(u.maxHp * FALL_COST * md(u, 'fallCostMul', 1));
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
  if (!tgt.alive || tgt.kind === 'obstacle' || tgt.kind === 'mini') return 0;
  const T = s.team;
  let v = raw;
  if (src && src.side === 0 && tgt.side === 1) {
    if (peeled(tgt)) v *= md(src, 'peelDmgMul', 1);                       // 虫めがね
    if (peeled(src)) v *= 1 + md(src, 'gritAtk', 0);                      // 根性
    if (T.pure === 'machine' && src.shield > 0) v *= 1.2;
    if (T.pure === 'book' && tgt.count > tgt.baseCount) v *= 1.3;         // 足止め中の敵へ
    if (T.pure === 'creature') v *= 1 + 0.12 * T.fallen;
    if (T.pair.kitchen && src.lineage === 'kitchen') v *= 1.15;
    if (T.pair.toy && src.lineage === 'toy') v *= 1.15;
  }
  if (tgt.side === 0) {
    v *= md(tgt, 'takenMul', 1);                                          // 毛布・堅い
    if (tgt.hold) v *= T.pair.furniture ? 0.5 : 0.7;                      // 居座り中は軽減
    if (kind === 'dot') v *= md(tgt, 'poisonTakenMul', 1);
  }
  let dmg = Math.round(v);
  if (dmg <= 0) return 0;
  const foeHit = tgt.side === 0 && src && src.side === 1;
  if (tgt.shield > 0) {
    const ab = Math.min(tgt.shield, dmg);
    tgt.shield -= ab; dmg -= ab;
    if (ab > 0) s.events.push({ t: 'block', to: tgt.id, amt: ab });
    if (tgt.shield === 0 && foeHit && T.pure === 'clothing' && src.alive) { // 衣類の純血: 盾が割れたら反撃
      addCount(src, 1);
      damage(s, tgt, src, tgt.maxHp * 0.2, 'touch');
    }
    if (dmg <= 0) return 0;
  }
  tgt.hp -= dmg;
  if (tgt.side === 1) {
    if (kind === 'hit') s.stats.dmgHit += dmg; else if (kind === 'touch') s.stats.dmgTouch += dmg; else if (kind === 'ult') s.stats.dmgUlt += dmg;
    else if (kind === 'crash') s.stats.dmgCrash += dmg; else if (kind === 'foe') s.stats.dmgFriendly += dmg;
    else if (kind === 'blast') s.stats.dmgBlast += dmg; else if (kind === 'relay') s.stats.dmgRelay += dmg;
  } else if (tgt.side === 0) s.stats.dmgTaken += dmg;
  s.events.push({ t: 'hit', by: src ? src.id : -1, to: tgt.id, dmg, kind });
  if (tgt.side === 0 && tgt.hp <= 0 && md(tgt, 'charm', false) && !tgt.used.charm) { // お守り: 1 回だけ体力 1 で耐える
    tgt.used.charm = true; tgt.hp = 1;
    s.events.push({ t: 'charm', to: tgt.id });
  }
  if (tgt.hp <= 0) {
    if (tgt.kind === 'boss' && tgt.gaugeIdx < tgt.gauges.length - 1) {
      // 体力ゲージを 1 本割った: ひるんで次の行動を飛ばし、次の段階へ
      tgt.gaugeIdx++;
      tgt.hp = tgt.maxHp = tgt.gauges[tgt.gaugeIdx];
      tgt.stagger = 1; tgt.count = tgt.baseCount; tgt.poison = 0;
      s.events.push({ t: 'gaugeBreak', id: tgt.id, phase: tgt.gaugeIdx });
    } else {
      knockOut(s, tgt, 'hp');
      if (src && src.side === 0 && tgt.side === 1) onKill(s, src, tgt);
    }
  } else if (tgt.side === 0 && peeled(tgt) && md(tgt, 'firstAid', false) && !tgt.used.firstAid) { // 救急箱
    tgt.used.firstAid = true;
    heal(s, tgt, tgt.maxHp * 0.3);
  }
  if (foeHit && src.alive) { // 手鏡・家具の純血: 受けたダメージの一部を返す
    const back = md(tgt, 'reflect', 0) + (T.pure === 'furniture' ? 0.25 : 0);
    if (back > 0) damage(s, tgt, src, dmg * back, 'touch');
  }
  return dmg;
}

/** ぶつけダメージ: プレイヤーの手の中で、敵が柵・物・ほかの敵に強くぶつかった。手番の味方の攻撃力で決まる */
function crash(s, en, impact, key, thing) {
  const m = s.motion;
  if (!m || m.foeShot || !en.alive || en.side !== 1 || impact < (en.kind === 'boss' ? CRASH_MIN_BOSS : CRASH_MIN)) return;
  if (m.crashed.indexOf(key) >= 0) return;
  m.crashed.push(key);
  const src = s.units[s.active];
  if (!src || !src.alive || src.kind !== 'ally') return;
  const dmg = src.atk * CRASH_K * (impact >= STRONG_IMPACT ? 1.5 : 1) * chainMult(s) * md(src, 'crashMul', 1);
  s.events.push({ t: 'crash', to: en.id, thing });
  damage(s, src, en, dmg, 'crash');
}

/** 敵の攻撃が別の敵に当たった */
function friendlyHit(s, u, o, mul) {
  s.events.push({ t: 'friendly', by: u.id, to: o.id });
  damage(s, u, o, u.atk * FRIENDLY * (mul || 1), 'foe');
}

/** 卓の上の物 o に駒 u がぶつかった(輪ゴムの柱のはね返しは collide で扱う) */
function thingContact(s, o, u, impact) {
  const m = s.motion;
  if (!o.alive || !m) return;
  if (u.side === 1) { m.lastBy[u.id] = 'thing'; crash(s, u, impact, 8192 + u.id * 64 + o.id, o.obj); }
  if (m.foeShot || impact <= MIN_IMPACT) return;
  if (o.obj === 'lid' && u.side === 0) { // 鍋のふた: 開いて回復のおやつが出る
    o.alive = false; s.stats.lids++;
    s.pickups.push({ x: o.x, y: o.y, r: 12, amt: PICKUP_HEAL });
    s.events.push({ t: 'lid', id: o.id, x: o.x, y: o.y });
  } else if (o.obj === 'pin') { // お皿: 倒れる。同じ組を全部倒すと柵が開く
    o.alive = false; s.stats.pinsDown++;
    s.events.push({ t: 'pin', id: o.id });
    if (s.pinOpen && !s.units.some((x) => x.alive && x.obj === 'pin' && x.group === o.group)) {
      s.bonusGaps.push({ side: s.pinOpen.side, range: s.pinOpen.range.slice(), turns: PIN_OPEN_TURNS });
      s.events.push({ t: 'pinOpen', side: s.pinOpen.side });
    }
  }
}

/** 二枚刃: 柵で跳ね返った瞬間に、小さな刃が 2 つ飛び出す */
function spawnSplit(s, sh) {
  const slots = s.units.filter((u) => u.kind === 'mini' && !u.alive);
  const sp = Math.sqrt(sh.vx * sh.vx + sh.vy * sh.vy);
  if (slots.length < 2 || sp === 0) return;
  const ux = sh.vx / sp, uy = sh.vy / sp, px = -uy, py = ux;
  for (let i = 0; i < 2; i++) {
    const k = i === 0 ? 1 : -1, mi = slots[i];
    let dx = ux + px * 0.6 * k, dy = uy + py * 0.6 * k;
    const l = Math.sqrt(dx * dx + dy * dy); dx /= l; dy /= l;
    const x = Math.max(mi.r, Math.min(s.w - mi.r, sh.x + px * (sh.r + mi.r + 1) * k));
    const y = Math.max(mi.r, Math.min(s.h - mi.r, sh.y + py * (sh.r + mi.r + 1) * k));
    // 敵や物に重なる場所には出さない(味方とはすり抜けるので重なってよい)
    let blocked = false;
    for (const o of s.units) { if (!o.alive || o.side === 0) continue; const ox = o.x - x, oy = o.y - y, rr = o.r + mi.r; if (ox * ox + oy * oy < rr * rr) { blocked = true; break; } }
    if (blocked) continue;
    mi.alive = true; mi.hp = mi.maxHp = 1; mi.atk = Math.max(1, Math.round(sh.atk * 0.4));
    mi.x = x; mi.y = y; mi.vx = dx * sp * 0.85; mi.vy = dy * sp * 0.85;
    s.motion.subs.push(mi.id);
  }
  s.motion.splitDone = true; s.stats.splits++;
  s.events.push({ t: 'split', by: sh.id });
}

/** 味方 src が敵 tgt を倒した */
function onKill(s, src, tgt) {
  if (md(src, 'killBlast', 0)) { // 花火(進化)
    s.stats.blasts++;
    s.events.push({ t: 'blast', by: tgt.id, x: tgt.x, y: tgt.y, r: BLAST_R });
    addChain(s, 'blast');
    for (const o of s.units) {
      if (!o.alive || o.side !== 1 || o.id === tgt.id) continue;
      const rr = BLAST_R + o.r, dx = o.x - tgt.x, dy = o.y - tgt.y;
      if (dx * dx + dy * dy <= rr * rr) damage(s, src, o, src.atk * 0.8 * md(src, 'killBlast', 0) * chainMult(s), 'blast'); // 倒れた敵からまた onKill が呼ばれて連爆する
    }
  }
  if (md(src, 'onKillPoison', 0)) { const n = nearest(s, tgt, 1, tgt.id); if (n) addPoison(s, n, md(src, 'onKillPoison', 0), Math.max(1, Math.round(src.atk * 0.2))); } // マッチ
  if (s.team.pure === 'kitchen') src.ultCharge = Math.min(src.ultNeed, src.ultCharge + 1); // 台所の純血
}

function explode(s, u) {
  const R = u.actR;
  s.events.push({ t: 'explode', by: u.id, r: R });
  for (const o of s.units) {
    if (!o.alive || o.id === u.id || o.kind === 'obstacle') continue;
    const reach = R + o.r, dx = o.x - u.x, dy = o.y - u.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    if (o.side === 0) damage(s, u, o, u.atk, 'foe'); else if (o.side === 1) friendlyHit(s, u, o);
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
  const m = s.motion, hand = s.units[s.active];
  const series = m && hand ? 1 + md(hand, 'seriesTouch', 0) * m.touchCount : 1; // 直列つなぎ(進化)
  if (m) m.touchCount++;
  const P = s.team.pair, tm = md(by, 'touchMul', 1) * series, mult = chainMult(s) * tm;
  s.events.push({ t: 'touch', by: by.id, kind: by.touch });
  if (md(by, 'cheer', false)) addChain(s, 'cheer'); // 盛り上げ役: れんさがもう 1 つ増える
  const mostPeeled = (except) => {
    let t = null;
    for (const u of s.units) { if (!u.alive || u.side !== 1 || u.id === except) continue; if (t === null || u.hp * t.maxHp < t.hp * u.maxHp) t = u; }
    return t;
  };
  switch (by.touch) {
    case 'slash': { // 一閃: 一番近い敵に大ダメージ
      const t = nearest(s, by, 1);
      if (t) damage(s, by, t, by.atk * 1.5 * mult, 'touch');
      break;
    }
    case 'feed': { // 給食: 一番弱った味方を回復し、毒を消す
      let t = null;
      for (const u of s.units) { if (!u.alive || u.kind !== 'ally') continue; if (t === null || u.hp * t.maxHp < t.hp * u.maxHp) t = u; }
      if (t) { heal(s, t, t.maxHp * 0.25 * tm * (P.food ? 1.3 : 1)); t.poison = 0; }
      break;
    }
    case 'snipe': { // 狙撃: 一番はがれかけた敵にダメージ(どこにいても)。純血なら 2 連発(2 発目は半分)
      const t = mostPeeled(-1);
      if (t) damage(s, by, t, by.atk * 1.2 * mult * (P.stationery ? 1.3 : 1), 'touch');
      if (s.team.pure === 'stationery') { const t2 = mostPeeled(-1); if (t2) damage(s, by, t2, by.atk * 0.6 * mult, 'touch'); }
      break;
    }
    case 'read': { // 読み聞かせ: 一番近い敵のカウント+1(2 体ボーナスで +2)
      const t = nearest(s, by, 1);
      if (t && addCount(t, P.book ? 2 : 1)) s.events.push({ t: 'stun', to: t.id });
      break;
    }
    case 'spore': { // 胞子: 周りの敵に毒
      for (const u of s.units) { if (u.alive && u.side === 1 && dist(by, u) < 120 + u.r) addPoison(s, u, P.plant ? 3 : 2, Math.max(1, Math.round(by.atk * 0.2))); }
      break;
    }
    case 'chase': { // 追撃: 自分が一番近い敵へ飛び出す
      const t = nearest(s, by, 1);
      if (t && !by.anchored) { launchAt(by, t.x - by.x, t.y - by.y, POWER_SPEED[2]); if (s.motion.subs.indexOf(by.id) < 0) s.motion.subs.push(by.id); }
      break;
    }
    case 'boot': { // 起動: 周りの敵を外へ吹き飛ばす
      for (const u of s.units) { if (u.alive && u.side === 1 && dist(by, u) < 130 + u.r) damage(s, by, u, by.atk * 0.5 * mult, 'touch'); }
      pushOut(s, by, 130, P.machine ? 1040 : 800, 1);
      break;
    }
    case 'charge': { // 充電: 次に弾く味方の必殺を 1 つ進める
      const nx = s.units[nextAllyId(s)];
      if (nx && nx.alive) { nx.ultCharge = Math.min(nx.ultNeed, nx.ultCharge + 1); s.events.push({ t: 'charge', to: nx.id }); }
      break;
    }
    case 'layer': { // 重ね着: 近くの味方に盾
      for (const u of s.units) { if (u.alive && u.side === 0 && dist(by, u) < 140 + u.r) addShield(s, u, 0.2 * tm * (P.clothing ? 1.5 : 1)); }
      break;
    }
    case 'sit': { // 居座り: 次の自分の番まで動かない壁になる
      by.hold = true; by.anchored = true; by.vx = 0; by.vy = 0;
      break;
    }
    case 'pop': { // びっくり箱: 周りを弾き飛ばし、カウント+1
      const R = P.toy ? 156 : 120;
      for (const u of s.units) { if (u.alive && u.side === 1 && dist(by, u) < R + u.r && addCount(u, 1)) s.events.push({ t: 'stun', to: u.id }); }
      pushOut(s, by, R, 600, 1);
      break;
    }
    case 'wash': { // 洗浄: 味方の毒を消し、足元に石けん(滑る床)を作る
      for (const u of s.units) if (u.alive && u.side === 0) u.poison = 0;
      s.patches.push({ x: by.x, y: by.y, r: P.bath ? 90 : 60, kind: 'wet', turns: P.bath ? 5 : 3 });
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
  m.lastBy[en.id] = 'ally';
  if (m.bounces > 0 && m.bankHits.indexOf(en.id) < 0) {
    m.bankHits.push(en.id);
    if (m.bankHits.length === 2) { s.stats.bankDouble++; s.events.push({ t: 'trick', kind: 'bankDouble', to: en.id }); } // 柵返しから 2 体
  }
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
  if (en.alive && md(sh, 'onHitPoison', 0)) addPoison(s, en, md(sh, 'onHitPoison', 0), Math.max(1, Math.round(sh.atk * 0.2))); // 毒の小瓶
  if (n === 0 && md(sh, 'onHitPoisonAoe', 0)) { // 毒霧(進化): 当てた敵のまわりにも毒
    for (const o of s.units) if (o.alive && o.side === 1 && o.id !== en.id && dist(en, o) < 90 + o.r) addPoison(s, o, md(sh, 'onHitPoisonAoe', 0), Math.max(1, Math.round(sh.atk * 0.2)));
  }
  if (!en.alive) return;
  if ((m.execute || md(sh, 'peelExecute', false)) && en.kind !== 'boss' && peeled(en)) { // 定規ショット・とどめの一撃(進化)
    s.events.push({ t: 'execute', to: en.id }); knockOut(s, en, 'hp');
    if (md(sh, 'peelExecute', false)) { addChain(s, 'execute'); onKill(s, sh, en); }
    return;
  }
  if (m.peelHit && n === 0) {
    if (en.kind === 'boss') damage(s, sh, en, sh.atk * 2 * mult, 'ult');
    else if (!peeled(en)) { const cut = en.hp - Math.floor(en.maxHp / 2); damage(s, sh, en, cut, 'ult'); }
  }
  if (m.lightning && n === 0) lightning(s, sh, en, mult);
}

function onContact(s, a, b, impact) {
  const m = s.motion;
  if (!m) return;
  // 卓の上の物
  if (a.kind === 'obstacle' || b.kind === 'obstacle') {
    if (a.kind !== 'obstacle' || b.kind !== 'obstacle') thingContact(s, a.kind === 'obstacle' ? a : b, a.kind === 'obstacle' ? b : a, impact);
    return;
  }
  // 敵同士がぶつかった(プレイヤーの手の最中だけ、組ごとに 1 回)。強くぶつかれば両方にぶつけダメージ
  if (!m.foeShot && isFoe(a) && isFoe(b)) {
    m.lastBy[a.id] = 'thing'; m.lastBy[b.id] = 'thing';
    const key = a.id * 64 + b.id;
    if (impact > 200 && m.pairs.indexOf(key) < 0) { m.pairs.push(key); addChain(s, 'crash'); }
    crash(s, a, impact, 16384 + a.id * 64 + b.id, 'foe');
    crash(s, b, impact, 16384 + b.id * 64 + a.id, 'foe');
    return;
  }
  const sh = m.shooter;
  if (sh >= 0 && (a.id === sh || b.id === sh)) {
    const me = a.id === sh ? a : b, other = me === a ? b : a;
    if (m.foeShot) { // 敵のたいあたり。進む先にいる別の敵にも当たる
      if (impact > MIN_IMPACT && m.hitAllies.indexOf(other.id) < 0) {
        if (other.side === 0) { m.hitAllies.push(other.id); damage(s, me, other, me.atk, 'foe'); }
        else if (other.side === 1) { m.hitAllies.push(other.id); friendlyHit(s, me, other); }
      }
      return;
    }
    if (isFoe(other)) shooterHitsFoe(s, me, other, impact);
    else if (other.side === 0 && other.touch && m.hitAllies.indexOf(other.id) < 0) {
      m.hitAllies.push(other.id);
      if (m.relay.indexOf(other.id) < 0) m.relay.push(other.id); // 当てられた味方は「動きに乗った」扱い(玉突きの起点)
      addChain(s, 'touch');
      fireTouch(s, other);
    }
    return;
  }
  if (m.foeShot) return;
  const inPlay = (u) => m.subs.indexOf(u.id) >= 0 || m.relay.indexOf(u.id) >= 0;
  // 玉突き: 動きに乗った味方(当てられた味方・追撃)が別の味方に当たると、その味方のタッチ技も出る(各味方 1 手に 1 回)
  if (a.kind === 'ally' && b.kind === 'ally') {
    if (impact <= MIN_IMPACT) return;
    for (const pr of [[a, b], [b, a]]) {
      const me = pr[0], other = pr[1];
      if (!inPlay(me) || other.id === m.shooter || !other.touch || m.hitAllies.indexOf(other.id) >= 0) continue;
      m.hitAllies.push(other.id);
      if (m.relay.indexOf(other.id) < 0) m.relay.push(other.id);
      s.stats.relays++;
      s.events.push({ t: 'relay', by: me.id, to: other.id });
      addChain(s, 'relay');
      fireTouch(s, other);
    }
    return;
  }
  // 動きに乗った味方(追撃・子駒・玉突き)が敵に当たる
  const sa = inPlay(a), sb = inPlay(b);
  if (sa === sb) return;
  const me = sa ? a : b, other = sa ? b : a;
  if (!isFoe(other) || impact <= MIN_IMPACT) return;
  const key = 4096 + me.id * 64 + other.id;
  if (m.pairs.indexOf(key) >= 0) return;
  m.pairs.push(key);
  m.lastBy[other.id] = 'ally';
  const mult = chainMult(s);
  if (me.kind === 'mini') { addChain(s, 'split'); damage(s, me, other, me.atk * mult, 'hit'); return; } // 二枚刃の子駒
  if (m.subs.indexOf(me.id) >= 0) { addChain(s, 'chase'); damage(s, me, other, me.atk * mult * (s.team.pair.creature ? 1.3 : 1), 'touch'); return; } // 追撃
  addChain(s, 'relay'); damage(s, me, other, me.atk * RELAY_K * mult, 'relay'); // 玉突き
}

// ---- 物理 --------------------------------------------------------------------

function invM(s, u) {
  if (u.anchored) return 0;
  const m = s.motion;
  if (m && m.massMul && u.id === m.shooter) return u.invMass / m.massMul;
  return u.invMass;
}

function inGap(list, c) { for (const g of list) if (c >= g[0] && c <= g[1]) return true; return false; }
/** その辺のその位置が開いているか(卓の切れ目 + お皿で一時的に開いた柵) */
function gapOpen(s, side, c) {
  if (inGap(s.gaps[side], c)) return true;
  for (const g of s.bonusGaps) if (g.side === side && c >= g.range[0] && c <= g.range[1]) return true;
  return false;
}

function canFall(s, u) {
  if (u.kind === 'boss' || u.kind === 'obstacle' || u.anchored) return false;
  if (!peeled(u)) return false; // 体力が半分より多い駒は貼りついていて落ちない
  if (u.side === 0 && u.noFallTurn === s.turnNo) return false;
  return true;
}

function rails(s, u) {
  const m = s.motion, open = canFall(s, u);
  const shooter = !!m && !m.foeShot && u.id === m.shooter;
  // 手鏡: 跳ね返っても勢いが落ちない(合わせ鏡は増す)。1 手に決まった回数まで
  const boost = shooter && m.railBoostLeft > 0 ? md(u, 'railBoost', 1) : 1;
  let hitV = 0, rnx = 0, rny = 0; // 柵に当たった速さ(柵に垂直な成分)と、卓の内向き(演出用)
  if (u.x < u.r) {
    if (open && gapOpen(s, 'left', u.y)) { if (u.x < 0) return fallOff(s, u); }
    else { u.x = u.r; if (u.vx < 0) { hitV = Math.max(hitV, -u.vx); rnx = 1; u.vx = -u.vx * E_RAIL * boost; } }
  } else if (u.x > s.w - u.r) {
    if (open && gapOpen(s, 'right', u.y)) { if (u.x > s.w) return fallOff(s, u); }
    else { u.x = s.w - u.r; if (u.vx > 0) { hitV = Math.max(hitV, u.vx); rnx = -1; u.vx = -u.vx * E_RAIL * boost; } }
  }
  if (u.y < u.r) {
    if (open && gapOpen(s, 'top', u.x)) { if (u.y < 0) return fallOff(s, u); }
    else { u.y = u.r; if (u.vy < 0) { if (-u.vy > hitV) { rnx = 0; rny = 1; } hitV = Math.max(hitV, -u.vy); u.vy = -u.vy * E_RAIL * boost; } }
  } else if (u.y > s.h - u.r) {
    if (open && gapOpen(s, 'bottom', u.x)) { if (u.y > s.h) return fallOff(s, u); }
    else { u.y = s.h - u.r; if (u.vy > 0) { if (u.vy > hitV) { rnx = 0; rny = -1; } hitV = Math.max(hitV, u.vy); u.vy = -u.vy * E_RAIL * boost; } }
  }
  if (hitV === 0 || !m) return;
  if (s.fx) s.events.push({ t: 'rail', id: u.id, x: u.x - rnx * u.r, y: u.y - rny * u.r, nx: rnx, ny: rny, v: hitV });
  if (u.side === 1) crash(s, u, hitV, 12288 + u.id, 'rail'); // 敵を柵にぶつけた
  if (u.id === m.shooter) {
    m.bounces++;
    if (boost !== 1) { m.railBoostLeft--; s.events.push({ t: 'mirror', by: u.id }); }
    if (shooter && !m.splitDone && md(u, 'splitOnRail', false)) spawnSplit(s, u);
  }
}

// 演出用の出来事(s.fx が真のときだけ。勝ち負けの計算には一切使わない)
//  contact: 2 つの駒・物がぶつかった。x,y = 接点、nx,ny = a から b への向き(長さ 1)、v = 近づく速さ
//  rail:    駒が柵で跳ね返った。x,y = 柵の上の点、nx,ny = 卓の内向き、v = 柵に垂直な速さ
function fxContact(s, a, b, dx, dy, d, v, pierce) {
  let nx = 1, ny = 0;
  if (d > 0) { nx = dx / d; ny = dy / d; }
  const k = a.r - (a.r + b.r - d) / 2; // 重なりの真ん中
  s.events.push({ t: 'contact', a: a.id, b: b.id, x: a.x + nx * k, y: a.y + ny * k, nx, ny, v, pierce });
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
      if (entered) {
        const sp = Math.sqrt(me.vx * me.vx + me.vy * me.vy);
        if (s.fx) fxContact(s, a, b, dx, dy, Math.sqrt(d2), sp, true);
        onContact(s, a, b, sp);
      }
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
  if (pen / rr > (s.stats.maxPenRatio || 0)) s.stats.maxPenRatio = pen / rr; // 半径の和に対する重なりの割合(1 に近いとすり抜けの危険)
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) {
    const j = -(1 + E_DISC) * vn / isum;
    a.vx -= j * ia * nx; a.vy -= j * ia * ny;
    b.vx += j * ib * nx; b.vy += j * ib * ny;
    if (s.fx) fxContact(s, a, b, dx, dy, d, -vn, false);
    onContact(s, a, b, -vn);
    // 輪ゴムの柱: 当たった駒を、柱から外向きに決まった速さ以上で弾き返す(同じ柱は 1 回の動きで BUMPER_MAX 回まで)
    const bump = a.obj === 'bumper' && a.alive ? a : b.obj === 'bumper' && b.alive ? b : null;
    if (bump && (m.kicks[bump.id] || 0) < BUMPER_MAX) {
      const o = bump === a ? b : a, sx = bump === a ? 1 : -1; // 外向き = 柱から相手へ
      if (invM(s, o) > 0) {
        const away = (o.vx * nx + o.vy * ny) * sx;
        if (away < BUMPER_KICK) { const add = (BUMPER_KICK - away) * sx; o.vx += nx * add; o.vy += ny * add; }
        m.kicks[bump.id] = (m.kicks[bump.id] || 0) + 1;
        if (o.id === m.shooter) m.bounces++;
        s.events.push({ t: 'bumper', id: bump.id });
      }
    }
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
    // 減速しない: 貫通中、または定規ショットで跳ね返り回数が残っている間。ただし遅くなったら止める(ゆっくり漂い続けないように)
    const free = u.id === shooter && (inside || (m.freeBounces > 0 && m.bounces < m.freeBounces && sp > 250));
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
      if ((a.kind === 'mini' && b.side === 0) || (b.kind === 'mini' && a.side === 0)) continue; // 子駒は味方をすり抜ける
      collide(s, a, b);
    }
  }
  // 回復のおやつ: 味方が触れたら拾う(番号順・おやつの並び順で決まる)
  for (let i = s.pickups.length - 1; i >= 0; i--) {
    const p = s.pickups[i];
    for (let k = 0; k < n; k++) {
      const u = us[k];
      if (!u.alive || u.kind !== 'ally') continue;
      const dx = u.x - p.x, dy = u.y - p.y, rr = u.r + p.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      s.pickups.splice(i, 1); s.stats.pickups++;
      s.events.push({ t: 'pickup', to: u.id, x: p.x, y: p.y });
      heal(s, u, u.maxHp * p.amt);
      break;
    }
  }
  m.steps++;
  s.stats.steps++;
}

function anyMoving(s) { for (const u of s.units) if (u.alive && (u.vx !== 0 || u.vy !== 0)) return true; return false; }

function startMotion(s, shooterId, opts) {
  const sh = shooterId >= 0 ? s.units[shooterId] : null;
  s.motion = Object.assign({ shooter: shooterId, steps: 0, hitAllies: [], touching: [], subs: [], hits: {}, pairs: [],
                             inside: false, bounces: 0, bankUsed: false, foeShot: false, ult: null,
                             pierce: false, dmgMul: 0, massMul: 0, freeBounces: 0, execute: false, peelHit: false, lightning: false,
                             // 2026-11-16 の追加
                             kicks: {}, crashed: [], lastBy: {}, bankHits: [], splitDone: false, relay: [], touchCount: 0,
                             railBoostLeft: sh && sh.side === 0 ? md(sh, 'railBoostN', 3) : 0 }, opts);
}

function launchAt(u, dx, dy, speed) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  u.vx = dx / len * speed; u.vy = dy / len * speed;
}

// ---- 敵の番 ------------------------------------------------------------------

function nextAllyId(s) {
  const al = s.units.filter((u) => u.kind === 'ally');
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
      const ff = forceFactor(s, o);
      if (ff === 0) continue;
      const k = sign * (sign > 0 ? 380 : 260) * o.invMass * ff / d; // 吹き出しは弱め(近づけなくなって長引くため)
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
        const ff = forceFactor(s, o);
        if (ff === 0) continue;
        const k = 320 * o.invMass * ff / d;
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
    case 'blast': { // はんい攻撃。円の中にいる別の敵にも当たる
      for (const o of s.units) {
        if (!o.alive || o.id === u.id || (o.side !== 0 && o.side !== 1)) continue;
        const reach = u.actR + o.r, dx = o.x - u.x, dy = o.y - u.y;
        if (dx * dx + dy * dy > reach * reach) continue;
        if (o.side === 1) { friendlyHit(s, u, o); continue; }
        damage(s, u, o, u.atk, 'foe'); if (u.lineage === 'plant') addPoison(s, o, 1, Math.max(1, Math.round(u.atk * 0.15)));
      }
      return;
    }
    case 'beamH': case 'beamV': { // ビーム(横 / 縦の帯)。帯の中にいる別の敵にも当たる
      const half = u.r + 12;
      for (const o of s.units) {
        if (!o.alive || o.id === u.id || (o.side !== 0 && o.side !== 1)) continue;
        const off = u.action === 'beamH' ? o.y - u.y : o.x - u.x;
        if (off > half + o.r || off < -(half + o.r)) continue;
        if (o.side === 1) friendlyHit(s, u, o); else damage(s, u, o, u.atk, 'foe');
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
        const ff = forceFactor(s, o);
        if (u.action === 'gust') damage(s, u, o, u.atk * 0.5, 'foe');
        if (ff === 0) continue;
        const k = sign * 300 * o.invMass * ff / d; // 軽い駒で約 220、ふつうの駒で約 40 動く強さ
        o.vx += dx * k; o.vy += dy * k; moved = true;
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
    noteBestShot(s);
    // 3 れんさ以上つなげた手は、弾いた駒の必殺が 1 つ進む
    const sh = s.units[s.active];
    if (s.chain >= CHAIN_CHARGE_AT && sh && sh.alive && sh.ult && sh.ultCharge < sh.ultNeed) {
      sh.ultCharge++; s.stats.chainCharges++; s.events.push({ t: 'chainCharge', to: sh.id });
    }
    // 続けて弾ける(大暴れ)。ただし本人が退場していたら打ち切って敵の番へ
    if (s.extraShots > 0 && s.units[s.active].alive) { s.extraShots--; s.chain = 0; s.phase = 'aim'; return; }
    s.extraShots = 0;
    // 敵を場外に落としたら、敵の番の前に次の駒でもう 1 手(1 ターン 1 回まで)
    if (s.bonusShot) {
      s.bonusShot = false; s.bonusUsed = true; s.stats.bonusShots++;
      s.active = nextAllyId(s); s.chain = 0; s.phase = 'aim';
      beginAllyTurn(s);
      s.events.push({ t: 'bonusTurn', to: s.active });
      return;
    }
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
    for (const g of s.bonusGaps) g.turns--;
    s.bonusGaps = s.bonusGaps.filter((g) => g.turns > 0);
    s.bonusShot = false; s.bonusUsed = false;
    if (s.slickTurns > 0) s.slickTurns--;
    s.active = nextAllyId(s);
    s.turnNo++;
    s.chain = 0;
    s.phase = 'aim';
    beginAllyTurn(s);
  }
}

function noteBestShot(s) { // 1 手で与えたダメージの最高(勝敗がその手で決まったときも数える)
  const dealt = s.stats.dmgHit + s.stats.dmgTouch + s.stats.dmgUlt + s.stats.dmgCrash + s.stats.dmgBlast + s.stats.dmgRelay;
  if (dealt - (s.dealtMark || 0) > s.stats.bestShotDmg) s.stats.bestShotDmg = dealt - (s.dealtMark || 0);
}
function checkEnd(s) {
  if (aliveCount(s, 1) === 0) { noteBestShot(s); s.phase = 'won'; s.queue = []; s.motion = null; return true; }
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
      for (const u of s.units) if (u.kind === 'mini' && u.alive) knockOut(s, u, 'end');
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
  s.chainStep = CHAIN_STEP + md(u, 'chainStepAdd', 0);
  s.chainCapAdd = md(u, 'chainCapAdd', 0);
  s.chainLateFrom = md(u, 'chainLateFrom', 0); s.chainLateMul = md(u, 'chainLateMul', 1);
  s.overflowAdd = md(u, 'overflowAdd', 0);
  s.dealtMark = s.stats.dmgHit + s.stats.dmgTouch + s.stats.dmgUlt + s.stats.dmgCrash + s.stats.dmgBlast + s.stats.dmgRelay;
  if (input.ult && canUlt(s)) { u.ultCharge = 0; applyUlt(s, u, s.motion); }
  launchAt(u, dx, dy, POWER_SPEED[power]);
  s.shots++;
  s.phase = 'resolving';
  s.queue.push(opts && opts.preview ? { t: 'stop' } : { t: 'afterShot' });
  return true;
}

// ---- 予想ダメージ: このまま何もしなければ、次の敵の番で味方が受けるダメージ -----------------
// 盤面の複製で、カウント 1 の敵だけを今の位置のまま動かして測る(本物の盤面は変えない)。
// 返す: { dmg: { 味方の id: 合計 }, ko: [倒れる味方の id], by: { 敵の id: その敵が与える合計 } }
export function threatPreview(s) {
  const out = { dmg: {}, ko: [], by: {} };
  if (s.phase !== 'aim') return out;
  const c = cloneState(s);
  c.events = []; c.motion = null; c.phase = 'resolving';
  c.queue = s.units.filter((u) => u.alive && u.side === 1 && u.count === 1 && u.stagger === 0).map((u) => ({ t: 'tick', id: u.id }));
  if (!c.queue.length) return out;
  for (let k = 0; k < 240 * 20 && c.phase === 'resolving'; k++) {
    step(c);
    for (const e of c.events) {
      const to = e.to !== undefined ? c.units[e.to] : null;
      if (e.t === 'hit' && to && to.side === 0 && to.kind === 'ally') { out.dmg[e.to] = (out.dmg[e.to] || 0) + e.dmg; if (e.by >= 0) out.by[e.by] = (out.by[e.by] || 0) + e.dmg; }
      if (e.t === 'ko' && c.units[e.id] && c.units[e.id].side === 0 && c.units[e.id].kind === 'ally') out.ko.push(e.id);
    }
    c.events = [];
  }
  return out;
}

// ---- 予告(次の敵の番で動く敵の、攻撃の形) -----------------------------------

export function telegraphs(s) {
  const out = [];
  for (const u of s.units) {
    if (!u.alive || u.side !== 1 || u.count !== 1 || u.stagger > 0) continue;
    let t = null;
    if (u.action === 'blast' || u.action === 'bomb') t = { id: u.id, shape: 'circle', x: u.x, y: u.y, r: u.actR };
    else if (u.action === 'beamH') t = { id: u.id, shape: 'band', x: 0, y: u.y - u.r - 12, w: s.w, h: (u.r + 12) * 2 };
    else if (u.action === 'beamV') t = { id: u.id, shape: 'band', x: u.x - u.r - 12, y: 0, w: (u.r + 12) * 2, h: s.h };
    else if (u.action === 'charge') { const tg = nearest(s, u, 0); if (tg) t = { id: u.id, shape: 'line', x: u.x, y: u.y, x2: tg.x, y2: tg.y }; }
    else if (u.action === 'gust' || u.action === 'pull') t = { id: u.id, shape: u.action, x: u.x, y: u.y, r: u.actR + 120 };
    else t = { id: u.id, shape: 'mark', x: u.x, y: u.y, kind: u.action };
    if (!t) continue;
    t.foes = caughtFoes(s, u, t); // いまのままなら巻き込まれる別の敵(敵の攻撃は敵にも当たる)
    out.push(t);
  }
  return out;
}

function caughtFoes(s, u, t) {
  const ids = [];
  for (const o of s.units) {
    if (!o.alive || o.side !== 1 || o.id === u.id) continue;
    let hit = false;
    if (t.shape === 'circle') { const dx = o.x - u.x, dy = o.y - u.y, rr = u.actR + o.r; hit = dx * dx + dy * dy <= rr * rr; }
    else if (t.shape === 'band') { const half = u.r + 12, off = u.action === 'beamH' ? o.y - u.y : o.x - u.x; hit = off <= half + o.r && off >= -(half + o.r); }
    else if (t.shape === 'line') { // たいあたりの線の近く(線分との距離)
      const lx = t.x2 - t.x, ly = t.y2 - t.y, l2 = lx * lx + ly * ly;
      let k = l2 > 0 ? ((o.x - t.x) * lx + (o.y - t.y) * ly) / l2 : 0; k = Math.max(0, Math.min(1, k));
      const px = t.x + lx * k - o.x, py = t.y + ly * k - o.y, rr = u.r + o.r;
      hit = px * px + py * py <= rr * rr;
    }
    if (hit) ids.push(o.id);
  }
  return ids;
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
  put(s.pickups.length); put(s.bonusGaps.length); put(s.bonusUsed ? 1 : 0);
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
