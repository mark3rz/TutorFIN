"use client";

interface ToggleGroupProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function ToggleGroup({
  options,
  value,
  onChange,
  className = "",
  disabled = false,
}: ToggleGroupProps) {
  return (
    <div className={`flex gap-0 ${className}`}>
      {options.map((option, idx) => {
        const isActive = option === value;
        const isFirst = idx === 0;
        const isLast = idx === options.length - 1;

        return (
          <button
            key={option}
            onClick={() => !disabled && onChange(option)}
            disabled={disabled}
            className={`
              px-3 py-1.5 text-xs font-medium transition-colors duration-100
              border border-[var(--border-color)]
              ${isFirst ? "rounded-l" : ""}
              ${isLast ? "rounded-r" : ""}
              ${!isFirst ? "-ml-px" : ""}
              ${
                isActive
                  ? "bg-[var(--accent-primary)] text-[#0a0a0f] border-[var(--accent-primary)] z-10"
                  : "bg-[#0e0e14] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }
              disabled:cursor-not-allowed disabled:opacity-50
            `}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
