"use client";

import { useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { VaRTheory } from "./theory/VaRTheory";
import { api } from "@/lib/api";
import { Plus, Trash2, Download, Check, Zap } from "lucide-react";
import { type PayoffLeg, generatePayoffCurves, computePriceRange } from "@/lib/payoff";
import { useWorkbench, type WorkbenchBond, type AssumptionProfile } from "@/context/WorkbenchContext";
import { useMarketData } from "@/context/MarketDataContext";
import { useState } from "react";

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

export interface Position {
  id: string;
  instrument_type: string;
  quantity: number;
  side: string;
  spot: number;
  strike: number;
  expiry_years: number;
  option_type: string;
  dividend_yield: number;
}

export interface BondPosition {
  id: string;
  faceValue: number;
  couponRate: number;        // decimal
  couponFrequency: number;
  maturityYears: number;
  ytm: number;               // decimal
  cleanPrice: number;
  dirtyPrice: number;
  modifiedDuration: number;
  convexity: number;
  dv01: number;
  quantity: number;
  side: "long" | "short";
}

interface AnalyticsResult {
  total_value: number;
  positions_valued: Record<string, unknown>[];
  risk_metrics: Record<string, number>;
  var: number;
  es: number;
  var_method: string;
  pnl_distribution?: number[];
}

/** Props so parent can read our state */
export interface PositionsTabProps {
  onPositionsChange?: (positions: Position[], bonds: BondPosition[], riskFreeRate: number, volatility: number, profile: AssumptionProfile) => void;
}

let posIdCounter = 1;
function newPosition(): Position {
  return {
    id: `pos_${posIdCounter++}`,
    instrument_type: "option",
    quantity: 10,
    side: "long",
    spot: 100,
    strike: 100,
    expiry_years: 1.0,
    option_type: "call",
    dividend_yield: 0,
  };
}

export function PositionsTab({ onPositionsChange }: PositionsTabProps) {
  const [positions, setPositions] = useState<Position[]>([newPosition()]);
  const [bondPositions, setBondPositions] = useState<BondPosition[]>([]);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [volatility, setVolatility] = useState(20.0);
  const [confidence, setConfidence] = useState<string>("95%");
  const [holdingDays, setHoldingDays] = useState(1);
  const [varMethod, setVarMethod] = useState<string>("Parametric");

  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const {
    options: workbenchOptions, clearOptions,
    bonds: workbenchBonds, clearBonds,
    assumptions, clearAssumptions,
    activeProfile,
  } = useWorkbench();

  const { activeTicker, quote } = useMarketData();

  const totalQueued = workbenchOptions.length + workbenchBonds.length;
  const hasAssumptions = assumptions.volatility !== null || assumptions.riskFreeRate !== null;
  const hasVolProfile = activeProfile.userAssumedVol !== null || activeProfile.marketImpliedVol !== null || activeProfile.realizedVol !== null;

  // Market data chain import state
  const [chainExpirations, setChainExpirations] = useState<string[]>([]);
  const [chainSelectedExpiry, setChainSelectedExpiry] = useState("");
  const [chainOptions, setChainOptions] = useState<{ strike: number; bid: number; ask: number; last: number; volume: number; open_interest: number; implied_vol: number; option_type: string }[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [showChainImport, setShowChainImport] = useState(false);

  async function handleFetchChainExpirations() {
    if (!activeTicker) return;
    setChainLoading(true);
    try {
      const res = await api.getExpirations(activeTicker);
      setChainExpirations(res.expirations);
      if (res.expirations.length > 0) setChainSelectedExpiry(res.expirations[0]);
      setShowChainImport(true);
    } catch {
      setError("Failed to fetch expirations");
    } finally {
      setChainLoading(false);
    }
  }

  async function handleLoadChainOptions() {
    if (!activeTicker || !chainSelectedExpiry) return;
    setChainLoading(true);
    try {
      const chain = await api.getOptionsChain(activeTicker, chainSelectedExpiry);
      setChainOptions([...chain.calls, ...chain.puts]);
    } catch {
      setError("Failed to fetch options chain");
    } finally {
      setChainLoading(false);
    }
  }

  function handleAddFromChain(opt: typeof chainOptions[0]) {
    const now = new Date();
    const exp = new Date(chainSelectedExpiry);
    const yearsToExp = Math.max((exp.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000), 0.01);

    const newPos: Position = {
      id: `pos_${posIdCounter++}`,
      instrument_type: "option",
      quantity: 1,
      side: "long",
      spot: quote?.spot ?? 100,
      strike: opt.strike,
      expiry_years: parseFloat(yearsToExp.toFixed(4)),
      option_type: opt.option_type,
      dividend_yield: 0,
    };
    setPositions((prev) => [...prev, newPos]);
  }

  // Notify parent of position changes
  useEffect(() => {
    onPositionsChange?.(positions, bondPositions, riskFreeRate, volatility, activeProfile);
  }, [positions, bondPositions, riskFreeRate, volatility, onPositionsChange, activeProfile]);

  const addPosition = useCallback(() => {
    const pos = newPosition();
    if (quote) {
      pos.spot = quote.spot;
      pos.strike = Math.round(quote.spot);
    }
    setPositions((prev) => [...prev, pos]);
  }, [quote]);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const removeBondPosition = useCallback((id: string) => {
    setBondPositions((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const updatePosition = useCallback((id: string, field: string, value: unknown) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }, []);

  function handleImportFromLabs() {
    let imported = false;

    // Import option positions
    if (workbenchOptions.length > 0) {
      const newPositions: Position[] = workbenchOptions.map((opt) => ({
        id: `pos_${posIdCounter++}`,
        instrument_type: "option",
        quantity: opt.quantity,
        side: opt.side,
        spot: opt.spot,
        strike: opt.strike,
        expiry_years: opt.expiryYears,
        option_type: opt.optionType,
        dividend_yield: opt.dividendYield * 100,
      }));
      setPositions((prev) => [...prev, ...newPositions]);
      clearOptions();
      imported = true;
    }

    // Import bond positions
    if (workbenchBonds.length > 0) {
      const newBonds: BondPosition[] = workbenchBonds.map((b: WorkbenchBond) => ({
        id: b.id,
        faceValue: b.faceValue,
        couponRate: b.couponRate,
        couponFrequency: b.couponFrequency,
        maturityYears: b.maturityYears,
        ytm: b.ytm,
        cleanPrice: b.cleanPrice,
        dirtyPrice: b.dirtyPrice,
        modifiedDuration: b.modifiedDuration,
        convexity: b.convexity,
        dv01: b.dv01,
        quantity: b.quantity,
        side: b.side,
      }));
      setBondPositions((prev) => [...prev, ...newBonds]);
      clearBonds();
      imported = true;
    }

    // Apply assumptions (overwrite portfolio-wide vol and rate)
    if (assumptions.volatility !== null) {
      setVolatility(assumptions.volatility * 100); // decimal → percentage
    }
    if (assumptions.riskFreeRate !== null) {
      setRiskFreeRate(assumptions.riskFreeRate * 100); // decimal → percentage
    }
    if (hasAssumptions) {
      clearAssumptions();
      imported = true;
    }

    if (imported) {
      setImported(true);
      setTimeout(() => setImported(false), 2000);
    }
  }

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);

    const confLevel = confidence === "99%" ? 0.99 : 0.95;
    const method = varMethod === "Monte Carlo" ? "monte_carlo" : "parametric";

    try {
      const res = await api.analyzePortfolio({
        positions: positions.map((p) => ({
          instrument_id: p.id,
          instrument_type: p.instrument_type,
          quantity: p.quantity,
          side: p.side,
          spot: p.spot,
          strike: p.strike,
          expiry_years: p.expiry_years,
          option_type: p.option_type,
          dividend_yield: p.dividend_yield / 100,
        })),
        riskFreeRate: riskFreeRate / 100,
        volatility: volatility / 100,
        confidence: confLevel,
        holdingDays,
        varMethod: method,
        numScenarios: 10000,
        seed: 42,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function fmtVal(v: number | undefined, decimals = 4): string {
    if (v === undefined) return "--";
    return v.toFixed(decimals);
  }

  function signColor(v: number): string {
    if (v > 0.01) return "text-[var(--accent-green)]";
    if (v < -0.01) return "text-[var(--accent-red)]";
    return "text-[var(--text-primary)]";
  }

  // Build payoff legs from positions + API-returned prices (premium)
  const payoffData = useMemo(() => {
    if (!result) return null;

    const legs: PayoffLeg[] = positions.map((pos, i) => {
      const valued = result.positions_valued[i];
      const premium = valued ? (valued.price as number) ?? 0 : 0;
      return {
        strike: pos.strike,
        optionType: pos.option_type as "call" | "put",
        side: pos.side as "long" | "short",
        quantity: pos.quantity,
        premium,
        label: `${pos.side === "long" ? "Long" : "Short"} ${pos.strike} ${pos.option_type === "call" ? "Call" : "Put"}`,
      };
    });

    const avgSpot = positions.reduce((s, p) => s + p.spot, 0) / positions.length;
    const prices = computePriceRange(legs, avgSpot);
    return generatePayoffCurves(legs, prices);
  }, [result, positions]);

  const LEG_COLORS = [
    "#ff9800", "#2196f3", "#00c853", "#ab47bc",
    "#ff5722", "#26c6da", "#ffab40", "#ec407a",
  ];

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Positions & Config Panel ────────────────────── */}
      <div className="w-[320px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Portfolio Positions
          </h3>
          <div className="flex items-center gap-1">
            {/* Import from Labs */}
            <button
              onClick={handleImportFromLabs}
              disabled={totalQueued === 0 && !hasAssumptions}
              className={`relative flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors ${
                imported
                  ? "text-[var(--accent-green)]"
                  : (totalQueued > 0 || hasAssumptions)
                    ? "text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
                    : "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
              }`}
            >
              {imported ? <Check size={12} /> : <Download size={12} />}
              {imported ? "Imported!" : "Import"}
              {(totalQueued > 0 || hasAssumptions) && !imported && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[9px] font-bold text-black">
                  {totalQueued + (hasAssumptions ? 1 : 0)}
                </span>
              )}
            </button>
            <button
              onClick={handleFetchChainExpirations}
              disabled={chainLoading || !activeTicker}
              title={activeTicker ? `Import from ${activeTicker} options chain` : "Search a ticker first to import from chain"}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#2196f3] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <Download size={12} /> Chain
            </button>
            <button
              onClick={addPosition}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Live ticker banner */}
          {activeTicker && quote && (
            <div className="flex items-center gap-2 rounded border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 px-3 py-1.5">
              <Zap size={10} className="text-[var(--accent-primary)]" />
              <span className="text-[10px] font-mono text-[var(--accent-primary)]">
                Live: {activeTicker} ${quote.spot.toFixed(2)}
              </span>
              <span className={`text-[10px] font-mono ${quote.change >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                {quote.change >= 0 ? "\u25B2" : "\u25BC"}{Math.abs(quote.change_pct).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Import from Chain panel */}
          {showChainImport && activeTicker && (
            <div className="rounded border border-[#2196f3]/20 bg-[#2196f3]/5 p-2 space-y-1.5">
              <p className="text-[9px] font-semibold uppercase text-[#2196f3]">Import from {activeTicker} Chain</p>
              <select
                value={chainSelectedExpiry}
                onChange={(e) => { setChainSelectedExpiry(e.target.value); setChainOptions([]); }}
                className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] outline-none"
              >
                {chainExpirations.map((exp) => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </select>
              <button
                onClick={handleLoadChainOptions}
                disabled={chainLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-[#2196f3]/30 bg-[#2196f3]/10 px-2 py-1 text-[10px] font-medium text-[#2196f3] hover:bg-[#2196f3]/20 disabled:opacity-50"
              >
                {chainLoading ? "Loading..." : "Load Options"}
              </button>
              {chainOptions.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                  {chainOptions.filter((o) => o.bid > 0 || o.last > 0).map((opt, i) => (
                    <button
                      key={`${opt.option_type}-${opt.strike}-${i}`}
                      onClick={() => handleAddFromChain(opt)}
                      className="flex w-full items-center justify-between rounded px-2 py-0.5 text-[10px] hover:bg-[var(--bg-hover)]"
                    >
                      <span className="font-mono text-[var(--text-primary)]">
                        {opt.option_type === "call" ? "C" : "P"} K={opt.strike}
                      </span>
                      <span className="font-mono text-[var(--text-muted)]">
                        {opt.bid > 0 ? `${opt.bid.toFixed(2)}/${opt.ask.toFixed(2)}` : `${opt.last.toFixed(2)}`}
                      </span>
                      <span className="text-[#2196f3]">+ Add</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setShowChainImport(false); setChainOptions([]); }}
                className="w-full text-center text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>
          )}

          {/* Assumptions banner */}
          {hasAssumptions && (
            <div className="rounded border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-2 text-[10px] text-[var(--accent-primary)]">
              <div className="flex items-center gap-1 font-semibold mb-1">
                <Zap size={10} /> Lab Assumptions Queued
              </div>
              {assumptions.volatility !== null && (
                <p>Vol: {(assumptions.volatility * 100).toFixed(1)}% <span className="text-[var(--text-muted)]">from {assumptions.volatilitySource}</span></p>
              )}
              {assumptions.riskFreeRate !== null && (
                <p>Rate: {(assumptions.riskFreeRate * 100).toFixed(2)}% <span className="text-[var(--text-muted)]">from {assumptions.riskFreeRateSource}</span></p>
              )}
              <p className="mt-1 text-[9px] text-[var(--text-muted)]">Click Import to apply</p>
            </div>
          )}

          {/* Three-Vol Profile Banner */}
          {hasVolProfile && (
            <div className="rounded border border-[#ab47bc]/30 bg-[#ab47bc]/10 px-3 py-2 text-[10px]">
              <div className="flex items-center gap-1 font-semibold mb-1 text-[#ab47bc]">
                <Zap size={10} /> Vol Profile Active
              </div>
              {activeProfile.userAssumedVol && (
                <p className="text-[#ff9800]">
                  Your σ: {(activeProfile.userAssumedVol.value * 100).toFixed(1)}%
                  <span className="text-[var(--text-muted)]"> — {activeProfile.userAssumedVol.source}</span>
                </p>
              )}
              {activeProfile.marketImpliedVol && (
                <p className="text-[#2196f3]">
                  Market IV: {(activeProfile.marketImpliedVol.value * 100).toFixed(1)}%
                  <span className="text-[var(--text-muted)]"> — {activeProfile.marketImpliedVol.source}</span>
                </p>
              )}
              {activeProfile.realizedVol && (
                <p className="text-[#00c853]">
                  Realized: {(activeProfile.realizedVol.value * 100).toFixed(1)}%
                  <span className="text-[var(--text-muted)]"> — {activeProfile.realizedVol.source}</span>
                </p>
              )}
              <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                Performance tab uses your assumption for pricing, compares vs IV and realized
              </p>
            </div>
          )}

          {/* Option Positions */}
          {positions.map((pos, idx) => (
            <div key={pos.id} className="rounded border border-[var(--border-color)] bg-[#0a0a0f] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                  Option {idx + 1}
                </span>
                {positions.length > 1 && (
                  <button
                    onClick={() => removePosition(pos.id)}
                    className="text-[var(--accent-red)] hover:text-[var(--accent-red)]/80"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="Spot" value={pos.spot} onChange={(v) => updatePosition(pos.id, "spot", v)} min={0.01} step={1} />
                <NumberInput label="Strike" value={pos.strike} onChange={(v) => updatePosition(pos.id, "strike", v)} min={0.01} step={1} />
                <NumberInput label="Expiry (y)" value={pos.expiry_years} onChange={(v) => updatePosition(pos.id, "expiry_years", v)} min={0.01} step={0.25} />
                <NumberInput label="Qty" value={pos.quantity} onChange={(v) => updatePosition(pos.id, "quantity", v)} min={1} step={1} />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="text-[9px] uppercase text-[var(--text-muted)]">Type</span>
                  <ToggleGroup
                    options={["call", "put"]}
                    value={pos.option_type}
                    onChange={(v) => updatePosition(pos.id, "option_type", v)}
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[9px] uppercase text-[var(--text-muted)]">Side</span>
                  <ToggleGroup
                    options={["long", "short"]}
                    value={pos.side}
                    onChange={(v) => updatePosition(pos.id, "side", v)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Bond Positions */}
          {bondPositions.map((bond, idx) => (
            <div key={bond.id} className="rounded border border-[#2196f3]/30 bg-[#0a0a0f] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase text-[#2196f3]">
                  Bond {idx + 1}
                </span>
                <button
                  onClick={() => removeBondPosition(bond.id)}
                  className="text-[var(--accent-red)] hover:text-[var(--accent-red)]/80"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 text-[10px]">
                <p className="text-[var(--text-muted)]">Face: <span className="text-[var(--text-primary)] font-mono">{bond.faceValue}</span></p>
                <p className="text-[var(--text-muted)]">Coupon: <span className="text-[var(--text-primary)] font-mono">{(bond.couponRate * 100).toFixed(1)}%</span></p>
                <p className="text-[var(--text-muted)]">Maturity: <span className="text-[var(--text-primary)] font-mono">{bond.maturityYears}y</span></p>
                <p className="text-[var(--text-muted)]">YTM: <span className="text-[var(--text-primary)] font-mono">{(bond.ytm * 100).toFixed(2)}%</span></p>
                <p className="text-[var(--text-muted)]">Clean: <span className="text-[var(--text-primary)] font-mono">{bond.cleanPrice.toFixed(2)}</span></p>
                <p className="text-[var(--text-muted)]">Duration: <span className="text-[var(--text-primary)] font-mono">{bond.modifiedDuration.toFixed(2)}</span></p>
              </div>
            </div>
          ))}

          <div className="border-t border-[var(--border-color)] pt-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Risk Config</p>
            <NumberInput label="Risk-Free Rate" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
            <NumberInput label="Volatility (σ)" value={volatility} onChange={setVolatility} min={0.01} step={1} suffix="%" />
            <NumberInput label="Holding Period" value={holdingDays} onChange={setHoldingDays} min={1} step={1} suffix="days" />

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Confidence</span>
              <ToggleGroup options={["95%", "99%"]} value={confidence} onChange={setConfidence} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">VaR Method</span>
              <ToggleGroup options={["Parametric", "Monte Carlo"]} value={varMethod} onChange={setVarMethod} />
            </div>
          </div>

          <Button onClick={handleAnalyze} loading={loading} className="w-full">
            Analyze Portfolio
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
            {/* Summary */}
            <div className="flex items-center gap-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Portfolio Value</p>
                <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">{fmtVal(result.total_value, 2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">{confidence} VaR ({holdingDays}d)</p>
                <p className="font-mono text-xl font-bold text-[var(--accent-red)]">{fmtVal(result.var, 2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">{confidence} ES</p>
                <p className="font-mono text-xl font-bold text-[var(--accent-red)]">{fmtVal(result.es, 2)}</p>
              </div>
              <div className="ml-auto">
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Method</p>
                <p className="font-mono text-sm text-[var(--text-muted)]">{result.var_method}</p>
              </div>
            </div>

            {/* Bond Summary (if any bonds) */}
            {bondPositions.length > 0 && (
              <div className="rounded-lg border border-[#2196f3]/30 bg-[var(--bg-card)] p-4">
                <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#2196f3]">
                  Fixed Income Positions
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Total Bond Value</p>
                    <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                      {bondPositions.reduce((s, b) => s + (b.side === "long" ? 1 : -1) * b.dirtyPrice * b.quantity, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Wtd Duration</p>
                    <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                      {(bondPositions.reduce((s, b) => s + b.modifiedDuration * b.dirtyPrice * b.quantity, 0) /
                        bondPositions.reduce((s, b) => s + b.dirtyPrice * b.quantity, 0)).toFixed(2)}y
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Total DV01</p>
                    <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                      ${bondPositions.reduce((s, b) => s + b.dv01 * b.quantity, 0).toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Avg YTM</p>
                    <p className="font-mono text-lg font-bold text-[var(--accent-green)]">
                      {((bondPositions.reduce((s, b) => s + b.ytm, 0) / bondPositions.length) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Greeks Aggregation */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Delta", key: "total_delta" },
                { label: "Gamma", key: "total_gamma" },
                { label: "Vega", key: "total_vega" },
                { label: "Theta", key: "total_theta" },
              ].map((g) => {
                const v = result.risk_metrics[g.key];
                return (
                  <div key={g.key} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Portfolio {g.label}
                    </p>
                    <p className={`mt-1 font-mono text-xl font-bold ${signColor(v)}`}>
                      {fmtVal(v)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Positions Table */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
              <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Position Detail
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="py-2 text-left text-[var(--text-muted)]">ID</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Price</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Value</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Delta</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Gamma</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Vega</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Theta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.positions_valued.map((pv, i) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50">
                        <td className="py-2 font-mono text-[var(--text-primary)]">{pv.instrument_id as string}</td>
                        <td className="py-2 text-right font-mono text-[var(--text-primary)]">{(pv.price as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono font-bold ${signColor(pv.position_value as number)}`}>
                          {(pv.position_value as number)?.toFixed(2)}
                        </td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.delta as number)}`}>{(pv.delta as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.gamma as number)}`}>{(pv.gamma as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.vega as number)}`}>{(pv.vega as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.theta as number)}`}>{(pv.theta as number)?.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Portfolio Payoff at Expiration */}
            {payoffData && payoffData.prices.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[
                    ...positions.map((pos, i) => ({
                      x: payoffData.prices,
                      y: payoffData.legPayoffs[i],
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: `${pos.side === "long" ? "L" : "S"} ${pos.strike}${pos.option_type === "call" ? "C" : "P"} ×${pos.quantity}`,
                      line: {
                        color: LEG_COLORS[i % LEG_COLORS.length],
                        width: 1,
                        dash: "dot" as const,
                      },
                      hovertemplate: `%{fullData.name}<br>Spot: %{x:.2f}<br>P/L: %{y:.2f}<extra></extra>`,
                      showlegend: positions.length > 1,
                    })),
                    {
                      x: payoffData.prices,
                      y: payoffData.totalPayoff,
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: "Total P/L",
                      line: { color: "#e0e0e0", width: 2.5 },
                      hovertemplate: "Total P/L<br>Spot: %{x:.2f}<br>P/L: %{y:.2f}<extra></extra>",
                      showlegend: positions.length > 1,
                    },
                    ...(payoffData.breakevens.length > 0
                      ? [{
                          x: payoffData.breakevens,
                          y: payoffData.breakevens.map(() => 0),
                          type: "scatter" as const,
                          mode: "text+markers" as const,
                          name: "Break-even",
                          marker: { color: "#ffab40", size: 8, symbol: "diamond" as const },
                          text: payoffData.breakevens.map((b) => b.toFixed(1)),
                          textposition: "top center" as const,
                          textfont: { color: "#ffab40", size: 9, family: "monospace" },
                          hovertemplate: "Break-even: %{x:.2f}<extra></extra>",
                          showlegend: false,
                        }]
                      : []),
                  ]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Portfolio Expiration P/L", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Underlying Price at Expiration", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Profit / Loss", font: { size: 10 } } },
                    showlegend: positions.length > 1,
                    legend: { font: { size: 9, color: "#8888aa" }, bgcolor: "rgba(0,0,0,0)", x: 0.01, y: 0.99 },
                    shapes: [{
                      type: "line",
                      x0: payoffData.prices[0], x1: payoffData.prices[payoffData.prices.length - 1],
                      y0: 0, y1: 0,
                      line: { color: "#555577", width: 1, dash: "dash" },
                    }],
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "350px" }}
                />
              </div>
            )}

            {/* P&L Distribution (MC only) */}
            {result.pnl_distribution && result.pnl_distribution.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[{
                    x: result.pnl_distribution,
                    type: "histogram" as const,
                    nbinsx: 60,
                    marker: { color: "rgba(255,152,0,0.6)", line: { color: "#ff9800", width: 0.5 } },
                    name: "P&L Distribution",
                  } as Plotly.Data]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Monte Carlo P&L Distribution", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Portfolio P&L", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Frequency", font: { size: 10 } } },
                    shapes: [{
                      type: "line", x0: -result.var, x1: -result.var, y0: 0, y1: 1, yref: "paper",
                      line: { color: "#ff1744", width: 2, dash: "dash" },
                    }],
                    annotations: [{
                      x: -result.var, y: 1.02, yref: "paper",
                      text: `VaR = ${result.var.toFixed(2)}`,
                      showarrow: false, font: { color: "#ff1744", size: 10 },
                    }],
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "300px" }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Add positions and click &quot;Analyze Portfolio&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Portfolio valuation, Greeks aggregation, VaR, and ES will appear here
              </p>
              {(totalQueued > 0 || hasAssumptions) && (
                <div className="mt-3 text-xs text-[var(--accent-primary)]">
                  {workbenchOptions.length > 0 && (
                    <p>{workbenchOptions.length} option{workbenchOptions.length !== 1 ? "s" : ""} queued from labs</p>
                  )}
                  {workbenchBonds.length > 0 && (
                    <p>{workbenchBonds.length} bond{workbenchBonds.length !== 1 ? "s" : ""} queued from Fixed Income</p>
                  )}
                  {hasAssumptions && (
                    <p>Lab assumptions ready to apply</p>
                  )}
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">Click &quot;Import&quot; to add them</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Theory Panel ───────────────────────────────── */}
      <TheoryPanel title="Portfolio Risk Theory">
        <VaRTheory />
      </TheoryPanel>
    </div>
  );
}
