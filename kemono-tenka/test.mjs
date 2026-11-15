// けもの天下の検査(node test.mjs)。--mutate で検査器自身が間違いを見つけられるか確かめる。
import * as C from './src/core.js';
import * as S from './src/story.js';

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }
const G = (o) => C.newGame(Object.assign({ seed: 7, clan: 0, difficulty: 'normal' }, o));
const me = (s) => s.clans[s.player];
const home = (s) => s.provs[me(s).home];
// 検査用: 国の持ち主と兵を直接おく
const set = (s, id, owner, troops, extra) => Object.assign(s.provs[id], { owner, troops, tired: 0, unrest: 0 }, extra || {});
const quiet = (s) => { for (const c of s.clans) c.intents = []; return s; }; // 相手の予定を消す(1 つの決まりだけを見たいとき)

// ---- はじまりの盤面 ----------------------------------------------------------
{
  const s = G();
  ok('国は 12、家は 4', s.provs.length === 12 && s.clans.length === 4);
  ok('となり合わせは左右対称(A のとなりに B があれば、B のとなりに A がある)', s.provs.every((p) => p.adj.every((j) => s.provs[j].adj.includes(p.id))));
  ok('4 つの家は四すみから始まり、兵 6・城 1', s.clans.every((c) => [0, 2, 9, 11].includes(c.home) && s.provs[c.home].owner === c.id && s.provs[c.home].troops === 6 && s.provs[c.home].castle === 1));
  ok('自分は左下(こけ沼)から始まる', me(s).home === 9);
  ok('都は持ち主なしで、城 2・兵 12', s.provs[C.CAPITAL].owner === -1 && s.provs[C.CAPITAL].castle === 2 && s.provs[C.CAPITAL].troops === 12);
  ok('同じ種なら同じ盤面', JSON.stringify(G()) === JSON.stringify(G()));
  ok('種が違えば盤面も違う', JSON.stringify(G()) !== JSON.stringify(G({ seed: 8 })));
  ok('どの家を選んでも始められる', [0, 1, 2, 3].every((c) => { const g = G({ clan: c }); return g.player === c && g.clans[c].home === 9 && g.clans[c].officers.length === 1; }));
  ok('相手の家は、最初から次の予定を見せている', s.clans.filter((c) => c.id !== s.player).every((c) => Array.isArray(c.intents) && c.intents.length >= 1));
}
// ---- いくさの見こみ(運なし) -------------------------------------------------
{
  const s = quiet(G({ clan: 1 })); set(s, 6, -1, 4, { castle: 0 }); home(s).troops = 9; // カメ家(攻めの補正なし)で確かめる
  let f = C.forecast(s, 9, 6, 8);
  ok('兵が多ければ勝つ。残る兵は 出した数 − 相手の力の 8 割', f.win === true && f.attackerLeft === 8 - Math.ceil(4 * 0.8), f);
  f = C.forecast(s, 9, 6, 4); ok('同じ力では勝てない', f.win === false && f.attackerLoss === Math.ceil(4 * 0.6), f);
  s.provs[6].castle = 2; f = C.forecast(s, 9, 6, 6); ok('城 2 は守りが 1.6 倍', f.win === false && Math.abs(f.def - 6.4) < 1e-9, f);
  s.clans[s.player].officers.push('kage'); ok('忍びのカゲ: 城の守りを無視', C.forecast(s, 9, 6, 6).win === true);
  const b = G({ clan: 0 }); set(b, 6, -1, 6, { castle: 0 }); ok('猛将ゴンタ(クマ家): 攻めの兵力 +20%', C.forecast(b, 9, 6, 6).win === true && Math.abs(C.forecast(b, 9, 6, 6).atk - 7.2) < 1e-9);
  const t = G({ clan: 2 }); const turtle = t.clans.find((c) => c.key === 'turtle'); set(t, 6, turtle.id, 5, { castle: 0 });
  ok('守りのドン(カメ家): 守りの兵力 +20%', Math.abs(C.forecast(t, 9, 6, 5).def - 6) < 1e-9, C.forecast(t, 9, 6, 5));
}
// ---- 命令 --------------------------------------------------------------------
{
  let s = quiet(G()); set(s, 6, -1, 2, { castle: 0 }); home(s).troops = 8;
  ok('となりでない国には出せない', C.whyNot(s, s.player, { t: 'march', from: 9, to: 4, sent: 3 }) !== null);
  ok('国には兵を 1 つ残す', C.whyNot(s, s.player, { t: 'march', from: 9, to: 6, sent: 8 }) !== null && C.whyNot(s, s.player, { t: 'march', from: 9, to: 6, sent: 7 }) === null);
  ok('攻め取ると自分の国になり、次のターンは米を生まない', C.order(s, { t: 'march', from: 9, to: 6, sent: 7 }) && s.provs[6].owner === s.player && s.provs[6].unrest === 1 && s.provs[9].troops === 1, s.provs[6]);
  ok('攻め取ったばかりの国からは、そのターンは出せない', C.whyNot(s, s.player, { t: 'march', from: 6, to: 3, sent: 1 }) !== null);
  ok('命令を出すと残りが減る', s.ordersLeft === 2);
  s = quiet(G()); set(s, 6, -1, 9, { castle: 1 }); home(s).troops = 6; C.order(s, { t: 'march', from: 9, to: 6, sent: 5 });
  ok('負けると兵を失い、国は取れない', s.provs[6].owner === -1 && s.provs[9].troops === 6 - Math.ceil(5 * 0.6) && s.provs[6].troops < 9, [s.provs[9].troops, s.provs[6].troops]);
  s = quiet(G()); set(s, 10, s.player, 2); home(s).troops = 6; C.order(s, { t: 'march', from: 9, to: 10, sent: 4 });
  ok('自分の国へは兵を動かすだけ', s.provs[10].troops === 6 && s.provs[9].troops === 2);
  s = quiet(G({ clan: 1 })); me(s).rice = 10; const t0 = home(s).troops; C.order(s, { t: 'recruit', at: 9 });
  ok('徴兵: 兵 1 つにつき米 1、1 回で 4 まで', home(s).troops === t0 + 4 && me(s).rice === 6, [home(s).troops, me(s).rice]);
  me(s).rice = 2; C.order(s, { t: 'recruit', at: 9 }); ok('徴兵: 米が足りなければ、ある分だけ', home(s).troops === t0 + 6 && me(s).rice === 0);
  s = quiet(G({ clan: 3 })); me(s).rice = 10; const r0 = home(s).troops; C.order(s, { t: 'recruit', at: 9 }); ok('募兵のピョン(ウサギ家): 兵 +1', home(s).troops === r0 + 5);
  s = quiet(G({ clan: 1 })); me(s).rice = 10; C.order(s, { t: 'develop', at: 9 }); ok('開発: 米 4 で石高 +1', home(s).koku === 4 && me(s).rice === 6);
  C.order(s, { t: 'fortify', at: 9 }); ok('築城: 米 3 で城 +1', home(s).castle === 2 && me(s).rice === 3);
  ok('城は 2 まで', C.whyNot(s, s.player, { t: 'fortify', at: 9 }) !== null);
  ok('命令は 1 ターンに 3 つまで', s.ordersLeft === 1 && C.order(s, { t: 'recruit', at: 9 }) && s.ordersLeft === 0 && C.order(s, { t: 'recruit', at: 9 }) === false);
  s = quiet(G({ clan: 1 })); me(s).rice = 1; ok('米が足りないと出せない(理由つき)', typeof C.whyNot(s, s.player, { t: 'develop', at: 9 }) === 'string' && C.order(s, { t: 'develop', at: 9 }) === false);
  s = quiet(G({ clan: 1 })); me(s).officers.push('tama', 'mogu'); ok('目利きのタマ・築城のモグ: 費用 -1', C.costOf(s, s.player, 'develop') === 3 && C.costOf(s, s.player, 'fortify') === 2);
}
// ---- 外交 --------------------------------------------------------------------
{
  let s = quiet(G({ clan: 1 })); const o = s.clans.find((c) => c.id !== s.player); me(s).rice = 20;
  ok('仲が +2 未満では、不戦の約束は結べない', C.whyNot(s, s.player, { t: 'pact', clan: o.id }) !== null);
  C.order(s, { t: 'gift', clan: o.id }); ok('贈り物: 米 2 で仲 +2', o.rel === 2 && me(s).rice === 18);
  ok('仲が +2 になると約束を結べる(4 ターン)', C.order(s, { t: 'pact', clan: o.id }) && o.pact === 4);
  const k = quiet(G({ clan: 2 })); const ko = k.clans.find((c) => c.id !== k.player); k.clans[k.player].rice = 9; C.order(k, { t: 'gift', clan: ko.id });
  ok('口八丁のコン(キツネ家): 贈り物の効きめ +1', ko.rel === 3);
  // 約束を破る
  s = quiet(G({ clan: 1 })); const a = s.clans.find((c) => c.id !== s.player), b = s.clans.find((c) => c.id !== s.player && c.id !== a.id);
  a.pact = 4; set(s, 6, a.id, 1, { castle: 0 }); home(s).troops = 8; C.order(s, { t: 'march', from: 9, to: 6, sent: 7 });
  ok('約束を破ると、すべての家からの信用を失う', a.pact === 0 && a.rel <= -3 && b.rel === -3, [a.rel, b.rel]);
  // 約束は守られる
  s = G({ clan: 1 }); s.turn = 5; const f = s.clans.find((c) => c.id !== s.player); f.pact = 3;
  set(s, 6, f.id, 12, { castle: 0 }); home(s).troops = 1; f.intents = [{ t: 'march', from: 6, to: 9, sent: 11 }];
  for (const c of s.clans) if (c.id !== f.id) c.intents = [];
  C.endTurn(s);
  ok('不戦の約束があるあいだ、その家は攻めてこない', s.provs[9].owner === s.player && f.pact === 2, [s.provs[9].owner, f.pact]);
}
// ---- 米の出入り --------------------------------------------------------------
{
  const s = quiet(G({ clan: 1 }));
  ok('実りは石高の合計、維持費は兵 4 つにつき米 1', C.incomeOf(s, s.player).gain === 3 && C.incomeOf(s, s.player).upkeep === 1);
  set(s, C.CAPITAL, s.player, 1); ok('都を持つと米 +2', C.incomeOf(s, s.player).gain === 3 + s.provs[C.CAPITAL].koku + 2);
  s.provs[C.CAPITAL].unrest = 1; ok('攻め取ったばかりの国は米を生まない', C.incomeOf(s, s.player).gain === 3);
  me(s).officers.push('kura', 'risu'); home(s).troops = 16;
  ok('蔵番のクラ: 米 +1、兵糧番のリス: 維持費が半分', C.incomeOf(s, s.player).gain === 4 && C.incomeOf(s, s.player).upkeep === Math.floor(17 / 8), C.incomeOf(s, s.player));
  const d = quiet(G({ clan: 1 })); me(d).rice = 0; home(d).troops = 30; home(d).koku = 1; C.endTurn(d);
  ok('米が尽きると兵が 1 つ去る', home(d).troops === 29 && me(d).rice === 0, [home(d).troops, me(d).rice]);
  const h = G({ clan: 1, difficulty: 'hard' }), n = G({ clan: 1 }); const hid = h.clans.find((c) => c.id !== h.player).id;
  h.provs[h.clans[hid].home].koku = 5; n.provs[n.clans[hid].home].koku = 5;
  ok('むずかしい: 相手の米の実りが 2 割多い(自分は変わらない)', C.incomeOf(h, hid).gain === 6 && C.incomeOf(n, hid).gain === 5 && C.incomeOf(h, h.player).gain === 3);
}
// ---- 相手の予告と動き --------------------------------------------------------
{
  let s = G({ clan: 1 }); s.turn = 5; const bear = s.clans.find((c) => c.key === 'bear'); // 2 年目(本拠を攻められる)
  for (const c of s.clans) c.intents = [];
  set(s, 6, bear.id, 9, { castle: 0 }); home(s).troops = 2; home(s).castle = 0;
  bear.intents = [{ t: 'march', from: 6, to: 9, sent: 8 }];
  const shown = JSON.stringify(bear.intents);
  ok('予告は、番を終える前に見えている', shown.includes('"to":9'));
  const k = C.cloneState(s); C.endTurn(k);
  ok('予告どおりに攻めてくる(何もしなければ本拠を取られて負け)', k.provs[9].owner === bear.id && k.phase === 'over' && k.winner !== k.player, [k.provs[9].owner, k.phase]);
  me(s).rice = 12; C.order(s, { t: 'recruit', at: 9 }); C.order(s, { t: 'recruit', at: 9 }); C.order(s, { t: 'fortify', at: 9 }); C.endTurn(s);
  ok('予告を見て守りを固めれば、はね返せる(クマ家は取りやめない)', s.provs[9].owner === s.player && s.provs[6].troops < 9, [s.provs[9].owner, s.provs[6].troops]);
  // カメ家は勝ち目がなくなると取りやめる
  s = G({ clan: 0 }); s.turn = 5; const turtle = s.clans.find((c) => c.key === 'turtle');
  for (const c of s.clans) c.intents = [];
  set(s, 6, turtle.id, 9, { castle: 0 }); home(s).troops = 20;
  turtle.intents = [{ t: 'march', from: 6, to: 9, sent: 8 }]; C.endTurn(s);
  ok('カメ家は、勝ち目のない攻めを取りやめる(兵を失わない)', s.provs[6].troops >= 9 && s.provs[9].troops === 20, [s.provs[6].troops, s.provs[9].troops]);
  // 出どころを先に取れば、攻めは起きない
  s = G({ clan: 0 }); const fox = s.clans.find((c) => c.key === 'fox');
  for (const c of s.clans) c.intents = [];
  set(s, 6, fox.id, 3, { castle: 0 }); set(s, 3, fox.id, 9); home(s).troops = 12;
  fox.intents = [{ t: 'march', from: 6, to: 9, sent: 2 }];
  C.order(s, { t: 'march', from: 9, to: 6, sent: 11 }); C.endTurn(s);
  ok('出どころの国を先に取れば、その攻めは取りやめになる', s.provs[6].owner === s.player && s.log.some((l) => l.text.includes('取りやめ')), s.log.slice(-4).map((l) => l.text));
  ok('相手は番のあと、次の予定を出し直す', s.clans.filter((c) => c.id !== s.player && c.alive).every((c) => Array.isArray(c.intents)));
}
{
  // 最初の 1 年は本拠を攻められない(自分も相手も)
  const s = quiet(G({ clan: 1 })); const a = s.clans.find((c) => c.id !== s.player);
  set(s, 6, a.id, 9, { castle: 0 }); s.clans[a.id].home = 6; home(s).troops = 30;
  ok('最初の 1 年は、ほかの家の本拠を攻められない', C.whyNot(s, s.player, { t: 'march', from: 9, to: 6, sent: 20 }) !== null);
  s.turn = C.TRUCE_TURNS + 1; ok('2 年目からは攻められる', C.whyNot(s, s.player, { t: 'march', from: 9, to: 6, sent: 20 }) === null);
  let early = 0;
  for (let seed = 1; seed <= 120; seed++) { const g = C.newGame({ seed, clan: seed % 4, difficulty: 'hard' }); while (g.phase !== 'over' && g.turn <= C.TRUCE_TURNS) { if (g.event) C.answerEvent(g, 'A'); else C.endTurn(g); } if (g.phase === 'over') early++; }
  ok('何もしなくても、最初の 1 年のうちに負けることはない(120 回・むずかしい)', early === 0, early);
}
// ---- 決着・包囲網 ------------------------------------------------------------
{
  let s = quiet(G({ clan: 1 }));
  for (const id of [9, 6, 10, 7, 3, 4]) set(s, id, s.player, 3);
  set(s, 0, -1, 1, { castle: 0 }); s.provs[3].troops = 8; C.order(s, { t: 'march', from: 3, to: 0, sent: 7 });
  ok(C.WIN_PROVS + ' 国を取った瞬間に勝ち(ターンの途中でも)', s.phase === 'over' && s.winner === s.player && s.ordersLeft === 2, [s.phase, s.winner]);
  s = quiet(G({ clan: 1 })); const a = s.clans.find((c) => c.id !== s.player);
  set(s, 6, a.id, 1, { castle: 0 }); s.provs[a.home].owner = -1; home(s).troops = 8; C.order(s, { t: 'march', from: 9, to: 6, sent: 7 });
  ok('最後の国を取るとその家はほろび、看板の家臣が加わる', a.alive === false && me(s).officers.includes(C.CLANS[a.id].officer), me(s).officers);
  s = quiet(G({ clan: 1 })); for (const id of [9, 6, 10, 7, 3]) set(s, id, s.player, 3); C.endTurn(s);
  ok('5 国の単独首位には包囲網が組まれ、仲が毎ターン悪くなる', s.coalition === s.player && s.clans.filter((c) => c.id !== s.player).every((c) => c.rel === -1), s.coalition);
  ok('包囲網のあいだは約束を結べない', (() => { const o = s.clans.find((c) => c.id !== s.player); o.rel = 5; s.clans[s.player].rice = 9; return C.whyNot(s, s.player, { t: 'pact', clan: o.id }) !== null; })());
  s = quiet(G({ clan: 1 })); s.turn = C.MAX_TURNS; set(s, 6, s.player, 1); C.endTurn(s);
  ok('6 年が過ぎたら、いちばん多くの国を持つ家の勝ち', s.phase === 'over' && s.winner === s.player && s.endReason.includes('6 つの月'), [s.winner, s.endReason]);
  s = quiet(G({ clan: 1 })); s.turn = 5; const e = s.clans.find((c) => c.id !== s.player); set(s, 9, e.id, 5);
  C.endTurn(s); ok('自分の国がなくなったら負け', s.phase === 'over' && s.winner !== s.player);
}
// ---- 出来事 ------------------------------------------------------------------
{
  ok('出来事は 14 種', C.EVENT_KEYS.length === 14, C.EVENT_KEYS.length);
  let bad = 0;
  for (const key of C.EVENT_KEYS) for (const ch of ['A', 'B']) for (const rice of [0, 10]) {
    const s = quiet(G({ clan: 1 })); me(s).rice = rice;
    const E = C.EVENTS[key], data = E.setup ? E.setup(s) : {};
    s.event = Object.assign({ key, title: E.title, text: typeof E.text === 'function' ? E.text(s, data) : E.text, a: E.a, b: E.b }, data);
    const text = C.answerEvent(s, ch);
    if (typeof text !== 'string' || !text.length || s.event !== null || me(s).rice < 0 || me(s).officers.length > C.MAX_OFFICERS) bad++;
    for (const p of s.provs) if (p.koku > 6 || p.koku < 1 || p.castle < 0 || p.castle > 2 || p.troops < 0) bad++;
    for (const c of s.clans) if (c.rel > 5 || c.rel < -5) bad++;
  }
  ok('全部の出来事が、どちらを選んでも言葉で結果を返し、数字がおかしくならない(米 0 でも)', bad === 0, bad);
  const s = quiet(G({ clan: 1 })); C.endTurn(s); C.endTurn(s);
  ok('2 ターンに 1 回、出来事が起きる', s.turn === 3 && s.event !== null && typeof s.event.title === 'string', s.event);
  ok('出来事に答えるまで、命令は出せず、番も終えられない', C.order(s, { t: 'recruit', at: 9 }) === false && C.endTurn(s) === false);
  C.answerEvent(s, 'A'); ok('答えると先へ進める', s.event === null && C.endTurn(s) === true);
  const seen = []; const g = quiet(G({ clan: 1, seed: 3 }));
  for (let i = 0; i < 22 && g.phase !== 'over'; i++) { if (g.event) { seen.push(g.event.key); C.answerEvent(g, 'B'); } for (const c of g.clans) c.intents = []; C.endTurn(g); }
  ok('1 回の遊びの中で、同じ出来事はくり返さない', new Set(seen).size === seen.length && seen.length >= 5, seen);
}
// ---- 家臣の進言 --------------------------------------------------------------
{
  const s = G({ clan: 1 }); const adv = C.advice(s, 3);
  ok('進言は 3 つまで、どれも実際に出せる命令で、理由つき', adv.length >= 1 && adv.length <= 3 && adv.every((r) => C.whyNot(s, s.player, r.o) === null && typeof r.why === 'string' && r.why.length > 0), adv);
  const t = G({ clan: 1 }); const bear = t.clans.find((c) => c.key === 'bear'); set(t, 6, bear.id, 9, { castle: 0 }); home(t).troops = 2; me(t).rice = 8;
  ok('攻められそうなときは、守りを一番にすすめる', ['recruit', 'fortify'].includes(C.advice(t, 1)[0].o.t), C.advice(t, 1)[0]);
}
// ---- 通しで遊ぶ: 必ず終わる・数字がおかしくならない・保存して続けても同じ ----
function autoPlay(seed, clan, diff, random) {
  const s = C.newGame({ seed, clan, difficulty: diff });
  let x = seed * 2654435761 >>> 0; const rnd = () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 4294967296; };
  let guard = 0, bad = 0;
  while (s.phase !== 'over' && guard++ < 600) {
    if (s.event) { C.answerEvent(s, rnd() < 0.5 ? 'A' : 'B'); continue; }
    const adv = s.ordersLeft > 0 ? C.advice(s, 3) : [];
    if (adv.length && (!random || rnd() < 0.8)) C.order(s, adv[random ? Math.floor(rnd() * adv.length) : 0].o); else C.endTurn(s);
    for (const p of s.provs) if (p.troops < 0 || (p.owner >= 0 && p.troops < 1) || p.koku < 1 || p.koku > 6 || p.castle < 0 || p.castle > 2) bad++;
    for (const c of s.clans) if (c.rice < 0 || c.officers.length > C.MAX_OFFICERS || new Set(c.officers).size !== c.officers.length || c.rel > 5 || c.rel < -5) bad++;
  }
  return { s, bad };
}
{
  let stuck = 0, bad = 0, over24 = 0;
  for (let seed = 1; seed <= 300; seed++) { const r = autoPlay(seed, seed % 4, ['easy', 'normal', 'hard'][seed % 3], true); if (r.s.phase !== 'over') stuck++; bad += r.bad; if (r.s.turn > C.MAX_TURNS) over24++; }
  ok('300 回、適当に遊んでも必ず決着がつく(' + C.MAX_TURNS + ' ターン以内)', stuck === 0 && over24 === 0, [stuck, over24]);
  ok('300 回のあいだ、兵・米・石高・城・家臣の数がおかしくならない', bad === 0, bad);
  const a = autoPlay(11, 2, 'normal').s;
  const b = C.newGame({ seed: 11, clan: 2, difficulty: 'normal' }); let saved = null, guard = 0;
  while (b.phase !== 'over' && guard++ < 600) { // 途中で何度も保存→読み直しをはさむ
    let g = saved ? JSON.parse(saved) : b; if (saved) Object.assign(b, g);
    if (b.event) C.answerEvent(b, 'A'); else { const adv = b.ordersLeft > 0 ? C.advice(b, 3) : []; if (adv.length) C.order(b, adv[0].o); else C.endTurn(b); }
    saved = JSON.stringify(b);
  }
  const a2 = C.newGame({ seed: 11, clan: 2, difficulty: 'normal' }); guard = 0;
  while (a2.phase !== 'over' && guard++ < 600) { if (a2.event) C.answerEvent(a2, 'A'); else { const adv = a2.ordersLeft > 0 ? C.advice(a2, 3) : []; if (adv.length) C.order(a2, adv[0].o); else C.endTurn(a2); } }
  ok('途中で保存して読み直しても、結果は同じ', JSON.stringify(b) === JSON.stringify(a2) && a.phase === 'over');
}
// ---- 夜語り(物語が書き進む仕組み) ------------------------------------------
{
  const okScene = (sc) => typeof sc.id === 'string' && typeof sc.title === 'string' && sc.title.length > 0 && Array.isArray(sc.lines) && sc.lines.length >= 2 && sc.lines.every((l) => typeof l === 'string' && l.length > 0);
  const pro = [0, 1, 2, 3].map((c) => S.storyDue(G({ clan: c }))[0]);
  ok('始まりの語りは、選んだ家ごとに違う', pro.every(okScene) && new Set(pro.map((p) => p.lines[0])).size === 4, pro.map((p) => p.title));
  const s = quiet(G({ clan: 1 }));
  ok('同じ場面を二度語らない', S.storyDue(s).length === 1 && S.storyDue(s).length === 0);
  s.turn = 5; const ch = S.storyDue(s);
  ok('月が変わると、その月の語りが入る', ch.length === 1 && ch[0].id === 'ch5' && okScene(ch[0]), ch.map((c) => c.id));
  // 優勢か、押されているかで文が変わる
  const lead = quiet(G({ clan: 1 })); lead.story.seen.push('prologue'); lead.turn = 5; for (const id of [6, 10, 7]) set(lead, id, lead.player, 3);
  const behind = quiet(G({ clan: 1 })); behind.story.seen.push('prologue'); behind.turn = 5; const r = behind.clans.find((c) => c.id !== behind.player); for (const id of [6, 10, 7, 3]) set(behind, id, r.id, 3);
  ok('同じ月の語りでも、優勢のときと押されているときで文が変わる', S.storyDue(lead)[0].lines.join('') !== S.storyDue(behind)[0].lines.join(''));
  // 出来事に応じた場面
  const trig = (fn) => { const g = quiet(G({ clan: 1 })); g.story.seen.push('prologue'); fn(g); return S.storyDue(g).map((x) => x.id); };
  ok('約束を結ぶと「結んだ髪」', trig((g) => { g.stats.pactsMade = 1; }).includes('pact'));
  ok('約束を破ると「ほどいた髪」', trig((g) => { g.stats.pactsBroken = 1; }).includes('betrayal'));
  ok('里を取ると「はじめての灯」、取られると「消えた灯」', trig((g) => { g.stats.provsTaken = 1; }).includes('firstTake') && trig((g) => { g.stats.provsLost = 1; }).includes('firstLoss'));
  ok('ふる社を取ると語りが入る', trig((g) => set(g, C.CAPITAL, g.player, 3)).includes('shrine'));
  ok('自分に百鬼夜行が向くと語りが入る', trig((g) => { g.coalition = g.player; }).includes('hyakkiMe'));
  ok('相手があと 1 つで夜の主になると語りが入る', trig((g) => { const o = g.clans.find((c) => c.id !== g.player); for (const p of g.provs) { if (C.countOf(g, o.id) >= C.WIN_PROVS - 1) break; if (p.owner !== o.id && p.owner !== g.player) set(g, p.id, o.id, 2); } }).includes('danger'));
  ok('1 度に語るのは 2 つまで', trig((g) => { g.stats.pactsMade = 1; g.stats.pactsBroken = 1; g.stats.provsTaken = 1; g.stats.provsLost = 1; g.coalition = g.player; }).length === 2);
  // 結末 5 つ
  const end = (fn) => { const g = quiet(G({ clan: 1 })); g.phase = 'over'; g.winner = g.player; fn(g); return S.ending(g); };
  const ids = [end((g) => { g.stats.pactsMade = 1; }), end((g) => { g.stats.pactsMade = 1; g.stats.pactsBroken = 1; }), end(() => {}),
               end((g) => { g.winner = (g.player + 1) % 4; g.clans[g.player].alive = false; }), end((g) => { g.winner = (g.player + 1) % 4; })];
  ok('結末は 5 つ: 約束を守って勝つ / 破って勝つ / 約束なしで勝つ / のまれる / よその家が主になる', ids.map((e) => e.id).join() === 'dawn,cursed,lord,swallowed,endless' && ids.every(okScene), ids.map((e) => e.id));
  ok('決着したあとは、途中の語りを出さない', (() => { const g = quiet(G({ clan: 1 })); g.phase = 'over'; return S.storyDue(g).length === 0; })());
  // 通しで遊んで、語りがくり返されず、壊れた文がなく、保存しても続きから語れる
  let bad = 0, total = 0; const seenIds = new Set(), endIds = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    let g = C.newGame({ seed, clan: seed % 4, difficulty: ['easy', 'normal', 'hard'][seed % 3] }), guard = 0; const mineIds = [];
    while (g.phase !== 'over' && guard++ < 600) {
      for (const sc of S.storyDue(g)) { if (!okScene(sc) || mineIds.includes(sc.id)) bad++; mineIds.push(sc.id); seenIds.add(sc.id); total++; }
      if (seed % 7 === 0) g = JSON.parse(JSON.stringify(g)); // 保存して読み直す
      if (g.event) { C.answerEvent(g, seed % 2 ? 'A' : 'B'); continue; }
      const adv = g.ordersLeft > 0 ? C.advice(g, 3) : [];
      if (adv.length) C.order(g, adv[(seed + g.turn) % adv.length].o); else C.endTurn(g);
    }
    const e = S.ending(g); if (!okScene(e)) bad++; endIds.add(e.id);
  }
  ok('200 回遊んでも、語りがくり返されず、壊れた文がない(保存をはさんでも)', bad === 0, bad);
  ok('200 回のうちに、用意した場面のほとんどが実際に語られる', seenIds.size >= 14 && endIds.size >= 3, { scenes: [...seenIds].length, endings: [...endIds], perGame: +(total / 200).toFixed(1) });
  ok('場面の数: 始まり 4・月の語り 5・出来事の場面 11・結末 5', S.STORY_COUNTS.prologues === 4 && S.STORY_COUNTS.chapters === 5 && S.STORY_COUNTS.triggers === 11 && S.STORY_COUNTS.endings === 5, S.STORY_COUNTS);
}
if (process.argv.includes('--mutate')) {
  const before = fail;
  const s = quiet(G({ clan: 1 })); set(s, 6, -1, 4, { castle: 0 }); home(s).troops = 9;
  ok('【わざと間違い】同じ力でも勝てる', C.forecast(s, 9, 6, 4).win === true);
  ok('【わざと間違い】命令は 4 つ出せる', (() => { const g = quiet(G({ clan: 1 })); g.clans[g.player].rice = 99; let n = 0; for (let i = 0; i < 4; i++) if (C.order(g, { t: 'recruit', at: 9 })) n++; return n === 4; })());
  ok('【わざと間違い】種が違っても同じ盤面', JSON.stringify(G()) === JSON.stringify(G({ seed: 99 })));
  const caught = fail - before; fail = before; failures.splice(failures.length - caught, caught);
  console.log(`自己検査: わざと間違えた 3 件中 ${caught} 件を検出`);
  if (caught !== 3) process.exitCode = 1;
}
console.log(`\n${pass} 件合格 / ${fail} 件不合格`);
for (const f of failures) console.log('  不合格: ' + f);
if (fail) process.exitCode = 1;
