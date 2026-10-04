export const PRODUCT_ID = 'pachinko_full_version';
export const FREE_DAYS = 30;
export const JAPAN_PRICE = 300;

export function canOpenDay(day, owned) {
  return Number.isInteger(day) && day >= 1 && (owned === true || day <= FREE_DAYS);
}

export function validProduct(product) {
  return product?.productId === PRODUCT_ID && typeof product.price === 'string' && product.price.trim().length > 0 && /^[A-Z]{3}$/.test(product.currency || '') &&
    Number.isFinite(product.amount) && product.amount > 0 &&
    (product.currency !== 'JPY' || product.amount === JAPAN_PRICE);
}

// The native bridge alone owns the durable entitlement. Never trust the game save,
// localStorage, a URL parameter, or a successful launch of the purchase sheet.
export function createBillingController(store, changed = () => {}, timeoutMs = 25000) {
  let owned = false, ready = false, product = null, working = false, message = '';
  let checking = null;
  const snapshot = () => ({ owned, ready, product, working, message });
  const emit = () => changed(snapshot());
  function accept(value) {
    if (value?.productId !== PRODUCT_ID || typeof value.owned !== 'boolean') throw Error('INVALID_STORE_STATE');
    owned = value.owned;
    ready = true;
    return value;
  }
  function timeout(promise) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('TIMEOUT')), timeoutMs);
    })]).finally(() => clearTimeout(timer));
  }
  async function products() {
    product = null;
    const value = await timeout(store.getProduct());
    if (!validProduct(value)) throw Error('PRODUCT_UNAVAILABLE');
    product = value;
  }
  async function refresh() {
    if (working) return snapshot();
    if (checking) return checking;
    checking = (async () => {
      try {
        const result = accept(await timeout(store.refresh()));
        message = result.pending ? 'お支払いの承認待ちです。承認後に完全版を利用できます。' : '';
      } catch {
        message = owned ? '購入確認済みの完全版を利用できます。ストアへの再確認は接続時に行います。' :
          'ストアに接続できません。通信状態を確認して「再確認」を押してください。';
      }
      try { await products(); } catch {
        product = null;
        if (!owned && !message) message = '購入情報を取得できません。「再確認」または「購入を復元」をお試しください。';
      }
      emit();
      return snapshot();
    })().finally(() => { checking = null; });
    return checking;
  }
  async function initialize() {
    try { accept(await timeout(store.getState())); } catch { ready = true; }
    emit();
    await refresh();
  }
  async function action(kind) {
    if (working) return snapshot();
    working = true; message = ''; emit();
    try {
      if (checking) await checking;
      if (kind === 'purchase') {
        if (owned) return snapshot();
        // Re-fetch the price immediately before opening the store sheet.
        await products();
      }
      // Purchasing itself has no artificial timeout: the customer may need time
      // for authentication. A interrupted purchase is recovered via refresh.
      const result = accept(await (kind === 'purchase' ? store.purchase() : timeout(store.restore())));
      if (result.status === 'cancelled') message = '購入をキャンセルしました。進行データは変更していません。';
      else if (result.pending) message = 'お支払いの承認待ちです。承認後に完全版を利用できます。';
      else if (owned) message = kind === 'restore' ? '完全版の購入を復元しました。' : '完全版を解放しました。';
      else message = 'このストアのアカウントには完全版の購入が見つかりませんでした。';
    } catch {
      message = '購入状態を確認できませんでした。進行データは保持しています。決済した場合は「購入を復元」をお試しください。';
    } finally { working = false; emit(); }
    return snapshot();
  }
  return Object.freeze({
    snapshot, initialize, refresh,
    purchase: () => action('purchase'), restore: () => action('restore'),
    canOpen: day => canOpenDay(day, owned),
    // This receives only the native plugin's entitlementChanged event.
    onNativeState(value) { try { accept(value); emit(); } catch { /* ignore malformed event */ } },
  });
}
