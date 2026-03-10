"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: "#0e0e14",
  plot_bgcolor: "#141420",
  font: { color: "#e0e0e0", family: "monospace", size: 11 },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  yaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  showlegend: true,
  legend: { font: { size: 10 }, bgcolor: "rgba(0,0,0,0)" },
};

interface CompSeries {
  label: string;
  yields: number[];
  prices: number[];
  duration: number;
  convexity: number;
}

interface CompResult {
  series: CompSeries[];
}

// Bond specification for the comparison table
interface BondSpec {
  label: string;
  couponRate: number; // in %
  maturityYears: number;
}

export function DurationConvexityTab() {
  const [bonds, setBonds] = useState<BondSpec[]>([
    { label: "5y 3%", couponRate: 3.0, maturityYears: 5 },
    { label: "10y 5%", couponRate: 5.0, maturityYears: 10 },
    { label: "30y 4%", couponRate: 4.0, maturityYears: 30 },
  ]);
  const [yieldMin, setYieldMin] = useState(0.0);
  const [yieldMax, setYieldMax] = useState(12.0);

  const [result, setResult] = useState<CompResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateBond(index: number, field: keyof BondSpec, value: string | number) {
    setBonds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addBond() {
    if (bonds.length >= 5) return;
    setBonds((prev) => [
      ...prev,
      { label: `Bond ${prev.length + 1}`, couponRate: 5.0, maturityYears: 10 },
    ]);
  }

  function removeBond(index: number) {
    if (bonds.length <= 1) return;
    setBonds((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCompare() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.bondComparison({
        bonds: bonds.map((b) => ({
          label: b.label,
          faceValue: 100,
          couponRate: b.couponRate / 100,
          couponFrequency: 2,
          maturityYears: b.maturityYears,
        })),
        yieldMin: yieldMin / 100,
        yieldMax: yieldMax / 100,
        nPoints: 80,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Comparison failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const COLORS = ["#ff9800", "#2196f3", "#4caf50", "#e91e63", "#9c27b0"];

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Bond Specs ─────────────────────────────────── */}
      <div className="w-[300px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Bond Comparison
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {bonds.map((bond, idx) => (
            <div key={idx} className="rounded border border-[var(--border-color)] bg-[#0a0a0f] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <input
                    type="text"
                    value={bond.label}
                    onChange={(e) => updateBond(idx, "label", e.target.value)}
                    className="bg-transparent text-xs font-semibold text-[var(--text-primary)] border-none outline-none w-20"
                  />
                </div>
                {bonds.length > 1 && (
                  <button
                    onClick={() => removeBond(idx)}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <NumberInput label="Cpn (%)" value={bond.couponRate} onChange={(v) => updateBond(idx, "couponRate", v)} min={0} step={0.5} />
                <NumberInput label="Mat (yr)" value={bond.maturityYears} onChange={(v) => updateBond(idx, "maturityYears", v)} min={0.5} step={1} />
              </div>
            </div>
          ))}

          {bonds.length < 5 && (
            <button
              onClick={addBond}
              className="rounded border border-dashed border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              + Add Bond
            </button>
          )}

          <div className="flex gap-2 mt-2">
            <NumberInput label="Yield Min (%)" value={yieldMin} onChange={setYieldMin} min={0} step={0.5} />
            <NumberInput label="Yield Max (%)" value={yieldMax} onChange={setYieldMax} min={1} step={1} />
          </div>

          <Button onClick={handleCompare} loading={loading} className="mt-2 w-full">
            Compare Bonds
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Charts + Metrics ─────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Price-Yield Sensitivity Chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={result.series.map((s, i) => ({
                  x: s.yields.map((y) => y * 100),
                  y: s.prices,
                  type: "scatter" as const,
                  mode: "lines" as const,
                  line: { color: COLORS[i % COLORS.length], width: 2 },
                  name: s.label,
                }))}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Price-Yield Sensitivity", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Yield (%)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Price ($)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "350px" }}
              />
            </div>

            {/* Duration & Convexity comparison bar charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[
                    {
                      x: result.series.map((s) => s.label),
                      y: result.series.map((s) => s.duration),
                      type: "bar" as const,
                      marker: {
                        color: result.series.map((_, i) => COLORS[i % COLORS.length]),
                      },
                    },
                  ]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Modified Duration (years)", font: { size: 12, color: "#e0e0e0" } },
                    showlegend: false,
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Duration", font: { size: 10 } } },
                    bargap: 0.4,
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "250px" }}
                />
              </div>
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[
                    {
                      x: result.series.map((s) => s.label),
                      y: result.series.map((s) => s.convexity),
                      type: "bar" as const,
                      marker: {
                        color: result.series.map((_, i) => COLORS[i % COLORS.length]),
                      },
                    },
                  ]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Convexity (years\u00B2)", font: { size: 12, color: "#e0e0e0" } },
                    showlegend: false,
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Convexity", font: { size: 10 } } },
                    bargap: 0.4,
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "250px" }}
                />
              </div>
            </div>

            {/* Metrics table */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
              <div className="border-b border-[var(--border-color)] px-4 py-2">
                <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Risk Metrics at Mid-Yield</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                      <th className="px-4 py-2 text-left">Bond</th>
                      <th className="px-4 py-2 text-right">Mod Duration</th>
                      <th className="px-4 py-2 text-right">Convexity</th>
                      <th className="px-4 py-2 text-right">Price at Mid-Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.series.map((s, i) => {
                      const midIdx = Math.floor(s.yields.length / 2);
                      return (
                        <tr key={i} className="border-b border-[var(--border-color)]/50 text-[var(--text-secondary)]">
                          <td className="px-4 py-1.5">
                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            {s.label}
                          </td>
                          <td className="px-4 py-1.5 text-right text-[var(--accent-primary)]">{s.duration.toFixed(4)}</td>
                          <td className="px-4 py-1.5 text-right">{s.convexity.toFixed(4)}</td>
                          <td className="px-4 py-1.5 text-right">{s.prices[midIdx]?.toFixed(4) ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Define bonds and click &quot;Compare Bonds&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Visualises price-yield sensitivity, duration, and convexity for multiple bonds
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
