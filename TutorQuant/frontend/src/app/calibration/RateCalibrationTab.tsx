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

interface RateCalibResult {
  model: string;
  params: Record<string, number>;
  r0: number;
  maturities: number[];
  target_rates: number[];
  fitted_rates: number[];
  residuals: number[];
  diagnostics: Record<string, number>;
  converged: boolean;
  elapsed_ms: number;
  iterations: number;
  method: string;
}

// Default observed yield curve (upward sloping)
const DEFAULT_MATURITIES = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30];
const DEFAULT_RATES = [0.030, 0.031, 0.033, 0.036, 0.038, 0.041, 0.043, 0.045, 0.047, 0.048, 0.049];

export function RateCalibrationTab() {
  const [model, setModel] = useState("Vasicek");
  const [r0, setR0] = useState(3.0);

  const [result, setResult] = useState<RateCalibResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelMap: Record<string, string> = {
    "Vasicek": "vasicek",
    "CIR": "cir",
  };

  async function handleCalibrate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.calibrateRateModel({
        model: modelMap[model],
        r0: r0 / 100,
        maturities: DEFAULT_MATURITIES,
        targetRates: DEFAULT_RATES,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Calibration failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Build yield curve plot
  const curveTraces: Plotly.Data[] = [];
  if (result) {
    curveTraces.push({
      x: result.maturities,
      y: result.target_rates.map((r) => r * 100),
      type: "scatter" as const,
      mode: "markers" as const,
      marker: { color: "#ff9800", size: 8, symbol: "circle-open" },
      name: "Market Zero Rates",
    });
    curveTraces.push({
      x: result.maturities,
      y: result.fitted_rates.map((r) => r * 100),
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: "#2196f3", width: 2 },
      marker: { size: 5 },
      name: `${model} Fit`,
    });
  }

  // Residuals
  const residualTraces: Plotly.Data[] = [];
  if (result) {
    residualTraces.push({
      x: result.maturities,
      y: result.residuals.map((r) => r * 10000), // in bps
      type: "bar" as const,
      marker: {
        color: result.residuals.map((r) => (r >= 0 ? "rgba(76,175,80,0.7)" : "rgba(244,67,54,0.7)")),
      },
      name: "Residual",
    });
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Parameters ───────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Rate Calibration
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Model</span>
            <ToggleGroup options={["Vasicek", "CIR"]} value={model} onChange={setModel} />
          </div>

          <NumberInput label="Initial Short Rate (r₀)" value={r0} onChange={setR0} step={0.25} suffix="%" />

          <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2 text-[10px] text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text-secondary)] mb-1">Target Curve</p>
            <p>11 maturities (3M to 30Y)</p>
            <p>Upward-sloping yield curve</p>
            <p>Rates: 3.0% &ndash; 4.9%</p>
          </div>

          <Button onClick={handleCalibrate} loading={loading} className="mt-2 w-full">
            Calibrate {model}
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
              <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2 text-[10px]">
                <p className="font-semibold text-[var(--text-secondary)] mb-1">
                  {result.model.toUpperCase()} {result.converged ? "(converged)" : "(failed)"}
                </p>
                {Object.entries(result.params).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[var(--text-muted)]">
                    <span>{k}</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {typeof v === "number" ? v.toFixed(6) : v}
                    </span>
                  </div>
                ))}
                <div className="mt-2 border-t border-[var(--border-color)] pt-1">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Iterations</span>
                    <span className="font-mono text-[var(--text-primary)]">{result.iterations}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Time</span>
                    <span className="font-mono text-[var(--text-primary)]">{result.elapsed_ms.toFixed(1)} ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Charts ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Yield curve fit */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={curveTraces}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: `${model} Yield Curve Calibration`, font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Zero Rate (%)", font: { size: 10 } } },
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
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Maturity (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Residual (bps)", font: { size: 10 } } },
                  showlegend: false,
                  bargap: 0.3,
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "250px" }}
              />
            </div>

            {/* Diagnostics */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "RMSE", value: `${(result.diagnostics.rmse * 10000).toFixed(2)} bps` },
                { label: "R-Squared", value: result.diagnostics.r_squared?.toFixed(6) ?? "N/A" },
                { label: "Max Error", value: `${(result.diagnostics.max_abs_err * 10000).toFixed(2)} bps` },
                { label: "Observations", value: `${result.diagnostics.n_obs}` },
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
                Select a model and click &quot;Calibrate&quot; to fit the yield curve
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Optimises model parameters to match an observed zero-rate term structure
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
