// うしみつ時計: 中身の表(札・おまもり・化け物・夜回り)。決まりは battle.js / run.js。
// 数字はすべて仮置き(模擬の打ち手でしか確かめていない)。

// ---- 札 ---------------------------------------------------------------------
// min〜max: 使う刻(針を回す量)。配列は「回した刻ごとの値」(min から順)。
//   dmg ダメージ / hits 回数 / all 全員 / crush かまえへの効きの倍率 / exec 弱った相手への上乗せ / byBurn やけどの何倍かを上乗せ
//   self 自分へのダメージ / strip かたさを消す / guard 守り(回している間) / ward 見切り / counter 無傷なら次の攻撃に上乗せ
//   burn やけど / delay 印をおくらせる / heal 回復 / power 次の攻撃に上乗せ / draw 札を引く / quick 次の行動を短く / cleanse のろいと砂を消す
//   once 1 回の戦いで 1 度きり
export const CARDS = {
  kiru:      { name: '斬りこむ', kind: 'atk', min: 1, max: 3, dmg: [5, 11, 18] },
  tsuki:     { name: '突き', kind: 'atk', min: 1, max: 1, dmg: [4], crush: 2 },
  nidan:     { name: '二度打ち', kind: 'atk', min: 2, max: 2, dmg: [5], hits: 2 },
  nagi:      { name: 'なぎ払い', kind: 'atk', min: 2, max: 3, dmg: [5, 9], all: true },
  daijodan:  { name: '大上段', kind: 'atk', min: 4, max: 4, dmg: [28] },
  kaeshi:    { name: '返し刀', kind: 'atk', min: 1, max: 1, dmg: [3], guard: [3] },
  sutemi:    { name: '捨て身', kind: 'atk', min: 2, max: 2, dmg: [17], self: 3 },
  todome:    { name: 'とどめ', kind: 'atk', min: 1, max: 1, dmg: [6], exec: 6 },
  kuzushi:   { name: 'くずしの一撃', kind: 'atk', min: 2, max: 2, dmg: [7], crush: 3 },
  hayawaza:  { name: '早業', kind: 'atk', min: 0, max: 0, dmg: [3] },
  hyoshigi:  { name: '拍子木', kind: 'atk', min: 1, max: 1, dmg: [3], all: true, guard: [2] },
  oharai:    { name: 'お祓い', kind: 'atk', min: 2, max: 2, dmg: [9], strip: true },
  hinoko:    { name: '火の粉', kind: 'fire', min: 1, max: 2, burn: [3, 6] },
  abura:     { name: '油をまく', kind: 'fire', min: 2, max: 2, burn: [3], all: true },
  oibi:      { name: '追い火', kind: 'fire', min: 1, max: 1, dmg: [2], byBurn: 2 },
  hidaruma:  { name: '火だるま', kind: 'fire', min: 3, max: 3, burn: [10] },
  migamae:   { name: '身がまえ', kind: 'def', min: 1, max: 3, guard: [6, 13, 21] },
  mikiri:    { name: '見切り', kind: 'def', min: 1, max: 1, ward: 1 },
  yanagi:    { name: '柳に風', kind: 'def', min: 2, max: 2, guard: [8], counter: 6 },
  jizo:      { name: '石地蔵', kind: 'def', min: 3, max: 3, guard: [25] },
  shio:      { name: '塩をまく', kind: 'def', min: 1, max: 1, guard: [3], cleanse: true },
  migawari:  { name: '身代わり札', kind: 'def', min: 0, max: 0, ward: 1, once: true },
  fuda:      { name: '札を貼る', kind: 'waza', min: 1, max: 2, delay: [2, 3] },
  suzu:      { name: '鈴を鳴らす', kind: 'waza', min: 1, max: 1, delay: [1], all: true },
  kanashibari: { name: '金しばり', kind: 'waza', min: 2, max: 2, dmg: [4], delay: [3] },
  hitoiki:   { name: '一息', kind: 'waza', min: 2, max: 2, heal: [6], once: true },
  kiai:      { name: '気合', kind: 'waza', min: 1, max: 1, power: [6] },
  sente:     { name: '先手', kind: 'waza', min: 0, max: 0, quick: 1, draw: 1 },
  yonabe:    { name: '夜なべ', kind: 'waza', min: 3, max: 3, guard: [8], draw: 2 },
};
export const CARD_IDS = Object.keys(CARDS);
// いつでも使える 2 つの構え(札ではない)。値は夜回りごとに違う
export const BASIC = { utsu: { name: '打つ', kind: 'atk', min: 1, max: 3 }, ukeru: { name: '受ける', kind: 'def', min: 1, max: 3 } };

const NUM = ['dmg', 'guard', 'burn', 'heal', 'power'];
// 札の id('kiru' または きたえた 'kiru+')から、実際の値を引く
export function getCard(id) {
  const plus = id.endsWith('+'), base = CARDS[plus ? id.slice(0, -1) : id];
  if (!base) throw new Error('知らない札: ' + id);
  if (!plus) return { id, ...base };
  const c = { id, ...base, name: base.name + '+' };
  let grew = false;
  for (const k of NUM) if (c[k]) { c[k] = c[k].map((v) => Math.ceil(v * 1.35)); grew = true; }
  if (c.delay) { c.delay = c.delay.map((v) => v + 1); grew = true; }
  if (c.counter) c.counter += 3;
  if (c.exec) c.exec += 3;
  if (!grew) { if (c.ward) c.ward += 1; if (c.draw) c.draw += 1; }
  return c;
}
export const canUpgrade = (id) => !id.endsWith('+');

// ---- おまもり -----------------------------------------------------------------
export const RELICS = {
  hiuchi:   { name: '火打ち石', text: '戦いの始めに、化け物みんなにやけど 3' },
  tokei:    { name: 'こわれた懐中時計', text: '戦いの最初の行動は、針が進まない' },
  suzu:     { name: '魔よけの鈴', text: 'かまえを崩すたび、体力 3 回復' },
  hanten:   { name: '厚い半纏', text: '「受ける」の守り +2' },
  toishi:   { name: '研ぎ石', text: '「打つ」のダメージ +2' },
  ningyo:   { name: '身代わり人形', text: '一夜に 1 度だけ、倒れるところを体力 1 でこらえる' },
  yakogai:  { name: '夜光貝', text: '3 刻以上の行動をするたび、そのあいだ守り 4' },
  juzu:     { name: '数珠', text: 'のろいを受けない' },
  hoshigaki: { name: '干し柿', text: '戦いに勝つたび、体力 4 回復' },
  oni:      { name: '鬼の面', text: '体力が半分以下のとき、攻撃のダメージ +3' },
  fudabako: { name: '札箱', text: '手札の上限 +1' },
  hane:     { name: '朝告げ鳥の羽', text: '丑三つ時の夜明けが 4 刻早く来る' },
  maneki:   { name: 'まねき猫', text: '手に入る銭 +30%' },
  omamori:  { name: '古いお守り', text: '戦いの始めに、見切り 1' },
  himo:     { name: '赤いひも', text: '1 刻の行動のあと、次の攻撃 +2' },
  kane:     { name: '割れ鐘', text: '化け物の最初の印が 2 刻おそくなる' },
};
export const RELIC_IDS = Object.keys(RELICS);

// ---- 化け物 -------------------------------------------------------------------
// pat: 行動の並び(くり返す)。w = その行動までの刻。poise = かまえ(それだけ削ると行動をつぶせる)
//   dmg(×x 回)/ curse のろい / slow 砂(次の行動 +1 刻)/ steal 札を落とす / armor かたさ / up 攻撃上げ / heal 回復 / summon 仲間を呼ぶ
export const FOES = {
  chochin:   { name: '提灯お化け', hp: 32, pat: [{ n: '火をふく', dmg: 5, w: 3 }, { n: '火をふく', dmg: 5, w: 3 }, { n: '大あくび', dmg: 12, w: 5, poise: 7 }] },
  kasa:      { name: 'からかさ', hp: 26, pat: [{ n: 'けとばす', dmg: 4, w: 3 }, { n: 'けとばす', dmg: 4, w: 3 }, { n: 'はねまわる', dmg: 2, x: 3, w: 3 }] },
  kooni:     { name: '小鬼', hp: 16, pat: [{ n: 'ひっかく', dmg: 3, w: 3 }] },
  hitotsume: { name: '一つ目小僧', hp: 38, pat: [{ n: 'にらむ', curse: 3, w: 3 }, { n: 'なぐる', dmg: 7, w: 3 }] },
  nopperabo: { name: 'のっぺらぼう', hp: 40, pat: [{ n: '顔をかくす', armor: 3, w: 2 }, { n: 'なぐる', dmg: 8, w: 4 }] },
  kappa:     { name: '河童', hp: 56, pat: [{ n: '水をかける', dmg: 5, w: 2 }, { n: 'すもう', dmg: 15, w: 5, poise: 9 }] },
  sunakake:  { name: '砂かけ婆', hp: 44, pat: [{ n: '砂をかける', dmg: 2, slow: 1, w: 3 }, { n: 'つえでたたく', dmg: 7, w: 3 }] },
  rokuro:    { name: 'ろくろ首', hp: 68, pat: [{ n: '巻きつく', dmg: 6, steal: 1, w: 3 }, { n: '首をのばす', dmg: 17, w: 6, poise: 11 }] },
  yukionna:  { name: '雪女', hp: 72, pat: [{ n: '冷たい息', dmg: 8, w: 4 }, { n: '吹雪', dmg: 3, x: 4, w: 5 }, { n: 'こおらせる', slow: 1, curse: 2, w: 3 }] },
  kamaitachi: { name: '鎌いたち', hp: 20, pat: [{ n: '切りつける', dmg: 4, w: 3 }] },
  // 手ごわい相手
  nurikabe:  { name: 'ぬりかべ', hp: 100, pat: [{ n: 'かたくなる', armor: 4, w: 3 }, { n: 'たおれこむ', dmg: 20, w: 6, poise: 14 }, { n: 'おしつぶす', dmg: 9, w: 3 }] },
  kasha:     { name: '火車', hp: 88, pat: [{ n: '火の輪', dmg: 6, x: 2, w: 3 }, { n: 'いきおいづく', up: 2, w: 2 }, { n: 'ひきずる', dmg: 14, w: 5, poise: 10 }] },
  mukade:    { name: '大百足', hp: 80, pat: [{ n: 'かみつく', dmg: 5, curse: 2, w: 2 }, { n: '百の足', dmg: 2, x: 6, w: 4 }, { n: '毒の牙', dmg: 8, curse: 4, w: 4, poise: 9 }] },
  // 真夜中の主
  ogama:     { name: '大がま', hp: 95, pat: [{ n: '舌をのばす', dmg: 8, steal: 1, w: 3 }, { n: '毒のあわ', dmg: 3, curse: 4, w: 3 }, { n: 'とびのる', dmg: 20, w: 6, poise: 14 }, { n: 'ふくらむ', armor: 4, heal: 6, w: 2 }] },
  tsuchigumo: { name: '土ぐも', hp: 80, pat: [{ n: '子を呼ぶ', summon: 'kogumo', w: 3 }, { n: '糸をはく', dmg: 5, slow: 1, w: 3 }, { n: 'かみくだく', dmg: 16, w: 5, poise: 11 }] },
  kogumo:    { name: '子ぐも', hp: 12, minion: true, pat: [{ n: 'かむ', dmg: 3, w: 2 }] },
  // 丑三つ時に来るもの(それぞれ、戦いの決まりを 1 つ変える)
  gasha:     { name: 'がしゃどくろ', hp: 145, rule: '手を倒しても、骨を集めてまた生やす', pat: [{ n: '骨を集める', summon: 'gashate', w: 3 }, { n: 'にぎりつぶす', dmg: 24, w: 7, poise: 18 }, { n: '歯を鳴らす', dmg: 6, curse: 3, w: 3 }] },
  gashate:   { name: 'どくろの手', hp: 34, minion: true, pat: [{ n: 'なぎはらう', dmg: 6, w: 2 }] },
  ushioni:   { name: '牛鬼', hp: 140, rule: '毒の息: 3 刻ごとに 2 ダメージ(守りでは防げない)', aura: { every: 3, dmg: 2 }, pat: [{ n: 'つので突く', dmg: 10, w: 3 }, { n: '毒をはく', dmg: 4, curse: 5, w: 3 }, { n: 'ふみつぶす', dmg: 26, w: 7, poise: 18 }] },
  onyudo:    { name: '大入道', hp: 165, rule: '動くたびに、攻撃が 2 ずつ上がる', grow: 2, pat: [{ n: 'ふみつける', dmg: 7, w: 3 }, { n: '見おろす', dmg: 4, slow: 1, w: 2 }, { n: '張り手', dmg: 12, w: 4, poise: 12 }] },
};
export const ENCOUNTERS = {
  easy: [['chochin'], ['kasa', 'kooni'], ['hitotsume'], ['kooni', 'kooni'], ['nopperabo'], ['kasa', 'chochin']],
  hard: [['kappa', 'kooni'], ['sunakake', 'kasa'], ['rokuro'], ['yukionna'], ['kamaitachi', 'kamaitachi', 'kamaitachi'], ['nopperabo', 'hitotsume']],
  elite: [['nurikabe'], ['kasha'], ['mukade']],
  mid: [['ogama'], ['tsuchigumo']],
  boss: [['gasha'], ['ushioni'], ['onyudo']],
};

// ---- 夜回り -------------------------------------------------------------------
export const CHARS = [
  { id: 'yokichi', name: '夜回りの与吉', hp: 56, utsu: [4, 9, 15], ukeru: [4, 9, 15], trait: '「打つ」が強い(1 刻 4 / 2 刻 9 / 3 刻 15)',
    deck: ['kiru', 'kiru', 'migamae', 'migamae', 'tsuki', 'kaeshi', 'hyoshigi', 'kiai'], likes: ['atk', 'def'] },
  { id: 'suzu', name: '巫女のすず', hp: 50, utsu: [3, 7, 12], ukeru: [4, 9, 15], trait: 'かまえを崩すと体力 3 回復。崩された化け物は、さらに 2 刻おくれる',
    deck: ['fuda', 'fuda', 'migamae', 'migamae', 'kiru', 'mikiri', 'suzu', 'tsuki'], likes: ['waza', 'def'] },
  { id: 'tomo', name: '提灯屋のとも', hp: 52, utsu: [3, 7, 12], ukeru: [4, 9, 15], trait: 'やけどしている化け物の攻撃は 2 へる',
    deck: ['hinoko', 'hinoko', 'oibi', 'migamae', 'migamae', 'kiru', 'abura', 'kaeshi'], likes: ['fire', 'def'] },
];
export const DIFFS = {
  easy:   { name: 'やさしい', hp: 0.85, dmg: 0.85 },
  normal: { name: 'ふつう', hp: 1, dmg: 1 },
  hard:   { name: 'むずかしい', hp: 1.1, dmg: 1.15 },
};
