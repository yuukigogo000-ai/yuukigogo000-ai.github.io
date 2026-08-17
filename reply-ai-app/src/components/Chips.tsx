export type ChipOption = { id: string; value: string; label: string };

export function Chips({
  name,
  options,
  value,
  onChange,
  ariaLabel,
}: {
  name: string;
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <span className="chip" key={o.id}>
          <input
            type="radio"
            id={o.id}
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <label htmlFor={o.id}>{o.label}</label>
        </span>
      ))}
    </div>
  );
}
