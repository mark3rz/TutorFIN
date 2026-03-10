"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { MCTheory } from "./theory/MCTheory";
import { api } from "@/lib/api";

/* ── Dynamic Plotly import (SSR disabled) ─────────────────────────── */
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ── Plotly dark theme ────────────────────────────────────────────── */
const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: "#0e0e14",
  plot_bgcolor: "#141420",
  font: { color: "#e0e0e0", family: "monospace", size: 11 },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  yaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  showlegend: false,
};

/* ── MC result type (matches backend response) ────────────────────── */
interface MCResult {
  price: number;
  std_error: number;
  confidence_interval_95: [number, number];
  paths: {
    representative_path: number[];
    path_fan: number[][];
    terminal_values: number[];
  };
  convergence: {
    running_mean: number[];
    running_std: number[];
    confidence_interval_95: [number, number];
  };
  computation_time_ms: number;
}

/* ── Component ────────────────────────────────────────────────────── */

export function MonteCarloTab() {
  /* ---- input state ---- */
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(1.0);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [volatility, setVolatility] = useState(20.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");
  const [numPaths, setNumPaths] = useState(1000);
  const [seed, setSeed] = useState<string>("");
  const [antithetic, setAntithetic] = useState<string>("On");

  /* ---- result state ---- */
  const [result, setResult] = useState<MCResult | null>(null);
  const [bsmPrice, setBsmPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionTypeValue = optionType === "Call" ? "call" : "put";

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    setResult(null);

    const params = {
      spot,
      strike,
      expiryYears: expiry,
      optionType: optionTypeValue as "call" | "put",
      riskFreeRate: riskFreeRate / 100,
      volatility: volatility / 100,
      dividendYield: dividendYield / 100,
    };

    try {
      const [mc, bsm] = await Promise.all([
        api.runMonteCarlo({
          ...params,
          numPaths,
          seed: seed ? parseInt(seed, 10) : null,
          antithetic: antithetic === "On",
        }),
        api.priceOption(params),
      ]);
      setResult(mc as MCResult);
      setBsmPrice(bsm.price);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  /* ---- time axis for path charts ---- */
  const timeAxis = result
    ? result.paths.representative_path.map((_, i, arr) => (i / (arr.length - 1)) * expiry)
    : [];

  /* ================================================================ */
  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ──────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            MC Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Strike Price (K)" value={strike} onChange={setStrike} min={0.01} step={1} />
          <NumberInput label="Time to Expiry (T) years" value={expiry} onChange={setExpiry} min={0.01} step={0.1} />
          <NumberInput label="Risk-Free Rate (r)" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Volatility (σ)" value={volatility} onChange={setVolatility} min={0.01} step={1} suffix="%" />
          <NumberInput label="Dividend Yield (q)" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Option Type</span>
            <ToggleGroup options={["Call", "Put"]} value={optionType} onChange={setOptionType} />
          </div>

          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Simulation</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Paths</span>
                <ToggleGroup
                  options={["100", "500", "1000", "5000"]}
                  value={String(numPaths)}
                  onChange={(v) => setNumPaths(parseInt(v, 10))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Seed (optional)
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Random"
                  className="rounded border border-[var(--border-color)] bg-[#0e0e14] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Antithetic</span>
                <ToggleGroup options={["On", "Off"]} value={antithetic} onChange={setAntithetic} />
              </div>
            </div>
          </div>

          <Button onClick={handleSimulate} loading={loading} className="mt-2 w-full">
            Run Simulation
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Results & Charts ───────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {/* Summary Bar */}
        {result && (
          <div className="flex items-center gap-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
            <div>
              <p className="text-[10px] uppercase text-[var(--text-muted)]">MC Price</p>
              <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">{result.price.toFixed(4)}</p>
            </div>
            {bsmPrice !== null && (
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">BSM Price</p>
                <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">{bsmPrice.toFixed(4)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase text-[var(--text-muted)]">Std Error</p>
              <p className="font-mono text-sm text-[var(--text-secondary)]">{result.std_error.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--text-muted)]">95% CI</p>
              <p className="font-mono text-sm text-[var(--text-secondary)]">
                [{result.confidence_interval_95[0].toFixed(4)}, {result.confidence_interval_95[1].toFixed(4)}]
              </p>
            </div>
            <div className="ml-auto">
              <p className="text-[10px] uppercase text-[var(--text-muted)]">Compute</p>
              <p className="font-mono text-sm text-[var(--text-muted)]">{result.computation_time_ms.toFixed(0)} ms</p>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        {result ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Path Fan Chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  // Fan paths (semi-transparent)
                  ...result.paths.path_fan.map((path, i) => ({
                    x: timeAxis,
                    y: path,
                    type: "scatter" as const,
                    mode: "lines" as const,
                    line: { color: "rgba(255,152,0,0.15)", width: 1 },
                    showlegend: false,
                    hoverinfo: "skip" as const,
                    name: `Path ${i}`,
                  })),
                  // Representative path (thick)
                  {
                    x: timeAxis,
                    y: result.paths.representative_path,
                    type: "scatter" as const,
                    mode: "lines" as const,
                    line: { color: "#ff9800", width: 2.5 },
                    name: "Median path",
                    showlegend: true,
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Simulated Price Paths", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Time (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Asset Price", font: { size: 10 } } },
                  showlegend: true,
                  legend: { bgcolor: "transparent", font: { size: 9 }, x: 0.01, y: 0.99 },
                  shapes: [{
                    type: "line", x0: 0, x1: expiry, y0: strike, y1: strike,
                    line: { color: "#555577", width: 1, dash: "dash" },
                  }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "300px" }}
              />
            </div>

            {/* Terminal Distribution Histogram */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[{
                  x: result.paths.terminal_values,
                  type: "histogram" as const,
                  nbinsx: 60,
                  marker: { color: "rgba(255,152,0,0.6)", line: { color: "#ff9800", width: 0.5 } },
                  name: "Terminal Values",
                } as Plotly.Data]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Terminal Value Distribution", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Terminal Price", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Frequency", font: { size: 10 } } },
                  shapes: [{
                    type: "line", x0: strike, x1: strike, y0: 0, y1: 1, yref: "paper",
                    line: { color: "#ff1744", width: 1.5, dash: "dash" },
                  }],
                  annotations: [{
                    x: strike, y: 1.02, yref: "paper",
                    text: `K = ${strike}`, showarrow: false,
                    font: { color: "#ff1744", size: 10 },
                  }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "300px" }}
              />
            </div>

            {/* Convergence Chart */}
            <div className="col-span-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  // Running mean
                  {
                    x: result.convergence.running_mean.map((_, i) => i + 1),
                    y: result.convergence.running_mean,
                    type: "scatter" as const,
                    mode: "lines" as const,
                    line: { color: "#ff9800", width: 2 },
                    name: "Running Mean",
                  },
                  // 95% CI upper band
                  {
                    x: result.convergence.running_mean.map((_, i) => i + 1),
                    y: result.convergence.running_mean.map((m, i) => {
                      const se = result.convergence.running_std[i] / Math.sqrt(i + 1);
                      return m + 1.96 * se;
                    }),
                    type: "scatter" as const,
                    mode: "lines" as const,
                    line: { color: "rgba(255,152,0,0.3)", width: 0 },
                    showlegend: false,
                    hoverinfo: "skip" as const,
                    name: "CI Upper",
                  },
                  // 95% CI lower band (fill to upper)
                  {
                    x: result.convergence.running_mean.map((_, i) => i + 1),
                    y: result.convergence.running_mean.map((m, i) => {
                      const se = result.convergence.running_std[i] / Math.sqrt(i + 1);
                      return m - 1.96 * se;
                    }),
                    type: "scatter" as const,
                    mode: "lines" as const,
                    fill: "tonexty" as const,
                    fillcolor: "rgba(255,152,0,0.1)",
                    line: { color: "rgba(255,152,0,0.3)", width: 0 },
                    showlegend: false,
                    hoverinfo: "skip" as const,
                    name: "CI Lower",
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Price Convergence", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Number of Paths", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Price Estimate", font: { size: 10 } } },
                  showlegend: true,
                  legend: { bgcolor: "transparent", font: { size: 9 }, x: 0.7, y: 0.99 },
                  shapes: bsmPrice !== null ? [{
                    type: "line" as const, x0: 0, x1: numPaths, y0: bsmPrice, y1: bsmPrice,
                    line: { color: "#00c853", width: 1.5, dash: "dash" as const },
                  }] : [],
                  annotations: bsmPrice !== null ? [{
                    x: numPaths * 0.95, y: bsmPrice,
                    text: `BSM = ${bsmPrice.toFixed(4)}`, showarrow: false,
                    font: { color: "#00c853", size: 10 },
                    yshift: 12,
                  }] : [],
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "300px" }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Configure parameters and click &quot;Run Simulation&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Path fan, terminal distribution, and convergence charts will appear here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Theory Panel ────────────────────────────────── */}
      <TheoryPanel title="Monte Carlo Theory">
        <MCTheory />
      </TheoryPanel>
    </div>
  );
}
