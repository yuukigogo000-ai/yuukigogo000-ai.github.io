import assert from 'node:assert/strict';
import test from 'node:test';
import { canOpenDay, validProduct, createBillingController, PRODUCT_ID } from '../src/billing-core.js';
const state = (owned = false, extra = {}) => ({ productId: PRODUCT_ID, owned, ...extra });
const product = { productId: PRODUCT_ID, price: '￥300', amount: 300, currency: 'JPY' };
function fixture(overrides = {}) {
  const calls = [];
  const store = Object.fromEntries(Object.entries({
    getState: () => state(), refresh: () => state(), getProduct: () => product,
    purchase: () => state(true, { status: 'purchased' }), restore: () => state(true), ...overrides,
  }).map(([name, fn]) => [name, async (...args) => { calls.push(name); return fn(...args); }]));
  return { store, calls, controller: createBillingController(store, () => {}, 40) };
}
test('free boundary: 1, 29, 30 allowed; 31, 40 blocked, even after replay', () => {
  for (const n of [1, 29, 30]) assert.equal(canOpenDay(n, false), true);
  for (const n of [31, 40, 151]) assert.equal(canOpenDay(n, false), false);
  assert.equal(canOpenDay(1, false), true);
});
test('owned unlocks all valid days; malformed values cannot unlock', () => {
  for (const n of [1, 30, 31, 200]) assert.equal(canOpenDay(n, true), true);
  for (const n of [NaN, undefined, null, '1', -1, 0, 1.5]) assert.equal(canOpenDay(n, false), false);
  assert.equal(canOpenDay(31, 'true'), false);
});
test('only the configured product and the current JPY 300 price are accepted', () => {
  assert.ok(validProduct(product));
  for (const p of [null, { ...product, productId: 'other' }, { ...product, price: '' }, { ...product, amount: 200 }, { ...product, amount: 0 }, { ...product, currency: '' }, { ...product, currency: undefined }]) assert.ok(!validProduct(p));
  assert.ok(validProduct({ ...product, amount: 1.99, price: '$1.99', currency: 'USD' }));
});
test('initial offline state fails closed only after free day 30', async () => {
  const { controller } = fixture({ getState: () => { throw Error(); }, refresh: () => { throw Error(); }, getProduct: () => { throw Error(); } });
  await controller.initialize(); assert.ok(controller.canOpen(30)); assert.ok(!controller.canOpen(31));
});
test('previous native-confirmed purchase survives a network failure and a new controller', async () => {
  for (let i = 0; i < 2; i++) {
    const { controller } = fixture({ getState: () => state(true), refresh: () => { throw Error(); }, getProduct: () => { throw Error(); } });
    await controller.initialize(); assert.ok(controller.canOpen(31));
  }
});
test('successful store revocation clears a previously cached entitlement', async () => {
  const { controller } = fixture({ getState: () => state(true), refresh: () => state(false) });
  await controller.initialize(); assert.ok(!controller.canOpen(31));
});
test('successful purchase unlocks day 31 and replay without storing in the game save', async () => {
  const { controller, calls } = fixture(); await controller.initialize(); await controller.purchase();
  assert.ok(controller.canOpen(31)); assert.ok(controller.canOpen(1));
  assert.equal(calls.filter(v => v === 'purchase').length, 1);
  await controller.purchase(); assert.equal(calls.filter(v => v === 'purchase').length, 1);
});
test('cancelled purchase keeps the gate and reports cancellation', async () => {
  const { controller } = fixture({ purchase: () => state(false, { status: 'cancelled' }) });
  await controller.initialize(); await controller.purchase(); assert.ok(!controller.canOpen(31)); assert.match(controller.snapshot().message, /キャンセル/);
});
test('pending purchase stays locked until a native entitlement notification', async () => {
  const { controller } = fixture({ purchase: () => state(false, { pending: true }) });
  await controller.initialize(); await controller.purchase(); assert.ok(!controller.canOpen(31));
  controller.onNativeState(state(true)); assert.ok(controller.canOpen(31));
});
test('purchase exception never grants access and can be recovered by restore', async () => {
  const { controller } = fixture({ purchase: () => { throw Error(); } });
  await controller.initialize(); await controller.purchase(); assert.ok(!controller.canOpen(31));
  await controller.restore(); assert.ok(controller.canOpen(31));
});
test('empty restore keeps the gate and does not claim success', async () => {
  const { controller } = fixture({ restore: () => state(false) });
  await controller.initialize(); await controller.restore(); assert.ok(!controller.canOpen(31)); assert.match(controller.snapshot().message, /見つかりません/);
});
test('restore works even when product metadata is unavailable', async () => {
  const { controller } = fixture({ getProduct: () => { throw Error(); } });
  await controller.initialize(); await controller.restore(); assert.ok(controller.canOpen(31));
});
test('unavailable/mispriced product never opens the native purchase flow', async () => {
  const { controller, calls } = fixture({ getProduct: () => ({ ...product, amount: 200 }) });
  await controller.initialize(); await controller.purchase(); assert.ok(!calls.includes('purchase')); assert.ok(!controller.canOpen(31));
});
test('purchase double-tap and simultaneous restore result in one store operation', async () => {
  let complete;
  const { controller, calls } = fixture({ purchase: () => new Promise(resolve => { complete = resolve; }) });
  await controller.initialize(); const first = controller.purchase();
  while (!complete) await new Promise(resolve => setImmediate(resolve));
  await Promise.all([controller.purchase(), controller.restore(), controller.refresh()]);
  assert.equal(calls.filter(v => v === 'purchase').length, 1); assert.ok(!calls.includes('restore'));
  complete(state(true)); await first; assert.ok(!controller.snapshot().working); assert.ok(controller.canOpen(31));
});
test('wrong product and malformed bridge responses cannot grant access', async () => {
  const { controller } = fixture({ purchase: () => ({ productId: 'other', owned: true }) });
  await controller.initialize(); await controller.purchase(); assert.ok(!controller.canOpen(31));
  controller.onNativeState({ productId: PRODUCT_ID, owned: 'true' }); assert.ok(!controller.canOpen(31));
});
test('stalled initial store checks time out without blocking free play', async () => {
  const { controller } = fixture({ refresh: () => new Promise(() => {}) });
  await controller.initialize(); assert.ok(controller.canOpen(30)); assert.ok(!controller.canOpen(31)); assert.ok(!controller.snapshot().working);
});
