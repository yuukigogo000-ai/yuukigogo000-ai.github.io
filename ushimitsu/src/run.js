// うしみつ時計: 一夜の進行(道の選択・戦い・ごほうび・店・茶屋・出来事)。
// 盤面は JSON にできる値だけで持つ(保存して読み直しても続きから同じ結果になる)。
import { CHARS, DIFFS, ENCOUNTERS, CARDS, CARD_IDS, RELIC_IDS, canUpgrade } from './data.js';
import { newBattle, act as battleAct, pick, shuffle } from './battle.js';
import { EVENTS } from './tales.js';

export const DAWN = 36; // 丑三つ時の戦いで、夜明けが来る刻
// 一夜は 9 つの刻。どの刻に何があるかは、夜の始めに全部見える
export const PLAN = [['easy'], ['easy', 'event'], ['easy', 'shop'], ['elite', 'rest'], ['mid'], ['hard', 'event'], ['elite', 'shop'], ['rest'], ['boss']];
export const TYPE_JA = { easy: '戦い', hard: '戦い', elite: '手ごわい相手', mid: '真夜中の主', boss: '丑三つ時に来るもの', event: '出来事', shop: '店', rest: '茶屋' };
const FIGHT = ['easy', 'hard', 'elite', 'mid', 'boss'];
const ZENI = { easy: 14, hard: 18, elite: 26, mid: 32, boss: 0 };
export const PRICE = { card: 28, relic: 60, heal: 18, remove: 30 };
export const SHOP_HEAL = 12, REST_HEAL = 0.3;

export function newRun({ seed, char, diff }) {
  const c = CHARS[char] || CHARS[0];
  const r = {
    v: 1, seed: seed >>> 0, rng: ((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1, char: CHARS.indexOf(c), diff: DIFFS[diff] ? diff : 'normal',
    hp: c.hp, maxHp: c.hp, deck: c.deck.slice(), relics: [], zeni: 0, dollUsed: false,
    step: 0, nodes: [], phase: 'map', battle: null, node: null, reward: null, shop: null, event: null, result: null,
    stats: { fights: 0, dealt: 0, taken: 0, breaks: 0, ticks: 0 },
  };
  const pools = {}; const draw = (k) => { if (!pools[k] || !pools[k].length) pools[k] = shuffle(r, ENCOUNTERS[k].slice()); return pools[k].pop(); };
  const evs = shuffle(r, EVENTS.map((e, i) => i));
  r.nodes = PLAN.map((opts) => opts.map((type) => (FIGHT.includes(type) ? { type, foes: draw(type) } : type === 'event' ? { type, event: evs.pop() } : { type })));
  return r;
}
export const charOf = (r) => CHARS[r.char];
export const options = (r) => (r.phase === 'map' ? r.nodes[r.step] : []);
export const bossOf = (r) => r.nodes[r.nodes.length - 1][0].foes[0];
const heal = (r, n) => { const v = Math.max(0, Math.min(n, r.maxHp - r.hp)); r.hp += v; return v; };

function freeRelics(r) { return RELIC_IDS.filter((id) => !r.relics.includes(id)); }
function rollRelics(r, n) { const pool = shuffle(r, freeRelics(r)); return pool.slice(0, n); }
function rollCards(r, n) { // 夜回りの得意な種類が出やすい
  const likes = charOf(r).likes, bag = [];
  for (const id of CARD_IDS) for (let i = 0; i < (likes.includes(CARDS[id].kind) ? 3 : 1); i++) bag.push(id);
  const out = [];
  while (out.length < n) { const id = bag[pick(r, bag.length)]; if (!out.includes(id)) out.push(id); }
  return out;
}

// 道を選ぶ
export function choose(r, i) {
  if (r.phase !== 'map') return { ok: false, why: 'いまは道を選べません' };
  const node = r.nodes[r.step][i]; if (!node) return { ok: false, why: 'その道はありません' };
  r.node = { ...node, i };
  if (FIGHT.includes(node.type)) {
    r.battle = newBattle({ seed: (r.seed + r.step * 7919 + 1) >>> 0, hero: { char: charOf(r), hp: r.hp, maxHp: r.maxHp, deck: r.deck, relics: r.relics, dollUsed: r.dollUsed },
      foes: node.foes, mul: DIFFS[r.diff], dawn: node.type === 'boss' ? DAWN : 0 });
    r.phase = 'battle';
  } else if (node.type === 'event') { r.event = node.event; r.phase = 'event'; }
  else if (node.type === 'shop') {
    r.shop = { cards: rollCards(r, 3).map((id) => ({ id, sold: false })), relics: rollRelics(r, 2).map((id) => ({ id, sold: false })), healSold: false, removeSold: false };
    r.phase = 'shop';
  } else r.phase = 'rest';
  return { ok: true };
}
function advance(r) { r.step++; r.node = null; r.battle = null; r.reward = null; r.shop = null; r.event = null; r.phase = 'map'; }

// 戦いの 1 手。戦いが終わったら、ごほうび(または結末)へ進む
export function fight(r, o) {
  if (r.phase !== 'battle') return { ok: false, why: 'いまは戦いではありません', events: [] };
  const res = battleAct(r.battle, o); if (!res.ok || !r.battle.over) return res;
  const b = r.battle, type = r.node.type;
  r.hp = b.hp; r.dollUsed = b.dollUsed; r.stats.fights++; r.stats.dealt += b.stats.dealt; r.stats.taken += b.stats.taken; r.stats.breaks += b.stats.breaks; r.stats.ticks += b.t;
  if (b.over === 'lose') { r.phase = 'over'; r.result = { win: false, how: 'dead', step: r.step }; return res; }
  if (type === 'boss') { r.phase = 'over'; r.result = { win: true, how: b.over === 'dawn' ? 'dawn' : 'slain', step: r.step, ticks: b.t }; return res; }
  const healed = (r.relics.includes('hoshigaki') ? heal(r, 4) : 0) + (type === 'mid' ? heal(r, Math.ceil(r.maxHp * 0.3)) : 0);
  const zeni = Math.round(ZENI[type] * (r.relics.includes('maneki') ? 1.3 : 1)); r.zeni += zeni;
  const nRel = type === 'elite' ? 2 : type === 'mid' ? 3 : 0;
  r.reward = { zeni, healed, relics: nRel ? rollRelics(r, nRel) : null, cards: rollCards(r, 3) };
  if (r.reward.relics && !r.reward.relics.length) r.reward.relics = null;
  r.phase = 'reward';
  return res;
}
export function takeRelic(r, i) {
  if (r.phase !== 'reward' || !r.reward.relics) return { ok: false, why: 'いまは選べません' };
  const id = r.reward.relics[i]; if (!id) return { ok: false, why: 'そのおまもりはありません' };
  r.relics.push(id); r.reward.relics = null; if (!r.reward.cards) advance(r); return { ok: true, id };
}
export function takeCard(r, i) { // i = -1 で「もらわない」
  if (r.phase !== 'reward' || !r.reward.cards) return { ok: false, why: 'いまは選べません' };
  if (r.reward.relics) return { ok: false, why: '先におまもりを選んでください' };
  if (i >= 0) { const id = r.reward.cards[i]; if (!id) return { ok: false, why: 'その札はありません' }; r.deck.push(id); }
  r.reward.cards = null; advance(r); return { ok: true };
}

// 店。kind = 'card' | 'relic' | 'heal' | 'remove'。remove は手放す札の番号(deck の中の位置)を idx に渡す
export function buy(r, kind, idx) {
  if (r.phase !== 'shop') return { ok: false, why: 'いまは店ではありません' };
  const price = PRICE[kind]; if (!price) return { ok: false, why: 'それは売っていません' };
  if (r.zeni < price) return { ok: false, why: '銭がたりません(' + price + ')' };
  const s = r.shop;
  if (kind === 'card' || kind === 'relic') {
    const it = s[kind + 's'][idx]; if (!it || it.sold) return { ok: false, why: '売り切れです' };
    it.sold = true; (kind === 'card' ? r.deck : r.relics).push(it.id);
  } else if (kind === 'heal') {
    if (s.healSold) return { ok: false, why: '売り切れです' }; if (r.hp >= r.maxHp) return { ok: false, why: '体力は満タンです' };
    s.healSold = true; heal(r, SHOP_HEAL);
  } else {
    if (s.removeSold) return { ok: false, why: '1 回だけです' }; if (r.deck.length <= 5) return { ok: false, why: '札は 5 枚より減らせません' };
    if (!(idx >= 0 && idx < r.deck.length)) return { ok: false, why: '手放す札を選んでください' };
    s.removeSold = true; r.deck.splice(idx, 1);
  }
  r.zeni -= price; return { ok: true };
}
export function leave(r) { if (r.phase !== 'shop') return { ok: false, why: 'いまは店ではありません' }; advance(r); return { ok: true }; }

// 茶屋。how = 'heal'(体力を 3 割回復)| 'up'(札を 1 枚きたえる。idx = deck の中の位置)
export function rest(r, how, idx) {
  if (r.phase !== 'rest') return { ok: false, why: 'いまは茶屋ではありません' };
  if (how === 'heal') { const v = heal(r, Math.ceil(r.maxHp * REST_HEAL)); advance(r); return { ok: true, healed: v }; }
  if (how === 'up') {
    const id = r.deck[idx]; if (!id || !canUpgrade(id)) return { ok: false, why: 'きたえる札を選んでください' };
    r.deck[idx] = id + '+'; advance(r); return { ok: true, id: id + '+' };
  }
  return { ok: false, why: '休むか、きたえるかを選んでください' };
}

// 出来事。ch = 'a' | 'b'。返り値の notes は、実際に起きたこと(画面に出す)
export function canAnswer(r, ch) { const o = EVENTS[r.event][ch]; return !(o.need && o.need.zeni > r.zeni); }
export function answer(r, ch) {
  if (r.phase !== 'event') return { ok: false, why: 'いまは出来事ではありません' };
  const ev = EVENTS[r.event], o = ev[ch]; if (!o) return { ok: false, why: 'a か b を選んでください' };
  if (!canAnswer(r, ch)) return { ok: false, why: '銭がたりません' };
  const e = o.eff, notes = [];
  if (e.zeni) { r.zeni = Math.max(0, r.zeni + e.zeni); notes.push('銭 ' + (e.zeni > 0 ? '+' : '') + e.zeni); }
  if (e.maxHp) { r.maxHp += e.maxHp; r.hp += e.maxHp; notes.push('体力の上限 +' + e.maxHp); }
  if (e.hp > 0) notes.push('体力 +' + heal(r, e.hp));
  if (e.hp < 0) { const d = Math.min(-e.hp, r.hp - 1); r.hp -= d; notes.push('体力 -' + d); } // 出来事では倒れない
  if (e.card) { r.deck.push(e.card); notes.push('札「' + CARDS[e.card].name + '」を得た'); }
  if (e.relic) { const id = rollRelics(r, 1)[0]; if (id) { r.relics.push(id); notes.push('おまもりを得た'); r.lastRelic = id; } else { r.zeni += 20; notes.push('銭 +20'); } }
  if (e.upgrade) { const ok = r.deck.map((id, i) => (canUpgrade(id) ? i : -1)).filter((i) => i >= 0); if (ok.length) { const i = ok[pick(r, ok.length)]; r.deck[i] += '+'; notes.push('札「' + CARDS[r.deck[i].slice(0, -1)].name + '」がきたえられた'); } }
  if (e.remove && r.deck.length > 5) { const i = pick(r, r.deck.length), id = r.deck.splice(i, 1)[0]; notes.push('札「' + CARDS[id.replace('+', '')].name + '」を手放した'); }
  advance(r);
  return { ok: true, out: o.out, notes };
}
