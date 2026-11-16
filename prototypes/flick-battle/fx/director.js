// はじきバトル 演出の割り振り(ディレクター)。
// 1 手の台本(fx/script.js)を受け取り、格表(fx/tokens.js)に従って「どの刻みで、何を、どれだけ」出すかの
// 指示表(cue)を返す。描画も音も持たない純粋な関数なので、node で検査できる(fx/test.mjs)。
// 画面側は、本物の盤面を 1 刻みずつ進めながら、同じ刻みの指示を実行するだけにする。
//
// 指示の種類(k):
//  stop   { ms, tier }            その刻みのあと、駒の動きだけ止める(輪・文字・粒は動き続ける)
//  pause  { ms, why, pre }        間を置く。pre なら、その刻みを進める前に置く(敵の溜め・10 れんさ前の一瞬の静けさ)
//  shake  { px, ms, nx, ny }      卓を揺らす(当たった向きに)
//  text   { str, size, color, who, x, y, center, key, plate }  文字。size は文字の段(1〜5)、color は色の役割
//  sound  { id, ... }             音(fx/audio.js の部品名)
//  part   { id, x, y, nx, ny, mul } エフェクトの部品(fx/tokens.js の parts)
//  body   { id, anim, ... }       駒の変形(つぶれ・揺れ・場外の回転・割れる・溜め・ひるみ)
//  dim    { pct, ms }             背景を少し暗くする
//  callout{ layers }              呼びかけ(声っぽい合成音)。1 手に 1 回
//  buzz   { ms }                  振動(Android だけ。格に比例した短い 1 回)
//  slow   { i0, i1, rate }        決着のスロー(刻み i0〜i1)
//  zoom   { i0, i1, x, y, scale } 決着の寄り
import { FXT } from './tokens.js';
import { TOUCH_JA, ULT_JA, ACTION_JA } from '../engine/data.js';

const STEP_MS = 1000 / 240; // エンジンの 1 刻み
const TRICK_TEXT = { crashRing: 'ぶつけ落とし!', bankDouble: '柵返し 2 体!' };
const RULE_TEXT = { pull: '吸い寄せ!', blow: '吹き出し!', spin: '卓が回った!', wind: '風向きが変わった!' };
const ENEMY_ACT_MS = 300; // 敵 1 体の間(R1: 1 体 0.3 秒・全体 3 秒以内)
const RULE_MS = 380;      // ボスのルールの発動を読む間 [今]
const ACCENT_RANK = { chord: 5, gauge: 5, ultFire: 4, ring: 3, break: 3, blast: 3, strong: 2, crash: 1, bonus: 1, bumper: 0, pickup: 0 };

/** 小数 1 桁の倍率表示(エンジンの値をそのまま丸める) */
const fmtMult = (m) => '×' + (Math.round(m * 10) / 10).toFixed(1);

/**
 * script: scriptShot() の戻り値
 * ctx: { level: 'full'|'low'|'off', fast: bool, reduceMotion: bool, memory: { chain10, gauge, ult } }
 * 返す: { cues, finale, stats: { shotWaitMs, enemyTurnMs, finaleMs, callouts, peakTier }, memory }
 */
export function planShot(script, ctx) {
  ctx = ctx || {};
  const T = FXT, lv = T.level[ctx.level || 'full'] || T.level.full;
  const fast = !!ctx.fast, stopMul = fast ? T.fastForward.stopsMul : 1;
  const memory = Object.assign({ chain10: 0, gauge: 0, ult: 0 }, ctx.memory || {});
  const sum = script.summary;
  const cues = [];
  const add = (c) => { cues.push(c); return c; };
  const posOf = (r, id, dy) => { const a = r.at[id]; return a ? { x: clampX(a.x), y: Math.max(16, a.y + (dy || 0)) } : { x: 180, y: 140 }; };
  let chain10At = -1;
  const byStep = new Map(); // 刻み → その刻みの出来事
  for (const r of script.events) { if (!byStep.has(r.i)) byStep.set(r.i, []); byStep.get(r.i).push(r); }
  const contactAt = (i, p, q) => { // 同じ刻みの、2 駒の接触(火花の場所と向き)。向きは p から q へ
    for (const r of byStep.get(i) || []) {
      const e = r.e;
      if (e.t !== 'contact') continue;
      if (e.a === p && e.b === q) return e;
      if (e.a === q && e.b === p) return Object.assign({}, e, { nx: -e.nx, ny: -e.ny });
    }
    return null;
  };
  const contactFor = (r) => contactAt(r.i, r.e.by, r.e.to);
  let firstHitDone = false, blastN = 0, peak = 0;
  // 掛け声の候補(場面 → 刻み)。1 手に 1 つだけ、FXT.sound.voicePriority の順で一番上のものを言う
  const voice = {};
  const ten = { chain5: 5, chain10: 10, chainOver: 11 };
  const chainOf = (n) => T.chain[n] || (n >= 10 ? T.chain[10] : n >= 6 ? T.chain[6] : T.chain[1]);
  const fin = sum.finale;

  for (const r of script.events) {
    const e = r.e, i = r.i, enemyPhase = r.phase === 'enemy';
    const tgt = e.to !== undefined ? r.at[e.to] : null;
    const tier = (t) => { if (!enemyPhase && t > peak) peak = t; return t; };
    switch (e.t) {
      case 'contact': { // ゲームの出来事を伴わない接触(味方どうし・物・敵どうし)は、小さな音と粒だけ
        if (e.v < 200) break;
        add({ i, k: 'sound', id: 'tap', v: e.v });
        if (e.v > 500) add({ i, k: 'part', id: 'tap', x: e.x, y: e.y, nx: e.nx, ny: e.ny, mul: lv.particles * 0.5 });
        break;
      }
      case 'rail': if (e.v > 300) add({ i, k: 'sound', id: 'rail', v: e.v }); break;
      case 'hit': {
        if (!tgt) break;
        const toEnemy = tgt.side === 1, mine = toEnemy && (e.kind === 'hit' || e.kind === 'ult');
        add({ i, k: 'text', str: '-' + e.dmg, size: 4, color: e.kind === 'dot' ? 'poison' : toEnemy ? 'plain' : 'harm', who: toEnemy ? 'enemy' : 'ally',
              ...posOf(r, e.to, -tgt.r), key: 'dmg' });
        if (mine && !enemyPhase) {
          tier(0);
          const c = contactFor(r);
          add({ i, k: 'sound', id: 'hit', n: Math.min(T.sound.chainCap, Math.max(1, cueChain(script, r))), v: c ? c.v : 0 });
          if (c) add({ i, k: 'part', id: 'hit', x: c.x, y: c.y, nx: c.nx, ny: c.ny, mul: lv.particles * (firstHitDone ? T.parts.hit.laterMul : 1) });
          add({ i, k: 'body', id: e.to, anim: 'squash', amt: T.body.hitSquash.normal, nx: c ? c.nx : 0, ny: c ? c.ny : -1 });
          if (e.by >= 0) add({ i, k: 'body', id: e.by, anim: 'squash', amt: T.body.hitSquash.normal, nx: c ? -c.nx : 0, ny: c ? -c.ny : 1 });
          if (!firstHitDone) add({ i, k: 'stop', ms: T.tiers[0].firstHitStopMs, tier: 0, why: 'first' });
          firstHitDone = true;
        } else if (!toEnemy && e.kind !== 'dot') {
          add({ i, k: 'sound', id: 'harm' });
          add({ i, k: 'body', id: e.to, anim: 'squash', amt: T.body.hitSquash.normal, nx: 0, ny: 1 });
        }
        break;
      }
      case 'strong': {
        if (!tgt) break;
        const h = (byStep.get(i) || []).find((q) => q.e.t === 'hit' && q.e.to === e.to);
        const c = h ? contactAt(i, h.e.by, e.to) : null;
        tier(1);
        add({ i, k: 'text', str: '強打!', size: T.tiers[1].text, color: 'good', who: 'enemy', ...posOf(r, e.to, -tgt.r - 16) });
        add({ i, k: 'stop', ms: T.tiers[1].hitstopMs, tier: 1, why: 'strong' });
        add({ i, k: 'shake', px: T.tiers[1].shakePx * lv.shake, ms: T.tiers[1].shakeMs, nx: c ? c.nx : 0, ny: c ? c.ny : -1 });
        add({ i, k: 'sound', id: 'strong' });
        add({ i, k: 'part', id: 'strong', x: c ? c.x : tgt.x, y: c ? c.y : tgt.y, nx: c ? c.nx : 0, ny: c ? c.ny : -1, mul: lv.particles });
        add({ i, k: 'body', id: e.to, anim: 'squash', amt: T.body.hitSquash.strong, nx: c ? c.nx : 0, ny: c ? c.ny : -1 });
        add({ i, k: 'body', id: e.to, anim: 'jitter', px: T.body.strongJitter.px, ms: T.body.strongJitter.ms });
        add({ i, k: 'buzz', ms: 20 });
        break;
      }
      case 'chain': {
        if (enemyPhase) break;
        const n = e.n, L = chainOf(n);
        if (n >= 2) {
          let str = String(n), size = L.text, plate = !!L.plate;
          if (n === 3) str = '3 れんさ' + (sum.chainCharge ? ' 必殺+1' : '');
          else if (n >= 10) str = n + ' れんさ';
          else if (n >= T.chain.multFrom) str = n + ' れんさ ' + fmtMult(r.mult || 1);
          add({ i, k: 'text', str, size, color: n === 2 ? 'plain' : L.color, who: 'enemy', center: true, key: 'chain', plate });
        }
        if (n === 3) { tier(1); add({ i, k: 'stop', ms: L.stopMs, tier: 1, why: 'chain3' }); add({ i, k: 'sound', id: 'chord', notes: 2, n }); }
        if (n === 5) {
          tier(2);
          add({ i, k: 'stop', ms: L.stopMs, tier: 2, why: 'chain5' }); add({ i, k: 'sound', id: 'chord', notes: 3, low: true, n });
          if (lv.particles > 0) add({ i, k: 'dim', pct: L.dim.pct, ms: L.dim.ms });
        }
        if (n === 10) {
          tier(3);
          const seen = memory.chain10++;
          add({ i, k: 'pause', ms: L.preSilenceMs, why: 'preSilence', pre: true });
          add({ i, k: 'stop', ms: L.stopMs * (seen ? L.repeatMul : 1), tier: 3, why: 'chain10' });
          add({ i, k: 'sound', id: 'chord', notes: 4, low: true, n });
          if (lv.particles > 0) add({ i, k: 'dim', pct: L.dim.pct, ms: L.dim.ms });
        }
        if (n > 10) add({ i, k: 'sound', id: 'chord', notes: Math.min(T.chain.over.chordMax, 4), n });
        if (L.dots && r.at && lv.particles > 0) add({ i, k: 'part', id: 'milestone', n, mul: lv.particles, dots: L.dots });
        for (const [key, at] of Object.entries(ten)) if (n === at && voice[key] === undefined) voice[key] = i;
        if (n === 10) chain10At = i;
        break;
      }
      case 'touch': if (r.at[e.by]) { add({ i, k: 'text', str: TOUCH_JA[e.kind] || e.kind, size: 4, color: 'good', who: 'enemy', ...posOf(r, e.by, r.at[e.by].r + 16) }); add({ i, k: 'part', id: 'touch', ...posOf(r, e.by, 0), mul: lv.particles }); } break;
      case 'relay': if (tgt) { tier(1); add({ i, k: 'text', str: '玉突き!', size: 3, color: 'good', who: 'enemy', ...posOf(r, e.to, -tgt.r - 16) }); add({ i, k: 'part', id: 'touch', ...posOf(r, e.to, 0), mul: lv.particles }); add({ i, k: 'sound', id: 'relay' }); } break;
      case 'crash': if (tgt) { tier(1); add({ i, k: 'text', str: 'ぶつけ!', size: 3, color: 'good', who: 'enemy', ...posOf(r, e.to, -tgt.r - 14) }); add({ i, k: 'sound', id: 'crash' }); add({ i, k: 'shake', px: 2 * lv.shake, ms: 110, nx: 0, ny: 0 }); } break;
      case 'friendly': if (tgt) { tier(1); add({ i, k: 'text', str: '巻き込んだ!', size: 3, color: 'good', who: 'enemy', ...posOf(r, e.to, -tgt.r - 14) }); } break;
      case 'split': if (r.at[e.by]) { tier(1); add({ i, k: 'text', str: '二枚刃!', size: 3, color: 'good', who: 'enemy', ...posOf(r, e.by, -r.at[e.by].r - 16) }); } break;
      case 'execute': if (tgt) { tier(1); add({ i, k: 'text', str: 'とどめ!', size: 3, color: 'great', who: 'enemy', ...posOf(r, e.to, -tgt.r - 16) }); } break;
      case 'ko': {
        const u = r.at[e.id];
        if (!u || u.kind === 'mini') break;
        const isFinal = fin && fin.koI === i && fin.id === e.id;
        if (u.side === 1) {
          tier(isFinal ? 4 : 2);
          add({ i, k: 'text', str: e.how === 'ring' ? '場外!' : 'たおれた', size: isFinal ? T.tiers[4].text : T.tiers[2].text, color: 'good', who: 'enemy', ...posOf(r, e.id, 0) });
          add({ i, k: 'body', id: e.id, anim: e.how === 'ring' ? 'ringOut' : 'shatter', x: u.x, y: u.y, vx: u.vx, vy: u.vy });
          add({ i, k: 'part', id: e.how === 'ring' ? 'ringOut' : 'shatter', x: u.x, y: u.y, mul: lv.particles });
          if (!isFinal) { add({ i, k: 'stop', ms: T.tiers[2].hitstopMs, tier: 2, why: 'ko' }); add({ i, k: 'sound', id: e.how === 'ring' ? 'ring' : 'break' }); add({ i, k: 'buzz', ms: 25 }); }
        } else {
          add({ i, k: 'text', str: 'たおれた', size: 3, color: 'harm', who: 'ally', ...posOf(r, e.id, 0) });
          add({ i, k: 'sound', id: 'harm' });
        }
        break;
      }
      case 'fall': if (r.at[e.id]) { add({ i, k: 'text', str: '落ちた(戻る)', size: 3, color: 'harm', who: 'ally', ...posOf(r, e.id, -20) }); add({ i, k: 'body', id: e.id, anim: 'allyFall' }); add({ i, k: 'sound', id: 'harm' }); } break;
      case 'bonusShot': tier(2); add({ i, k: 'text', str: '場外: もう 1 手!', size: 2, color: 'great', who: 'enemy', center: true }); add({ i, k: 'sound', id: 'bonus' }); if (voice.bonus === undefined) voice.bonus = i; break;
      case 'blast': {
        tier(2);
        const first = blastN++ === 0; // 海物語の型: 同じ演出を大きさで格づける。2 発目からは輪だけ
        add({ i, k: 'part', id: first ? 'blast' : 'blastRing', x: e.x, y: e.y, r: e.r, delayMs: (blastN - 1) * T.parts.blast.staggerMs, mul: lv.particles });
        if (first) { add({ i, k: 'stop', ms: 60, tier: 2, why: 'blast' }); add({ i, k: 'shake', px: 3 * lv.shake, ms: 140, nx: 0, ny: 0 }); }
        add({ i, k: 'sound', id: 'blast', k2: blastN });
        break;
      }
      case 'ult': if (r.at[e.by]) { tier(3); memory.ult++; add({ i, k: 'text', str: (ULT_JA[e.kind] || e.kind) + '!', size: 2, color: 'great', who: 'enemy', ...posOf(r, e.by, -r.at[e.by].r - 18) }); add({ i, k: 'part', id: 'ultFire', ...posOf(r, e.by, 0), mul: lv.particles }); add({ i, k: 'sound', id: 'ultFire' }); } break;
      case 'ultAfter': if (r.at[e.by]) add({ i, k: 'part', id: 'ultAfter', ...posOf(r, e.by, 0), mul: lv.particles }); break;
      case 'gaugeBreak': {
        if (!enemyPhase && voice.gauge === undefined) voice.gauge = i;
        tier(3);
        const seen = memory.gauge++;
        add({ i, k: 'text', str: 'ゲージを割った!', size: 2, color: 'great', who: 'enemy', ...posOf(r, e.id, -60) });
        add({ i, k: 'stop', ms: T.tiers[3].hitstopMs * (seen ? T.tiers[3].repeatMul : 1), tier: 3, why: 'gauge' });
        add({ i, k: 'shake', px: T.tiers[3].shakePx * lv.shake, ms: T.tiers[3].shakeMs, nx: 0, ny: 0 });
        add({ i, k: 'part', id: 'gauge', ...posOf(r, e.id, -40), mul: lv.particles });
        add({ i, k: 'body', id: e.id, anim: 'flinch', amt: T.body.bossFlinch.squash, ms: T.body.bossFlinch.ms });
        add({ i, k: 'sound', id: 'gauge' });
        break;
      }
      case 'trick': tier(2); add({ i, k: 'text', str: TRICK_TEXT[e.kind] || '', size: 2, color: 'great', who: 'enemy', center: true }); break;
      case 'pinOpen': tier(2); add({ i, k: 'text', str: 'お皿を全部倒した: 柵が開いた!', size: 3, color: 'great', who: 'enemy', center: true }); break;
      case 'bumper': add({ i, k: 'sound', id: 'bumper' }); add({ i, k: 'part', id: 'bumper', ...posOf(r, e.id, 0), mul: lv.particles }); break;
      case 'pickup': if (tgt) { add({ i, k: 'text', str: 'おやつ', size: 4, color: 'heal', who: 'ally', ...posOf(r, e.to, -tgt.r - 16) }); add({ i, k: 'sound', id: 'pickup' }); } break;
      case 'lid': add({ i, k: 'text', str: 'おやつが出た', size: 4, color: 'heal', who: 'ally', x: clampX(e.x), y: Math.max(16, e.y - 20) }); break;
      case 'heal': if (tgt) add({ i, k: 'text', str: '+' + e.amt, size: 4, color: 'heal', who: tgt.side === 0 ? 'ally' : 'enemy', ...posOf(r, e.to, -tgt.r) }); break;
      case 'shield': if (tgt) add({ i, k: 'text', str: '盾+' + e.amt, size: 4, color: 'good', who: 'ally', ...posOf(r, e.to, -tgt.r - 14) }); break;
      case 'block': if (tgt) add({ i, k: 'text', str: '盾で防いだ', size: 4, color: 'good', who: 'ally', ...posOf(r, e.to, -tgt.r - 14) }); break;
      case 'stun': if (tgt) add({ i, k: 'text', str: 'カウント+', size: 4, color: 'good', who: 'enemy', ...posOf(r, e.to, -tgt.r - 14) }); break;
      case 'poison': if (tgt) add({ i, k: 'text', str: '毒' + e.n, size: 4, color: 'poison', who: tgt.side === 1 ? 'enemy' : 'ally', ...posOf(r, e.to, tgt.r + 14) }); break;
      case 'charge': if (tgt) add({ i, k: 'text', str: '必殺が進んだ', size: 4, color: 'great', who: 'ally', ...posOf(r, e.to, -tgt.r - 14) }); break;
      case 'chainCharge': break; // 3 れんさの文字にまとめて出した
      case 'act': {
        const u = r.at[e.by];
        if (!u) break;
        const strong = e.kind === 'charge' || e.kind === 'blast' || e.kind === 'bomb';
        add({ i, k: 'body', id: e.by, anim: 'windup', amt: T.body.windup.squash, ms: strong ? T.body.windup.strongMs : T.body.windup.ms });
        add({ i, k: 'pause', ms: strong ? T.body.windup.strongMs : T.body.windup.ms, why: 'windup', pre: true });
        add({ i, k: 'text', str: ACTION_JA[e.kind] || e.kind, size: 4, color: 'harm', who: 'ally', ...posOf(r, e.by, u.r + 16) });
        add({ i, k: 'pause', ms: ENEMY_ACT_MS, why: 'act' });
        break;
      }
      case 'bossRule': add({ i, k: 'text', str: RULE_TEXT[e.kind] || '', size: 3, color: 'boss', who: 'ally', center: true }); add({ i, k: 'pause', ms: RULE_MS, why: 'rule' }); break;
      case 'explode': add({ i, k: 'part', id: 'explode', x: (r.at[e.by] || {}).x, y: (r.at[e.by] || {}).y, r: e.r, mul: lv.particles }); break;
      default: break;
    }
  }

  // ---- 手の終わり: 合計と、倒しきれなかった敵の本当の残り -------------------------
  if (sum.dmg > 0 && script.shotEnd >= 0) add({ i: script.shotEnd, k: 'text', str: '合計 ' + sum.dmg, size: peak >= 2 ? 2 : 4, color: 'plain', who: 'enemy', center: true });
  if (!sum.won && script.shotEnd >= 0) {
    for (const u of script.end.units) {
      if (u.alive && u.side === 1 && u.kind !== 'boss' && u.hp > 0 && u.hp <= u.maxHp * 0.08)
        add({ i: script.shotEnd, k: 'text', str: 'のこり ' + u.hp, size: 4, color: 'plain', who: 'enemy', x: clampX(u.x), y: Math.max(16, u.y - u.r - 26) });
    }
  }

  // ---- 決着: 当たる前から減速して寄る(本当に決着するときだけ) -----------------------
  let finale = null;
  if (fin) {
    const F = T.tiers[4];
    add({ i: fin.koI, k: 'stop', ms: F.hitstopMs * stopMul, tier: 4, why: 'finale' });
    add({ i: fin.koI, k: 'shake', px: F.shakePx * lv.shake, ms: F.shakeMs, nx: 0, ny: 0, why: 'finale' });
    add({ i: fin.koI, k: 'sound', id: 'finale', boss: fin.boss, special: fin.special });
    add({ i: fin.koI, k: 'part', id: 'finale', x: fin.x, y: fin.y, mul: lv.particles });
    add({ i: fin.koI, k: 'buzz', ms: 60 });
    if (fin.special) add({ i: fin.koI, k: 'text', str: fin.kosInShot + ' 体まとめて!', size: 1, color: 'great', who: 'enemy', center: true });
    if (fin.phase === 'shot') {
      const lead = Math.round(F.slowLeadMs / STEP_MS), tail = Math.round(100 / STEP_MS);
      let i0 = Math.max(0, fin.hitI - lead), i1 = Math.min(fin.koI, fin.hitI + lead) + tail;
      // 余韻の上限に収める(スロー中の実時間 + 止め)
      const realMs = () => (i1 - i0) * STEP_MS / (F.slowRate) * stopMul + F.hitstopMs * stopMul;
      while (realMs() > F.totalMaxMs && i0 < fin.hitI) i0++;
      while (realMs() > F.totalMaxMs && i1 > fin.hitI + 1) i1--;
      add({ i: i0, k: 'slow', i0, i1, rate: F.slowRate });
      // 溜め: 減速が始まってから当たるまでの実時間で、上がりきる(決着は台本で確定しているので外れない)
      const riseMs = Math.max(120, (fin.hitI - i0) * STEP_MS / F.slowRate * stopMul);
      add({ i: i0, k: 'sound', id: 'riser', ms: riseMs, top: 2093, why: 'riseFinale' });
      const close = sum.allyHpRatio < 0.35;
      if ((fin.boss || close || fin.special) && !ctx.reduceMotion && lv.shake > 0) add({ i: i0, k: 'zoom', i0, i1, x: fin.x, y: fin.y, scale: F.zoom });
      finale = { i0, i1, koI: fin.koI, ms: realMs(), special: fin.special, boss: fin.boss };
    }
  }

  // ---- ダメージの数字: 同じ瞬間に 4 つ以上なら、合計 1 つにまとめる [R1] ----------------------
  mergeDamage(cues);
  // ---- 10 れんさの溜め(決着の溜めと重なるときは決着を優先) ----------------------------------
  if (chain10At >= 0 && !(finale && Math.abs(finale.i0 - chain10At) < Math.round(600 / STEP_MS))) {
    const lead = Math.round(T.sound.riser.leadMs / STEP_MS), i0 = Math.max(0, chain10At - lead);
    if (chain10At - i0 >= Math.round(120 / STEP_MS)) add({ i: i0, k: 'sound', id: 'riser', ms: (chain10At - i0) * STEP_MS * stopMul, top: 1760, why: 'rise10' });
  }
  // ---- 掛け声: 1 手に 1 つ(決着の特別版 > 決着 > ゲージ割り > 11 れんさ > 10 れんさ > もう 1 手 > 5 れんさ) --------------
  if (fin) { if (fin.special) voice.special = fin.koI; else voice.finale = fin.koI; }
  for (const key of T.sound.voicePriority) {
    if (voice[key] === undefined) continue;
    const layers = key === 'chainOver' ? 3 : key === 'chain10' ? 2 : 1;
    add({ i: voice[key], k: 'callout', line: T.sound.voiceLines[key], key, layers });
    break;
  }
  // ---- 重なりの決まり: 同じ瞬間の止め・揺れ・目立つ音は、一番上のものを 1 回だけ -----------
  mergeMoments(cues);
  // ---- 予算: 1 手で足す待ちの合計を上限に収める(決着は別枠)。下の格から削る -----------------
  enforceBudget(cues, stopMul);
  cues.sort((a, b) => a.i - b.i);
  return { cues, finale, memory, stats: planStats(cues, script, finale) };
}

const clampX = (x) => Math.max(24, Math.min(336, x));

/** その当たりの時点のれんさ数(音の高さに使う) */
function cueChain(script, r) {
  let n = 0;
  for (const q of script.events) { if (q === r) break; if (q.e.t === 'chain' && q.phase === 'shot') n = q.e.n; }
  return n || 1;
}

function mergeDamage(cues) {
  const W = Math.round(FXT.sameMomentMs / STEP_MS), at = FXT.budget.damageMergeAt;
  const list = cues.filter((c) => c.k === 'text' && c.key === 'dmg' && c.who === 'enemy').sort((a, b) => a.i - b.i);
  let g = [];
  const flush = () => {
    if (g.length >= at) {
      let sum = 0, x = 0, y = 0;
      for (const c of g) { sum += +c.str.slice(1); x += c.x; y += c.y; c.drop = true; }
      cues.push({ i: g[0].i, k: 'text', str: '-' + sum, size: 4, color: 'plain', who: 'enemy', x: clampX(x / g.length), y: Math.max(16, y / g.length), key: 'dmg', merged: g.length });
    }
    g = [];
  };
  for (const c of list) { if (g.length && c.i - g[0].i > W) flush(); g.push(c); }
  flush();
  for (let k = cues.length - 1; k >= 0; k--) if (cues[k].drop) cues.splice(k, 1);
}

function mergeMoments(cues) {
  const W = Math.round(FXT.sameMomentMs / STEP_MS);
  // 決着の瞬間は決着だけ(近くの止め・揺れは決着に吸収する)
  for (const f of cues.filter((c) => c.k === 'stop' && c.why === 'finale'))
    for (const c of cues) if ((c.k === 'stop' || c.k === 'shake') && c.why !== 'finale' && Math.abs(c.i - f.i) <= W) c.drop = true;
  const pick = (kind, score) => {
    const list = cues.filter((c) => c.k === kind && !c.pre && c.why !== 'finale' && c.why !== 'act' && c.why !== 'rule').sort((a, b) => a.i - b.i);
    let g = [];
    const flush = () => {
      if (g.length > 1) { let best = g[0]; for (const c of g) if (score(c) > score(best)) best = c; for (const c of g) if (c !== best) c.drop = true; }
      g = [];
    };
    for (const c of list) { if (g.length && c.i - g[0].i > W) flush(); g.push(c); }
    flush();
  };
  pick('stop', (c) => c.tier * 10000 + c.ms);
  pick('shake', (c) => (c.why === 'finale' ? 1e9 : c.px));
  // 目立つ音(強打・和音・場外など)は 1 瞬間に 1 つ。当たりの音階・小さな音は残す
  const accents = cues.filter((c) => c.k === 'sound' && ACCENT_RANK[c.id] !== undefined).sort((a, b) => a.i - b.i);
  let g = [];
  const flush = () => { if (g.length > 1) { let best = g[0]; for (const c of g) if (ACCENT_RANK[c.id] > ACCENT_RANK[best.id]) best = c; for (const c of g) if (c !== best) c.drop = true; } g = []; };
  for (const c of accents) { if (g.length && c.i - g[0].i > W) flush(); g.push(c); }
  flush();
  for (let k = cues.length - 1; k >= 0; k--) if (cues[k].drop) cues.splice(k, 1);
}

function enforceBudget(cues, stopMul) {
  const cap = FXT.budget.addedWaitPerShotMs;
  for (const c of cues) if ((c.k === 'stop' || c.k === 'pause') && c.why !== 'finale') c.ms *= stopMul; // 早送りは止め・間を半分
  const own = () => cues.filter((c) => (c.k === 'stop' || (c.k === 'pause' && c.why === 'preSilence')) && c.why !== 'finale');
  const total = () => own().reduce((a, c) => a + c.ms, 0);
  // 下の格から: 格 0 → 0、格 1・2 → 2 コマまで縮める、格 3 → 半分
  if (total() > cap) for (const c of own()) if (c.tier === 0) c.ms = 0;
  for (const t of [1, 2]) {
    const list = own().filter((c) => c.tier === t);
    while (total() > cap && list.some((c) => c.ms > FXT.frameMs * 2 + 0.01)) for (const c of list) c.ms = Math.max(FXT.frameMs * 2, c.ms * 0.8);
  }
  for (const c of own()) if (c.tier === 3 && total() > cap) c.ms = Math.max(c.ms * FXT.tiers[3].repeatMul, c.ms - (total() - cap)); // 山場は必要な分だけ削る(半分まで)
  if (total() > cap) { const k = cap / total(); for (const c of own()) c.ms *= k; }
  // 敵の番: 全体を上限に収める
  const ecap = FXT.budget.enemyTurnMaxMs;
  const en = cues.filter((c) => c.k === 'pause' && (c.why === 'act' || c.why === 'windup' || c.why === 'rule'));
  const et = en.reduce((a, c) => a + c.ms, 0);
  if (et > ecap) { const k = ecap / et; for (const c of en) c.ms *= k; }
}

function planStats(cues, script, finale) {
  let shotWaitMs = 0, enemyTurnMs = 0, callouts = 0, peakTier = 0;
  for (const c of cues) {
    if ((c.k === 'stop' || (c.k === 'pause' && c.why === 'preSilence')) && c.why !== 'finale') shotWaitMs += c.ms;
    if (c.k === 'pause' && (c.why === 'act' || c.why === 'windup' || c.why === 'rule')) enemyTurnMs += c.ms;
    if (c.k === 'callout') callouts++;
    if (c.k === 'stop' && c.tier > peakTier) peakTier = c.tier;
  }
  return { shotWaitMs, enemyTurnMs, finaleMs: finale ? finale.ms : 0, callouts, peakTier, maxChain: script.summary.maxChain };
}

/**
 * 指示表が演出の決まりを守っているかを調べる(検査器と画面の両方から使う)。違反の一覧を返す(空なら合格)
 */
export function auditPlan(plan) {
  const v = [];
  const B = FXT.budget;
  const sizes = new Set();
  for (const c of plan.cues) {
    if (c.k === 'text') {
      sizes.add(c.size);
      if (!(c.size >= 1 && c.size <= 5 && Number.isInteger(c.size))) v.push('文字の段が 1〜5 の外: ' + c.str + ' ' + c.size);
      if (c.color === 'harm' && c.who !== 'ally') v.push('危険色を、味方に悪いこと以外に使った: ' + c.str);
      if (!FXT.color[c.color]) v.push('色の役割が未定義: ' + c.color);
    }
    if ((c.k === 'stop' || c.k === 'pause') && c.i < 0) v.push('離した瞬間に止めている(入力への反応が遅れる): ' + c.why);
  }
  if (sizes.size > B.textTiersMax) v.push('文字の段が ' + sizes.size + ' 種類');
  if (plan.stats.callouts > 1) v.push('呼びかけが 1 手に ' + plan.stats.callouts + ' 回');
  if (plan.stats.shotWaitMs > B.addedWaitPerShotMs + 0.5) v.push('1 手の待ちが ' + Math.round(plan.stats.shotWaitMs) + 'ms');
  if (plan.stats.enemyTurnMs > B.enemyTurnMaxMs + 0.5) v.push('敵の番の間が ' + Math.round(plan.stats.enemyTurnMs) + 'ms');
  if (plan.stats.finaleMs > B.finaleMaxMs + 0.5) v.push('決着の余韻が ' + Math.round(plan.stats.finaleMs) + 'ms');
  const W = Math.round(FXT.sameMomentMs / STEP_MS);
  const stops = plan.cues.filter((c) => c.k === 'stop' && c.why !== 'finale').map((c) => c.i).sort((a, b) => a - b);
  for (let k = 1; k < stops.length; k++) if (stops[k] - stops[k - 1] <= W && stops[k] !== stops[k - 1]) { v.push('同じ瞬間に止めが 2 回(刻み ' + stops[k - 1] + ' と ' + stops[k] + ')'); break; }
  for (let k = 1; k < stops.length; k++) if (stops[k] === stops[k - 1]) { v.push('同じ刻みに止めが 2 つ'); break; }
  // 明暗の変化(暗転・閃光)は 1 秒に 3 回まで(刻みの近さで見積もる)
  const flashes = plan.cues.filter((c) => c.k === 'dim' || (c.k === 'part' && (c.id === 'finale' || c.id === 'ultFire'))).map((c) => c.i).sort((a, b) => a - b);
  for (let k = 0; k + FXT.budget.flashesPerSecMax < flashes.length; k++) if (flashes[k + FXT.budget.flashesPerSecMax] - flashes[k] < 240) { v.push('明暗の変化が 1 秒に ' + (FXT.budget.flashesPerSecMax + 1) + ' 回以上'); break; }
  return v;
}
