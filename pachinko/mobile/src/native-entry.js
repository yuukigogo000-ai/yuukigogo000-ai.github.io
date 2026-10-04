import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { installBilling } from './billing-ui.js';

const billing = installBilling(registerPlugin('PachiBilling'), window.PachiBillingGame);
App.addListener('appStateChange', ({ isActive }) => { if (isActive) void billing.refresh(); });
import { installNativePrivacy } from './privacy-native.js';

const closeNativePrivacy = installNativePrivacy();

function isShown(id) {
  return document.getElementById(id)?.classList.contains('show') === true;
}

App.addListener('backButton', async () => {
  if (billing.close()) return;
  if (closeNativePrivacy()) return;
  if (isShown('askBg')) {
    document.getElementById('askNo')?.click();
    return;
  }
  if (isShown('modalBg')) {
    window.closeModal?.();
    return;
  }
  if (!document.getElementById('panel-hall')?.classList.contains('on')) {
    document.querySelector('#nav [data-area="hall"]')?.click();
    return;
  }
  await App.minimizeApp();
});
