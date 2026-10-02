import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const mobile = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(mobile, '..');
const out = path.join(mobile, 'www');
const runtimeRoots = ['art'];
const runtimeFiles = ['icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'launch-v2.css', 'launch-info.css', 'launch-info.js'];
const copied = [];

async function copyTree(relative) {
  for (const entry of await readdir(path.join(source, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink refused: ${name}`);
    if (entry.isDirectory()) await copyTree(name);
    else if (entry.isFile()) {
      await mkdir(path.dirname(path.join(out, name)), { recursive: true });
      await cp(path.join(source, name), path.join(out, name));
      copied.push(name);
    }
  }
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of runtimeRoots) await copyTree(name);
for (const name of runtimeFiles) {
  await cp(path.join(source, name), path.join(out, name));
  copied.push(name);
}

let html = await readFile(path.join(source, 'index.html'), 'utf8');
html = html.replaceAll('\r\n', '\n');
const serviceWorkerBlock = `/* ---- PWA: Service Worker登録 (http(s)配信時のみ。file://やElectronでは何もしない) ---- */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

`;
if (html.split(serviceWorkerBlock).length !== 2) throw new Error('Unexpected service-worker block');
html = html.replace(serviceWorkerBlock, '');
const bodyEnd = '</body>';
if (html.split(bodyEnd).length !== 2) throw new Error('Unexpected body end');
html = html.replace(bodyEnd, '<script type="module" src="./native-entry.js"></script>\n</body>');
await writeFile(path.join(out, 'index.html'), html);
await build({
  entryPoints: [path.join(mobile, 'src/native-entry.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: path.join(out, 'native-entry.js'),
  minify: false,
  sourcemap: false,
});
copied.push('index.html', 'native-entry.js');

const files = {};
for (const name of copied.sort()) {
  const data = await readFile(path.join(out, name));
  files[name.replaceAll('\\', '/')] = {
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}
await writeFile(path.join(out, 'build-manifest.json'), JSON.stringify({ schema: 1, files }, null, 2) + '\n');
console.log(`Built ${copied.length} runtime files; all art included and service worker excluded.`);
