// 場面ごとに「その場面になる手」を探して scenes-inputs.js に書き出す(node fx/find-scenes.mjs)。
// 向きは 3 度きざみ × 強さ 1〜3 を全部ためし、台本(scriptShot)を見て場面の条件(want)に合う一番よい手を選ぶ。
import { writeFileSync } from 'node:fs';
import { SCENES, sceneState } from './scenes.js';
import { scriptShot } from './script.js';

const out = {}, report = [];
for (const sc of SCENES) {
  if (!sc.want) continue;
  const base = sceneState(sc);
  let best = null;
  for (const power of sc.powers || [1, 2, 3]) for (let a = 0; a < 360; a += 3) {
    const r = a * Math.PI / 180; // 入力を作るためだけに使う(エンジンの中では三角関数を使わない)
    const input = { dx: Math.round(Math.cos(r) * 1000), dy: Math.round(Math.sin(r) * 1000), power, ult: !!sc.ult };
    const s = scriptShot(base, input);
    if (!s) continue;
    const score = sc.want(s);
    if (score > 0 && (!best || score > best.score)) best = { score, input, steps: s.steps, sum: s.summary };
  }
  if (best) { out[sc.id] = best.input; report.push(`${sc.id.padEnd(11)} ○ ${JSON.stringify(best.input)} 最大れんさ ${best.sum.maxChain} / 撃破 ${best.sum.kos.length} / 刻み ${best.steps}`); }
  else report.push(`${sc.id.padEnd(11)} × 見つからない`);
}
writeFileSync(new URL('./scenes-inputs.js', import.meta.url),
  '// find-scenes.mjs が書き出した、場面ごとの手(手で直さない。場面やエンジンを変えたら作り直す)\nexport const SCENE_INPUTS = ' + JSON.stringify(out, null, 1).replace(/\n\s*/g, ' ') + ';\n');
console.log(report.join('\n'));
