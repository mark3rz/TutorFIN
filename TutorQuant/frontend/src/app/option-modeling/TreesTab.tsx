"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { TreeTheory } from "./theory/TreeTheory";
import { api } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: "#0e0e14",
  plot_bgcolor: "#141420",
  font: { color: "#e0e0e0", family: "monospace", size: 11 },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  yaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  showlegend: false,
};

interface ComparisonResult {
  model: string;
  model_name: string;
  price: number;
  computation_time_ms: number;
  metadata?: Record<string, unknown>;
}

export function TreesTab() {
  /* ---- input state ---- */
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(1.0);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [volatility, setVolatility] = useState(20.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");
  const [exerciseStyle, setExerciseStyle] = useState<string>("European");
  const [steps, setSteps] = useState(200);

  /* ---- result state ---- */
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [convergenceData, setConvergenceData] = useState<{ steps: number[]; binom: number[]; trinom: number[]; bsm: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionTypeValue = optionType === "Call" ? "call" : "put";
  const exerciseValue = exerciseStyle === "European" ? "european" : "american";

  async function handleCompare() {
    setLoading(true);
    setError(null);
    setResults(null);
    setConvergenceData(null);

    const baseParams = {
      spot,
      strike,
      expiryYears: expiry,
      optionType: optionTypeValue as "call" | "put",
      exerciseStyle: exerciseValue as "european" | "american",
      riskFreeRate: riskFreeRate / 100,
      volatility: volatility / 100,
      dividendYield: dividendYield / 100,
    };

    try {
      // Model comparison at the chosen step count
      const models = exerciseValue === "european"
        ? ["black_scholes", "binomial", "trinomial"]
        : ["binomial", "trinomial"];

      const comparison = await api.compareModels({
        ...baseParams,
        models,
        steps,
      });
      setResults(comparison.results);

      // Convergence: price across different step counts
      const stepCounts = [10, 25, 50, 100, 150, 200, 300, 500];
      const binomPrices: number[] = [];
      const trinomPrices: number[] = [];

      for (const n of stepCounts) {
        const [b, t] = await Promise.all([
          api.priceOption({ ...baseParams, model: "binomial", modelParams: { steps: n } }),
          api.priceOption({ ...baseParams, model: "trinomial", modelParams: { steps: n } }),
        ]);
        binomPrices.push(b.price);
        trinomPrices.push(t.price);
      }

      // BSM reference (only for European)
      let bsmRef = NaN;
      if (exerciseValue === "european") {
        const bsm = await api.priceOption({ ...baseParams, model: "black_scholes" });
        bsmRef = bsm.price;
      }

      setConvergenceData({ steps: stepCounts, binom: binomPrices, trinom: trinomPrices, bsm: bsmRef });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  /* ---- helpers ---- */
  function fmtPrice(v: number): string {
    if (isNaN(v)) return "N/A";
    return v.toFixed(4);
  }

  const bsmResult = results?.find((r) => r.model === "black_scholes");
  const refPrice = bsmResult?.price ?? results?.[0]?.price ?? 0;

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ──────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Tree Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Strike Price (K)" value={strike} onChange={setStrike} min={0.01} step={1} />
          <NumberInput label="Time to Expiry (T) years" value={expiry} onChange={setExpiry} min={0.01} step={0.1} />
          <NumberInput label="Risk-Free Rate (r)" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Volatility (σ)" value={volatility} onChange={setVolatility} min={0.01} step={1} suffix="%" />
          <NumberInput label="Dividend Yield (q)" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />
          <NumberInput label="Tree Steps (N)" value={steps} onChange={setSteps} min={1} max={1000} step={50} />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Option Type</span>
            <ToggleGroup options={["Call", "Put"]} value={optionType} onChange={setOptionType} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Exercise</span>
            <ToggleGroup options={["European", "American"]} value={exerciseStyle} onChange={setExerciseStyle} />
          </div>

          <Button onClick={handleCompare} loading={loading} className="mt-2 w-full">
            Compare Models
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Results ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {/* Comparison Table */}
        {results && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
            <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Model Comparison — {optionType} {exerciseStyle} | S={spot} K={strike} T={expiry}y
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="py-2 text-left text-[var(--text-muted)]">Model</th>
                    <th className="py-2 text-right text-[var(--text-muted)]">Price</th>
                    <th className="py-2 text-right text-[var(--text-muted)]">Diff vs Ref</th>
                    <th className="py-2 text-right text-[var(--text-muted)]">Time (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const diff = r.price - refPrice;
                    const hasError = r.metadata?.error;
                    return (
                      <tr key={r.model} className="border-b border-[var(--border-color)]/50">
                        <td className="py-2 font-mono text-[var(--text-primary)]">{r.model_name}</td>
                        <td className={`py-2 text-right font-mono font-bold ${hasError ? "text-[var(--text-muted)]" : "text-[var(--accent-primary)]"}`}>
                          {hasError ? "N/A" : fmtPrice(r.price)}
                        </td>
                        <td className={`py-2 text-right font-mono ${diff > 0 ? "text-[var(--accent-green)]" : diff < 0 ? "text-[var(--accent-red)]" : "text-[var(--text-muted)]"}`}>
                          {hasError ? "--" : (diff >= 0 ? "+" : "") + diff.toFixed(4)}
                        </td>
                        <td className="py-2 text-right font-mono text-[var(--text-muted)]">
                          {r.computation_time_ms.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {exerciseStyle === "American" && (
              <p className="mt-3 text-[10px] text-[var(--text-muted)]">
                BSM not available for American options — tree models support early exercise
              </p>
            )}
          </div>
        )}

        {/* Convergence Chart */}
        {convergenceData && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={[
                {
                  x: convergenceData.steps,
                  y: convergenceData.binom,
                  type: "scatter" as const,
                  mode: "lines+markers" as const,
                  line: { color: "#ff9800", width: 2 },
                  marker: { size: 5 },
                  name: "Binomial (CRR)",
                },
                {
                  x: convergenceData.steps,
                  y: convergenceData.trinom,
                  type: "scatter" as const,
                  mode: "lines+markers" as const,
                  line: { color: "#2196f3", width: 2 },
                  marker: { size: 5 },
                  name: "Trinomial (KR)",
                },
                ...(!isNaN(convergenceData.bsm)
                  ? [{
                      x: [convergenceData.steps[0], convergenceData.steps[convergenceData.steps.length - 1]],
                      y: [convergenceData.bsm, convergenceData.bsm],
                      type: "scatter" as const,
                      mode: "lines" as const,
                      line: { color: "#00c853", width: 1.5, dash: "dash" as const },
                      name: "BSM (exact)",
                    }]
                  : []),
              ]}
              layout={{
                ...DARK_LAYOUT,
                title: { text: "Convergence vs Number of Steps", font: { size: 12, color: "#e0e0e0" } },
                xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Number of Steps", font: { size: 10 } } },
                yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Option Price", font: { size: 10 } } },
                showlegend: true,
                legend: { bgcolor: "transparent", font: { size: 9 }, x: 0.6, y: 0.99 },
              }}
              config={{ responsive: true, displayModeBar: false }}
              useResizeHandler
              style={{ width: "100%", height: "350px" }}
            />
          </div>
        )}

        {/* Assumptions */}
        {results && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Active Assumptions</h4>
            <div className="grid grid-cols-4 gap-x-8 gap-y-1 text-xs">
              {[
                ["Exercise", exerciseStyle], ["Type", optionType],
                ["S", `${spot}`], ["K", `${strike}`],
                ["T", `${expiry}y`], ["r", `${riskFreeRate}%`],
                ["σ", `${volatility}%`], ["q", `${dividendYield}%`],
                ["Steps", `${steps}`], ["Method", "Lattice"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="font-mono text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!results && !loading && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Configure parameters and click &quot;Compare Models&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                BSM vs Binomial vs Trinomial comparison and convergence chart will appear here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Theory Panel ────────────────────────────────── */}
      <TheoryPanel title="Tree Models Theory">
        <TreeTheory />
      </TheoryPanel>
    </div>
  );
}
