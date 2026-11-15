// バランス確認(node balance.mjs [回数])。模擬の打ち手で最後まで遊び、勝率・長さ・決着の仕方を出す。
import * as C from './src/core.js';
import { writeFileSync } from 'node:fs';

// 打ち手: best = 進言の一番上に従う / loose = 進言の上位 3 つから適当に選び、2 割は何もせず番を終える / idle = 何もしない
function play(seed, clan, diff, style) {
  const s = C.newGame({ seed, clan, difficulty: diff });
  let x = (seed * 2654435761) >>> 0; const rnd = () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 4294967296; };
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 800) {
    if (s.event) { C.answerEvent(s, rnd() < 0.5 ? 'A' : 'B'); continue; }
    const adv = style === 'idle' || s.ordersLeft <= 0 ? [] : C.advice(s, 3);
    if (!adv.length || (style === 'loose' && rnd() < 0.2)) { C.endTurn(s); continue; }
    C.order(s, adv[style === 'loose' ? Math.floor(rnd() * adv.length) : 0].o);
  }
  return s;
}
const N = +(process.argv[2] || 200), out = {};
for (const style of ['best', 'loose', 'idle']) for (const diff of ['easy', 'normal', 'hard']) {
  let wins = 0, turns = 0, byTime = 0, peak = 0, coalition = 0; const byClan = [0, 0, 0, 0], winnerKey = {}, endTurns = [];
  for (let i = 1; i <= N; i++) {
    const clan = i % 4, s = play(i, clan, diff, style);
    if (s.winner === s.player) { wins++; byClan[clan]++; }
    winnerKey[C.CLANS[s.winner].key] = (winnerKey[C.CLANS[s.winner].key] || 0) + 1;
    turns += s.turn; endTurns.push(s.turn); peak += s.stats.peak;
    if (s.endReason.includes('6 つの月')) byTime++;
    if (s.log.some((l) => l.text.includes('百鬼夜行を組んだ'))) coalition++;
  }
  endTurns.sort((a, b) => a - b);
  const r = { n: N, win: +(wins / N).toFixed(2), winByClan: byClan.map((w) => +(w / (N / 4)).toFixed(2)), avgEndTurn: +(turns / N).toFixed(1), endTurnRange: [endTurns[0], endTurns[N - 1]],
              byTimeLimit: +(byTime / N).toFixed(2), avgPeakProvs: +(peak / N).toFixed(1), coalitionFormed: +(coalition / N).toFixed(2), winners: winnerKey };
  out[style + '/' + diff] = r;
  console.log((style + '/' + diff).padEnd(14), JSON.stringify(r));
}
writeFileSync(new URL('./results-balance.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
