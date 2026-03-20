"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useWorkbench, generateWorkbenchId } from "@/context/WorkbenchContext";
import { useMarketData } from "@/context/MarketDataContext";
import { Briefcase, Check, Zap, Download } from "lucide-react";

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

interface IVResult {
  implied_vol: number;
  bsm_price: number;
  moneyness: number;
  log_moneyness: number;
  time_value: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  vanna: number;
  volga: number;
  charm: number;
}

export function ImpliedVolTab() {
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(0.25);
  const [marketPrice, setMarketPrice] = useState(5.0);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");

  const [result, setResult] = useState<IVResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentVol, setSentVol] = useState(false);
  const [sentOption, setSentOption] = useState(false);

  const { addOption, setVolatilityAssumption, setMarketImpliedVol } = useWorkbench();
  const { activeTicker, quote } = useMarketData();

  // Market data integration
  const [expirations, setExpirations] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [chainOptions, setChainOptions] = useState<{ strike: number; bid: number; ask: number; last: number; implied_vol: number; option_type: string }[]>([]);
  const [chainLoading, setChainLoading] = useState(false);

  // Auto-fill spot + ATM strike from live quote
  const [autoFilled, setAutoFilled] = useState(false);
  if (activeTicker && quote && !autoFilled) {
    setSpot(quote.spot);
    setStrike(Math.round(quote.spot));  // ATM strike
    setAutoFilled(true);
  }
  if (!activeTicker && autoFilled) {
    setAutoFilled(false);
  }

  // For the multi-strike chart
  const [multiResults, setMultiResults] = useState<{strikes: number[]; ivs: number[]} | null>(null);

  async function handleFetchExpirations() {
    if (!activeTicker) return;
    setChainLoading(true);
    try {
      const res = await api.getExpirations(activeTicker);
      setExpirations(res.expirations);
      if (res.expirations.length > 0) setSelectedExpiry(res.expirations[0]);
    } catch {
      setError("Failed to fetch expirations");
    } finally {
      setChainLoading(false);
    }
  }

  async function handleLoadChain() {
    if (!activeTicker || !selectedExpiry) return;
    setChainLoading(true);
    try {
      const chain = await api.getOptionsChain(activeTicker, selectedExpiry);
      const opts = optionType === "Call" ? chain.calls : chain.puts;
      setChainOptions(opts);
    } catch {
      setError("Failed to fetch options chain");
    } finally {
      setChainLoading(false);
    }
  }

  function handleSelectFromChain(opt: typeof chainOptions[0]) {
    setStrike(opt.strike);
    const mid = opt.bid > 0 && opt.ask > 0 ? (opt.bid + opt.ask) / 2 : opt.last;
    setMarketPrice(Math.max(mid, 0.01));
    // Set expiry
    const now = new Date();
    const exp = new Date(selectedExpiry);
    const yearsToExp = Math.max((exp.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000), 0.01);
    setExpiry(parseFloat(yearsToExp.toFixed(4)));
    setChainOptions([]);
  }

  async function handleSolve() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.solveImpliedVol({
        spot,
        strike,
        expiryYears: expiry,
        marketPrice,
        riskFreeRate: riskFreeRate / 100,
        dividendYield: dividendYield / 100,
        optionType: optionType === "Call" ? "call" : "put",
      });
      setResult(res);

      // Also solve for a range of strikes to show smile
      const strikes = [];
      const ivs = [];
      for (let k = Math.round(spot * 0.8); k <= Math.round(spot * 1.2); k += Math.round(spot * 0.025)) {
        try {
          const otype = optionType === "Call" ? "call" : "put";
          // Use the solved IV to generate synthetic prices at other strikes
          const syntheticPrice = await api.priceOption({
            spot,
            strike: k,
            expiryYears: expiry,
            optionType: otype as "call" | "put",
            riskFreeRate: riskFreeRate / 100,
            volatility: res.implied_vol,
            dividendYield: dividendYield / 100,
          });
          const ivResult = await api.solveImpliedVol({
            spot,
            strike: k,
            expiryYears: expiry,
            marketPrice: syntheticPrice.price,
            riskFreeRate: riskFreeRate / 100,
            dividendYield: dividendYield / 100,
            optionType: otype as "call" | "put",
          });
          strikes.push(k);
          ivs.push(ivResult.implied_vol * 100);
        } catch {
          // Skip strikes where IV solve fails
        }
      }
      setMultiResults({ strikes, ivs });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "IV solve failed");
      setResult(null);
      setMultiResults(null);
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
            IV Solver Parameters
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {/* Live ticker indicator */}
          {activeTicker && quote && (
            <div className="flex items-center gap-2 rounded border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 px-3 py-1.5">
              <Zap size={10} className="text-[var(--accent-primary)]" />
              <span className="text-[10px] font-mono text-[var(--accent-primary)]">
                Live: {activeTicker} ${quote.spot.toFixed(2)}
              </span>
            </div>
          )}
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Strike Price (K)" value={strike} onChange={setStrike} min={0.01} step={1} />
          <NumberInput label="Time to Expiry (T) years" value={expiry} onChange={setExpiry} min={0.01} step={0.05} />
          <NumberInput label="Market Price" value={marketPrice} onChange={setMarketPrice} min={0.01} step={0.5} />

          {/* Load from real options chain */}
          <div className="space-y-1.5 rounded border border-[#2196f3]/20 bg-[#2196f3]/5 p-2">
            <p className="text-[9px] font-semibold uppercase text-[#2196f3]">Load from Real Chain</p>
            {!activeTicker && (
              <p className="text-[9px] text-[var(--text-muted)] italic">
                Search a ticker in the top bar to fetch real option prices
              </p>
            )}
            {expirations.length === 0 ? (
              <button
                onClick={handleFetchExpirations}
                disabled={chainLoading || !activeTicker}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-[#2196f3]/30 bg-[#2196f3]/10 px-2 py-1 text-[10px] font-medium text-[#2196f3] hover:bg-[#2196f3]/20 disabled:opacity-50"
              >
                <Download size={10} />
                {chainLoading ? "Loading..." : activeTicker ? `Fetch ${activeTicker} Expirations` : "Fetch Expirations"}
              </button>
            ) : (
              <>
                <select
                  value={selectedExpiry}
                  onChange={(e) => { setSelectedExpiry(e.target.value); setChainOptions([]); }}
                  className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] outline-none"
                >
                  {expirations.map((exp) => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                </select>
                <button
                  onClick={handleLoadChain}
                  disabled={chainLoading}
                  className="flex w-full items-center justify-center gap-1.5 rounded border border-[#2196f3]/30 bg-[#2196f3]/10 px-2 py-1 text-[10px] font-medium text-[#2196f3] hover:bg-[#2196f3]/20 disabled:opacity-50"
                >
                  <Download size={10} />
                  {chainLoading ? "Loading..." : "Load Chain"}
                </button>
                {chainOptions.length > 0 && (
                  <div className="max-h-[150px] overflow-y-auto space-y-0.5">
                    {chainOptions.filter((o) => o.bid > 0 || o.last > 0).slice(0, 20).map((opt) => (
                      <button
                        key={opt.strike}
                        onClick={() => handleSelectFromChain(opt)}
                        className="flex w-full items-center justify-between rounded px-2 py-0.5 text-[10px] hover:bg-[var(--bg-hover)]"
                      >
                        <span className="font-mono text-[var(--text-primary)]">K={opt.strike}</span>
                        <span className="font-mono text-[var(--text-muted)]">
                          {opt.bid > 0 ? `${opt.bid.toFixed(2)}/${opt.ask.toFixed(2)}` : `Last: ${opt.last.toFixed(2)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <NumberInput label="Risk-Free Rate (r)" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Dividend Yield (q)" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Option Type</span>
            <ToggleGroup options={["Call", "Put"]} value={optionType} onChange={setOptionType} />
          </div>

          <Button onClick={handleSolve} loading={loading} className="mt-2 w-full">
            Solve IV
          </Button>

          {result && (
            <div className="space-y-2 border-t border-[var(--border-color)] pt-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Send to Portfolio
              </p>
              {/* Send IV as vol assumption */}
              <button
                onClick={() => {
                  setVolatilityAssumption(result.implied_vol, `Vol Lab (${(result.implied_vol * 100).toFixed(1)}%)`);
                  setMarketImpliedVol(result.implied_vol, `IV Solver (${(result.implied_vol * 100).toFixed(1)}%)`);
                  setSentVol(true);
                  setTimeout(() => setSentVol(false), 2000);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  sentVol
                    ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)] border border-[var(--accent-green)]/30"
                    : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/25"
                }`}
              >
                {sentVol ? <Check size={12} /> : <Briefcase size={12} />}
                {sentVol ? "Vol Assumption Sent" : `Use IV (${(result.implied_vol * 100).toFixed(1)}%) as Vol Assumption`}
              </button>
              {/* Send as option position */}
              <button
                onClick={() => {
                  addOption({
                    id: generateWorkbenchId(),
                    spot,
                    strike,
                    expiryYears: expiry,
                    riskFreeRate: riskFreeRate / 100,
                    volatility: result.implied_vol,
                    dividendYield: dividendYield / 100,
                    optionType: optionType === "Call" ? "call" : "put",
                    side: "long",
                    quantity: 10,
                    premium: result.bsm_price,
                    source: "Volatility Lab",
                  });
                  setSentOption(true);
                  setTimeout(() => setSentOption(false), 2000);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  sentOption
                    ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)] border border-[var(--accent-green)]/30"
                    : "bg-[#2196f3]/15 text-[#2196f3] border border-[#2196f3]/30 hover:bg-[#2196f3]/25"
                }`}
              >
                {sentOption ? <Check size={12} /> : <Briefcase size={12} />}
                {sentOption ? "Option Added" : "Send Option to Portfolio"}
              </button>
            </div>
          )}

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
            <div className="flex items-center gap-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Implied Vol</p>
                <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">
                  {(result.implied_vol * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">BSM Price</p>
                <p className="font-mono text-lg text-[var(--text-primary)]">{result.bsm_price.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Time Value</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.time_value.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Moneyness</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{result.moneyness.toFixed(4)}</p>
              </div>
            </div>

            {/* Greeks grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Delta", value: result.delta },
                { label: "Gamma", value: result.gamma },
                { label: "Vega", value: result.vega },
                { label: "Theta", value: result.theta },
                { label: "Rho", value: result.rho },
                { label: "Vanna", value: result.vanna },
                { label: "Volga", value: result.volga },
                { label: "Charm", value: result.charm },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">{label}</p>
                  <p className={`font-mono text-sm font-semibold ${value >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                    {value >= 0 ? "+" : ""}{value.toFixed(6)}
                  </p>
                </div>
              ))}
            </div>

            {/* Flat smile chart (since all strikes use same vol) */}
            {multiResults && multiResults.strikes.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[{
                    x: multiResults.strikes,
                    y: multiResults.ivs,
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    line: { color: "#ff9800", width: 2 },
                    marker: { size: 5 },
                    name: "IV",
                  }]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Implied Volatility across Strikes (Flat — Single Vol Input)", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Strike", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "IV (%)", font: { size: 10 } } },
                    shapes: [{
                      type: "line", x0: strike, x1: strike, y0: 0, y1: 1, yref: "paper",
                      line: { color: "#555577", width: 1, dash: "dash" },
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
              <p className="text-sm text-[var(--text-muted)]">Enter a market price and click &quot;Solve IV&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                The solver uses Brent&apos;s method to find the BSM implied volatility
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
