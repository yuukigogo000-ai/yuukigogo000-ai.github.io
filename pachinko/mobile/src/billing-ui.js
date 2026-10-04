import { createBillingController, FREE_DAYS, JAPAN_PRICE } from './billing-core.js';

export function installBilling(store, game, doc = document) {
  const style = doc.createElement('style');
  style.textContent = `
    #pachiPurchase{box-sizing:border-box;width:calc(100% - 32px);max-width:460px;max-height:85dvh;margin:auto;padding:24px;background:#171c25;color:#f3f4f6;border:1px solid #e7c970;border-radius:16px;font:16px/1.75 system-ui,sans-serif;overflow:auto}
    #pachiPurchase::backdrop{background:#000b}#pachiPurchase h2{font-size:24px;line-height:1.4;margin:0 0 14px;color:#ffe79a}
    #pachiPurchase p{margin:12px 0}#pachiPurchase button{display:block;width:100%;min-height:48px;margin-top:12px;padding:10px 14px;font:700 16px/1.5 system-ui;color:#fff;background:#303847;border:1px solid #687485;border-radius:10px}
    #pachiPurchase button[data-billing=buy]{background:#f0cf72;color:#151515;border-color:#f0cf72}#pachiPurchase button:disabled{opacity:.55}
    #pachiPurchase .billing-note{font-size:14px;color:#d4dae4}#pachiPurchase [role=status]{min-height:2em;color:#ffe79a}
    .billing-entry{display:block;width:100%;padding:10px 8px;margin:8px 0 0;border:1px solid #cbb776;border-radius:8px;background:#10151feF;color:#fff0b8;font:600 14px/1.5 system-ui;text-align:center}
    #launchTitle .launch-menu{padding-bottom:16px}
  `;
  doc.head.append(style);
  const dialog = doc.createElement('dialog');
  dialog.id = 'pachiPurchase';
  dialog.setAttribute('aria-labelledby', 'pachiPurchaseTitle');
  dialog.innerHTML = `<h2 id="pachiPurchaseTitle">完全版で経営を続ける</h2>
    <p data-billing="description"></p>
    <p class="billing-note">買い切り・自動課金なし。購入後は同じセーブから続行できます。最初から遊び直しても再購入は不要です。</p>
    <p role="status" aria-live="polite" data-billing="status"></p>
    <button type="button" data-billing="buy" disabled>価格を確認中…</button>
    <button type="button" data-billing="restore">購入を復元</button>
    <button type="button" data-billing="refresh">再確認</button>
    <button type="button" data-billing="close">閉じる</button>
    <p class="billing-note">購入・復元には通信が必要です。復元には購入時と同じストア・アカウントを使用してください。</p>`;
  doc.body.append(dialog);
  const el = name => dialog.querySelector(`[data-billing="${name}"]`);
  const entries = [];
  const controller = createBillingController(store, paint);
  function paint() {
    const s = controller.snapshot();
    const price = s.product?.price;
    el('description').textContent = s.owned ? '完全版は購入済みです。営業日数の体験版制限はありません。' :
      game.getDay() > FREE_DAYS ? `${FREE_DAYS}営業日のお試しは終了しました。進行データはそのまま残ります。` :
        `ゲーム内の${FREE_DAYS}営業日まで無料で遊べます。${FREE_DAYS + 1}日目からは完全版が必要です。`;
    el('status').textContent = s.working ? 'ストアの応答を待っています…' : s.message;
    el('buy').textContent = s.owned ? '完全版 購入済み' : price ? `${price}で完全版を購入（買い切り）` : '現在、購入情報を取得できません';
    el('buy').disabled = s.working || s.owned || !price;
    el('restore').disabled = s.working;
    el('refresh').disabled = s.working;
    el('close').textContent = s.owned ? '経営に戻る' : '閉じる';
    for (const entry of entries) entry.textContent = s.owned ? '完全版 購入済み・購入の復元' :
      `${FREE_DAYS}営業日まで無料 ／ 完全版 ${price || JAPAN_PRICE + '円（日本価格）'}・買い切り`;
    game.render();
  }
  function show() {
    if (!game.canShow()) return;
    paint();
    if (!dialog.open) dialog.showModal();
    game.syncLock();
    el('close').focus();
  }
  function close() {
    if (!dialog.open) return false;
    dialog.close(); return true;
  }
  dialog.addEventListener('close', () => game.syncLock());
  // Keep Escape/other keys from reaching the underlying title settings dialog.
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-billing]')?.dataset.billing;
    if (action === 'buy') void controller.purchase();
    else if (action === 'restore') void controller.restore();
    else if (action === 'refresh') void controller.refresh();
    else if (action === 'close') close();
  });
  function addEntry(parent) {
    if (!parent || parent.querySelector('.billing-entry')) return;
    const button = doc.createElement('button'); button.type = 'button'; button.className = 'billing-entry';
    button.addEventListener('click', show); parent.append(button); entries.push(button);
  }
  addEntry(doc.querySelector('#launchTitle .launch-menu'));
  // The title uses launch-actions in earlier builds.
  if (!entries.length) addEntry(doc.getElementById('launchContinue')?.parentElement);
  addEntry(doc.getElementById('btnSave')?.parentElement?.parentElement);
  doc.addEventListener('click', event => {
    if (event.target.closest?.('[data-launch="settings"]')) queueMicrotask(() => {
      addEntry(doc.querySelector('#launchInfo #piPrefsStatus')?.parentElement); paint();
    });
  });
  const api = Object.freeze({ canOpen: controller.canOpen, show, close, refresh: controller.refresh });
  window.PachiBilling = api;
  Promise.resolve(store.addListener('entitlementChanged', controller.onNativeState)).catch(() => {});
  void controller.initialize();
  paint();
  return api;
}
