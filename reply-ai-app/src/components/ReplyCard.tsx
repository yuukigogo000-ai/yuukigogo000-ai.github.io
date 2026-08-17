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
    <article
      className="card cursor-pointer p-4"
      onClick={() => void copy(bubbles, null)}
      role="group"
      aria-label={`案 ${index + 1}(タップでコピー)`}
    >
      <div className="num flex items-center gap-2">
        <span>案 {index + 1}</span>
        {split && (
          <span className="pill bg-surface-2 px-2 py-0.5 text-label font-semibold text-ink-muted">
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
                onClick={(e) => {
                  e.stopPropagation();
                  void copy([b], i);
                }}
                aria-label={`${i + 1}通目をコピー`}
                className="btn-icon shrink-0"
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

      <p className="mt-3 border-l-2 border-line pl-2.5 text-label leading-relaxed text-ink-muted">
        {why}
      </p>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void copy(bubbles, null);
        }}
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
