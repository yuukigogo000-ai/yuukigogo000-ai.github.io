// うしみつ時計: 模擬の打ち手(検査と強さの集計用。画面には入れない)。
import { act, alive, cloneState, intent, needsTarget, rnd, specOf } from './battle.js';
import { canUpgrade, CARDS } from './data.js';
import * as R from './run.js';

// いま選べる行動をすべて並べる
export function allActs(b) {
  const out = [], foes = alive(b);
  const push = (a) => { const sp = specOf(b, a); for (let k = sp.min; k <= sp.max; k++) { if (needsTarget(sp)) for (const f of foes) out.push({ a, k, target: f.id }); else out.push({ a, k }); } };
  push('utsu'); push('ukeru'); for (let i = 0; i < b.hand.length; i++) push(i);
  return out;
}
// 1 手打ったあとの盤面の良さ
function score(b0, c) {
  if (c.over === 'lose') return -100000;
  const wH = c.hp <= c.maxHp * 0.4 ? 4 : 2.2;
  let s = -(b0.hp - c.hp) * wH;
  for (const f of b0.foes) { if (f.dead) continue; const n = c.foes.find((x) => x.id === f.id); s += (f.hp - n.hp) * (f.core ? 1 : 0.7) + (n.dead ? 6 : 0) + (n.burn * (n.burn + 1) - f.burn * (f.burn + 1)) * 0.2; if (n.mark && f.mark && n.mark.ai === f.mark.ai && n.mark.at > f.mark.at && !n.broken) s += (n.mark.at - f.mark.at) * 1.2; }
  s += (c.stats.breaks - b0.stats.breaks) * 6 + (c.power - b0.power) * 0.4 + (c.ward - b0.ward) * 3 - (c.curse - b0.curse) * 0.8;
  if (c.over === 'win') s += 300; if (c.over === 'dawn') s += 200;
  if (!c.over) for (const f of alive(c)) { const it = intent(c, f); if (it && it.in <= 2) s -= it.dmg * 0.35 * (wH / 2.2); }
  s += (c.t - b0.t) * (b0.dawn ? 0.4 : -1.2);
  return s;
}
function ranked(b) { return allActs(b).map((o) => { const c = cloneState(b); act(c, o); return { o, c, s: score(b, c) }; }).sort((x, y) => y.s - x.s); }
// policy: 'best'(2 手先まで読む)/ 'greedy'(1 手だけ)/ 'loose'(上位 3 つから適当、2 割はでたらめ)/ 'basic'(打つ・受けるだけ)/ 'idle'(受けるだけ)
export function chooseAct(b, policy, noise) {
  if (policy === 'idle') return { a: 'ukeru', k: 1 };
  let list = ranked(b);
  if (policy === 'basic') list = list.filter((x) => typeof x.o.a !== 'number');
  if (policy === 'loose') { if (rnd(noise) < 0.2) return list[Math.floor(rnd(noise) * list.length)].o; return list[Math.floor(rnd(noise) * Math.min(3, list.length))].o; }
  if (policy === 'best') {
    let best = null, bs = -Infinity;
    for (const x of list.slice(0, 6)) { let s = x.s; if (!x.c.over) { const nx = ranked(x.c)[0]; s += nx.s * 0.8; } if (s > bs) { bs = s; best = x.o; } }
    return best;
  }
  return list[0].o;
}
export function playBattle(b, policy, noise) { let n = 0; while (!b.over && n++ < 400) act(b, chooseAct(b, policy, noise)); return b; }

// 一夜を通しで遊ぶ。道やごほうびは、かんたんな決まりで選ぶ
export function playRun(r, policy, seed) {
  const noise = { rng: (seed >>> 0) || 7 }; let guard = 0;
  while (r.phase !== 'over' && guard++ < 3000) {
    const hpR = r.hp / r.maxHp;
    if (r.phase === 'map') {
      const opts = R.options(r); let i = 0;
      if (opts.length > 1) {
        const [a, b] = opts.map((o) => o.type);
        if (b === 'rest') i = hpR < 0.7 ? 1 : 0; else if (b === 'shop') i = r.zeni >= 28 || (a === 'elite' && hpR < 0.65) ? 1 : 0; else if (b === 'event') i = hpR < 0.5 ? 1 : 0;
        if (policy === 'loose' && rnd(noise) < 0.3) i = Math.floor(rnd(noise) * opts.length);
      }
      R.choose(r, i);
    } else if (r.phase === 'battle') { const o = policy === 'idle' ? { a: 'ukeru', k: 1 } : chooseAct(r.battle, policy, noise); const res = R.fight(r, o); if (!res.ok) throw new Error('打ち手が出した手が通らない: ' + res.why); }
    else if (r.phase === 'reward') {
      if (r.reward.relics) R.takeRelic(r, 0);
      else { const likes = R.charOf(r).likes; let i = r.reward.cards.findIndex((id) => likes.includes(CARDS[id].kind)); if (r.deck.length >= 13 || policy === 'basic' || policy === 'idle') i = -1; R.takeCard(r, i); }
    } else if (r.phase === 'shop') {
      const s = r.shop;
      for (let i = 0; i < s.relics.length; i++) if (r.zeni >= R.PRICE.relic) R.buy(r, 'relic', i);
      if (hpR < 0.6) R.buy(r, 'heal');
      if (policy !== 'basic') for (let i = 0; i < s.cards.length; i++) if (r.zeni >= R.PRICE.card + 20 && r.deck.length < 13) R.buy(r, 'card', i);
      R.leave(r);
    } else if (r.phase === 'rest') {
      const i = r.deck.findIndex((id) => canUpgrade(id));
      if (hpR < 0.65 || i < 0) R.rest(r, 'heal'); else R.rest(r, 'up', i);
    } else if (r.phase === 'event') { R.answer(r, R.canAnswer(r, 'a') && r.hp > 10 ? 'a' : 'b'); }
  }
  return r;
}
