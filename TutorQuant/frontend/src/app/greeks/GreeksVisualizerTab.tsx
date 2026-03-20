"use client";

import { useState, useMemo, useCallback } from "react";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { GreekCard } from "./GreekCard";
import { GREEK_CONFIGS } from "@/lib/greeksConfig";
import type { OptionState } from "@/lib/greeksEngine";
import { generateGreekCurve, computeAllGreeks, bsmPrice } from "@/lib/greeksEngine";
import { useWorkbench, generateWorkbenchId } from "@/context/WorkbenchContext";
import { Briefcase, Check } from "lucide-react";

// ── Slider component (inline, matches design system) ────────────────────────

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  displayMultiplier?: number;
  displayPrecision?: number;
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix = "",
  displayMultiplier = 1,
  displayPrecision = 2,
}: SliderInputProps) {
  const displayVal = (value * displayMultiplier).toFixed(displayPrecision);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </label>
        <span className="font-mono text-xs text-[var(--text-primary)]">
          {displayVal}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="greek-slider w-full"
      />
    </div>
  );
}

// ── Current Greek values summary ────────────────────────────────────────────

function GreeksSummary({ state }: { state: OptionState }) {
  const greeks = useMemo(
    () =>
      computeAllGreeks(
        state.spot,
        state.strike,
        state.expiryYears,
        state.riskFreeRate,
        state.volatility,
        state.dividendYield,
        state.optionType === "call",
      ),
    [state],
  );

  const summaryItems = [
    { label: "Δ Delta", value: greeks.delta, precision: 4 },
    { label: "Γ Gamma", value: greeks.gamma, precision: 4 },
    { label: "Θ Theta", value: greeks.theta, precision: 4 },
    { label: "ν Vega", value: greeks.vega, precision: 4 },
    { label: "ρ Rho", value: greeks.rho, precision: 4 },
  ];

  return (
    <div className="border-t border-[var(--border-color)] pt-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Current Values
      </p>
      <div className="grid grid-cols-1 gap-1">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">{item.label}</span>
            <span className="font-mono text-xs text-[var(--text-primary)]">
              {item.value.toFixed(item.precision)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function GreeksVisualizerTab() {
  // Shared option state
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiryYears, setExpiryYears] = useState(1.0);
  const [riskFreeRate, setRiskFreeRate] = useState(0.05);
  const [volatility, setVolatility] = useState(0.20);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");
  const [model, setModel] = useState<string>("Black-Scholes");
  const [sent, setSent] = useState(false);

  const { addOption } = useWorkbench();

  const optionState: OptionState = useMemo(
    () => ({
      spot,
      strike,
      expiryYears,
      riskFreeRate,
      volatility,
      dividendYield,
      optionType: optionType === "Call" ? "call" : "put",
    }),
    [spot, strike, expiryYears, riskFreeRate, volatility, dividendYield, optionType],
  );

  // Generate curve data for a single Greek
  const getCurveData = useCallback(
    (key: typeof GREEK_CONFIGS[number]["key"]) => {
      const config = GREEK_CONFIGS.find((c) => c.key === key)!;
      const xValues = config.getXRange(optionState);
      return generateGreekCurve(optionState, config.key, config.xVariable, xValues);
    },
    [optionState],
  );

  // Memoize all curve data
  const allCurves = useMemo(() => {
    const curves: Record<string, { x: number[]; y: number[] }> = {};
    for (const config of GREEK_CONFIGS) {
      curves[config.key] = getCurveData(config.key);
    }
    return curves;
  }, [getCurveData]);

  // Current point marker value for each Greek
  const currentGreeks = useMemo(
    () =>
      computeAllGreeks(
        optionState.spot,
        optionState.strike,
        optionState.expiryYears,
        optionState.riskFreeRate,
        optionState.volatility,
        optionState.dividendYield,
        optionState.optionType === "call",
      ),
    [optionState],
  );

  // Current x-value for the marker on each graph
  const currentXValues: Record<string, number> = useMemo(
    () => ({
      spot: optionState.spot,
      expiryYears: optionState.expiryYears,
      volatility: optionState.volatility,
      riskFreeRate: optionState.riskFreeRate,
    }),
    [optionState],
  );

  const isBSM = model === "Black-Scholes";

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Control Panel ──────────────────────────────────── */}
      <div className="w-[240px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Option Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3.5 p-4">
          {/* Option Type */}
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

          {/* Model */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Pricing Model
            </span>
            <ToggleGroup
              options={["Black-Scholes", "Binomial"]}
              value={model}
              onChange={setModel}
            />
            {!isBSM && (
              <p className="text-[9px] text-[var(--accent-primary)]">
                Binomial: first-order Greeks via finite difference. Higher-order Greeks approximate BSM.
              </p>
            )}
          </div>

          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Market Data
            </p>
          </div>

          {/* Spot */}
          <SliderInput
            label="Spot Price (S)"
            value={spot}
            onChange={setSpot}
            min={10}
            max={200}
            step={1}
          />

          {/* Strike */}
          <SliderInput
            label="Strike Price (K)"
            value={strike}
            onChange={setStrike}
            min={10}
            max={200}
            step={1}
          />

          {/* Time to Expiry */}
          <SliderInput
            label="Time to Expiry (T)"
            value={expiryYears}
            onChange={setExpiryYears}
            min={0.01}
            max={3.0}
            step={0.01}
            suffix=" yr"
          />

          {/* Volatility */}
          <SliderInput
            label="Volatility (σ)"
            value={volatility}
            onChange={setVolatility}
            min={0.01}
            max={1.0}
            step={0.01}
            displayMultiplier={100}
            displayPrecision={0}
            suffix="%"
          />

          {/* Risk-Free Rate */}
          <SliderInput
            label="Risk-Free Rate (r)"
            value={riskFreeRate}
            onChange={setRiskFreeRate}
            min={0.0}
            max={0.15}
            step={0.005}
            displayMultiplier={100}
            displayPrecision={1}
            suffix="%"
          />

          {/* Dividend Yield */}
          <SliderInput
            label="Dividend Yield (q)"
            value={dividendYield}
            onChange={setDividendYield}
            min={0.0}
            max={0.10}
            step={0.005}
            displayMultiplier={100}
            displayPrecision={1}
            suffix="%"
          />

          {/* Current Greek values summary */}
          <GreeksSummary state={optionState} />

          {/* Send to Portfolio */}
          <div className="border-t border-[var(--border-color)] pt-3">
            <button
              onClick={() => {
                const price = bsmPrice(
                  spot, strike, expiryYears, riskFreeRate, volatility,
                  dividendYield, optionType === "Call",
                );
                addOption({
                  id: generateWorkbenchId(),
                  spot,
                  strike,
                  expiryYears,
                  riskFreeRate,
                  volatility,
                  dividendYield,
                  optionType: optionType === "Call" ? "call" : "put",
                  side: "long",
                  quantity: 10,
                  premium: price,
                  source: "Greeks Visualizer",
                });
                setSent(true);
                setTimeout(() => setSent(false), 2000);
              }}
              className={`flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors ${
                sent
                  ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)] border border-[var(--accent-green)]/30"
                  : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/25"
              }`}
            >
              {sent ? <Check size={14} /> : <Briefcase size={14} />}
              {sent ? "Added to Portfolio" : "Send to Portfolio"}
            </button>
          </div>
        </div>
      </div>

      {/* ── CENTER: Greeks Graph Grid ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Category headers with grid */}
        <div className="mb-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            First-Order Greeks
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {GREEK_CONFIGS.filter((c) => c.category === "first-order").map((config) => (
              <GreekCard
                key={config.key}
                config={config}
                curveData={allCurves[config.key]}
                currentX={currentXValues[config.xVariable]}
                currentY={currentGreeks[config.key]}
                optionState={optionState}
              />
            ))}
          </div>
        </div>

        <div className="mb-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Second-Order Greeks
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {GREEK_CONFIGS.filter((c) => c.category === "second-order").map((config) => (
              <GreekCard
                key={config.key}
                config={config}
                curveData={allCurves[config.key]}
                currentX={currentXValues[config.xVariable]}
                currentY={currentGreeks[config.key]}
                optionState={optionState}
              />
            ))}
          </div>
        </div>

        <div className="mb-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Third-Order Greeks
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {GREEK_CONFIGS.filter((c) => c.category === "third-order").map((config) => (
              <GreekCard
                key={config.key}
                config={config}
                curveData={allCurves[config.key]}
                currentX={currentXValues[config.xVariable]}
                currentY={currentGreeks[config.key]}
                optionState={optionState}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
