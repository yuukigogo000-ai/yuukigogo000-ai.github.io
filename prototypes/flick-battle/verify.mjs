// はじきバトル試作の検証(Node で実行: node verify.mjs)
// 再現性・停止性・すり抜け・速度・戦闘の長さ・狙いのシビアさを数字で出す。
import './sim.js';
import { writeFileSync } from 'node:fs';

const S = globalThis.FlickSim;
const out = {};
const hex = (n) => n.toString(16).padStart(8, '0');

// ---- 戦闘を最後まで回す ---------------------------------------------------
function playBattle(stage, policy, seed, overrides) {
  const rnd = S.mulberry32(seed);
  const s = S.createState(stage, overrides);
  let h = 0x811c9dc5, animSteps = 0;
  const MAX_SHOTS = 80;
  while (s.phase === 'aim' && s.shots < MAX_SHOTS) {
    let dx, dy, p;
    if (policy === 'ai') { const b = S.bestShot(s); dx = b.dx; dy = b.dy; p = b.power; }
    else if (typeof policy === 'number') {
      // 最善手を選ぶが、狙いが ±policy 候補ぶん(1 候補 ≒ 2.8 度)ずれる
      const b = S.bestShot(s);
      const off = Math.round((rnd() * 2 - 1) * policy);
      const d = S.DIRS[(b.dirIndex + off + S.DIRS.length) % S.DIRS.length];
      dx = d[0]; dy = d[1]; p = b.power;
    }
    else {
      const d = S.DIRS[Math.floor(rnd() * S.DIRS.length)]; dx = d[0]; dy = d[1];
      p = S.POWERS[Math.floor(rnd() * S.POWERS.length)];
    }
    const before = s.stats.steps;
    S.shoot(s, dx, dy, p);
    S.resolve(s);
    animSteps += s.stats.steps - before;
    h = S.hashState(s, h);
  }
  return { s, hash: h, animSec: animSteps * S.DT };
}

// ---- 1. 再現性(同じ入力を 2 回流してビット単位で一致するか) --------------
{
  const N = 300;
  let chainA = 0x811c9dc5, chainB = 0x811c9dc5, mismatches = 0;
  for (let seed = 1; seed <= N; seed++) {
    const stage = seed % 2 ? 'mob' : 'boss';
    const a = playBattle(stage, 'random', seed).hash;
    const b = playBattle(stage, 'random', seed).hash;
    if (a !== b) mismatches++;
    chainA = Math.imul(chainA ^ a, 0x01000193) >>> 0;
    chainB = Math.imul(chainB ^ b, 0x01000193) >>> 0;
  }
  out.determinism = { battles: N, mismatches, goldenHash: hex(chainA), secondRunHash: hex(chainB) };
}

// ---- 2. 停止性・すり抜け・異常値 -------------------------------------------
{
  let capHits = 0, maxSteps = 0, maxPen = 0, bad = 0, steps = 0, shots = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const { s } = playBattle(seed % 2 ? 'mob' : 'boss', 'random', 1000 + seed);
    capHits += s.stats.capHits;
    maxSteps = Math.max(maxSteps, s.stats.maxMotionSteps);
    maxPen = Math.max(maxPen, s.stats.maxPenetration);
    steps += s.stats.steps; shots += s.shots;
    for (const u of s.units) {
      if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.vx) || !Number.isFinite(u.vy)) bad++;
      if (u.alive && (u.x < 0 || u.x > s.w || u.y < 0 || u.y > s.h)) bad++; // 生きているのに盤外
    }
  }
  const minR = Math.min(...Object.values(S.ARCH).map((a) => a.r));
  out.stability = {
    battles: 400, shots, capHits, longestMotionSec: +(maxSteps * S.DT).toFixed(2),
    maxPenetration: +maxPen.toFixed(2), smallestRadius: minR, invalidUnits: bad,
    avgStepsPerShot: Math.round(steps / shots),
  };
}

// ---- 3. 速度 ---------------------------------------------------------------
{
  // 物理 1 刻みのコスト
  const s = S.createState('mob');
  let n = 0;
  const t0 = performance.now();
  for (let i = 0; i < 400; i++) {
    const c = S.cloneState(s);
    const d = S.DIRS[(i * 7) % S.DIRS.length];
    S.shoot(c, d[0], d[1], 100, { noEnemyPhase: true });
    S.resolve(c);
    n += c.stats.steps;
  }
  const dt = performance.now() - t0;
  // おまかせ 1 手(候補 384 手を全部シミュレート)
  const t1 = performance.now();
  for (let i = 0; i < 10; i++) S.bestShot(s);
  const aiMs = (performance.now() - t1) / 10;
  out.perfNode = { usPerStep: +(dt * 1000 / n).toFixed(3), msPerShotSim: +(dt / 400).toFixed(3),
                   candidatesPerAiTurn: S.DIRS.length * S.POWERS.length, msPerAiTurn: +aiMs.toFixed(1) };
}

// ---- 4. 戦闘の長さ・勝率・場外の割合 ---------------------------------------
function summarize(stage, policy, n, overrides) {
  let wins = 0, shots = 0, anim = 0, koRingE = 0, koHpE = 0, koRingP = 0, koHpP = 0, self = 0, dd = 0, ds = 0, unfinished = 0;
  const shotList = [];
  for (let seed = 1; seed <= n; seed++) {
    const { s, animSec } = playBattle(stage, policy, 5000 + seed, overrides);
    if (s.phase === 'won') wins++;
    if (s.phase === 'aim') unfinished++;
    shots += s.shots; anim += animSec; shotList.push(s.shots);
    koRingE += s.stats.koRing[1]; koHpE += s.stats.koHp[1];
    koRingP += s.stats.koRing[0]; koHpP += s.stats.koHp[0];
    self += s.stats.selfRing; dd += s.stats.dmgDirect; ds += s.stats.dmgSkill;
  }
  shotList.sort((a, b) => a - b);
  return {
    battles: n, winRate: +(wins / n).toFixed(2), unfinished,
    shotsAvg: +(shots / n).toFixed(1), shotsMedian: shotList[n >> 1], shotsMin: shotList[0], shotsMax: shotList[n - 1],
    animSecAvg: +(anim / n).toFixed(1),
    enemyKoByRingOut: +(koRingE / Math.max(1, koRingE + koHpE)).toFixed(2),
    playerKoByRingOut: +(koRingP / Math.max(1, koRingP + koHpP)).toFixed(2),
    playerKoPerBattle: +((koRingP + koHpP) / n).toFixed(2),
    selfRingOutPerBattle: +(self / n).toFixed(2),
    skillDamageShare: +(ds / Math.max(1, dd + ds)).toFixed(2),
  };
}
out.battles = {
  mob_ai: summarize('mob', 'ai', 1),
  mob_random: summarize('mob', 'random', 200),
  boss_ai: summarize('boss', 'ai', 1),
  boss_random: summarize('boss', 'random', 200),
  // 狙いの誤差と勝率(最善手から ±N 候補ずれる打ち手。1 候補 ≒ 2.8 度)
  mob_err3deg: summarize('mob', 1, 30), mob_err6deg: summarize('mob', 2, 30),
  mob_err8deg: summarize('mob', 3, 30), mob_err14deg: summarize('mob', 5, 30),
  boss_err3deg: summarize('boss', 1, 30), boss_err6deg: summarize('boss', 2, 30),
  boss_err8deg: summarize('boss', 3, 30), boss_err14deg: summarize('boss', 5, 30),
  // 編成を変えると結果が変わるか(軽いぬいぐるみを重いいすに差し替え)
  mob_ai_chair: summarize('mob', 'ai', 1, { players: [['pot', 110, 440], ['chair', 180, 475], ['pencil', 250, 440], ['onigiri', 180, 400]] }),
  boss_ai_chair: summarize('boss', 'ai', 1, { players: [['pot', 110, 440], ['chair', 180, 475], ['pencil', 250, 440], ['onigiri', 180, 400]] }),
};

// ---- 5. 狙いのシビアさ(少しずれただけで結果が変わるか) --------------------
{
  // 戦闘途中の局面を集め、全方向の点数を並べて「良い手の幅」を測る
  const degPerStep = 360 / S.DIRS.length;
  let states = 0, widthSum = 0, narrow = 0, flipSum = 0, pairs = 0, noGood = 0;
  const widths = [];
  for (let seed = 1; seed <= 40; seed++) {
    const rnd = S.mulberry32(9000 + seed);
    const s = S.createState(seed % 2 ? 'mob' : 'boss');
    const warm = 1 + Math.floor(rnd() * 5);
    for (let k = 0; k < warm && s.phase === 'aim'; k++) {
      const d = S.DIRS[Math.floor(rnd() * S.DIRS.length)];
      S.shoot(s, d[0], d[1], 75); S.resolve(s);
    }
    if (s.phase !== 'aim') continue;
    const sc = S.DIRS.map((d) => S.scoreShot(s, d[0], d[1], 75));
    const best = Math.max(...sc);
    if (best <= 0) { noGood++; continue; }
    states++;
    const bi = sc.indexOf(best), thr = best * 0.7, L = sc.length;
    let w = 1;
    for (let k = 1; k < L && sc[(bi + k) % L] >= thr; k++) w++;
    for (let k = 1; k < L && sc[(bi - k + L) % L] >= thr; k++) w++;
    widthSum += w; widths.push(w * degPerStep);
    if (w <= 1) narrow++;
    for (let i = 0; i < L; i++) { pairs++; if (Math.abs(sc[i] - sc[(i + 1) % L]) > best * 0.5) flipSum++; }
  }
  widths.sort((a, b) => a - b);
  out.aimSensitivity = {
    positions: states, positionsWithNoGoodShot: noGood, degreesPerCandidate: +degPerStep.toFixed(2),
    bestShotWindowDegAvg: +(widthSum / states * degPerStep).toFixed(1),
    bestShotWindowDegMedian: +widths[widths.length >> 1].toFixed(1),
    positionsWhereBestIsSingleCandidate: +(narrow / states).toFixed(2),
    adjacentPairsWithBigSwing: +(flipSum / pairs).toFixed(2),
  };
}

writeFileSync(new URL('./results-node.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
