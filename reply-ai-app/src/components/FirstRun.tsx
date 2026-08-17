import { X } from 'lucide-react';
import { ONBOARD_KEY } from '../lib/storage';

const STEPS = [
  'トーク画面のスクショを追加(またはテキストを貼り付け)',
  '今回のゴールを選ぶ',
  '3案から選んでコピー。送るのはあなた自身',
];

/** 初回だけ出す案内。何をする画面なのかを最初に伝える。 */
export function FirstRun({
  onClose,
  onOpenSettings,
  hasKey,
}: {
  onClose: () => void;
  onOpenSettings: () => void;
  hasKey: boolean;
}) {
  return (
    <section id="firstRun" className="card mt-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[14px] font-bold">はじめての方へ</h2>
        <button
          type="button"
          aria-label="案内を閉じる"
          className="-mt-1 shrink-0 rounded-md p-1 text-ink-faint hover:bg-surface-2"
          onClick={() => {
            try {
              localStorage.setItem(ONBOARD_KEY, '1');
            } catch {
              /* ignore */
            }
            onClose();
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <ol className="mt-2.5 space-y-1.5">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
            <span className="mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {!hasKey && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            検証版のため、生成にはご自身のAnthropic APIキーが必要です。
          </p>
          <button type="button" className="btn-ghost mt-2" onClick={onOpenSettings}>
            設定でキーを登録する
          </button>
        </div>
      )}
    </section>
  );
}
