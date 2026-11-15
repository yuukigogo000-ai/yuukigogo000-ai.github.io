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

/** 味方 1 体。pct は育ち具合(体力と攻撃力だけが伸びる。おもさは変わらない) */
export function ally(lineage, opts) {
  const L = LINEAGES[lineage], o = opts || {};
  const k = (100 + (o.pct || 0)) / 100;
  return { name: o.name || L.ja, lineage, hp: Math.round(L.hp * k * (o.hpMul || 1)), atk: Math.round(L.atk * k * (o.atkMul || 1)),
           weight: Math.max(1, Math.min(5, L.weight + (o.weightAdj || 0))), move: L.move, touch: L.touch, ult: L.ult, ultNeed: L.ultNeed };
}

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

export { W, H };
