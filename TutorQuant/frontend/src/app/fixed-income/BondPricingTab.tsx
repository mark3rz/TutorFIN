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

interface BondResult {
  dirty_price: number;
  clean_price: number;
  accrued_interest: number;
  ytm: number;
  macaulay_duration: number;
  modified_duration: number;
  convexity: number;
  dv01: number;
  cashflow_times: number[];
  cashflow_amounts: number[];
  n_remaining_coupons: number;
}

export function BondPricingTab() {
  const [faceValue, setFaceValue] = useState(100);
  const [couponRate, setCouponRate] = useState(5.0);
  const [couponFreq, setCouponFreq] = useState("Semi-Annual");
  const [maturityYears, setMaturityYears] = useState(10);
  const [ytm, setYtm] = useState(5.0);
  const [settlementOffset, setSettlementOffset] = useState(0.0);

  const [result, setResult] = useState<BondResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // YTM solver mode
  const [mode, setMode] = useState("Price from YTM");
  const [dirtyPriceInput, setDirtyPriceInput] = useState(100.0);

  const freqMap: Record<string, number> = {
    "Annual": 1,
    "Semi-Annual": 2,
    "Quarterly": 4,
    "Monthly": 12,
  };

  async function handleCompute() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "Price from YTM") {
        const res = await api.bondAnalytics({
          faceValue,
          couponRate: couponRate / 100,
          couponFrequency: freqMap[couponFreq],
          maturityYears,
          ytm: ytm / 100,
          settlementOffset,
        });
        setResult(res);
      } else {
        const res = await api.solveYTM({
          dirtyPrice: dirtyPriceInput,
          faceValue,
          couponRate: couponRate / 100,
          couponFrequency: freqMap[couponFreq],
          maturityYears,
          settlementOffset,
        });
        // Map YTM solver result into same structure for display
        setResult({
          dirty_price: res.dirty_price,
          clean_price: res.clean_price,
          accrued_interest: res.accrued_interest,
          ytm: res.ytm,
          macaulay_duration: res.macaulay_duration,
          modified_duration: res.modified_duration,
          convexity: res.convexity,
          dv01: res.dv01,
          cashflow_times: [],
          cashflow_amounts: [],
          n_remaining_coupons: 0,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Computation failed");
      setResult(null);
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
            Bond Specification
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Mode</span>
            <ToggleGroup options={["Price from YTM", "Solve YTM"]} value={mode} onChange={setMode} />
          </div>

          <NumberInput label="Face Value" value={faceValue} onChange={setFaceValue} min={1} step={100} />
          <NumberInput label="Coupon Rate" value={couponRate} onChange={setCouponRate} min={0} step={0.25} suffix="%" />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Coupon Frequency</span>
            <ToggleGroup options={["Annual", "Semi-Annual", "Quarterly"]} value={couponFreq} onChange={setCouponFreq} />
          </div>

          <NumberInput label="Maturity (years)" value={maturityYears} onChange={setMaturityYears} min={0.25} step={1} />

          {mode === "Price from YTM" ? (
            <NumberInput label="Yield to Maturity" value={ytm} onChange={setYtm} step={0.25} suffix="%" />
          ) : (
            <NumberInput label="Dirty Price (market)" value={dirtyPriceInput} onChange={setDirtyPriceInput} min={0.01} step={0.5} />
          )}

          <NumberInput label="Settlement Offset" value={settlementOffset} onChange={setSettlementOffset} min={0} max={0.99} step={0.1} />

          <Button onClick={handleCompute} loading={loading} className="mt-2 w-full">
            {mode === "Price from YTM" ? "Price Bond" : "Solve YTM"}
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
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Dirty Price</p>
                <p className="font-mono text-xl font-bold text-[var(--accent-primary)]">
                  {result.dirty_price.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Clean Price</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {result.clean_price.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Accrued Interest</p>
                <p className="font-mono text-lg text-[var(--text-secondary)]">
                  {result.accrued_interest.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                <p className="text-[10px] uppercase text-[var(--text-muted)]">YTM</p>
                <p className="font-mono text-xl font-bold text-[var(--accent-green)]">
                  {(result.ytm * 100).toFixed(4)}%
                </p>
              </div>
            </div>

            {/* Risk metrics grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Macaulay Duration", value: result.macaulay_duration, unit: "yrs" },
                { label: "Modified Duration", value: result.modified_duration, unit: "yrs" },
                { label: "Convexity", value: result.convexity, unit: "yrs\u00B2" },
                { label: "DV01", value: result.dv01, unit: "$" },
              ].map(({ label, value, unit }) => (
                <div key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">{label}</p>
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {value.toFixed(4)} <span className="text-[var(--text-muted)] text-[10px]">{unit}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Cash-flow schedule chart */}
            {result.cashflow_times.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[
                    {
                      x: result.cashflow_times,
                      y: result.cashflow_amounts,
                      type: "bar" as const,
                      marker: {
                        color: result.cashflow_amounts.map((cf, i) =>
                          i === result.cashflow_amounts.length - 1 ? "#4caf50" : "#ff9800"
                        ),
                      },
                      name: "Cash Flow",
                    },
                  ]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Cash-Flow Schedule", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Time (years)", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Cash Flow ($)", font: { size: 10 } } },
                    bargap: 0.3,
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "300px" }}
                />
              </div>
            )}

            {/* Clean vs Dirty price explanation */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-2">Price Decomposition</p>
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-[var(--text-primary)]">Dirty ({result.dirty_price.toFixed(4)})</span>
                <span className="text-[var(--text-muted)]">=</span>
                <span className="text-[var(--text-primary)]">Clean ({result.clean_price.toFixed(4)})</span>
                <span className="text-[var(--text-muted)]">+</span>
                <span className="text-[var(--accent-primary)]">AI ({result.accrued_interest.toFixed(4)})</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Configure bond parameters and click &quot;Price Bond&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Computes clean/dirty price, accrued interest, duration, convexity, and DV01
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
