/*
 * ペンギンずもう — ルール(描画なし・依存なし・乱数なし)
 *
 * 氷の盤面でペンギンを上下左右に滑らせる。何かにぶつかるまで止まらない。
 * 敵にぶつかると 1 ダメージを与え、助走の長さに応じて押し出す。氷の外や穴に落とせば退場。
 * ペンギン自身は氷のふちで止まる。落ちるのは、穴に入ったときと、敵に押し流されたときだけ。
 * 敵は「あと何ターンで動くか」と「どこを狙うか」を先に見せる。
 *
 * 盤面は全部 JSON にできる素のデータ。同じ盤面に同じ手を打てば、必ず同じ結果になる。
 */

export const W = 6, H = 7;
export const ICE = 0, HOLE = 1, ROCK = 2, CRACK = 3;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const DIR_KEYS = ['up', 'down', 'left', 'right'];
const MELT_TURN = 50; // これを超えると氷がとけはじめ、毎ターン ハート -1(必ず終わるための保険)

/** 敵の種類。weight = 押されにくさ(助走 - おもさ = 押される距離)。base = 行動までのターン数 */
export const KINDS = {
  crab:   { ja: 'カニ',     hp: 1, weight: 0, base: 1, text: '毎ターン 1 歩近づく。となりにいるとハサミで攻撃' },
  seal:   { ja: 'アザラシ', hp: 2, weight: 1, base: 2, text: '矢印の向きへ突進。ぶつかるまで止まらない(落ちることも)' },
  gullH:  { ja: 'カモメ',   hp: 1, weight: 0, base: 2, text: '横一列に雪玉。岩や敵のかげには届かない' },
  gullV:  { ja: 'カモメ',   hp: 1, weight: 0, base: 2, text: '縦一列に雪玉。岩や敵のかげには届かない' },
  bear:   { ja: 'シロクマ', hp: 3, weight: 2, base: 3, text: 'ねらったマスの氷を割る。割れた氷は次のターンに穴になる' },
  walrus: { ja: 'セイウチ', hp: 4, weight: 2, base: 3, brace: true, text: '重い突進。最初の 1 回は踏んばって押されない' },
  bomb:   { ja: 'ばくだん', hp: 1, weight: 0, base: 4, object: true, text: 'カウント 0 でまわり 1 マスが爆発。押して動かせる' },
  // ボス
  dosukoi:    { ja: 'ドスコイ', hp: 7, weight: 3, base: 2, boss: true, text: '突進を氷のふちや岩へさそうと、勢いあまって自分が痛い' },
  yukioroshi: { ja: 'ユキオロシ', hp: 8, weight: 9, base: 2, boss: true, anchored: true, text: '動かない。一列まるごとを 2 マス押し流す。ばくだんを近くで爆発させると大ダメージ' },
  nushi:      { ja: '流氷のヌシ', hp: 9, weight: 3, base: 2, boss: true, text: '潮で全員を 1 マス流す番と、足もとの氷を割る番をくり返す' },
};

/** 強化。max = 重ねて取れる回数 */
export const UPGRADES = {
  power:    { ja: 'ちからもち',   text: '押す距離 +1', max: 2 },
  spike:    { ja: 'とげとげ',     text: '体当たりのダメージ +1', max: 1 },
  heart:    { ja: 'たくましい',   text: 'ハートの上限 +1(1 つ回復)', max: 2 },
  brake:    { ja: 'ブレーキ名人', text: 'ブレーキがフロアごとに +1 回', max: 2 },
  snowball: { ja: 'ゆきだま',     text: '止まったあと、正面の敵に雪玉で 1 ダメージ', max: 1 },
  shield:   { ja: 'こおりのたて', text: 'フロアごとに最初の 1 ダメージを防ぐ', max: 1 },
  grip:     { ja: 'ふんばり',     text: 'フロアごとに 1 回、穴に落ちそうなときに手前で止まる', max: 1 },
  chain:    { ja: 'たまつき',     text: '押した敵がぶつかった相手へのダメージ +1', max: 1 },
  heal:     { ja: 'ひとやすみ',   text: 'フロアをクリアするとハートが 1 つ回復', max: 1 },
  crusher:  { ja: 'いわくだき',   text: '敵を岩にぶつけたときのダメージ +1', max: 1 },
  undo:     { ja: 'やりなおし',   text: '「1 手もどす」がフロアごとに +1 回', max: 1 },
  calm:     { ja: 'しずかな朝',   text: 'フロア開始時、敵全員のカウント +1', max: 1 },
};
export const UPGRADE_KEYS = Object.keys(UPGRADES);

// ---- 盤面の道具 --------------------------------------------------------------

const idx = (s, x, y) => y * s.w + x;
export const inBoard = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const cellAt = (s, x, y) => (inBoard(s, x, y) ? s.cells[idx(s, x, y)] : HOLE);
const isPit = (s, x, y) => !inBoard(s, x, y) || s.cells[idx(s, x, y)] === HOLE;
export function enemyAt(s, x, y) { for (const e of s.enemies) if (e.alive && e.x === x && e.y === y) return e; return null; }
const penguinAt = (s, x, y) => s.p.x === x && s.p.y === y;
const up = (s, k) => s.ups[k] || 0;

/** フロアの定義から盤面を作る。def: { cells, start: [x, y], enemies: [{ kind, x, y, count?, dir? }], boss? } */
export function createFloor(def, run) {
  const r = run || {};
  const s = {
    w: W, h: H, cells: def.cells.slice(), crackTimer: {},
    p: { x: def.start[0], y: def.start[1], sx: def.start[0], sy: def.start[1], hearts: r.hearts || 3, maxHearts: r.maxHearts || 3 },
    enemies: [], nextId: 1,
    ups: Object.assign({}, r.ups || {}),
    use: { brake: 0, undo: 0, hint: 0, shield: false, grip: false },
    turn: 1, phase: 'play', boss: def.boss || null, bossStep: 0, sweep: null,
    stats: { bumps: 0, ringOuts: 0, falls: 0, hurt: 0, selfKo: 0, by: {} }, // by = 何にハートを取られたか
    events: [],
  };
  for (const e of def.enemies) addEnemy(s, e.kind, e.x, e.y, e);
  if (up(s, 'calm')) for (const e of s.enemies) if (!KINDS[e.kind].object) e.count += 1;
  for (const e of s.enemies) plan(s, e);
  return s;
}

export function addEnemy(s, kind, x, y, o) {
  const K = KINDS[kind];
  const e = { id: s.nextId++, kind, x, y, hp: K.hp, maxHp: K.hp, weight: K.weight, base: K.base, count: (o && o.count) || K.base,
              dir: (o && o.dir) || 'down', brace: !!K.brace, boss: !!K.boss, object: !!K.object, anchored: !!K.anchored, alive: true, target: null };
  s.enemies.push(e);
  return e;
}

export function cloneState(s) {
  return {
    w: s.w, h: s.h, cells: s.cells.slice(), crackTimer: Object.assign({}, s.crackTimer),
    p: Object.assign({}, s.p), enemies: s.enemies.map((e) => Object.assign({}, e, { target: e.target ? e.target.slice() : null })), nextId: s.nextId,
    ups: s.ups, use: Object.assign({}, s.use), turn: s.turn, phase: s.phase, boss: s.boss, bossStep: s.bossStep,
    sweep: s.sweep ? Object.assign({}, s.sweep) : null, stats: Object.assign({}, s.stats, { by: Object.assign({}, s.stats.by) }), events: [],
  };
}

export const brakesLeft = (s) => 1 + up(s, 'brake') - s.use.brake;
export const undosLeft = (s) => 1 + up(s, 'undo') - s.use.undo;
export const foesLeft = (s) => s.enemies.filter((e) => e.alive && !e.object).length;

// ---- ダメージ・退場 ----------------------------------------------------------

function ko(s, e, how) {
  if (!e.alive) return;
  e.alive = false;
  if (how === 'ring') s.stats.ringOuts++;
  if (how === 'self') s.stats.selfKo++;
  s.events.push({ t: 'ko', id: e.id, how, x: e.x, y: e.y });
}

function hurtEnemy(s, e, n, why) {
  if (!e.alive || e.object || n <= 0) return;
  e.hp -= n;
  s.events.push({ t: 'hit', id: e.id, n, why });
  if (e.hp <= 0) ko(s, e, 'hp');
}

function hurtPlayer(s, n, why) {
  if (s.phase !== 'play' || n <= 0) return;
  if (up(s, 'shield') && !s.use.shield) { s.use.shield = true; s.events.push({ t: 'shield' }); return; }
  s.p.hearts -= n; s.stats.hurt += n; s.stats.by[why] = (s.stats.by[why] || 0) + n;
  s.events.push({ t: 'hurt', n, why });
  if (s.p.hearts <= 0) { s.p.hearts = 0; s.phase = 'lost'; }
}

/** 落ちたペンギンを戻す場所: スタート地点。ふさがっていたら一番近い空きの氷 */
function respawnSpot(s) {
  let best = null, bd = 0;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (s.cells[idx(s, x, y)] !== ICE || enemyAt(s, x, y)) continue;
    const d = Math.abs(x - s.p.sx) + Math.abs(y - s.p.sy);
    if (best === null || d < bd) { best = [x, y]; bd = d; }
  }
  return best;
}

function playerFalls(s) {
  s.stats.falls++;
  s.events.push({ t: 'fall' });
  s.p.hearts -= 1; s.stats.hurt += 1; s.stats.by.fall = (s.stats.by.fall || 0) + 1;
  if (s.p.hearts <= 0) { s.p.hearts = 0; s.phase = 'lost'; return; }
  const spot = respawnSpot(s);
  if (!spot) { s.phase = 'lost'; return; }
  s.p.x = spot[0]; s.p.y = spot[1];
  s.events.push({ t: 'respawn', x: spot[0], y: spot[1] });
}

// ---- 押す --------------------------------------------------------------------

/** e を d の向きへ steps マス押す。途中で落ちる・岩に当たる・ほかの敵に当たる、を処理する */
function pushEntity(s, e, d, steps, byPlayer) {
  const from = [e.x, e.y];
  let left = steps;
  while (left > 0 && e.alive) {
    const nx = e.x + d[0], ny = e.y + d[1];
    if (isPit(s, nx, ny)) {
      if (e.boss) { hurtEnemy(s, e, 2, 'edge'); break; } // ボスは落ちないが、ふちで踏んばって痛い
      s.events.push({ t: 'move', id: e.id, from, to: [nx, ny] });
      e.x = nx; e.y = ny;
      ko(s, e, 'ring');
      return;
    }
    if (s.cells[idx(s, nx, ny)] === ROCK) { if (!e.object) hurtEnemy(s, e, 1 + (byPlayer ? up(s, 'crusher') : 0), 'rock'); break; }
    if (penguinAt(s, nx, ny)) break;
    const f = enemyAt(s, nx, ny);
    if (f) { // 玉突き: 残りの勢いを次の相手に渡す
      if (f.object) pushEntity(s, f, d, left, byPlayer);
      else {
        const braced = f.brace;
        if (braced) { f.brace = false; s.events.push({ t: 'brace', id: f.id }); }
        hurtEnemy(s, f, 1 + (byPlayer ? up(s, 'chain') : 0), 'chain');
        if (f.alive && !braced && !f.anchored && left - f.weight > 0) pushEntity(s, f, d, left - f.weight, byPlayer);
      }
      break;
    }
    e.x = nx; e.y = ny; left--;
  }
  if (e.alive && (e.x !== from[0] || e.y !== from[1])) s.events.push({ t: 'move', id: e.id, from, to: [e.x, e.y] });
}

/** ペンギンが助走 r マスで敵 e にぶつかった */
function bump(s, e, d, r) {
  s.stats.bumps++;
  s.events.push({ t: 'bump', id: e.id, r });
  if (e.object) { pushEntity(s, e, d, Math.max(1, r + up(s, 'power')), true); return; }
  const braced = e.brace;
  if (braced) { e.brace = false; s.events.push({ t: 'brace', id: e.id }); }
  hurtEnemy(s, e, 1 + up(s, 'spike'), 'bump');
  if (!e.alive || braced || e.anchored) return;
  const p = r + up(s, 'power') - e.weight;
  if (p > 0) pushEntity(s, e, d, p, true);
}

// ---- ペンギンの番 ------------------------------------------------------------

function slidePenguin(s, d, brake) {
  const p = s.p, from = [p.x, p.y];
  let r = 0, bumped = false, fell = false;
  for (;;) {
    if (brake && r >= 1) break;
    const nx = p.x + d[0], ny = p.y + d[1];
    if (!inBoard(s, nx, ny)) break; // 自分で滑ったときは、氷のふちで踏んばって止まる(落ちるのは穴と、押されたときだけ)
    if (isPit(s, nx, ny)) {
      if (up(s, 'grip') && !s.use.grip) { s.use.grip = true; s.events.push({ t: 'grip' }); break; }
      s.events.push({ t: 'move', id: 0, from, to: [nx, ny] });
      fell = true;
      break;
    }
    if (s.cells[idx(s, nx, ny)] === ROCK) break;
    const e = enemyAt(s, nx, ny);
    if (e) { if (r > 0) s.events.push({ t: 'move', id: 0, from, to: [p.x, p.y] }); bump(s, e, d, r); bumped = true; break; }
    p.x = nx; p.y = ny; r++;
  }
  if (fell) { playerFalls(s); return; }
  if (!bumped && r > 0) s.events.push({ t: 'move', id: 0, from, to: [p.x, p.y] });
  if (!bumped && up(s, 'snowball')) { // 雪玉: 正面の最初の敵に 1 ダメージ(岩にさえぎられる)
    let x = p.x + d[0], y = p.y + d[1];
    while (inBoard(s, x, y) && s.cells[idx(s, x, y)] !== ROCK) {
      const e = enemyAt(s, x, y);
      if (e) { if (!e.object) { s.events.push({ t: 'snowball', id: e.id }); hurtEnemy(s, e, 1, 'snowball'); } break; }
      x += d[0]; y += d[1];
    }
  }
}

// ---- 敵の番 ------------------------------------------------------------------

function dirToward(e, p) {
  const dx = p.x - e.x, dy = p.y - e.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? 'right' : 'left';
  if (dy !== 0) return dy > 0 ? 'down' : 'up';
  return 'down';
}

/** 次の行動のねらいを決める(行動した直後と、フロア開始時に呼ぶ。ここで決めた内容を予告として見せる) */
function plan(s, e) {
  const p = s.p;
  if (e.kind === 'seal' || e.kind === 'walrus' || e.kind === 'dosukoi') e.dir = dirToward(e, p);
  else if (e.kind === 'bear') e.target = [p.x, p.y];
  else if (e.kind === 'yukioroshi') {
    // 一列を押し流す: ペンギンのいる行と列を交互にねらう。流す向きは広いほうへ
    const row = s.bossStep % 2 === 0;
    s.sweep = row ? { row: p.y, dir: p.x < s.w / 2 ? 'left' : 'right' } : { col: p.x, dir: p.y < s.h / 2 ? 'up' : 'down' };
  } else if (e.kind === 'nushi') {
    if (s.bossStep % 2 === 0) e.dir = ['left', 'up', 'right', 'down'][(s.bossStep >> 1) % 4];
    else e.target = [Math.min(s.w - 2, p.x), Math.min(s.h - 2, p.y)];
  }
}

function crack(s, x, y) {
  if (!inBoard(s, x, y) || s.cells[idx(s, x, y)] !== ICE) return;
  s.cells[idx(s, x, y)] = CRACK;
  s.crackTimer[idx(s, x, y)] = 2; // 次の敵の番の終わりに穴になる
  s.events.push({ t: 'crack', x, y });
}

/** 突進: ぶつかるまで滑る */
function charge(s, e) {
  const d = DIRS[e.dir], from = [e.x, e.y];
  for (;;) {
    const nx = e.x + d[0], ny = e.y + d[1];
    if (isPit(s, nx, ny)) {
      if (e.boss) { s.events.push({ t: 'move', id: e.id, from, to: [e.x, e.y] }); hurtEnemy(s, e, 2, 'edge'); return; }
      s.events.push({ t: 'move', id: e.id, from, to: [nx, ny] });
      e.x = nx; e.y = ny; ko(s, e, 'self');
      return;
    }
    if (s.cells[idx(s, nx, ny)] === ROCK) {
      if (e.boss) { s.cells[idx(s, nx, ny)] = ICE; s.events.push({ t: 'smash', x: nx, y: ny }); hurtEnemy(s, e, 1, 'rock'); } // ボスは岩を砕くが痛い
      break;
    }
    if (penguinAt(s, nx, ny)) {
      s.events.push({ t: 'move', id: e.id, from, to: [e.x, e.y] });
      hurtPlayer(s, 1, e.kind);
      const px = nx + d[0], py = ny + d[1]; // 1 マス押される(行き先が空いた氷のときだけ)
      if (s.phase === 'play' && inBoard(s, px, py) && s.cells[idx(s, px, py)] !== ROCK && s.cells[idx(s, px, py)] !== HOLE && !enemyAt(s, px, py)) {
        s.events.push({ t: 'move', id: 0, from: [nx, ny], to: [px, py] });
        s.p.x = px; s.p.y = py;
      }
      return;
    }
    const f = enemyAt(s, nx, ny);
    if (f) { if (f.object) pushEntity(s, f, d, 1, false); else hurtEnemy(s, f, 1, 'charge'); break; } // 敵同士でも痛い
    e.x = nx; e.y = ny;
  }
  if (e.x !== from[0] || e.y !== from[1]) s.events.push({ t: 'move', id: e.id, from, to: [e.x, e.y] });
}

function lineCells(s, e, horizontal) {
  const out = [];
  for (const sg of [-1, 1]) {
    let x = e.x + (horizontal ? sg : 0), y = e.y + (horizontal ? 0 : sg);
    while (inBoard(s, x, y) && s.cells[idx(s, x, y)] !== ROCK && !enemyAt(s, x, y)) { out.push([x, y]); x += horizontal ? sg : 0; y += horizontal ? 0 : sg; }
  }
  return out;
}

function explode(s, e) {
  s.events.push({ t: 'explode', id: e.id, x: e.x, y: e.y });
  e.alive = false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = e.x + dx, y = e.y + dy;
    if (!inBoard(s, x, y)) continue;
    if (s.cells[idx(s, x, y)] === ROCK) { s.cells[idx(s, x, y)] = ICE; s.events.push({ t: 'smash', x, y }); }
    const f = enemyAt(s, x, y);
    if (f && f.object) { f.count = 1; continue; } // となりのばくだんは次に誘爆
    if (f) hurtEnemy(s, f, 2, 'bomb');
    if (penguinAt(s, x, y)) hurtPlayer(s, 1, 'bomb');
  }
}

/** 一列(または全員)を d の向きへ steps マス流す。先頭から順に動かす */
function drift(s, list, dirKey, steps) {
  const d = DIRS[dirKey];
  const order = list.slice().sort((a, b) => (b.x * d[0] + b.y * d[1]) - (a.x * d[0] + a.y * d[1]) || a.id - b.id);
  for (const u of order) {
    for (let k = 0; k < steps; k++) {
      if (u.id === 0) {
        if (s.phase !== 'play') break;
        const nx = s.p.x + d[0], ny = s.p.y + d[1];
        if (isPit(s, nx, ny)) { s.events.push({ t: 'move', id: 0, from: [s.p.x, s.p.y], to: [nx, ny] }); playerFalls(s); break; }
        if (s.cells[idx(s, nx, ny)] === ROCK || enemyAt(s, nx, ny)) break;
        s.events.push({ t: 'move', id: 0, from: [s.p.x, s.p.y], to: [nx, ny] });
        s.p.x = nx; s.p.y = ny;
      } else {
        const e = u.ref;
        if (!e.alive) break;
        const nx = e.x + d[0], ny = e.y + d[1];
        if (isPit(s, nx, ny)) { s.events.push({ t: 'move', id: e.id, from: [e.x, e.y], to: [nx, ny] }); e.x = nx; e.y = ny; ko(s, e, 'ring'); break; }
        if (s.cells[idx(s, nx, ny)] === ROCK || enemyAt(s, nx, ny) || penguinAt(s, nx, ny)) break;
        s.events.push({ t: 'move', id: e.id, from: [e.x, e.y], to: [nx, ny] });
        e.x = nx; e.y = ny;
      }
    }
  }
}
const driftList = (s, pred) => {
  const l = [];
  for (const e of s.enemies) if (e.alive && !e.anchored && !e.boss && pred(e.x, e.y)) l.push({ id: e.id, x: e.x, y: e.y, ref: e });
  if (pred(s.p.x, s.p.y)) l.push({ id: 0, x: s.p.x, y: s.p.y });
  return l;
};

function enemyAct(s, e) {
  const p = s.p;
  s.events.push({ t: 'act', id: e.id, kind: e.kind });
  switch (e.kind) {
    case 'crab': { // となりにいれば攻撃。いなければ 1 歩近づくだけ(近づいたターンは攻撃しない = 1 ターンの猶予)
      const dx = p.x - e.x, dy = p.y - e.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) { hurtPlayer(s, 1, 'crab'); break; }
      const tries = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      for (const t of tries) {
        if (t[0] === 0 && t[1] === 0) continue;
        const nx = e.x + t[0], ny = e.y + t[1];
        if (isPit(s, nx, ny) || s.cells[idx(s, nx, ny)] === ROCK || enemyAt(s, nx, ny) || penguinAt(s, nx, ny)) continue;
        s.events.push({ t: 'move', id: e.id, from: [e.x, e.y], to: [nx, ny] });
        e.x = nx; e.y = ny;
        break;
      }
      break;
    }
    case 'seal': case 'walrus': case 'dosukoi': charge(s, e); break;
    case 'gullH': case 'gullV': {
      for (const c of lineCells(s, e, e.kind === 'gullH')) if (penguinAt(s, c[0], c[1])) hurtPlayer(s, 1, 'gull');
      break;
    }
    case 'bear': {
      const t = e.target || [p.x, p.y];
      if (penguinAt(s, t[0], t[1])) hurtPlayer(s, 1, 'bear');
      crack(s, t[0], t[1]);
      break;
    }
    case 'bomb': explode(s, e); return;
    case 'yukioroshi': {
      const sw = s.sweep;
      if (sw) {
        s.events.push({ t: 'sweep', sweep: sw });
        drift(s, driftList(s, sw.row !== undefined ? (x, y) => y === sw.row : (x) => x === sw.col), sw.dir, 2);
      }
      s.bossStep++;
      if (s.bossStep % 3 === 0) { // 3 回に 1 回、ばくだんを落とす
        const spot = bombSpot(s);
        if (spot) { const b = addEnemy(s, 'bomb', spot[0], spot[1], { count: 3 }); s.events.push({ t: 'spawn', id: b.id }); }
      }
      break;
    }
    case 'nushi': {
      if (s.bossStep % 2 === 0) { s.events.push({ t: 'tide', dir: e.dir }); drift(s, driftList(s, () => true), e.dir, 1); }
      else { const t = e.target || [0, 0]; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) crack(s, t[0] + dx, t[1] + dy); }
      s.bossStep++;
      break;
    }
    default: break;
  }
  if (e.alive) { e.count = e.base; plan(s, e); }
}

function bombSpot(s) {
  // ボスからもペンギンからも 2 マス以上はなれた、空いている氷(決まった順に探す)
  const b = s.enemies.find((e) => e.alive && e.boss);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const k = (x * 5 + y * 3 + s.bossStep * 7) % (s.w * s.h), cx = k % s.w, cy = Math.floor(k / s.w);
    if (s.cells[idx(s, cx, cy)] !== ICE || enemyAt(s, cx, cy) || penguinAt(s, cx, cy)) continue;
    if (Math.abs(cx - s.p.x) + Math.abs(cy - s.p.y) < 2) continue;
    if (b && Math.abs(cx - b.x) + Math.abs(cy - b.y) < 2) continue;
    return [cx, cy];
  }
  return null;
}

function enemyPhase(s) {
  const list = s.enemies.slice(); // この番に増えた敵は動かない
  for (const e of list) {
    if (!e.alive || s.phase !== 'play') continue;
    e.count -= 1;
    if (e.count <= 0) enemyAct(s, e);
  }
  if (s.phase !== 'play') return;
  // ひびの入った氷が穴になる
  const broke = [];
  for (const k of Object.keys(s.crackTimer)) {
    s.crackTimer[k] -= 1;
    if (s.crackTimer[k] <= 0) { delete s.crackTimer[k]; if (s.cells[k] === CRACK) { s.cells[k] = HOLE; broke.push(+k); } }
  }
  if (broke.length) {
    s.events.push({ t: 'break', cells: broke });
    for (const e of s.enemies) if (e.alive && broke.indexOf(idx(s, e.x, e.y)) >= 0) { if (e.boss) hurtEnemy(s, e, 1, 'hole'); else ko(s, e, 'ring'); }
    if (broke.indexOf(idx(s, s.p.x, s.p.y)) >= 0) playerFalls(s);
  }
}

function checkWin(s) {
  if (s.phase !== 'play') return;
  const boss = s.boss ? s.enemies.some((e) => e.alive && e.boss) : false;
  if (s.boss ? !boss : foesLeft(s) === 0) s.phase = 'won';
}

/**
 * 1 手。dir = 'up' | 'down' | 'left' | 'right'、brake = 1 マスだけ進む(回数制限あり)。
 * 盤面 s を書き換える。出来事は s.events に溜まる。
 */
export function act(s, dir, brake) {
  if (s.phase !== 'play' || !DIRS[dir]) return false;
  const useBrake = !!brake && brakesLeft(s) > 0;
  if (useBrake) s.use.brake++;
  slidePenguin(s, DIRS[dir], useBrake);
  checkWin(s);
  if (s.phase === 'play') { enemyPhase(s); checkWin(s); }
  if (s.phase === 'play') {
    s.turn++;
    if (s.turn > MELT_TURN) { s.events.push({ t: 'melt' }); s.p.hearts -= 1; s.stats.by.melt = (s.stats.by.melt || 0) + 1; if (s.p.hearts <= 0) { s.p.hearts = 0; s.phase = 'lost'; } }
  }
  return true;
}

/** 次の敵の番で動く敵の予告。画面に描く用 */
export function intents(s) {
  const out = [];
  for (const e of s.enemies) {
    if (!e.alive || e.count !== 1) continue;
    if (e.kind === 'crab') out.push({ id: e.id, kind: 'melee', cells: [[e.x + 1, e.y], [e.x - 1, e.y], [e.x, e.y + 1], [e.x, e.y - 1]].filter((c) => inBoard(s, c[0], c[1])) });
    else if (e.kind === 'seal' || e.kind === 'walrus' || e.kind === 'dosukoi') {
      const d = DIRS[e.dir], cells = [];
      let x = e.x + d[0], y = e.y + d[1];
      while (inBoard(s, x, y) && s.cells[idx(s, x, y)] !== ROCK && s.cells[idx(s, x, y)] !== HOLE && !enemyAt(s, x, y)) { cells.push([x, y]); x += d[0]; y += d[1]; }
      out.push({ id: e.id, kind: 'charge', dir: e.dir, cells });
    } else if (e.kind === 'gullH' || e.kind === 'gullV') out.push({ id: e.id, kind: 'line', cells: lineCells(s, e, e.kind === 'gullH') });
    else if (e.kind === 'bear') out.push({ id: e.id, kind: 'crack', cells: e.target ? [e.target] : [] });
    else if (e.kind === 'bomb') {
      const cells = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inBoard(s, e.x + dx, e.y + dy)) cells.push([e.x + dx, e.y + dy]);
      out.push({ id: e.id, kind: 'blast', cells });
    } else if (e.kind === 'yukioroshi' && s.sweep) {
      const cells = [];
      if (s.sweep.row !== undefined) for (let x = 0; x < s.w; x++) cells.push([x, s.sweep.row]); else for (let y = 0; y < s.h; y++) cells.push([s.sweep.col, y]);
      out.push({ id: e.id, kind: 'sweep', dir: s.sweep.dir, cells });
    } else if (e.kind === 'nushi') {
      if (s.bossStep % 2 === 0) out.push({ id: e.id, kind: 'tide', dir: e.dir, cells: [] });
      else { const t = e.target || [0, 0]; out.push({ id: e.id, kind: 'crack', cells: [[t[0], t[1]], [t[0] + 1, t[1]], [t[0], t[1] + 1], [t[0] + 1, t[1] + 1]].filter((c) => inBoard(s, c[0], c[1])) }); }
    }
  }
  return out;
}

/** 盤面を文字列にする(同じ盤面かどうかの判定と、再現性の確認用) */
export function stateKey(s) {
  let k = s.p.x + ',' + s.p.y + ',' + s.p.hearts + '|' + s.cells.join('') + '|' + s.bossStep + '|' + s.use.brake + (s.use.shield ? 's' : '') + (s.use.grip ? 'g' : '');
  for (const e of s.enemies) if (e.alive) k += '|' + e.id + e.kind + e.x + ',' + e.y + ',' + e.hp + ',' + e.count + e.dir + (e.brace ? 'b' : '') + (e.target ? e.target.join(':') : '');
  for (const c of Object.keys(s.crackTimer)) k += '|c' + c + ':' + s.crackTimer[c];
  return k + (s.sweep ? '|w' + JSON.stringify(s.sweep) : '');
}

/** 整数だけの乱数 */
export function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
