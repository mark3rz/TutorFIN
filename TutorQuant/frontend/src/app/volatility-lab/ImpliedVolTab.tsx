"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
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
  showlegend: false,
};

interface IVResult {
  implied_vol: number;
  bsm_price: number;
  moneyness: number;
  log_moneyness: number;
  time_value: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  vanna: number;
  volga: number;
  charm: number;
}

export function ImpliedVolTab() {
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(0.25);
  const [marketPrice, setMarketPrice] = useState(5.0);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");

  const [result, setResult] = useState<IVResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For the multi-strike chart
  const [multiResults, setMultiResults] = useState<{strikes: number[]; ivs: number[]} | null>(null);

  async function handleSolve() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveImpliedVol({
        spot,
        strike,
        expiryYears: expiry,
        marketPrice,
        riskFreeRate: riskFreeRate / 100,
        dividendYield: dividendYield / 100,
        optionType: optionType === "Call" ? "call" : "put",
      });
      setResult(res);

      // Also solve for a range of strikes to show smile
      const strikes = [];
      const ivs = [];
      for (let k = Math.round(spot * 0.8); k <= Math.round(spot * 1.2); k += Math.round(spot * 0.025)) {
        try {
          const otype = optionType === "Call" ? "call" : "put";
          // Use the solved IV to generate synthetic prices at other strikes
          const syntheticPrice = await api.priceOption({
            spot,
            strike: k,
            expiryYears: expiry,
            optionType: otype as "call" | "put",
            riskFreeRate: riskFreeRate / 100,
            volatility: res.implied_vol,
            dividendYield: dividendYield / 100,
          });
          const ivResult = await api.solveImpliedVol({
            spot,
            strike: k,
            expiryYears: expiry,
            marketPrice: syntheticPrice.price,
            riskFreeRate: riskFreeRate / 100,
            dividendYield: dividendYield / 100,
            optionType: otype as "call" | "put",
          });
          strikes.push(k);
          ivs.push(ivResult.implied_vol * 100);
        } catch {
          // Skip strikes where IV solve fails
        }
      }
      setMultiResults({ strikes, ivs });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "IV solve failed");
      setResult(null);
      setMultiResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            IV Solver Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Strike Price (K)" value={strike} onChange={setStrike} min={0.01} step={1} />
          <NumberInput label="Time to Expiry (T) years" value={expiry} onChange={setExpiry} min={0.01} step={0.05} />
          <NumberInput label="Market Price" value={marketPrice} onChange={setMarketPrice} min={0.01} step={0.5} />
          <NumberInput label="Risk-Free Rate (r)" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Dividend Yield (q)" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Option Type</span>
            <ToggleGroup options={["Call", "Put"]} value={optionType} onChange={setOptionType} />
          </div>

          <Button onClick={handleSolve} loading={loading} className="mt-2 w-full">
            Solve IV
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
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Implied Vol</p>
                <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">
                  {(result.implied_vol * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">BSM Price</p>
                <p className="font-mono text-lg text-[var(--text-primary)]">{result.bsm_price.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Time Value</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.time_value.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Moneyness</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.moneyness.toFixed(4)}</p>
              </div>
            </div>

            {/* Greeks grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Delta", value: result.delta },
                { label: "Gamma", value: result.gamma },
                { label: "Vega", value: result.vega },
                { label: "Theta", value: result.theta },
                { label: "Rho", value: result.rho },
                { label: "Vanna", value: result.vanna },
                { label: "Volga", value: result.volga },
                { label: "Charm", value: result.charm },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">{label}</p>
                  <p className={`font-mono text-sm font-semibold ${value >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                    {value >= 0 ? "+" : ""}{value.toFixed(6)}
                  </p>
                </div>
              ))}
            </div>

            {/* Flat smile chart (since all strikes use same vol) */}
            {multiResults && multiResults.strikes.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[{
                    x: multiResults.strikes,
                    y: multiResults.ivs,
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    line: { color: "#ff9800", width: 2 },
                    marker: { size: 5 },
                    name: "IV",
                  }]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Implied Volatility across Strikes (Flat — Single Vol Input)", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Strike", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "IV (%)", font: { size: 10 } } },
                    shapes: [{
                      type: "line", x0: strike, x1: strike, y0: 0, y1: 1, yref: "paper",
                      line: { color: "#555577", width: 1, dash: "dash" },
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
              <p className="text-sm text-[var(--text-muted)]">Enter a market price and click &quot;Solve IV&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                The solver uses Brent&apos;s method to find the BSM implied volatility
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
