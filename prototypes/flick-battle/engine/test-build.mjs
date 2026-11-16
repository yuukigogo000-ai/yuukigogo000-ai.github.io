// 持ち物・パッシブ・2 体/純血ボーナス・モノの重さ・おまけ目標・自動決着の検査(node test-build.mjs)
import * as E from './engine.js';
import * as D from './data.js';
import { autoResolve, isTrivial, powerRatio } from './ai.js';
const { ally } = D;
let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }
const U = (s, name) => s.units.find((u) => u.name === name);
const NOGAP = { top: [], bottom: [], left: [], right: [] };
const mini = (allies, enemies, extra) => E.createBattle(Object.assign({ gaps: NOGAP, allies, enemies }, extra));
const dummy = (x, y, o) => Object.assign({ name: 'まと', hp: 100, atk: 10, weight: 3, action: 'blast', count: 9, actR: 10, x, y }, o);
const fire = (s, dx, dy, power, ult) => { E.shoot(s, { dx, dy, power, ult: !!ult }); E.resolve(s); return s; };
const A = (lin, o) => Object.assign(ally(lin, o), { name: 'A', x: 180, y: 400, touch: null });

// ---- 表がそろっているか ------------------------------------------------------
ok('持ち物は 20 種', D.ITEM_KEYS.length === 20, D.ITEM_KEYS.length);
ok('パッシブは 12 種', D.PASSIVE_KEYS.length === 12, D.PASSIVE_KEYS.length);
ok('モノは 60 種で、どれも重さ 1〜5 に収まる', Object.keys(D.OBJECT_WEIGHT_ADJ).length === 60 && D.LINEAGE_KEYS.every((l) => ally(l, { weightAdj: 1 }).weight <= 5 && ally(l, { weightAdj: -1 }).weight >= 1));
ok('2 体・純血ボーナスの説明が 12 系統ぶんある', D.LINEAGE_KEYS.every((l) => D.PAIR_TEXT[l] && D.PURE_TEXT[l]));
ok('全部の持ち物とパッシブに説明がある(持ち物は「きっかけ → 結果」)', D.ITEM_KEYS.every((k) => D.ITEMS[k].text && D.ITEMS[k].ja && D.ITEMS[k].on) && D.PASSIVE_KEYS.every((k) => D.PASSIVES[k].text));

// ---- 作るときに効くもの ------------------------------------------------------
ok('研いだ刃: 攻撃力 +20%', ally('kitchen', { item: 'blade' }).atk === Math.round(19 * 1.2));
ok('お弁当: 体力 +25%', ally('kitchen', { item: 'bento' }).hp === 100);
ok('鉄アレイ: おもさ +1', ally('kitchen', { item: 'dumbbell' }).weight === 4);
ok('モノごとのおもさ: 鍋は台所の基準より重い、おたまは軽い', ally('kitchen', { objectId: 'pot' }).weight === 4 && ally('kitchen', { objectId: 'ladle' }).weight === 2);
ok('育ち(pct)で変わるのは体力と攻撃力だけ', ally('kitchen', { pct: 50 }).weight === 3 && ally('kitchen', { pct: 50 }).hp === 120 && ally('kitchen', { pct: 50 }).atk === 29, ally('kitchen', { pct: 50 }));
ok('頑丈・力持ち・がんばり', ally('kitchen', { passives: ['sturdy'] }).hp === 85 && ally('kitchen', { passives: ['strong'] }).atk === 20 && ally('kitchen', { passives: ['tryhard'] }).hp === 82);
{
  const far = (o) => { const s = mini([Object.assign(ally('kitchen', o), { name: 'A', x: 180, y: 480, touch: null })], [dummy(20, 20)]); E.shoot(s, { dx: 0, dy: -1, power: 1 }, { preview: true }); E.resolve(s); return 480 - U(s, 'A').y; };
  ok('身軽: よく滑る', far({ passives: ['nimble'] }) > far({}) + 5, [far({}), far({ passives: ['nimble'] })]);
}
// ---- 戦闘中に効く持ち物 ------------------------------------------------------
{
  let s = mini([A('kitchen', { item: 'clock' })], [dummy(40, 40)]); ok('早起き時計: 必殺に必要な回数 -1', U(s, 'A').ultNeed === 2, U(s, 'A').ultNeed);
  s = fire(mini([A('kitchen', { item: 'poisonVial' })], [dummy(180, 250)]), 0, -1, 1); ok('毒の小瓶: 当てた敵に毒', U(s, 'まと').poison >= 0 && s.stats.dmgHit > 0 && (U(s, 'まと').hp < 81), U(s, 'まと'));
  s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null, atk: 1 }), Object.assign(ally('kitchen', { item: 'battery' }), { name: 'B', x: 180, y: 360 })], [dummy(180, 250)]); fire(s, 0, -1, 2);
  const withBat = 100 - U(s, 'まと').hp;
  s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null, atk: 1 }), Object.assign(ally('kitchen'), { name: 'B', x: 180, y: 360 })], [dummy(180, 250)]); fire(s, 0, -1, 2);
  ok('乾電池: タッチ技の効果 +30%', withBat > 100 - U(s, 'まと').hp, [withBat, 100 - U(s, 'まと').hp]);
  ok('双眼鏡: 予測線の長さの倍率を持つ', ally('kitchen', { item: 'binoculars' }).mods.guide === 2);
  { const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
    const t = E.createBattle({ gaps, allies: [Object.assign(ally('machine', { item: 'whistle' }), { name: 'A', x: 180, y: 300, touch: null, atk: 1 })], enemies: [dummy(180, 60, { weight: 1, name: 'おちる' }), dummy(300, 400)] });
    U(t, 'おちる').hp = 50; fire(t, 0, -1, 3);
    ok('びっくり笛: 敵を場外に落とすと、残りの敵全員のカウント +1', !U(t, 'おちる').alive && U(t, 'まと').count === 10, U(t, 'まと').count); }
  s = mini([A('kitchen', { item: 'magnifier' })], [dummy(180, 250)]); U(s, 'まと').hp = 50; fire(s, 0, -1, 1); ok('虫めがね: はがれかけの敵へ +30%', 50 - U(s, 'まと').hp === Math.round(19 * 1.3), 50 - U(s, 'まと').hp);
  s = mini([A('kitchen', { item: 'potLid' })], [dummy(40, 40)]); ok('鍋のフタ: 開始時に盾 25%', U(s, 'A').shield === 20, U(s, 'A').shield);
  const hit = (o, atk) => { const t = mini([Object.assign(ally('furniture', o), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 300, { action: 'blast', count: 1, actR: 200, atk: atk || 20, hp: 400 })]); fire(t, 1, 0, 1); return t; };
  ok('毛布: 受けるダメージ -12%', 199 - U(hit({ item: 'blanket' }), 'A').hp === Math.round(20 * 0.88), 199 - U(hit({ item: 'blanket' }), 'A').hp);
  ok('堅い: 受けるダメージ -5%', 199 - U(hit({ passives: ['hard'] }), 'A').hp === 19);
  s = hit({ item: 'firstAid' }, 120); ok('救急箱: はがれかけたら 1 回だけ回復', U(s, 'A').hp === 199 - 120 + Math.round(199 * 0.3) && U(s, 'A').used.firstAid === true, U(s, 'A').hp);
  s = hit({ item: 'charm' }, 999); ok('お守り: 1 回だけ体力 1 で耐える', U(s, 'A').alive && U(s, 'A').hp === 1, U(s, 'A').hp);
  { const go = (o) => { const t = mini([Object.assign(ally('kitchen', o), { name: 'A', x: 180, y: 300, touch: null })], [dummy(40, 40)]); let d = 0, px = 180, py = 300; const u = U(t, 'A');
      E.shoot(t, { dx: 0, dy: -1, power: 2 }, { preview: true }); while (t.phase === 'resolving') { E.step(t); d += Math.sqrt((u.x - px) ** 2 + (u.y - py) ** 2); px = u.x; py = u.y; } return d; };
    const plain = go({}), mir = go({ item: 'mirror' }), evo = go({ item: 'mirror', passives: ['nimble'] });
    ok('手鏡: 柵で跳ね返っても勢いが落ちない(遠くまで進む)', mir > plain + 40, [Math.round(plain), Math.round(mir)]);
    ok('合わせ鏡(手鏡+身軽): さらに勢いが増す', evo > mir + 20, [Math.round(mir), Math.round(evo)]); }
  s = mini([Object.assign(ally('kitchen', { item: 'gum' }), { name: 'A', x: 180, y: 400, touch: null })], [Object.assign(dummy(180, 300, { action: 'blast', count: 1, actR: 200, hp: 400 }), { lineage: 'plant' })]); fire(s, 1, 0, 1);
  ok('解毒ガム: 毒が効かない', U(s, 'A').poison === 0, U(s, 'A').poison);
  const gust = (o) => { const t = mini([Object.assign(ally('kitchen'), { name: 'Z', x: 40, y: 490, touch: null }), Object.assign(ally('plant', o), { name: 'B', x: 180, y: 330, touch: null })], [dummy(180, 250, { action: 'gust', count: 1, hp: 400 })]); fire(t, 1, 0, 1); return U(t, 'B').y - 330; };
  ok('耳栓: 吹き飛ばされない', gust({ item: 'earplugs' }) === 0 && gust({}) > 5, [gust({}), gust({ item: 'earplugs' })]);
  ok('踏んばり: 動かされる力 -40%', gust({ passives: ['stunRes'] }) < gust({}) && gust({ passives: ['stunRes'] }) > 0, [gust({}), gust({ passives: ['stunRes'] })]);
  const gaps = { top: [[100, 260]], bottom: [], left: [], right: [] };
  s = E.createBattle({ gaps, allies: [Object.assign(ally('kitchen', { item: 'cushion' }), { name: 'A', x: 180, y: 200, touch: null })], enemies: [dummy(40, 480)] }); U(s, 'A').hp = 40; fire(s, 0, -1, 3);
  ok('座布団: 落ちたときに失う体力が半分', U(s, 'A').hp === 40 - Math.round(80 * 0.15), U(s, 'A').hp);
  s = mini([Object.assign(ally('creature', { item: 'spareBattery' }), { name: 'A', x: 180, y: 400, touch: null, hp: 5 }), Object.assign(ally('furniture'), { name: 'C', x: 60, y: 470, touch: null })], [dummy(180, 300, { action: 'blast', count: 1, actR: 120, atk: 50, hp: 400 })]);
  const c0 = U(s, 'C').ultCharge; fire(s, 1, 0, 1);
  ok('予備電池: 倒れたとき味方の必殺が進む', !U(s, 'A').alive && U(s, 'C').ultCharge >= c0 + 2, [c0, U(s, 'C').ultCharge]);
  s = mini([A('kitchen', { item: 'match', pct: 900 })], [dummy(180, 250, { hp: 10 }), dummy(240, 250, { name: 'となり' })]); fire(s, 0, -1, 1);
  ok('マッチ: 敵を倒すと近くの敵に毒 3', !U(s, 'まと').alive && U(s, 'となり').poison >= 2, U(s, 'となり').poison);
  // 貫通の駒で 2 体を続けて抜く。2 体目へのダメージに、れんさ 1 つぶんの上乗せがかかる
  const chainDmg = (o) => { const t = mini([Object.assign(ally('stationery', o), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 300, { hp: 999, name: 'てまえ' }), dummy(180, 200, { hp: 999 })]); fire(t, 0, -1, 3); return 999 - U(t, 'まと').hp; };
  ok('応援うちわ: れんさの上乗せが増える', chainDmg({ item: 'fan' }) > chainDmg({}), [chainDmg({}), chainDmg({ item: 'fan' })]);
  ok('応援うちわ: 上限を超えたあとの伸びが大きくなる', ally('kitchen', { item: 'fan' }).mods.overflowAdd === 0.05);
}
// ---- パッシブ(戦闘中) -------------------------------------------------------
{
  let s = mini([A('kitchen', { passives: ['early'] })], [dummy(40, 40)]); ok('早起き: 最初から必殺が 1 つ進んでいる', U(s, 'A').ultCharge === 2, U(s, 'A').ultCharge);
  s = mini([A('kitchen', { passives: ['grit'] })], [dummy(180, 250)]); U(s, 'A').hp = 30; fire(s, 0, -1, 1); ok('根性: はがれかけのとき攻撃力 +15%', 100 - U(s, 'まと').hp === Math.round(19 * 1.15), 100 - U(s, 'まと').hp);
  s = mini([Object.assign(ally('kitchen', { passives: ['poisonRes'] }), { name: 'A', x: 180, y: 400, touch: null })], [dummy(40, 40)]); U(s, 'A').poison = 2; U(s, 'A').poisonDmg = 10; fire(s, 1, 0, 1);
  ok('毒に強い: 毒ダメージが半分', 80 - U(s, 'A').hp === 10, 80 - U(s, 'A').hp);
  s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null, atk: 1 }), Object.assign(ally('clothing', { passives: ['shieldFan'] }), { name: 'B', x: 180, y: 360 })], [dummy(40, 40)]);
  E.shoot(s, { dx: 0, dy: -1, power: 1 }); while (s.phase === 'resolving' && s.motion) E.step(s);
  ok('盾好き: 受ける盾 +25%', U(s, 'B').shield === Math.round(143 * 0.2 * 1.25), U(s, 'B').shield);
  s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null, atk: 1 }), Object.assign(ally('food'), { name: 'B', x: 180, y: 360 }), Object.assign(ally('furniture', { passives: ['healFan'] }), { name: 'C', x: 60, y: 470, touch: null })], [dummy(40, 40)]);
  U(s, 'C').hp = 50; fire(s, 0, -1, 1); ok('回復好き: 受ける回復 +30%', U(s, 'C').hp === 50 + Math.round(199 * 0.25 * 1.3), U(s, 'C').hp);
  const ch = (o) => { const t = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 450, touch: null }), Object.assign(ally('food', o), { name: 'B', x: 180, y: 380 })], [dummy(40, 40)]); fire(t, 0, -1, 1); return t.bestChain; };
  ok('盛り上げ役: タッチされるとれんさがもう 1 つ増える', ch({ passives: ['cheer'] }) === ch({}) + 1, [ch({}), ch({ passives: ['cheer'] })]);
}
// ---- 2 体ボーナス・純血 ------------------------------------------------------
{
  const team = (lins) => lins.map((l, i) => Object.assign(ally(l), { name: 'M' + i, x: [100, 260, 60, 300][i], y: [440, 440, 480, 480][i] }));
  let s = mini(team(['kitchen', 'kitchen', 'food', 'book']), [dummy(40, 40)]);
  ok('2 体ボーナス: 同じ系統 2 体で付く', s.team.pair.kitchen === true && !s.team.pair.food && s.team.pure === null, s.team);
  s = mini(team(['plant', 'plant', 'plant', 'plant']), [dummy(40, 40)]);
  ok('純血: 4 体全員が同じ系統。2 体ボーナスは付かない', s.team.pure === 'plant' && !s.team.pair.plant, s.team);
  ok('純血: 全員の体力・攻撃力 +6%', s.units[0].maxHp === Math.round(103 * 1.06) && s.units[0].atk === Math.round(16 * 1.06), [s.units[0].maxHp, s.units[0].atk]);
  s = mini(team(['kitchen', 'kitchen', 'kitchen']), [dummy(40, 40)]);
  ok('3 体だけの編成で全員同じでも純血にはならない(2 体ボーナス)', s.team.pure === null && s.team.pair.kitchen === true, s.team);
  const dmgOf = (lins) => { const t = mini([Object.assign(ally(lins[0]), { name: 'A', x: 180, y: 400, touch: null }), Object.assign(ally(lins[1]), { name: 'Z', x: 40, y: 490, touch: null })], [dummy(180, 250, { hp: 999 })]); fire(t, 0, -1, 1); return 999 - U(t, 'まと').hp; };
  ok('2 体ボーナス(台所): 与えるダメージ +15%', dmgOf(['kitchen', 'kitchen']) === Math.round(19 * 1.15) && dmgOf(['kitchen', 'food']) === 19, [dmgOf(['kitchen', 'kitchen']), dmgOf(['kitchen', 'food'])]);
  s = mini(team(['electronic', 'electronic', 'food', 'book']), [dummy(40, 40)]);
  ok('2 体ボーナス(電子): 最初から必殺が 1 つ進んでいる', s.units[1].ultCharge === 1 && s.units[2].ultCharge === 0, s.units.map((u) => u.ultCharge));
  s = mini(team(['food', 'food', 'food', 'food']), [dummy(40, 40)]); ok('純血(食べ物): 開始時に全員へ盾 15%', s.units.filter((u) => u.side === 0).every((u) => u.shield > 0));
  s = mini(team(['toy', 'toy', 'toy', 'toy']), [dummy(40, 40)]); ok('純血(玩具): 開始時に敵全員のカウント +1', U(s, 'まと').count === 10, U(s, 'まと').count);
  s = mini(team(['electronic', 'electronic', 'electronic', 'electronic']), [dummy(40, 40)]); ok('純血(電子): 必殺に必要な回数 -1', s.units[0].ultNeed === 2, s.units[0].ultNeed);
  s = mini(team(['bath', 'bath', 'bath', 'bath']), [dummy(180, 250, { action: 'gust', count: 1, hp: 400 })]); const y0 = s.units[1].y; fire(s, -1, 0, 1); // 弾く駒は左の柵へ。ほかの味方には触れない
  ok('純血(浴室): 敵に動かされない', s.units[1].y === y0 && s.units[1].x === 260, [y0, s.units[1].x, s.units[1].y]);
  s = mini(team(['furniture', 'furniture', 'furniture', 'furniture']), [dummy(180, 300, { action: 'blast', count: 1, actR: 400, atk: 40, hp: 400 })]); fire(s, 1, 0, 1);
  ok('純血(家具): 受けたダメージの 25% を返す', U(s, 'まと').hp < 400, U(s, 'まと').hp);
}
// ---- おまけ目標 --------------------------------------------------------------
{
  const cfg = D.mobBattle('kitchen', [ally('kitchen'), ally('food'), ally('creature'), ally('machine')], ['kitchen', 'plant', 'creature']);
  const g1 = D.pickGoal(7, cfg), g2 = D.pickGoal(7, cfg);
  ok('おまけ目標: 同じ種なら同じ目標、説明文つき', g1.kind === g2.kind && typeof g1.text === 'string' && g1.text.length > 0, g1);
  const kinds = new Set(); for (let i = 0; i < 8; i++) kinds.add(D.pickGoal(i, cfg).kind);
  ok('おまけ目標: 種によって種類が変わる', kinds.size >= 3, [...kinds]);
  const boss = D.bossBattle('vacuum', [ally('kitchen')]);
  ok('おまけ目標: ボス戦では「全員場外」を出さない', [0, 1, 2, 3, 4, 5, 6, 7].every((i) => D.pickGoal(i, boss).kind !== 'allRing'));
  const r = autoResolve(cfg);
  ok('オート戦闘: おまかせで最後まで回して結果を返す', r.won === true && r.shots > 0 && r.state.phase === 'won', { won: r.won, shots: r.shots });
  ok('オート戦闘: 同じ盤面なら同じ結果', autoResolve(cfg).shots === r.shots);
  ok('おまけ目標の判定: 手数', D.goalMet({ kind: 'quick', n: r.shots }, r.state) === true && D.goalMet({ kind: 'quick', n: r.shots - 1 }, r.state) === false);
  ok('おまけ目標の判定: 負けたら達成にならない', D.goalMet({ kind: 'noFall', n: 0 }, Object.assign({}, r.state, { phase: 'lost' })) === false);
  const strong = D.mobBattle('kitchen', [ally('kitchen', { pct: 300 }), ally('food', { pct: 300 }), ally('machine', { pct: 300 }), ally('book', { pct: 300 })], ['creature', 'creature']);
  ok('格下の判定: 大きく上回るときだけ「オート戦闘」を出す', isTrivial(strong) === true && isTrivial(cfg) === false && isTrivial(D.bossBattle('fan', [ally('kitchen', { pct: 900 })])) === false, [powerRatio(strong), powerRatio(cfg)]);
}
// ---- 進化・報酬の 3 択・名前のついた技(2026-11-16) ----------------------------
{
  ok('進化の組は 9 つ。どれも持ち物とパッシブの表にある', D.EVOLUTIONS.length === 9 && D.EVOLUTIONS.every((e) => D.ITEMS[e.item] && D.PASSIVES[e.passive] && e.ja && e.on && e.text));
  ok('進化: 持ち物とパッシブの組がそろうと化ける(片方だけでは化けない)', ally('kitchen', { item: 'blade', passives: ['strong'] }).evo === 'twinBlade' && ally('kitchen', { item: 'blade' }).evo === null && ally('kitchen', { passives: ['strong'] }).evo === null);
  // 二枚刃: 柵で跳ね返ると小さな刃が 2 つ出て、敵に当たる。動きが終わると消える
  const mk = (o) => mini([Object.assign(ally('kitchen', o), { name: 'A', x: 180, y: 300, touch: null })], [dummy(120, 180, { hp: 999, name: 'ひだり' }), dummy(240, 180, { hp: 999, name: 'みぎ' })]);
  let s = mk({ item: 'blade', passives: ['strong'] }); fire(s, 0, 1, 3);
  const minis = s.units.filter((u) => u.kind === 'mini');
  ok('二枚刃: 柵で跳ね返ると子駒が 2 つ出る', s.stats.splits === 1 && minis.length === 2, s.stats.splits);
  ok('二枚刃: 子駒は動きが終わると消え、味方の数に入らない', minis.every((u) => !u.alive) && s.stats.allyKo === 0 && s.phase === 'aim', minis.map((u) => u.alive));
  s = mk({ item: 'blade' }); fire(s, 0, 1, 3);
  ok('研いだ刃だけでは子駒は出ない', s.stats.splits === 0 && !s.units.some((u) => u.kind === 'mini'));
  // 重戦車: ぶつけダメージ 2 倍
  const crashOf = (o) => { const t = mini([Object.assign(ally('kitchen', o), { name: 'A', x: 180, y: 450, touch: null })], [dummy(180, 300, { weight: 1, hp: 999, name: 'てまえ' }), dummy(180, 200, { hp: 999 })]); fire(t, 0, -1, 3); return t.stats.dmgCrash; };
  ok('重戦車(鉄アレイ+頑丈): ぶつけダメージが増える', crashOf({ item: 'dumbbell', passives: ['sturdy'] }) > crashOf({ item: 'dumbbell' }) * 1.5, [crashOf({ item: 'dumbbell' }), crashOf({ item: 'dumbbell', passives: ['sturdy'] })]);
  // 毒霧: 当てた敵のまわりにも毒
  s = mini([Object.assign(ally('kitchen', { item: 'poisonVial', passives: ['poisonRes'] }), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 250, { hp: 999 }), dummy(240, 240, { hp: 999, name: 'となり' })]);
  E.shoot(s, { dx: 0, dy: -1, power: 1 }); while (s.phase === 'resolving' && s.motion) E.step(s);
  ok('毒霧(毒の小瓶+毒に強い): まわりの敵にも毒', U(s, 'となり').poison >= 1, U(s, 'となり').poison);
  // 大応援: れんさの上限が上がり、5 れんさ目から 1.5 倍
  const late = (o) => { const foes = []; for (let i = 0; i < 7; i++) foes.push(dummy(180, 360 - i * 48, { hp: 9999, name: 'まと' + i, r: 16 })); const t = mini([Object.assign(ally('stationery', o), { name: 'A', x: 180, y: 470, touch: null })], foes); fire(t, 0, -1, 3); return t.stats.dmgHit; };
  ok('大応援(応援うちわ+盛り上げ役): 長いれんさのダメージが大きく伸びる', late({ item: 'fan', passives: ['cheer'] }) > late({ item: 'fan' }) * 1.1, [late({}), late({ item: 'fan' }), late({ item: 'fan', passives: ['cheer'] })]);
}
{
  // 報酬の 3 択: 噛み合う候補を必ず 1 つ入れる
  const team = [{ lineage: 'kitchen', item: null, passives: ['strong'] }, { lineage: 'food', item: 'bento', passives: [] }, { lineage: 'plant', item: null, passives: [] }];
  let allOk = true, distinct = true;
  for (let seed = 1; seed <= 50; seed++) {
    const r = D.rewardChoices(team, seed);
    if (r.choices.length !== 3 || r.choices.indexOf(r.fit) < 0 || r.why !== 'evolution' || (r.fit !== 'blade' && r.fit !== 'magnifier')) allOk = false; // 力持ちと組む持ち物は刃と虫めがね
    if (new Set(r.choices).size !== 3 || r.choices.indexOf('bento') >= 0) distinct = false;
  }
  ok('報酬の 3 択: 進化の組を完成させる持ち物が必ず入る', allOk);
  ok('報酬の 3 択: 3 つとも違い、もう持っている持ち物は出ない', distinct);
  const r2 = D.rewardChoices([{ lineage: 'plant', item: null, passives: [] }], 9);
  ok('報酬の 3 択: 進化の組がなければ、系統の向きに合う持ち物を入れる', r2.why === 'lineage' && D.LINEAGE_FIT.plant.indexOf(r2.fit) >= 0, r2);
  ok('報酬の 3 択: 同じ種なら同じ候補', JSON.stringify(D.rewardChoices(team, 7)) === JSON.stringify(D.rewardChoices(team, 7)));
  const cfg = D.mobBattle('kitchen', [ally('kitchen'), ally('food')], ['kitchen', 'plant']);
  const kinds = new Set(); for (let i = 0; i < 12; i++) kinds.add(D.pickGoal(i, cfg).kind);
  ok('おまけ目標に、名前のついた技(ぶつけ落とし・柵返し)が出る', kinds.has('crashRing') && kinds.has('bankDouble'), [...kinds]);
}

// ---- シナジーの爽快感(2026-11-16): 玉突き・あふれれんさ・つながる進化 ----------
{
  const ev = (s, f) => s.events.filter(f);
  // 玉突き: A が B に当たり、押された B が C に当たると、C のタッチ技も出る
  const chainCase = () => mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 470, touch: null, atk: 1 }),
                                Object.assign(ally('furniture'), { name: 'B', x: 180, y: 410, touch: 'read' }),
                                Object.assign(ally('kitchen'), { name: 'C', x: 180, y: 340 })],
                               [dummy(180, 200, { hp: 999 })]);
  let s = chainCase(); fire(s, 0, -1, 3);
  ok('玉突き: 押された味方が別の味方に当たると、その味方のタッチ技も出る', s.stats.relays >= 1 && ev(s, (e) => e.t === 'touch' && e.by === U(s, 'C').id).length === 1, { relays: s.stats.relays, touches: ev(s, (e) => e.t === 'touch').map((e) => e.by) });
  ok('玉突き: 1 つごとにれんさが増える', s.bestChain >= 2, s.bestChain);
  s = mini([Object.assign(ally('kitchen'), { name: 'A', x: 180, y: 470, touch: null, atk: 1 }), Object.assign(ally('machine'), { name: 'B', x: 180, y: 400, touch: 'read' })], [dummy(180, 300, { hp: 999 })]); fire(s, 0, -1, 3);
  ok('玉突き: 押された味方が敵に当たってもダメージ', s.stats.dmgRelay > 0, s.stats.dmgRelay);
  // あふれれんさ
  const cm = (n, o) => E.chainMult(Object.assign({ chain: n }, o || {}));
  ok('あふれれんさ: 7 れんさで上乗せが上限(2 倍)に届き、そこから 1 つごとに ×1.1', Math.abs(cm(7) - 2) < 1e-9 && Math.abs(cm(8) - 2.2) < 1e-9 && Math.abs(cm(10) - 2 * 1.1 * 1.1 * 1.1) < 1e-9, [cm(6), cm(7), cm(8), cm(10)]);
  ok('あふれれんさ: 応援うちわ・大応援で伸びが大きくなる', cm(12, { overflowAdd: 0.15 }) > cm(12, { overflowAdd: 0.05 }) && cm(12, { overflowAdd: 0.05 }) > cm(12), [cm(12), cm(12, { overflowAdd: 0.05 }), cm(12, { overflowAdd: 0.15 })]);
  // 花火: 倒した敵が爆発し、爆発で倒れた敵も爆発する(連爆)
  s = mini([Object.assign(ally('kitchen', { item: 'match', passives: ['grit'], pct: 400 }), { name: 'A', x: 180, y: 420, touch: null })],
           [dummy(180, 300, { hp: 20 }), dummy(240, 300, { hp: 30, name: 'となり' }), dummy(300, 300, { hp: 30, name: 'そのとなり' }), dummy(40, 40, { hp: 999, name: 'のこり' })]);
  fire(s, 0, -1, 1);
  ok('花火(マッチ+根性): 倒した敵が爆発し、爆発で倒れた敵も爆発する', !U(s, 'となり').alive && !U(s, 'そのとなり').alive && s.stats.blasts >= 3, { blasts: s.stats.blasts, a: U(s, 'となり').alive, b: U(s, 'そのとなり').alive });
  // 直列つなぎ: 1 手の中でタッチ技が出るたび、次のタッチ技が強くなる
  const series = (o) => { const t = mini([Object.assign(ally('kitchen', o), { name: 'A', x: 180, y: 470, touch: null, atk: 1 }),
                                          Object.assign(ally('furniture'), { name: 'B', x: 180, y: 410, touch: 'read' }), Object.assign(ally('kitchen'), { name: 'C', x: 180, y: 340 })],
                                         [dummy(180, 220, { hp: 999 })]); fire(t, 0, -1, 3); return t.stats.dmgTouch; };
  ok('直列つなぎ(乾電池+早起き): 2 つ目のタッチ技が強くなる', series({ item: 'battery', passives: ['early'] }) > series({ item: 'battery' }), [series({ item: 'battery' }), series({ item: 'battery', passives: ['early'] })]);
  // 大号令: もう 1 手が 1 ターン何回でも
  const gaps = { top: [[60, 300]], bottom: [], left: [], right: [] };
  const two = (o) => { const t = E.createBattle({ gaps, allies: [Object.assign(ally('machine', o), { name: 'A', x: 180, y: 300, touch: null, atk: 1 }), Object.assign(ally('machine', o), { name: 'B', x: 180, y: 420, touch: null, atk: 1 })],
      enemies: [dummy(180, 60, { weight: 1, name: 'まと1' }), dummy(40, 200, { weight: 1, name: 'まと2' }), dummy(300, 470, { name: 'のこり', hp: 999 })] });
    U(t, 'まと1').hp = 50; U(t, 'まと2').hp = 50; fire(t, 0, -1, 3); U(t, 'まと2').x = 180; U(t, 'まと2').y = 60; fire(t, 0, -1, 3); return t; };
  const plain = two({ item: 'whistle' }), call = two({ item: 'whistle', passives: ['stunRes'] });
  ok('大号令(びっくり笛+踏んばり): もう 1 手が 1 ターンに何回でも出る', call.stats.bonusShots === 2 && call.turnNo === 1 && plain.stats.bonusShots === 1, { call: [call.stats.bonusShots, call.turnNo], plain: [plain.stats.bonusShots, plain.turnNo] });
  // とどめの一撃
  s = mini([Object.assign(ally('kitchen', { item: 'magnifier', passives: ['strong'] }), { name: 'A', x: 180, y: 400, touch: null })], [dummy(180, 250, { hp: 999 }), dummy(40, 40, { name: 'のこり' })]);
  U(s, 'まと').hp = 400; fire(s, 0, -1, 1);
  ok('とどめの一撃(虫めがね+力持ち): はがれかけの敵に当てると即退場', !U(s, 'まと').alive, U(s, 'まと').hp);
  // 1 手の最高ダメージを記録する(爽快感の目安)
  ok('1 手で与えたダメージの最高記録が残る', s.stats.bestShotDmg > 0, s.stats.bestShotDmg);
}

console.log(`${pass} 件合格 / ${fail} 件不合格`);
for (const f of failures) console.log('  不合格: ' + f);
if (fail) process.exitCode = 1;
