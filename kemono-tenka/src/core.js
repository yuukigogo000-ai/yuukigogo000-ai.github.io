/*
 * けもの天下 — ルール(描画なし・依存なし)
 *
 * 12 の国を 4 つのけもの家が取り合う。調査(reports/戦略ゲーム先行事例リサーチ.md)から決めた骨格:
 *  - 命令は 1 ターンに 3 つだけ。領土が増えても手間は増えない
 *  - 敵の家は、次に何をするかを先に見せる(予告)。予告どおりに動く
 *  - 7 国を取った家がその場で天下人。勝ちが見えてからの消化試合を作らない
 *  - 一番大きい家には包囲網が組まれる(隠れた補正ではなく、見えるルール)
 *  - いくさは自動で、結果は出す前に分かる(運なし)
 *
 * 盤面は全部 JSON にできる素のデータ。乱数は盤面の中の種だけを使う。同じ種・同じ手なら同じ結果になる。
 */

export const WIN_PROVS = 7;        // この数の国を持った家が天下人
export const MAX_TURNS = 24;       // 6 年 × 4 季
export const ORDERS_PER_TURN = 3;
export const COALITION_AT = 5;     // この数の国を持つ単独首位に、包囲網が組まれる
export const TRUCE_TURNS = 4;      // 最初の 1 年は、どの家も、ほかの家の本拠を攻められない
const CASTLE_MUL = [1, 1.3, 1.6];
export const SEASONS = ['春', '夏', '秋', '冬'];

/** 国(3 列 × 4 段)。koku = 石高(毎ターンの米)。まんなかの「みやこ」は都 */
const PROV_DEFS = [
  ['ゆきの峰', 0, 0, 3], ['きのこ山', 1, 0, 2], ['もみじ坂', 2, 0, 3],
  ['どんぐり森', 0, 1, 2], ['みやこ', 1, 1, 4], ['かわせみ川', 2, 1, 2],
  ['すすき原', 0, 2, 2], ['はちみつ谷', 1, 2, 3], ['つきみ野', 2, 2, 2],
  ['こけ沼', 0, 3, 3], ['たけの里', 1, 3, 2], ['うみねこ浜', 2, 3, 3],
];
export const CAPITAL = 4;
const HOMES = [9, 2, 0, 11]; // 4 すみ

/** 家臣。家ごとに 1 人の看板家臣がいて、ほかは出来事や国盗りで増える(4 人まで) */
export const OFFICERS = {
  gonta:  { ja: '猛将ゴンタ',     text: '攻めるとき兵力 +20%' },
  don:    { ja: '守りのドン',     text: '守るとき兵力 +20%' },
  kon:    { ja: '口八丁のコン',   text: '贈り物の効きめ +1' },
  pyon:   { ja: '募兵のピョン',   text: '徴兵で集まる兵 +1' },
  tama:   { ja: '目利きのタマ',   text: '開発の費用 -1' },
  mogu:   { ja: '築城のモグ',     text: '築城の費用 -1' },
  risu:   { ja: '兵糧番のリス',   text: '兵の維持費が半分' },
  hayate: { ja: '早駆けハヤテ',   text: '攻め取った国が、すぐに米を生む' },
  kura:   { ja: '蔵番のクラ',     text: '毎ターン 米 +1' },
  kage:   { ja: '忍びのカゲ',     text: '攻めるとき、相手の城の守りを無視する' },
  uta:    { ja: '歌詠みのウタ',   text: '不戦の約束が 2 ターン長く続く' },
  miko:   { ja: '占いのミコ',     text: '毎年の春、本拠に兵 +1' },
};
export const OFFICER_KEYS = Object.keys(OFFICERS);
export const MAX_OFFICERS = 4;

/** 4 つの家。persona は相手にしたときの性格(固定で、画面にも見せる) */
export const CLANS = [
  { key: 'bear',   ja: 'クマ家',   officer: 'gonta', persona: '猛進', personaText: '勝てそうならすぐ攻める。予告した攻めは必ずやる' },
  { key: 'turtle', ja: 'カメ家',   officer: 'don',   persona: '堅守', personaText: '国を育てて守りを固める。勝ち目のない攻めは取りやめる' },
  { key: 'fox',    ja: 'キツネ家', officer: 'kon',   persona: '機をみる', personaText: '弱った相手をねらう。仲のよい相手は攻めにくい' },
  { key: 'rabbit', ja: 'ウサギ家', officer: 'pyon',  persona: '数でおす', personaText: '兵をどんどん集め、持ち主のいない国へ広がる' },
];
// 性格ごとの重み: margin = 攻めに必要な余裕、eco = 開発好き、def = 守り重視、neutral = 持ち主なしの国が好き、commit = 予告した攻めを必ずやるか
const PERSONA = {
  bear:   { margin: 1.0,  eco: 0.5, def: 0.6, neutral: 0, commit: true },
  turtle: { margin: 1.4,  eco: 1.6, def: 1.5, neutral: 0, commit: false },
  fox:    { margin: 1.2,  eco: 1.0, def: 1.0, neutral: 1, commit: false },
  rabbit: { margin: 1.1,  eco: 0.7, def: 0.8, neutral: 4, commit: true },
};
export const DIFFICULTY = {
  // aiOrders = 予告つきの命令の数、aiReact = その場で決める守り・国づくりの命令の数(攻めは必ず予告される)
  easy:   { ja: 'やさしい',   incomeMul: 1.0, aiOrders: 2, aiReact: 0, text: '相手の家は、命令を 2 つしか出さない' },
  normal: { ja: 'ふつう',     incomeMul: 1.0, aiOrders: 2, aiReact: 1, text: '相手もあなたと同じく、命令を 3 つ出す' },
  hard:   { ja: 'むずかしい', incomeMul: 1.2, aiOrders: 3, aiReact: 1, text: '相手の家は命令を 4 つ出し、米の実りも 2 割多い' },
};

export const COST = { recruit: 1, develop: 4, fortify: 3, gift: 2, pact: 2 }; // 徴兵は兵 1 つにつき米 1(1 回の命令で 6 まで)
export const RECRUIT_MAX = 4;
/** 徴兵 1 回で集まる兵の数(米が足りなければ、ある分だけ) */
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
    stats: { battlesWon: 0, battlesLost: 0, provsTaken: 0, provsLost: 0, peak: 1 },
  };
  PROV_DEFS.forEach((d, i) => {
    const adj = [];
    PROV_DEFS.forEach((e, j) => { if (i !== j && Math.abs(d[1] - e[1]) + Math.abs(d[2] - e[2]) === 1) adj.push(j); });
    // 持ち主のいない国は、種によって守りの兵と石高が少し変わる
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
  say(s, 'はじまり。' + SEASONS[0] + '。' + WIN_PROVS + ' 国を取った家が天下人になります');
  return s;
}

export function cloneState(s) {
  return Object.assign({}, s, {
    provs: s.provs.map((p) => Object.assign({}, p)),
    clans: s.clans.map((c) => Object.assign({}, c, { officers: c.officers.slice(), intents: c.intents.map((i) => Object.assign({}, i)) })),
    log: s.log.slice(), eventsSeen: s.eventsSeen.slice(), stats: Object.assign({}, s.stats),
    event: s.event ? JSON.parse(JSON.stringify(s.event)) : null,
  });
}

// ---- 小道具 ------------------------------------------------------------------
function say(s, text, kind) { s.log.push({ turn: s.turn, text, kind: kind || 'info' }); if (s.log.length > 60) s.log.shift(); }
const has = (s, clan, officer) => clan >= 0 && s.clans[clan].officers.indexOf(officer) >= 0;
export const provsOf = (s, clan) => s.provs.filter((p) => p.owner === clan);
export const countOf = (s, clan) => provsOf(s, clan).length;
export const ownerName = (s, owner) => (owner < 0 ? '国人衆' : s.clans[owner].name);
export const yearOf = (turn) => Math.floor((turn - 1) / 4) + 1;
export const seasonOf = (turn) => SEASONS[(turn - 1) % 4];

export function costOf(s, clan, kind) {
  let c = COST[kind];
  if (kind === 'develop' && has(s, clan, 'tama')) c -= 1;
  if (kind === 'fortify' && has(s, clan, 'mogu')) c -= 1;
  return c;
}

/** 1 ターンの米の出入り(実りと、兵の維持費) */
export function incomeOf(s, clan) {
  let gain = 0, troops = 0;
  for (const p of s.provs) if (p.owner === clan) { if (!p.unrest) gain += p.koku + (p.id === CAPITAL ? 2 : 0); troops += p.troops; }
  if (has(s, clan, 'kura')) gain += 1;
  if (clan !== s.player) gain = Math.round(gain * DIFFICULTY[s.difficulty].incomeMul);
  const upkeep = Math.floor(troops / (has(s, clan, 'risu') ? 8 : 4)); // 兵 4 つにつき米 1
  return { gain, upkeep, net: gain - upkeep };
}

// ---- いくさ(運なし。出す前に結果が分かる) -------------------------------------
/** from の国から to の国へ sent の兵で攻めたときの見こみ */
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
  if (clan === s.player) say(s, OFFICERS[key].ja + ' が家臣に加わった(' + OFFICERS[key].text + ')', 'good');
  return true;
}

function eliminate(s, loser, by) {
  const c = s.clans[loser];
  c.alive = false; c.intents = [];
  say(s, c.name + ' がほろびた', loser === s.player ? 'bad' : 'big');
  if (by >= 0) gainOfficer(s, by, CLANS[loser].officer);
}

/** 兵を動かす(自分の国へ)か、攻める(よその国へ)。返り値: 結果の説明 */
function march(s, clan, fromId, toId, sent) {
  const a = s.provs[fromId], d = s.provs[toId];
  if (d.owner === clan) { a.troops -= sent; d.troops += sent; return { moved: true }; }
  const f = forecast(s, fromId, toId, sent), defender = d.owner;
  const who = s.clans[clan].name, where = d.name + '(' + ownerName(s, defender) + ')';
  if (defender >= 0 && defender !== s.player && clan === s.player) { // 自分が攻めた相手との仲が悪くなる。約束があれば破ったことになる
    const dc = s.clans[defender];
    if (dc.pact > 0) { dc.pact = 0; for (const o of s.clans) if (o.id !== s.player) o.rel = Math.max(-5, o.rel - 3); say(s, '不戦の約束を破った。どの家からも信用を失った', 'bad'); }
    dc.rel = Math.max(-5, dc.rel - 3);
  }
  if (f.win) {
    a.troops -= sent;
    d.owner = clan; d.troops = f.attackerLeft; d.castle = Math.max(0, d.castle - 1); d.unrest = has(s, clan, 'hayate') ? 0 : 1; d.tired = 1;
    say(s, who + ' が ' + where + ' を攻め取った(残った兵 ' + f.attackerLeft + ')', clan === s.player ? 'good' : defender === s.player ? 'bad' : 'info');
    if (clan === s.player) { s.stats.battlesWon++; s.stats.provsTaken++; } else if (defender === s.player) { s.stats.battlesLost++; s.stats.provsLost++; }
    if (defender >= 0 && countOf(s, defender) === 0) eliminate(s, defender, clan);
  } else {
    a.troops -= f.attackerLoss; d.troops -= f.defenderLoss;
    say(s, who + ' が ' + where + ' を攻めたが、はね返された(失った兵 ' + f.attackerLoss + ')', clan === s.player ? 'bad' : defender === s.player ? 'good' : 'info');
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
    if (!a || !d || a.owner !== clan) return '自分の国から出します';
    if (a.adj.indexOf(d.id) < 0) return 'となりの国にしか出せません';
    if (!(order.sent >= 1) || order.sent > a.troops - 1) return '国には兵を 1 つ残します';
    if (a.tired) return '攻め取ったばかりの国からは、このターンは出せません';
    if (s.turn <= TRUCE_TURNS && d.owner >= 0 && d.owner !== clan && s.clans[d.owner].home === d.id) return '最初の 1 年は、ほかの家の本拠を攻められません';
    return null;
  }
  if (order.t === 'recruit' || order.t === 'develop' || order.t === 'fortify') {
    const p = s.provs[order.at];
    if (!p || p.owner !== clan) return '自分の国にしか出せません';
    if (order.t === 'develop' && p.koku >= 6) return 'この国はもう十分に育っています';
    if (order.t === 'fortify' && p.castle >= 2) return 'この城はもう十分に固いです';
    if (c.rice < costOf(s, clan, order.t)) return '米が足りません(' + costOf(s, clan, order.t) + ' 必要)';
    return null;
  }
  if (order.t === 'gift' || order.t === 'pact') {
    const o = s.clans[order.clan];
    if (clan !== s.player || !o || o.id === clan || !o.alive) return '相手がいません';
    if (c.rice < COST[order.t]) return '米が足りません(' + COST[order.t] + ' 必要)';
    if (order.t === 'gift' && o.rel >= 5) return 'これ以上は仲よくなれません';
    if (order.t === 'pact') {
      if (o.pact > 0) return 'すでに約束があります';
      if (s.coalition === s.player) return '包囲網のあいだは、約束を結べません';
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
    if (clan === s.player) say(s, s.provs[order.at].name + ' で兵を ' + n + ' 集めた');
  } else if (order.t === 'develop') {
    c.rice -= costOf(s, clan, 'develop'); s.provs[order.at].koku += 1;
    if (clan === s.player) say(s, s.provs[order.at].name + ' を開発した(石高 ' + s.provs[order.at].koku + ')');
  } else if (order.t === 'fortify') {
    c.rice -= costOf(s, clan, 'fortify'); s.provs[order.at].castle += 1;
    if (clan === s.player) say(s, s.provs[order.at].name + ' の城を固めた');
  } else if (order.t === 'gift') {
    const o = s.clans[order.clan];
    c.rice -= COST.gift; o.rel = Math.min(5, o.rel + 2 + (has(s, clan, 'kon') ? 1 : 0));
    say(s, o.name + ' に贈り物をした(仲 ' + (o.rel > 0 ? '+' : '') + o.rel + ')');
  } else if (order.t === 'pact') {
    const o = s.clans[order.clan];
    c.rice -= COST.pact; o.pact = 4 + (has(s, clan, 'uta') ? 2 : 0);
    o.intents = o.intents.filter((i) => !(i.t === 'march' && s.provs[i.to].owner === s.player)); // 約束したので、こちらへの攻めは取りやめる
    say(s, o.name + ' と不戦の約束を結んだ(' + o.pact + ' ターン)', 'good');
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

// ---- 包囲網・決着 ------------------------------------------------------------
function updateCoalition(s) {
  let lead = -1, best = 0, tie = false;
  for (const c of s.clans) { if (!c.alive) continue; const n = countOf(s, c.id); if (n > best) { best = n; lead = c.id; tie = false; } else if (n === best) tie = true; }
  const next = best >= COALITION_AT && !tie ? lead : -1;
  if (next !== s.coalition) {
    if (next >= 0) say(s, s.clans[next].name + ' が大きくなりすぎた。ほかの家が包囲網を組んだ', next === s.player ? 'bad' : 'big');
    else if (s.coalition >= 0) say(s, '包囲網がとけた');
    s.coalition = next;
  }
}

function finish(s, winner, reason) {
  s.phase = 'over'; s.winner = winner; s.endReason = reason; s.event = null;
  say(s, s.clans[winner].name + ' が天下を取った(' + reason + ')', winner === s.player ? 'good' : 'bad');
}

function checkEnd(s) {
  if (s.phase === 'over') return true;
  s.stats.peak = Math.max(s.stats.peak, countOf(s, s.player));
  for (const c of s.clans) if (c.alive && countOf(s, c.id) === 0) eliminate(s, c.id, -1); // 国がなくなった家はほろびる(出来事などで失った場合も)
  for (const c of s.clans) if (c.alive && countOf(s, c.id) >= WIN_PROVS) { finish(s, c.id, WIN_PROVS + ' 国を手にした'); return true; }
  if (!s.clans[s.player].alive) { // 自分がほろびた: いちばん大きい家の天下
    let w = -1, best = -1;
    for (const c of s.clans) if (c.alive && countOf(s, c.id) > best) { best = countOf(s, c.id); w = c.id; }
    finish(s, w, 'あなたの家はほろびた');
    return true;
  }
  const alive = s.clans.filter((c) => c.alive);
  if (alive.length === 1) { finish(s, alive[0].id, 'ほかの家がすべてほろびた'); return true; }
  return false;
}

function finishByTime(s) {
  // 6 年が過ぎた: 国の数、同じなら石高の合計、それも同じなら兵の数で決める
  let w = -1, key = null;
  for (const c of s.clans) {
    if (!c.alive) continue;
    const ps = provsOf(s, c.id), k = [ps.length, ps.reduce((t, p) => t + p.koku, 0), ps.reduce((t, p) => t + p.troops, 0)];
    if (key === null || k[0] > key[0] || (k[0] === key[0] && (k[1] > key[1] || (k[1] === key[1] && k[2] > key[2])))) { key = k; w = c.id; }
  }
  finish(s, w, '6 年がすぎ、いちばん多くの国を持っていた');
}

// ---- 相手の家の考え方 ----------------------------------------------------------
function threatTo(s, p, clan) { // となりの、よその家の兵でいちばん多いもの
  let t = 0;
  for (const j of p.adj) { const q = s.provs[j]; if (q.owner >= 0 && q.owner !== clan && q.troops - 1 > t) { if (q.owner !== s.player && clan === s.player && s.clans[q.owner].pact > 0) continue; t = q.troops - 1; } }
  return t;
}

/** その家が出せる命令に点を付けて並べる。相手の計画にも、自分への進言にも使う */
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
      if (q.owner === clan) { // となりの自分の国があぶないなら、兵を送る
        const qt = threatTo(s, q, clan), qh = q.troops * CASTLE_MUL[q.castle];
        if (qt > qh && threat === 0 && sent >= 2) out.push({ o: { t: 'march', from: p.id, to: q.id, sent }, v: 9 * P.def + q.koku, why: q.name + ' があぶないので兵を送る' });
        continue;
      }
      if (clan !== s.player && q.owner === s.player && c.pact > 0) continue;       // 約束は守る
      if (whyNot(s, clan, { t: 'march', from: p.id, to: q.id, sent })) continue;      // 最初の 1 年の本拠など、出せない攻めは考えない
      if (clan === s.player && q.owner >= 0 && s.clans[q.owner].pact > 0) continue; // 進言では約束破りをすすめない
      const f = forecast(s, p.id, q.id, sent);
      if (!f.win || f.atk < f.def * P.margin) continue;
      let v = 10 + q.koku * 3 + (q.id === CAPITAL ? 9 : 0) + f.attackerLeft * 0.5;
      if (q.owner < 0) v += P.neutral;
      if (q.owner >= 0 && q.owner === s.coalition) v += 8;                          // 包囲網: いちばん大きい家をねらう
      if (q.owner >= 0 && countOf(s, q.owner) === 1) v += 6;                        // あと 1 国でほろぼせる
      if (clan !== s.player && q.owner === s.player) v += -c.rel * 1.5;             // 仲が悪いほどねらう
      if (countOf(s, clan) + 1 >= WIN_PROVS) v += 40;                               // これで天下
      if (threat > 1 * CASTLE_MUL[p.castle]) v -= (p.koku * 3 + 6) * P.def * 0.6;   // 出たあと、もとの国が取られそう
      out.push({ o: { t: 'march', from: p.id, to: q.id, sent }, v, why: q.name + ' を攻め取れる(残る兵 ' + f.attackerLeft + ')' });
    }
    // 徴兵・築城・開発
    if (rice >= 3) out.push({ o: { t: 'recruit', at: p.id }, v: (danger >= 0.8 ? 12 + danger * 6 : 3 + (threat > 0 ? 2 : 0) + Math.min(3, rice / 6)) * P.def + (p.troops < 3 ? 2 : 0), why: danger >= 0.8 ? p.name + ' が攻められそうなので兵を集める' : p.name + ' の兵をふやす' });
    if (p.castle < 2 && rice >= costOf(s, clan, 'fortify') && threat > 0) out.push({ o: { t: 'fortify', at: p.id }, v: (danger >= 0.6 ? 8 + danger * 4 : 2.5) * P.def, why: p.name + ' の城を固めて守りやすくする' });
    if (p.koku < 6 && rice >= costOf(s, clan, 'develop') + (danger >= 0.8 ? 99 : 0)) out.push({ o: { t: 'develop', at: p.id }, v: (5.5 - p.koku * 0.5 + (MAX_TURNS - s.turn) * 0.12) * P.eco - (threat > 0 ? 1.5 : 0), why: p.name + ' を開発して米をふやす' });
  }
  if (clan === s.player) for (const a of s.clans) { // 進言だけ: 仲が悪くて国がとなりの家には、贈り物や約束
    if (a.id === clan || !a.alive) continue;
    const near = s.provs.some((p) => p.owner === clan && p.adj.some((j) => s.provs[j].owner === a.id));
    if (!near || a.pact > 0) continue;
    if (!whyNot(s, clan, { t: 'pact', clan: a.id })) out.push({ o: { t: 'pact', clan: a.id }, v: 9, why: a.name + ' と不戦の約束を結び、背中を守る' });
    else if (a.rel < 2 && rice >= COST.gift) out.push({ o: { t: 'gift', clan: a.id }, v: 4 - a.rel * 0.8, why: a.name + ' に贈り物をして仲をよくする' });
  }
  out.sort((x, y) => y.v - x.v || (x.o.from || x.o.at || 0) - (y.o.from || y.o.at || 0));
  return out;
}

/** 相手の家の、次のターンの予定を決める(これが予告として見える) */
function planIntents(s, c) {
  const n = DIFFICULTY[s.difficulty].aiOrders, picked = [], usedFrom = {}, usedAt = {};
  let rice = c.rice + incomeOf(s, c.id).net; // 次に動くときに持っているはずの米
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
      if (a.owner !== c.id) { say(s, c.name + ' の攻めは、出どころの国を失って取りやめになった', 'good'); continue; }
      if (d.owner === s.player && c.pact > 0) continue;
      const sent = a.troops - 1;
      if (sent < 1 || whyNot(s, c.id, { t: 'march', from: a.id, to: d.id, sent })) continue;
      if (d.owner !== c.id && !PERSONA[c.key].commit && !forecast(s, a.id, d.id, sent).win) { say(s, c.name + ' は ' + d.name + ' への攻めを取りやめた(勝ち目がなくなった)', d.owner === s.player ? 'good' : 'info'); continue; }
      march(s, c.id, a.id, d.id, sent);
      checkEnd(s);
    } else if (!whyNot(s, c.id, o)) apply(s, c.id, o);
  }
  // その場で決める命令: 守りと国づくりだけ(攻めは予告したものしか出さない)
  for (let k = 0; k < DIFFICULTY[s.difficulty].aiReact && c.alive && s.phase !== 'over'; k++) {
    const r = rankOrders(s, c.id).find((x) => x.o.t !== 'march' || s.provs[x.o.to].owner === c.id);
    if (!r || whyNot(s, c.id, r.o)) break;
    apply(s, c.id, r.o);
  }
}

// ---- ターンの進み ------------------------------------------------------------
function collect(s, c) {
  const inc = incomeOf(s, c.id);
  c.rice += inc.net;
  if (c.rice < 0) { // 米が尽きた: 兵が 1 つ去る
    c.rice = 0;
    let big = null;
    for (const p of s.provs) if (p.owner === c.id && p.troops > 1 && (big === null || p.troops > big.troops)) big = p;
    if (big) { big.troops -= 1; if (c.id === s.player) say(s, '米が尽き、' + big.name + ' の兵が 1 つ去った', 'bad'); }
  }
  for (const p of s.provs) if (p.owner === c.id) { p.unrest = 0; p.tired = 0; }
  if (seasonOf(s.turn) === '春' && has(s, c.id, 'miko') && s.provs[c.home].owner === c.id) s.provs[c.home].troops += 1;
}

/** 自分の番を終える。相手の家が予告どおりに動き、次のターンが始まる */
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
  for (const c of s.clans) if (c.id !== s.player && c.alive && c.pact > 0) { c.pact -= 1; if (c.pact === 0) say(s, c.name + ' との不戦の約束が切れた'); }
  updateCoalition(s);
  if (s.coalition === s.player) for (const c of s.clans) if (c.id !== s.player && c.alive) c.rel = Math.max(-5, c.rel - 1);
  collect(s, me);
  for (const c of s.clans) if (c.id !== s.player && c.alive) c.intents = planIntents(s, c);
  s.ordersLeft = ORDERS_PER_TURN;
  say(s, yearOf(s.turn) + ' 年目の' + seasonOf(s.turn) + '。米 ' + me.rice);
  if (s.turn % 2 === 1) drawEvent(s); // 2 ターンに 1 回、出来事が起きる
  return true;
}

// ---- 出来事(2 つから選ぶ。結果は言葉で返す) -----------------------------------
const rivals = (s) => s.clans.filter((c) => c.id !== s.player && c.alive);
const homeOrAny = (s) => { const h = s.provs[s.clans[s.player].home]; return h.owner === s.player ? h : provsOf(s, s.player)[0]; };
const freeOfficer = (s, list) => { const me = s.clans[s.player]; const pool = list.filter((k) => me.officers.indexOf(k) < 0 && !CLANS.some((c) => c.officer === k)); return pool.length ? pool[pick(s, pool.length)] : null; };

export const EVENTS = {
  harvest: { title: '豊作', text: '今年は米がよく実りました。', a: '蔵にしまう(米 +4)', b: '民にふるまう(本拠の石高 +1)',
    A: (s, me) => { me.rice += 4; return '蔵がいっぱいになった。米 +4'; },
    B: (s) => { const p = homeOrAny(s); if (p.koku < 6) p.koku += 1; return p.name + ' の民がよろこび、石高が ' + p.koku + ' になった'; } },
  swordsman: { title: '旅の剣豪', text: '腕の立つ者が、仕える先をさがしています。', a: '召しかかえる(米 -3)', b: '見送る',
    ok: (s, me) => me.officers.length < MAX_OFFICERS && me.rice >= 3 && !!freeOfficer(s, ['kage', 'hayate', 'miko', 'risu']),
    A: (s, me) => { const k = freeOfficer(s, ['kage', 'hayate', 'miko', 'risu']); if (!k || me.rice < 3 || me.officers.length >= MAX_OFFICERS) return '米が足りず、召しかかえられなかった'; me.rice -= 3; gainOfficer(s, s.player, k); return OFFICERS[k].ja + ' を召しかかえた'; },
    B: (s) => { const p = homeOrAny(s); p.troops += 1; return '剣豪は去ったが、けいこを見た兵がやる気を出した。' + p.name + ' の兵 +1'; } },
  scholar: { title: '物知りの旅人', text: '国づくりにくわしい者が、宿をもとめています。', a: 'もてなして召しかかえる(米 -3)', b: '一晩だけ泊める',
    ok: (s, me) => me.officers.length < MAX_OFFICERS && me.rice >= 3 && !!freeOfficer(s, ['tama', 'mogu', 'kura', 'uta']),
    A: (s, me) => { const k = freeOfficer(s, ['tama', 'mogu', 'kura', 'uta']); if (!k || me.rice < 3 || me.officers.length >= MAX_OFFICERS) return '米が足りず、召しかかえられなかった'; me.rice -= 3; gainOfficer(s, s.player, k); return OFFICERS[k].ja + ' を召しかかえた'; },
    B: (s, me) => { me.rice += 1; return '旅人はお礼に米を置いていった。米 +1'; } },
  unrest: { title: '一揆のうわさ', text: '年貢が重いと、民がさわいでいます。', a: '米をくばる(米 -3)', b: '力でおさえる',
    A: (s, me) => { me.rice = Math.max(0, me.rice - 3); return '民は落ちついた。米 -3'; },
    B: (s) => { const ps = provsOf(s, s.player), p = ps[ps.length - 1]; const n = Math.min(2, p.troops - 1); p.troops -= n; p.unrest = 1; return p.name + ' でけが人が出て兵 -' + n + '。次のターン、この国は米を生まない'; } },
  market: { title: '商人の市', text: '遠くから商人がやってきました。', a: '武具を買う(米 -2、本拠の兵 +3)', b: '道をととのえる(米 -3、石高 +1)',
    A: (s, me) => { const p = homeOrAny(s); if (me.rice < 2) return '米が足りず、何も買えなかった'; me.rice -= 2; p.troops += 3; return p.name + ' の兵 +3'; },
    B: (s, me) => { const ps = provsOf(s, s.player).filter((p) => p.koku < 6); if (me.rice < 3 || !ps.length) return '米が足りず、何もできなかった'; const p = ps[pick(s, ps.length)]; me.rice -= 3; p.koku += 1; return p.name + ' の石高が ' + p.koku + ' になった'; } },
  envoy: { title: 'となりの使者', text: (s, e) => s.clans[e.clan].name + ' から使者が来ました。', a: 'もてなす(米 -2、仲 +2)', b: '追いかえす(仲 -1、兵 +1)',
    ok: (s) => rivals(s).length > 0, setup: (s) => ({ clan: rivals(s)[pick(s, rivals(s).length)].id }),
    A: (s, me, e) => { const c = s.clans[e.clan]; me.rice = Math.max(0, me.rice - 2); c.rel = Math.min(5, c.rel + 2); return c.name + ' との仲が ' + (c.rel > 0 ? '+' : '') + c.rel + ' になった'; },
    B: (s, me, e) => { const c = s.clans[e.clan], p = homeOrAny(s); c.rel = Math.max(-5, c.rel - 1); p.troops += 1; return c.name + ' との仲が悪くなったが、兵は勇み立った。' + p.name + ' の兵 +1'; } },
  storm: { title: '大あらし', text: '強い風と雨で、城がいたみました。', a: '城を直す(米 -2)', b: 'そのままにする',
    A: (s, me) => { if (me.rice < 2) return '米が足りず、直せなかった'; me.rice -= 2; return '城を直した。米 -2'; },
    B: (s) => { const ps = provsOf(s, s.player).filter((p) => p.castle > 0); if (!ps.length) return 'いたむ城はなかった'; const p = ps[pick(s, ps.length)]; p.castle -= 1; return p.name + ' の城が弱くなった'; } },
  festival: { title: '秋まつり', text: '祭りの季節です。', a: '盛大にひらく(米 -3、すべての家との仲 +1)', b: 'つつましくひらく(米 +1)',
    A: (s, me) => { if (me.rice < 3) return '米が足りず、祭りは小さくなった'; me.rice -= 3; for (const c of rivals(s)) c.rel = Math.min(5, c.rel + 1); return 'となりの家々も招いた。すべての家との仲 +1'; },
    B: (s, me) => { me.rice += 1; return 'おそなえの米があまった。米 +1'; } },
  fugitive: { title: '落ち武者', text: (s, e) => s.clans[e.clan].name + ' を追われた兵が、助けをもとめています。', a: 'かくまう(兵 +2、その家との仲 -1)', b: '引きわたす(その家との仲 +2)',
    ok: (s) => rivals(s).length > 0, setup: (s) => ({ clan: rivals(s)[pick(s, rivals(s).length)].id }),
    A: (s, me, e) => { const c = s.clans[e.clan], p = homeOrAny(s); p.troops += 2; c.rel = Math.max(-5, c.rel - 1); return p.name + ' の兵 +2。' + c.name + ' との仲は悪くなった'; },
    B: (s, me, e) => { const c = s.clans[e.clan]; c.rel = Math.min(5, c.rel + 2); return c.name + ' との仲が ' + (c.rel > 0 ? '+' : '') + c.rel + ' になった'; } },
  ore: { title: '山で光るもの', text: '山で、きれいな石が見つかりました。', a: '掘って売る(米 +5、本拠が 1 ターン米を生まない)', b: '山の神にそなえる(すべての家との仲 +1)',
    A: (s, me) => { const p = homeOrAny(s); me.rice += 5; p.unrest = 1; return '米 +5。ただし人手を取られ、' + p.name + ' は次のターン米を生まない'; },
    B: (s) => { for (const c of rivals(s)) c.rel = Math.min(5, c.rel + 1); return 'うわさが広まり、すべての家との仲 +1'; } },
  plague: { title: 'はやり病', text: 'かぜがはやっています。', a: '薬を買う(米 -3)', b: 'いのる',
    A: (s, me) => { me.rice = Math.max(0, me.rice - 3); return '病はおさまった。米 -3'; },
    B: (s) => { const ps = provsOf(s, s.player).filter((p) => p.troops > 2); if (!ps.length) return 'さいわい、病は広がらなかった'; const p = ps[pick(s, ps.length)]; p.troops -= 2; return p.name + ' の兵が 2 つ、ねこんでしまった'; } },
  truce: { title: '不戦の申し出', text: (s, e) => s.clans[e.clan].name + ' が、しばらく争わない約束をもちかけてきました。', a: '受ける(4 ターンの約束)', b: 'ことわる(仲 -1)',
    ok: (s) => s.coalition !== s.player && rivals(s).some((c) => c.pact === 0 && c.rel >= 0),
    setup: (s) => { const l = rivals(s).filter((c) => c.pact === 0 && c.rel >= 0); return { clan: l[pick(s, l.length)].id }; },
    A: (s, me, e) => { const c = s.clans[e.clan]; c.pact = 4 + (has(s, s.player, 'uta') ? 2 : 0); c.intents = c.intents.filter((i) => !(i.t === 'march' && s.provs[i.to].owner === s.player)); return c.name + ' と ' + c.pact + ' ターンの約束を結んだ'; },
    B: (s, me, e) => { const c = s.clans[e.clan]; c.rel = Math.max(-5, c.rel - 1); return c.name + ' はがっかりして帰った'; } },
  carpenter: { title: '腕利きの大工', text: '城づくりの名人が通りかかりました。', a: 'やとう(米 -2、城 +1)', b: '見送る',
    A: (s, me) => { const ps = provsOf(s, s.player).filter((p) => p.castle < 2); if (me.rice < 2 || !ps.length) return 'たのめる仕事がなかった'; const p = ps[pick(s, ps.length)]; me.rice -= 2; p.castle += 1; return p.name + ' の城が固くなった'; },
    B: () => '大工は次の国へ向かった' },
  tax: { title: '年貢の相談', text: '年貢をどうするか、家臣がたずねています。', a: '重くする(米 +4、本拠の石高 -1)', b: '軽くする(米 -2、本拠の石高 +1)',
    A: (s, me) => { const p = homeOrAny(s); me.rice += 4; if (p.koku > 1) p.koku -= 1; return '米 +4。' + p.name + ' の石高は ' + p.koku + ' に'; },
    B: (s, me) => { const p = homeOrAny(s); me.rice = Math.max(0, me.rice - 2); if (p.koku < 6) p.koku += 1; return p.name + ' の石高が ' + p.koku + ' になった'; } },
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

/** 家臣の進言: いま出すとよさそうな命令を上から n 個 */
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
