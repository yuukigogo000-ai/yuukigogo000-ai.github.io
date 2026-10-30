import test from 'node:test';
import assert from 'node:assert/strict';

// Existing store.js installs persistence listeners at import time. Tests use no browser or saved data.
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {} };
globalThis.localStorage = { getItem() { return null; } };
const { diagnose, timingSummary, switchPlan } = await import('../band/diagnose.js');
const entry = (sec = 180, tuning = 'E', extra = {}, mc = false) => ({
  item: { mc }, song: { id: 'song', title: 'Test', sec, tuning, bpm: 120, key: '', energy: 3, ...extra },
});
const sl = (extra = {}) => ({ targetMin: 30, gapSec: 15, mcSec: 60, template: '', ...extra });
const has = (results, id) => results.some((r) => r.id === id);

test('one song still reports overrun', () => {
  assert.ok(has(diagnose(sl({ targetMin: 3 }), [entry(240)]), 'overtime'));
});
test('exact slot limit is a zero-reserve warning, not overrun', () => {
  const r = diagnose(sl({ targetMin: 3 }), [entry(180)]);
  assert.ok(has(r, 'tight-margin')); assert.ok(!has(r, 'overtime'));
});
test('missing duration never produces a confirmed remaining time', () => {
  const entries = [entry(0), entry(180)];
  assert.equal(timingSummary(sl(), entries).margin, null);
  assert.ok(has(diagnose(sl(), entries), 'missing-duration'));
});
test('known subtotal overrun is still reported with missing durations', () => {
  const r = diagnose(sl({ targetMin: 2 }), [entry(180), entry(0)]);
  assert.match(r.find((x) => x.id === 'overtime').title, /少なくとも/);
});
test('timing comes from entries, not global setlist contents', () => {
  const d = timingSummary(sl(), [entry(120, 'E', {}, true), entry(180)]);
  assert.deepEqual([d.play, d.gaps, d.mc, d.total], [300, 15, 60, 375]);
});
test('no final transition; explicit final MC remains included', () => {
  assert.equal(timingSummary(sl(), [entry(120, 'E', {}, true)]).total, 180);
});
test('missing or invalid target remains undecided', () => {
  assert.ok(has(diagnose(sl({ targetMin: 0 }), [entry()]), 'missing-target'));
  assert.equal(timingSummary(sl({ targetMin: NaN }), [entry()]).margin, null);
});
test('MC does not certify a successful instrument change', () => {
  const r = diagnose(sl({ mcSec: 0, gapSec: 0 }), [entry(180, 'E', {}, true), entry(180, 'D')]);
  const tuning = r.find((x) => x.id === 'tuning-1');
  assert.equal(tuning.level, 'warn'); assert.match(tuning.suggestion, /判定しません/);
});
test('unknown tuning breaks transition inference', () => {
  const p = switchPlan([entry(180, 'E'), entry(180, ''), entry(180, 'D')]);
  assert.deepEqual(p.unknownPositions, [2]); assert.equal(p.switches.length, 0);
  assert.equal(p.needed.length, 2);
});
test('known adjacent changes are preserved and whitespace trimmed', () => {
  const p = switchPlan([entry(180, 'E '), entry(180, 'E'), entry(180, 'D')]);
  assert.equal(p.switches.length, 1); assert.equal(p.needed.length, 2);
});
test('BPM comparison uses full range, not adjacent differences', () => {
  const r = diagnose(sl(), [120, 127, 134].map((bpm) => entry(180, 'E', { bpm })));
  assert.ok(!has(r, 'similar-bpm'));
});
test('unknown BPM does not trigger similarity hint', () => {
  assert.ok(!has(diagnose(sl(), [120, null, 120].map((bpm) => entry(180, 'E', { bpm }))), 'similar-bpm'));
});
test('early peak respects selected intent', () => {
  const es = [5, 2, 3, 4, 2, 3].map((energy) => entry(180, 'E', { energy }));
  assert.ok(!has(diagnose(sl({ template: 'opener' }), es), 'early-peak'));
  assert.ok(has(diagnose(sl({ template: 'buildup' }), es), 'early-peak'));
});
test('transition fraction uses full total as denominator', () => {
  const es = [entry(150), entry(150)];
  assert.ok(!has(diagnose(sl({ gapSec: 80 }), es), 'transition-share'));
  assert.ok(has(diagnose(sl({ gapSec: 110 }), es), 'transition-share'));
});
test('diagnosis does not mutate user inputs', () => {
  const config = sl(), es = [entry(), entry(0, '')];
  const before = JSON.stringify({ config, es });
  diagnose(config, es); switchPlan(es);
  assert.equal(JSON.stringify({ config, es }), before);
});
test('invalid duration is missing, never negative time', () => {
  const d = timingSummary(sl(), [entry(-10), entry(NaN)]);
  assert.equal(d.play, 0); assert.equal(d.missing.length, 2);
});
test('empty set is not certified', () => assert.deepEqual(diagnose(sl(), []), []));
