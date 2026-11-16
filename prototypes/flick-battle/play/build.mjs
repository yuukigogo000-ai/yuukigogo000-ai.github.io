// engine.js / data.js / ai.js / ui.js を 1 つのスクリプトにまとめ、page.html に埋め込む(node build.mjs)
//  - index.html          : そのままブラウザで開ける完全な HTML
//  - ../artifact.html    : Artifact 公開用(doctype・html・head・body タグなし)
import { readFileSync, writeFileSync } from 'node:fs';
const rd = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
// ES モジュールの import / export を外して 1 つのスコープに並べる(名前の重複がない前提)
const strip = (js) => js.replace(/^import .*$/gm, '').replace(/^export \{[^}]*\};?$/gm, '').replace(/^export (const|function|let)/gm, '$1');
// 演出の土台(fx/)は、モジュールごとに囲んで公開名だけを外に出す(中の小道具の名前がぶつからないように)
const wrap = (js) => {
  const names = [...js.matchAll(/^export (?:const|function|let) (\w+)/gm)].map((m) => m[1]);
  return 'const { ' + names.join(', ') + ' } = (function () {\n' + strip(js) + '\nreturn { ' + names.join(', ') + ' };\n})();';
};
const FLAT = ['../engine/engine.js', '../engine/data.js', '../engine/ai.js'];
const FXMODS = ['../fx/tokens.js', '../fx/script.js', '../fx/director.js', '../fx/audio.js', '../fx/render.js', '../fx/scenes.js', '../fx/scenes-inputs.js'];
// 名前の重複を先に調べる(1 つのスコープに並べるため)
const seen = new Map();
for (const f of FLAT) for (const m of rd(f).matchAll(/^(?:export )?(?:const|let|function) (\w+)/gm)) { if (seen.has(m[1])) throw new Error('名前が重複: ' + m[1] + ' (' + seen.get(m[1]) + ' と ' + f + ')'); seen.set(m[1], f); }
for (const f of FXMODS) for (const m of rd(f).matchAll(/^export (?:const|function|let) (\w+)/gm)) { if (seen.has(m[1])) throw new Error('名前が重複: ' + m[1] + ' (' + seen.get(m[1]) + ' と ' + f + ')'); seen.set(m[1], f); }
const bundle = '(function () {\n"use strict";\n' + FLAT.map((f) => strip(rd(f))).join('\n') + '\n' + FXMODS.map((f) => wrap(rd(f))).join('\n') + '\n' + rd('./ui.js') + '\n})();';
if (/^\s*(import|export)\s/m.test(bundle)) throw new Error('import / export が残っています');
const body = rd('./page.html').replace('/*__BUNDLE__*/', () => bundle.replace(/<\/script/gi, '<\\/script'));
writeFileSync(new URL('../artifact.html', import.meta.url), body);
const cut = body.indexOf('</style>') + 8;
writeFileSync(new URL('./index.html', import.meta.url),
  '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' + // Artifact の骨組みと同じ下地
  body.slice(0, cut) + '\n</head>\n<body>' + body.slice(cut) + '</body>\n</html>\n');
console.log('built', body.length, 'bytes');
