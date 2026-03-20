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

interface DualCurveResult {
  npv: number;
  fixed_leg_pv: number;
  float_leg_pv: number;
  par_rate: number;
  single_curve_npv: number;
  single_curve_par_rate: number;
  basis_adjustment: number;
  projection_rate: number;
  discount_rate: number;
}

interface OISConcept {
  concept: string;
  description: string;
}

export function OISDiscountingTab() {
  const [notional, setNotional] = useState(1_000_000);
  const [fixedRate, setFixedRate] = useState(4.0);
  const [tenor, setTenor] = useState(5.0);
  const [projRate, setProjRate] = useState(4.5);
  const [discRate, setDiscRate] = useState(4.0);

  const [result, setResult] = useState<DualCurveResult | null>(null);
  const [concepts, setConcepts] = useState<OISConcept[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getOISConcepts().then(setConcepts).catch(() => {});
  }, []);

  async function handlePrice() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.priceDualCurve({
        notional,
        fixedRate: fixedRate / 100,
        tenorYears: tenor,
        projectionRate: projRate / 100,
        discountRate: discRate / 100,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Pricing failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Comparison bar chart
  const compTraces: Plotly.Data[] = [];
  if (result) {
    compTraces.push({
      x: ["NPV", "Par Rate (%)"],
      y: [result.single_curve_npv, result.single_curve_par_rate * 100],
      type: "bar" as const,
      name: "Single Curve",
      marker: { color: "#ff9800" },
    });
    compTraces.push({
      x: ["NPV", "Par Rate (%)"],
      y: [result.npv, result.par_rate * 100],
      type: "bar" as const,
      name: "Dual Curve (OIS)",
      marker: { color: "#2196f3" },
    });
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full">
      {/* Input controls */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
        <NumberInput
          label="Notional"
          value={notional}
          onChange={setNotional}
          step={100000}
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
        <NumberInput
          label="Projection Rate"
          value={projRate}
          onChange={setProjRate}
          step={0.25}
          suffix="%"
        />
        <NumberInput
          label="OIS Discount Rate"
          value={discRate}
          onChange={setDiscRate}
          step={0.25}
          suffix="%"
        />
        <Button onClick={handlePrice} loading={loading}>
          Compare
        </Button>
        {error && (
          <span className="text-xs text-[var(--accent-red)]">{error}</span>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Basis Adjustment",
                value: `$${result.basis_adjustment.toLocaleString()}`,
                sub: "Dual − Single curve NPV",
              },
              {
                label: "Single Curve NPV",
                value: `$${result.single_curve_npv.toLocaleString()}`,
                sub: `Par: ${(result.single_curve_par_rate * 100).toFixed(4)}%`,
              },
              {
                label: "Dual Curve NPV",
                value: `$${result.npv.toLocaleString()}`,
                sub: `Par: ${(result.par_rate * 100).toFixed(4)}%`,
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
                <p className="text-[10px] text-[var(--text-muted)]">
                  {item.sub}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={compTraces}
              layout={{
                ...DARK_LAYOUT,
                title: {
                  text: "Single Curve vs Dual Curve (OIS Discounting)",
                  font: { size: 12, color: "#e0e0e0" },
                },
                barmode: "group",
                yaxis: {
                  ...DARK_LAYOUT.yaxis,
                  title: { text: "Value", font: { size: 10 } },
                },
              }}
              style={{ width: "100%", height: "320px" }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
        </>
      )}

      {/* OIS Concepts */}
      {concepts.length > 0 && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)] mb-3">
            OIS Discounting Concepts
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {concepts.map((c) => (
              <div key={c.concept} className="border-b border-[var(--border-color)] pb-2 last:border-b-0">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {c.concept}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {c.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
