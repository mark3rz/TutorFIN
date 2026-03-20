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

interface SliceResult {
  expiry: number;
  forward: number;
  params: Record<string, number>;
  fitted_ivs: number[];
  market_ivs: number[];
  strikes: number[];
  log_moneyness: number[];
  residuals: number[];
  diagnostics: Record<string, number>;
  converged: boolean;
  elapsed_ms: number;
  iterations: number;
  method: string;
}

interface CalibResult {
  slices: SliceResult[];
  aggregate_diagnostics: Record<string, number>;
  n_slices: number;
}

// Default synthetic IV data (equity-like skew)
const DEFAULT_SLICES = [
  {
    expiry: 0.25,
    strikes: [85, 90, 95, 100, 105, 110, 115],
    market_ivs: [0.28, 0.25, 0.22, 0.20, 0.19, 0.18, 0.18],
  },
  {
    expiry: 0.5,
    strikes: [85, 90, 95, 100, 105, 110, 115],
    market_ivs: [0.27, 0.24, 0.22, 0.20, 0.19, 0.185, 0.185],
  },
  {
    expiry: 1.0,
    strikes: [85, 90, 95, 100, 105, 110, 115],
    market_ivs: [0.26, 0.24, 0.22, 0.21, 0.20, 0.195, 0.195],
  },
];

export function SVISurfaceTab() {
  const [spot, setSpot] = useState(100);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [dividendYield, setDividendYield] = useState(0.0);

  const [result, setResult] = useState<CalibResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalibrate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.calibrateSVI({
        spot,
        riskFreeRate: riskFreeRate / 100,
        dividendYield: dividendYield / 100,
        slices: DEFAULT_SLICES,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Calibration failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Build smile plots per slice
  const smileTraces: Plotly.Data[] = [];
  const colors = ["#ff9800", "#2196f3", "#4caf50"];
  if (result) {
    result.slices.forEach((s, i) => {
      const color = colors[i % colors.length];
      // Market IVs (dots)
      smileTraces.push({
        x: s.strikes,
        y: s.market_ivs.map((v) => v * 100),
        type: "scatter" as const,
        mode: "markers" as const,
        marker: { color, size: 7, symbol: "circle-open" },
        name: `Market T=${s.expiry}y`,
      });
      // Fitted IVs (line)
      smileTraces.push({
        x: s.strikes,
        y: s.fitted_ivs.map((v) => v * 100),
        type: "scatter" as const,
        mode: "lines" as const,
        line: { color, width: 2 },
        name: `SVI Fit T=${s.expiry}y`,
      });
    });
  }

  // Residual plot
  const residualTraces: Plotly.Data[] = [];
  if (result) {
    result.slices.forEach((s, i) => {
      const color = colors[i % colors.length];
      residualTraces.push({
        x: s.strikes,
        y: s.residuals.map((r) => r * 10000), // in bps
        type: "bar" as const,
        marker: { color, opacity: 0.7 },
        name: `T=${s.expiry}y`,
      });
    });
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Parameters ───────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            SVI Calibration
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput label="Spot Price" value={spot} onChange={setSpot} min={1} step={5} />
          <NumberInput label="Risk-Free Rate" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Dividend Yield" value={dividendYield} onChange={setDividendYield} step={0.25} suffix="%" min={0} />

          <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2 text-[10px] text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text-secondary)] mb-1">Input Data</p>
            <p>3 expiry slices (0.25y, 0.5y, 1.0y)</p>
            <p>7 strikes each (85&ndash;115)</p>
            <p>Equity-like negative skew</p>
          </div>

          <Button onClick={handleCalibrate} loading={loading} className="mt-2 w-full">
            Calibrate SVI Surface
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}

          {/* Calibrated params */}
          {result && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Calibrated Parameters
              </p>
              {result.slices.map((s) => (
                <div
                  key={s.expiry}
                  className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2 text-[10px]"
                >
                  <p className="font-semibold text-[var(--text-secondary)] mb-1">
                    T = {s.expiry}y {s.converged ? "(converged)" : "(failed)"}
                  </p>
                  {Object.entries(s.params).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[var(--text-muted)]">
                      <span>{k}</span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {typeof v === "number" ? v.toFixed(6) : v}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Charts ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* IV smile fit */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={smileTraces}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "SVI Implied Volatility Fit", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Strike", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "IV (%)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "350px" }}
              />
            </div>

            {/* Residuals */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={residualTraces}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Calibration Residuals (bps)", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Strike", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Residual (bps)", font: { size: 10 } } },
                  barmode: "group",
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "250px" }}
              />
            </div>

            {/* Diagnostics */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "RMSE", value: `${(result.aggregate_diagnostics.rmse * 10000).toFixed(2)} bps` },
                { label: "R-Squared", value: result.aggregate_diagnostics.r_squared?.toFixed(6) ?? "N/A" },
                { label: "MAPE", value: `${result.aggregate_diagnostics.mape?.toFixed(2) ?? "N/A"}%` },
                { label: "Slices", value: `${result.n_slices}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">{label}</p>
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Click &quot;Calibrate SVI Surface&quot; to fit the volatility smile
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Calibrates SVI parameters to synthetic market implied volatilities across 3 expiries
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
