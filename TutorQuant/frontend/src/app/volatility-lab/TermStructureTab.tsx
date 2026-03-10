"use client";

import { useState, useEffect } from "react";
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

interface TermData {
  expiries: number[];
  atm_vols: number[];
  spot: number;
}

export function TermStructureTab() {
  const [spot, setSpot] = useState(100);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [baseVol, setBaseVol] = useState(20.0);
  const [skewSlope, setSkewSlope] = useState(-10.0);
  const [smileCurvature, setSmileCurvature] = useState(5.0);
  const [termSlope, setTermSlope] = useState(2.0);

  const [result, setResult] = useState<TermData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.termStructure({
        spot,
        riskFreeRate: riskFreeRate / 100,
        dividendYield: dividendYield / 100,
        baseVol: baseVol / 100,
        skewSlope: skewSlope / 100,
        smileCurvature: smileCurvature / 100,
        termSlope: termSlope / 100,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Term structure failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { handleGenerate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expiry labels
  const expiryLabels = (expiries: number[]) =>
    expiries.map(t => {
      if (t < 1 / 12 + 0.001) return `${Math.round(t * 365)}d`;
      if (t < 1) return `${Math.round(t * 12)}m`;
      return `${t}y`;
    });

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Term Structure Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Risk-Free Rate (r)" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Dividend Yield (q)" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />

          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Surface Model</p>
            <div className="flex flex-col gap-3">
              <NumberInput label="Base ATM Vol" value={baseVol} onChange={setBaseVol} min={1} max={100} step={1} suffix="%" />
              <NumberInput label="Skew Slope" value={skewSlope} onChange={setSkewSlope} min={-50} max={50} step={1} suffix="%" />
              <NumberInput label="Smile Curvature" value={smileCurvature} onChange={setSmileCurvature} min={0} max={50} step={1} suffix="%" />
              <NumberInput label="Term Slope" value={termSlope} onChange={setTermSlope} min={-20} max={20} step={0.5} suffix="%" />
            </div>
          </div>

          <Button onClick={handleGenerate} loading={loading} className="mt-2 w-full">
            Generate Term Structure
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Chart ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-3">
              {result.expiries.map((T, i) => {
                const labels = expiryLabels(result.expiries);
                return (
                  <div key={T} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-center">
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">{labels[i]}</p>
                    <p className="font-mono text-lg font-bold text-[var(--accent-primary)]">
                      {(result.atm_vols[i] * 100).toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Term Structure line chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  {
                    x: result.expiries,
                    y: result.atm_vols.map(v => v * 100),
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    line: { color: "#ff9800", width: 3, shape: "spline" },
                    marker: { size: 8, color: "#ff9800" },
                    name: "ATM IV",
                    fill: "tozeroy" as const,
                    fillcolor: "rgba(255, 152, 0, 0.08)",
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "ATM Implied Volatility Term Structure", font: { size: 13, color: "#e0e0e0" } },
                  xaxis: {
                    ...DARK_LAYOUT.xaxis,
                    title: { text: "Time to Expiry (years)", font: { size: 10 } },
                    tickvals: result.expiries,
                    ticktext: expiryLabels(result.expiries),
                  },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "ATM IV (%)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "350px" }}
              />
            </div>

            {/* Forward vol bar chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  {
                    x: result.expiries.slice(1).map((_, i) => {
                      const labels = expiryLabels(result.expiries);
                      return `${labels[i]} → ${labels[i + 1]}`;
                    }),
                    y: result.expiries.slice(1).map((T2, i) => {
                      const T1 = result.expiries[i];
                      const v1 = result.atm_vols[i];
                      const v2 = result.atm_vols[i + 1];
                      // Forward variance: sigma_f^2 = (v2^2 * T2 - v1^2 * T1) / (T2 - T1)
                      const fwdVar = (v2 * v2 * T2 - v1 * v1 * T1) / (T2 - T1);
                      return fwdVar > 0 ? Math.sqrt(fwdVar) * 100 : 0;
                    }),
                    type: "bar" as const,
                    marker: { color: "#2196f3" },
                    name: "Forward Vol",
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Forward Implied Volatility", font: { size: 13, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Period", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Forward Vol (%)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "300px" }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Adjust parameters and click &quot;Generate Term Structure&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                ATM vol term structure and forward vols will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
