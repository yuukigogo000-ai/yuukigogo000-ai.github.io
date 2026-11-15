// engine.js / data.js / ai.js / ui.js を 1 つのスクリプトにまとめ、page.html に埋め込む(node build.mjs)
//  - index.html          : そのままブラウザで開ける完全な HTML
//  - ../artifact.html    : Artifact 公開用(doctype・html・head・body タグなし)
import { readFileSync, writeFileSync } from 'node:fs';
const rd = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
// ES モジュールの import / export を外して 1 つのスコープに並べる(名前の重複がない前提)
const strip = (js) => js.replace(/^import .*$/gm, '').replace(/^export \{[^}]*\};?$/gm, '').replace(/^export (const|function|let)/gm, '$1');
const bundle = '(function () {\n"use strict";\n' + ['../engine/engine.js', '../engine/data.js', '../engine/ai.js'].map((f) => strip(rd(f))).join('\n') + '\n' + rd('./ui.js') + '\n})();';
if (/^\s*(import|export)\s/m.test(bundle)) throw new Error('import / export が残っています');
const body = rd('./page.html').replace('/*__BUNDLE__*/', () => bundle.replace(/<\/script/gi, '<\\/script'));
writeFileSync(new URL('../artifact.html', import.meta.url), body);
const cut = body.indexOf('</style>') + 8;
writeFileSync(new URL('./index.html', import.meta.url),
  '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' + // Artifact の骨組みと同じ下地
  body.slice(0, cut) + '\n</head>\n<body>' + body.slice(cut) + '</body>\n</html>\n');
console.log('built', body.length, 'bytes');
