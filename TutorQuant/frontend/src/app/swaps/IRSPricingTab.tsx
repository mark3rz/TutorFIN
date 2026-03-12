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

interface SwapResult {
  npv: number;
  fixed_leg_pv: number;
  float_leg_pv: number;
  par_rate: number;
  fixed_cashflows: {
    time: number;
    tau: number;
    amount: number;
    df: number;
    pv: number;
  }[];
  float_cashflows: {
    time: number;
    tau: number;
    forward_rate: number;
    spread: number;
    all_in_rate: number;
    amount: number;
    df: number;
    pv: number;
  }[];
  annuity: number;
  dv01: number;
  notional: number;
  tenor_years: number;
  fixed_rate: number;
  is_payer: boolean;
}

export function IRSPricingTab() {
  const [notional, setNotional] = useState(1_000_000);
  const [fixedRate, setFixedRate] = useState(4.0);
  const [tenor, setTenor] = useState(5.0);
  const [discountRate, setDiscountRate] = useState(4.0);
  const [payFreq, setPayFreq] = useState(2);
  const [recFreq, setRecFreq] = useState(4);
  const [floatSpread, setFloatSpread] = useState(0);
  const [direction, setDirection] = useState("Payer");

  const [result, setResult] = useState<SwapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePrice() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.priceSwap({
        notional,
        fixedRate: fixedRate / 100,
        tenorYears: tenor,
        discountRate: discountRate / 100,
        payFreq,
        recFreq,
        floatSpread: floatSpread / 10000,
        isPayer: direction === "Payer",
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Pricing failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Build cashflow waterfall chart
  const cfTraces: Plotly.Data[] = [];
  if (result) {
    // Fixed leg cashflows (negative for payer)
    const fixedSign = result.is_payer ? -1 : 1;
    cfTraces.push({
      x: result.fixed_cashflows.map((c) => c.time),
      y: result.fixed_cashflows.map((c) => fixedSign * c.amount),
      type: "bar" as const,
      name: "Fixed Leg",
      marker: { color: "#f44336" },
      opacity: 0.8,
    });

    // Floating leg cashflows (positive for payer)
    const floatSign = result.is_payer ? 1 : -1;
    cfTraces.push({
      x: result.float_cashflows.map((c) => c.time),
      y: result.float_cashflows.map((c) => floatSign * c.amount),
      type: "bar" as const,
      name: "Floating Leg",
      marker: { color: "#4caf50" },
      opacity: 0.8,
    });
  }

  // PV waterfall
  const pvTraces: Plotly.Data[] = [];
  if (result) {
    const fixedSign = result.is_payer ? -1 : 1;
    const floatSign = result.is_payer ? 1 : -1;

    pvTraces.push({
      x: result.fixed_cashflows.map((c) => c.time),
      y: result.fixed_cashflows.map((c) => fixedSign * c.pv),
      type: "bar" as const,
      name: "Fixed PV",
      marker: { color: "rgba(244,67,54,0.6)" },
    });
    pvTraces.push({
      x: result.float_cashflows.map((c) => c.time),
      y: result.float_cashflows.map((c) => floatSign * c.pv),
      type: "bar" as const,
      name: "Float PV",
      marker: { color: "rgba(76,175,80,0.6)" },
    });
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full">
      {/* Input controls */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
        <ToggleGroup
          options={["Payer", "Receiver"]}
          value={direction}
          onChange={setDirection}
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
          min={0.5}
        />
        <NumberInput
          label="Discount Rate"
          value={discountRate}
          onChange={setDiscountRate}
          step={0.25}
          suffix="%"
        />
        <NumberInput
          label="Fixed Freq"
          value={payFreq}
          onChange={setPayFreq}
          step={1}
          min={1}
          max={12}
        />
        <NumberInput
          label="Float Freq"
          value={recFreq}
          onChange={setRecFreq}
          step={1}
          min={1}
          max={12}
        />
        <NumberInput
          label="Float Spread"
          value={floatSpread}
          onChange={setFloatSpread}
          step={1}
          suffix="bps"
        />
        <Button onClick={handlePrice} loading={loading}>
          Price
        </Button>
        {error && (
          <span className="text-xs text-[var(--accent-red)]">{error}</span>
        )}
      </div>

      {/* Results summary */}
      {result && (
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "NPV", value: `$${result.npv.toLocaleString()}` },
            {
              label: "Fixed Leg PV",
              value: `$${result.fixed_leg_pv.toLocaleString()}`,
            },
            {
              label: "Float Leg PV",
              value: `$${result.float_leg_pv.toLocaleString()}`,
            },
            {
              label: "Par Rate",
              value: `${(result.par_rate * 100).toFixed(4)}%`,
            },
            { label: "Annuity", value: result.annuity.toFixed(4) },
            { label: "DV01", value: `$${result.dv01.toLocaleString()}` },
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
      {result && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={cfTraces}
              layout={{
                ...DARK_LAYOUT,
                title: {
                  text: "Cash Flow Schedule",
                  font: { size: 12, color: "#e0e0e0" },
                },
                xaxis: {
                  ...DARK_LAYOUT.xaxis,
                  title: { text: "Time (years)", font: { size: 10 } },
                },
                yaxis: {
                  ...DARK_LAYOUT.yaxis,
                  title: { text: "Cash Flow ($)", font: { size: 10 } },
                },
                barmode: "group",
              }}
              style={{ width: "100%", height: "320px" }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
            <Plot
              data={pvTraces}
              layout={{
                ...DARK_LAYOUT,
                title: {
                  text: "Present Value Waterfall",
                  font: { size: 12, color: "#e0e0e0" },
                },
                xaxis: {
                  ...DARK_LAYOUT.xaxis,
                  title: { text: "Time (years)", font: { size: 10 } },
                },
                yaxis: {
                  ...DARK_LAYOUT.yaxis,
                  title: { text: "PV ($)", font: { size: 10 } },
                },
                barmode: "group",
              }}
              style={{ width: "100%", height: "320px" }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
