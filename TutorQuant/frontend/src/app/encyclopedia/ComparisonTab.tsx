"use client";

import { useState, useEffect } from "react";
import { ModelData } from "./ModelCard";
import { MathBlock } from "@/components/ui/MathBlock";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  option: "#ff9800",
  rate: "#2196f3",
  volatility: "#9c27b0",
  fixed_income: "#4caf50",
  swap: "#00bcd4",
};

export function ComparisonTab() {
  const [models, setModels] = useState<ModelData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getEncyclopediaModels()
      .then((res) => {
        setModels(res.models);
        // Default: select first 3
        const defaultIds = res.models.slice(0, 3).map((m: ModelData) => m.id);
        setSelected(new Set(defaultIds));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleModel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const compared = models.filter((m) => selected.has(m.id));

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-[var(--text-muted)]">Loading models...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Model selector ────────────────────────────── */}
      <div className="w-[220px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Select Models
          </h3>
        </div>
        <div className="p-2 space-y-0.5">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleModel(m.id)}
              className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[11px] transition-colors ${
                selected.has(m.id)
                  ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: selected.has(m.id)
                    ? CATEGORY_COLORS[m.category] ?? "#888"
                    : "transparent",
                  border: selected.has(m.id)
                    ? "none"
                    : "1px solid var(--text-muted)",
                }}
              />
              <span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── CENTER: Comparison table ─────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {compared.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] h-full">
            <p className="text-sm text-[var(--text-muted)]">
              Select models from the left panel to compare
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 text-left font-semibold uppercase tracking-wider text-[var(--text-muted)] w-[140px]">
                    Property
                  </th>
                  {compared.map((m) => (
                    <th
                      key={m.id}
                      className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] min-w-[200px]"
                    >
                      <span style={{ color: CATEGORY_COLORS[m.category] }}>
                        {m.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Process / SDE */}
                <tr className="border-b border-[var(--border-color)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    SDE / Process
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3">
                      <div className="overflow-x-auto rounded border border-[var(--border-color)] bg-[#0a0a0f] px-2 py-1.5">
                        <MathBlock tex={m.process} />
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Calibration */}
                <tr className="border-b border-[var(--border-color)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    Calibration
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3 text-[var(--text-secondary)]">
                      {m.calibration_burden}
                    </td>
                  ))}
                </tr>

                {/* Computational Cost */}
                <tr className="border-b border-[var(--border-color)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    Compute Cost
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3 text-[var(--text-secondary)]">
                      {m.computational_cost}
                    </td>
                  ))}
                </tr>

                {/* Strengths */}
                <tr className="border-b border-[var(--border-color)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-[var(--accent-green)]" />
                      Strengths
                    </div>
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3">
                      <ul className="space-y-0.5">
                        {m.strengths.map((s, i) => (
                          <li key={i} className="text-[var(--accent-green)] flex gap-1">
                            <span className="mt-1 shrink-0 text-[6px]">●</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>

                {/* Weaknesses */}
                <tr className="border-b border-[var(--border-color)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    <div className="flex items-center gap-1">
                      <XCircle size={10} className="text-[var(--accent-red)]" />
                      Weaknesses
                    </div>
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3">
                      <ul className="space-y-0.5">
                        {m.weaknesses.map((w, i) => (
                          <li key={i} className="text-[var(--accent-red)] flex gap-1">
                            <span className="mt-1 shrink-0 text-[6px]">●</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>

                {/* Desk Usage */}
                <tr className="border-b border-[var(--border-color)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    Desk Usage
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3 text-[var(--text-secondary)]">
                      {m.desk_usage}
                    </td>
                  ))}
                </tr>

                {/* Failure Modes */}
                <tr className="border-b border-[var(--border-color)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={10} className="text-[#ff5722]" />
                      Failure Modes
                    </div>
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3">
                      <ul className="space-y-0.5">
                        {m.failure_modes.map((f, i) => (
                          <li key={i} className="text-[var(--accent-red)] flex gap-1">
                            <span className="mt-1 shrink-0 text-[6px]">●</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>

                {/* Fragility Warning */}
                <tr>
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3 font-semibold text-[var(--text-muted)] uppercase">
                    Fragility
                  </td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-3">
                      <div className="rounded border border-[var(--accent-red)]/20 bg-[var(--accent-red)]/5 px-2 py-1.5 text-[var(--accent-red)]">
                        {m.fragility_warning}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
