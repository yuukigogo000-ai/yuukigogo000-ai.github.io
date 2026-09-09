import { X } from 'lucide-react';
import { ONBOARD_KEY } from '../lib/storage';

const STEPS = ['スクショを追加', '狙いを選ぶ', '3案から選んでコピー'];

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
        <h2 className="text-body font-bold">はじめての方へ</h2>
        <button
          type="button"
          aria-label="案内を閉じる"
          className="btn-icon -mt-2 -mr-2 shrink-0"
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
      <ol className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {STEPS.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5 text-sub">
            <span className="grid h-5 w-5 shrink-0 place-items-center pill bg-brand text-label font-bold text-on-brand">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {!hasKey && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-label leading-relaxed text-ink-muted">
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
