export function Meter({
  barId,
  pctId,
  label,
  value,
  suffix,
}: {
  barId: string;
  pctId: string;
  label: string;
  value: number;
  suffix: string;
}) {
  const pct = Math.max(0, Math.min(100, value | 0));
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-label font-semibold text-ink-muted">{label}</span>
      <div
        className="h-[7px] flex-1 overflow-hidden pill bg-surface-2"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          id={barId}
          className="h-full pill bg-brand transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span id={pctId} className="min-w-[3.4em] text-right text-body font-bold tabular-nums">
        {pct}
        {suffix}
      </span>
    </div>
  );
}
