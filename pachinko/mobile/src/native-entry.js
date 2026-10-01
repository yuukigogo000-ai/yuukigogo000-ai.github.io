import { App } from '@capacitor/app';

function isShown(id) {
  return document.getElementById(id)?.classList.contains('show') === true;
}

App.addListener('backButton', async () => {
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
