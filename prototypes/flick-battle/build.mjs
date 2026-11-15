// page.html に sim.js と ui.js を埋め込んで 1 ファイルにする(node build.mjs)
//  - index.html      : そのままブラウザで開ける完全な HTML
//  - artifact-legacy.html : 最初の試作の Artifact 用(いま公開しているのは play/build.mjs が作る artifact.html)(doctype・html・head・body タグなし)
import { readFileSync, writeFileSync } from 'node:fs';
const rd = (f) => readFileSync(new URL('./' + f, import.meta.url), 'utf8');
const esc = (js) => js.replace(/<\/script/gi, '<\\/script');
const body = rd('page.html').replace('/*__SIM__*/', () => esc(rd('sim.js'))).replace('/*__UI__*/', () => esc(rd('ui.js')));
writeFileSync(new URL('./artifact-legacy.html', import.meta.url), body);
const head = body.slice(0, body.indexOf('</style>') + 8), rest = body.slice(body.indexOf('</style>') + 8);
writeFileSync(new URL('./index.html', import.meta.url),
  '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' + // Artifact の骨組みと同じ下地
  head + '\n</head>\n<body>' + rest + '</body>\n</html>\n');
console.log('built', body.length, 'bytes');
