// うしみつ時計: 戦いの決まり。依存は data.js だけ。乱数は盤面の中の種だけ(同じ手順なら同じ結果)。
//
// 核になる決まり:
//   - 行動は「何をするか」と「針を何刻回すか」で決める。回した刻だけ時間が進む
//   - 攻めは、回し終わった刻に当たる。同じ刻なら、あなたが先
//   - 守りは、回しているあいだだけ効く
//   - 化け物は、時計に置かれた印の刻が来ると動く(印は必ず見えている)
//   - 「かまえ」のある大技は、印の刻までにその数だけ削るとつぶせる
import { BASIC, FOES, getCard } from './data.js';

export const HAND_MAX = 3;     // 手札の上限
export const DRAW_EVERY = 2;   // 何刻ごとに札を 1 枚引くか
export const CLOCK = 12;       // 時計の 1 周
export const LOW_HP = 0.3;     // 火事場: これ以下で守りが 1.5 倍
export const DELAY_ONCE = true; // 同じ印は 1 回しかおくらせられない
export const LAP_UP = 2;        // 時計がひと回りするたび、化け物の攻撃がこれだけ上がる(長引かせても得をしない)

export function rnd(s) { // mulberry32。種は s.rng(整数)
  s.rng = (s.rng + 0x6D2B79F5) >>> 0; let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const pick = (s, n) => Math.floor(rnd(s) * n);
export function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = pick(s, i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
export const cloneState = (s) => JSON.parse(JSON.stringify(s));
export function hashState(s) { // FNV-1a
  const str = JSON.stringify(s); let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

const has = (b, id) => b.relics.includes(id);
export const alive = (b) => b.foes.filter((f) => !f.dead);
const fdmg = (b, v) => Math.max(1, Math.round(v * b.mul.dmg));
export const handMax = (b) => HAND_MAX + (has(b, 'fudabako') ? 1 : 0);
export const lowHp = (b) => b.hp <= Math.floor(b.maxHp * LOW_HP);

function schedule(b, f, extra) {
  const pat = FOES[f.kind].pat, ai = f.pi % pat.length, act = pat[ai];
  f.mark = { at: b.t + act.w + (extra || 0), ai, poise: act.poise ? Math.max(1, Math.round(act.poise * b.mul.hp)) : 0, dealt: 0, delayed: false };
  f.pi++;
}
function addFoe(b, kind, extra) {
  const d = FOES[kind], hp = Math.max(1, Math.round(d.hp * b.mul.hp));
  const f = { id: b.nextId++, kind, name: d.name, hp, maxHp: hp, armor: 0, burn: 0, up: 0, pi: 0, core: !d.minion, dead: false, broken: false, mark: null };
  b.foes.push(f); schedule(b, f, extra); return f;
}

// hero: { char(CHARS の 1 つ), hp, maxHp, deck:[札 id], relics:[id], dollUsed }
export function newBattle({ seed, hero, foes, mul, dawn }) {
  const b = {
    rng: (seed >>> 0) || 1, t: 0, char: hero.char.id, utsu: hero.char.utsu.slice(), ukeru: hero.char.ukeru.slice(),
    hp: hero.hp, maxHp: hero.maxHp, relics: hero.relics.slice(), dollUsed: !!hero.dollUsed,
    guard: 0, guardUntil: -1, ward: 0, power: 0, curse: 0, slow: 0, quick: 0, first: true,
    draw: [], hand: [], disc: [], gone: [], foes: [], nextId: 0, mul: { hp: mul ? mul.hp : 1, dmg: mul ? mul.dmg : 1 },
    dawn: dawn ? dawn - (hero.relics.includes('hane') ? 4 : 0) : 0, aura: null, over: null,
    stats: { dealt: 0, taken: 0, breaks: 0, acts: 0, kills: 0 },
  };
  if (has(b, 'toishi')) b.utsu = b.utsu.map((v) => v + 2);
  if (has(b, 'hanten')) b.ukeru = b.ukeru.map((v) => v + 2);
  foes.forEach((kind, i) => { const f = addFoe(b, kind, i + (has(b, 'kane') ? 2 : 0)); if (has(b, 'hiuchi')) f.burn = 3; if (FOES[kind].aura) b.aura = { ...FOES[kind].aura }; });
  if (has(b, 'omamori')) b.ward = 1;
  b.draw = shuffle(b, hero.deck.slice());
  drawCards(b, handMax(b), null);
  return b;
}

function drawCards(b, n, ev) {
  for (let i = 0; i < n; i++) {
    if (b.hand.length >= handMax(b)) return;
    if (!b.draw.length) { if (!b.disc.length) return; b.draw = shuffle(b, b.disc); b.disc = []; }
    const id = b.draw.pop(); b.hand.push(id); if (ev) ev.push({ e: 'draw', id });
  }
}

// いま選べる行動の中身。a は 'utsu' / 'ukeru' / 手札の番号
export function specOf(b, a) {
  if (a === 'utsu') return { id: 'utsu', ...BASIC.utsu, dmg: b.utsu };
  if (a === 'ukeru') return { id: 'ukeru', ...BASIC.ukeru, guard: b.ukeru };
  const id = b.hand[a]; return id ? getCard(id) : null;
}
export const needsTarget = (sp) => !sp.all && !!(sp.dmg || sp.burn || sp.delay || sp.byBurn);
// 実際に進む刻(砂・先手・懐中時計をふくむ)
export function costOf(b, k) { if (b.first && has(b, 'tokei')) return 0; return Math.max(0, k + b.slow - b.quick); }
const at = (arr, sp, k) => arr[Math.min(arr.length - 1, k - sp.min)];
export const guardOf = (b, sp, k) => (sp.guard ? Math.floor(at(sp.guard, sp, k) * (lowHp(b) ? 1.5 : 1)) : 0) + (k >= 3 && has(b, 'yakogai') ? 4 : 0);

export function whyNot(b, o) {
  if (b.over) return '戦いは終わっています';
  const sp = specOf(b, o.a); if (!sp) return 'その札はありません';
  if (!(o.k >= sp.min && o.k <= sp.max)) return sp.name + ' は ' + (sp.min === sp.max ? sp.min : sp.min + '〜' + sp.max) + ' 刻です';
  if (needsTarget(sp)) { const f = b.foes.find((x) => x.id === o.target); if (!f || f.dead) return '相手を選んでください'; }
  return null;
}

function kill(b, f, ev) {
  f.dead = true; f.hp = 0; f.mark = null; b.stats.kills++; ev.push({ e: 'kill', id: f.id });
  if (!b.foes.some((x) => x.core && !x.dead)) { b.over = 'win'; ev.push({ e: 'over', r: 'win' }); }
}
function breakFoe(b, f, ev) {
  f.broken = true; b.stats.breaks++; ev.push({ e: 'break', id: f.id });
  schedule(b, f, 2 + (b.char === 'suzu' ? 2 : 0)); // つぶされた行動は飛ばして、次の行動へ(2 刻ひるむ)
  let heal = (has(b, 'suzu') ? 3 : 0) + (b.char === 'suzu' ? 3 : 0);
  if (heal) { heal = Math.min(heal, b.maxHp - b.hp); b.hp += heal; if (heal) ev.push({ e: 'heal', v: heal }); }
}
function hurtFoe(b, f, d, crush, ev, why) { // d は、かたさを引いたあとの値
  if (f.dead) return;
  f.hp -= d; b.stats.dealt += d; ev.push({ e: why, id: f.id, v: d });
  if (f.hp <= 0) return kill(b, f, ev);
  if (f.mark && f.mark.poise) { f.mark.dealt += d * crush; if (f.mark.dealt >= f.mark.poise) breakFoe(b, f, ev); }
}
function hurtHero(b, d, ev, why) { // 守りで防げないダメージ
  b.hp -= d; b.stats.taken += d; ev.push({ e: why, v: d });
  if (b.hp <= 0) {
    if (has(b, 'ningyo') && !b.dollUsed) { b.hp = 1; b.dollUsed = true; ev.push({ e: 'doll' }); }
    else { b.hp = 0; b.over = 'lose'; ev.push({ e: 'over', r: 'lose' }); }
  }
}
function hitHero(b, d, ev, from) {
  if (b.ward > 0) { b.ward--; ev.push({ e: 'ward', id: from }); return; }
  let blocked = 0;
  if (b.guard > 0 && b.t <= b.guardUntil) { blocked = Math.min(b.guard, d); b.guard -= blocked; d -= blocked; }
  if (blocked) ev.push({ e: 'block', v: blocked, id: from });
  if (d > 0) hurtHero(b, d, ev, 'hit');
}

function foeAct(b, f, ev) {
  const act = FOES[f.kind].pat[f.mark.ai]; f.mark = null; f.armor = 0; f.broken = false;
  ev.push({ e: 'foe', id: f.id, n: act.n });
  if (act.dmg) {
    const d = Math.max(0, fdmg(b, act.dmg) + f.up - (b.char === 'tomo' && f.burn > 0 ? 2 : 0));
    for (let i = 0; i < (act.x || 1) && !b.over; i++) hitHero(b, d, ev, f.id);
  }
  if (b.over) return;
  if (act.curse && !has(b, 'juzu')) { b.curse += act.curse; ev.push({ e: 'cursed', v: act.curse }); }
  if (act.slow) { b.slow = 1; ev.push({ e: 'slowed' }); }
  if (act.steal && b.hand.length) { const i = pick(b, b.hand.length); const id = b.hand.splice(i, 1)[0]; b.disc.push(id); ev.push({ e: 'steal', card: id }); }
  if (act.armor) f.armor += act.armor;
  if (act.up) f.up += act.up;
  if (act.heal) f.hp = Math.min(f.maxHp, f.hp + Math.round(act.heal * b.mul.hp));
  if (act.summon && alive(b).length < 3) { const n = addFoe(b, act.summon, 0); ev.push({ e: 'summon', id: n.id }); }
  if (FOES[f.kind].grow) f.up += FOES[f.kind].grow;
  schedule(b, f, 0);
}

// 行動が当たる(回し終わった刻)
function land(b, sp, k, target, ev) {
  const tg = sp.all ? alive(b) : b.foes.filter((f) => f.id === target && !f.dead);
  if (sp.dmg) {
    const bonus = b.power + (has(b, 'oni') && b.hp * 2 <= b.maxHp ? 3 : 0); b.power = 0;
    for (let h = 0; h < (sp.hits || 1); h++) for (const f of tg) {
      if (f.dead) continue;
      if (sp.strip) f.armor = 0;
      let d = at(sp.dmg, sp, k) + bonus + (sp.byBurn ? f.burn * sp.byBurn : 0) + (sp.exec && f.hp * 2 <= f.maxHp ? sp.exec : 0);
      d = Math.max(0, d - f.armor);
      hurtFoe(b, f, d, sp.crush || 1, ev, 'dmg');
    }
  }
  if (sp.self) { const d = Math.min(sp.self, b.hp - 1); if (d > 0) { b.hp -= d; ev.push({ e: 'self', v: d }); } } // 捨て身では倒れない
  if (sp.burn) for (const f of tg) if (!f.dead) { f.burn += at(sp.burn, sp, k); ev.push({ e: 'burned', id: f.id, v: at(sp.burn, sp, k) }); }
  if (sp.delay) for (const f of tg) if (!f.dead && f.mark && !(DELAY_ONCE && f.mark.delayed)) { f.mark.at += at(sp.delay, sp, k); f.mark.delayed = true; ev.push({ e: 'delay', id: f.id, v: at(sp.delay, sp, k) }); }
  if (sp.heal) { const v = Math.min(at(sp.heal, sp, k), b.maxHp - b.hp); b.hp += v; ev.push({ e: 'heal', v }); }
  if (sp.power) b.power += at(sp.power, sp, k);
  if (sp.cleanse) { b.curse = 0; b.slow = 0; }
  if (sp.quick) b.quick += sp.quick;
  if (sp.draw) drawCards(b, sp.draw, ev);
}

function tick(b, landing, ev) {
  b.t++; ev.push({ e: 'tick', t: b.t });
  for (const f of b.foes) if (!f.dead && f.burn > 0) { const d = f.burn; f.burn--; hurtFoe(b, f, d, 1, ev, 'burn'); if (b.over) return; }
  if (b.curse > 0) { b.curse--; hurtHero(b, 1, ev, 'curse'); if (b.over) return; }
  if (b.aura && b.t % b.aura.every === 0) { hurtHero(b, fdmg(b, b.aura.dmg), ev, 'aura'); if (b.over) return; }
  if (landing) { landing(); if (b.over) return; }
  for (const f of b.foes.slice()) if (!f.dead && f.mark && f.mark.at <= b.t) { foeAct(b, f, ev); if (b.over) return; }
  if (b.t % DRAW_EVERY === 0) drawCards(b, 1, ev);
  if (b.t % CLOCK === 0) { for (const f of b.foes) if (!f.dead) f.up += LAP_UP; ev.push({ e: 'lap', v: LAP_UP }); }
  if (b.dawn && b.t >= b.dawn) { b.over = 'dawn'; ev.push({ e: 'over', r: 'dawn' }); }
}

// 行動する。o = { a: 'utsu' | 'ukeru' | 手札の番号, k: 回す刻, target: 相手の id }
// 返り値 { ok, why, events }。events は起きた順(画面の再生用)
export function act(b, o) {
  const why = whyNot(b, o); if (why) return { ok: false, why, events: [] };
  const sp = specOf(b, o.a), k = o.k, ev = [], cost = costOf(b, k);
  b.first = false; b.slow = 0; b.quick = 0; b.stats.acts++;
  if (typeof o.a === 'number') { const id = b.hand.splice(o.a, 1)[0]; (sp.once ? b.gone : b.disc).push(id); }
  ev.push({ e: 'act', name: sp.name, k, cost });
  const g = guardOf(b, sp, k);
  if (g) { if (b.t > b.guardUntil) b.guard = 0; b.guard += g; b.guardUntil = Math.max(b.guardUntil, b.t + Math.max(k, cost)); ev.push({ e: 'guard', v: g }); }
  if (sp.ward) b.ward += sp.ward;
  const hp0 = b.hp;
  const doLand = () => land(b, sp, k, o.target, ev);
  if (cost === 0) doLand();
  for (let i = 1; i <= cost && !b.over; i++) tick(b, i === cost ? doLand : null, ev);
  if (!b.over) {
    if (sp.counter && b.hp >= hp0) { b.power += sp.counter; ev.push({ e: 'counter', v: sp.counter }); }
    if (k === 1 && has(b, 'himo')) b.power += 2;
    if (b.guardUntil <= b.t) b.guard = 0; // 回し終わったら守りは消える
  }
  return { ok: true, events: ev };
}

// 行動する前の見通し(盤面は変えない)。運は入らないので、見えた通りになる
export function preview(b, o) {
  const c = cloneState(b), r = act(c, o);
  if (!r.ok) return { ok: false, why: r.why };
  return {
    ok: true, cost: c.t - b.t, hp: c.hp, hpLost: Math.max(0, b.hp - c.hp), over: c.over,
    foes: b.foes.filter((f) => !f.dead).map((f) => { const n = c.foes.find((x) => x.id === f.id); return { id: f.id, hp: n.hp, lost: f.hp - n.hp, dead: n.dead, broke: r.events.some((e) => e.e === 'break' && e.id === f.id) }; }),
    fired: r.events.filter((e) => e.e === 'foe').length, blocked: r.events.filter((e) => e.e === 'block').reduce((a, e) => a + e.v, 0), events: r.events,
  };
}

// 化け物の次の行動(画面の予告用)。数字は、いまの状態で実際に出る値
export function intent(b, f) {
  if (!f.mark) return null;
  const a = FOES[f.kind].pat[f.mark.ai], parts = [];
  if (a.dmg) { const d = Math.max(0, fdmg(b, a.dmg) + f.up - (b.char === 'tomo' && f.burn > 0 ? 2 : 0)); parts.push(a.x ? d + '×' + a.x : '' + d); }
  if (a.curse) parts.push('のろい ' + a.curse);
  if (a.slow) parts.push('砂');
  if (a.steal) parts.push('札を落とす');
  if (a.armor) parts.push('かたさ ' + a.armor);
  if (a.up) parts.push('攻撃 +' + a.up);
  if (a.heal) parts.push('回復');
  if (a.summon) parts.push(FOES[a.summon].name + 'を呼ぶ');
  return { at: f.mark.at, in: f.mark.at - b.t, name: a.n, text: parts.join('・'), dmg: a.dmg ? Math.max(0, fdmg(b, a.dmg) + f.up - (b.char === 'tomo' && f.burn > 0 ? 2 : 0)) * (a.x || 1) : 0,
    poise: f.mark.poise, poiseLeft: f.mark.poise ? Math.max(0, f.mark.poise - f.mark.dealt) : 0, delayed: f.mark.delayed };
}

// 札の説明(値から作るので、文と効果がずれない)。k を渡すとその刻の値、渡さなければ全部
export function describe(sp, k, b) {
  const v = (arr) => (k !== undefined ? at(arr, sp, k) : arr.length > 1 ? arr.join(' / ') : arr[0]);
  const p = [];
  if (sp.dmg) p.push((sp.all ? '全員に ' : '') + v(sp.dmg) + (sp.hits ? '×' + sp.hits : '') + ' ダメージ');
  if (sp.byBurn) p.push('相手のやけどの ' + sp.byBurn + ' 倍を上乗せ');
  if (sp.exec) p.push('体力が半分以下の相手には +' + sp.exec);
  if (sp.crush) p.push('かまえには ' + sp.crush + ' 倍効く');
  if (sp.strip) p.push('かたさを消してから当てる');
  if (sp.self) p.push('自分も ' + sp.self + ' ダメージ');
  if (sp.guard) p.push('守り ' + (b && k !== undefined ? guardOf(b, sp, k) : v(sp.guard)));
  if (sp.ward) p.push('次の攻撃を ' + sp.ward + ' 回かわす');
  if (sp.counter) p.push('無傷で受けきると次の攻撃 +' + sp.counter);
  if (sp.burn) p.push((sp.all ? '全員に' : '') + 'やけど ' + v(sp.burn));
  if (sp.delay) p.push((sp.all ? '全員の' : '') + '印を ' + v(sp.delay) + ' 刻おくらせる');
  if (sp.heal) p.push('体力 ' + v(sp.heal) + ' 回復');
  if (sp.power) p.push('次の攻撃 +' + v(sp.power));
  if (sp.cleanse) p.push('のろいと砂を消す');
  if (sp.quick) p.push('次の行動が ' + sp.quick + ' 刻みじかい');
  if (sp.draw) p.push('札を ' + sp.draw + ' 枚引く');
  if (sp.once) p.push('1 度きり');
  return p.join('、');
}
export const ticksText = (sp) => (sp.min === sp.max ? sp.min + ' 刻' : sp.min + '〜' + sp.max + ' 刻');
