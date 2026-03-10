"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
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

interface CurveResult {
  maturities: number[];
  par_rates: number[];
  zero_rates: number[];
  discount_factors: number[];
  forward_labels: string[];
  forward_rates: number[];
  description: string;
}

export function YieldCurvesTab() {
  const [curveStyle, setCurveStyle] = useState("Normal");
  const [result, setResult] = useState<CurveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styleMap: Record<string, string> = {
    "Normal": "normal",
    "Inverted": "inverted",
    "Flat": "flat",
    "Humped": "humped",
  };

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.demoCurve({ style: styleMap[curveStyle] });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate curve");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Controls ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Yield Curve Generator
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Curve Shape
            </span>
            <ToggleGroup
              options={["Normal", "Inverted", "Flat", "Humped"]}
              value={curveStyle}
              onChange={setCurveStyle}
            />
          </div>

          <Button onClick={handleGenerate} loading={loading} className="mt-2 w-full">
            Generate Curve
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] p-3 mt-2">
              <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">Description</p>
              <p className="text-xs text-[var(--text-secondary)]">{result.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Charts ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Par vs Zero Rates */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  {
                    x: result.maturities,
                    y: result.par_rates.map((r) => r * 100),
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    line: { color: "#ff9800", width: 2 },
                    marker: { size: 5 },
                    name: "Par Rates",
                  },
                  {
                    x: result.maturities,
                    y: result.zero_rates.map((r) => r * 100),
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    line: { color: "#2196f3", width: 2 },
                    marker: { size: 5 },
                    name: "Zero Rates",
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Par vs Zero Rate Curves", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Rate (%)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "300px" }}
              />
            </div>

            {/* Discount Factors */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  {
                    x: result.maturities,
                    y: result.discount_factors,
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    line: { color: "#4caf50", width: 2 },
                    marker: { size: 5 },
                    fill: "tozeroy" as const,
                    fillcolor: "rgba(76,175,80,0.1)",
                    name: "D(T)",
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Discount Factor Curve D(T)", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "D(T)", font: { size: 10 } } },
                  showlegend: false,
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "250px" }}
              />
            </div>

            {/* Forward Rates */}
            {result.forward_labels.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[
                    {
                      x: result.forward_labels,
                      y: result.forward_rates.map((r) => r * 100),
                      type: "bar" as const,
                      marker: {
                        color: result.forward_rates.map((r) =>
                          r >= 0 ? "rgba(255,152,0,0.8)" : "rgba(244,67,54,0.8)"
                        ),
                      },
                      name: "Forward Rate",
                    },
                  ]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Forward Rates (Period-by-Period)", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Period", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Forward Rate (%)", font: { size: 10 } } },
                    showlegend: false,
                    bargap: 0.3,
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "250px" }}
                />
              </div>
            )}

            {/* Data table */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
              <div className="border-b border-[var(--border-color)] px-4 py-2">
                <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Curve Data</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                      <th className="px-4 py-2 text-left">T (yrs)</th>
                      <th className="px-4 py-2 text-right">Par Rate</th>
                      <th className="px-4 py-2 text-right">Zero Rate</th>
                      <th className="px-4 py-2 text-right">D(T)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.maturities.map((t, i) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50 text-[var(--text-secondary)]">
                        <td className="px-4 py-1.5">{t.toFixed(1)}</td>
                        <td className="px-4 py-1.5 text-right">{(result.par_rates[i] * 100).toFixed(4)}%</td>
                        <td className="px-4 py-1.5 text-right text-[var(--accent-primary)]">{(result.zero_rates[i] * 100).toFixed(4)}%</td>
                        <td className="px-4 py-1.5 text-right">{result.discount_factors[i].toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Select a curve shape and click &quot;Generate Curve&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Bootstraps a zero-rate curve from par yields and computes discount factors and forward rates
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
