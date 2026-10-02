import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const mobile = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(mobile, '..');

test('app id and Capacitor versions stay fixed', async () => {
  const config = JSON.parse(await readFile(path.join(mobile, 'capacitor.config.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(path.join(mobile, 'package.json'), 'utf8'));
  assert.equal(config.appId, 'com.yuukigogo000.pachiteikoku');
  assert.equal(pkg.dependencies['@capacitor/core'], '8.5.2');
  assert.equal(pkg.dependencies['@capacitor/android'], '8.5.2');
  assert.equal(pkg.devDependencies['@capacitor/cli'], '8.5.2');
});

test('native back path covers dialogs, hall navigation, and minimize', async () => {
  const js = await readFile(path.join(mobile, 'src/native-entry.js'), 'utf8');
  for (const token of ['askBg', 'modalBg', 'panel-hall', 'data-area="hall"', 'minimizeApp']) assert.match(js, new RegExp(token));
});

test('source save contract and removed trial remain unchanged', async () => {
  const html = await readFile(path.join(source, 'index.html'), 'utf8');
  assert.match(html, /pachi-teikoku-save-v1/);
  assert.doesNotMatch(html, /function slotDenom\(|function openTrial\(/);
});


test('packaged page includes every local linked script and stylesheet', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [path.join(mobile, 'scripts/build.mjs')]);
  const out = path.join(mobile, 'www');
  const html = await readFile(path.join(out, 'index.html'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(out, 'build-manifest.json'), 'utf8')).files;
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]);
  for (const ref of refs) {
    if (!ref.startsWith('./')) continue;
    const name = ref.slice(2).split(/[?#]/)[0];
    assert.ok(manifest[name], `Missing native runtime dependency: ${name}`);
    const bundled = await readFile(path.join(out, name));
    if (name !== 'native-entry.js') assert.deepEqual(bundled, await readFile(path.join(source, name)), name);
  }
});
