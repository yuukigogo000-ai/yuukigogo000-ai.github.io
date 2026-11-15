/*
 * けもの天下 — ルール(描画なし・依存なし)。題材は和風の怪談: 明けない夜の山里を、四つの怪の家が取り合う
 *
 * 12 の里を 4 つのけもの家が取り合う。調査(reports/戦略ゲーム先行事例リサーチ.md)から決めた骨格:
 *  - 命令は 1 夜に 3 つだけ。領土が増えても手間は増えない
 *  - 敵の家は、次に何をするかを先に見せる(予告)。予告どおりに動く
 *  - 7 里を取った家がその場で夜の主。勝ちが見えてからの消化試合を作らない
 *  - 一番大きい家には百鬼夜行が組まれる(隠れた補正ではなく、見えるルール)
 *  - あらそいは自動で、結果は出す前に分かる(運なし)
 *
 * 盤面は全部 JSON にできる素のデータ。乱数は盤面の中の種だけを使う。同じ種・同じ手なら同じ結果になる。
 */

export const WIN_PROVS = 7;        // この数の里を持った家が夜の主
export const MAX_TURNS = 24;       // 6 つの月 × 4 夜(新月・上弦・満月・下弦)
export const ORDERS_PER_TURN = 3;
export const COALITION_AT = 5;     // この数の里を持つ単独首位に、百鬼夜行が組まれる
export const TRUCE_TURNS = 4;      // 最初のひと月は、どの家も、ほかの家のほこらを攻められない
const CASTLE_MUL = [1, 1.3, 1.6];
export const SEASONS = ['新月', '上弦', '満月', '下弦'];

/** 里(3 列 × 4 段)。koku = 灯の数(毎夜の灯)。まんなかの「ふる社」は社 */
const PROV_DEFS = [
  ['くびれ峠', 0, 0, 3], ['なき沢', 1, 0, 2], ['あかずの坂', 2, 0, 3],
  ['ささやき森', 0, 1, 2], ['ふる社', 1, 1, 4], ['さかさ川', 2, 1, 2],
  ['かげふみ原', 0, 2, 2], ['ひとだま谷', 1, 2, 3], ['つきなし野', 2, 2, 2],
  ['そこなし沼', 0, 3, 3], ['かごめ竹', 1, 3, 2], ['よびこ浜', 2, 3, 3],
];
export const CAPITAL = 4;
const HOMES = [9, 2, 0, 11]; // 4 すみ

/** 憑きもの。家ごとに 1 人の看板憑きものがいて、ほかは出来事や里取りで増える(4 人まで) */
export const OFFICERS = {
  gonta:  { ja: '首なし武者ゴンタ',     text: '攻めるとき勢い +20%' },
  don:    { ja: '塗り壁のドン',     text: '守るとき勢い +20%' },
  kon:    { ja: '口寄せのコン',   text: '供え物の効きめ +1' },
  pyon:   { ja: '手招きのピョン',   text: '呼び寄せで集まるもののけ +1' },
  tama:   { ja: '火の玉タマ',   text: '灯入れの費用 -1' },
  mogu:   { ja: '墓守のモグ',     text: '結界張りの費用 -1' },
  risu:   { ja: '霞食いのリス',   text: 'もののけの維持費が半分' },
  hayate: { ja: '送り狼ハヤテ',   text: '攻め取った里が、すぐに灯を生む' },
  kura:   { ja: '倉ぼっこのクラ',     text: '毎夜 灯 +1' },
  kage:   { ja: '影法師のカゲ',     text: '攻めるとき、相手の結界の守りを無視する' },
  uta:    { ja: '子守唄のウタ',   text: '祟らぬ約束が 2 夜長く続く' },
  miko:   { ja: '巫女のミコ',     text: '新月のたび、ほこらにもののけ +1' },
};
export const OFFICER_KEYS = Object.keys(OFFICERS);
export const MAX_OFFICERS = 4;

/** 4 つの家。persona は相手にしたときの性格(固定で、画面にも見せる) */
export const CLANS = [
  { key: 'bear',   ja: '鬼熊家',   officer: 'gonta', persona: '猛進', personaText: '勝てそうならすぐ攻める。予告した攻めは必ずやる' },
  { key: 'turtle', ja: '沼主家',   officer: 'don',   persona: '堅守', personaText: '里を育てて守りを固める。勝ち目のない攻めは取りやめる' },
  { key: 'fox',    ja: '妖狐家', officer: 'kon',   persona: '機をみる', personaText: '弱った相手をねらう。仲のよい相手は攻めにくい' },
  { key: 'rabbit', ja: '白兎家', officer: 'pyon',  persona: '数でおす', personaText: 'もののけをどんどん集め、持ち主のいない里へ広がる' },
];
// 性格ごとの重み: margin = 攻めに必要な余裕、eco = 灯入れ好き、def = 守り重視、neutral = 持ち主なしの里が好き、commit = 予告した攻めを必ずやるか
const PERSONA = {
  bear:   { margin: 1.0,  eco: 0.5, def: 0.6, neutral: 0, commit: true },
  turtle: { margin: 1.4,  eco: 1.6, def: 1.5, neutral: 0, commit: false },
  fox:    { margin: 1.2,  eco: 1.0, def: 1.0, neutral: 1, commit: false },
  rabbit: { margin: 1.1,  eco: 0.7, def: 0.8, neutral: 4, commit: true },
};
export const DIFFICULTY = {
  // aiOrders = 予告つきの命令の数、aiReact = その場で決める守り・里づくりの命令の数(攻めは必ず予告される)
  easy:   { ja: 'やさしい',   incomeMul: 1.0, aiOrders: 2, aiReact: 0, text: '相手の家は、命令を 2 つしか出さない' },
  normal: { ja: 'ふつう',     incomeMul: 1.0, aiOrders: 2, aiReact: 1, text: '相手もあなたと同じく、命令を 3 つ出す' },
  hard:   { ja: 'むずかしい', incomeMul: 1.2, aiOrders: 3, aiReact: 1, text: '相手の家は命令を 4 つ出し、灯の実りも 2 割多い' },
};

export const COST = { recruit: 1, develop: 4, fortify: 3, gift: 2, pact: 2 }; // 呼び寄せはもののけ 1 つにつき灯 1(1 回の命令で 6 まで)
export const RECRUIT_MAX = 4;
/** 呼び寄せ 1 回で集まるもののけの数(灯が足りなければ、ある分だけ) */
export const recruitSize = (rice) => Math.max(0, Math.min(RECRUIT_MAX, rice));

// ---- 乱数(盤面の中に種を持つ) -------------------------------------------------
function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, n) => Math.floor(rand(s) * n);

// ---- 生成 --------------------------------------------------------------------
/** opts: { seed, clan(自分の家の番号 0〜3), difficulty } */
export function newGame(opts) {
  const o = opts || {};
  const s = {
    seed: (o.seed || 1) >>> 0, rng: ((o.seed || 1) ^ 0x51ed270b) | 0,
    turn: 1, phase: 'orders', ordersLeft: ORDERS_PER_TURN, difficulty: o.difficulty || 'normal',
    player: o.clan === undefined ? 0 : o.clan, winner: -1, endReason: '', coalition: -1,
    provs: [], clans: [], log: [], event: null, eventsSeen: [],
    stats: { battlesWon: 0, battlesLost: 0, provsTaken: 0, provsLost: 0, peak: 1, pactsMade: 0, pactsBroken: 0, wiped: 0 },
    story: { seen: [] }, // 夜語り(物語)で、もう語った場面
  };
  PROV_DEFS.forEach((d, i) => {
    const adj = [];
    PROV_DEFS.forEach((e, j) => { if (i !== j && Math.abs(d[1] - e[1]) + Math.abs(d[2] - e[2]) === 1) adj.push(j); });
    // 持ち主のいない里は、種によって守りのもののけと灯の数が少し変わる
    s.provs.push({ id: i, name: d[0], x: d[1], y: d[2], adj, koku: d[3] + (i === CAPITAL ? 0 : pick(s, 2)), castle: i === CAPITAL ? 2 : pick(s, 2), owner: -1,
                   troops: i === CAPITAL ? 12 : 5 + pick(s, 4), unrest: 0, tired: 0 });
  });
  // 自分は左下から。相手 3 家の並びは種で変わる
  const order = [s.player].concat([0, 1, 2, 3].filter((c) => c !== s.player));
  for (let i = order.length - 1; i > 1; i--) { const j = 1 + pick(s, i); const t = order[i]; order[i] = order[j]; order[j] = t; }
  CLANS.forEach((c, i) => s.clans.push({ id: i, key: c.key, name: c.ja, rice: 5, alive: true, home: -1, officers: [c.officer], rel: 0, pact: 0, intents: [] }));
  order.forEach((c, k) => {
    const p = s.provs[HOMES[k]];
    p.owner = c; p.troops = 6; p.castle = 1; p.koku = 3; p.tired = 0;
    s.clans[c].home = p.id;
  });
  for (const c of s.clans) if (c.id !== s.player) c.intents = planIntents(s, c);
  say(s, '夜が明けなくなって、最初の新月。' + WIN_PROVS + ' つの里を取った家が、夜の主になります');
  return s;
}

export function cloneState(s) {
  return Object.assign({}, s, {
    provs: s.provs.map((p) => Object.assign({}, p)),
    clans: s.clans.map((c) => Object.assign({}, c, { officers: c.officers.slice(), intents: c.intents.map((i) => Object.assign({}, i)) })),
    log: s.log.slice(), eventsSeen: s.eventsSeen.slice(), stats: Object.assign({}, s.stats), story: { seen: s.story.seen.slice() },
    event: s.event ? JSON.parse(JSON.stringify(s.event)) : null,
  });
}

// ---- 小道具 ------------------------------------------------------------------
function say(s, text, kind) { s.log.push({ turn: s.turn, text, kind: kind || 'info' }); if (s.log.length > 60) s.log.shift(); }
const has = (s, clan, officer) => clan >= 0 && s.clans[clan].officers.indexOf(officer) >= 0;
export const provsOf = (s, clan) => s.provs.filter((p) => p.owner === clan);
export const countOf = (s, clan) => provsOf(s, clan).length;
export const ownerName = (s, owner) => (owner < 0 ? 'はぐれ怪' : s.clans[owner].name);
export const yearOf = (turn) => Math.floor((turn - 1) / 4) + 1;
export const seasonOf = (turn) => SEASONS[(turn - 1) % 4];

export function costOf(s, clan, kind) {
  let c = COST[kind];
  if (kind === 'develop' && has(s, clan, 'tama')) c -= 1;
  if (kind === 'fortify' && has(s, clan, 'mogu')) c -= 1;
  return c;
}

/** 1 夜の灯の出入り(実りと、もののけの維持費) */
export function incomeOf(s, clan) {
  let gain = 0, troops = 0;
  for (const p of s.provs) if (p.owner === clan) { if (!p.unrest) gain += p.koku + (p.id === CAPITAL ? 2 : 0); troops += p.troops; }
  if (has(s, clan, 'kura')) gain += 1;
  if (clan !== s.player) gain = Math.round(gain * DIFFICULTY[s.difficulty].incomeMul);
  const upkeep = Math.floor(troops / (has(s, clan, 'risu') ? 8 : 4)); // もののけ 4 つにつき灯 1
  return { gain, upkeep, net: gain - upkeep };
}

// ---- あらそい(運なし。出す前に結果が分かる) -------------------------------------
/** from の里から to の里へ sent のもののけで攻めたときの見こみ */
export function forecast(s, fromId, toId, sent) {
  const a = s.provs[fromId], d = s.provs[toId];
  const atkMul = has(s, a.owner, 'gonta') ? 1.2 : 1;
  const wall = has(s, a.owner, 'kage') ? 1 : CASTLE_MUL[d.castle];
  const defMul = wall * (has(s, d.owner, 'don') ? 1.2 : 1);
  const atk = sent * atkMul, def = d.troops * defMul;
  if (atk > def) {
    const loss = Math.min(sent - 1, Math.ceil(def * 0.8 / atkMul));
    return { win: true, atk, def, attackerLeft: sent - loss, attackerLoss: loss, defenderLoss: d.troops };
  }
  const loss = Math.ceil(sent * 0.6);
  return { win: false, atk, def, attackerLeft: sent - loss, attackerLoss: loss, defenderLoss: Math.min(Math.max(0, d.troops - 1), Math.floor(atk * 0.5 / defMul)) };
}

function gainOfficer(s, clan, key) {
  const c = s.clans[clan];
  if (!key || c.officers.indexOf(key) >= 0 || c.officers.length >= MAX_OFFICERS) return false;
  c.officers.push(key);
  if (clan === s.player) say(s, OFFICERS[key].ja + ' が憑きものに加わった(' + OFFICERS[key].text + ')', 'good');
  return true;
}

function eliminate(s, loser, by) {
  const c = s.clans[loser];
  c.alive = false; c.intents = [];
  say(s, c.name + ' が夜にのまれて消えた', loser === s.player ? 'bad' : 'big');
  if (by === s.player) s.stats.wiped++;
  if (by >= 0) gainOfficer(s, by, CLANS[loser].officer);
}

/** もののけを動かす(自分の里へ)か、攻める(よその里へ)。返り値: 結果の説明 */
function march(s, clan, fromId, toId, sent) {
  const a = s.provs[fromId], d = s.provs[toId];
  if (d.owner === clan) { a.troops -= sent; d.troops += sent; return { moved: true }; }
  const f = forecast(s, fromId, toId, sent), defender = d.owner;
  const who = s.clans[clan].name, where = d.name + '(' + ownerName(s, defender) + ')';
  if (defender >= 0 && defender !== s.player && clan === s.player) { // 自分が攻めた相手との仲が悪くなる。約束があれば破ったことになる
    const dc = s.clans[defender];
    if (dc.pact > 0) { dc.pact = 0; for (const o of s.clans) if (o.id !== s.player) o.rel = Math.max(-5, o.rel - 3); say(s, '祟らぬ約束を破った。どの家からも信用を失った', 'bad'); s.stats.pactsBroken++; }
    dc.rel = Math.max(-5, dc.rel - 3);
  }
  if (f.win) {
    a.troops -= sent;
    d.owner = clan; d.troops = f.attackerLeft; d.castle = Math.max(0, d.castle - 1); d.unrest = has(s, clan, 'hayate') ? 0 : 1; d.tired = 1;
    say(s, who + ' が ' + where + ' を攻め取った(残ったもののけ ' + f.attackerLeft + ')', clan === s.player ? 'good' : defender === s.player ? 'bad' : 'info');
    if (clan === s.player) { s.stats.battlesWon++; s.stats.provsTaken++; } else if (defender === s.player) { s.stats.battlesLost++; s.stats.provsLost++; }
    if (defender >= 0 && countOf(s, defender) === 0) eliminate(s, defender, clan);
  } else {
    a.troops -= f.attackerLoss; d.troops -= f.defenderLoss;
    say(s, who + ' が ' + where + ' を攻めたが、はね返された(失ったもののけ ' + f.attackerLoss + ')', clan === s.player ? 'bad' : defender === s.player ? 'good' : 'info');
    if (clan === s.player) s.stats.battlesLost++; else if (defender === s.player) s.stats.battlesWon++;
  }
  return f;
}

// ---- 命令(自分も相手も同じ決まりで動く) ---------------------------------------
/**
 * 命令が出せるか調べる。出せなければ理由を返す(null なら出せる)。
 * order: { t: 'march', from, to, sent } | { t: 'recruit' | 'develop' | 'fortify', at } | { t: 'gift' | 'pact', clan }
 */
export function whyNot(s, clan, order) {
  const c = s.clans[clan];
  if (!c.alive) return 'この家はもうありません';
  if (order.t === 'march') {
    const a = s.provs[order.from], d = s.provs[order.to];
    if (!a || !d || a.owner !== clan) return '自分の里から出します';
    if (a.adj.indexOf(d.id) < 0) return 'となりの里にしか出せません';
    if (!(order.sent >= 1) || order.sent > a.troops - 1) return '里にはもののけを 1 つ残します';
    if (a.tired) return '攻め取ったばかりの里からは、この夜は出せません';
    if (s.turn <= TRUCE_TURNS && d.owner >= 0 && d.owner !== clan && s.clans[d.owner].home === d.id) return '最初のひと月は、ほかの家のほこらを攻められません';
    return null;
  }
  if (order.t === 'recruit' || order.t === 'develop' || order.t === 'fortify') {
    const p = s.provs[order.at];
    if (!p || p.owner !== clan) return '自分の里にしか出せません';
    if (order.t === 'develop' && p.koku >= 6) return 'この里はもう十分に育っています';
    if (order.t === 'fortify' && p.castle >= 2) return 'この結界はもう十分に強いです';
    if (c.rice < costOf(s, clan, order.t)) return '灯が足りません(' + costOf(s, clan, order.t) + ' 必要)';
    return null;
  }
  if (order.t === 'gift' || order.t === 'pact') {
    const o = s.clans[order.clan];
    if (clan !== s.player || !o || o.id === clan || !o.alive) return '相手がいません';
    if (c.rice < COST[order.t]) return '灯が足りません(' + COST[order.t] + ' 必要)';
    if (order.t === 'gift' && o.rel >= 5) return 'これ以上は仲よくなれません';
    if (order.t === 'pact') {
      if (o.pact > 0) return 'すでに約束があります';
      if (s.coalition === s.player) return '百鬼夜行のあいだは、約束を結べません';
      if (o.rel < 2) return '仲が +2 以上になると結べます(いま ' + (o.rel > 0 ? '+' : '') + o.rel + ')';
    }
    return null;
  }
  return '知らない命令です';
}

function apply(s, clan, order) {
  const c = s.clans[clan];
  if (order.t === 'march') return march(s, clan, order.from, order.to, order.sent);
  if (order.t === 'recruit') {
    const paid = recruitSize(c.rice), n = paid + (has(s, clan, 'pyon') ? 1 : 0);
    c.rice -= paid; s.provs[order.at].troops += n;
    if (clan === s.player) say(s, s.provs[order.at].name + ' でもののけを ' + n + ' 集めた');
  } else if (order.t === 'develop') {
    c.rice -= costOf(s, clan, 'develop'); s.provs[order.at].koku += 1;
    if (clan === s.player) say(s, s.provs[order.at].name + ' を灯入れした(灯の数 ' + s.provs[order.at].koku + ')');
  } else if (order.t === 'fortify') {
    c.rice -= costOf(s, clan, 'fortify'); s.provs[order.at].castle += 1;
    if (clan === s.player) say(s, s.provs[order.at].name + ' の結界を張った');
  } else if (order.t === 'gift') {
    const o = s.clans[order.clan];
    c.rice -= COST.gift; o.rel = Math.min(5, o.rel + 2 + (has(s, clan, 'kon') ? 1 : 0));
    say(s, o.name + ' に供え物をした(仲 ' + (o.rel > 0 ? '+' : '') + o.rel + ')');
  } else if (order.t === 'pact') {
    const o = s.clans[order.clan];
    c.rice -= COST.pact; o.pact = 4 + (has(s, clan, 'uta') ? 2 : 0);
    o.intents = o.intents.filter((i) => !(i.t === 'march' && s.provs[i.to].owner === s.player)); // 約束したので、こちらへの攻めは取りやめる
    s.stats.pactsMade++;
    say(s, o.name + ' と祟らぬ約束を結んだ(' + o.pact + ' 夜)', 'good');
  }
  return {};
}

/** 自分の命令を 1 つ出す。出せなければ false */
export function order(s, o) {
  if (s.phase !== 'orders' || s.ordersLeft <= 0 || s.event) return false;
  if (whyNot(s, s.player, o)) return false;
  apply(s, s.player, o);
  s.ordersLeft -= 1;
  checkEnd(s);
  return true;
}

// ---- 百鬼夜行・決着 ------------------------------------------------------------
function updateCoalition(s) {
  let lead = -1, best = 0, tie = false;
  for (const c of s.clans) { if (!c.alive) continue; const n = countOf(s, c.id); if (n > best) { best = n; lead = c.id; tie = false; } else if (n === best) tie = true; }
  const next = best >= COALITION_AT && !tie ? lead : -1;
  if (next !== s.coalition) {
    if (next >= 0) say(s, s.clans[next].name + ' が大きくなりすぎた。ほかの家が百鬼夜行を組んだ', next === s.player ? 'bad' : 'big');
    else if (s.coalition >= 0) say(s, '百鬼夜行がとけた');
    s.coalition = next;
  }
}

function finish(s, winner, reason) {
  s.phase = 'over'; s.winner = winner; s.endReason = reason; s.event = null;
  say(s, s.clans[winner].name + ' が夜の主になった(' + reason + ')', winner === s.player ? 'good' : 'bad');
}

function checkEnd(s) {
  if (s.phase === 'over') return true;
  s.stats.peak = Math.max(s.stats.peak, countOf(s, s.player));
  for (const c of s.clans) if (c.alive && countOf(s, c.id) === 0) eliminate(s, c.id, -1); // 里がなくなった家はほろびる(出来事などで失った場合も)
  for (const c of s.clans) if (c.alive && countOf(s, c.id) >= WIN_PROVS) { finish(s, c.id, WIN_PROVS + ' 里を手にした'); return true; }
  if (!s.clans[s.player].alive) { // 自分がほろびた: いちばん大きい家の天下
    let w = -1, best = -1;
    for (const c of s.clans) if (c.alive && countOf(s, c.id) > best) { best = countOf(s, c.id); w = c.id; }
    finish(s, w, 'あなたの家は夜にのまれた');
    return true;
  }
  const alive = s.clans.filter((c) => c.alive);
  if (alive.length === 1) { finish(s, alive[0].id, 'ほかの家がすべて消えた'); return true; }
  return false;
}

function finishByTime(s) {
  // 6 年が過ぎた: 里の数、同じなら灯の数の合計、それも同じならもののけの数で決める
  let w = -1, key = null;
  for (const c of s.clans) {
    if (!c.alive) continue;
    const ps = provsOf(s, c.id), k = [ps.length, ps.reduce((t, p) => t + p.koku, 0), ps.reduce((t, p) => t + p.troops, 0)];
    if (key === null || k[0] > key[0] || (k[0] === key[0] && (k[1] > key[1] || (k[1] === key[1] && k[2] > key[2])))) { key = k; w = c.id; }
  }
  finish(s, w, '6 つの月がすぎ、いちばん多くの里を持っていた');
}

// ---- 相手の家の考え方 ----------------------------------------------------------
function threatTo(s, p, clan) { // となりの、よその家のもののけでいちばん多いもの
  let t = 0;
  for (const j of p.adj) { const q = s.provs[j]; if (q.owner >= 0 && q.owner !== clan && q.troops - 1 > t) { if (q.owner !== s.player && clan === s.player && s.clans[q.owner].pact > 0) continue; t = q.troops - 1; } }
  return t;
}

/** その家が出せる命令に点を付けて並べる。相手の計画にも、自分へのお告げにも使う */
export function rankOrders(s, clan, opts) {
  const o = opts || {}, c = s.clans[clan], P = clan === s.player ? { margin: 1.15, eco: 1.0, def: 1.2, neutral: 1, commit: true } : PERSONA[c.key];
  const out = [], rice = o.rice === undefined ? c.rice : o.rice;
  for (const p of s.provs) {
    if (p.owner !== clan) continue;
    const threat = threatTo(s, p, clan), holds = p.troops * CASTLE_MUL[p.castle] * (has(s, clan, 'don') ? 1.2 : 1);
    const danger = threat > 0 ? threat / Math.max(1, holds) : 0; // 1 を超えると落とされる
    // 攻める・動かす
    if (p.troops >= 2 && !p.tired) for (const j of p.adj) {
      const q = s.provs[j], sent = p.troops - 1;
      if (q.owner === clan) { // となりの自分の里があぶないなら、もののけを送る
        const qt = threatTo(s, q, clan), qh = q.troops * CASTLE_MUL[q.castle];
        if (qt > qh && threat === 0 && sent >= 2) out.push({ o: { t: 'march', from: p.id, to: q.id, sent }, v: 9 * P.def + q.koku, why: q.name + ' があぶないのでもののけを送る' });
        continue;
      }
      if (clan !== s.player && q.owner === s.player && c.pact > 0) continue;       // 約束は守る
      if (whyNot(s, clan, { t: 'march', from: p.id, to: q.id, sent })) continue;      // 最初のひと月のほこらなど、出せない攻めは考えない
      if (clan === s.player && q.owner >= 0 && s.clans[q.owner].pact > 0) continue; // お告げでは約束破りをすすめない
      const f = forecast(s, p.id, q.id, sent);
      if (!f.win || f.atk < f.def * P.margin) continue;
      let v = 10 + q.koku * 3 + (q.id === CAPITAL ? 9 : 0) + f.attackerLeft * 0.5;
      if (q.owner < 0) v += P.neutral;
      if (q.owner >= 0 && q.owner === s.coalition) v += 8;                          // 百鬼夜行: いちばん大きい家をねらう
      if (q.owner >= 0 && countOf(s, q.owner) === 1) v += 6;                        // あと 1 里でほろぼせる
      if (clan !== s.player && q.owner === s.player) v += -c.rel * 1.5;             // 仲が悪いほどねらう
      if (countOf(s, clan) + 1 >= WIN_PROVS) v += 40;                               // これで天下
      if (threat > 1 * CASTLE_MUL[p.castle]) v -= (p.koku * 3 + 6) * P.def * 0.6;   // 出たあと、もとの里が取られそう
      out.push({ o: { t: 'march', from: p.id, to: q.id, sent }, v, why: q.name + ' を攻め取れる(残るもののけ ' + f.attackerLeft + ')' });
    }
    // 呼び寄せ・結界張り・灯入れ
    if (rice >= 3) out.push({ o: { t: 'recruit', at: p.id }, v: (danger >= 0.8 ? 12 + danger * 6 : 3 + (threat > 0 ? 2 : 0) + Math.min(3, rice / 6)) * P.def + (p.troops < 3 ? 2 : 0), why: danger >= 0.8 ? p.name + ' が攻められそうなのでもののけを集める' : p.name + ' のもののけをふやす' });
    if (p.castle < 2 && rice >= costOf(s, clan, 'fortify') && threat > 0) out.push({ o: { t: 'fortify', at: p.id }, v: (danger >= 0.6 ? 8 + danger * 4 : 2.5) * P.def, why: p.name + ' の結界を張って守りやすくする' });
    if (p.koku < 6 && rice >= costOf(s, clan, 'develop') + (danger >= 0.8 ? 99 : 0)) out.push({ o: { t: 'develop', at: p.id }, v: (5.5 - p.koku * 0.5 + (MAX_TURNS - s.turn) * 0.12) * P.eco - (threat > 0 ? 1.5 : 0), why: p.name + ' を灯入れして灯をふやす' });
  }
  if (clan === s.player) for (const a of s.clans) { // お告げだけ: 仲が悪くて里がとなりの家には、供え物や約束
    if (a.id === clan || !a.alive) continue;
    const near = s.provs.some((p) => p.owner === clan && p.adj.some((j) => s.provs[j].owner === a.id));
    if (!near || a.pact > 0) continue;
    if (!whyNot(s, clan, { t: 'pact', clan: a.id })) out.push({ o: { t: 'pact', clan: a.id }, v: 9, why: a.name + ' と祟らぬ約束を結び、背中を守る' });
    else if (a.rel < 2 && rice >= COST.gift) out.push({ o: { t: 'gift', clan: a.id }, v: 4 - a.rel * 0.8, why: a.name + ' に供え物をして仲をよくする' });
  }
  out.sort((x, y) => y.v - x.v || (x.o.from || x.o.at || 0) - (y.o.from || y.o.at || 0));
  return out;
}

/** 相手の家の、次の夜の予定を決める(これが予告として見える) */
function planIntents(s, c) {
  const n = DIFFICULTY[s.difficulty].aiOrders, picked = [], usedFrom = {}, usedAt = {};
  let rice = c.rice + incomeOf(s, c.id).net; // 次に動くときに持っているはずの灯
  for (const r of rankOrders(s, c.id, { rice })) {
    if (picked.length >= n) break;
    const o = r.o;
    if (o.t === 'march') { if (usedFrom[o.from]) continue; usedFrom[o.from] = true; }
    else { const k = o.t + o.at; if (usedAt[k] || usedFrom[o.at]) continue; const cost = o.t === 'recruit' ? recruitSize(rice) : costOf(s, c.id, o.t); if (rice < Math.max(1, cost)) continue; usedAt[k] = true; rice -= cost; }
    picked.push(o);
  }
  return picked;
}

function runIntents(s, c) {
  for (const o of c.intents) {
    if (s.phase === 'over' || !c.alive) return;
    if (o.t === 'march') {
      const a = s.provs[o.from], d = s.provs[o.to];
      if (a.owner !== c.id) { say(s, c.name + ' の攻めは、出どころの里を失って取りやめになった', 'good'); continue; }
      if (d.owner === s.player && c.pact > 0) continue;
      const sent = a.troops - 1;
      if (sent < 1 || whyNot(s, c.id, { t: 'march', from: a.id, to: d.id, sent })) continue;
      if (d.owner !== c.id && !PERSONA[c.key].commit && !forecast(s, a.id, d.id, sent).win) { say(s, c.name + ' は ' + d.name + ' への攻めを取りやめた(勝ち目がなくなった)', d.owner === s.player ? 'good' : 'info'); continue; }
      march(s, c.id, a.id, d.id, sent);
      checkEnd(s);
    } else if (!whyNot(s, c.id, o)) apply(s, c.id, o);
  }
  // その場で決める命令: 守りと里づくりだけ(攻めは予告したものしか出さない)
  for (let k = 0; k < DIFFICULTY[s.difficulty].aiReact && c.alive && s.phase !== 'over'; k++) {
    const r = rankOrders(s, c.id).find((x) => x.o.t !== 'march' || s.provs[x.o.to].owner === c.id);
    if (!r || whyNot(s, c.id, r.o)) break;
    apply(s, c.id, r.o);
  }
}

// ---- 夜の進み ------------------------------------------------------------
function collect(s, c) {
  const inc = incomeOf(s, c.id);
  c.rice += inc.net;
  if (c.rice < 0) { // 灯が尽きた: もののけが 1 つ去る
    c.rice = 0;
    let big = null;
    for (const p of s.provs) if (p.owner === c.id && p.troops > 1 && (big === null || p.troops > big.troops)) big = p;
    if (big) { big.troops -= 1; if (c.id === s.player) say(s, '灯が尽き、' + big.name + ' のもののけが 1 つ去った', 'bad'); }
  }
  for (const p of s.provs) if (p.owner === c.id) { p.unrest = 0; p.tired = 0; }
  if (seasonOf(s.turn) === SEASONS[0] && has(s, c.id, 'miko') && s.provs[c.home].owner === c.id) s.provs[c.home].troops += 1;
}

/** 自分の番を終える。相手の家が予告どおりに動き、次の夜が始まる */
export function endTurn(s) {
  if (s.phase !== 'orders' || s.event) return false;
  const me = s.clans[s.player];
  for (const c of s.clans) {
    if (c.id === s.player || !c.alive || s.phase === 'over') continue;
    collect(s, c);
    runIntents(s, c);
  }
  if (s.phase === 'over') return true;
  if (checkEnd(s)) return true;
  if (s.turn >= MAX_TURNS) { finishByTime(s); return true; }
  s.turn += 1;
  for (const c of s.clans) if (c.id !== s.player && c.alive && c.pact > 0) { c.pact -= 1; if (c.pact === 0) say(s, c.name + ' との祟らぬ約束が切れた'); }
  updateCoalition(s);
  if (s.coalition === s.player) for (const c of s.clans) if (c.id !== s.player && c.alive) c.rel = Math.max(-5, c.rel - 1);
  collect(s, me);
  for (const c of s.clans) if (c.id !== s.player && c.alive) c.intents = planIntents(s, c);
  s.ordersLeft = ORDERS_PER_TURN;
  say(s, yearOf(s.turn) + ' の月・' + seasonOf(s.turn) + '。灯 ' + me.rice);
  if (s.turn % 2 === 1) drawEvent(s); // 2 夜に 1 回、出来事が起きる
  return true;
}

// ---- 出来事(2 つから選ぶ。結果は言葉で返す) -----------------------------------
const rivals = (s) => s.clans.filter((c) => c.id !== s.player && c.alive);
const homeOrAny = (s) => { const h = s.provs[s.clans[s.player].home]; return h.owner === s.player ? h : provsOf(s, s.player)[0]; };
const freeOfficer = (s, list) => { const me = s.clans[s.player]; const pool = list.filter((k) => me.officers.indexOf(k) < 0 && !CLANS.some((c) => c.officer === k)); return pool.length ? pool[pick(s, pool.length)] : null; };

export const EVENTS = {
  harvest: { title: '鬼火の群れ', text: '田の上を、青い火がいくつも流れていきます。', a: 'つかまえて灯にする(灯 +4)', b: '見送って手を合わせる(ほこらの灯の数 +1)',
    A: (s, me) => { me.rice += 4; return '鬼火は壺の中でおとなしくなった。灯 +4'; },
    B: (s) => { const p = homeOrAny(s); if (p.koku < 6) p.koku += 1; return p.name + ' に、消えない灯がひとつ増えた。灯の数 ' + p.koku; } },
  swordsman: { title: '戸をたたく者', text: '真夜中、ほこらの戸を三度たたく音がします。', a: '開けて迎え入れる(灯 -3)', b: '開けない',
    ok: (s, me) => me.officers.length < MAX_OFFICERS && me.rice >= 3 && !!freeOfficer(s, ['kage', 'hayate', 'miko', 'risu']),
    A: (s, me) => { const k = freeOfficer(s, ['kage', 'hayate', 'miko', 'risu']); if (!k || me.rice < 3 || me.officers.length >= MAX_OFFICERS) return '灯が足りず、戸の向こうの気配は去った'; me.rice -= 3; gainOfficer(s, s.player, k); return OFFICERS[k].ja + ' が、しずくを垂らしながら入ってきた'; },
    B: (s) => { const p = homeOrAny(s); p.troops += 1; return '音はやんだ。けれど戸の前に、足あとがひとつ残っている。' + p.name + ' のもののけ +1'; } },
  scholar: { title: '語り部の老婆', text: '里のはずれに、昔のことを何でも知っている老婆がいます。', a: '灯をそなえて話を聞く(灯 -3)', b: '遠くから見るだけ',
    ok: (s, me) => me.officers.length < MAX_OFFICERS && me.rice >= 3 && !!freeOfficer(s, ['tama', 'mogu', 'kura', 'uta']),
    A: (s, me) => { const k = freeOfficer(s, ['tama', 'mogu', 'kura', 'uta']); if (!k || me.rice < 3 || me.officers.length >= MAX_OFFICERS) return '灯が足りず、老婆は口をひらかなかった'; me.rice -= 3; gainOfficer(s, s.player, k); return '老婆の影から、' + OFFICERS[k].ja + ' が立ち上がった'; },
    B: (s, me) => { me.rice += 1; return '老婆は笑って、灯をひとつ置いていった。灯 +1'; } },
  unrest: { title: '泣き声', text: 'いちばん新しい里で、夜ごと泣き声がします。', a: '灯をそなえてしずめる(灯 -3)', b: '力でおさえる',
    A: (s, me) => { me.rice = Math.max(0, me.rice - 3); return '泣き声はやんだ。灯 -3'; },
    B: (s) => { const ps = provsOf(s, s.player), p = ps[ps.length - 1]; const n = Math.min(2, p.troops - 1); p.troops -= n; p.unrest = 1; return p.name + ' から、もののけが ' + n + ' いなくなった。次の夜、この里は灯を生まない'; } },
  market: { title: '夜の市', text: '橋の下に、顔のない商人たちの市が立ちました。', a: 'もののけを買う(灯 -2、ほこらのもののけ +3)', b: '灯芯を買う(灯 -3、灯の数 +1)',
    A: (s, me) => { const p = homeOrAny(s); if (me.rice < 2) return '灯が足りず、何も買えなかった'; me.rice -= 2; p.troops += 3; return '袋の中で何かが動いている。' + p.name + ' のもののけ +3'; },
    B: (s, me) => { const ps = provsOf(s, s.player).filter((p) => p.koku < 6); if (me.rice < 3 || !ps.length) return '灯が足りず、何も買えなかった'; const p = ps[pick(s, ps.length)]; me.rice -= 3; p.koku += 1; return p.name + ' の灯の数が ' + p.koku + ' になった'; } },
  envoy: { title: '使いの者', text: (s, e) => s.clans[e.clan].name + ' から、足音のしない使いが来ました。', a: 'もてなす(灯 -2、仲 +2)', b: '追いかえす(仲 -1、もののけ +1)',
    ok: (s) => rivals(s).length > 0, setup: (s) => ({ clan: rivals(s)[pick(s, rivals(s).length)].id }),
    A: (s, me, e) => { const c = s.clans[e.clan]; me.rice = Math.max(0, me.rice - 2); c.rel = Math.min(5, c.rel + 2); return '使いは一礼して、壁の中へ帰っていった。' + c.name + ' との仲 ' + (c.rel > 0 ? '+' : '') + c.rel; },
    B: (s, me, e) => { const c = s.clans[e.clan], p = homeOrAny(s); c.rel = Math.max(-5, c.rel - 1); p.troops += 1; return c.name + ' との仲は悪くなった。追いかえしたもののけが居ついた。' + p.name + ' のもののけ +1'; } },
  storm: { title: 'なまぬるい風', text: 'なまぬるい風が吹いて、結界の札がはがれかけています。', a: '札を貼りなおす(灯 -2)', b: 'そのままにする',
    A: (s, me) => { if (me.rice < 2) return '灯が足りず、貼りなおせなかった'; me.rice -= 2; return '札を貼りなおした。灯 -2'; },
    B: (s) => { const ps = provsOf(s, s.player).filter((p) => p.castle > 0); if (!ps.length) return 'はがれる札は、もうなかった'; const p = ps[pick(s, ps.length)]; p.castle -= 1; return p.name + ' の札が 1 枚、どこかへ飛んでいった。結界が弱くなった'; } },
  festival: { title: '逆さまつり', text: '死んだ者のための、祭りの夜です。', a: '盛大にひらく(灯 -3、すべての家との仲 +1)', b: 'つつましくひらく(灯 +1)',
    A: (s, me) => { if (me.rice < 3) return '灯が足りず、祭りは小さくなった'; me.rice -= 3; for (const c of rivals(s)) c.rel = Math.min(5, c.rel + 1); return 'よその家の者も、顔をかくして踊りに来た。すべての家との仲 +1'; },
    B: (s, me) => { me.rice += 1; return 'そなえた灯が、ひとつ多く返ってきた。灯 +1'; } },
  fugitive: { title: '逃げてきた影', text: (s, e) => s.clans[e.clan].name + ' から逃げてきた影が、戸口に立っています。', a: 'かくまう(もののけ +2、その家との仲 -1)', b: '引きわたす(その家との仲 +2)',
    ok: (s) => rivals(s).length > 0, setup: (s) => ({ clan: rivals(s)[pick(s, rivals(s).length)].id }),
    A: (s, me, e) => { const c = s.clans[e.clan], p = homeOrAny(s); p.troops += 2; c.rel = Math.max(-5, c.rel - 1); return '影は床下にもぐりこんだ。' + p.name + ' のもののけ +2。' + c.name + ' との仲は悪くなった'; },
    B: (s, me, e) => { const c = s.clans[e.clan]; c.rel = Math.min(5, c.rel + 2); return '影は何も言わずに連れていかれた。' + c.name + ' との仲 ' + (c.rel > 0 ? '+' : '') + c.rel; } },
  ore: { title: '光る井戸', text: 'かれ井戸の底が、ぼんやり光っています。', a: '汲み上げる(灯 +5、ほこらが 1 夜 灯を生まない)', b: 'ふたをして拝む(すべての家との仲 +1)',
    A: (s, me) => { const p = homeOrAny(s); me.rice += 5; p.unrest = 1; return '灯 +5。けれど井戸をのぞいた者が戻らず、' + p.name + ' は次の夜、灯を生まない'; },
    B: (s) => { for (const c of rivals(s)) c.rel = Math.min(5, c.rel + 1); return '井戸は静かになった。うわさが広まり、すべての家との仲 +1'; } },
  plague: { title: '影わずらい', text: '影がうすくなる病が、はやっています。', a: '灯をたいて追いはらう(灯 -3)', b: 'いのる',
    A: (s, me) => { me.rice = Math.max(0, me.rice - 3); return '影は濃さを取りもどした。灯 -3'; },
    B: (s) => { const ps = provsOf(s, s.player).filter((p) => p.troops > 2); if (!ps.length) return 'さいわい、病は広がらなかった'; const p = ps[pick(s, ps.length)]; p.troops -= 2; return p.name + ' のもののけが 2、影ごと消えた'; } },
  truce: { title: '祟らぬ約束の申し出', text: (s, e) => s.clans[e.clan].name + ' が、しばらく祟りあわない約束をもちかけてきました。', a: '受ける(4 夜の約束)', b: 'ことわる(仲 -1)',
    ok: (s) => s.coalition !== s.player && rivals(s).some((c) => c.pact === 0 && c.rel >= 0),
    setup: (s) => { const l = rivals(s).filter((c) => c.pact === 0 && c.rel >= 0); return { clan: l[pick(s, l.length)].id }; },
    A: (s, me, e) => { const c = s.clans[e.clan]; c.pact = 4 + (has(s, s.player, 'uta') ? 2 : 0); s.stats.pactsMade++; c.intents = c.intents.filter((i) => !(i.t === 'march' && s.provs[i.to].owner === s.player)); return '指切りの代わりに、髪を一本ずつ結んだ。' + c.name + ' と ' + c.pact + ' 夜の約束'; },
    B: (s, me, e) => { const c = s.clans[e.clan]; c.rel = Math.max(-5, c.rel - 1); return c.name + ' の使いは、長いこと戸口に立っていた'; } },
  carpenter: { title: '札書きの坊主', text: '結界の札を書く坊主が通りかかりました。目は合わせてくれません。', a: 'たのむ(灯 -2、結界 +1)', b: '見送る',
    A: (s, me) => { const ps = provsOf(s, s.player).filter((p) => p.castle < 2); if (me.rice < 2 || !ps.length) return 'たのめる仕事がなかった'; const p = ps[pick(s, ps.length)]; me.rice -= 2; p.castle += 1; return p.name + ' の結界が強くなった。札の字は、だれにも読めない'; },
    B: () => '坊主は、ふり返らずに次の里へ向かった' },
  tax: { title: '灯の取り立て', text: '里の者から灯をどれだけ取り立てるか、憑きものがたずねています。', a: '多く取る(灯 +4、ほこらの灯の数 -1)', b: '少なく取る(灯 -2、ほこらの灯の数 +1)',
    A: (s, me) => { const p = homeOrAny(s); me.rice += 4; if (p.koku > 1) p.koku -= 1; return '灯 +4。' + p.name + ' の家々の窓が、ひとつ暗くなった。灯の数 ' + p.koku; },
    B: (s, me) => { const p = homeOrAny(s); me.rice = Math.max(0, me.rice - 2); if (p.koku < 6) p.koku += 1; return p.name + ' の窓に、灯がひとつ増えた。灯の数 ' + p.koku; } },
};
export const EVENT_KEYS = Object.keys(EVENTS);

function drawEvent(s) {
  const me = s.clans[s.player];
  const pool = EVENT_KEYS.filter((k) => s.eventsSeen.indexOf(k) < 0 && (!EVENTS[k].ok || EVENTS[k].ok(s, me)));
  if (!pool.length) return;
  const key = pool[pick(s, pool.length)], E = EVENTS[key], data = E.setup ? E.setup(s) : {};
  s.eventsSeen.push(key);
  s.event = Object.assign({ key, title: E.title, text: typeof E.text === 'function' ? E.text(s, data) : E.text, a: E.a, b: E.b }, data);
}

/** 出来事に答える('A' か 'B')。結果の文を返す */
export function answerEvent(s, choice) {
  if (!s.event) return null;
  const e = s.event, E = EVENTS[e.key], me = s.clans[s.player];
  const text = (choice === 'B' ? E.B : E.A)(s, me, e);
  s.event = null;
  say(s, e.title + ': ' + text, 'event');
  checkEnd(s);
  return text;
}

/** 憑きもののお告げ: いま出すとよさそうな命令を上から n 個 */
export function advice(s, n) {
  const out = [], seen = {};
  for (const r of rankOrders(s, s.player)) {
    const k = r.o.t + ':' + (r.o.from !== undefined ? r.o.from + '>' + r.o.to : r.o.at !== undefined ? r.o.at : r.o.clan);
    if (seen[k] || whyNot(s, s.player, r.o)) continue;
    seen[k] = true; out.push(r);
    if (out.length >= (n || 3)) break;
  }
  return out;
}
