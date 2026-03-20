"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { bsmPrice } from "@/lib/greeksEngine";
import { useWorkbench } from "@/context/WorkbenchContext";
import { useMarketData } from "@/context/MarketDataContext";
import { Briefcase, Check, Eye, Target, BarChart3, AlertTriangle, Zap, Download } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: "#0e0e14",
  plot_bgcolor: "#141420",
  font: { color: "#e0e0e0", family: "monospace", size: 11 },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  yaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  showlegend: true,
  legend: { font: { size: 9, color: "#8888aa" }, bgcolor: "rgba(0,0,0,0)", x: 0.01, y: 0.99 },
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

interface IVResult {
  implied_vol: number;
  bsm_price: number;
}

interface HistVolResult {
  historical_vol: number;
  ewma_vol: number;
  rolling_vol: number[];
  rolling_indices: number[];
  ewma_vol_series: number[];
  ewma_indices: number[];
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper: Generate synthetic GBM prices for realized vol computation         */
/* ─────────────────────────────────────────────────────────────────────────── */

function generateSyntheticPrices(spot: number, vol: number, days: number, seed: number): number[] {
  const dt = 1 / 252;
  const prices = [spot];
  let s = seed;
  for (let i = 1; i < days; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const u1 = s / 4294967296;
    s = (s * 1664525 + 1013904223) % 4294967296;
    const u2 = s / 4294967296;
    const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
    const drift = -0.5 * vol * vol * dt;
    const diffusion = vol * Math.sqrt(dt) * z;
    prices.push(prices[i - 1] * Math.exp(drift + diffusion));
  }
  return prices;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Vol Comparison Card                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function VolCard({
  label,
  sublabel,
  value,
  color,
  icon: Icon,
  onSend,
  sent,
}: {
  label: string;
  sublabel: string;
  value: number | null;
  color: string;
  icon: React.ElementType;
  onSend: () => void;
  sent: boolean;
}) {
  return (
    <div className="rounded-lg border bg-[var(--bg-card)] p-4" style={{ borderColor: `${color}40` }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </p>
      </div>
      <p className="text-[9px] text-[var(--text-muted)] mb-2">{sublabel}</p>
      {value !== null ? (
        <>
          <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
            {(value * 100).toFixed(2)}%
          </p>
          <button
            onClick={onSend}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded px-3 py-1.5 text-[10px] font-medium transition-colors ${
              sent
                ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)] border border-[var(--accent-green)]/30"
                : "border hover:opacity-80"
            }`}
            style={
              sent
                ? undefined
                : { borderColor: `${color}50`, backgroundColor: `${color}15`, color }
            }
          >
            {sent ? <Check size={12} /> : <Briefcase size={12} />}
            {sent ? "Sent to Portfolio" : "Use as Assumption"}
          </button>
        </>
      ) : (
        <p className="font-mono text-lg text-[var(--text-muted)]">—</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main Component                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

export function VolAnalysisTab() {
  /* ── Common Parameters ── */
  const [spot, setSpot] = useState(100);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(0.25);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [dividendYield, setDividendYield] = useState(0.0);
  const [optionType, setOptionType] = useState<string>("Call");

  /* ── User Assumed Vol ── */
  const [userVol, setUserVol] = useState(20.0); // percentage

  /* ── Market IV inputs ── */
  const [marketPrice, setMarketPrice] = useState(5.0);

  /* ── Realized Vol inputs ── */
  const [lookbackDays, setLookbackDays] = useState(63); // ~3 months
  const [realizedMethod, setRealizedMethod] = useState("Close-to-Close");

  /* ── Results ── */
  const [marketIV, setMarketIV] = useState<number | null>(null);
  const [realizedVol, setRealizedVol] = useState<number | null>(null);
  const [realizedRolling, setRealizedRolling] = useState<HistVolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Send states ── */
  const [sentUser, setSentUser] = useState(false);
  const [sentIV, setSentIV] = useState(false);
  const [sentRealized, setSentRealized] = useState(false);

  const { setUserAssumedVol, setMarketImpliedVol, setRealizedVol: setRealizedVolCtx, activeProfile } = useWorkbench();
  const { activeTicker, quote } = useMarketData();

  /* ── Market data integration states ── */
  const [expirations, setExpirations] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [chainLoading, setChainLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [liveDataSource, setLiveDataSource] = useState<string | null>(null);

  // Auto-fill spot from live quote when ticker changes
  const prevTickerRef = useState<string | null>(null);
  if (activeTicker && quote && activeTicker !== prevTickerRef[0]) {
    prevTickerRef[0] = activeTicker;
    // We'll use useEffect instead for proper React patterns
  }

  // Auto-fill spot + ATM strike from live quote
  const [autoFilledSpot, setAutoFilledSpot] = useState(false);
  if (activeTicker && quote && !autoFilledSpot) {
    setSpot(quote.spot);
    setStrike(Math.round(quote.spot));  // ATM strike
    setAutoFilledSpot(true);
  }
  if (!activeTicker && autoFilledSpot) {
    setAutoFilledSpot(false);
  }

  /* ── Fetch real options chain ── */
  async function handleFetchChain() {
    if (!activeTicker) return;
    setChainLoading(true);
    try {
      const expRes = await api.getExpirations(activeTicker);
      setExpirations(expRes.expirations);
      if (expRes.expirations.length > 0) {
        setSelectedExpiry(expRes.expirations[0]);
      }
    } catch {
      setError("Failed to fetch options expirations");
    } finally {
      setChainLoading(false);
    }
  }

  async function handleLoadOptionPrice() {
    if (!activeTicker || !selectedExpiry) return;
    setChainLoading(true);
    try {
      const chain = await api.getOptionsChain(activeTicker, selectedExpiry);
      const opts = optionType === "Call" ? chain.calls : chain.puts;
      // Find ATM option (closest to spot)
      let best = opts[0];
      let bestDist = Math.abs(opts[0].strike - spot);
      for (const opt of opts) {
        const dist = Math.abs(opt.strike - spot);
        if (dist < bestDist) {
          best = opt;
          bestDist = dist;
        }
      }
      if (best) {
        setStrike(best.strike);
        const mid = best.bid > 0 && best.ask > 0
          ? (best.bid + best.ask) / 2
          : best.last;
        setMarketPrice(Math.max(mid, 0.01));

        // Compute expiry in years
        const now = new Date();
        const exp = new Date(selectedExpiry);
        const yearsToExp = Math.max((exp.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000), 0.01);
        setExpiry(parseFloat(yearsToExp.toFixed(4)));
        setLiveDataSource(`${activeTicker} ${selectedExpiry} ${optionType} K=${best.strike}`);
      }
    } catch {
      setError("Failed to fetch options chain");
    } finally {
      setChainLoading(false);
    }
  }

  /* ── Fetch real history for realized vol ── */
  async function handleFetchHistory() {
    if (!activeTicker) return;
    setHistoryLoading(true);
    try {
      const period = lookbackDays <= 63 ? "3mo" : lookbackDays <= 126 ? "6mo" : lookbackDays <= 252 ? "1y" : "2y";
      const histData = await api.getHistory(activeTicker, period, "1d");
      const closePrices = histData.bars.map((b) => b.close);
      if (closePrices.length < 10) {
        setError("Not enough historical data");
        return;
      }
      const histRes = await api.historicalVol({
        prices: closePrices,
        window: Math.min(21, Math.floor(closePrices.length / 3)),
        ewmaLambda: 0.94,
        annFactor: 252,
      });
      if (realizedMethod === "EWMA") {
        setRealizedVol(histRes.ewma_vol);
      } else {
        setRealizedVol(histRes.historical_vol);
      }
      setRealizedRolling(histRes);
      setLiveDataSource((prev) => prev ? `${prev} | History: ${period}` : `${activeTicker} History: ${period}`);
    } catch {
      setError("Failed to fetch historical data");
    } finally {
      setHistoryLoading(false);
    }
  }

  /* ── Compute all three ── */
  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      // 1. Market IV: solve from market price
      const ivRes: IVResult = await api.solveImpliedVol({
        spot,
        strike,
        expiryYears: expiry,
        marketPrice,
        riskFreeRate: riskFreeRate / 100,
        dividendYield: dividendYield / 100,
        optionType: optionType === "Call" ? "call" : "put",
      });
      setMarketIV(ivRes.implied_vol);

      // 2. Realized Vol: use synthetic prices (demo mode)
      const syntheticPrices = generateSyntheticPrices(spot, userVol / 100, lookbackDays, 42);
      const histRes = await api.historicalVol({
        prices: syntheticPrices,
        window: Math.min(21, Math.floor(lookbackDays / 3)),
        ewmaLambda: 0.94,
        annFactor: 252,
      });

      if (realizedMethod === "EWMA") {
        setRealizedVol(histRes.ewma_vol);
      } else {
        setRealizedVol(histRes.historical_vol);
      }
      setRealizedRolling(histRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  /* ── Vol Gap Analysis ── */
  const volGap = useMemo(() => {
    if (marketIV === null) return null;
    const uv = userVol / 100;
    const iv = marketIV;
    const rv = realizedVol;

    return {
      userVsIV: uv - iv,
      userVsRealized: rv !== null ? uv - rv : null,
      ivVsRealized: rv !== null ? iv - rv : null,
      vrp: rv !== null ? iv - rv : null, // Volatility Risk Premium
    };
  }, [userVol, marketIV, realizedVol]);

  /* ── BSM prices at each vol ── */
  const priceComparison = useMemo(() => {
    if (marketIV === null) return null;

    const isCall = optionType === "Call";
    const r = riskFreeRate / 100;
    const q = dividendYield / 100;

    const priceAtUser = bsmPrice(spot, strike, expiry, r, userVol / 100, q, isCall);
    const priceAtIV = bsmPrice(spot, strike, expiry, r, marketIV, q, isCall);
    const priceAtRealized = realizedVol !== null
      ? bsmPrice(spot, strike, expiry, r, realizedVol, q, isCall)
      : null;

    return { priceAtUser, priceAtIV, priceAtRealized };
  }, [spot, strike, expiry, riskFreeRate, dividendYield, optionType, userVol, marketIV, realizedVol]);

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Parameter Panel ────────────────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Volatility Analysis
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
          {/* Common */}
          <NumberInput label="Spot Price (S)" value={spot} onChange={setSpot} min={0.01} step={1} />
          <NumberInput label="Strike Price (K)" value={strike} onChange={setStrike} min={0.01} step={1} />
          <NumberInput label="Expiry (T) years" value={expiry} onChange={setExpiry} min={0.01} step={0.05} />
          <NumberInput label="Risk-Free Rate" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
          <NumberInput label="Dividend Yield" value={dividendYield} onChange={setDividendYield} min={0} step={0.25} suffix="%" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Option Type</span>
            <ToggleGroup options={["Call", "Put"]} value={optionType} onChange={setOptionType} />
          </div>

          {/* User Assumed Vol */}
          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#ff9800] mb-2">
              <Target size={10} /> Your Vol Assumption
            </p>
            <NumberInput
              label="Assumed Vol (σ)"
              value={userVol}
              onChange={setUserVol}
              min={0.1}
              step={0.5}
              suffix="%"
            />
          </div>

          {/* Market IV */}
          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#2196f3] mb-2">
              <Eye size={10} /> Market Implied Vol
            </p>
            <NumberInput
              label="Market Price (observed)"
              value={marketPrice}
              onChange={setMarketPrice}
              min={0.01}
              step={0.5}
            />
            <div className="mt-2 space-y-1.5">
              {!activeTicker && (
                <p className="text-[9px] text-[var(--text-muted)] italic">
                  Search a ticker above to fetch real market option prices
                </p>
              )}
              {expirations.length === 0 ? (
                <button
                  onClick={handleFetchChain}
                  disabled={chainLoading || !activeTicker}
                  className="flex w-full items-center justify-center gap-1.5 rounded border border-[#2196f3]/30 bg-[#2196f3]/10 px-2 py-1 text-[10px] font-medium text-[#2196f3] hover:bg-[#2196f3]/20 disabled:opacity-50"
                >
                  <Download size={10} />
                  {chainLoading ? "Loading..." : activeTicker ? `Fetch Real Options (${activeTicker})` : "Fetch Real Options"}
                </button>
              ) : (
                <>
                  <select
                    value={selectedExpiry}
                    onChange={(e) => setSelectedExpiry(e.target.value)}
                    className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] outline-none"
                  >
                    {expirations.map((exp) => (
                      <option key={exp} value={exp}>{exp}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleLoadOptionPrice}
                    disabled={chainLoading}
                    className="flex w-full items-center justify-center gap-1.5 rounded border border-[#2196f3]/30 bg-[#2196f3]/10 px-2 py-1 text-[10px] font-medium text-[#2196f3] hover:bg-[#2196f3]/20 disabled:opacity-50"
                  >
                    <Download size={10} />
                    {chainLoading ? "Loading..." : "Load ATM Option Price"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Realized Vol */}
          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#00c853] mb-2">
              <BarChart3 size={10} /> Realized Vol
            </p>
            <NumberInput
              label="Lookback (trading days)"
              value={lookbackDays}
              onChange={setLookbackDays}
              min={21}
              max={504}
              step={21}
            />
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Method</span>
              <ToggleGroup
                options={["Close-to-Close", "EWMA"]}
                value={realizedMethod}
                onChange={setRealizedMethod}
              />
            </div>
            <button
              onClick={handleFetchHistory}
              disabled={historyLoading || !activeTicker}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-[#00c853]/30 bg-[#00c853]/10 px-2 py-1 text-[10px] font-medium text-[#00c853] hover:bg-[#00c853]/20 disabled:opacity-50"
            >
              <Download size={10} />
              {historyLoading ? "Loading..." : activeTicker ? `Fetch Real History (${activeTicker})` : "Fetch Real History"}
            </button>
          </div>

          <Button onClick={handleAnalyze} loading={loading} className="mt-2 w-full">
            Analyze All Three Vols
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}

          {liveDataSource && (
            <div className="rounded border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/5 px-3 py-1.5">
              <p className="text-[9px] text-[var(--accent-green)]">
                <Zap size={8} className="inline mr-1" />
                Data: {liveDataSource}
              </p>
            </div>
          )}

          {/* Active Profile Summary */}
          {(activeProfile.userAssumedVol || activeProfile.marketImpliedVol || activeProfile.realizedVol) && (
            <div className="border-t border-[var(--border-color)] pt-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Active Vol Profile
              </p>
              <div className="space-y-1 text-[10px]">
                {activeProfile.userAssumedVol && (
                  <div className="flex justify-between">
                    <span className="text-[#ff9800]">User σ</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {(activeProfile.userAssumedVol.value * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {activeProfile.marketImpliedVol && (
                  <div className="flex justify-between">
                    <span className="text-[#2196f3]">Market IV</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {(activeProfile.marketImpliedVol.value * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {activeProfile.realizedVol && (
                  <div className="flex justify-between">
                    <span className="text-[#00c853]">Realized</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {(activeProfile.realizedVol.value * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Results ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {marketIV !== null ? (
          <>
            {/* Three Vol Cards */}
            <div className="grid grid-cols-3 gap-3">
              <VolCard
                label="Your Assumption"
                sublabel="What you believe vol will be — your trading thesis"
                value={userVol / 100}
                color="#ff9800"
                icon={Target}
                sent={sentUser}
                onSend={() => {
                  setUserAssumedVol(userVol / 100, `User (${userVol.toFixed(1)}%)`);
                  setSentUser(true);
                  setTimeout(() => setSentUser(false), 2000);
                }}
              />
              <VolCard
                label="Market Implied"
                sublabel="What the market is pricing in right now"
                value={marketIV}
                color="#2196f3"
                icon={Eye}
                sent={sentIV}
                onSend={() => {
                  setMarketImpliedVol(marketIV, `IV Solver (${(marketIV * 100).toFixed(1)}%)`);
                  setSentIV(true);
                  setTimeout(() => setSentIV(false), 2000);
                }}
              />
              <VolCard
                label="Realized"
                sublabel={`Historical vol over ${lookbackDays} trading days (${realizedMethod})`}
                value={realizedVol}
                color="#00c853"
                icon={BarChart3}
                sent={sentRealized}
                onSend={() => {
                  if (realizedVol !== null) {
                    setRealizedVolCtx(
                      realizedVol,
                      `Realized ${lookbackDays}d (${(realizedVol * 100).toFixed(1)}%)`,
                      lookbackDays,
                      realizedMethod,
                    );
                    setSentRealized(true);
                    setTimeout(() => setSentRealized(false), 2000);
                  }
                }}
              />
            </div>

            {/* Vol Gap Analysis */}
            {volGap && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Volatility Gap Analysis
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  {/* User vs Market */}
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Your σ vs Market IV</p>
                    <p className={`font-mono text-lg font-bold ${
                      volGap.userVsIV > 0.005 ? "text-[var(--accent-red)]" :
                      volGap.userVsIV < -0.005 ? "text-[var(--accent-green)]" :
                      "text-[var(--text-muted)]"
                    }`}>
                      {volGap.userVsIV > 0 ? "+" : ""}{(volGap.userVsIV * 100).toFixed(2)}%
                    </p>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                      {volGap.userVsIV > 0.01
                        ? "You think vol is higher than market — options look cheap to you"
                        : volGap.userVsIV < -0.01
                          ? "You think vol is lower than market — options look expensive to you"
                          : "Your view aligns with the market"
                      }
                    </p>
                  </div>

                  {/* Volatility Risk Premium */}
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Vol Risk Premium (IV − RV)</p>
                    <p className={`font-mono text-lg font-bold ${
                      volGap.vrp !== null && volGap.vrp > 0.005 ? "text-[#ff9800]" :
                      volGap.vrp !== null && volGap.vrp < -0.005 ? "text-[#ab47bc]" :
                      "text-[var(--text-muted)]"
                    }`}>
                      {volGap.vrp !== null
                        ? `${volGap.vrp > 0 ? "+" : ""}${(volGap.vrp * 100).toFixed(2)}%`
                        : "—"
                      }
                    </p>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                      {volGap.vrp !== null && volGap.vrp > 0.02
                        ? "Market is pricing in more vol than realized — premium sellers may benefit"
                        : volGap.vrp !== null && volGap.vrp < -0.02
                          ? "Realized vol exceeds implied — vol is under-priced historically"
                          : "IV and RV are roughly aligned"
                      }
                    </p>
                  </div>

                  {/* User vs Realized */}
                  <div>
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Your σ vs Realized</p>
                    <p className={`font-mono text-lg font-bold ${
                      volGap.userVsRealized !== null && volGap.userVsRealized > 0.005 ? "text-[var(--accent-red)]" :
                      volGap.userVsRealized !== null && volGap.userVsRealized < -0.005 ? "text-[var(--accent-green)]" :
                      "text-[var(--text-muted)]"
                    }`}>
                      {volGap.userVsRealized !== null
                        ? `${volGap.userVsRealized > 0 ? "+" : ""}${(volGap.userVsRealized * 100).toFixed(2)}%`
                        : "—"
                      }
                    </p>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                      {volGap.userVsRealized !== null && volGap.userVsRealized > 0.03
                        ? "Your assumption is significantly above historical — strong conviction needed"
                        : volGap.userVsRealized !== null && volGap.userVsRealized < -0.03
                          ? "Your assumption is below historical — you expect calmer markets"
                          : "Your view is consistent with historical patterns"
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Price Impact Comparison */}
            {priceComparison && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Price Impact: Same Option, Different Vols
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-[#ff9800]/30 bg-[#ff9800]/5 px-3 py-2">
                    <p className="text-[10px] text-[#ff9800]">At Your Vol ({userVol.toFixed(1)}%)</p>
                    <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                      ${priceComparison.priceAtUser.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded border border-[#2196f3]/30 bg-[#2196f3]/5 px-3 py-2">
                    <p className="text-[10px] text-[#2196f3]">At Market IV ({(marketIV * 100).toFixed(1)}%)</p>
                    <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                      ${priceComparison.priceAtIV.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded border border-[#00c853]/30 bg-[#00c853]/5 px-3 py-2">
                    <p className="text-[10px] text-[#00c853]">
                      At Realized ({realizedVol !== null ? (realizedVol * 100).toFixed(1) : "—"}%)
                    </p>
                    <p className="font-mono text-lg font-bold text-[var(--text-primary)]">
                      {priceComparison.priceAtRealized !== null
                        ? `$${priceComparison.priceAtRealized.toFixed(4)}`
                        : "—"
                      }
                    </p>
                  </div>
                </div>
                {priceComparison.priceAtUser !== priceComparison.priceAtIV && (
                  <div className="mt-3 flex items-start gap-2 rounded border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5 px-3 py-2">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      {priceComparison.priceAtUser > priceComparison.priceAtIV
                        ? `At your higher vol assumption, this option is worth $${(priceComparison.priceAtUser - priceComparison.priceAtIV).toFixed(4)} more than the market price. If you believe your vol is correct, buying this option at market price could be attractive.`
                        : `At your lower vol assumption, this option is worth $${(priceComparison.priceAtIV - priceComparison.priceAtUser).toFixed(4)} less than the market price. If you believe your vol is correct, selling this option at market price could be attractive.`
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Vol Comparison Bar Chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  {
                    x: [
                      "Your Assumption",
                      "Market Implied",
                      ...(realizedVol !== null ? ["Realized (C2C)"] : []),
                    ],
                    y: [
                      userVol,
                      marketIV * 100,
                      ...(realizedVol !== null ? [realizedVol * 100] : []),
                    ],
                    type: "bar" as const,
                    marker: {
                      color: [
                        "#ff9800",
                        "#2196f3",
                        ...(realizedVol !== null ? ["#00c853"] : []),
                      ],
                      opacity: 0.8,
                    },
                    text: [
                      `${userVol.toFixed(1)}%`,
                      `${(marketIV * 100).toFixed(1)}%`,
                      ...(realizedVol !== null ? [`${(realizedVol * 100).toFixed(1)}%`] : []),
                    ],
                    textposition: "auto" as const,
                    textfont: { color: "#e0e0e0", size: 12 },
                    showlegend: false,
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: {
                    text: "Three Volatilities Compared",
                    font: { size: 12, color: "#e0e0e0" },
                  },
                  yaxis: {
                    ...DARK_LAYOUT.yaxis,
                    title: { text: "Vol (%)", font: { size: 10 } },
                  },
                  showlegend: false,
                  bargap: 0.4,
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "280px" }}
              />
            </div>

            {/* Rolling Realized Vol Chart */}
            {realizedRolling && realizedRolling.rolling_vol.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[
                    {
                      x: realizedRolling.rolling_indices,
                      y: realizedRolling.rolling_vol.map((v) => v * 100),
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: "Rolling Close-to-Close",
                      line: { color: "#00c853", width: 1.5 },
                    },
                    ...(realizedRolling.ewma_vol_series.length > 0
                      ? [{
                          x: realizedRolling.ewma_indices,
                          y: realizedRolling.ewma_vol_series.map((v: number) => v * 100),
                          type: "scatter" as const,
                          mode: "lines" as const,
                          name: "EWMA (λ=0.94)",
                          line: { color: "#ab47bc", width: 1.5 },
                        }]
                      : []),
                    // Horizontal lines for user vol and market IV
                    {
                      x: [realizedRolling.rolling_indices[0], realizedRolling.rolling_indices[realizedRolling.rolling_indices.length - 1]],
                      y: [userVol, userVol],
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: `Your Vol (${userVol.toFixed(1)}%)`,
                      line: { color: "#ff9800", width: 1.5, dash: "dash" as const },
                    },
                    {
                      x: [realizedRolling.rolling_indices[0], realizedRolling.rolling_indices[realizedRolling.rolling_indices.length - 1]],
                      y: [marketIV * 100, marketIV * 100],
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: `Market IV (${(marketIV * 100).toFixed(1)}%)`,
                      line: { color: "#2196f3", width: 1.5, dash: "dot" as const },
                    },
                  ]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: {
                      text: "Rolling Realized Vol vs Assumed & Implied",
                      font: { size: 12, color: "#e0e0e0" },
                    },
                    xaxis: {
                      ...DARK_LAYOUT.xaxis,
                      title: { text: "Trading Day", font: { size: 10 } },
                    },
                    yaxis: {
                      ...DARK_LAYOUT.yaxis,
                      title: { text: "Vol (%)", font: { size: 10 } },
                    },
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "300px" }}
                />
              </div>
            )}

            {/* Educational Explanation */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Why Three Volatilities?
              </h4>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex gap-2">
                  <Target size={14} className="mt-0.5 shrink-0 text-[#ff9800]" />
                  <div>
                    <p className="font-medium text-[#ff9800]">Your Assumption</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                      This is your forward-looking view — what you believe volatility will actually be.
                      It drives your pricing decisions and P&L expectations.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Eye size={14} className="mt-0.5 shrink-0 text-[#2196f3]" />
                  <div>
                    <p className="font-medium text-[#2196f3]">Market Implied</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                      What the market consensus is — embedded in option prices right now.
                      The gap between your vol and IV is your edge (or risk).
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <BarChart3 size={14} className="mt-0.5 shrink-0 text-[#00c853]" />
                  <div>
                    <p className="font-medium text-[#00c853]">Realized</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                      What actually happened — backward-looking historical vol.
                      Compares what the market expected (IV) vs what occurred.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center max-w-md">
              <p className="text-sm text-[var(--text-muted)]">
                Configure your assumptions and click &quot;Analyze All Three Vols&quot;
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                Compare your assumed volatility against market-implied vol and realized vol.
                Understand whether the market agrees with your view, and where the vol risk premium lies.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
                <div className="rounded border border-[#ff9800]/30 bg-[#ff9800]/5 px-2 py-1">
                  <Target size={12} className="mx-auto text-[#ff9800] mb-1" />
                  <p className="text-[#ff9800]">Your View</p>
                </div>
                <div className="rounded border border-[#2196f3]/30 bg-[#2196f3]/5 px-2 py-1">
                  <Eye size={12} className="mx-auto text-[#2196f3] mb-1" />
                  <p className="text-[#2196f3]">Market Price</p>
                </div>
                <div className="rounded border border-[#00c853]/30 bg-[#00c853]/5 px-2 py-1">
                  <BarChart3 size={12} className="mx-auto text-[#00c853] mb-1" />
                  <p className="text-[#00c853]">History</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
