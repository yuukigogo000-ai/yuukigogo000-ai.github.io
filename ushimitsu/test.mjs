// うしみつ時計の検査(node test.mjs)。--mutate で検査器自身が間違いを見つけられるか確かめる。
import * as D from './src/data.js';
import * as B from './src/battle.js';
import * as R from './src/run.js';
import * as T from './src/tales.js';
import { allActs, chooseAct, playRun } from './src/bot.js';

let pass = 0, fail = 0; const failures = [];
function ok(name, cond, extra) { if (cond) pass++; else { fail++; failures.push(name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }
const hero = (o) => Object.assign({ char: D.CHARS[0], hp: 50, maxHp: 50, deck: ['kiru', 'kiru', 'migamae', 'migamae', 'tsuki', 'kaeshi'], relics: [] }, o);
const NB = (foes, o, extra) => B.newBattle(Object.assign({ seed: 5, hero: hero(o), foes: foes || ['chochin'] }, extra));
// 検査用: 手札を決めた札にする / 相手の印を決めた刻にする
const give = (b, ...ids) => { b.hand = ids; return b; };
const markAt = (b, i, t) => { b.foes[i].mark.at = t; return b; };
const far = (b) => { for (const f of b.foes) f.mark.at = 99; return b; };

// ---- はじまり ----------------------------------------------------------------
{
  const b = NB();
  ok('はじめは刻 0、手札 3 枚、化け物の印が置かれている', b.t === 0 && b.hand.length === 3 && b.foes[0].mark.at === 3, [b.t, b.hand.length, b.foes[0].mark]);
  ok('2 体いるとき、印は 1 刻ずれて置かれる', (() => { const x = NB(['kooni', 'kooni']); return x.foes[1].mark.at - x.foes[0].mark.at === 1; })());
  ok('同じ種なら同じ盤面、違う種なら違う並び', B.hashState(NB()) === B.hashState(NB()) && B.hashState(NB()) !== B.hashState(B.newBattle({ seed: 6, hero: hero(), foes: ['chochin'] })));
  ok('札は 29 種、おまもりは 16 種、化け物は 20 種、夜回りは 3 人', D.CARD_IDS.length === 29 && D.RELIC_IDS.length === 16 && Object.keys(D.FOES).length === 20 && D.CHARS.length === 3, [D.CARD_IDS.length, D.RELIC_IDS.length, Object.keys(D.FOES).length]);
  ok('最初の札の束は、どの夜回りも 8 枚で、知らない札がない', D.CHARS.every((c) => c.deck.length === 8 && c.deck.every((id) => D.CARDS[id])));
}
// ---- 針を回す ----------------------------------------------------------------
{
  const b = far(NB()); const hp = b.foes[0].hp;
  B.act(b, { a: 'utsu', k: 2, target: 0 });
  ok('「打つ」を 2 刻回すと、2 刻進んで 9 ダメージ', b.t === 2 && hp - b.foes[0].hp === 9, [b.t, hp - b.foes[0].hp]);
  const c = far(NB()); B.act(c, { a: 'utsu', k: 3, target: 0 });
  ok('長く回すほど、1 刻あたりが強い(1 刻 4・2 刻 9・3 刻 15)', hp - c.foes[0].hp === 15);
  ok('決められた刻より長くは回せない', B.act(far(NB()), { a: 'utsu', k: 4, target: 0 }).ok === false && B.whyNot(far(NB()), { a: 'utsu', k: 0, target: 0 }) !== null);
  ok('相手のいる行動は、相手を選ばないと出せない', B.act(far(NB()), { a: 'utsu', k: 1 }).ok === false && B.act(far(NB()), { a: 'ukeru', k: 1 }).ok === true);
  const d = far(give(NB(), 'kiru', 'tsuki', 'migamae')); B.act(d, { a: 0, k: 1, target: 0 });
  ok('札を使うと手札から消え、捨て札へ行く', d.hand.length === 2 && d.disc.includes('kiru') && !d.hand.includes('kiru'), d.hand);
}
// ---- 同じ刻なら、あなたが先 ----------------------------------------------------
{
  const b = markAt(NB(['kooni']), 0, 2); b.foes[0].hp = 9;
  B.act(b, { a: 'utsu', k: 2, target: 0 });
  ok('同じ刻に当たるなら、あなたが先(倒せば、その攻撃は来ない)', b.foes[0].dead && b.hp === 50 && b.over === 'win', [b.hp, b.over]);
  const c = markAt(NB(['kooni']), 0, 1); c.foes[0].hp = 9;
  B.act(c, { a: 'utsu', k: 2, target: 0 });
  ok('回している途中の刻に印があれば、先に打たれる', c.hp === 47 && c.foes[0].dead, c.hp);
}
// ---- 守り --------------------------------------------------------------------
{
  const b = markAt(NB(), 0, 2); B.act(b, { a: 'ukeru', k: 2 });
  ok('「受ける」は、回しているあいだの攻撃を受け止める', b.hp === 50 && b.stats.taken === 0, b.hp);
  ok('回し終わると、守りは消える', b.guard === 0);
  const c = markAt(NB(), 0, 3); B.act(c, { a: 'ukeru', k: 2 }); B.act(c, { a: 'utsu', k: 1, target: 0 });
  ok('守りは次の行動には残らない', c.hp === 45, c.hp);
  const d = markAt(NB(), 0, 1); d.hp = 15; B.act(d, { a: 'ukeru', k: 1 });
  ok('火事場: 体力が 3 割以下なら、守りが 1.5 倍', d.hp === 15 && B.guardOf(d, B.specOf(d, 'ukeru'), 1) === 6, d.hp);
  const e = markAt(give(NB(['kasa']), 'mikiri', 'kiru', 'kiru'), 0, 2); e.foes[0].pi = 3; e.foes[0].mark.ai = 2;
  B.act(e, { a: 0, k: 1 }); B.act(e, { a: 'utsu', k: 1, target: 0 });
  ok('「見切り」は、次の 1 回だけをかわす(3 回攻撃なら 2 回は当たる)', e.hp === 50 - 4 && e.ward === 0, e.hp);
}
// ---- かまえを崩す ------------------------------------------------------------
{
  const b = NB(); b.foes[0].pi = 3; b.foes[0].mark = { at: 5, ai: 2, poise: 7, dealt: 0, delayed: false };
  B.act(b, { a: 'utsu', k: 2, target: 0 });
  ok('かまえの数だけ削ると、大技をつぶせる(次の行動へ飛び、2 刻ひるむ)', b.stats.breaks === 1 && b.foes[0].broken && b.foes[0].mark.ai === 0 && b.foes[0].mark.at === 2 + 3 + 2, b.foes[0].mark);
  const c = NB(); c.foes[0].pi = 3; c.foes[0].mark = { at: 5, ai: 2, poise: 7, dealt: 0, delayed: false };
  B.act(c, { a: 'utsu', k: 1, target: 0 });
  ok('削りが足りなければ、つぶせない', c.stats.breaks === 0 && c.foes[0].mark.ai === 2);
  const d = give(NB(), 'tsuki', 'kiru', 'kiru'); d.foes[0].pi = 3; d.foes[0].mark = { at: 5, ai: 2, poise: 7, dealt: 0, delayed: false };
  B.act(d, { a: 0, k: 1, target: 0 });
  ok('「突き」は、かまえに 2 倍効く(4 ダメージで 8 ぶん)', d.stats.breaks === 1);
  const s = B.newBattle({ seed: 5, hero: hero({ char: D.CHARS[1], hp: 30 }), foes: ['chochin'] }); s.foes[0].pi = 3; s.foes[0].mark = { at: 5, ai: 2, poise: 7, dealt: 0, delayed: false };
  B.act(s, { a: 'utsu', k: 3, target: 0 });
  ok('巫女のすず: 崩すと体力 3 回復し、相手はさらに 2 刻おくれる', s.hp === 33 && s.foes[0].mark.at === 3 + 3 + 4, [s.hp, s.foes[0].mark.at]);
}
// ---- 印をおくらせる ----------------------------------------------------------
{
  const b = give(NB(), 'fuda', 'fuda', 'kiru'); const at0 = b.foes[0].mark.at;
  B.act(b, { a: 0, k: 1, target: 0 });
  ok('「札を貼る」で印が 2 刻おくれる', b.foes[0].mark.at === at0 + 2 && b.foes[0].mark.delayed);
  B.act(b, { a: 0, k: 1, target: 0 });
  ok('同じ印は 1 回しかおくらせられない', b.foes[0].mark.at === at0 + 2);
}
// ---- やけど・のろい・砂 ------------------------------------------------------
{
  const b = far(give(NB(), 'hinoko', 'kiru', 'kiru')); const hp = b.foes[0].hp;
  B.act(b, { a: 0, k: 1, target: 0 }); B.act(b, { a: 'ukeru', k: 3 });
  ok('やけど 3 は、1 刻ごとに 3・2・1 と減りながら効く', hp - b.foes[0].hp === 6 && b.foes[0].burn === 0, hp - b.foes[0].hp);
  const c = far(NB()); c.curse = 2; B.act(c, { a: 'ukeru', k: 3 });
  ok('のろいは 1 刻ごとに 1 ダメージ。守りでは防げない', c.hp === 48 && c.curse === 0, c.hp);
  const d = far(NB()); d.slow = 1; B.act(d, { a: 'utsu', k: 1, target: 0 });
  ok('砂をかけられると、次の行動が 1 刻長くなる(1 回だけ)', d.t === 2 && d.slow === 0 && B.costOf(d, 1) === 1);
  const e = far(B.newBattle({ seed: 5, hero: hero({ char: D.CHARS[2] }), foes: ['kooni'] })); e.foes[0].burn = 5; markAt(e, 0, 1); B.act(e, { a: 'utsu', k: 1, target: 0 });
  ok('提灯屋のとも: やけどしている化け物の攻撃は 2 へる', e.hp === 49, e.hp);
}
// ---- 時計がひと回り・札を引く・捨て身 ----------------------------------------
{
  const b = far(NB()); b.foes[0].hp = 999; for (let i = 0; i < 4; i++) B.act(b, { a: 'ukeru', k: 3 });
  ok('時計がひと回り(12 刻)するたび、化け物の攻撃が 2 上がる', b.t === 12 && b.foes[0].up === B.LAP_UP);
  const c = far(give(NB(), 'kiru')); c.draw = ['tsuki', 'kaeshi', 'migamae']; B.act(c, { a: 'ukeru', k: 1 });
  ok('札は 2 刻ごとに 1 枚(奇数の刻では引かない)', c.hand.length === 1); B.act(c, { a: 'ukeru', k: 1 });
  ok('札は 2 刻ごとに 1 枚(偶数の刻で引く)', c.hand.length === 2);
  const d = far(give(NB(), 'kiru', 'kiru', 'kiru')); B.act(d, { a: 'ukeru', k: 2 });
  ok('手札が上限(3 枚)なら引かない', d.hand.length === 3);
  const e = far(give(NB(), 'sutemi', 'kiru', 'kiru')); e.hp = 2; B.act(e, { a: 0, k: 2, target: 0 });
  ok('「捨て身」では倒れない(体力 1 は残る)', e.hp === 1 && !e.over);
  const f = far(give(NB(), 'hitoiki', 'kiru', 'kiru')); f.hp = 20; B.act(f, { a: 0, k: 2 });
  ok('1 度きりの札は、その戦いでは戻ってこない', f.hp === 26 && f.gone.includes('hitoiki') && !f.disc.includes('hitoiki'));
}
// ---- 勝ち負け・夜明け --------------------------------------------------------
{
  const b = markAt(NB(['kooni']), 0, 1); b.hp = 2; B.act(b, { a: 'utsu', k: 3, target: 0 });
  ok('体力が尽きたら負け。そこで時計は止まる', b.over === 'lose' && b.t === 1 && b.hp === 0, [b.over, b.t]);
  ok('終わった戦いでは、もう行動できない', B.act(b, { a: 'ukeru', k: 1 }).ok === false);
  const c = B.newBattle({ seed: 5, hero: hero({ hp: 200, maxHp: 200 }), foes: ['onyudo'], dawn: 6 }); far(c); B.act(c, { a: 'ukeru', k: 3 }); B.act(c, { a: 'ukeru', k: 3 });
  ok('丑三つ時は、夜明けの刻まで立っていれば勝ち', c.over === 'dawn' && c.t === 6);
  const d = B.newBattle({ seed: 5, hero: hero(), foes: ['tsuchigumo'] }); markAt(d, 0, 1); B.act(d, { a: 'ukeru', k: 1 });
  ok('土ぐもは子ぐもを呼ぶ', d.foes.length === 2 && d.foes[1].kind === 'kogumo' && !d.foes[1].core);
  d.foes[0].hp = 1; far(d); B.act(d, { a: 'utsu', k: 1, target: 0 });
  ok('かしらを倒せば、手下が残っていても勝ち', d.over === 'win' && !d.foes[1].dead);
  const e = B.newBattle({ seed: 5, hero: hero(), foes: ['ushioni'], dawn: 36 }); far(e); B.act(e, { a: 'ukeru', k: 3 });
  ok('牛鬼の毒の息: 3 刻ごとに 2 ダメージ(守りでは防げない)', e.hp === 48, e.hp);
  const g = B.newBattle({ seed: 5, hero: hero({ hp: 200, maxHp: 200 }), foes: ['onyudo'], dawn: 36 }); markAt(g, 0, 1); B.act(g, { a: 'ukeru', k: 1 });
  ok('大入道は、動くたびに攻撃が 2 上がる', g.foes[0].up === 2);
}
// ---- おまもり ----------------------------------------------------------------
{
  const rb = (relics, foes, o) => B.newBattle({ seed: 5, hero: hero(Object.assign({ relics }, o)), foes: foes || ['chochin'], dawn: 36 });
  ok('火打ち石: 始めに全員やけど 3', rb(['hiuchi'], ['kooni', 'kooni']).foes.every((f) => f.burn === 3));
  ok('こわれた懐中時計: 最初の行動は針が進まない(2 回めからは進む)', (() => { const b = far(rb(['tokei'])); B.act(b, { a: 'utsu', k: 3, target: 0 }); const t1 = b.t; B.act(b, { a: 'utsu', k: 3, target: 0 }); return t1 === 0 && b.t === 3; })());
  ok('研ぎ石と厚い半纏: 打つ +2、受ける +2', (() => { const b = rb(['toishi', 'hanten']); return b.utsu.join() === '6,11,17' && b.ukeru.join() === '6,11,17'; })());
  ok('身代わり人形: 一夜に 1 度だけ体力 1 でこらえる', (() => { const b = markAt(rb(['ningyo'], ['kooni']), 0, 1); b.hp = 1; b.foes[0].hp = 999; B.act(b, { a: 'utsu', k: 1, target: 0 }); const a = b.hp === 1 && b.dollUsed && !b.over; markAt(b, 0, b.t + 1); B.act(b, { a: 'utsu', k: 1, target: 0 }); return a && b.over === 'lose'; })());
  ok('数珠: のろいを受けない', (() => { const b = markAt(rb(['juzu'], ['hitotsume']), 0, 1); B.act(b, { a: 'ukeru', k: 1 }); return b.curse === 0; })());
  ok('鬼の面: 体力が半分以下で攻撃 +3', (() => { const b = far(rb(['oni'])); b.hp = 25; const hp = b.foes[0].hp; B.act(b, { a: 'utsu', k: 1, target: 0 }); return hp - b.foes[0].hp === 7; })());
  ok('札箱: 手札の上限が 4 枚', rb(['fudabako']).hand.length === 4);
  ok('朝告げ鳥の羽: 夜明けが 4 刻早い', rb(['hane']).dawn === 32);
  ok('古いお守り: 始めに見切り 1', rb(['omamori']).ward === 1);
  ok('割れ鐘: 最初の印が 2 刻おそい', rb(['kane']).foes[0].mark.at === 5);
  ok('夜光貝: 3 刻以上の行動のあいだ守り 4', (() => { const b = markAt(rb(['yakogai'], ['kooni']), 0, 2); B.act(b, { a: 'utsu', k: 3, target: 0 }); return b.hp === 50; })());
  ok('赤いひも: 1 刻の行動のあと、次の攻撃 +2', (() => { const b = far(rb(['himo'])); B.act(b, { a: 'ukeru', k: 1 }); return b.power === 2; })());
  ok('魔よけの鈴: 崩すと体力 3 回復', (() => { const b = rb(['suzu'], null, { hp: 30 }); b.foes[0].mark = { at: 9, ai: 2, poise: 7, dealt: 0, delayed: false }; B.act(b, { a: 'utsu', k: 2, target: 0 }); return b.hp === 33; })());
}
// ---- 見通しと説明 ------------------------------------------------------------
{
  const b = markAt(NB(), 0, 2), h = B.hashState(b), p = B.preview(b, { a: 'utsu', k: 3, target: 0 });
  ok('見通しは盤面を変えない', B.hashState(b) === h);
  B.act(b, { a: 'utsu', k: 3, target: 0 });
  ok('見通しの通りになる(受けるダメージ・与えるダメージ)', p.hp === b.hp && p.foes[0].hp === b.foes[0].hp && p.hpLost === 5 && p.fired === 1, p);
  ok('札の説明は、値から作られる(きたえた札は数字が増える)', B.describe(D.getCard('kiru')).includes('5 / 11 / 18') && B.describe(D.getCard('kiru+')).includes('7 / 15 / 25'), B.describe(D.getCard('kiru+')));
  ok('すべての札に説明がある(きたえた版も)', D.CARD_IDS.every((id) => B.describe(D.getCard(id)).length > 0 && B.describe(D.getCard(id + '+')) !== B.describe(D.getCard(id))), D.CARD_IDS.filter((id) => B.describe(D.getCard(id + '+')) === B.describe(D.getCard(id))));
  const c = NB(); const it = B.intent(c, c.foes[0]);
  ok('予告は、名前・あと何刻・数字を返す', it.name === '火をふく' && it.in === 3 && it.text === '5' && it.dmg === 5, it);
  ok('化け物のすべての行動に、予告の文がある', Object.keys(D.FOES).every((k) => { const x = B.newBattle({ seed: 1, hero: hero(), foes: [k] }); return D.FOES[k].pat.every((_, i) => { x.foes[0].mark.ai = i; return B.intent(x, x.foes[0]).text.length > 0; }); }));
}
// ---- 一夜の進行 --------------------------------------------------------------
{
  const r = R.newRun({ seed: 11, char: 0, diff: 'normal' });
  ok('一夜は 9 つの刻。最後は丑三つ時で、相手は始めから見えている', r.nodes.length === 9 && r.nodes[8][0].type === 'boss' && D.FOES[R.bossOf(r)].rule.length > 0 && T.HOURS.length === 9 && T.HOUR_LINES.length === 9);
  ok('同じ種なら同じ夜', JSON.stringify(R.newRun({ seed: 11, char: 0, diff: 'normal' })) === JSON.stringify(r));
  R.choose(r, 0);
  ok('道を選ぶと戦いが始まる', r.phase === 'battle' && r.battle.foes.length >= 1);
  r.battle.foes.forEach((f) => { f.hp = 1; }); far(r.battle);
  while (r.phase === 'battle') R.fight(r, { a: 'utsu', k: 1, target: B.alive(r.battle)[0].id });
  ok('勝つと銭と、札 3 枚からの選択', r.phase === 'reward' && r.zeni === 14 && r.reward.cards.length === 3 && new Set(r.reward.cards).size === 3, r.reward);
  R.takeCard(r, 0);
  ok('札をもらうと束が 1 枚増え、次の刻へ', r.deck.length === 9 && r.step === 1 && r.phase === 'map');
  const s = R.newRun({ seed: 11, char: 0, diff: 'normal' }); s.step = 2; s.zeni = 100; R.choose(s, 1);
  ok('店: 札 3・おまもり 2 が並ぶ', s.phase === 'shop' && s.shop.cards.length === 3 && s.shop.relics.length === 2);
  ok('店: 買うと銭が減り、同じ品は 2 度買えない', R.buy(s, 'relic', 0).ok && s.zeni === 40 && s.relics.length === 1 && !R.buy(s, 'relic', 0).ok);
  ok('店: 銭がたりないと買えない', !R.buy(s, 'relic', 1).ok && s.relics.length === 1);
  ok('店: 札を手放せる(1 回だけ)', R.buy(s, 'remove', 0).ok && s.deck.length === 7 && !R.buy(s, 'remove', 0).ok);
  R.leave(s); ok('店を出ると次の刻へ', s.step === 3 && s.phase === 'map');
  s.hp = 20; R.choose(s, 1);
  ok('茶屋: 休むと体力が 3 割もどる', R.rest(s, 'heal').healed === 17 && s.hp === 37 && s.step === 4);
  const u = R.newRun({ seed: 11, char: 0, diff: 'normal' }); u.step = 7; R.choose(u, 0); R.rest(u, 'up', 0);
  ok('茶屋: 札を 1 枚きたえられる', u.deck[0] === 'kiru+' && u.step === 8);
  const e = R.newRun({ seed: 11, char: 0, diff: 'normal' }); e.step = 1; e.hp = 3; R.choose(e, 1); const ans = R.answer(e, 'b');
  ok('出来事: 選ぶと結果の文が返り、次の刻へ。出来事では倒れない', ans.ok && ans.out.length > 0 && e.step === 2 && e.hp >= 1, ans);
  ok('出来事: 銭がたりない選択肢は選べない', (() => { const g = R.newRun({ seed: 11, char: 0, diff: 'normal' }); g.step = 1; g.zeni = 0; R.choose(g, 1); g.event = 0; return !R.canAnswer(g, 'a') && !R.answer(g, 'a').ok && R.canAnswer(g, 'b'); })());
  ok('出来事は 9 つ。どれも a・b の文と結果がある', T.EVENTS.length === 9 && T.EVENTS.every((v) => v.title && v.text && v.a.label && v.a.out && v.b.label && v.b.out && (!v.a.eff.card || D.CARDS[v.a.eff.card]) && (!v.b.eff.card || D.CARDS[v.b.eff.card])));
  ok('文章: 夜回りごとの始まり、丑三つ時の一言、結末 3 つがある', D.CHARS.every((c) => T.INTRO[c.id].length >= 3) && D.ENCOUNTERS.boss.every((x) => T.BOSS_LINES[x[0]]) && ['slain', 'dawn', 'dead'].every((k) => T.ENDINGS[k].lines.length >= 3));
}
// ---- 通しで遊ぶ --------------------------------------------------------------
{
  let unfinished = 0, illegal = 0, wins = 0; const hows = {};
  for (let i = 0; i < 120; i++) {
    const r = playRun(R.newRun({ seed: 300 + i, char: i % 3, diff: ['easy', 'normal', 'hard'][i % 3] }), i % 2 ? 'greedy' : 'loose', i + 1);
    if (!r.result) unfinished++; else { hows[r.result.how] = (hows[r.result.how] || 0) + 1; if (r.result.win) wins++; }
    if (r.hp > r.maxHp || r.zeni < 0 || r.deck.some((id) => !D.CARDS[id.replace('+', '')])) illegal++;
  }
  ok('120 回遊んで、必ず決着がつく(勝ちも負けも出る)', unfinished === 0 && wins > 0 && wins < 120, { unfinished, wins, hows });
  ok('120 回遊んで、おかしな値(上限をこえる体力・負の銭・知らない札)が出ない', illegal === 0, illegal);
  ok('3 つの結末(退治・夜明け・明けない夜)が、どれも実際に出る', hows.slain > 0 && hows.dawn > 0 && hows.dead > 0, hows);
  // 途中で保存して読み直しても、同じ手なら同じ結果
  const play = (reload) => { let r = R.newRun({ seed: 77, char: 1, diff: 'normal' }), n = 0; const noise = { rng: 3 };
    while (r.phase !== 'over' && n++ < 2000) {
      if (reload && n % 5 === 0) r = JSON.parse(JSON.stringify(r));
      if (r.phase === 'map') R.choose(r, 0); else if (r.phase === 'battle') R.fight(r, chooseAct(r.battle, 'greedy', noise));
      else if (r.phase === 'reward') { if (r.reward.relics) R.takeRelic(r, 0); else R.takeCard(r, 0); } else if (r.phase === 'rest') R.rest(r, 'heal'); else if (r.phase === 'shop') R.leave(r); else R.answer(r, 'b');
    } return B.hashState(r); };
  ok('途中で保存して読み直しても、同じ手なら同じ結果', play(false) === play(true));
  // どの行動も、見通しと実際が一致する
  let diff = 0, n = 0; { const r = R.newRun({ seed: 5, char: 2, diff: 'normal' }); R.choose(r, 0); const b = r.battle;
    while (!b.over && n < 60) { for (const o of allActs(b)) { const p = B.preview(b, o), c = B.cloneState(b); B.act(c, o); if (p.hp !== c.hp || p.foes.some((f) => f.hp !== c.foes.find((x) => x.id === f.id).hp)) diff++; n++; } B.act(b, chooseAct(b, 'greedy', { rng: 1 })); } }
  ok('どの行動も、見通しと実際が一致する', diff === 0 && n > 20, { diff, n });
  ok('何もしない(1 刻ずつ受けるだけ)では、最初の戦いも越えられない', (() => { const r = playRun(R.newRun({ seed: 9, char: 0, diff: 'easy' }), 'idle', 1); return r.result && !r.result.win && r.result.step === 0; })());
}

if (process.argv.includes('--mutate')) {
  const before = fail;
  ok('【わざと間違い】同じ刻なら化け物が先', (() => { const b = markAt(NB(['kooni']), 0, 2); b.foes[0].hp = 9; B.act(b, { a: 'utsu', k: 2, target: 0 }); return b.hp < 50; })());
  ok('【わざと間違い】守りは次の行動にも残る', (() => { const c = markAt(NB(), 0, 3); B.act(c, { a: 'ukeru', k: 2 }); B.act(c, { a: 'utsu', k: 1, target: 0 }); return c.hp === 50; })());
  ok('【わざと間違い】種が違っても同じ夜', JSON.stringify(R.newRun({ seed: 1, char: 0, diff: 'normal' })) === JSON.stringify(R.newRun({ seed: 2, char: 0, diff: 'normal' })));
  const caught = fail - before; fail = before; failures.splice(failures.length - caught, caught);
  console.log(`自己検査: わざと間違えた 3 件中 ${caught} 件を検出`);
  if (caught !== 3) process.exitCode = 1;
}
console.log(`\n${pass} 件合格 / ${fail} 件不合格`);
for (const f of failures) console.log('  不合格: ' + f);
if (fail) process.exitCode = 1;
