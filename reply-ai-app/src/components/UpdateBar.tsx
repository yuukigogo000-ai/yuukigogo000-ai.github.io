import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';

/**
 * 新しい版が出たときに「更新」を出す。
 * 自動リロードにすると、入力途中の会話やスクショを本人の操作なしに失わせるため、
 * 反映のタイミングは必ずユーザーに握らせる。
 */
export function UpdateBar() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdate(() => () => updateSW(true));
        setNeedRefresh(true);
      },
    });
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      id="updateBar"
      role="status"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[560px] items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <span className="text-[13px]">新しい版が公開されています</span>
      <button
        type="button"
        className="btn-ghost flex items-center gap-1.5"
        onClick={() => {
          void update?.();
        }}
      >
        <RefreshCw size={14} strokeWidth={2} />
        更新する
      </button>
    </div>
  );
}
