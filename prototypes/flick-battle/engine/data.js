// おはじきバトルのデータ表(系統・敵の行動・卓・ボス)。数値はすべて仮置きで、balance.mjs の結果を見て調整する。
import { W, H } from './engine.js';

/**
 * 12 系統。hp / atk は今のゲームの基礎値表(hpP / atkP)を体力 100・攻撃 20 基準に直したもの。
 * weight = おもさ 1〜5、touch = タッチ技、ult = 必殺技、ultNeed = 自分の番が何回来たら使えるか。
 * foe = 敵として出たときの行動とカウント。
 */
export const LINEAGES = {
  kitchen:    { ja: '台所',   hp: 80,  atk: 19, weight: 3, move: 'bounce', touch: 'slash',  ult: 'sweep',     ultNeed: 3, foe: { action: 'charge', count: 2 } },
  food:       { ja: '食べ物', hp: 102, atk: 16, weight: 3, move: 'bounce', touch: 'feed',   ult: 'feast',     ultNeed: 3, foe: { action: 'mend',   count: 2 } },
  stationery: { ja: '文房具', hp: 52,  atk: 14, weight: 1, move: 'pierce', touch: 'snipe',  ult: 'ruler',     ultNeed: 3, foe: { action: 'beamH',  count: 3 } },
  book:       { ja: '本・紙', hp: 109, atk: 22, weight: 2, move: 'bounce', touch: 'read',   ult: 'recital',   ultNeed: 4, foe: { action: 'gust',   count: 3 } },
  plant:      { ja: '植物',   hp: 103, atk: 16, weight: 3, move: 'bounce', touch: 'spore',  ult: 'bloom',     ultNeed: 3, foe: { action: 'blast',  count: 3 } },
  creature:   { ja: '生き物', hp: 62,  atk: 11, weight: 1, move: 'bounce', touch: 'chase',  ult: 'rampage',   ultNeed: 2, foe: { action: 'charge', count: 1 } },
  machine:    { ja: '機械',   hp: 114, atk: 27, weight: 4, move: 'bounce', touch: 'boot',   ult: 'fullpower', ultNeed: 4, foe: { action: 'blast',  count: 4 } },
  electronic: { ja: '電子',   hp: 87,  atk: 21, weight: 3, move: 'pierce', touch: 'charge', ult: 'discharge', ultNeed: 3, foe: { action: 'beamV',  count: 3 } },
  clothing:   { ja: '衣類',   hp: 143, atk: 14, weight: 2, move: 'bounce', touch: 'layer',  ult: 'layers',    ultNeed: 3, foe: { action: 'mend',   count: 3 } },
  furniture:  { ja: '家具',   hp: 199, atk: 15, weight: 5, move: 'bounce', touch: 'sit',    ult: 'rearrange', ultNeed: 4, foe: { action: 'pull',   count: 3 } },
  toy:        { ja: '玩具',   hp: 98,  atk: 20, weight: 2, move: 'bounce', touch: 'pop',    ult: 'bigpop',    ultNeed: 3, foe: { action: 'bomb',   count: 4 } },
  bath:       { ja: '浴室',   hp: 133, atk: 19, weight: 4, move: 'bounce', touch: 'wash',   ult: 'bubbles',   ultNeed: 2, foe: { action: 'gust',   count: 3 } },
};
export const LINEAGE_KEYS = Object.keys(LINEAGES);

export const TOUCH_JA = { slash: '一閃', feed: '給食', snipe: '狙撃', read: '読み聞かせ', spore: '胞子', chase: '追撃', boot: '起動',
                          charge: '充電', layer: '重ね着', sit: '居座り', pop: 'びっくり箱', wash: '洗浄' };
export const ULT_JA = { sweep: '大なぎ払い', feast: 'おかわり', ruler: '定規ショット', recital: '朗読会', bloom: '大繁殖', rampage: '大暴れ',
                        fullpower: 'フルパワー', discharge: '放電', layers: '総重ね着', rearrange: '模様替え', bigpop: '大びっくり箱', bubbles: '泡まみれ' };
export const ACTION_JA = { charge: 'たいあたり', blast: 'はんい攻撃', beamH: 'ビーム', beamV: 'ビーム', gust: 'ふきとばし', pull: 'ひきよせ',
                           summon: 'なかま呼び', mend: '回復', bomb: '自爆' };

// ---- 持ち物(20 種)とパッシブ(12 種) -----------------------------------------
// 名前は今のゲームのまま。効果を新しい戦闘の言葉に置き換えた。
// stat = 作るときに体力・攻撃力・おもさ・すべりへ反映するもの、mods = 戦闘中に効くもの(engine.js が読む)。
export const ITEMS = {
  blade:        { ja: '研いだ刃',   text: '攻撃力 +20%',                               stat: { atkPct: 20 } },
  clock:        { ja: '早起き時計', text: '必殺に必要な回数 -1',                        mods: { ultNeedAdj: -1 } },
  poisonVial:   { ja: '毒の小瓶',   text: '当てた敵に毒 1',                             mods: { onHitPoison: 1 } },
  battery:      { ja: '乾電池',     text: 'タッチ技の効果 +30%',                        mods: { touchMul: 1.3 } },
  binoculars:   { ja: '双眼鏡',     text: '予測線が 2 倍の長さになる',                  mods: { guide: 2 } },
  dumbbell:     { ja: '鉄アレイ',   text: 'おもさ +1',                                  stat: { weight: 1 } },
  fan:          { ja: '応援うちわ', text: 'れんさ 1 つあたりの上乗せ +5%',              mods: { chainStepAdd: 0.05 } },
  match:        { ja: 'マッチ',     text: '敵を倒すと、近くの敵に毒 3',                 mods: { onKillPoison: 3 } },
  whistle:      { ja: 'びっくり笛', text: '開始時、一番近い敵のカウント +1',            mods: { startStun: 1 } },
  magnifier:    { ja: '虫めがね',   text: 'はがれかけの敵へのダメージ +30%',            mods: { peelDmgMul: 1.3 } },
  potLid:       { ja: '鍋のフタ',   text: '開始時に盾 25%',                             mods: { startShield: 0.25 } },
  blanket:      { ja: '毛布',       text: '受けるダメージ -12%',                        mods: { takenMul: 0.88 } },
  firstAid:     { ja: '救急箱',     text: 'はがれかけたら 1 回だけ体力 30% 回復',       mods: { firstAid: true } },
  gum:          { ja: '解毒ガム',   text: '毒が効かない',                               mods: { poisonImmune: true } },
  earplugs:     { ja: '耳栓',       text: '敵に吹き飛ばされない・引き寄せられない',     mods: { forceImmune: true } },
  cushion:      { ja: '座布団',     text: '落ちたときに失う体力が半分',                 mods: { fallCostMul: 0.5 } },
  spareBattery: { ja: '予備電池',   text: '倒れたとき、味方全員の必殺が 1 つ進む',      mods: { onDownCharge: 1 } },
  charm:        { ja: 'お守り',     text: '1 回だけ体力 1 で耐える',                    mods: { charm: true } },
  bento:        { ja: 'お弁当',     text: '体力 +25%',                                  stat: { hpPct: 25 } },
  mirror:       { ja: '手鏡',       text: '敵から受けたダメージの 30% を返す',          mods: { reflect: 0.3 } },
};
export const ITEM_KEYS = Object.keys(ITEMS);

export const PASSIVES = {
  sturdy:    { ja: '頑丈',       text: '体力 +6%',                         stat: { hpPct: 6 } },
  strong:    { ja: '力持ち',     text: '攻撃力 +5%',                       stat: { atkPct: 5 } },
  nimble:    { ja: '身軽',       text: 'よく滑る(すべり +10%)',          stat: { fricPct: -10 } },
  hard:      { ja: '堅い',       text: '受けるダメージ -5%',               mods: { takenMul: 0.95 } },
  early:     { ja: '早起き',     text: '最初から必殺が 1 つ進んでいる',    mods: { ultStart: 1 } },
  grit:      { ja: '根性',       text: 'はがれかけのとき攻撃力 +15%',      mods: { gritAtk: 0.15 } },
  poisonRes: { ja: '毒に強い',   text: '受ける毒ダメージが半分',           mods: { poisonTakenMul: 0.5 } },
  stunRes:   { ja: '踏んばり',   text: '敵に動かされる力 -40%',            mods: { forceResist: 0.6 } },
  shieldFan: { ja: '盾好き',     text: '受ける盾 +25%',                    mods: { shieldGainMul: 1.25 } },
  healFan:   { ja: '回復好き',   text: '受ける回復 +30%',                  mods: { healGainMul: 1.3 } },
  cheer:     { ja: '盛り上げ役', text: 'タッチされると、れんさがもう 1 つ増える', mods: { cheer: true } },
  tryhard:   { ja: 'がんばり',   text: '体力 +3%・攻撃力 +3%',             stat: { hpPct: 3, atkPct: 3 } },
};
export const PASSIVE_KEYS = Object.keys(PASSIVES);

// 2 体ボーナス(同じ系統が 2 体以上)と純血ボーナス(4 体全員が同じ系統)。効果の実装は engine.js。
export const PAIR_TEXT = {
  kitchen: '台所の与えるダメージ +15%', food: '給食の回復量 +30%', stationery: '狙撃のダメージ +30%', book: '読み聞かせのカウント +2',
  plant: '胞子の毒 +1', creature: '追撃のダメージ +30%', machine: '起動の吹き飛ばし +30%', electronic: '電子は最初から必殺が 1 つ進んでいる',
  clothing: '重ね着の盾 +50%', furniture: '居座り中の軽減が 5 割になる', toy: '玩具の与えるダメージ +15%、びっくり箱の範囲 +30%', bath: '石けんの床が広く、長持ちする',
};
export const PURE_TEXT = {
  kitchen: '敵を倒すと必殺が 1 つ進む', food: '開始時に全員へ盾 15%', stationery: '狙撃が 2 連発(2 発目は半分)', book: '足止め中の敵へのダメージ +30%',
  plant: '毒を受けた敵は回復が半分', creature: '味方が倒れるたび攻撃力 +12%', machine: '盾がある間 攻撃力 +20%', electronic: '全員、必殺に必要な回数 -1',
  clothing: '盾が割れたら攻撃者のカウント +1、最大体力の 20% を返す', furniture: '受けたダメージの 25% を返す', toy: '開始時に敵全員のカウント +1', bath: '毒が効かない・敵に動かされない',
};
export const PURE_ALL_TEXT = '全員の体力・攻撃力 +6%';

// ---- モノごとのおもさ(60 種)。系統の基準から -1 / 0 / +1 ----------------------
export const OBJECT_WEIGHT_ADJ = {
  pot: 1, pan: 1, mug: 0, ladle: -1, kettle: 0,
  apple: 0, banana: -1, riceball: 0, bread: -1, snack: -1,
  pencil: 0, scissors: 1, eraser: 0, ruler: 0, pen: 0,
  book: 1, notebook: 0, newspaper: -1, magazine: 0, envelope: -1,
  cactus: 0, houseplant: 1, flower: -1, succulent: -1, bonsai: 1,
  dog: 1, cat: 1, goldfish: 0, bird: 0, insect: 0,
  electricfan: 0, vacuum: 1, dryer: -1, microwave: 1, clock: -1,
  remote: -1, console: 0, laptop: 1, earphones: -1, smartphone: -1,
  socks: -1, tshirt: 0, hat: 0, shoes: 1, scarf: 0,
  chair: -1, desk: 0, sofa: 0, shelf: 0, bed: 0,
  plush: -1, blocks: 1, ball: 0, toycar: 0, toyrobot: 1,
  toothbrush: -1, towel: -1, soap: 0, broom: 0, sponge: -1,
};

/**
 * 味方 1 体。育つのは体力と攻撃力だけ(pct)。おもさは育たず、モノの種類と鉄アレイだけが変える。
 * opts: { pct, name, objectId, item, passives: [..], hpMul, atkMul, weightAdj }
 */
export function ally(lineage, opts) {
  const L = LINEAGES[lineage], o = opts || {};
  const k = (100 + (o.pct || 0)) / 100;
  let hpPct = 0, atkPct = 0, fricPct = 0, weight = L.weight + (o.weightAdj || 0) + (o.objectId ? (OBJECT_WEIGHT_ADJ[o.objectId] || 0) : 0);
  const mods = {};
  const take = (def) => {
    if (!def) return;
    if (def.stat) { hpPct += def.stat.hpPct || 0; atkPct += def.stat.atkPct || 0; fricPct += def.stat.fricPct || 0; weight += def.stat.weight || 0; }
    if (def.mods) for (const key of Object.keys(def.mods)) {
      const v = def.mods[key];
      if (typeof v === 'number' && /Mul$/.test(key)) mods[key] = (mods[key] === undefined ? 1 : mods[key]) * v; // 倍率は掛け合わせる
      else if (typeof v === 'number') mods[key] = (mods[key] || 0) + v;                                        // 数は足す
      else mods[key] = v;
    }
  };
  take(ITEMS[o.item]);
  for (const p of o.passives || []) take(PASSIVES[p]);
  weight = Math.max(1, Math.min(5, weight));
  const base = LINEAGES[lineage].weight;
  return { name: o.name || L.ja, lineage, objectId: o.objectId || null, item: o.item || null, passives: (o.passives || []).slice(),
           hp: Math.round(L.hp * k * (o.hpMul || 1) * (100 + hpPct) / 100), atk: Math.round(L.atk * k * (o.atkMul || 1) * (100 + atkPct) / 100),
           weight, baseWeight: base, fric: fricPct ? Math.round(WEIGHT_FRIC[weight] * (100 + fricPct) / 100) : undefined,
           move: L.move, touch: L.touch, ult: L.ult, ultNeed: L.ultNeed, mods };
}
const WEIGHT_FRIC = [0, 600, 680, 760, 900, 1050]; // engine.js の WEIGHT.fric と同じ値

// 敵の強さの基準(味方の同じ系統に対する倍率)。balance.mjs の結果を見て決めた値
export const FOE_HP = 1.3, FOE_ATK = 1.1;

/** 敵 1 体。系統から体と行動を決める */
export function foe(lineage, x, y, opts) {
  const L = LINEAGES[lineage], o = opts || {};
  const k = (100 + (o.pct || 0)) / 100;
  return { name: o.name || L.ja, lineage, hp: Math.round(L.hp * FOE_HP * k), atk: Math.round(L.atk * FOE_ATK * k), weight: L.weight, move: 'bounce',
           action: o.action || L.foe.action, count: o.count || L.foe.count, actR: o.actR || 105, trait: o.trait || null, x, y };
}

// ---- 卓 ----------------------------------------------------------------------
export const TABLES = {
  kitchen: { ja: '台所のテーブル', gaps: { top: [[120, 240]], bottom: [], left: [[190, 300]], right: [[190, 300]] },
             patches: [{ x: 90, y: 300, r: 46, kind: 'wet' }] },
  living:  { ja: 'リビングのローテーブル', gaps: { top: [[40, 130], [230, 320]], bottom: [[140, 220]], left: [], right: [] },
             patches: [{ x: 270, y: 250, r: 44, kind: 'mat' }], obstacles: [{ x: 180, y: 290, r: 18 }] },
  attic:   { ja: '屋根裏の作業台', gaps: { top: [[130, 230]], bottom: [], left: [[90, 170], [330, 410]], right: [[90, 170], [330, 410]] },
             patches: [{ x: 180, y: 250, r: 40, kind: 'stove', dmg: 10 }] },
};

// 敵の置き場所(手前が味方の陣地なので、敵は奥の 2/3 に置く)
const FOE_SPOTS = [[100, 140], [260, 140], [180, 80], [180, 210], [70, 240], [290, 240]];

/** 系統の並びから通常の戦闘を作る */
export function mobBattle(tableKey, allies, foeLineages, opts) {
  const T = TABLES[tableKey], o = opts || {};
  return {
    gaps: T.gaps, patches: T.patches, obstacles: T.obstacles,
    allies,
    enemies: foeLineages.map((l, i) => foe(l, FOE_SPOTS[i][0], FOE_SPOTS[i][1], { pct: o.pct || 0, trait: o.traits ? o.traits[i] : null })),
  };
}

// ---- ボス --------------------------------------------------------------------
// 4 つの決まり: ルールを変える / 体力ゲージを分ける / 弱点は広く(奥側から当てると 2 倍)/ 章の最初に種類を見せる
export const BOSSES = {
  vacuum: { ja: '掃除機', rule: '敵の番ごとに全員を吸い寄せる。2 本目からは逆に吹き出す' },
  washer: { ja: '洗濯機', rule: '敵の番ごとに卓が回り、切れ目の位置が変わる。2 本目からは全員が外へ振られる' },
  fan:    { ja: '扇風機', rule: '風で駒が流される。風向きは毎ターン変わる。2 本目からは風が強くなる' },
};

export function bossBattle(kind, allies, opts) {
  const o = opts || {}, k = (100 + (o.pct || 0)) / 100;
  const g = (a) => a.map((v) => Math.round(v * k));
  const minion = (l, x, y) => foe(l, x, y, { pct: o.pct || 0 });
  if (kind === 'vacuum') {
    return { gaps: { top: [], bottom: [[130, 230]], left: [[240, 340]], right: [[240, 340]] }, allies,
      enemies: [{ name: '掃除機', boss: 'vacuum', anchored: true, r: 46, mass: 9, hp: 1, gauges: g([220, 250]), atk: Math.round(24 * k), action: 'blast', count: 3, actR: 120, x: 180, y: 120 },
                minion('creature', 80, 240), minion('creature', 280, 240)] };
  }
  if (kind === 'washer') {
    const cycle = [
      { top: [[120, 240]], bottom: [], left: [], right: [] },
      { top: [], bottom: [], left: [], right: [[190, 310]] },
      { top: [], bottom: [[120, 240]], left: [], right: [] },
      { top: [], bottom: [], left: [[190, 310]], right: [] },
    ];
    return { gaps: cycle[0], gapCycle: cycle, allies,
      enemies: [{ name: '洗濯機', boss: 'washer', anchored: true, r: 46, mass: 9, hp: 1, gauges: g([240, 280]), atk: Math.round(24 * k), action: 'beamH', count: 3, actR: 120, x: 180, y: 130 },
                minion('bath', 90, 250), minion('clothing', 270, 250)] };
  }
  // 扇風機
  const wc = [[0, 200], [-200, 0], [0, -200], [200, 0]];
  return { gaps: { top: [[130, 230]], bottom: [[130, 230]], left: [[210, 310]], right: [[210, 310]] }, wind: { ax: wc[0][0], ay: wc[0][1] }, windCycle: wc, allies,
    enemies: [{ name: '扇風機', boss: 'fan', anchored: true, r: 44, mass: 9, hp: 1, gauges: g([210, 240, 210]), atk: Math.round(22 * k), action: 'gust', count: 2, actR: 90, x: 180, y: 110 },
              minion('stationery', 90, 230), minion('toy', 270, 230)] };
}

// ---- おまけ目標(勝利条件は「敵を全滅」のまま。達成するとごほうびが増える) -------
export const GOALS = {
  quick:   { text: (n) => n + ' 手以内に勝つ',          ok: (s, n) => s.shots <= n },
  noFall:  { text: () => '味方を落とさずに勝つ',        ok: (s) => s.stats.allyFalls === 0 },
  allRing: { text: () => '敵を全員、場外で倒す',        ok: (s) => s.stats.enemyKo === 0 && s.stats.enemyRing > 0 },
  chain:   { text: (n) => n + ' れんさ以上を出す',      ok: (s, n) => s.bestChain >= n },
  noHurt:  { text: () => '味方が 1 体も倒れずに勝つ',   ok: (s) => s.stats.allyKo === 0 },
};
/** 戦闘ごとの目標を 1 つ決める(同じ種なら同じ目標)。ボス戦では全員場外は出さない */
export function pickGoal(seed, cfg) {
  const foes = cfg.enemies.length, boss = cfg.enemies.some((e) => e.boss);
  const list = boss ? [['quick', 16], ['noFall', 0], ['chain', 5], ['noHurt', 0]] : [['quick', 4 + foes * 2], ['noFall', 0], ['allRing', 0], ['chain', 4]];
  const g = list[(seed >>> 0) % list.length];
  return { kind: g[0], n: g[1], text: GOALS[g[0]].text(g[1]) };
}
export function goalMet(goal, s) { return s.phase === 'won' && GOALS[goal.kind].ok(s, goal.n); }

export { W, H };
