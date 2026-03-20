"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useWorkbench } from "@/context/WorkbenchContext";
import { Briefcase, Check } from "lucide-react";

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

interface SimResult {
  model: string;
  times: number[];
  paths: number[][];
  mean_rate: number[];
  std_rate: number[];
  terminal_distribution: number[];
  metadata?: Record<string, unknown>;
}

export function ShortRateTab() {
  const [model, setModel] = useState("Vasicek");
  const [r0, setR0] = useState(4.0);
  const [kappa, setKappa] = useState(0.5);
  const [theta, setTheta] = useState(4.0);
  const [sigma, setSigma] = useState(1.0);
  const [horizon, setHorizon] = useState(5.0);
  const [nPaths, setNPaths] = useState(200);

  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentRate, setSentRate] = useState(false);

  const { setRateAssumption, setProfileRate } = useWorkbench();

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

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.simulateRates({
        model: modelMap[model],
        r0: r0 / 100,
        params: getParams(),
        horizonYears: horizon,
        nPaths,
        nSteps: Math.round(horizon * 252),
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Prepare fan chart data (show subset of paths + mean + confidence bands)
  const fanTraces: Plotly.Data[] = [];
  if (result) {
    // Individual paths (faded)
    const maxVis = Math.min(result.paths.length, 30);
    for (let i = 0; i < maxVis; i++) {
      fanTraces.push({
        x: result.times,
        y: result.paths[i].map((r) => r * 100),
        type: "scatter" as const,
        mode: "lines" as const,
        line: { color: "rgba(255,152,0,0.15)", width: 0.5 },
        showlegend: false,
        hoverinfo: "skip" as const,
      });
    }

    // Mean path
    fanTraces.push({
      x: result.times,
      y: result.mean_rate.map((r) => r * 100),
      type: "scatter" as const,
      mode: "lines" as const,
      line: { color: "#ff9800", width: 2.5 },
      name: "Mean",
    });

    // +/- 1 std bands
    const upper = result.mean_rate.map((m, i) => (m + result.std_rate[i]) * 100);
    const lower = result.mean_rate.map((m, i) => (m - result.std_rate[i]) * 100);
    fanTraces.push({
      x: result.times,
      y: upper,
      type: "scatter" as const,
      mode: "lines" as const,
      line: { color: "rgba(33,150,243,0.6)", width: 1, dash: "dash" },
      name: "+1\u03C3",
    });
    fanTraces.push({
      x: result.times,
      y: lower,
      type: "scatter" as const,
      mode: "lines" as const,
      line: { color: "rgba(33,150,243,0.6)", width: 1, dash: "dash" },
      name: "-1\u03C3",
    });
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Parameters ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Model Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Model</span>
            <ToggleGroup options={["Vasicek", "CIR", "Hull-White"]} value={model} onChange={setModel} />
          </div>

          <NumberInput label="Initial Rate (r\u2080)" value={r0} onChange={setR0} step={0.25} suffix="%" />
          <NumberInput
            label={model === "Hull-White" ? "Mean Reversion Speed (a)" : "Mean Reversion Speed (\u03BA)"}
            value={kappa}
            onChange={setKappa}
            min={0.01}
            step={0.1}
          />
          <NumberInput
            label={model === "Hull-White" ? "Long-Run Mean (\u03B8/a)" : "Long-Run Mean (\u03B8)"}
            value={theta}
            onChange={setTheta}
            step={0.25}
            suffix="%"
          />
          <NumberInput label="Volatility (\u03C3)" value={sigma} onChange={setSigma} min={0.01} step={0.1} suffix="%" />
          <NumberInput label="Horizon (years)" value={horizon} onChange={setHorizon} min={0.25} step={1} />
          <NumberInput label="Num Paths" value={nPaths} onChange={setNPaths} min={10} max={5000} step={50} />

          {model === "CIR" && (
            <div className={`rounded border px-3 py-2 text-[10px] ${
              2 * kappa * (theta / 100) >= (sigma / 100) ** 2
                ? "border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                : "border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
            }`}>
              Feller: 2\u03BA\u03B8 = {(2 * kappa * (theta / 100)).toFixed(4)}{" "}
              {2 * kappa * (theta / 100) >= (sigma / 100) ** 2 ? "\u2265" : "<"}{" "}
              \u03C3\u00B2 = {((sigma / 100) ** 2).toFixed(6)}
            </div>
          )}

          <Button onClick={handleSimulate} loading={loading} className="mt-2 w-full">
            Simulate Paths
          </Button>

          {result && (
            <div className="space-y-2 border-t border-[var(--border-color)] pt-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Send to Portfolio
              </p>
              <button
                onClick={() => {
                  // Use terminal mean rate as the risk-free rate assumption
                  const terminalRate = result.mean_rate[result.mean_rate.length - 1];
                  setRateAssumption(terminalRate, `${model} (${(terminalRate * 100).toFixed(2)}%)`);
                  setProfileRate(terminalRate, `${model} (${(terminalRate * 100).toFixed(2)}%)`);
                  setSentRate(true);
                  setTimeout(() => setSentRate(false), 2000);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  sentRate
                    ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)] border border-[var(--accent-green)]/30"
                    : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/25"
                }`}
              >
                {sentRate ? <Check size={12} /> : <Briefcase size={12} />}
                {sentRate
                  ? "Rate Assumption Sent"
                  : `Use Terminal Rate (${(result.mean_rate[result.mean_rate.length - 1] * 100).toFixed(2)}%) as r`}
              </button>
            </div>
          )}

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
            {/* Path fan chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={fanTraces}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: `${model} Short-Rate Paths`, font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Time (years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Rate (%)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "350px" }}
              />
            </div>

            {/* Terminal distribution histogram */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  {
                    x: result.terminal_distribution.map((r) => r * 100),
                    type: "histogram",
                    marker: { color: "rgba(255,152,0,0.7)", line: { color: "#ff9800", width: 0.5 } },
                    name: "Terminal r(T)",
                  } as Plotly.Data,
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: `Terminal Rate Distribution at T=${horizon}y`, font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Rate (%)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Count", font: { size: 10 } } },
                  showlegend: false,
                  bargap: 0.05,
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "250px" }}
              />
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Terminal Mean", value: `${(result.mean_rate[result.mean_rate.length - 1] * 100).toFixed(4)}%` },
                { label: "Terminal Std", value: `${(result.std_rate[result.std_rate.length - 1] * 100).toFixed(4)}%` },
                { label: "Paths Shown", value: `${result.paths.length}` },
                { label: "Time Steps", value: `${result.times.length - 1}` },
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
              <p className="text-sm text-[var(--text-muted)]">Configure parameters and click &quot;Simulate Paths&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Generates short-rate paths with fan chart, mean, and confidence bands
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
