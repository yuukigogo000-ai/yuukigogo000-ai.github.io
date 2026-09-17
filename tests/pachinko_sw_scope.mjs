// Run: node tests/pachinko_sw_scope.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../pachinko/sw.js', import.meta.url), 'utf8');
const current = source.match(/const CACHE = "([^"]+)"/)[1];
const handlers = new Map();
const other = ['band-cache-v3', 'honmono-v2', 'health-offline-v1'];
const deleted = [];
let claimed = 0;
vm.runInNewContext(source, {
  self: {
    addEventListener: (type, fn) => handlers.set(type, fn),
    clients: { claim: async () => { claimed++; } },
  },
  caches: {
    keys: async () => ['pachi-teikoku-v1', 'pachi-teikoku-v8', current, ...other],
    delete: async key => { deleted.push(key); return true; },
  },
});
let work;
handlers.get('activate')({ waitUntil: promise => { work = promise; } });
await work;
assert.deepEqual(deleted.sort(), ['pachi-teikoku-v1', 'pachi-teikoku-v8']);
assert.equal(claimed, 1);
assert(!deleted.includes(current));
assert(other.every(key => !deleted.includes(key)));
console.log('PASS: old game caches removed; current and other-app caches retained');
