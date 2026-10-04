const sections = [
  ['対象と運営者', 'このポリシーは、mvammonが提供するiPhone・Android版「パチンコ店経営シミュレーション」（端末表示名：パチンコ店経営）に適用します。更新日：2026年10月4日。'],
  ['端末に保存する情報', 'ゲームの進行と演出設定を端末内に保存し、続きから遊ぶために使用します。アプリの利用にアカウント登録は必要ありません。'],
  ['収集・送信・共有', 'アプリは、ゲームの進行、氏名、連絡先、位置情報、広告識別子を開発者のサーバーへ自動送信しません。広告配信・行動解析用SDKは使用せず、アプリが収集した個人情報の販売も行いません。端末のバックアップやOS・ストアの診断情報は、それぞれの設定と提供元のポリシーに従います。'],
  ['保存期間と削除', '進行と設定は、アプリのデータを消去するまで端末内に残ります。Androidでは端末の設定からアプリのストレージを消去できます。iPhoneでは「Appを削除」で端末内のアプリデータを削除できます。「Appを取り除く」ではデータが残る場合があります。OSのバックアップは別途管理してください。データの消去後は進行を復元できない場合があります。'],
  ['購入とゲーム内の金額', '完全版のアプリ内購入と復元はAppleまたはGoogleが処理します。アプリは購入済みかを確認し、Androidでは確認済みの購入状態を端末内に保存します。開発者にカード番号などの決済情報は送信されません。このアプリには実際の賭け金、換金、現金賞品はなく、ゲーム内の金額は架空のものです。'],
  ['お問い合わせ', 'サポートページにあるGitHubのIssuesからお問い合わせできます。投稿は公開されるため、氏名・住所・決済情報・パスワードなどの個人情報や秘密情報は書かないでください。お問い合わせの投稿はGitHubのポリシーに従って処理され、開発者は問題の確認と回答に使用します。'],
  ['変更', 'データの取扱いを変更する場合は、このポリシーを更新します。']
];
export function installNativePrivacy() {
  const dialog = document.createElement('dialog');
  dialog.id = 'nativePrivacy';
  dialog.setAttribute('aria-labelledby', 'nativePrivacyHeading');
  dialog.style.cssText = 'box-sizing:border-box;width:92vw;max-width:640px;max-height:85dvh;margin:auto;padding:24px;background:#171c25;color:#f3f4f6;border:1px solid #e7c970;border-radius:12px;font:16px/1.8 system-ui,sans-serif;overflow:auto';
  const heading = document.createElement('h2');
  heading.id = 'nativePrivacyHeading'; heading.textContent = 'プライバシーポリシー';
  heading.style.cssText = 'font-size:22px;line-height:1.5;margin:0 0 16px';
  dialog.append(heading);
  // Keep the underlying settings dialog from handling Escape/Tab.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  for (const [title, text] of sections) {
    const h = document.createElement('h3'); h.textContent = title; h.style.cssText = 'font-size:18px;margin:20px 0 8px';
    const p = document.createElement('p'); p.textContent = text; p.style.margin = '0';
    dialog.append(h, p);
  }
  const support = document.createElement('p');
  support.textContent = 'サポート：https://github.com/yuukigogo000-ai/yuukigogo000-ai.github.io/issues';
  support.style.overflowWrap = 'anywhere'; dialog.append(support);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '閉じる';
  close.style.cssText = 'display:block;width:100%;min-height:48px;margin-top:24px;font:700 17px system-ui;background:#f0cf72;color:#151515;border:0;border-radius:8px';
  close.addEventListener('click', () => dialog.close()); dialog.append(close); document.body.append(dialog);
  const addLink = () => {
    const settings = document.querySelector('#launchInfo #piPrefsStatus');
    if (!settings || document.getElementById('nativePrivacyOpen')) return;
    const open = document.createElement('button'); open.id = 'nativePrivacyOpen'; open.type = 'button';
    open.className = 'launch-mini gold pi-wide'; open.textContent = 'プライバシーポリシー';
    open.addEventListener('click', () => { dialog.showModal(); dialog.scrollTop = 0; });
    settings.insertAdjacentElement('afterend', open);
  };
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-launch="settings"]')) queueMicrotask(addLink);
  });
  return () => { if (!dialog.open) return false; dialog.close(); return true; };
}
export { sections as nativePrivacySections };
