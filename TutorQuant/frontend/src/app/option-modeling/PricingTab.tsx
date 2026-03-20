"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { BSMDerivation } from "./theory/BSMDerivation";
import { api } from "@/lib/api";
import { useWorkbench, generateWorkbenchId } from "@/context/WorkbenchContext";
import { Briefcase, Check } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Greek metadata for display                                         */
/* ------------------------------------------------------------------ */

interface GreekCardInfo {
  key: string;
  label: string;
  description: string;
  field: string;
}

const GREEK_CARDS: GreekCardInfo[] = [
  { key: "delta", label: "Delta", description: "Rate of change of option price w.r.t. spot", field: "delta" },
  { key: "gamma", label: "Gamma", description: "Rate of change of delta w.r.t. spot", field: "gamma" },
  { key: "vega", label: "Vega", description: "Sensitivity to unit change in volatility", field: "vega" },
  { key: "theta", label: "Theta", description: "Time decay (annualised)", field: "theta" },
  { key: "rho", label: "Rho", description: "Sensitivity to unit change in risk-free rate", field: "rho" },
  { key: "vanna", label: "Vanna", description: "Cross-sensitivity of delta to volatility", field: "vanna" },
];

/* ------------------------------------------------------------------ */
/*  Types for API responses (inline, matching actual backend)          */
/* ------------------------------------------------------------------ */

interface PriceResult {
  price: number;
  model_used: string;
  computation_time_ms: number;
  metadata?: Record<string, unknown>;
}

interface GreeksResult {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  vanna?: number;
  volga?: number;
  charm?: number;
  method_used: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PricingTab() {
  /* ---- input state ---- */
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(1.0);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [volatility, setVolatility] = useState(20.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");

  /* ---- result state ---- */
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [greeksResult, setGreeksResult] = useState<GreeksResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { addOption } = useWorkbench();

  /* ---- helpers ---- */
  const optionTypeValue = optionType === "Call" ? "call" : "put";

  async function handlePrice() {
    setLoading(true);
    setError(null);
    setPriceResult(null);
    setGreeksResult(null);
    setSent(false);

    const params = {
      spot,
      strike,
      expiryYears: expiry,
      optionType: optionTypeValue as "call" | "put",
      riskFreeRate: riskFreeRate / 100,
      volatility: volatility / 100,
      dividendYield: dividendYield / 100,
    };

    try {
      const [pricing, greeks] = await Promise.all([
        api.priceOption(params),
        api.computeGreeks(params),
      ]);
      setPriceResult(pricing);
      setGreeksResult(greeks as GreeksResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /* ---- render helpers ---- */
  function formatGreek(value: unknown): string {
    if (value === undefined || value === null || typeof value !== "number") return "--";
    return value.toFixed(4);
  }

  function greekColor(value: unknown): string {
    if (value === undefined || value === null || typeof value !== "number") return "text-[var(--text-muted)]";
    if (value > 0) return "text-[var(--accent-green)]";
    if (value < 0) return "text-[var(--accent-red)]";
    return "text-[var(--text-primary)]";
  }

  /* Compute intrinsic + time value locally */
  const intrinsic = optionTypeValue === "call"
    ? Math.max(spot - strike, 0)
    : Math.max(strike - spot, 0);
  const timeValue = priceResult ? Math.max(priceResult.price - intrinsic, 0) : 0;

  /* ================================================================ */
  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Input Panel ──────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            BSM Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Strike Price (K)" value={strike} onChange={setStrike} min={0.01} step={1} />
          <NumberInput label="Time to Expiry (T) years" value={expiry} onChange={setExpiry} min={0.001} step={0.1} />
          <NumberInput label="Risk-Free Rate (r)" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Volatility (σ)" value={volatility} onChange={setVolatility} min={0.01} step={1} suffix="%" />
          <NumberInput label="Dividend Yield (q)" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Option Type</span>
            <ToggleGroup options={["Call", "Put"]} value={optionType} onChange={setOptionType} />
          </div>

          <Button onClick={handlePrice} loading={loading} className="mt-2 w-full">
            Price Option
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Results ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {/* Price Display */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {optionType} Option Price &mdash; Black-Scholes-Merton
              </p>
              <p className="mt-2 font-mono text-4xl font-bold text-[var(--accent-primary)]">
                {priceResult ? priceResult.price.toFixed(4) : "--"}
              </p>
            </div>
            {priceResult && (
              <div className="text-right">
                <div className="flex gap-6">
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Intrinsic</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{intrinsic.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Time Value</p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">{timeValue.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Compute</p>
                    <p className="font-mono text-sm text-[var(--text-muted)]">{priceResult.computation_time_ms.toFixed(1)} ms</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Greeks Grid */}
        <div className="grid grid-cols-3 gap-3">
          {GREEK_CARDS.map((card) => {
            const val = greeksResult ? (greeksResult as Record<string, unknown>)[card.field] : undefined;
            return (
              <div key={card.key} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{card.label}</p>
                <p className={`mt-1 font-mono text-xl font-bold ${greekColor(val)}`}>{formatGreek(val)}</p>
                <p className="mt-1 text-[10px] leading-tight text-[var(--text-muted)]">{card.description}</p>
              </div>
            );
          })}
        </div>

        {/* Model Assumptions */}
        {priceResult && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Active Assumptions</h4>
            <div className="grid grid-cols-3 gap-x-8 gap-y-1 text-xs">
              {[
                ["Model", "BSM"], ["Exercise", "European"], ["Type", optionType],
                ["S", `${spot}`], ["K", `${strike}`], ["T", `${expiry}y`],
                ["r", `${riskFreeRate}%`], ["σ", `${volatility}%`], ["q", `${dividendYield}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="font-mono text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                addOption({
                  id: generateWorkbenchId(),
                  spot,
                  strike,
                  expiryYears: expiry,
                  riskFreeRate: riskFreeRate / 100,
                  volatility: volatility / 100,
                  dividendYield: dividendYield / 100,
                  optionType: optionTypeValue as "call" | "put",
                  side: "long",
                  quantity: 10,
                  premium: priceResult.price,
                  source: "Option Modeling",
                });
                setSent(true);
              }}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors ${
                sent
                  ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)] border border-[var(--accent-green)]/30"
                  : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/25"
              }`}
            >
              {sent ? <Check size={14} /> : <Briefcase size={14} />}
              {sent ? "Added to Portfolio Workbench" : "Send to Portfolio"}
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: Theory Panel ────────────────────────────────── */}
      <TheoryPanel title="Black-Scholes-Merton Theory">
        <BSMDerivation />
      </TheoryPanel>
    </div>
  );
}
