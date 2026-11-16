// おはじきバトル エンジンの検査(node test.mjs)。--mutate で検査器自身が壊れたルールを見つけられるか確かめる。
import * as E from './engine.js';
import { ally, foe, mobBattle, bossBattle, LINEAGE_KEYS, LINEAGES, ITEM_KEYS, PASSIVE_KEYS, EVOLUTIONS } from './data.js';
import { DIRS, POWERS, bestShot } from './ai.js';

const FUZZ = 150; // でたらめな手で回す戦闘の数
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) { if (process.env.TRACE) console.log('·', name); if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }
const U = (s, name) => s.units.find((u) => u.name === name);
const fire = (s, dx, dy, power, ult) => { E.shoot(s, { dx, dy, power, ult: !!ult }); E.resolve(s); return s; };
// 1 体ずつの小さな盤面を作る(切れ目なし)
const NOGAP = { top: [], bottom: [], left: [], right: [] };
function mini(allies, enemies, extra) { return E.createBattle(Object.assign({ gaps: NOGAP, allies, enemies }, extra)); }
function travel(s, name, input) {
  const u = U(s, name); let px = u.x, py = u.y, d = 0;
  E.shoot(s, input, { preview: true });
  while (s.phase === 'resolving') { E.step(s); d += Math.sqrt((u.x - px) * (u.x - px) + (u.y - py) * (u.y - py)); px = u.x; py = u.y; }
  return d;
}
const dummy = (x, y, o) => Object.assign({ name: 'まと', hp: 100, atk: 10, weight: 3, action: 'blast', count: 9, actR: 10, x, y }, o);

// ---- 基本: 当てるとダメージ、強さで押す距離が変わる -------------------------
{
  const mk = () => mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 250)]);
  const s1 = fire(mk(), 0, -1, 1), s3 = fire(mk(), 0, -1, 3);
  ok('当てるとダメージが入る', U(s1, 'まと').hp < 100, U(s1, 'まと').hp);
  ok('弱い手は攻撃力そのまま(19)', 100 - U(s1, 'まと').hp === Math.round(19 * 1), 100 - U(s1, 'まと').hp);
  ok('強い手は強打で 1.5 倍', 100 - U(s3, 'まと').hp >= Math.round(19 * 1.5), 100 - U(s3, 'まと').hp);
  const t1 = travel(mk(), 'まと', { dx: 0, dy: -1, power: 1 }), t3 = travel(mk(), 'まと', { dx: 0, dy: -1, power: 3 });
  ok('強い手のほうが相手を遠くへ押す', t3 > t1 * 1.5, [Math.round(t1), Math.round(t3)]);
}
// ---- おもさ: 重い相手ほど動かない -------------------------------------------
{
  const push = (w) => travel(mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 250, { weight: w })]), 'まと', { dx: 0, dy: -1, power: 2 });
  const d = [1, 2, 3, 4, 5].map(push);
  ok('おもさ 1→5 で押される距離が単調に減る', d[0] > d[1] && d[1] > d[2] && d[2] > d[3] && d[3] > d[4], d.map((v) => Math.round(v)));
}
// ---- はがれかけ: 体力が半分より多いと落ちない -------------------------------
{
  const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
  const mk = (hp) => E.createBattle({ gaps, allies: [Object.assign(ally('machine'), { name: 'A', x: 180, y: 300, touch: null, atk: 1 })], enemies: [Object.assign(dummy(180, 60, { weight: 1 }), { hp: 100 })].map((e) => { e.hpNow = hp; return e; }) });
  const full = mk(100); fire(full, 0, -1, 3);
  ok('体力満タンの敵は切れ目でも落ちない', U(full, 'まと').alive, U(full, 'まと'));
  const half = mk(100); U(half, 'まと').hp = 50; fire(half, 0, -1, 3);
  ok('体力半分以下の敵は落ちる', !U(half, 'まと').alive && half.stats.enemyRing === 1, { alive: U(half, 'まと').alive, ring: half.stats.enemyRing });
  ok('落とすと勝ち(敵が残っていなければ)', half.phase === 'won', half.phase);
}
// ---- 味方が落ちたら体力 3 割を失って戻る ------------------------------------
{
  const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
  const s = E.createBattle({ gaps, allies: [Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 200, touch: null })], enemies: [dummy(40, 480)] });
  U(s, 'A').hp = 40; // 半分以下
  fire(s, 0, -1, 3);
  const a = U(s, 'A');
  ok('味方は落ちても退場しない', a.alive && s.stats.allyFalls === 1, { alive: a.alive, falls: s.stats.allyFalls });
  ok('落ちた味方は体力 3 割を失う', a.hp === 40 - Math.round(80 * 0.3), a.hp);
  ok('落ちた味方は元の位置に戻る', a.x === 180 && a.y === 200, [a.x, a.y]);
}
// ---- タッチ技 12 種 ----------------------------------------------------------
function touchCase(lin) {
  // A(弾く役・技なし)が B(技を持つ役)に当たる。B の近くに敵 1 体
  return mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null, atk: 1 }), Object.assign(ally(lin), { name: 'B', x: 180, y: 360 }),
               Object.assign(ally('furniture'), { name: 'C', x: 60, y: 470, touch: null })],
              [dummy(180, 250), dummy(300, 60, { name: 'とおい' })]);
}
{
  let s = fire(touchCase('kitchen'), 0, -1, 2); ok('一閃: 近い敵に攻撃力の 1.5 倍以上', 100 - U(s, 'まと').hp >= Math.round(19 * 1.5), 100 - U(s, 'まと').hp);
  s = touchCase('food'); U(s, 'C').hp = 50; fire(s, 0, -1, 2); ok('給食: 一番弱った味方を回復', U(s, 'C').hp > 50, U(s, 'C').hp);
  s = touchCase('stationery'); U(s, 'とおい').hp = 30; fire(s, 0, -1, 2); ok('狙撃: 一番はがれかけた敵に当たる(遠くても)', U(s, 'とおい').hp < 30, U(s, 'とおい').hp);
  s = fire(touchCase('book'), 0, -1, 2); ok('読み聞かせ: 近い敵のカウント+1', U(s, 'まと').count === 9 + 1 - 1, U(s, 'まと').count);
  s = touchCase('plant'); E.shoot(s, { dx: 0, dy: -1, power: 2 }); while (s.phase === 'resolving' && s.motion) E.step(s);
  ok('胞子: 周りの敵に毒', U(s, 'まと').poison >= 2, U(s, 'まと').poison);
  s = fire(touchCase('creature'), 0, -1, 1); ok('追撃: 触られた生き物が敵へ飛び出して当たる', U(s, 'まと').hp < 100 && U(s, 'B').y < 360, { hp: U(s, 'まと').hp, y: U(s, 'B').y });
  s = fire(touchCase('machine'), 0, -1, 1); ok('起動: 周りの敵を吹き飛ばす', U(s, 'まと').y < 240, U(s, 'まと').y);
  s = touchCase('electronic'); { const before = U(s, 'B').ultCharge; fire(s, 0, -1, 1); ok('充電: 次に弾く味方の必殺が進む', U(s, 'B').ultCharge >= before + 2, [before, U(s, 'B').ultCharge]); }
  s = touchCase('clothing'); E.shoot(s, { dx: 0, dy: -1, power: 1 }); while (s.phase === 'resolving' && s.motion) E.step(s);
  ok('重ね着: 近くの味方に盾', U(s, 'B').shield > 0 && U(s, 'A').shield > 0, [U(s, 'A').shield, U(s, 'B').shield]);
  s = touchCase('furniture'); E.shoot(s, { dx: 0, dy: -1, power: 3 }); while (s.phase === 'resolving' && s.motion) E.step(s);
  ok('居座り: 触られた家具は動かない壁になる', U(s, 'B').anchored && U(s, 'B').x === 180 && U(s, 'B').y === 360, [U(s, 'B').x, U(s, 'B').y]);
  s = fire(touchCase('toy'), 0, -1, 1); ok('びっくり箱: 周りの敵のカウント+1', U(s, 'まと').count === 9, U(s, 'まと').count);
  s = touchCase('bath'); U(s, 'C').poison = 3; E.shoot(s, { dx: 0, dy: -1, power: 1 }); while (s.phase === 'resolving' && s.motion) E.step(s);
  ok('洗浄: 味方の毒を消し、滑る床を作る', U(s, 'C').poison === 0 && s.patches.some((p) => p.kind === 'wet'), { poison: U(s, 'C').poison, patches: s.patches.length });
}
// ---- 必殺技 ------------------------------------------------------------------
{
  const s0 = mini([ally('kitchen')], [dummy(180, 250)]);
  ok('必殺は最初は使えない', !E.canUlt(s0), s0.units[0].ultCharge);
  // 自分の番が ultNeed 回来たら使える
  for (const lin of LINEAGE_KEYS) {
    const s = mini([Object.assign(ally(lin), { name: 'A', x: 180, y: 470 })], [dummy(180, 60, { hp: 9999 })]);
    let turns = 1;
    while (!E.canUlt(s) && turns < 10) { fire(s, 1, 0, 1); turns++; }
    ok('必殺: ' + lin + ' は ' + LINEAGES[lin].ultNeed + ' 回目の番で使える', turns === LINEAGES[lin].ultNeed, turns);
  }
  const ready = (lin, enemies, extra) => { const s = mini([Object.assign(ally(lin), { name: 'A', x: 180, y: 420 })].concat(extra || []), enemies); s.units[0].ultCharge = s.units[0].ultNeed; return s; };
  let s = ready('kitchen', [dummy(180, 300), dummy(180, 180, { name: 'うしろ' })]);
  E.shoot(s, { dx: 0, dy: -1, power: 3, ult: true });
  ok('必殺を使うと溜め直しになる', s.units[0].ultCharge === 0, s.units[0].ultCharge);
  E.resolve(s);
  ok('大なぎ払い: 貫通して 2 体とも 2 倍で当たる', U(s, 'まと').hp <= 100 - 19 * 2 && U(s, 'うしろ').hp <= 100 - 19 * 2, [U(s, 'まと').hp, U(s, 'うしろ').hp]);
  s = ready('food', [dummy(40, 40)], [Object.assign(ally('kitchen'), { name: 'C', x: 60, y: 470, touch: null })]); U(s, 'C').hp = 20; fire(s, 1, 0, 1, true);
  ok('おかわり: 味方全員を回復', U(s, 'C').hp > 20, U(s, 'C').hp);
  s = ready('stationery', [dummy(180, 250)]); U(s, 'まと').hp = 50; fire(s, 0, -1, 3, true);
  ok('定規ショット: はがれかけの敵は即退場', !U(s, 'まと').alive, U(s, 'まと').hp);
  s = fire(ready('book', [dummy(40, 40)]), 1, 0, 1, true); ok('朗読会: 敵全員のカウント+2', U(s, 'まと').count === 9 + 2 - 1, U(s, 'まと').count);
  s = ready('plant', [dummy(40, 40)]); E.shoot(s, { dx: 1, dy: 0, power: 1, ult: true }); ok('大繁殖: 敵全員に毒', U(s, 'まと').poison === 3, U(s, 'まと').poison);
  s = ready('creature', [dummy(40, 40, { hp: 9999 })]); { fire(s, 1, 0, 1, true); const t1 = s.turnNo; fire(s, -1, 0, 1); fire(s, 1, 0, 1); ok('大暴れ: 続けて 3 回弾ける(敵の番が来ない)', t1 === 1 && s.turnNo === 2 && s.shots === 3, [t1, s.turnNo, s.shots]); }
  s = fire(ready('machine', [dummy(180, 250)]), 0, -1, 3, true); ok('フルパワー: 当たった敵がはがれかけになる', U(s, 'まと').hp <= 50, U(s, 'まと').hp);
  s = fire(ready('electronic', [dummy(180, 300), dummy(260, 260, { name: 'となり' })]), 0, -1, 3, true); ok('放電: 近くの敵へダメージが飛ぶ', U(s, 'となり').hp < 100, U(s, 'となり').hp);
  s = ready('clothing', [dummy(40, 40)]); E.shoot(s, { dx: 1, dy: 0, power: 1, ult: true }); ok('総重ね着: 味方全員に盾', s.units[0].shield > 0, s.units[0].shield);
  s = fire(ready('furniture', [dummy(180, 300)]), 1, 0, 1, true); ok('模様替え: 止まった後に敵を押しやる', U(s, 'まと').y < 300, U(s, 'まと').y);
  s = fire(ready('toy', [dummy(180, 300)]), 1, 0, 1, true); ok('大びっくり箱: 敵を弾き飛ばしてカウント+1', U(s, 'まと').count === 9 && U(s, 'まと').y < 300, [U(s, 'まと').count, U(s, 'まと').y]);
  s = ready('bath', [dummy(40, 40)]); E.shoot(s, { dx: 1, dy: 0, power: 1, ult: true }); ok('泡まみれ: 卓全体が滑る', s.slickTurns === 2, s.slickTurns);
}
{
  // 大暴れの途中で本人が退場しても、手番が宙に浮かない
  const s = mini([Object.assign(ally('creature'), { name: 'A', x: 180, y: 400, touch: null, hp: 20 }), Object.assign(ally('furniture'), { name: 'C', x: 60, y: 470, touch: null })],
                 [dummy(180, 300, { trait: 'spike', atk: 200, hp: 999 })]);
  s.units[0].ultCharge = s.units[0].ultNeed;
  fire(s, 0, -1, 2, true);
  ok('大暴れ: 途中で本人が退場したら、次の味方の番に進む', !U(s, 'A').alive && s.phase === 'aim' && s.units[s.active].name === 'C', { alive: U(s, 'A').alive, phase: s.phase, active: s.units[s.active].name });
}
// ---- れんさ ------------------------------------------------------------------
{
  const s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null }), Object.assign(ally('kitchen'), { name: 'B', x: 180, y: 380 })], [dummy(180, 250, { hp: 999 })]);
  fire(s, 0, -1, 2);
  ok('れんさ: 味方にタッチすると増える', s.bestChain >= 1, s.bestChain);
  const solo = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null })], [dummy(180, 250, { hp: 999 })]);
  fire(solo, 0, -1, 1);
  const base = 999 - U(solo, 'まと').hp;
  ok('れんさ: 次の番には 0 に戻る', s.chain === 0, s.chain);
  ok('れんさなしの 1 発は攻撃力そのまま', base === 19, base);
}
// ---- 敵の行動 ----------------------------------------------------------------
{
  const A = () => Object.assign(ally('furniture'), { name: 'A', x: 180, y: 400, touch: null });
  const act = (o, extraAllies) => { const s = mini([A()].concat(extraAllies || []), [dummy(180, 250, Object.assign({ count: 1, atk: 12, hp: 400 }, o))]); fire(s, 1, 0, 1); return s; };
  ok('はんい攻撃: 円の中の味方に当たる', U(act({ action: 'blast', actR: 200 }), 'A').hp < 199);
  ok('はんい攻撃: 円の外なら当たらない', U(act({ action: 'blast', actR: 40 }), 'A').hp === 199);
  ok('たいあたり: 味方にぶつかってダメージ', U(act({ action: 'charge' }), 'A').hp < 199);
  ok('ビーム(縦): 同じ列の味方に当たる', (() => { const s = mini([A()], [dummy(180, 250, { action: 'beamV', count: 1, hp: 400 })]); fire(s, 0, 1, 1); return U(s, 'A').hp < 199; })());
  ok('ビーム(横): 列が違えば当たらない', U(act({ action: 'beamH' }), 'A').hp === 199);
  const B = (y) => Object.assign(ally('plant'), { name: 'B', x: 180, y, touch: null });
  const far = () => Object.assign(ally('kitchen'), { name: 'Z', x: 40, y: 490, touch: null });
  ok('ふきとばし: 味方が遠ざかる', (() => { const s = mini([far(), B(330)], [dummy(180, 250, { action: 'gust', count: 1, hp: 400 })]); fire(s, 1, 0, 1); return U(s, 'B').y > 331; })());
  ok('ひきよせ: 味方が近づく', (() => { const s = mini([far(), B(360)], [dummy(180, 250, { action: 'pull', count: 1, hp: 400 })]); fire(s, 1, 0, 1); return U(s, 'B').y < 359; })());
  ok('なかま呼び: 敵が増える', act({ action: 'summon' }).units.filter((u) => u.side === 1 && u.alive).length === 2);
  ok('自爆: カウント 0 で爆発して自分は消える', (() => { const s = mini([A(), Object.assign(ally('kitchen'), { name: 'Z', x: 60, y: 480, touch: null })], [dummy(180, 300, { action: 'bomb', count: 1, actR: 150, atk: 30 }), dummy(40, 40, { name: 'のこり' })]); fire(s, 1, 0, 1); return !U(s, 'まと').alive && U(s, 'A').hp < 199; })());
  ok('回復: 弱った敵を治す', (() => { const s = mini([A()], [dummy(180, 250, { action: 'mend', count: 1 }), dummy(60, 60, { name: 'けが' })]); U(s, 'けが').hp = 40; fire(s, 1, 0, 1); return U(s, 'けが').hp > 40; })());
  // 予告
  const t = E.telegraphs(mini([A()], [dummy(180, 250, { action: 'blast', count: 1, actR: 77 }), dummy(60, 60, { action: 'blast', count: 2 })]));
  ok('予告: 次に動く敵だけ、範囲つきで出る', t.length === 1 && t[0].shape === 'circle' && t[0].r === 77, t);
}
// ---- 特性 --------------------------------------------------------------------
{
  const A = (o) => Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null }, o);
  let s = fire(mini([A()], [dummy(180, 250, { trait: 'hard' })]), 0, -1, 1); ok('かたい: はがれかけるまでダメージ半減', 100 - U(s, 'まと').hp === Math.round(19 * 0.5), 100 - U(s, 'まと').hp);
  s = fire(mini([A()], [dummy(180, 250, { trait: 'spike' })]), 0, -1, 1); ok('トゲ: 正面から当たると弾いた側が痛い', U(s, 'A').hp < 80, U(s, 'A').hp);
  s = fire(mini([A({ y: 100 })], [dummy(180, 250, { trait: 'back' })]), 0, 1, 1); ok('背中が弱点: 奥側から当てると 2 倍', 100 - U(s, 'まと').hp === 19 * 2, 100 - U(s, 'まと').hp);
  s = mini([A({ atk: 500 })], [dummy(180, 250, { trait: 'split', hp: 60 }), dummy(40, 40, { name: 'のこり' })]); fire(s, 0, -1, 1);
  ok('分裂: 倒すと小さいのが 2 体出る', s.units.filter((u) => u.minion && u.alive).length === 2, s.units.length);
}
// ---- ボス --------------------------------------------------------------------
{
  const team = () => [ally('kitchen'), ally('food'), ally('machine'), ally('stationery')];
  let s = E.createBattle(bossBattle('vacuum', team()));
  const b = s.units.find((u) => u.kind === 'boss');
  const y0 = s.units[0].y; fire(s, 1, 0, 1);
  ok('掃除機: 敵の番に味方が吸い寄せられる', s.units.filter((u) => u.side === 0).some((u) => u.y < u.homeY - 1), s.units.filter((u) => u.side === 0).map((u) => Math.round(u.y - u.homeY)));
  b.hp = 1; s.units[s.active].atk = 50; const tgt = s.units[s.active]; fire(s, b.x - tgt.x, b.y - tgt.y, 3);
  ok('ボス: 体力ゲージを割ると次の段階へ進み、ひるむ', b.alive && b.gaugeIdx === 1 && b.hp > 1, { idx: b.gaugeIdx, hp: b.hp, alive: b.alive });
  ok('ボスは落ちない(卓の上に残る)', b.alive && b.x >= b.r && b.x <= 360 - b.r && b.y >= b.r && b.y <= 520 - b.r, [b.x, b.y]);
  s = E.createBattle(bossBattle('washer', team())); const g0 = JSON.stringify(s.gaps); fire(s, 1, 0, 1);
  ok('洗濯機: 敵の番に切れ目の位置が変わる', JSON.stringify(s.gaps) !== g0);
  s = E.createBattle(bossBattle('fan', team())); const w0 = JSON.stringify(s.wind); fire(s, 1, 0, 1);
  ok('扇風機: 風向きが変わる', JSON.stringify(s.wind) !== w0, s.wind);
  // 風で軌道が流れる
  const calm = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null })], [dummy(40, 40)]);
  const windy = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null })], [dummy(40, 40)], { wind: { ax: 250, ay: 0 } });
  E.shoot(calm, { dx: 0, dy: -1, power: 2 }, { preview: true }); E.resolve(calm);
  E.shoot(windy, { dx: 0, dy: -1, power: 2 }, { preview: true }); E.resolve(windy);
  ok('風: 同じ手でも右へ流される', U(windy, 'A').x > U(calm, 'A').x + 5, [U(calm, 'A').x, U(windy, 'A').x]);
}
// ---- 卓の仕掛け --------------------------------------------------------------
{
  const mk = (patches) => mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null })], [dummy(40, 40)], { patches });
  const dry = mk([]), wet = mk([{ x: 180, y: 300, r: 120, kind: 'wet' }]), mat = mk([{ x: 180, y: 300, r: 120, kind: 'mat' }]);
  for (const s of [dry, wet, mat]) { E.shoot(s, { dx: 0, dy: -1, power: 1 }, { preview: true }); E.resolve(s); }
  ok('こぼれた水: よく滑る', U(wet, 'A').y < U(dry, 'A').y - 5, [U(dry, 'A').y, U(wet, 'A').y]);
  ok('ランチョンマット: 止まりやすい', U(mat, 'A').y > U(dry, 'A').y + 5, [U(dry, 'A').y, U(mat, 'A').y]);
  const st = mk([{ x: 180, y: 450, r: 60, kind: 'stove', dmg: 10 }]); fire(st, 1, 0, 1);
  ok('コンロ: 上で止まるとダメージ', U(st, 'A').hp === 70 || U(st, 'A').hp === 80, U(st, 'A').hp);
}
// ---- 2026-11-16 の追加: 位置の決まり(reports/はじきバトルの進化案.md) ----------
const ev = (s, f) => s.events.filter(f);
{
  // A 敵の攻撃が敵にも当たる
  const far = () => Object.assign(ally('furniture'), { name: 'A', x: 40, y: 490, touch: null });
  let s = mini([far()], [dummy(180, 250, { action: 'blast', count: 1, actR: 120, atk: 20, hp: 400, name: 'ばくだん役' }), dummy(240, 250)]);
  const tg = E.telegraphs(s);
  ok('予告: はんい攻撃に巻き込まれる敵が分かる', tg.length === 1 && tg[0].foes.length === 1 && tg[0].foes[0] === U(s, 'まと').id, tg);
  fire(s, 1, 0, 1);
  ok('はんい攻撃は円の中の別の敵にも当たる', U(s, 'まと').hp === 100 - 20 && s.stats.dmgFriendly === 20, [U(s, 'まと').hp, s.stats.dmgFriendly]);
  ok('自分の攻撃は自分に当たらない', U(s, 'ばくだん役').hp === 400, U(s, 'ばくだん役').hp);
  s = mini([far()], [dummy(180, 250, { action: 'beamH', count: 1, atk: 20, hp: 400, name: 'ビーム役' }), dummy(320, 255)]); fire(s, 0, -1, 1);
  ok('ビームは帯の中の別の敵にも当たる', U(s, 'まと').hp === 80, U(s, 'まと').hp);
  s = mini([far(), Object.assign(ally('furniture'), { name: 'T', x: 180, y: 470, touch: null })], [dummy(180, 120, { action: 'charge', count: 1, atk: 20, hp: 400, name: 'とつげき' }), dummy(184, 300)]);
  ok('予告: たいあたりの線の上にいる敵が分かる', E.telegraphs(s)[0].foes.length === 1);
  fire(s, -1, 0, 1);
  ok('たいあたりは進む先の別の敵にも当たる', U(s, 'まと').hp < 100 && ev(s, (e) => e.t === 'friendly').length >= 1, U(s, 'まと').hp);
  s = mini([far(), Object.assign(ally('kitchen'), { name: 'Z', x: 320, y: 490, touch: null })], [dummy(180, 250, { action: 'bomb', count: 1, actR: 120, atk: 30 }), dummy(240, 250, { name: 'となり' })]); fire(s, 1, 0, 1);
  ok('自爆の爆風は別の敵にも同じ強さで当たる', U(s, 'となり').hp === 100 - 30, U(s, 'となり').hp);
}
{
  // B ぶつけダメージ(敵どうし・柵・物)
  const A = (o) => Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null }, o);
  let s = mini([A()], [dummy(180, 300, { weight: 1, name: 'てまえ' }), dummy(180, 200, { name: 'おく' })]); fire(s, 0, -1, 3);
  ok('敵どうしが強くぶつかると、両方にぶつけダメージ', ev(s, (e) => e.t === 'crash' && e.thing === 'foe' && e.to === U(s, 'おく').id).length === 1 && ev(s, (e) => e.t === 'crash' && e.thing === 'foe' && e.to === U(s, 'てまえ').id).length === 1 && s.stats.dmgCrash > 0, ev(s, (e) => e.t === 'crash'));
  ok('ぶつけダメージは手番の味方の攻撃力で決まる(19 × 0.5 × れんさ)', ev(s, (e) => e.t === 'hit' && e.kind === 'crash' && e.to === U(s, 'おく').id)[0].dmg >= Math.round(19 * 0.5), ev(s, (e) => e.kind === 'crash'));
  s = mini([A()], [dummy(180, 60, { weight: 1 })]); fire(s, 0, -1, 3);
  ok('敵を柵にぶつけるとダメージ', ev(s, (e) => e.t === 'crash' && e.thing === 'rail').length === 1, ev(s, (e) => e.t === 'crash'));
  s = mini([A()], [dummy(180, 60, { weight: 1 })]); fire(s, 0, -1, 1);
  ok('弱くぶつかっただけではダメージなし', ev(s, (e) => e.t === 'crash').length === 0);
  s = mini([A()], [dummy(180, 220)], { obstacles: [{ obj: 'bottle', x: 180, y: 330 }] }); fire(s, 0, -1, 3);
  ok('しょうゆ差しは押すと動き、敵にぶつけるとダメージ', ev(s, (e) => e.t === 'crash' && e.thing === 'bottle').length === 1 && s.units.find((u) => u.obj === 'bottle').y < 330, ev(s, (e) => e.t === 'crash'));
}
{
  // C ボスは落ちないが重く動く。柵にぶつけると削れる
  const boss = (x, y) => ({ name: 'ボス', boss: 'vacuum', r: 46, mass: 9, fric: 1500, hp: 1, gauges: [500], atk: 10, action: 'blast', count: 9, actR: 10, x, y });
  let s = mini([Object.assign(ally('machine'), { name: 'A', x: 180, y: 300, touch: null })], [boss(180, 60)]); fire(s, 0, -1, 3);
  const b = s.units.find((u) => u.kind === 'boss');
  ok('ボスは押すと動き、柵にぶつけるとぶつけダメージ', ev(s, (e) => e.t === 'crash' && e.to === b.id && e.thing === 'rail').length === 1 && b.alive, ev(s, (e) => e.t === 'crash'));
  s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null })], [boss(180, 200)]); fire(s, 0, -1, 3);
  ok('ボスは重いので、少ししか動かない', s.units[1].y < 200 && s.units[1].y > 140, s.units[1].y);
}
{
  // D 卓の仕掛けは敵の番にしか動かない(弾いている最中は止まっている)
  const team = () => [ally('kitchen'), ally('food'), ally('machine'), ally('stationery')];
  let bad = 0;
  for (const kind of ['washer', 'fan']) {
    const s = E.createBattle(bossBattle(kind, team()));
    for (let k = 0; k < 4 && s.phase === 'aim'; k++) {
      E.shoot(s, { dx: k % 2 ? 1 : -1, dy: -2, power: 3 });
      const g = JSON.stringify(s.gaps), w = JSON.stringify(s.wind);
      while (s.phase === 'resolving' && s.motion && s.motion.shooter >= 0) { E.step(s); if (JSON.stringify(s.gaps) !== g || JSON.stringify(s.wind) !== w) bad++; }
      E.resolve(s);
    }
  }
  ok('洗濯機・扇風機: 弾いている最中に切れ目や風は変わらない', bad === 0, bad);
  const s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null })], [dummy(40, 40)], { obstacles: [{ obj: 'bumper', x: 180, y: 300 }, { obj: 'cup', x: 100, y: 200 }, { obj: 'pin', x: 260, y: 200 }] });
  const before = s.units.filter((u) => u.kind === 'obstacle').map((u) => [u.x, u.y]);
  fire(s, 0, -1, 3);
  ok('輪ゴムの柱・コップ・お皿は押されても動かない', JSON.stringify(s.units.filter((u) => u.kind === 'obstacle').map((u) => [u.x, u.y])) === JSON.stringify(before));
}
{
  // E 当てると変わる仕掛け・F 回復のおやつ・輪ゴムの柱
  const A = (o) => Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null }, o);
  let s = mini([A(), A({ name: 'B', x: 60, y: 450 })], [dummy(40, 40)], { obstacles: [{ obj: 'lid', x: 180, y: 300 }] }); fire(s, 0, -1, 1);
  ok('鍋のふた: 味方が当てると開いて、回復のおやつが出る', !s.units.find((u) => u.obj === 'lid').alive && s.pickups.length === 1 && s.stats.lids === 1, s.pickups);
  U(s, 'B').hp = 30; s.active = U(s, 'B').id; E.shoot(s, { dx: 120, dy: -150, power: 2 }); E.resolve(s);
  ok('回復のおやつ: 味方が触れると拾って回復する', s.pickups.length === 0 && s.stats.pickups === 1 && U(s, 'B').hp === 30 + 20, { pk: s.pickups.length, hp: U(s, 'B').hp });
  const gaps = { top: [], bottom: [], left: [], right: [] };
  s = E.createBattle({ gaps, allies: [A()], enemies: [dummy(40, 40)], obstacles: [{ obj: 'pin', x: 180, y: 300, group: 1 }, { obj: 'pin', x: 300, y: 60, group: 1 }], pinOpen: { side: 'right', range: [190, 320] } });
  s.units.find((u) => u.obj === 'pin' && u.x === 300).alive = false; fire(s, 0, -1, 2);
  ok('お皿: 同じ組を全部倒すと、決まった柵が 2 ターン開く', s.bonusGaps.length === 1 && s.bonusGaps[0].side === 'right' && ev(s, (e) => e.t === 'pinOpen').length === 1, s.bonusGaps);
  fire(s, 1, 0, 1); fire(s, -1, 0, 1);
  ok('お皿で開いた柵は、2 ターンたつと閉じる', s.bonusGaps.length === 0, s.bonusGaps);
  const run = (obj) => travel(mini([A()], [dummy(40, 40)], { obstacles: [{ obj, x: 180, y: 330 }] }), 'A', { dx: 0, dy: -1, power: 1 });
  ok('輪ゴムの柱: コップより強く弾き返される(進む道のりが長い)', run('bumper') > run('cup') + 60, [Math.round(run('cup')), Math.round(run('bumper'))]);
}
{
  // G 敵を場外に落としたら、敵の番の前にもう 1 手(1 ターン 1 回まで)
  const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
  const mk = () => E.createBattle({ gaps, allies: [Object.assign(ally('machine'), { name: 'A', x: 180, y: 300, touch: null, atk: 1 }), Object.assign(ally('kitchen'), { name: 'B', x: 60, y: 480, touch: null })],
    enemies: [dummy(180, 60, { weight: 1, hp: 100, name: 'まと1' }), dummy(300, 400, { name: 'のこり', hp: 999 })] });
  const s = mk(); U(s, 'まと1').hp = 50; fire(s, 0, -1, 3);
  ok('場外に落とすと、敵の番の前に次の駒でもう 1 手', !U(s, 'まと1').alive && s.phase === 'aim' && s.turnNo === 1 && s.units[s.active].name === 'B' && s.stats.bonusShots === 1, { turn: s.turnNo, active: s.units[s.active].name, phase: s.phase });
  ok('もう 1 手の番が来た駒も、必殺が 1 つ進む', U(s, 'B').ultCharge === 1, U(s, 'B').ultCharge);
  const s2 = E.createBattle({ gaps, allies: [Object.assign(ally('machine'), { name: 'A', x: 180, y: 300, touch: null, atk: 1 }), Object.assign(ally('machine'), { name: 'B', x: 180, y: 420, touch: null, atk: 1 })],
    enemies: [dummy(180, 60, { weight: 1, name: 'まと1' }), dummy(180, 180, { weight: 1, name: 'まと2' }), dummy(300, 400, { name: 'のこり', hp: 999 })] });
  U(s2, 'まと1').hp = 50; U(s2, 'まと2').hp = 50; U(s2, 'まと2').x = 40; fire(s2, 0, -1, 3);
  U(s2, 'まと2').x = 180; U(s2, 'まと2').y = 60; fire(s2, 0, -1, 3);
  ok('もう 1 手は 1 ターンに 1 回まで(2 体目を落としても敵の番が来る)', s2.stats.enemyRing === 2 && s2.stats.bonusShots === 1 && s2.turnNo === 2, { ring: s2.stats.enemyRing, bonus: s2.stats.bonusShots, turn: s2.turnNo });
}
{
  // I 3 れんさ以上つなげた手は、弾いた駒の必殺が 1 つ進む
  const run = (n, p) => { const foes = []; for (let i = 0; i < n; i++) foes.push(dummy(180, 330 - i * 70, { hp: 999, name: 'まと' + i })); const s = mini([Object.assign(ally('stationery'), { name: 'A', x: 180, y: 440, touch: null })], foes); fire(s, 0, -1, p); return s; };
  const s3 = run(3, 3), s1 = run(1, 1);
  ok('3 れんさ以上で必殺が 1 つ進む(少ないと進まない)', s3.bestChain >= 3 && s1.bestChain < 3 && s3.stats.chainCharges === 1 && s1.stats.chainCharges === 0 && s3.units[0].ultCharge === s1.units[0].ultCharge + 1, [s3.bestChain, s1.bestChain, s3.units[0].ultCharge, s1.units[0].ultCharge]);
}
{
  // L 名前のついた技: ぶつけ落とし・柵返しから 2 体
  const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
  let s = E.createBattle({ gaps, allies: [Object.assign(ally('machine'), { name: 'A', x: 180, y: 400, touch: null, atk: 1 })], enemies: [dummy(180, 140, { hp: 999 }), dummy(180, 40, { weight: 1, name: 'おく' }), dummy(320, 480, { name: 'のこり', hp: 999 })] });
  U(s, 'おく').hp = 50; fire(s, 0, -1, 3);
  ok('ぶつけ落とし: 敵にぶつけて別の敵を落とす', !U(s, 'おく').alive && s.stats.crashRing === 1 && ev(s, (e) => e.t === 'trick' && e.kind === 'crashRing').length === 1, s.stats);
  s = mini([Object.assign(ally('stationery'), { name: 'A', x: 180, y: 440, touch: null })], [dummy(180, 300, { hp: 999 }), dummy(180, 200, { hp: 999, name: 'おく' })]); fire(s, 0, 1, 3);
  ok('柵返しから 2 体: 柵で跳ね返ってから 2 体に当てる', s.stats.bankDouble === 1, s.stats.bankDouble);
}

// ---- 再現性・停止性・異常値(でたらめな手で最後まで) ------------------------
function randomBattle(seed, fx, log) {
  const rnd = E.mulberry32(seed);
  const pick = () => LINEAGE_KEYS[Math.floor(rnd() * LINEAGE_KEYS.length)];
  // 持ち物とパッシブもでたらめに持たせる。3 戦に 1 戦は進化の組を 1 つ入れる(子駒・合わせ鏡なども通す)
  const gear = () => ({ item: ITEM_KEYS[Math.floor(rnd() * ITEM_KEYS.length)], passives: [PASSIVE_KEYS[Math.floor(rnd() * PASSIVE_KEYS.length)]] });
  const team = [ally(pick(), gear()), ally(pick(), gear()), ally(pick(), gear()), ally(pick(), gear())];
  if (seed % 3 === 0) { const e = EVOLUTIONS[seed % EVOLUTIONS.length]; team[0] = ally(pick(), { item: e.item, passives: [e.passive] }); }
  const kind = seed % 5;
  const cfg = kind === 0 ? bossBattle('vacuum', team) : kind === 1 ? bossBattle('washer', team) : kind === 2 ? bossBattle('fan', team)
    : mobBattle(['kitchen', 'living', 'attic'][seed % 3], team, [pick(), pick(), pick(), pick()], { traits: [null, 'hard', 'split', 'back'] });
  const s = E.createBattle(cfg);
  if (fx) s.fx = true;
  let h = 0x811c9dc5;
  while (s.phase === 'aim' && s.shots < 60) {
    const d = DIRS[Math.floor(rnd() * DIRS.length)], p = POWERS[Math.floor(rnd() * 3)];
    if (!E.shoot(s, { dx: d[0], dy: d[1], power: p, ult: rnd() < 0.5 })) { s.rejected = true; break; }
    while (s.phase === 'resolving') { E.step(s); if (log) for (const e of s.events) log.push(e); s.events = []; }
    h = E.hashState(s, h);
  }
  return { s, h };
}
{
  let mismatch = 0, caps = 0, bad = 0, rejected = 0, maxPen = 0, maxRatio = 0, longest = 0, chain = 0x811c9dc5;
  for (let seed = 1; seed <= FUZZ; seed++) {
    const a = randomBattle(seed), b = randomBattle(seed);
    if (a.h !== b.h) mismatch++;
    chain = Math.imul(chain ^ a.h, 0x01000193) >>> 0;
    caps += a.s.stats.capHits; maxPen = Math.max(maxPen, a.s.stats.maxPenetration); maxRatio = Math.max(maxRatio, a.s.stats.maxPenRatio || 0); longest = Math.max(longest, a.s.stats.maxMotionSteps);
    for (const u of a.s.units) {
      if (![u.x, u.y, u.vx, u.vy, u.hp].every(Number.isFinite)) bad++;
      if (u.alive && (u.x < 0 || u.x > a.s.w || u.y < 0 || u.y > a.s.h)) bad++;
      if (u.alive && u.hp <= 0) bad++;
    }
    if (a.s.rejected) rejected++;
  }
  ok('再現性: 同じ手順を 2 回流すと ' + FUZZ + ' 戦すべて一致', mismatch === 0, mismatch);
  ok('停止性: 12 秒の打ち切りが 1 回も起きない', caps === 0, caps);
  ok('すり抜けない: 重なりは、ぶつかった 2 つの半径の和の 5 割未満(中心が入れ替わらない)', maxRatio < 0.5, [+maxPen.toFixed(2), +maxRatio.toFixed(3)]);
  ok('異常値なし(盤外に残る・数値が壊れる・体力 0 で生存)', bad === 0, bad);
  ok('狙う番なのに手が受け付けられない、が起きない', rejected === 0, rejected);
  console.log('  合成ハッシュ', chain.toString(16).padStart(8, '0'), '/ 最長の動き', (longest * E.DT).toFixed(2), '秒 / 最大の重なり', maxPen.toFixed(2));
}
// ---- 演出用の出来事(contact / rail): 出しても勝ち負けは 1 つも変わらない --------
{
  let sameHash = 0, sameEvents = 0, contacts = 0, rails = 0, badGeo = 0, offLeak = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const offLog = [], onLog = [];
    const off = randomBattle(seed, false, offLog), on = randomBattle(seed, true, onLog);
    if (off.h === on.h) sameHash++;
    const core = onLog.filter((e) => e.t !== 'contact' && e.t !== 'rail');
    if (JSON.stringify(core) === JSON.stringify(offLog)) sameEvents++;
    for (const e of offLog) if (e.t === 'contact' || e.t === 'rail') offLeak++;
    for (const e of onLog) {
      if (e.t !== 'contact' && e.t !== 'rail') continue;
      if (e.t === 'contact') contacts++; else rails++;
      const n = Math.sqrt(e.nx * e.nx + e.ny * e.ny);
      if (![e.x, e.y, e.nx, e.ny, e.v].every(Number.isFinite) || Math.abs(n - 1) > 1e-6 || !(e.v > 0)) badGeo++;
    }
  }
  ok('演出用の出来事を出しても、' + N + ' 戦すべてで盤面のハッシュが同じ', sameHash === N, sameHash);
  ok('演出用の出来事を除くと、出来事の並びが 1 つも変わらない', sameEvents === N, sameEvents);
  ok('s.fx が偽のときは contact / rail を 1 つも出さない', offLeak === 0, offLeak);
  ok('contact と rail が実際に出ている', contacts > 100 && rails > 50, [contacts, rails]);
  ok('接点・向き(長さ 1)・速さ(正)がすべて正しい数', badGeo === 0, badGeo);
  // 形: 真上に弾いて真上の敵に当てる → 接点は 2 つの中心の間、向きは上、当たり(hit)より先に出る
  const s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 250)]);
  s.fx = true; E.shoot(s, { dx: 0, dy: -1, power: 2 }); const log = [];
  while (s.phase === 'resolving') { E.step(s); for (const e of s.events) log.push(e); s.events = []; }
  const ci = log.findIndex((e) => e.t === 'contact'), hi = log.findIndex((e) => e.t === 'hit');
  const c = log[ci] || {};
  ok('当たりの前に contact が出る', ci >= 0 && hi > ci, [ci, hi]);
  ok('接点は 2 つの駒の間で、向きは弾いた向き(上)', Math.abs(c.x - 180) < 1 && c.y < 400 && c.y > 250 && Math.abs(Math.abs(c.ny) - 1) < 1e-6, c);
  // 柵: 右へ弾くと右の柵で跳ね返る → 内向き(左)
  const r = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null })], [dummy(60, 100)]);
  r.fx = true; E.shoot(r, { dx: 1, dy: 0, power: 2 }); const rl = [];
  while (r.phase === 'resolving') { E.step(r); for (const e of r.events) rl.push(e); r.events = []; }
  const re = rl.find((e) => e.t === 'rail') || {};
  ok('右の柵では内向き(左)の rail が出る', re.nx === -1 && re.ny === 0 && Math.abs(re.x - E.W) < 1e-6, re);
  const cl = E.cloneState(r);
  ok('複製には演出用の出来事の印を持ち越さない(予測線・おまかせを軽く保つ)', cl.fx === false);
}
// ---- 予想ダメージ: このまま何もしなければ受けるダメージが、本物の敵の番と一致する --------------
{
  // 範囲攻撃の敵(カウント 1)の隣に味方 B。A は遠くの空いた所へ弱く弾く(誰にも当たらない)
  const s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 40, y: 480, touch: null }), Object.assign(ally('furniture'), { name: 'B', x: 200, y: 300, touch: null })],
                 [dummy(200, 230, { action: 'blast', count: 1, actR: 110, atk: 30, hp: 400 }), dummy(320, 60, { count: 5 })]);
  const before = E.hashState(s);
  const pv = E.threatPreview(s);
  ok('予想ダメージを計算しても盤面は変わらない', E.hashState(s) === before);
  const B = U(s, 'B'), hp0 = B.hp;
  E.shoot(s, { dx: -1, dy: 0, power: 1 }); E.resolve(s);
  ok('予想ダメージ = 本物の敵の番で受けたダメージ', pv.dmg[B.id] > 0 && pv.dmg[B.id] === hp0 - B.hp, [pv.dmg[B.id], hp0 - B.hp]);
  ok('カウント 1 でない敵は予想に入らない', Object.keys(pv.by).every((id) => +id !== U(s, 'まと').id + 1));
}
// ---- 1 手の最高ダメージは、その手で勝敗が決まっても数える -------------------------------
{
  const s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 250, { hp: 10 })]);
  fire(s, 0, -1, 2);
  ok('勝った手のダメージも「1 手の最高」に入る', s.phase === 'won' && s.stats.bestShotDmg >= 10, [s.phase, s.stats.bestShotDmg]);
}
// ---- おまかせで勝てる(遊びとして成立しているかの最低線) --------------------
{
  const team = [ally('kitchen'), ally('creature'), ally('machine'), ally('food')];
  const s = E.createBattle(mobBattle('kitchen', team, ['kitchen', 'plant', 'creature']));
  while (s.phase === 'aim' && s.shots < 40) { E.shoot(s, bestShot(s)); E.resolve(s); }
  ok('おまかせでザコ戦に勝てる', s.phase === 'won', { phase: s.phase, shots: s.shots });
}

// ---- 検査器の自己検査 --------------------------------------------------------
if (process.argv.includes('--mutate')) {
  // ルールをわざと壊した「偽の結果」を渡して、検査がそれを落とせるかを見る
  const checks = [
    ['半分ルールを外す(満タンでも落ちる)', () => { const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
      const s = E.createBattle({ gaps, allies: [Object.assign(ally('machine'), { name: 'A', x: 180, y: 300, touch: null, atk: 1 })], enemies: [dummy(180, 60, { weight: 1 })] });
      U(s, 'まと').maxHp = 1000; /* 体力 100 / 最大 1000 = はがれかけ扱いになる改変 */ fire(s, 0, -1, 3); return U(s, 'まと').alive; }],
    ['強打を無効にする', () => { const s = fire(mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 250)]), 0, -1, 1); return 100 - U(s, 'まと').hp >= Math.round(19 * 1.5); }],
    ['再現性を壊す(Math.random を混ぜる)', () => { const a = randomBattle(7).h; const b = E.hashState(randomBattle(7).s, (Math.random() * 1e9) | 0); return a === b; }],
    ['敵の攻撃が敵に当たらない', () => { const s = mini([Object.assign(ally('furniture'), { name: 'A', x: 40, y: 490, touch: null })], [dummy(180, 250, { action: 'blast', count: 1, actR: 40, atk: 20, hp: 400 }), dummy(240, 250)]); fire(s, 1, 0, 1); return U(s, 'まと').hp < 100; }],
    ['落としても、もう 1 手が出ない', () => { const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
      const s = E.createBattle({ gaps, allies: [Object.assign(ally('machine'), { name: 'A', x: 180, y: 300, touch: null, atk: 1 }), Object.assign(ally('kitchen'), { name: 'B', x: 60, y: 480, touch: null })], enemies: [dummy(180, 60, { weight: 1 }), dummy(300, 400, { name: 'のこり', hp: 999 })] });
      fire(s, 0, -1, 3); /* 満タンなので落ちない → もう 1 手は出ない。これを「出た」と言うなら見逃し */ return s.stats.bonusShots === 1; }],
    ['タッチ技が出ない', () => { const s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null, atk: 1 }), Object.assign(ally('kitchen'), { name: 'B', x: 180, y: 360, touch: null })], [dummy(180, 250)]); fire(s, 0, -1, 2); return 100 - U(s, 'まと').hp >= Math.round(19 * 1.5); }],
  ];
  let caught = 0;
  for (const [name, f] of checks) { const passedWrongly = f(); if (!passedWrongly) caught++; else console.log('  見逃し: ' + name); }
  console.log(`自己検査: 壊した ${checks.length} 件中 ${caught} 件を検出`);
  if (caught !== checks.length) process.exitCode = 1;
}

console.log(`\n${pass} 件合格 / ${fail} 件不合格`);
for (const f of failures) console.log('  不合格: ' + f);
if (fail) process.exitCode = 1;
