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

interface ParCurveResult {
  tenors: number[];
  par_rates: number[];
}

interface SensitivityResult {
  base_npv: number;
  dv01: number;
  convexity: number;
  par_rate: number;
  rate_bumps: number[];
  npvs: number[];
}

export function SwapCurvesTab() {
  // Par curve inputs
  const [discountRate, setDiscountRate] = useState(4.0);
  const [payFreq, setPayFreq] = useState(2);

  // Sensitivity inputs
  const [notional, setNotional] = useState(1_000_000);
  const [fixedRate, setFixedRate] = useState(4.0);
  const [tenor, setTenor] = useState(5.0);

  const [parCurve, setParCurve] = useState<ParCurveResult | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResult | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComputeAll() {
    setLoading(true);
    setError(null);
    try {
      const [curveRes, sensRes] = await Promise.all([
        api.swapParCurve({
          discountRate: discountRate / 100,
          payFreq,
        }),
        api.swapSensitivity({
          notional,
          fixedRate: fixedRate / 100,
          tenorYears: tenor,
          discountRate: discountRate / 100,
          payFreq,
          recFreq: 4,
        }),
      ]);
      setParCurve(curveRes);
      setSensitivity(sensRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Computation failed");
    } finally {
      setLoading(false);
    }
  }

  // Par curve chart traces
  const curveTraces: Plotly.Data[] = [];
  if (parCurve) {
    curveTraces.push({
      x: parCurve.tenors,
      y: parCurve.par_rates.map((r) => r * 100),
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: "#ff9800", width: 2 },
      marker: { size: 5, color: "#ff9800" },
      name: "Par Swap Rate",
    });
  }

  // Sensitivity chart traces
  const sensTraces: Plotly.Data[] = [];
  if (sensitivity) {
    sensTraces.push({
      x: sensitivity.rate_bumps,
      y: sensitivity.npvs,
      type: "scatter" as const,
      mode: "lines+markers" as const,
      line: { color: "#2196f3", width: 2 },
      marker: { size: 4 },
      name: "NPV Profile",
    });
    // Zero line
    sensTraces.push({
      x: [sensitivity.rate_bumps[0], sensitivity.rate_bumps[sensitivity.rate_bumps.length - 1]],
      y: [0, 0],
      type: "scatter" as const,
      mode: "lines" as const,
      line: { color: "rgba(255,255,255,0.2)", width: 1, dash: "dash" },
      showlegend: false,
    });
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full">
      {/* Input controls */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
        <NumberInput
          label="Discount Rate"
          value={discountRate}
          onChange={setDiscountRate}
          step={0.25}
          suffix="%"
        />
        <NumberInput
          label="Pay Freq"
          value={payFreq}
          onChange={setPayFreq}
          step={1}
          min={1}
          max={12}
        />
        <NumberInput
          label="Notional"
          value={notional}
          onChange={setNotional}
          step={100000}
          min={1000}
        />
        <NumberInput
          label="Fixed Rate"
          value={fixedRate}
          onChange={setFixedRate}
          step={0.25}
          suffix="%"
        />
        <NumberInput
          label="Tenor"
          value={tenor}
          onChange={setTenor}
          step={1}
          suffix="y"
        />
        <Button onClick={handleComputeAll} loading={loading}>
          Compute
        </Button>
        {error && (
          <span className="text-xs text-[var(--accent-red)]">{error}</span>
        )}
      </div>

      {/* Sensitivity summary */}
      {sensitivity && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Base NPV", value: `$${sensitivity.base_npv.toLocaleString()}` },
            { label: "DV01", value: `$${sensitivity.dv01.toLocaleString()}` },
            { label: "Convexity", value: sensitivity.convexity.toFixed(2) },
            {
              label: "Par Rate",
              value: `${(sensitivity.par_rate * 100).toFixed(4)}%`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {item.label}
              </p>
              <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {parCurve && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={curveTraces}
              layout={{
                ...DARK_LAYOUT,
                title: {
                  text: "Par Swap Rate Curve",
                  font: { size: 12, color: "#e0e0e0" },
                },
                xaxis: {
                  ...DARK_LAYOUT.xaxis,
                  title: { text: "Tenor (years)", font: { size: 10 } },
                },
                yaxis: {
                  ...DARK_LAYOUT.yaxis,
                  title: { text: "Par Rate (%)", font: { size: 10 } },
                },
              }}
              style={{ width: "100%", height: "350px" }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
        )}
        {sensitivity && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={sensTraces}
              layout={{
                ...DARK_LAYOUT,
                title: {
                  text: "NPV Sensitivity to Rate Bumps",
                  font: { size: 12, color: "#e0e0e0" },
                },
                xaxis: {
                  ...DARK_LAYOUT.xaxis,
                  title: { text: "Rate Bump (bps)", font: { size: 10 } },
                },
                yaxis: {
                  ...DARK_LAYOUT.yaxis,
                  title: { text: "NPV ($)", font: { size: 10 } },
                },
              }}
              style={{ width: "100%", height: "350px" }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
