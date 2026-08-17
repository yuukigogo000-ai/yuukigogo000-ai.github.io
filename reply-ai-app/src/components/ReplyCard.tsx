import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from '../lib/clipboard';

/** 1案 = LINEに送ったときの見え方(吹き出し1〜3通)+ なぜ効くか + コピー */
export function ReplyCard({
  index,
  bubbles,
  why,
  onCopy,
}: {
  index: number;
  bubbles: string[];
  why: string;
  onCopy: (texts: string[], copied: boolean) => void;
}) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedOne, setCopiedOne] = useState<number | null>(null);
  const split = bubbles.length > 1;

  async function copy(texts: string[], one: number | null) {
    const ok = await copyText(texts.join('\n'));
    onCopy(texts, ok);
    if (!ok) return;
    if (one === null) {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1600);
    } else {
      setCopiedOne(one);
      window.setTimeout(() => setCopiedOne(null), 1600);
    }
  }

  return (
    <article className="card p-3.5">
      <div className="num flex items-center gap-2">
        <span>案 {index + 1}</span>
        {split && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
            {bubbles.length}通に分けて送る
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-col items-end gap-1.5">
        {bubbles.map((b, i) => (
          <div key={i} className="flex w-full items-end justify-end gap-1.5">
            {split && (
              <button
                type="button"
                onClick={() => void copy([b], i)}
                aria-label={`${i + 1}通目をコピー`}
                className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-muted"
              >
                {copiedOne === i ? (
                  <Check size={14} strokeWidth={2.5} className="text-brand" />
                ) : (
                  <Copy size={14} strokeWidth={1.8} />
                )}
              </button>
            )}
            <div className="bubble">{b}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 border-l-2 border-line pl-2.5 text-[12.5px] leading-relaxed text-ink-muted">
        {why}
      </p>

      <button
        type="button"
        onClick={() => void copy(bubbles, null)}
        className="btn-ghost mt-3 flex w-full items-center justify-center gap-1.5"
      >
        {copiedAll ? (
          <>
            <Check size={15} strokeWidth={2.5} className="text-brand" />
            コピーしました
          </>
        ) : (
          <>
            <Copy size={15} strokeWidth={2} />
            {split ? 'まとめてコピー' : 'コピー'}
          </>
        )}
      </button>
    </article>
  );
}
