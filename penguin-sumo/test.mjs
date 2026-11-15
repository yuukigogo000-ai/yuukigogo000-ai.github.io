// ペンギンずもうの検査(node test.mjs)。--mutate で検査器自身が壊れたルールを見つけられるか確かめる。
import * as C from './src/core.js';
import * as R from './src/run.js';
import { solve, bestMove, moves } from './src/solver.js';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }
// 盤面を絵で書く: . 氷 / o 穴 / # 岩 / P ペンギン。敵は別に渡す
function board(rows, enemies, run) {
  const cells = []; let start = [0, 0];
  rows.forEach((row, y) => row.split('').forEach((ch, x) => { cells.push(ch === 'o' ? C.HOLE : ch === '#' ? C.ROCK : C.ICE); if (ch === 'P') start = [x, y]; }));
  while (cells.length < C.W * C.H) cells.push(C.ICE);
  return C.createFloor({ cells, start, enemies: enemies || [] }, run);
}
const E = (s, kind) => s.enemies.find((e) => e.kind === kind);
const far = { kind: 'gullH', x: 5, y: 6, count: 9 }; // 勝ちにならないように遠くに置く的

// ---- 滑る --------------------------------------------------------------------
{
  let s = board(['......', '......', '..#...', '......', '......', '..P...', '......'], [far]); C.act(s, 'up');
  ok('岩にぶつかるまで滑る', s.p.x === 2 && s.p.y === 3, [s.p.x, s.p.y]);
  s = board(['......', '......', '......', '......', '......', '..P...', '......'], [far]); C.act(s, 'up');
  ok('止めるものがなければ氷のふちで止まる(自分では落ちない)', s.p.hearts === 3 && s.p.x === 2 && s.p.y === 0 && s.stats.falls === 0, s.p);
  s = board(['......', '......', '......', '......', '......', '..P...', '......'], [far]); C.act(s, 'up', true);
  ok('ブレーキ: 1 マスだけ進む', s.p.y === 4 && C.brakesLeft(s) === 0, [s.p.y, C.brakesLeft(s)]);
  C.act(s, 'left', true);
  ok('ブレーキは回数が尽きると効かない(端まで滑る)', s.p.x === 0, s.p);
  s = board(['......', '......', '..o...', '......', '......', '..P...', '......'], [far]); C.act(s, 'up');
  ok('穴に入ると落ちる(ハート -1 でスタート地点に戻る)', s.stats.falls === 1 && s.p.hearts === 2 && s.p.x === 2 && s.p.y === 5, s.p);
}
// ---- 押す: 助走 - おもさ = 押す距離 -------------------------------------------
{
  const mk = (kind, py) => board(['......', '......', '......', '......', '......', '......', '......'].map((r, y) => (y === py ? '..P...' : r)), [{ kind, x: 2, y: 2, count: 9 }, far]);
  let s = mk('crab', 3); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('助走 0(となり)だと、軽い敵でも押せない', s.enemies[0].y === 2 && s.enemies[0].hp === 4, s.enemies[0]);
  s = mk('crab', 5); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('助走 2 で軽い敵(おもさ 0)は 2 マス押される', s.enemies[0].y === 0, s.enemies[0].y);
  s = mk('seal', 5); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('助走 2 でふつうの敵(おもさ 1)は 1 マス', s.enemies[0].y === 1, s.enemies[0].y);
  s = mk('bear', 5); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('助走 2 で重い敵(おもさ 2)は動かない', s.enemies[0].y === 2, s.enemies[0].y);
  s = mk('crab', 6); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('助走 3 で軽い敵は氷の外へ(場外)', !s.enemies[0].alive && s.stats.ringOuts === 1, s.stats);
  s = mk('crab', 5); C.act(s, 'up');
  ok('ぶつかると 1 ダメージ(体力 1 のカニは倒れる)', !s.enemies[0].alive);
  s = mk('walrus', 6); C.act(s, 'up');
  ok('セイウチ: 最初の 1 回は踏んばって押されない', s.enemies[0].y === 2 && s.enemies[0].brace === false && s.enemies[0].hp === 3, s.enemies[0]);
}
// ---- 玉突き・岩・穴 ----------------------------------------------------------
{
  let s = board(['......', '......', '......', '......', '......', '......', '..P...'], [{ kind: 'crab', x: 2, y: 3, count: 9 }, { kind: 'crab', x: 2, y: 2, count: 9 }, far]);
  s.enemies[0].hp = 5; s.enemies[1].hp = 5; C.act(s, 'up');
  ok('玉突き: 押された敵が次の敵にぶつかってダメージと勢いを渡す', s.enemies[1].hp === 4 && s.enemies[1].y < 2, s.enemies.map((e) => [e.y, e.hp]));
  s = board(['......', '..#...', '......', '......', '......', '......', '..P...'], [{ kind: 'crab', x: 2, y: 3, count: 9 }, far]); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('岩にぶつけると追加で 1 ダメージ', s.enemies[0].hp === 3 && s.enemies[0].y === 2, s.enemies[0]);
  s = board(['......', '..o...', '......', '......', '......', '......', '..P...'], [{ kind: 'crab', x: 2, y: 3, count: 9 }, far]); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('穴に落とすと退場', !s.enemies[0].alive && s.stats.ringOuts === 1);
}
// ---- 敵の行動と予告 ----------------------------------------------------------
{
  let s = board(['......', '......', '......', '......', '......', '..P...', '......'], [{ kind: 'crab', x: 2, y: 2 }, far]); C.act(s, 'left', true);
  ok('カニ: 毎ターン 1 歩近づく', E(s, 'crab').x + E(s, 'crab').y !== 4, E(s, 'crab'));
  s = board(['......', '......', '......', '......', '..P...', '......', '......'], [{ kind: 'crab', x: 2, y: 2 }, far]); C.act(s, 'left', true); // カニは (2,3) → となりではない
  s = board(['......', '......', '......', '......', '#.P...', '......', '......'], [{ kind: 'crab', x: 2, y: 2 }, far]); C.act(s, 'left');
  ok('カニ: 近づいたターンは攻撃しない(1 ターンの猶予)', s.p.hearts === 3 && Math.abs(E(s, 'crab').x - s.p.x) + Math.abs(E(s, 'crab').y - s.p.y) >= 1, [s.p, E(s, 'crab')]);
  s = board(['......', '......', '......', '......', '#P....', '......', '......'], [{ kind: 'crab', x: 2, y: 4 }, far]); C.act(s, 'left');
  ok('カニ: となりにいると攻撃', s.p.hearts === 2, s.p.hearts);
  s = board(['......', '......', '......', '......', '......', '#.P...', '......'], [{ kind: 'seal', x: 2, y: 1, count: 1 }, far]);
  ok('予告: 突進の向きと、よけた場合の通り道が端まで出る', C.intents(s).some((i) => i.kind === 'charge' && i.dir === 'down' && i.cells.length === 5), C.intents(s));
  C.act(s, 'left'); // ペンギンは (1,5) へ。アザラシは下へ突進して外へ落ちる
  ok('アザラシ: よけると突進で自分が落ちる', !E(s, 'seal').alive && s.stats.selfKo === 1 && s.p.hearts === 3, { alive: E(s, 'seal').alive, hearts: s.p.hearts });
  s = board(['......', '......', '......', '......', '......', '..P...', '..#...'], [{ kind: 'seal', x: 2, y: 1, count: 1 }, far]); C.act(s, 'down');
  ok('アザラシ: 当たるとハート -1', s.p.hearts === 2, s.p.hearts);
  s = board(['......', '......', '......', '#P....', '......', '......', '......'], [{ kind: 'gullH', x: 5, y: 3, count: 1 }, far]); C.act(s, 'left');
  ok('カモメ: 同じ列にいると雪玉が当たる', s.p.hearts === 2, s.p.hearts);
  s = board(['......', '......', '......', '#P.#..', '......', '......', '......'], [{ kind: 'gullH', x: 5, y: 3, count: 1 }, far]); C.act(s, 'left');
  ok('カモメ: 岩のかげには届かない', s.p.hearts === 3, s.p.hearts);
  s = board(['......', '......', '......', '#P....', '......', '......', '......'], [{ kind: 'bear', x: 5, y: 0, count: 1 }, far]);
  ok('予告: シロクマは割るマスを見せる', C.intents(s).some((i) => i.kind === 'crack' && i.cells[0][0] === 1 && i.cells[0][1] === 3));
  C.act(s, 'left');
  ok('シロクマ: ねらったマスにいると痛い+氷にひび', s.p.hearts === 2 && C.cellAt(s, 1, 3) === C.CRACK, [s.p.hearts, C.cellAt(s, 1, 3)]);
  C.act(s, 'down', true);
  ok('ひびの入った氷は次のターンに穴になる', C.cellAt(s, 1, 3) === C.HOLE, C.cellAt(s, 1, 3));
  s = board(['......', '......', '..#...', '......', '......', '#P....', '......'], [{ kind: 'bomb', x: 3, y: 3, count: 1 }, { kind: 'crab', x: 4, y: 3, count: 9 }, far]); s.enemies[1].hp = 5; C.act(s, 'left');
  ok('ばくだん: まわりの敵に 2 ダメージ、岩をこわす', s.enemies[1].hp === 3 && C.cellAt(s, 2, 2) === C.ICE && !s.enemies[0].alive, [s.enemies[1].hp, C.cellAt(s, 2, 2)]);
  s = board(['......', '......', '......', '......', '......', '...P..', '......'], [{ kind: 'bomb', x: 3, y: 3, count: 5 }, far]); C.act(s, 'up');
  ok('ばくだんは押して動かせる', s.enemies[0].y < 3 || !s.enemies[0].alive, s.enemies[0]);
}
// ---- ボス --------------------------------------------------------------------
{
  let s = C.createFloor({ cells: new Array(42).fill(0), start: [0, 6], enemies: [{ kind: 'dosukoi', x: 3, y: 2, count: 1, dir: 'down' }], boss: 'dosukoi' });
  s.enemies[0].dir = 'right'; C.act(s, 'right', true);
  ok('ドスコイ: ふちまで突進して自分が 2 ダメージ', s.enemies[0].hp === 5 && s.enemies[0].x === 5 && s.enemies[0].alive, s.enemies[0]);
  s = C.createFloor({ cells: new Array(42).fill(0), start: [1, 5], enemies: [{ kind: 'yukioroshi', x: 3, y: 2, count: 1 }], boss: 'yukioroshi' });
  const sw = JSON.stringify(s.sweep);
  ok('ユキオロシ: 押し流す列を予告する', C.intents(s).some((i) => i.kind === 'sweep' && i.cells.length >= 6), s.sweep);
  C.act(s, 'right', true); // (2,5) へ。行 5 が左へ 2 マス流される → (0,5)
  ok('ユキオロシ: 予告した列にいると 2 マス流される', s.p.x === 0 && s.p.y === 5, [s.p.x, s.p.y, sw]);
  s = C.createFloor({ cells: new Array(42).fill(0), start: [2, 5], enemies: [{ kind: 'nushi', x: 3, y: 1, count: 1 }], boss: 'nushi' });
  C.act(s, 'right', true); // (3,5) → 潮で左へ 1 マス
  ok('流氷のヌシ: 潮で 1 マス流される', s.p.x === 2, s.p.x);
  ok('ボスを倒すと勝ち(取り巻きが残っていても)', (() => { const b = C.createFloor({ cells: new Array(42).fill(0), start: [3, 6], enemies: [{ kind: 'dosukoi', x: 3, y: 4, count: 9 }, { kind: 'crab', x: 0, y: 0, count: 9 }], boss: 'dosukoi' }); b.enemies[0].hp = 1; C.act(b, 'up'); return b.phase === 'won'; })());
}
// ---- 強化 --------------------------------------------------------------------
{
  const mk = (ups, py) => board(['......', '......', '......', '......', '......', '......', '......'].map((r, y) => (y === (py || 5) ? '..P...' : r)), [{ kind: 'seal', x: 2, y: 2, count: 9 }, far], { ups, hearts: 3, maxHearts: 3 });
  let s = mk({ power: 1 }); s.enemies[0].hp = 9; C.act(s, 'up'); ok('ちからもち: 押す距離 +1', s.enemies[0].y === 0, s.enemies[0].y);
  s = mk({ spike: 1 }); s.enemies[0].hp = 9; C.act(s, 'up'); ok('とげとげ: ダメージ +1', s.enemies[0].hp === 7, s.enemies[0].hp);
  s = mk({ brake: 1 }); ok('ブレーキ名人: 回数 +1', C.brakesLeft(s) === 2);
  s = board(['......', '......', '......', '......', '......', '..P...', '......'], [{ kind: 'seal', x: 2, y: 0, count: 9 }, far], { ups: { snowball: 1 } }); s.enemies[0].hp = 9; C.act(s, 'up', true);
  ok('ゆきだま: 止まったあと正面の敵に 1 ダメージ', s.enemies[0].hp === 8, s.enemies[0].hp);
  s = board(['......', '......', '......', '#P....', '......', '......', '......'], [{ kind: 'gullH', x: 5, y: 3, count: 1 }, far], { ups: { shield: 1 } }); C.act(s, 'left');
  ok('こおりのたて: 最初の 1 ダメージを防ぐ', s.p.hearts === 3 && s.use.shield === true);
  s = board(['......', '......', '..o...', '......', '......', '..P...', '......'], [far], { ups: { grip: 1 } }); C.act(s, 'up');
  ok('ふんばり: 穴の手前で止まる(フロアに 1 回)', s.p.y === 3 && s.p.hearts === 3 && s.stats.falls === 0 && s.use.grip === true, s.p);
  s = board(['......', '......', '......', '......', '......', '..P...', '......'], [{ kind: 'seal', x: 2, y: 1, count: 2 }, far], { ups: { calm: 1 } });
  ok('しずかな朝: 敵のカウント +1', s.enemies[0].count === 3, s.enemies[0].count);
  const run = R.newRun(1); R.takeUpgrade(run, 'heart');
  ok('たくましい: 上限 +1', run.maxHearts === 4 && run.floor === 1, run);
  const offers = R.offerUpgrades(5, 3, { power: 2, spike: 1 });
  ok('強化の候補: 3 つ、上限まで取ったものは出ない', offers.length === 3 && new Set(offers).size === 3 && !offers.includes('power') && !offers.includes('spike'), offers);
}
// ---- 自動生成: 再現性・必ず解ける -------------------------------------------
{
  let same = true, solvable = 0, total = 0, fallback = 0, bossOk = 0;
  for (let seed = 1; seed <= 12; seed++) for (let f = 0; f < R.TOTAL_FLOORS; f++) {
    const a = R.makeFloor(seed, f), b = R.makeFloor(seed, f);
    if (JSON.stringify(a.def) !== JSON.stringify(b.def)) same = false;
    if (a.tries > 60) fallback++;
    total++;
    // 記録された手数で本当に勝てるか、もう一度確かめる
    const r = solve(C.createFloor(a.def, { hearts: 3, maxHearts: 3, ups: {} }), a.def.boss ? { beam: 140, depth: 44 } : { beam: 90, depth: 30 });
    if (r.won && r.path.length === a.par) solvable++;
    if (a.def.boss && f % 5 === 4) bossOk++;
  }
  ok('自動生成: 同じ種なら同じフロア', same);
  ok('自動生成: 180 フロアすべて解ける', solvable === total, [solvable, total]);
  ok('自動生成: 逃げ道の簡単フロアに落ちていない', fallback === 0, fallback);
  ok('自動生成: 5 フロアごとにボス', bossOk === 36, bossOk);
}
// ---- でたらめな手で壊れない --------------------------------------------------
{
  let bad = 0, stuck = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rnd = C.mulberry32(seed), f = R.makeFloor(seed, seed % 15), s = C.createFloor(f.def, { hearts: 3, maxHearts: 3, ups: { power: seed % 3, snowball: seed % 2, grip: 1 } });
    let n = 0;
    while (s.phase === 'play' && n < 200) { const ms = moves(s), m = ms[Math.floor(rnd() * ms.length)]; C.act(s, m.dir, m.brake); s.events = []; n++; }
    if (s.phase === 'play') stuck++;
    // 負けた瞬間は落ちた場所のままなので、続いている盤面だけ調べる
    if (s.phase !== 'lost' && (!C.inBoard(s, s.p.x, s.p.y) || C.cellAt(s, s.p.x, s.p.y) === C.HOLE || C.cellAt(s, s.p.x, s.p.y) === C.ROCK)) bad++;
    for (const e of s.enemies) if (e.alive && (!C.inBoard(s, e.x, e.y) || C.cellAt(s, e.x, e.y) === C.HOLE || C.cellAt(s, e.x, e.y) === C.ROCK || (e.x === s.p.x && e.y === s.p.y))) bad++;
    const seen = new Set(); for (const e of s.enemies) if (e.alive) { const k = e.x + ',' + e.y; if (seen.has(k)) bad++; seen.add(k); }
  }
  ok('でたらめな手 200 フロア: 必ず終わる(氷がとける保険を含む)', stuck === 0, stuck);
  ok('でたらめな手 200 フロア: 重なり・穴の上・盤外が起きない', bad === 0, bad);
}
// ---- ランの進行 --------------------------------------------------------------
{
  const run = R.newRun(42);
  let fl = R.startFloor(run), guard = 0;
  while (!run.over && guard++ < 400) {
    const m = bestMove(fl.state, 3);
    C.act(fl.state, m.dir, m.brake); fl.state.events = [];
    if (fl.state.phase === 'won') { const w = R.winFloor(run, fl.state, fl.quickTurns); if (!w.finished) { R.takeUpgrade(run, w.offers[0]); fl = R.startFloor(run); } }
    else if (fl.state.phase === 'lost') R.loseRun(run, fl.state);
  }
  ok('通しで遊ぶと、勝ちか負けで終わる', run.over === 'won' || run.over === 'lost', run);
  const r2 = R.newRun(7); const f2 = R.startFloor(r2); f2.state.p.hearts = 2;
  ok('あきらめて次へ: ハート -1 で次のフロアへ', R.skipFloor(r2, f2.state) === true && r2.hearts === 1 && r2.floor === 1, r2);
  ok('日替わりの種は日付で決まる', R.dailySeed('2026-11-15') === R.dailySeed('2026-11-15') && R.dailySeed('2026-11-15') !== R.dailySeed('2026-11-16'));
}

if (process.argv.includes('--mutate')) {
  // わざと間違った期待を書いて、検査がそれを落とすかを見る(検査器が「何でも通す」状態でないことの確認)
  const before = fail;
  const s = board(['......', '......', '......', '......', '......', '......', '..P...'], [{ kind: 'crab', x: 2, y: 2, count: 9 }, far]); s.enemies[0].hp = 5; C.act(s, 'up');
  ok('【わざと間違い】助走 3 でも軽い敵は残る', s.enemies[0].alive);
  ok('【わざと間違い】穴に落ちてもハートは減らない', (() => { const t = board(['......', '......', '..o...', '......', '......', '..P...', '......'], [far]); C.act(t, 'up'); return t.p.hearts === 3; })());
  ok('【わざと間違い】違う種でも同じフロア', JSON.stringify(R.makeFloor(1, 3).def) === JSON.stringify(R.makeFloor(2, 3).def));
  const caught = fail - before;
  fail = before; failures.splice(failures.length - caught, caught);
  console.log(`自己検査: わざと間違えた 3 件中 ${caught} 件を検出`);
  if (caught !== 3) process.exitCode = 1;
}
console.log(`\n${pass} 件合格 / ${fail} 件不合格`);
for (const f of failures) console.log('  不合格: ' + f);
if (fail) process.exitCode = 1;
