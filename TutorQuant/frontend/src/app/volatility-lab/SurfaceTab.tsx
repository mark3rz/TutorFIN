"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface SurfacePoint {
  strike: number;
  expiry_years: number;
  implied_vol: number;
  market_price: number;
  option_type: string;
  moneyness: number;
  log_moneyness: number;
}

interface SurfaceResult {
  spot: number;
  risk_free_rate: number;
  dividend_yield: number;
  expiries: number[];
  strikes: number[];
  surface: SurfacePoint[];
}

export function SurfaceTab() {
  const [spot, setSpot] = useState(100);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [baseVol, setBaseVol] = useState(20.0);
  const [skewSlope, setSkewSlope] = useState(-10.0);
  const [smileCurvature, setSmileCurvature] = useState(5.0);
  const [termSlope, setTermSlope] = useState(2.0);

  const [result, setResult] = useState<SurfaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.demoSurface({
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
      setError(err instanceof Error ? err.message : "Surface generation failed");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount
  useEffect(() => { handleGenerate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build 3D surface data
  let surfaceData: Plotly.Data[] = [];
  if (result) {
    const { expiries, strikes, surface } = result;
    // Create z-matrix: rows = expiries, cols = strikes
    const z: number[][] = [];
    for (const T of expiries) {
      const row: number[] = [];
      for (const K of strikes) {
        const pt = surface.find(p => p.expiry_years === T && p.strike === K);
        row.push(pt ? pt.implied_vol * 100 : 0);
      }
      z.push(row);
    }

    surfaceData = [{
      x: strikes,
      y: expiries,
      z: z,
      type: "surface" as const,
      colorscale: [
        [0, "#1a237e"],
        [0.25, "#1565c0"],
        [0.5, "#2e7d32"],
        [0.75, "#ff9800"],
        [1, "#d32f2f"],
      ],
      colorbar: {
        title: { text: "IV (%)", font: { size: 10, color: "#e0e0e0" } },
        tickfont: { size: 9, color: "#e0e0e0" },
      },
      contours: {
        z: { show: true, usecolormap: true, highlightcolor: "#ffffff", project: { z: false } },
      },
      hovertemplate: "Strike: %{x}<br>Expiry: %{y:.3f}y<br>IV: %{z:.2f}%<extra></extra>",
    } as Plotly.Data];
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ─────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Surface Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Risk-Free Rate (r)" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Dividend Yield (q)" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />

          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Parametric Model</p>
            <div className="flex flex-col gap-3">
              <NumberInput label="Base ATM Vol" value={baseVol} onChange={setBaseVol} min={1} max={100} step={1} suffix="%" />
              <NumberInput label="Skew Slope" value={skewSlope} onChange={setSkewSlope} min={-50} max={50} step={1} suffix="%" />
              <NumberInput label="Smile Curvature" value={smileCurvature} onChange={setSmileCurvature} min={0} max={50} step={1} suffix="%" />
              <NumberInput label="Term Slope" value={termSlope} onChange={setTermSlope} min={-20} max={20} step={0.5} suffix="%" />
            </div>
          </div>

          <Button onClick={handleGenerate} loading={loading} className="mt-2 w-full">
            Generate Surface
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: 3D Surface ───────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Summary */}
            <div className="flex items-center gap-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-3">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Spot</p>
                <p className="font-mono text-lg font-bold text-[var(--accent-primary)]">{result.spot}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Expiries</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.expiries.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Strikes</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.strikes.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Points</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.surface.length}</p>
              </div>
            </div>

            {/* 3D Surface Plot */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={surfaceData}
                layout={{
                  paper_bgcolor: "#0e0e14",
                  plot_bgcolor: "#141420",
                  font: { color: "#e0e0e0", family: "monospace", size: 11 },
                  margin: { l: 0, r: 0, t: 40, b: 0 },
                  title: { text: "Implied Volatility Surface", font: { size: 14, color: "#e0e0e0" } },
                  scene: {
                    xaxis: { title: { text: "Strike" }, gridcolor: "#1e1e3a", backgroundcolor: "#0e0e14" },
                    yaxis: { title: { text: "Expiry (years)" }, gridcolor: "#1e1e3a", backgroundcolor: "#0e0e14" },
                    zaxis: { title: { text: "IV (%)" }, gridcolor: "#1e1e3a", backgroundcolor: "#0e0e14" },
                    bgcolor: "#0e0e14",
                    camera: { eye: { x: 1.5, y: -1.5, z: 0.8 } },
                  },
                }}
                config={{ responsive: true, displayModeBar: true }}
                useResizeHandler
                style={{ width: "100%", height: "500px" }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Adjust parameters and click &quot;Generate Surface&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                A 3D implied volatility surface will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
