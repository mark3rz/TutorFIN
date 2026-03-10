"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";

/* ── Dynamic Plotly import (SSR disabled) ─────────────────────────── */
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ── Plotly theme constants ───────────────────────────────────────── */
const PLOTLY_LAYOUT_BASE: Partial<Plotly.Layout> = {
  paper_bgcolor: "#0e0e14",
  plot_bgcolor: "#141420",
  font: { color: "#e0e0e0", family: "monospace", size: 11 },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: {
    gridcolor: "#1e1e3a",
    zerolinecolor: "#1e1e3a",
    title: { text: "Spot Price at Expiration", font: { size: 11 } },
  },
  yaxis: {
    gridcolor: "#1e1e3a",
    zerolinecolor: "#555577",
    zerolinewidth: 1,
    title: { text: "Profit / Loss", font: { size: 11 } },
  },
  showlegend: true,
  legend: {
    bgcolor: "transparent",
    font: { size: 10 },
    x: 0.01,
    y: 0.99,
  },
};

/* ── Payoff calculation ───────────────────────────────────────────── */

function computePayoffs(
  strike: number,
  premium: number,
  optionType: "Call" | "Put",
  spotMin: number,
  spotMax: number,
  numPoints: number = 200,
) {
  const spots: number[] = [];
  const longPayoff: number[] = [];
  const shortPayoff: number[] = [];
  const step = (spotMax - spotMin) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const s = spotMin + i * step;
    spots.push(s);

    let intrinsic: number;
    if (optionType === "Call") {
      intrinsic = Math.max(s - strike, 0);
    } else {
      intrinsic = Math.max(strike - s, 0);
    }

    longPayoff.push(intrinsic - premium);
    shortPayoff.push(premium - intrinsic);
  }

  return { spots, longPayoff, shortPayoff };
}

/* ── Component ────────────────────────────────────────────────────── */

export function PayoffTab() {
  const [strike, setStrike] = useState(100);
  const [premium, setPremium] = useState(10.0);
  const [optionType, setOptionType] = useState<string>("Call");
  const [spotMin, setSpotMin] = useState(50);
  const [spotMax, setSpotMax] = useState(150);

  /* Recompute payoff data whenever inputs change */
  const { spots, longPayoff, shortPayoff } = useMemo(
    () =>
      computePayoffs(
        strike,
        premium,
        optionType as "Call" | "Put",
        spotMin,
        spotMax,
      ),
    [strike, premium, optionType, spotMin, spotMax],
  );

  /* Breakeven calculation */
  const breakeven =
    optionType === "Call" ? strike + premium : strike - premium;

  /* Plotly traces */
  const traces: Plotly.Data[] = [
    {
      x: spots,
      y: longPayoff,
      type: "scatter" as const,
      mode: "lines" as const,
      name: `Long ${optionType}`,
      line: { color: "#ff9800", width: 2 },
    },
    {
      x: spots,
      y: shortPayoff,
      type: "scatter" as const,
      mode: "lines" as const,
      name: `Short ${optionType}`,
      line: { color: "#4488ff", width: 2, dash: "dot" },
    },
  ];

  /* Annotations & shapes */
  const shapes: Partial<Plotly.Shape>[] = [
    // Strike price vertical dashed line
    {
      type: "line",
      x0: strike,
      x1: strike,
      y0: 0,
      y1: 1,
      yref: "paper",
      line: { color: "#555577", width: 1, dash: "dash" },
    },
    // Zero profit horizontal line
    {
      type: "line",
      x0: spotMin,
      x1: spotMax,
      y0: 0,
      y1: 0,
      line: { color: "#555577", width: 1 },
    },
  ];

  const annotations: Partial<Plotly.Annotations>[] = [
    {
      x: strike,
      y: 1.02,
      yref: "paper",
      text: `K = ${strike}`,
      showarrow: false,
      font: { color: "#8888aa", size: 10 },
    },
    {
      x: breakeven,
      y: 0,
      text: `BE = ${breakeven.toFixed(2)}`,
      showarrow: true,
      arrowhead: 2,
      arrowsize: 0.8,
      arrowcolor: "#ff9800",
      ax: 0,
      ay: -30,
      font: { color: "#ff9800", size: 10 },
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    ...PLOTLY_LAYOUT_BASE,
    title: {
      text: `${optionType} Option Payoff at Expiration`,
      font: { size: 13, color: "#e0e0e0" },
    },
    shapes,
    annotations,
  };

  /* ================================================================ */
  return (
    <div className="flex flex-1 gap-4 overflow-hidden">
      {/* ── LEFT: Input Panel ──────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Payoff Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput
            label="Strike Price (K)"
            value={strike}
            onChange={(v) => {
              setStrike(v);
              setSpotMin(Math.round(v * 0.5));
              setSpotMax(Math.round(v * 1.5));
            }}
            min={0.01}
            step={1}
          />
          <NumberInput
            label="Option Premium"
            value={premium}
            onChange={setPremium}
            min={0}
            step={0.5}
          />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Option Type
            </span>
            <ToggleGroup
              options={["Call", "Put"]}
              value={optionType}
              onChange={setOptionType}
            />
          </div>

          <div className="mt-2 border-t border-[var(--border-color)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Spot Range
            </p>
            <div className="flex gap-2">
              <NumberInput
                label="Min"
                value={spotMin}
                onChange={setSpotMin}
                min={0.01}
                step={5}
              />
              <NumberInput
                label="Max"
                value={spotMax}
                onChange={setSpotMax}
                min={0.01}
                step={5}
              />
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-3 space-y-1.5 border-t border-[var(--border-color)] pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Key Levels
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Breakeven</span>
              <span className="font-mono text-[var(--accent-primary)]">
                {breakeven.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Max Profit (Long)</span>
              <span className="font-mono text-[var(--accent-green)]">
                {optionType === "Call" ? "Unlimited" : (strike - premium).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Max Loss (Long)</span>
              <span className="font-mono text-[var(--accent-red)]">
                -{premium.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER: Chart ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
          <Plot
            data={traces}
            layout={layout}
            config={{
              responsive: true,
              displayModeBar: true,
              displaylogo: false,
              modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
            }}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Payoff Table */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Payoff at Key Spot Levels
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="py-1.5 text-left font-medium text-[var(--text-muted)]">Spot</th>
                  <th className="py-1.5 text-right font-medium text-[var(--text-muted)]">Long P/L</th>
                  <th className="py-1.5 text-right font-medium text-[var(--text-muted)]">Short P/L</th>
                </tr>
              </thead>
              <tbody>
                {[0.7, 0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2, 1.3].map((pct) => {
                  const s = Math.round(strike * pct);
                  const intrinsic =
                    optionType === "Call"
                      ? Math.max(s - strike, 0)
                      : Math.max(strike - s, 0);
                  const longPl = intrinsic - premium;
                  const shortPl = premium - intrinsic;
                  return (
                    <tr key={pct} className="border-b border-[var(--border-color)]/30">
                      <td className="py-1 font-mono text-[var(--text-primary)]">
                        {s}
                      </td>
                      <td
                        className={`py-1 text-right font-mono ${
                          longPl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                        }`}
                      >
                        {longPl.toFixed(2)}
                      </td>
                      <td
                        className={`py-1 text-right font-mono ${
                          shortPl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                        }`}
                      >
                        {shortPl.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
