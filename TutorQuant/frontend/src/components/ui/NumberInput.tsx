"use client";

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  disabled?: boolean;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className = "",
  disabled = false,
}: NumberInputProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!isNaN(parsed)) {
              onChange(parsed);
            }
          }}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={`
            w-full rounded border border-[var(--border-color)] bg-[#0e0e14]
            px-2.5 py-1.5 font-mono text-sm text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)]
            focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]
            disabled:cursor-not-allowed disabled:opacity-50
            ${suffix ? "pr-8" : ""}
          `}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--text-muted)]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
