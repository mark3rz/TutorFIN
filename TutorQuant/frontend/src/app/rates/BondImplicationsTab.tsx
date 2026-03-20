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
  showlegend: true,
  legend: { font: { size: 10 }, bgcolor: "rgba(0,0,0,0)" },
};

interface CurveResult {
  model: string;
  maturities: number[];
  bond_prices: number[];
  zero_rates: number[];
}

const COLORS = ["#ff9800", "#2196f3", "#4caf50", "#e91e63", "#9c27b0"];

export function BondImplicationsTab() {
  const [model, setModel] = useState("Vasicek");
  const [r0, setR0] = useState(4.0);
  const [kappa, setKappa] = useState(0.5);
  const [theta, setTheta] = useState(4.0);
  const [sigma, setSigma] = useState(1.0);

  // Multi-scenario: vary r0
  const [showMulti, setShowMulti] = useState(false);

  const [result, setResult] = useState<CurveResult | null>(null);
  const [multiResults, setMultiResults] = useState<CurveResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelMap: Record<string, string> = {
    "Vasicek": "vasicek",
    "CIR": "cir",
    "Hull-White": "hull_white",
  };

  function getParams(): Record<string, number> {
    const m = modelMap[model];
    if (m === "hull_white") {
      return { a: kappa, sigma: sigma / 100, theta_hw: kappa * (theta / 100) };
    }
    return { kappa, theta: theta / 100, sigma: sigma / 100 };
  }

  async function handleCompute() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.rateModelYieldCurve({
        model: modelMap[model],
        r0: r0 / 100,
        params: getParams(),
      });
      setResult(res);

      // Multi-scenario: vary r0 by +/- 1% and +/- 2%
      if (showMulti) {
        const scenarios = [-2, -1, 0, 1, 2].map((delta) => r0 + delta);
        const multi: CurveResult[] = [];
        for (const r of scenarios) {
          if (modelMap[model] === "cir" && r <= 0) continue;
          const mRes = await api.rateModelYieldCurve({
            model: modelMap[model],
            r0: r / 100,
            params: getParams(),
          });
          multi.push({ ...mRes, model: `r\u2080=${r.toFixed(1)}%` });
        }
        setMultiResults(multi);
      } else {
        setMultiResults(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Computation failed");
      setResult(null);
      setMultiResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Parameters ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Bond Price Implications
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Model</span>
            <ToggleGroup options={["Vasicek", "CIR", "Hull-White"]} value={model} onChange={setModel} />
          </div>

          <NumberInput label="Initial Rate (r\u2080)" value={r0} onChange={setR0} step={0.25} suffix="%" />
          <NumberInput label="Mean Reversion (\u03BA / a)" value={kappa} onChange={setKappa} min={0.01} step={0.1} />
          <NumberInput label="Long-Run Mean (\u03B8)" value={theta} onChange={setTheta} step={0.25} suffix="%" />
          <NumberInput label="Volatility (\u03C3)" value={sigma} onChange={setSigma} min={0.01} step={0.1} suffix="%" />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Rate Scenarios</span>
            <ToggleGroup
              options={["Single", "Multi"]}
              value={showMulti ? "Multi" : "Single"}
              onChange={(v) => setShowMulti(v === "Multi")}
            />
          </div>

          <Button onClick={handleCompute} loading={loading} className="mt-2 w-full">
            Compute Curves
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Charts ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Zero-rate term structure */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={
                  multiResults
                    ? multiResults.map((r, i) => ({
                        x: r.maturities,
                        y: r.zero_rates.map((z) => z * 100),
                        type: "scatter" as const,
                        mode: "lines+markers" as const,
                        line: { color: COLORS[i % COLORS.length], width: 2 },
                        marker: { size: 4 },
                        name: r.model,
                      }))
                    : [
                        {
                          x: result.maturities,
                          y: result.zero_rates.map((z) => z * 100),
                          type: "scatter" as const,
                          mode: "lines+markers" as const,
                          line: { color: "#ff9800", width: 2 },
                          marker: { size: 5 },
                          name: `${model} Zero Rates`,
                        },
                      ]
                }
                layout={{
                  ...DARK_LAYOUT,
                  title: {
                    text: multiResults
                      ? `${model} Yield Curves — Rate Scenarios`
                      : `${model} Implied Zero-Rate Curve`,
                    font: { size: 12, color: "#e0e0e0" },
                  },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Zero Rate (%)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "300px" }}
              />
            </div>

            {/* Bond prices */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={
                  multiResults
                    ? multiResults.map((r, i) => ({
                        x: r.maturities,
                        y: r.bond_prices,
                        type: "scatter" as const,
                        mode: "lines+markers" as const,
                        line: { color: COLORS[i % COLORS.length], width: 2 },
                        marker: { size: 4 },
                        name: r.model,
                      }))
                    : [
                        {
                          x: result.maturities,
                          y: result.bond_prices,
                          type: "scatter" as const,
                          mode: "lines+markers" as const,
                          line: { color: "#4caf50", width: 2 },
                          marker: { size: 5 },
                          fill: "tozeroy" as const,
                          fillcolor: "rgba(76,175,80,0.1)",
                          name: "ZCB Price",
                        },
                      ]
                }
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Zero-Coupon Bond Prices P(0,T)", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Price", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "280px" }}
              />
            </div>

            {/* Data table */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
              <div className="border-b border-[var(--border-color)] px-4 py-2">
                <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Analytical Curve Data</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                      <th className="px-4 py-2 text-left">T (yrs)</th>
                      <th className="px-4 py-2 text-right">P(0,T)</th>
                      <th className="px-4 py-2 text-right">Zero Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.maturities.map((t, i) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50 text-[var(--text-secondary)]">
                        <td className="px-4 py-1.5">{t.toFixed(2)}</td>
                        <td className="px-4 py-1.5 text-right">{result.bond_prices[i].toFixed(6)}</td>
                        <td className="px-4 py-1.5 text-right text-[var(--accent-primary)]">
                          {(result.zero_rates[i] * 100).toFixed(4)}%
                        </td>
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
              <p className="text-sm text-[var(--text-muted)]">Configure model and click &quot;Compute Curves&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Shows analytical zero-coupon bond prices and implied yield curves
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
