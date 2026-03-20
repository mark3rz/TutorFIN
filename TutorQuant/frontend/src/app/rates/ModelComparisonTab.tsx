"use client";

import { useState, useEffect } from "react";
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

interface ComparisonEntry {
  model_id: string;
  name: string;
  sde: string;
  mean_reversion: string;
  positivity: string;
  volatility_structure: string;
  analytical_bond_price: boolean;
  practical_intuition: string;
  common_use_cases: string;
  limitations: string;
  distribution: string;
}

interface CurveSeries {
  model: string;
  label: string;
  maturities: number[];
  bond_prices: number[];
  zero_rates: number[];
}

const COLORS = ["#ff9800", "#2196f3", "#4caf50"];

export function ModelComparisonTab() {
  const [comparison, setComparison] = useState<ComparisonEntry[] | null>(null);
  const [curveResult, setCurveResult] = useState<CurveSeries[] | null>(null);
  const [r0, setR0] = useState(4.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch comparison table on mount
  useEffect(() => {
    api.getModelComparison().then(setComparison).catch(() => {});
  }, []);

  async function handleCompareCurves() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.compareCurves({
        r0: r0 / 100,
        models: [
          { model: "vasicek", params: { kappa: 0.5, theta: 0.04, sigma: 0.01 }, label: "Vasicek" },
          { model: "cir", params: { kappa: 0.5, theta: 0.04, sigma: 0.05 }, label: "CIR" },
          { model: "hull_white", params: { a: 0.5, sigma: 0.01, theta_hw: 0.02 }, label: "Hull-White" },
        ],
      });
      setCurveResult(res.series);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Comparison failed");
      setCurveResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full">
      {/* Curve comparison controls */}
      <div className="flex items-end gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
        <NumberInput label="Common Initial Rate (r\u2080)" value={r0} onChange={setR0} step={0.25} suffix="%" />
        <Button onClick={handleCompareCurves} loading={loading} className="shrink-0">
          Compare All Models
        </Button>
        {error && <span className="text-xs text-[var(--accent-red)]">{error}</span>}
      </div>

      {/* Yield curve comparison chart */}
      {curveResult && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={curveResult.map((s, i) => ({
                x: s.maturities,
                y: s.zero_rates.map((z) => z * 100),
                type: "scatter" as const,
                mode: "lines+markers" as const,
                line: { color: COLORS[i], width: 2 },
                marker: { size: 4 },
                name: s.label,
              }))}
              layout={{
                ...DARK_LAYOUT,
                title: { text: "Zero-Rate Curves Comparison", font: { size: 12, color: "#e0e0e0" } },
                xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Zero Rate (%)", font: { size: 10 } } },
              }}
              config={{ responsive: true, displayModeBar: false }}
              useResizeHandler
              style={{ width: "100%", height: "300px" }}
            />
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={curveResult.map((s, i) => ({
                x: s.maturities,
                y: s.bond_prices,
                type: "scatter" as const,
                mode: "lines+markers" as const,
                line: { color: COLORS[i], width: 2 },
                marker: { size: 4 },
                name: s.label,
              }))}
              layout={{
                ...DARK_LAYOUT,
                title: { text: "Bond Price Curves P(0,T)", font: { size: 12, color: "#e0e0e0" } },
                xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Price", font: { size: 10 } } },
              }}
              config={{ responsive: true, displayModeBar: false }}
              useResizeHandler
              style={{ width: "100%", height: "300px" }}
            />
          </div>
        </div>
      )}

      {/* Model comparison table */}
      {comparison && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-4 py-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Model Properties Comparison
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                  <th className="px-4 py-2.5 text-left font-semibold w-[140px]">Property</th>
                  {comparison.map((m, i) => (
                    <th key={m.model_id} className="px-4 py-2.5 text-left font-semibold">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: COLORS[i] }} />
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "SDE", key: "sde" },
                  { label: "Distribution", key: "distribution" },
                  { label: "Mean Reversion", key: "mean_reversion" },
                  { label: "Positivity", key: "positivity" },
                  { label: "Volatility", key: "volatility_structure" },
                  { label: "Analytical Bonds", key: "analytical_bond_price" },
                  { label: "Intuition", key: "practical_intuition" },
                  { label: "Use Cases", key: "common_use_cases" },
                  { label: "Limitations", key: "limitations" },
                ].map(({ label, key }) => (
                  <tr key={key} className="border-b border-[var(--border-color)]/50">
                    <td className="px-4 py-2.5 font-medium text-[var(--text-muted)] uppercase text-[10px] tracking-wider align-top">{label}</td>
                    {comparison.map((m) => {
                      const val = (m as unknown as Record<string, unknown>)[key];
                      return (
                        <td key={m.model_id} className="px-4 py-2.5 text-[var(--text-secondary)] align-top leading-relaxed">
                          {key === "sde" ? (
                            <code className="font-mono text-[10px] text-[var(--accent-primary)]">{String(val)}</code>
                          ) : typeof val === "boolean" ? (
                            <span className={val ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}>
                              {val ? "Yes" : "No"}
                            </span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
