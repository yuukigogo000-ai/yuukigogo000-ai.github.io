// src の data.js / battle.js / tales.js / run.js / ui.js を 1 つのスクリプトにまとめ、page.html に埋め込む(node build.mjs)
//  - index.html    : そのままブラウザで開ける完全な HTML(オフライン対応つき)
//  - artifact.html : Artifact 公開用(doctype・html・head・body タグなし)
import { readFileSync, writeFileSync } from 'node:fs';
const rd = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
for (const f of ['data', 'battle', 'tales', 'run']) if (/^import .*\bas\b/m.test(rd('./src/' + f + '.js'))) throw new Error(f + '.js: import に別名(as)は使えません(まとめたあとに名前が消える)');
const strip = (js) => js.replace(/^import .*$/gm, '').replace(/^export \{[^}]*\};?$/gm, '').replace(/^export (const|function|let)/gm, '$1');
const bundle = '(function () {\n"use strict";\n' + ['data', 'battle', 'tales', 'run'].map((f) => strip(rd('./src/' + f + '.js'))).join('\n') + '\n' + rd('./src/ui.js') + '\n})();';
if (/^\s*(import|export)\s/m.test(bundle)) throw new Error('import / export が残っています');
const body = rd('./src/page.html').replace('/*__BUNDLE__*/', () => bundle.replace(/<\/script/gi, '<\\/script'));
writeFileSync(new URL('./artifact.html', import.meta.url), body);
const cut = body.indexOf('</style>') + 8;
writeFileSync(new URL('./index.html', import.meta.url),
  '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' + // Artifact の骨組みと同じ下地
  '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon.svg" type="image/svg+xml">\n<meta name="theme-color" content="#0d0e14">\n' +
  body.slice(0, cut) + '\n</head>\n<body>' + body.slice(cut) +
  // オフラインでも開けるようにする(サイトとして配信されているときだけ)
  "<script>if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { navigator.serviceWorker.register('sw.js').catch(function () {}); }</script>\n" +
  '</body>\n</html>\n');
console.log('built', body.length, 'bytes');
