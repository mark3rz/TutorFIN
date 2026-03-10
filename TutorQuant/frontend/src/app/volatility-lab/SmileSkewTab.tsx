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

const COLORS = ["#ff9800", "#2196f3", "#4caf50", "#e91e63", "#9c27b0", "#00bcd4"];

interface SmileData {
  expiry_years: number;
  strikes: number[];
  implied_vols: number[];
  moneyness: number[];
  spot: number;
}

export function SmileSkewTab() {
  const [spot, setSpot] = useState(100);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [baseVol, setBaseVol] = useState(20.0);
  const [skewSlope, setSkewSlope] = useState(-10.0);
  const [smileCurvature, setSmileCurvature] = useState(5.0);
  const [termSlope, setTermSlope] = useState(2.0);

  const [slices, setSlices] = useState<SmileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expiries = [0.083, 0.25, 0.5, 1.0, 2.0];

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const results: SmileData[] = [];
      for (const T of expiries) {
        const res = await api.smileSlice({
          spot,
          riskFreeRate: riskFreeRate / 100,
          dividendYield: dividendYield / 100,
          expiryYears: T,
          baseVol: baseVol / 100,
          skewSlope: skewSlope / 100,
          smileCurvature: smileCurvature / 100,
          termSlope: termSlope / 100,
        });
        results.push(res);
      }
      setSlices(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate smile");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount
  useEffect(() => { handleGenerate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plotTraces: Plotly.Data[] = slices.map((s, i) => ({
    x: s.strikes,
    y: s.implied_vols.map(v => v * 100),
    type: "scatter" as const,
    mode: "lines+markers" as const,
    line: { color: COLORS[i % COLORS.length], width: 2 },
    marker: { size: 4 },
    name: `T = ${s.expiry_years}y`,
  }));

  const moneyTraces: Plotly.Data[] = slices.map((s, i) => ({
    x: s.moneyness,
    y: s.implied_vols.map(v => v * 100),
    type: "scatter" as const,
    mode: "lines+markers" as const,
    line: { color: COLORS[i % COLORS.length], width: 2 },
    marker: { size: 4 },
    name: `T = ${s.expiry_years}y`,
  }));

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Smile Parameters
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
            Generate Smile
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
        {slices.length > 0 ? (
          <>
            {/* By strike */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={plotTraces}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Implied Volatility Smile by Strike", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Strike", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "IV (%)", font: { size: 10 } } },
                  shapes: [{
                    type: "line", x0: spot, x1: spot, y0: 0, y1: 1, yref: "paper",
                    line: { color: "#555577", width: 1, dash: "dash" },
                  }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "350px" }}
              />
            </div>

            {/* By moneyness */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={moneyTraces}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Implied Volatility Smile by Moneyness (S/K)", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Moneyness (S/K)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "IV (%)", font: { size: 10 } } },
                  shapes: [{
                    type: "line", x0: 1, x1: 1, y0: 0, y1: 1, yref: "paper",
                    line: { color: "#555577", width: 1, dash: "dash" },
                  }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "350px" }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Adjust parameters and click &quot;Generate Smile&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Smile / skew curves at multiple expiries will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
