"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { HedgingTheory } from "./theory/HedgingTheory";
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

interface HedgingResult {
  bsm_price: number;
  paths: {
    spot_path: number[];
    delta_path: number[];
    cash_path: number[];
    total_transaction_costs: number;
    final_hedge_error: number;
    option_payoff: number;
    hedge_portfolio_value: number;
  }[];
  summary: {
    mean_hedge_error: number;
    std_hedge_error: number;
    min_hedge_error: number;
    max_hedge_error: number;
  };
  rebalance_steps: number;
  transaction_cost_rate: number;
}

export function HedgingTab() {
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(1.0);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [volatility, setVolatility] = useState(20.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");

  const [rebalanceSteps, setRebalanceSteps] = useState(50);
  const [txnCost, setTxnCost] = useState(0.0); // in bps
  const [numPaths, setNumPaths] = useState(100);
  const [seed, setSeed] = useState<string>("42");

  const [result, setResult] = useState<HedgingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionTypeValue = optionType === "Call" ? "call" : "put";

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.hedgingSim({
        spot,
        strike,
        expiryYears: expiry,
        optionType: optionTypeValue as "call" | "put",
        riskFreeRate: riskFreeRate / 100,
        volatility: volatility / 100,
        dividendYield: dividendYield / 100,
        rebalanceSteps,
        transactionCostRate: txnCost / 10000, // bps to decimal
        numPaths,
        seed: seed ? parseInt(seed, 10) : null,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  // Use first path for spot/delta chart display
  const path0 = result?.paths[0];
  const timeAxis = path0 ? path0.spot_path.map((_, i) => (i / (path0.spot_path.length - 1)) * expiry) : [];
  const hedgeErrors = result ? result.paths.map((p) => p.final_hedge_error) : [];

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Hedging Parameters
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
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Hedging</p>
            <div className="flex flex-col gap-3">
              <NumberInput label="Rebalance Steps" value={rebalanceSteps} onChange={setRebalanceSteps} min={5} max={500} step={10} />
              <NumberInput label="Transaction Cost" value={txnCost} onChange={setTxnCost} min={0} max={100} step={1} suffix="bps" />
              <NumberInput label="Number of Paths" value={numPaths} onChange={setNumPaths} min={1} max={500} step={50} />
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Seed
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Random"
                  className="rounded border border-[var(--border-color)] bg-[#0e0e14] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSimulate} loading={loading} className="mt-2 w-full">
            Run Hedging Sim
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Results ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">BSM Price</p>
                <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">{result.bsm_price.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Mean Hedge Error</p>
                <p className={`font-mono text-lg font-bold ${result.summary.mean_hedge_error >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                  {result.summary.mean_hedge_error >= 0 ? "+" : ""}{result.summary.mean_hedge_error.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Std Error</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.summary.std_hedge_error.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Txn Cost</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{txnCost} bps</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Steps</p>
                <p className="font-mono text-sm text-[var(--text-muted)]">{rebalanceSteps}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Spot path & delta path */}
              {path0 && (
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                  <Plot
                    data={[
                      {
                        x: timeAxis,
                        y: path0.spot_path,
                        type: "scatter" as const,
                        mode: "lines" as const,
                        line: { color: "#ff9800", width: 2 },
                        name: "Spot Price",
                      },
                    ]}
                    layout={{
                      ...DARK_LAYOUT,
                      title: { text: "Sample Spot Path", font: { size: 12, color: "#e0e0e0" } },
                      xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Time (years)", font: { size: 10 } } },
                      yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Spot Price", font: { size: 10 } } },
                      shapes: [{
                        type: "line", x0: 0, x1: expiry, y0: strike, y1: strike,
                        line: { color: "#555577", width: 1, dash: "dash" },
                      }],
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    useResizeHandler
                    style={{ width: "100%", height: "280px" }}
                  />
                </div>
              )}

              {/* Delta path */}
              {path0 && (
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                  <Plot
                    data={[
                      {
                        x: timeAxis,
                        y: path0.delta_path,
                        type: "scatter" as const,
                        mode: "lines" as const,
                        line: { color: "#2196f3", width: 2 },
                        name: "Delta",
                      },
                    ]}
                    layout={{
                      ...DARK_LAYOUT,
                      title: { text: "Hedge Delta Over Time", font: { size: 12, color: "#e0e0e0" } },
                      xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Time (years)", font: { size: 10 } } },
                      yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Delta", font: { size: 10 } } },
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    useResizeHandler
                    style={{ width: "100%", height: "280px" }}
                  />
                </div>
              )}
            </div>

            {/* Hedge error distribution */}
            {hedgeErrors.length > 1 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[{
                    x: hedgeErrors,
                    type: "histogram" as const,
                    nbinsx: 40,
                    marker: { color: "rgba(255,152,0,0.6)", line: { color: "#ff9800", width: 0.5 } },
                    name: "Hedge Error",
                  } as Plotly.Data]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Hedge Error Distribution", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Hedge Error (P&L)", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Frequency", font: { size: 10 } } },
                    shapes: [{
                      type: "line", x0: 0, x1: 0, y0: 0, y1: 1, yref: "paper",
                      line: { color: "#00c853", width: 1.5, dash: "dash" },
                    }],
                    annotations: [{
                      x: result.summary.mean_hedge_error, y: 1.02, yref: "paper",
                      text: `Mean = ${result.summary.mean_hedge_error.toFixed(2)}`,
                      showarrow: false, font: { color: "#ff9800", size: 10 },
                    }],
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "300px" }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Configure hedging parameters and click &quot;Run Hedging Sim&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Spot path, delta path, and hedge error distribution will appear here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Theory Panel ───────────────────────────────── */}
      <TheoryPanel title="Hedging Error Theory">
        <HedgingTheory />
      </TheoryPanel>
    </div>
  );
}
