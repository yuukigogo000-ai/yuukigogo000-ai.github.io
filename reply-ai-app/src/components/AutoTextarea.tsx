import { useLayoutEffect, useRef } from 'react';

/** 入力量に応じて高さが伸びるテキストエリア(スマホで中身が見えないのを防ぐ) */
export function AutoTextarea({
  id,
  value,
  onChange,
  placeholder,
  minHeight = 104,
  maxHeight = 340,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`;
  }, [value, minHeight, maxHeight]);

  return (
    <textarea
      ref={ref}
      id={id}
      className="field resize-none"
      style={{ minHeight }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
