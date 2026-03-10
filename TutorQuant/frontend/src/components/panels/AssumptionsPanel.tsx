"use client";

interface Assumption {
  label: string;
  value: string;
}

interface AssumptionsPanelProps {
  assumptions: Assumption[];
}

export function AssumptionsPanel({ assumptions }: AssumptionsPanelProps) {
  if (assumptions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Model Assumptions
        </h3>
      </div>

      {/* Assumption List */}
      <div className="divide-y divide-[var(--border-color)]">
        {assumptions.map((assumption, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between px-4 py-2"
          >
            <span className="text-xs text-[var(--text-secondary)]">
              {assumption.label}
            </span>
            <span className="text-xs font-mono text-[var(--text-primary)]">
              {assumption.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
