// はじきバトル 演出の場面カタログ。格表の各段と、場面表の各行を、いつでも同じ形で起こせるようにしたもの。
// 場面 = 盤面の作り方(cfg)+ 作ったあとの手直し(prep)+ 弾く手(入力)。入力は find-scenes.mjs が探して
// scenes-inputs.js に書き出す(同じ手なら必ず同じ結果になるので、何度でも同じ場面が撮れる)。
// 使い道: 演出ラボで 1 場面ずつ見る / 撮影台(fx-check.mjs)で before・after を撮って測る / 検査で場面が崩れていないか確かめる
import { createBattle } from '../engine/engine.js';
import { ally, foe, mobBattle, bossBattle } from '../engine/data.js';

const NOGAP = { top: [], bottom: [], left: [], right: [] };
const TEAM = {
  mixed: () => ['kitchen', 'food', 'creature', 'machine'].map((l) => ally(l)),
  chain: () => ['creature', 'toy', 'book', 'kitchen'].map((l) => ally(l)),
  hanabi: () => [ally('machine', { item: 'match', passives: ['grit'] }), ally('kitchen'), ally('furniture'), ally('food')],
  heavy: () => ['machine', 'furniture', 'bath', 'kitchen'].map((l) => ally(l)),
};
const MOB0 = ['kitchen', 'plant', 'creature'];
const enemies = (s) => s.units.filter((u) => u.side === 1);
const lowHp = (u, pct) => { u.hp = Math.max(1, Math.round(u.maxHp * pct)); };
const ev = (sc, t) => sc.events.filter((r) => r.e.t === t && r.phase === 'shot');
const evAll = (sc, t) => sc.events.filter((r) => r.e.t === t);
const quick = (sc) => -sc.steps / 2000; // 同じ条件なら短い手を選ぶ

/**
 * kind: 'shot'(手を 1 つ弾いて見る)/ 'state'(止まった状態を撮る)
 * tier: 格表の段(状態の場面は null) / want(sc): 台本を見て、この場面として使えるなら点数(大きいほどよい)、使えないなら -1
 */
export const SCENES = [
  // ---- 止まった状態(WO §2 の状態一覧) ----
  { id: 'aim', ja: '狙い待ち', kind: 'state', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0) },
  { id: 'drag', ja: '引っぱり中(強さ 強)', kind: 'state', drag: true, cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    want: (sc) => (!sc.summary.kos.length && sc.summary.dmg > 0 ? 1 + quick(sc) : -1), powers: [3] },
  { id: 'dragDanger', ja: '引っぱり中(落ちる軌道の警告)', kind: 'state', drag: true, cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { lowHp(s.units[s.active], 0.4); }, // 体力が半分以下だと落ちうる
    want: (sc) => (ev(sc, 'fall').length ? 1 + quick(sc) : -1) },
  { id: 'ultArmed', ja: '必殺を構えた', kind: 'state', armed: true, cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { s.units[s.active].ultCharge = s.units[s.active].ultNeed; } },
  // ---- 格 0〜4(1 手を弾いて見る) ----
  { id: 'hit', ja: 'ふつうの当たり', tier: 0, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    want: (sc) => { const m = sc.summary; return m.strong === 0 && m.maxChain === 1 && !m.kos.length && m.dmg > 0 && !ev(sc, 'fall').length ? 1 + quick(sc) : -1; }, powers: [1, 2] },
  { id: 'strong', ja: '強打', tier: 1, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    want: (sc) => { const m = sc.summary; return m.strong >= 1 && m.maxChain <= 2 && !m.kos.length && !ev(sc, 'fall').length ? 1 + quick(sc) : -1; }, powers: [3] },
  { id: 'chain3', ja: '3 れんさ(必殺+1)', tier: 1, kind: 'shot', cfg: () => mobBattle('living', TEAM.chain(), ['kitchen', 'food', 'stationery', 'toy']),
    want: (sc) => { const m = sc.summary; return m.maxChain === 3 && !m.kos.length && m.chainCharge && !ev(sc, 'fall').length ? 1 + quick(sc) : -1; } },
  { id: 'crash', ja: 'ぶつけ(敵どうし)', tier: 1, kind: 'shot', cfg: () => mobBattle('attic', TEAM.heavy(), ['book', 'electronic', 'furniture', 'clothing']),
    want: (sc) => (ev(sc, 'crash').length && !sc.summary.kos.length && !ev(sc, 'fall').length ? 1 + ev(sc, 'crash').length * 0.1 + quick(sc) : -1) },
  { id: 'relay', ja: '玉突き(味方のタッチ技が続く)', tier: 1, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.chain(), MOB0),
    want: (sc) => (evAll(sc, 'relay').length && !ev(sc, 'fall').length ? 1 + evAll(sc, 'relay').length * 0.2 + quick(sc) : -1) },
  { id: 'ringout', ja: '敵の場外 → もう 1 手', tier: 2, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.heavy(), MOB0),
    prep: (s) => { for (const u of enemies(s)) lowHp(u, 0.45); },
    want: (sc) => { const m = sc.summary; return m.kos.some((k) => k.how === 'ring' && k.phase === 'shot') && m.bonusShot && !m.won ? 1 + quick(sc) : -1; } },
  { id: 'shatter', ja: '撃破(体力 0)', tier: 2, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { lowHp(enemies(s)[0], 0.08); lowHp(enemies(s)[1], 0.08); },
    want: (sc) => { const m = sc.summary; return m.kos.some((k) => k.how === 'hp' && k.phase === 'shot') && !m.won && !ev(sc, 'fall').length ? 1 + quick(sc) : -1; } },
  { id: 'chain5', ja: '5 れんさ(呼びかけ 1 回)', tier: 2, kind: 'shot', cfg: () => mobBattle('living', TEAM.chain(), ['kitchen', 'food', 'stationery', 'toy']),
    prep: (s) => { for (const u of enemies(s)) u.hp = u.maxHp = 400; },
    want: (sc) => { const m = sc.summary; return m.maxChain >= 5 && m.maxChain <= 9 && !m.kos.length ? 1 + quick(sc) : -1; } },
  { id: 'blast', ja: '花火の連鎖(爆発が続く)', tier: 2, kind: 'shot',
    cfg: () => ({ gaps: NOGAP, allies: TEAM.hanabi(),
                  enemies: [[150, 200], [200, 170], [120, 150], [240, 210], [180, 120]].map(([x, y]) => foe('plant', x, y)).concat([foe('furniture', 320, 60)]) }),
    prep: (s) => { const es = enemies(s); for (let k = 0; k < es.length - 1; k++) lowHp(es[k], 0.05); u0(s).x = 180; u0(s).y = 420; }, // 奥の 1 体は満タン(決着にしない)
    want: (sc) => (sc.summary.blasts.length >= 2 && !sc.summary.won ? 1 + sc.summary.blasts.length * 0.1 + quick(sc) : -1) },
  { id: 'ult', ja: '必殺', tier: 3, kind: 'shot', ult: true, cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { s.units[s.active].ultCharge = s.units[s.active].ultNeed; },
    want: (sc) => (sc.summary.ult && !sc.summary.won && sc.summary.dmg > 0 ? 1 + sc.summary.dmg / 1000 + quick(sc) : -1) },
  { id: 'gauge', ja: 'ボスのゲージ割り', tier: 3, kind: 'shot', cfg: () => bossBattle('vacuum', TEAM.heavy()),
    prep: (s) => { const b = s.units.find((u) => u.kind === 'boss'); lowHp(b, 0.06); },
    want: (sc) => (sc.summary.gauges.length && !sc.summary.won ? 1 + quick(sc) : -1) },
  { id: 'chain10', ja: '10 れんさ(札・呼びかけを重ねる)', tier: 3, kind: 'shot',
    cfg: () => ({ gaps: NOGAP, allies: TEAM.chain(),
                  enemies: grid(5, 4, 60, 50, 56, 66).map(([x, y]) => Object.assign(foe('toy', x, y), { weight: 1 })), obstacles: [{ obj: 'bumper', x: 40, y: 330 }, { obj: 'bumper', x: 320, y: 330 }] }),
    prep: (s) => { for (const u of enemies(s)) u.hp = u.maxHp = 2000; },
    want: (sc) => (sc.summary.maxChain >= 10 ? 1 + sc.summary.maxChain * 0.01 + quick(sc) : -1) },
  { id: 'finale', ja: '決着(ザコ戦)', tier: 4, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { const es = enemies(s); for (let k = 1; k < es.length; k++) { es[k].alive = false; } lowHp(es[0], 0.1); },
    want: (sc) => { const m = sc.summary; return m.won && m.finale && m.finale.phase === 'shot' && !m.finale.special ? 1 + quick(sc) : -1; } },
  { id: 'finaleBoss', ja: '決着(ボス戦・寄りあり)', tier: 4, kind: 'shot', cfg: () => bossBattle('washer', TEAM.heavy()),
    prep: (s) => { const b = s.units.find((u) => u.kind === 'boss'); b.gaugeIdx = b.gauges.length - 1; b.maxHp = b.gauges[b.gaugeIdx]; lowHp(b, 0.05);
                   for (const u of enemies(s)) if (u.kind !== 'boss') u.alive = false; },
    want: (sc) => (sc.summary.won && sc.summary.finale && sc.summary.finale.boss && sc.summary.finale.phase === 'shot' ? 1 + quick(sc) : -1) },
  { id: 'special', ja: '決着の特別版(1 手で 3 体以上)', tier: 4, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.heavy(), ['kitchen', 'plant', 'creature', 'toy']),
    prep: (s) => { for (const u of enemies(s)) lowHp(u, 0.04); },
    want: (sc) => (sc.summary.won && sc.summary.finale && sc.summary.finale.special ? 1 + sc.summary.finale.kosInShot * 0.1 + quick(sc) : -1) },
  { id: 'enemyTurn', ja: '敵の番(巻き込みあり)', tier: null, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { for (const u of enemies(s)) { u.count = 1; u.hp = u.maxHp; } const es = enemies(s); es[0].action = 'blast'; es[0].actR = 110; es[1].x = es[0].x + 60; es[1].y = es[0].y + 10; },
    want: (sc) => (evAll(sc, 'act').length >= 2 && evAll(sc, 'friendly').length && !sc.summary.kos.length && !sc.summary.lost ? 1 + quick(sc) : -1), powers: [1] },
  { id: 'allyFall', ja: '味方の落下(短く)', tier: null, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { lowHp(s.units[s.active], 0.4); },
    want: (sc) => (ev(sc, 'fall').length && !sc.summary.kos.length && !sc.summary.lost ? 1 + quick(sc) : -1) },
  { id: 'lost', ja: '負け', tier: null, kind: 'shot', cfg: () => mobBattle('kitchen', TEAM.mixed(), MOB0),
    prep: (s) => { const as = s.units.filter((u) => u.side === 0 && u.kind === 'ally'); for (const u of as) if (u.id !== s.active) u.alive = false; lowHp(s.units[s.active], 0.03);
                   for (const u of enemies(s)) { u.count = 1; u.action = 'blast'; u.actR = 400; } },
    want: (sc) => (sc.summary.lost && !sc.summary.kos.length ? 1 + quick(sc) : -1), powers: [1] },
];
const u0 = (s) => s.units[s.active];
function grid(cols, rows, x0, y0, dx, dy) { const out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * dx + (r % 2) * dx / 2, y0 + r * dy]); return out; }

/** 場面の盤面を作る(prep まで済ませた状態) */
export function sceneState(sc) {
  const s = createBattle(sc.cfg());
  if (sc.prep) sc.prep(s);
  return s;
}
export const sceneById = (id) => SCENES.find((s) => s.id === id);
