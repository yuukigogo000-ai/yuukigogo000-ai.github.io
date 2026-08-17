import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { INSTALL_HINT_KEY } from '../lib/storage';

function isStandalone() {
  if (typeof window === 'undefined') return true;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia?.('(display-mode: standalone)').matches || iosStandalone === true;
}

export function InstallHint() {
  const [closed, setClosed] = useState(() => {
    try {
      return isStandalone() || localStorage.getItem(INSTALL_HINT_KEY) === '1';
    } catch {
      return isStandalone();
    }
  });
  if (closed) return null;

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div
      id="installHint"
      className="card mt-3 flex items-start gap-3 bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-muted"
    >
      <Smartphone size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brand" />
      <p className="flex-1">
        ホーム画面に追加すると、アプリとして全画面で開けます。
        {ios ? '下の共有ボタン → 「ホーム画面に追加」' : 'ブラウザのメニュー → 「アプリをインストール」'}
      </p>
      <button
        type="button"
        aria-label="この案内を閉じる"
        className="shrink-0 text-ink-faint"
        onClick={() => {
          try {
            localStorage.setItem(INSTALL_HINT_KEY, '1');
          } catch {
            /* ignore */
          }
          setClosed(true);
        }}
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
