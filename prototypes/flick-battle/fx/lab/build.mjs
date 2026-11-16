// 音の聴き比べ台を 1 つの HTML にまとめる(node fx/lab/build.mjs → fx/lab/lab.html。Artifact 公開用)
import { readFileSync, writeFileSync } from 'node:fs';
const rd = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const strip = (js) => js.replace(/^import .*$/gm, '').replace(/^export (const|function|let)/gm, '$1');
const wrap = (js) => { const names = [...js.matchAll(/^export (?:const|function|let) (\w+)/gm)].map((m) => m[1]); return 'const { ' + names.join(', ') + ' } = (function () {\n' + strip(js) + '\nreturn { ' + names.join(', ') + ' };\n})();'; };
const bundle = '(function () {\n"use strict";\n' + wrap(rd('../tokens.js')) + '\n' + wrap(rd('../audio.js')) + '\n' + wrap(rd('./audio-v2.js')) + '\n' + wrap(rd('../voice-clips.js')) + '\n' + rd('./lab.js') + '\n})();';
const html = rd('./page.html').replace('/*__BUNDLE__*/', () => bundle.replace(/<\/script/gi, '<\\/script'));
writeFileSync(new URL('./lab.html', import.meta.url), html);
console.log('built', html.length, 'bytes');
