// 強さの集計。node balance.mjs [回数]
import { writeFileSync } from 'node:fs';
import { newRun } from './src/run.js';
import { playRun } from './src/bot.js';
import { CHARS } from './src/data.js';
const N = +process.argv[2] || 100, out = {};
for (const policy of ['best', 'greedy', 'loose', 'basic', 'idle']) for (const diff of ['easy', 'normal', 'hard']) {
  const byChar = [0, 0, 0], how = { slain: 0, dawn: 0, dead: 0 }, died = {}; let hpLeft = 0, wins = 0, ticks = 0, bossTicks = 0;
  for (let i = 0; i < N; i++) {
    const c = i % 3, r = playRun(newRun({ seed: 1000 + i * 13, char: c, diff }), policy, i + 1);
    how[r.result.how]++; if (r.result.win) { wins++; byChar[c]++; hpLeft += r.hp; bossTicks += r.result.ticks; } else died[r.result.step] = (died[r.result.step] || 0) + 1;
    ticks += r.stats.ticks;
  }
  const row = { n: N, win: +(wins / N).toFixed(2), winByChar: byChar.map((w) => +(w / Math.ceil(N / 3)).toFixed(2)), slain: how.slain, dawn: how.dawn, avgHpLeftOnWin: wins ? +(hpLeft / wins).toFixed(1) : 0, avgBossTicks: wins ? +(bossTicks / wins).toFixed(1) : 0, avgTicksPerRun: +(ticks / N).toFixed(0), diedAtStep: died };
  out[policy + '/' + diff] = row; console.log((policy + '/' + diff).padEnd(14), JSON.stringify(row));
}
writeFileSync(new URL('./results-balance.json', import.meta.url), JSON.stringify(out, null, 1));
