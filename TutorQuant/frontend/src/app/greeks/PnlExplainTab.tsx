"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { PnlTheory } from "./theory/PnlTheory";
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

interface PnlResult {
  delta_pnl: number;
  gamma_pnl: number;
  vega_pnl: number;
  theta_pnl: number;
  total_greek_pnl: number;
  actual_pnl: number;
  unexplained: number;
  old_price: number;
  new_price: number;
  position_size: number;
  greeks: Record<string, number>;
  scenario: Record<string, number>;
}

interface GridResult {
  spot_shocks: number[];
  vol_shocks: number[];
  pnl_grid: number[][];
  base_price: number;
}

export function PnlExplainTab() {
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(1.0);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [volatility, setVolatility] = useState(20.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");
  const [positionSize, setPositionSize] = useState(1.0);

  /* Scenario shocks */
  const [dS, setDS] = useState(5.0);
  const [dsigma, setDsigma] = useState(1.0); // in percentage points
  const [dt, setDt] = useState(1.0); // in days

  /* Results */
  const [pnlResult, setPnlResult] = useState<PnlResult | null>(null);
  const [gridResult, setGridResult] = useState<GridResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionTypeValue = optionType === "Call" ? "call" : "put";

  async function handleCompute() {
    setLoading(true);
    setError(null);

    const baseParams = {
      spot,
      strike,
      expiryYears: expiry,
      optionType: optionTypeValue as "call" | "put",
      riskFreeRate: riskFreeRate / 100,
      volatility: volatility / 100,
      dividendYield: dividendYield / 100,
    };

    try {
      const [pnl, grid] = await Promise.all([
        api.pnlExplain({
          ...baseParams,
          dS,
          dsigma: dsigma / 100, // convert percentage points to decimal
          dt: dt / 252, // convert days to years
          positionSize,
        }),
        api.scenarioGrid({
          ...baseParams,
          spotShocks: [-20, -15, -10, -5, 0, 5, 10, 15, 20],
          volShocks: [-0.05, -0.025, 0, 0.025, 0.05],
        }),
      ]);
      setPnlResult(pnl);
      setGridResult(grid);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Computation failed");
    } finally {
      setLoading(false);
    }
  }

  function fmtPnl(v: number): string {
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}`;
  }

  function pnlColor(v: number): string {
    if (v > 0.01) return "text-[var(--accent-green)]";
    if (v < -0.01) return "text-[var(--accent-red)]";
    return "text-[var(--text-muted)]";
  }

  const greekPnlItems = pnlResult
    ? [
        { label: "Delta P&L", value: pnlResult.delta_pnl, desc: `Δ × dS = ${pnlResult.greeks.delta?.toFixed(4)} × ${dS}` },
        { label: "Gamma P&L", value: pnlResult.gamma_pnl, desc: `½Γ × dS² = ½ × ${pnlResult.greeks.gamma?.toFixed(4)} × ${dS}²` },
        { label: "Vega P&L", value: pnlResult.vega_pnl, desc: `ν × dσ = ${pnlResult.greeks.vega?.toFixed(4)} × ${(dsigma / 100).toFixed(4)}` },
        { label: "Theta P&L", value: pnlResult.theta_pnl, desc: `Θ × dt = ${pnlResult.greeks.theta?.toFixed(4)} × ${(dt / 252).toFixed(6)}` },
      ]
    : [];

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Option & Scenario
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
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Scenario Shocks</p>
            <div className="flex flex-col gap-3">
              <NumberInput label="Spot Shock (dS)" value={dS} onChange={setDS} step={1} />
              <NumberInput label="Vol Shock (dσ)" value={dsigma} onChange={setDsigma} step={0.5} suffix="pp" />
              <NumberInput label="Time Elapsed" value={dt} onChange={setDt} min={0} step={1} suffix="days" />
              <NumberInput label="Position Size" value={positionSize} onChange={setPositionSize} step={1} />
            </div>
          </div>

          <Button onClick={handleCompute} loading={loading} className="mt-2 w-full">
            Compute P&L
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
        {pnlResult ? (
          <>
            {/* P&L Decomposition */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
              <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Greek-Based P&L Decomposition
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {greekPnlItems.map((item) => (
                  <div key={item.label} className="rounded border border-[var(--border-color)] bg-[#0a0a0f] p-3">
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">{item.label}</p>
                    <p className={`mt-1 font-mono text-xl font-bold ${pnlColor(item.value)}`}>
                      {fmtPnl(item.value)}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Summary row */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="rounded border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 p-3">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">Total Greek P&L</p>
                  <p className={`mt-1 font-mono text-lg font-bold ${pnlColor(pnlResult.total_greek_pnl)}`}>
                    {fmtPnl(pnlResult.total_greek_pnl)}
                  </p>
                </div>
                <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] p-3">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">Actual P&L</p>
                  <p className={`mt-1 font-mono text-lg font-bold ${pnlColor(pnlResult.actual_pnl)}`}>
                    {fmtPnl(pnlResult.actual_pnl)}
                  </p>
                </div>
                <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] p-3">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">Unexplained</p>
                  <p className={`mt-1 font-mono text-lg font-bold ${pnlColor(pnlResult.unexplained)}`}>
                    {fmtPnl(pnlResult.unexplained)}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">Higher-order / cross terms</p>
                </div>
              </div>

              {/* Price change */}
              <div className="mt-3 flex gap-6 text-xs">
                <span className="text-[var(--text-muted)]">
                  Old Price: <span className="font-mono text-[var(--text-primary)]">{pnlResult.old_price.toFixed(4)}</span>
                </span>
                <span className="text-[var(--text-muted)]">
                  New Price: <span className="font-mono text-[var(--text-primary)]">{pnlResult.new_price.toFixed(4)}</span>
                </span>
              </div>
            </div>

            {/* Scenario Grid Heatmap */}
            {gridResult && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[{
                    z: gridResult.pnl_grid,
                    x: gridResult.vol_shocks.map((v) => `${(v * 100).toFixed(1)}pp`),
                    y: gridResult.spot_shocks.map((s) => `${s >= 0 ? "+" : ""}${s}`),
                    type: "heatmap" as const,
                    colorscale: [
                      [0, "#ff1744"],
                      [0.5, "#141420"],
                      [1, "#00c853"],
                    ] as Plotly.ColorScale,
                    zmid: 0,
                    colorbar: {
                      title: { text: "P&L", font: { size: 10, color: "#e0e0e0" } },
                      tickfont: { size: 9, color: "#8888aa" },
                    },
                    hovertemplate: "Spot: %{y}<br>Vol: %{x}<br>P&L: %{z:.2f}<extra></extra>",
                  } as Plotly.Data]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "P&L Scenario Grid (Spot × Vol)", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Vol Shock", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Spot Shock", font: { size: 10 } }, autorange: true },
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "350px" }}
                />
              </div>
            )}

            {/* P&L Waterfall Bar Chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[{
                  x: ["Delta", "Gamma", "Vega", "Theta", "Unexplained"],
                  y: [
                    pnlResult.delta_pnl,
                    pnlResult.gamma_pnl,
                    pnlResult.vega_pnl,
                    pnlResult.theta_pnl,
                    pnlResult.unexplained,
                  ],
                  type: "bar" as const,
                  marker: {
                    color: [
                      pnlResult.delta_pnl >= 0 ? "#00c853" : "#ff1744",
                      pnlResult.gamma_pnl >= 0 ? "#00c853" : "#ff1744",
                      pnlResult.vega_pnl >= 0 ? "#00c853" : "#ff1744",
                      pnlResult.theta_pnl >= 0 ? "#00c853" : "#ff1744",
                      pnlResult.unexplained >= 0 ? "#555577" : "#555577",
                    ],
                  },
                }]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "P&L Attribution Waterfall", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "P&L", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "280px" }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Configure option parameters and scenario shocks</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Greek-based P&L decomposition and scenario heatmap will appear here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Theory Panel ───────────────────────────────── */}
      <TheoryPanel title="P&L Explain Theory">
        <PnlTheory />
      </TheoryPanel>
    </div>
  );
}
