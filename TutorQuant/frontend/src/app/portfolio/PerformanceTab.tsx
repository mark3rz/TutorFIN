"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { Button } from "@/components/ui/Button";
import { bsmPrice, computeAllGreeks, linspace } from "@/lib/greeksEngine";
import { Play, AlertTriangle, TrendingUp, TrendingDown, Minus, Target, Eye, BarChart3, Lightbulb, Shield } from "lucide-react";
import type { AssumptionProfile } from "@/context/WorkbenchContext";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: "#0e0e14",
  plot_bgcolor: "#141420",
  font: { color: "#e0e0e0", family: "monospace", size: 11 },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  yaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  showlegend: true,
  legend: {
    font: { size: 9, color: "#8888aa" },
    bgcolor: "rgba(0,0,0,0)",
    x: 0.01,
    y: 0.99,
  },
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

interface PortfolioLeg {
  spot: number;
  strike: number;
  expiryYears: number;
  riskFreeRate: number;
  volatility: number;
  dividendYield: number;
  optionType: "call" | "put";
  side: "long" | "short";
  quantity: number;
  premium: number;
}

interface SimulationResult {
  timeSteps: number[];
  meanPortfolioValue: number[];
  p5PortfolioValue: number[];
  p95PortfolioValue: number[];
  benchmarkValue: number[];
  riskFreeValue: number[];
  meanDelta: number[];
  meanGamma: number[];
  meanTheta: number[];
  meanVega: number[];
  finalReturns: number[];
  benchmarkReturn: number;
  riskFreeReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  attribution: {
    deltaContribution: number;
    gammaContribution: number;
    thetaContribution: number;
    vegaContribution: number;
    volGapContribution: number;
    unexplained: number;
  };
  /** Value at each vol for comparison */
  valueAtUserVol: number;
  valueAtMarketIV: number;
  valueAtRealizedVol: number;
}

interface HedgeResult {
  label: string;
  color: string;
  rebalanceFreq: string;
  finalHedgeErrors: number[];
  meanError: number;
  stdError: number;
  totalCosts: number[];
  meanCost: number;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GBM Simulation Engine (all client-side)                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function createSeededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function seededRandn(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function runSimulation(
  legs: PortfolioLeg[],
  numPaths: number,
  numSteps: number,
  seed: number,
  marketIV: number | null,
  realizedVol: number | null,
): SimulationResult {
  if (legs.length === 0) return emptyResult();

  const rng = createSeededRng(seed);
  const avgSpot = legs.reduce((s, l) => s + l.spot * l.quantity, 0) /
    legs.reduce((s, l) => s + l.quantity, 0);
  const maxExpiry = Math.max(...legs.map((l) => l.expiryYears));
  const avgVol = legs.reduce((s, l) => s + l.volatility * l.quantity, 0) /
    legs.reduce((s, l) => s + l.quantity, 0);
  const avgRate = legs.reduce((s, l) => s + l.riskFreeRate * l.quantity, 0) /
    legs.reduce((s, l) => s + l.quantity, 0);
  const avgDiv = legs.reduce((s, l) => s + l.dividendYield * l.quantity, 0) /
    legs.reduce((s, l) => s + l.quantity, 0);

  // Use realized vol for simulation (actual market movement) if available, otherwise user vol
  const simVol = realizedVol !== null ? realizedVol : avgVol;
  const dt = maxExpiry / numSteps;
  const drift = (avgRate - avgDiv - 0.5 * simVol * simVol) * dt;
  const diffusion = simVol * Math.sqrt(dt);

  const initialValue = computePortfolioValue(legs, avgSpot, 0);
  const allPathValues: number[][] = Array.from({ length: numPaths }, () => new Array(numSteps + 1));
  const allSpotPaths: number[][] = Array.from({ length: numPaths }, () => new Array(numSteps + 1));

  const deltaSums = new Float64Array(numSteps + 1);
  const gammaSums = new Float64Array(numSteps + 1);
  const thetaSums = new Float64Array(numSteps + 1);
  const vegaSums = new Float64Array(numSteps + 1);

  for (let p = 0; p < numPaths; p++) {
    let spot = avgSpot;
    allSpotPaths[p][0] = spot;
    allPathValues[p][0] = initialValue;

    for (let t = 1; t <= numSteps; t++) {
      const z = seededRandn(rng);
      spot = spot * Math.exp(drift + diffusion * z);
      allSpotPaths[p][t] = spot;

      const elapsed = t * dt;
      const portValue = computePortfolioValue(legs, spot, elapsed);
      allPathValues[p][t] = portValue;

      if (p === 0) {
        const greeks = computePortfolioGreeks(legs, spot, elapsed);
        deltaSums[t] = greeks.delta;
        gammaSums[t] = greeks.gamma;
        thetaSums[t] = greeks.theta;
        vegaSums[t] = greeks.vega;
      }
    }
  }

  const initGreeks = computePortfolioGreeks(legs, avgSpot, 0);
  deltaSums[0] = initGreeks.delta;
  gammaSums[0] = initGreeks.gamma;
  thetaSums[0] = initGreeks.theta;
  vegaSums[0] = initGreeks.vega;

  const timeSteps = linspace(0, maxExpiry, numSteps + 1);
  const meanPortfolioValue: number[] = [];
  const p5PortfolioValue: number[] = [];
  const p95PortfolioValue: number[] = [];
  const benchmarkValue: number[] = [];
  const riskFreeValue: number[] = [];
  const finalReturns: number[] = [];

  for (let t = 0; t <= numSteps; t++) {
    const values = allPathValues.map((path) => path[t]);
    values.sort((a, b) => a - b);
    meanPortfolioValue.push(values.reduce((s, v) => s + v, 0) / numPaths);
    p5PortfolioValue.push(values[Math.floor(numPaths * 0.05)] ?? values[0]);
    p95PortfolioValue.push(values[Math.floor(numPaths * 0.95)] ?? values[values.length - 1]);
    const avgPathSpot = allSpotPaths.reduce((s, path) => s + path[t], 0) / numPaths;
    benchmarkValue.push(initialValue * (avgPathSpot / avgSpot));
    const elapsed = t * dt;
    riskFreeValue.push(initialValue * Math.exp(avgRate * elapsed));
  }

  for (let p = 0; p < numPaths; p++) {
    const finalVal = allPathValues[p][numSteps];
    finalReturns.push((finalVal - initialValue) / Math.abs(initialValue));
  }

  const benchmarkReturn = (benchmarkValue[numSteps] - initialValue) / Math.abs(initialValue);
  const riskFreeReturn = (riskFreeValue[numSteps] - initialValue) / Math.abs(initialValue);

  let peak = meanPortfolioValue[0];
  let maxDD = 0;
  for (const v of meanPortfolioValue) {
    if (v > peak) peak = v;
    const dd = (peak - v) / Math.abs(peak);
    if (dd > maxDD) maxDD = dd;
  }

  const meanReturn = finalReturns.reduce((s, r) => s + r, 0) / numPaths;
  const variance = finalReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / numPaths;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 1e-10 ? (meanReturn - avgRate * maxExpiry) / stdDev : 0;

  // Enhanced attribution with vol gap
  const meanFinalReturn = meanReturn * Math.abs(initialValue);
  const spotChange = (benchmarkValue[numSteps] / initialValue) * avgSpot - avgSpot;

  // Vol gap: difference in portfolio value when priced at user vol vs market IV
  const volGapContribution = marketIV !== null
    ? computePortfolioValue(legs, avgSpot, 0) -
      computePortfolioValueAtVol(legs, avgSpot, 0, marketIV)
    : 0;

  const attribution = {
    deltaContribution: initGreeks.delta * spotChange,
    gammaContribution: 0.5 * initGreeks.gamma * spotChange * spotChange,
    thetaContribution: initGreeks.theta * maxExpiry,
    vegaContribution: 0,
    volGapContribution,
    unexplained: 0,
  };
  attribution.unexplained = meanFinalReturn -
    attribution.deltaContribution -
    attribution.gammaContribution -
    attribution.thetaContribution -
    attribution.vegaContribution -
    attribution.volGapContribution;

  // Value at each vol for comparison
  const valueAtUserVol = initialValue;
  const valueAtMarketIV = marketIV !== null
    ? computePortfolioValueAtVol(legs, avgSpot, 0, marketIV)
    : initialValue;
  const valueAtRealizedVol = realizedVol !== null
    ? computePortfolioValueAtVol(legs, avgSpot, 0, realizedVol)
    : initialValue;

  return {
    timeSteps, meanPortfolioValue, p5PortfolioValue, p95PortfolioValue,
    benchmarkValue, riskFreeValue,
    meanDelta: Array.from(deltaSums), meanGamma: Array.from(gammaSums),
    meanTheta: Array.from(thetaSums), meanVega: Array.from(vegaSums),
    finalReturns, benchmarkReturn, riskFreeReturn, maxDrawdown: maxDD, sharpeRatio: sharpe,
    attribution, valueAtUserVol, valueAtMarketIV, valueAtRealizedVol,
  };
}

function computePortfolioValue(legs: PortfolioLeg[], currentSpot: number, elapsedYears: number): number {
  let total = 0;
  for (const leg of legs) {
    const remainingT = Math.max(leg.expiryYears - elapsedYears, 0);
    const price = bsmPrice(currentSpot, leg.strike, remainingT, leg.riskFreeRate, leg.volatility, leg.dividendYield, leg.optionType === "call");
    const direction = leg.side === "long" ? 1 : -1;
    total += direction * price * leg.quantity;
  }
  return total;
}

function computePortfolioValueAtVol(legs: PortfolioLeg[], currentSpot: number, elapsedYears: number, vol: number): number {
  let total = 0;
  for (const leg of legs) {
    const remainingT = Math.max(leg.expiryYears - elapsedYears, 0);
    const price = bsmPrice(currentSpot, leg.strike, remainingT, leg.riskFreeRate, vol, leg.dividendYield, leg.optionType === "call");
    const direction = leg.side === "long" ? 1 : -1;
    total += direction * price * leg.quantity;
  }
  return total;
}

function computePortfolioGreeks(legs: PortfolioLeg[], currentSpot: number, elapsedYears: number) {
  let delta = 0, gamma = 0, theta = 0, vega = 0;
  for (const leg of legs) {
    const remainingT = Math.max(leg.expiryYears - elapsedYears, 0);
    if (remainingT <= 0) continue;
    const greeks = computeAllGreeks(currentSpot, leg.strike, remainingT, leg.riskFreeRate, leg.volatility, leg.dividendYield, leg.optionType === "call");
    const direction = leg.side === "long" ? 1 : -1;
    delta += direction * greeks.delta * leg.quantity;
    gamma += direction * greeks.gamma * leg.quantity;
    theta += direction * greeks.theta * leg.quantity;
    vega += direction * greeks.vega * leg.quantity;
  }
  return { delta, gamma, theta, vega };
}

function emptyResult(): SimulationResult {
  return {
    timeSteps: [], meanPortfolioValue: [], p5PortfolioValue: [], p95PortfolioValue: [],
    benchmarkValue: [], riskFreeValue: [],
    meanDelta: [], meanGamma: [], meanTheta: [], meanVega: [],
    finalReturns: [], benchmarkReturn: 0, riskFreeReturn: 0,
    maxDrawdown: 0, sharpeRatio: 0,
    attribution: { deltaContribution: 0, gammaContribution: 0, thetaContribution: 0, vegaContribution: 0, volGapContribution: 0, unexplained: 0 },
    valueAtUserVol: 0, valueAtMarketIV: 0, valueAtRealizedVol: 0,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Hedging Simulation (client-side delta hedge)                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function runHedgeSim(
  legs: PortfolioLeg[],
  numPaths: number,
  numSteps: number,
  rebalanceEvery: number,
  seed: number,
): HedgeResult {
  const rng = createSeededRng(seed);
  const avgSpot = legs.reduce((s, l) => s + l.spot * l.quantity, 0) / legs.reduce((s, l) => s + l.quantity, 0);
  const maxExpiry = Math.max(...legs.map((l) => l.expiryYears));
  const avgVol = legs.reduce((s, l) => s + l.volatility * l.quantity, 0) / legs.reduce((s, l) => s + l.quantity, 0);
  const avgRate = legs.reduce((s, l) => s + l.riskFreeRate * l.quantity, 0) / legs.reduce((s, l) => s + l.quantity, 0);
  const avgDiv = legs.reduce((s, l) => s + l.dividendYield * l.quantity, 0) / legs.reduce((s, l) => s + l.quantity, 0);

  const dt = maxExpiry / numSteps;
  const drift = (avgRate - avgDiv - 0.5 * avgVol * avgVol) * dt;
  const diffusion = avgVol * Math.sqrt(dt);
  const txCostRate = 0.001; // 10bps per share

  const finalErrors: number[] = [];
  const totalCosts: number[] = [];

  for (let p = 0; p < numPaths; p++) {
    let spot = avgSpot;
    let hedgeShares = 0;
    let cash = computePortfolioValue(legs, avgSpot, 0); // Initial option premium received
    let txCost = 0;

    for (let t = 1; t <= numSteps; t++) {
      const z = seededRandn(rng);
      spot = spot * Math.exp(drift + diffusion * z);
      const elapsed = t * dt;

      // Rebalance hedge?
      if (t % rebalanceEvery === 0 || t === numSteps) {
        const greeks = computePortfolioGreeks(legs, spot, elapsed);
        const targetShares = -greeks.delta; // hedge the delta
        const tradeShares = targetShares - hedgeShares;
        const cost = Math.abs(tradeShares) * spot * txCostRate;
        cash -= tradeShares * spot + cost;
        txCost += cost;
        hedgeShares = targetShares;
      }

      // Accrue interest on cash
      cash *= Math.exp(avgRate * dt);
    }

    // Final P&L: hedge portfolio value + option payoff
    const finalOptionValue = computePortfolioValue(legs, spot, maxExpiry);
    const hedgePnL = cash + hedgeShares * spot - finalOptionValue;
    finalErrors.push(hedgePnL);
    totalCosts.push(txCost);
  }

  const meanError = finalErrors.reduce((s, e) => s + e, 0) / numPaths;
  const variance = finalErrors.reduce((s, e) => s + (e - meanError) ** 2, 0) / numPaths;

  return {
    label: "",
    color: "",
    rebalanceFreq: "",
    finalHedgeErrors: finalErrors,
    meanError,
    stdError: Math.sqrt(variance),
    totalCosts,
    meanCost: totalCosts.reduce((s, c) => s + c, 0) / numPaths,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Explanation Engine                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function generateExplanation(
  result: SimulationResult,
  profile: AssumptionProfile | null,
): string[] {
  const explanations: string[] = [];
  const { attribution } = result;
  const totalPnL = attribution.deltaContribution + attribution.gammaContribution +
    attribution.thetaContribution + attribution.vegaContribution +
    attribution.volGapContribution + attribution.unexplained;

  // Directional explanation
  if (Math.abs(attribution.deltaContribution) > 0.01) {
    const direction = attribution.deltaContribution > 0 ? "favorable" : "unfavorable";
    explanations.push(
      `The underlying moved in a ${direction} direction for your positions, contributing ${attribution.deltaContribution > 0 ? "+" : ""}${attribution.deltaContribution.toFixed(2)} via delta.`
    );
  }

  // Gamma explanation
  if (attribution.gammaContribution > 0.01) {
    explanations.push(
      `Your long gamma position benefited from the underlying's movement — the further it moved, the more you gained. Gamma added +${attribution.gammaContribution.toFixed(2)}.`
    );
  } else if (attribution.gammaContribution < -0.01) {
    explanations.push(
      `Your short gamma position was hurt by the underlying's movement. Gamma cost you ${attribution.gammaContribution.toFixed(2)}.`
    );
  }

  // Theta explanation
  if (attribution.thetaContribution < -0.01) {
    explanations.push(
      `Time decay eroded ${Math.abs(attribution.thetaContribution).toFixed(2)} of value. This is the daily cost of carrying long option positions.`
    );
  } else if (attribution.thetaContribution > 0.01) {
    explanations.push(
      `You earned +${attribution.thetaContribution.toFixed(2)} from time decay, indicating you're net short options and collecting premium.`
    );
  }

  // Vol gap explanation
  if (profile && profile.userAssumedVol && profile.marketImpliedVol) {
    const userV = profile.userAssumedVol.value;
    const ivV = profile.marketImpliedVol.value;
    const gap = userV - ivV;
    if (Math.abs(gap) > 0.005) {
      const direction = gap > 0 ? "above" : "below";
      explanations.push(
        `Your vol assumption (${(userV * 100).toFixed(1)}%) is ${(Math.abs(gap) * 100).toFixed(1)} points ${direction} market IV (${(ivV * 100).toFixed(1)}%). ` +
        (gap > 0
          ? "You're effectively saying options are cheaper than they should be — a long vol view."
          : "You're effectively saying options are richer than they should be — a short vol view."
        )
      );
    }
  }

  // VRP explanation
  if (profile && profile.marketImpliedVol && profile.realizedVol) {
    const iv = profile.marketImpliedVol.value;
    const rv = profile.realizedVol.value;
    const vrp = iv - rv;
    if (Math.abs(vrp) > 0.01) {
      explanations.push(
        `The volatility risk premium (IV − RV) is ${(vrp * 100).toFixed(1)}%. ` +
        (vrp > 0
          ? "Implied vol exceeds realized vol — premium sellers are collecting a risk premium."
          : "Realized vol exceeds implied — vol has been underpriced historically."
        )
      );
    }
  }

  // Overall
  if (totalPnL > 0) {
    explanations.push(
      `Overall, your portfolio generated positive P&L of +${totalPnL.toFixed(2)}. The primary driver was ${
        Math.abs(attribution.deltaContribution) > Math.abs(attribution.gammaContribution) ? "directional movement (delta)" : "convexity (gamma)"
      }.`
    );
  } else if (totalPnL < 0) {
    explanations.push(
      `Overall, your portfolio lost ${totalPnL.toFixed(2)}. ${
        attribution.thetaContribution < -Math.abs(totalPnL) * 0.5
          ? "Time decay was the dominant drag."
          : "The directional move was unfavorable."
      }`
    );
  }

  return explanations;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Improvement Engine                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function generateImprovements(
  result: SimulationResult,
  profile: AssumptionProfile | null,
): string[] {
  const suggestions: string[] = [];
  const { attribution } = result;
  const totalPnL = attribution.deltaContribution + attribution.gammaContribution +
    attribution.thetaContribution + attribution.volGapContribution + attribution.unexplained;

  if (attribution.thetaContribution < -Math.abs(totalPnL) * 0.3 && totalPnL !== 0) {
    suggestions.push(
      "Theta was a significant drag. Consider selling premium (covered calls, credit spreads) to offset time decay, or use shorter-dated options closer to expiry where gamma/theta ratio improves."
    );
  }

  if (Math.abs(attribution.deltaContribution) > Math.abs(totalPnL) * 0.7 && totalPnL !== 0) {
    suggestions.push(
      "Your P&L was primarily directional. If you have a vol view rather than a directional view, consider delta-hedging to isolate the volatility bet."
    );
  }

  if (attribution.gammaContribution > 0 && attribution.thetaContribution < 0) {
    suggestions.push(
      "Classic long vol profile: earning gamma but paying theta. The breakeven daily move is approximately √(2|θ|/Γ). Consider whether the underlying is volatile enough to justify the theta cost."
    );
  }

  if (result.maxDrawdown > 0.15) {
    suggestions.push(
      `Max drawdown of ${(result.maxDrawdown * 100).toFixed(1)}% is significant. Consider position sizing rules (e.g., max 2-5% of capital per trade) or stop-loss levels to cap drawdown.`
    );
  }

  if (result.sharpeRatio < 0) {
    suggestions.push(
      "Negative Sharpe ratio — the portfolio underperformed the risk-free rate on a risk-adjusted basis. Reassess whether the option structure adds value over holding cash."
    );
  }

  // Vol profile based suggestions
  if (profile?.userAssumedVol && profile?.marketImpliedVol) {
    const gap = profile.userAssumedVol.value - profile.marketImpliedVol.value;
    if (gap > 0.03) {
      suggestions.push(
        "Your vol assumption is significantly above market IV. If correct, long straddles/strangles or butterfly purchases may offer better risk/reward than directional options."
      );
    } else if (gap < -0.03) {
      suggestions.push(
        "Your vol assumption is significantly below market IV. Consider selling premium (iron condors, credit spreads) to profit if realized vol stays low."
      );
    }
  }

  if (profile?.realizedVol && profile?.marketImpliedVol) {
    const vrp = profile.marketImpliedVol.value - profile.realizedVol.value;
    if (vrp > 0.03) {
      suggestions.push(
        "High VRP (IV >> RV): Historically this has favored premium sellers. Consider systematic short vol strategies with defined risk (spreads, condors)."
      );
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Your portfolio is well-positioned. Continue monitoring Greek exposures and vol assumptions as market conditions evolve."
    );
  }

  return suggestions;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Attribution Panel                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function AttributionPanel({ result, profile }: { result: SimulationResult; profile: AssumptionProfile | null }) {
  const { attribution } = result;

  const items = [
    { label: "Delta (Directional)", value: attribution.deltaContribution, color: "#ff9800" },
    { label: "Gamma (Convexity)", value: attribution.gammaContribution, color: "#2196f3" },
    { label: "Theta (Time Decay)", value: attribution.thetaContribution, color: "#ab47bc" },
    { label: "Vega (Volatility)", value: attribution.vegaContribution, color: "#00c853" },
    { label: "Vol Gap (σ_user vs IV)", value: attribution.volGapContribution, color: "#ff5722" },
    { label: "Higher-Order / Unexplained", value: attribution.unexplained, color: "#8888aa" },
  ];

  const totalPnL = items.reduce((s, i) => s + i.value, 0);
  const explanations = generateExplanation(result, profile);
  const improvements = generateImprovements(result, profile);

  return (
    <div className="space-y-4">
      {/* Greek Attribution Breakdown */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          P&L Attribution by Greek
        </h4>
        <div className="space-y-2">
          {items.map((item) => {
            const pct = totalPnL !== 0 ? (item.value / Math.abs(totalPnL)) * 100 : 0;
            const barWidth = Math.min(Math.abs(pct), 100);
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="w-[180px] text-xs text-[var(--text-secondary)]">{item.label}</span>
                <div className="flex-1 h-3 rounded bg-[#1a1a2e] relative overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: item.color, opacity: 0.7 }}
                  />
                </div>
                <span className={`w-[80px] text-right font-mono text-xs ${
                  item.value > 0.01 ? "text-[var(--accent-green)]" :
                  item.value < -0.01 ? "text-[var(--accent-red)]" :
                  "text-[var(--text-muted)]"
                }`}>
                  {item.value >= 0 ? "+" : ""}{item.value.toFixed(2)}
                </span>
              </div>
            );
          })}
          <div className="border-t border-[var(--border-color)] pt-2 flex items-center gap-3">
            <span className="w-[180px] text-xs font-semibold text-[var(--text-primary)]">Total P&L</span>
            <div className="flex-1" />
            <span className={`w-[80px] text-right font-mono text-xs font-bold ${
              totalPnL > 0.01 ? "text-[var(--accent-green)]" :
              totalPnL < -0.01 ? "text-[var(--accent-red)]" :
              "text-[var(--text-muted)]"
            }`}>
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Explanation Engine */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <Lightbulb size={10} className="text-[var(--accent-primary)]" />
          What Happened & Why
        </h4>
        <div className="space-y-2">
          {explanations.map((explanation, i) => (
            <div key={i} className="flex gap-2 text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="mt-0.5 shrink-0 text-[var(--accent-primary)]">•</span>
              <span>{explanation}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Suggestions */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <h4 className="mb-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <Target size={10} className="text-[#00c853]" />
          How You Could Improve
        </h4>
        <div className="space-y-2">
          {improvements.map((suggestion, i) => (
            <div key={i} className="flex gap-2 text-xs text-[var(--text-secondary)] leading-relaxed">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
              <span>{suggestion}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main PerformanceTab                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

import type { Position, BondPosition } from "./PositionsTab";

export interface PerformanceTabProps {
  positions: Position[];
  bondPositions: BondPosition[];
  riskFreeRate: number;
  volatility: number;
  volProfile?: AssumptionProfile | null;
}

export function PerformanceTab({ positions, bondPositions, riskFreeRate, volatility, volProfile }: PerformanceTabProps) {
  const [numPaths, setNumPaths] = useState(200);
  const [numSteps, setNumSteps] = useState(100);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [hedgeResults, setHedgeResults] = useState<HedgeResult[]>([]);
  const [running, setRunning] = useState(false);

  const profile = volProfile ?? null;

  const buildLegs = useCallback((): PortfolioLeg[] => {
    const vol = volatility / 100;
    const rate = riskFreeRate / 100;
    return positions.map((pos) => ({
      spot: pos.spot,
      strike: pos.strike,
      expiryYears: pos.expiry_years,
      riskFreeRate: rate,
      volatility: vol,
      dividendYield: pos.dividend_yield / 100,
      optionType: pos.option_type as "call" | "put",
      side: pos.side as "long" | "short",
      quantity: pos.quantity,
      premium: 0,
    }));
  }, [positions, volatility, riskFreeRate]);

  const hasPositions = positions.length > 0;

  function handleRun() {
    if (!hasPositions) return;
    setRunning(true);
    setSimResult(null);
    setHedgeResults([]);

    const legs = buildLegs();
    const marketIV = profile?.marketImpliedVol?.value ?? null;
    const realizedV = profile?.realizedVol?.value ?? null;

    requestAnimationFrame(() => {
      // Main simulation
      const result = runSimulation(legs, numPaths, numSteps, 42, marketIV, realizedV);
      setSimResult(result);

      // Hedging simulation at different rebalance frequencies
      const hedgeConfigs = [
        { steps: 1, label: "Every Step (Continuous)", color: "#00c853", freq: "Every time step" },
        { steps: 5, label: "Every 5 Steps", color: "#2196f3", freq: "Every 5 time steps" },
        { steps: 20, label: "Every 20 Steps (Weekly)", color: "#ff9800", freq: "~Weekly" },
      ];

      const hedgeRes: HedgeResult[] = hedgeConfigs.map((cfg) => {
        const h = runHedgeSim(legs, Math.min(numPaths, 100), numSteps, cfg.steps, 42);
        return { ...h, label: cfg.label, color: cfg.color, rebalanceFreq: cfg.freq };
      });
      setHedgeResults(hedgeRes);

      setRunning(false);
    });
  }

  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full">
      {/* ── LEFT: Portfolio Summary & Config ────────────────────── */}
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Portfolio to Simulate
          </h3>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {hasPositions ? (
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Option Legs ({positions.length})
              </p>
              {positions.map((pos) => (
                <div key={pos.id} className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {pos.side === "long" ? "L" : "S"} {pos.strike}{pos.option_type === "call" ? "C" : "P"} ×{pos.quantity}
                    </span>
                    <span className="text-[var(--text-muted)]">S={pos.spot} T={pos.expiry_years}y</span>
                  </div>
                </div>
              ))}

              {bondPositions.length > 0 && (
                <>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#2196f3] mt-2">
                    Bonds ({bondPositions.length})
                  </p>
                  {bondPositions.map((bond) => (
                    <div key={bond.id} className="rounded border border-[#2196f3]/30 bg-[#0a0a0f] px-3 py-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {bond.side === "long" ? "L" : "S"} Bond ×{bond.quantity}
                        </span>
                        <span className="text-[var(--text-muted)]">{(bond.couponRate * 100).toFixed(1)}% / {bond.maturityYears}y</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Vol Profile Summary */}
              {profile && (profile.userAssumedVol || profile.marketImpliedVol || profile.realizedVol) && (
                <div className="border-t border-[var(--border-color)] pt-2 mt-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#ab47bc]">
                    Vol Profile
                  </p>
                  <div className="mt-1 space-y-0.5 text-[10px]">
                    {profile.userAssumedVol && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-[#ff9800]"><Target size={8} /> Your σ</span>
                        <span className="font-mono text-[var(--text-primary)]">{(profile.userAssumedVol.value * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {profile.marketImpliedVol && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-[#2196f3]"><Eye size={8} /> Market IV</span>
                        <span className="font-mono text-[var(--text-primary)]">{(profile.marketImpliedVol.value * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {profile.realizedVol && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-[#00c853]"><BarChart3 size={8} /> Realized</span>
                        <span className="font-mono text-[var(--text-primary)]">{(profile.realizedVol.value * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-[var(--border-color)] pt-2 mt-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Portfolio Assumptions
                </p>
                <div className="grid grid-cols-2 gap-x-3 mt-1 text-[10px]">
                  <p className="text-[var(--text-muted)]">Vol (σ): <span className="text-[var(--text-primary)] font-mono">{volatility.toFixed(1)}%</span></p>
                  <p className="text-[var(--text-muted)]">Rate (r): <span className="text-[var(--text-primary)] font-mono">{riskFreeRate.toFixed(2)}%</span></p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-[var(--border-color)] bg-[#0a0a0f] px-3 py-4 text-center">
              <p className="text-[10px] text-[var(--text-muted)]">No positions yet</p>
              <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                Build your portfolio on the Positions tab first
              </p>
            </div>
          )}

          <div className="border-t border-[var(--border-color)] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Monte Carlo Config
            </p>
            <div className="space-y-2">
              <NumberInput label="Paths" value={numPaths} onChange={setNumPaths} min={50} max={1000} step={50} />
              <NumberInput label="Time Steps" value={numSteps} onChange={setNumSteps} min={20} max={500} step={10} />
            </div>
          </div>

          <Button onClick={handleRun} loading={running} disabled={!hasPositions} className="mt-2 w-full">
            <Play size={14} className="mr-1" />
            Run Simulation
          </Button>
        </div>
      </div>

      {/* ── CENTER: Results ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {simResult && simResult.timeSteps.length > 0 ? (
          <>
            {/* Performance Summary Cards */}
            {(() => {
              const portReturn = simResult.finalReturns.reduce((s, r) => s + r, 0) / simResult.finalReturns.length;
              return (
                <div className="grid grid-cols-5 gap-3">
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Portfolio Return</p>
                    <div className="mt-1 flex items-center gap-1">
                      {portReturn > 0 ? <TrendingUp size={16} className="text-[var(--accent-green)]" /> : portReturn < 0 ? <TrendingDown size={16} className="text-[var(--accent-red)]" /> : <Minus size={16} className="text-[var(--text-muted)]" />}
                      <p className={`font-mono text-xl font-bold ${portReturn > 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{fmtPct(portReturn)}</p>
                    </div>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">Options portfolio</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2196f3]">vs Underlying</p>
                    <p className={`mt-1 font-mono text-xl font-bold ${simResult.benchmarkReturn > 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{fmtPct(simResult.benchmarkReturn)}</p>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">Buy &amp; hold stock</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#00c853]">vs Risk-Free</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[var(--accent-green)]">{fmtPct(simResult.riskFreeReturn)}</p>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">Bond earning r</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Max Drawdown</p>
                    <p className="mt-1 font-mono text-xl font-bold text-[var(--accent-red)]">{fmtPct(simResult.maxDrawdown)}</p>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">Peak-to-trough</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Sharpe Ratio</p>
                    <p className={`mt-1 font-mono text-xl font-bold ${simResult.sharpeRatio > 0 ? "text-[var(--accent-green)]" : simResult.sharpeRatio < 0 ? "text-[var(--accent-red)]" : "text-[var(--text-muted)]"}`}>{simResult.sharpeRatio.toFixed(2)}</p>
                    <p className="mt-1 text-[9px] text-[var(--text-muted)]">Risk-adjusted</p>
                  </div>
                </div>
              );
            })()}

            {/* Vol Profile Impact (if available) */}
            {profile && (profile.marketImpliedVol || profile.realizedVol) && (
              <div className="rounded-lg border border-[#ab47bc]/30 bg-[var(--bg-card)] p-4">
                <h4 className="mb-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#ab47bc]">
                  <Shield size={10} /> Portfolio Value at Each Vol
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-[#ff9800]/30 bg-[#ff9800]/5 px-3 py-2">
                    <p className="text-[10px] text-[#ff9800]">At Your Vol ({volatility.toFixed(1)}%)</p>
                    <p className="font-mono text-lg font-bold text-[var(--text-primary)]">${simResult.valueAtUserVol.toFixed(2)}</p>
                  </div>
                  {profile.marketImpliedVol && (
                    <div className="rounded border border-[#2196f3]/30 bg-[#2196f3]/5 px-3 py-2">
                      <p className="text-[10px] text-[#2196f3]">At Market IV ({(profile.marketImpliedVol.value * 100).toFixed(1)}%)</p>
                      <p className="font-mono text-lg font-bold text-[var(--text-primary)]">${simResult.valueAtMarketIV.toFixed(2)}</p>
                    </div>
                  )}
                  {profile.realizedVol && (
                    <div className="rounded border border-[#00c853]/30 bg-[#00c853]/5 px-3 py-2">
                      <p className="text-[10px] text-[#00c853]">At Realized ({(profile.realizedVol.value * 100).toFixed(1)}%)</p>
                      <p className="font-mono text-lg font-bold text-[var(--text-primary)]">${simResult.valueAtRealizedVol.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                {simResult.valueAtUserVol !== simResult.valueAtMarketIV && (
                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                    Vol gap edge: ${(simResult.valueAtUserVol - simResult.valueAtMarketIV).toFixed(2)}
                    {simResult.valueAtUserVol > simResult.valueAtMarketIV
                      ? " — your vol view values the portfolio higher than the market"
                      : " — the market values the portfolio higher than your vol view"
                    }
                  </p>
                )}
              </div>
            )}

            {/* Portfolio Value vs Benchmarks Chart */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
              <Plot
                data={[
                  {
                    x: [...simResult.timeSteps, ...simResult.timeSteps.slice().reverse()],
                    y: [...simResult.p95PortfolioValue, ...simResult.p5PortfolioValue.slice().reverse()],
                    type: "scatter" as const, mode: "lines" as const,
                    fill: "toself", fillcolor: "rgba(255,152,0,0.08)",
                    line: { color: "rgba(255,152,0,0.15)", width: 0 },
                    name: "Portfolio 90% CI", hoverinfo: "skip" as const, showlegend: true,
                  },
                  {
                    x: simResult.timeSteps, y: simResult.meanPortfolioValue,
                    type: "scatter" as const, mode: "lines" as const,
                    name: "Your Portfolio (Options)", line: { color: "#ff9800", width: 2.5 },
                    hovertemplate: "T: %{x:.3f}y<br>Value: $%{y:.2f}<extra>Your Portfolio</extra>",
                  },
                  {
                    x: simResult.timeSteps, y: simResult.benchmarkValue,
                    type: "scatter" as const, mode: "lines" as const,
                    name: "Buy & Hold Underlying", line: { color: "#2196f3", width: 1.5, dash: "dash" as const },
                    hovertemplate: "T: %{x:.3f}y<br>Value: $%{y:.2f}<extra>Buy & Hold</extra>",
                  },
                  {
                    x: simResult.timeSteps, y: simResult.riskFreeValue,
                    type: "scatter" as const, mode: "lines" as const,
                    name: "Risk-Free Bond", line: { color: "#00c853", width: 1.5, dash: "dot" as const },
                    hovertemplate: "T: %{x:.3f}y<br>Value: $%{y:.2f}<extra>Risk-Free</extra>",
                  },
                ]}
                layout={{
                  ...DARK_LAYOUT,
                  title: { text: "Portfolio Value vs Benchmarks", font: { size: 12, color: "#e0e0e0" } },
                  xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Time (Years)", font: { size: 10 } } },
                  yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Portfolio Value ($)", font: { size: 10 } } },
                }}
                config={{ responsive: true, displayModeBar: false }}
                useResizeHandler
                style={{ width: "100%", height: "340px" }}
              />
            </div>

            {/* Benchmark Explanation */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                What Am I Comparing Against?
              </h4>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex gap-2">
                  <div className="mt-1 h-[3px] w-6 shrink-0 rounded bg-[#ff9800]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Your Portfolio</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                      Options position repriced via BSM at each time step as the underlying moves along simulated GBM paths.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="mt-1 h-[3px] w-6 shrink-0 rounded border border-dashed border-[#2196f3]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Buy &amp; Hold Underlying</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                      What if you had invested the same initial capital directly in the stock?
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="mt-1 h-[3px] w-6 shrink-0 rounded border border-dotted border-[#00c853]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Risk-Free Bond</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                      Capital earning the risk-free rate (r) continuously — the baseline &quot;do nothing&quot;.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Greeks Evolution */}
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "meanDelta", label: "Delta Evolution", color: "#ff9800" },
                { key: "meanGamma", label: "Gamma Evolution", color: "#2196f3" },
                { key: "meanTheta", label: "Theta Evolution", color: "#ab47bc" },
                { key: "meanVega", label: "Vega Evolution", color: "#00c853" },
              ] as const).map((greek) => (
                <div key={greek.key} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                  <Plot
                    data={[{
                      x: simResult.timeSteps, y: simResult[greek.key],
                      type: "scatter" as const, mode: "lines" as const,
                      line: { color: greek.color, width: 1.5 },
                      hovertemplate: `T: %{x:.3f}y<br>${greek.label.split(" ")[0]}: %{y:.4f}<extra></extra>`,
                      showlegend: false,
                    }]}
                    layout={{
                      ...DARK_LAYOUT,
                      title: { text: greek.label, font: { size: 10, color: "#8888aa" } },
                      margin: { l: 50, r: 10, t: 30, b: 30 },
                      xaxis: { ...DARK_LAYOUT.xaxis, tickfont: { size: 8 } },
                      yaxis: { ...DARK_LAYOUT.yaxis, tickfont: { size: 8 } },
                      showlegend: false,
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    useResizeHandler
                    style={{ width: "100%", height: "180px" }}
                  />
                </div>
              ))}
            </div>

            {/* Hedging Simulation Comparison */}
            {hedgeResults.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <h4 className="mb-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <Shield size={10} className="text-[#2196f3]" /> Delta Hedging Comparison
                </h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {hedgeResults.map((hr) => (
                    <div key={hr.label} className="rounded border bg-[#0a0a0f] px-3 py-2" style={{ borderColor: `${hr.color}40` }}>
                      <p className="text-[10px] font-semibold" style={{ color: hr.color }}>{hr.label}</p>
                      <p className="text-[9px] text-[var(--text-muted)]">{hr.rebalanceFreq}</p>
                      <div className="mt-1 grid grid-cols-2 gap-x-2 text-[10px]">
                        <p className="text-[var(--text-muted)]">Mean Error:</p>
                        <p className="font-mono text-[var(--text-primary)]">{hr.meanError.toFixed(4)}</p>
                        <p className="text-[var(--text-muted)]">Std Error:</p>
                        <p className="font-mono text-[var(--text-primary)]">{hr.stdError.toFixed(4)}</p>
                        <p className="text-[var(--text-muted)]">Avg Tx Cost:</p>
                        <p className="font-mono text-[var(--text-primary)]">{hr.meanCost.toFixed(4)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                  <Plot
                    data={hedgeResults.map((hr) => ({
                      x: hr.finalHedgeErrors,
                      type: "histogram" as const,
                      nbinsx: 30,
                      opacity: 0.6,
                      marker: { color: hr.color },
                      name: hr.label,
                    }))}
                    layout={{
                      ...DARK_LAYOUT,
                      title: { text: "Hedge Error Distribution by Rebalance Frequency", font: { size: 11, color: "#e0e0e0" } },
                      xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Hedge Error ($)", font: { size: 10 } } },
                      yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Frequency", font: { size: 10 } } },
                      barmode: "overlay" as const,
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    useResizeHandler
                    style={{ width: "100%", height: "260px" }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
                  More frequent rebalancing reduces hedge error but increases transaction costs.
                  The tradeoff between discrete hedging cost and hedge slippage is fundamental in options trading.
                </p>
              </div>
            )}

            {/* Attribution Panel with Explanation & Improvement Engines */}
            <AttributionPanel result={simResult} profile={profile} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              {hasPositions ? (
                <>
                  <p className="text-sm text-[var(--text-muted)]">
                    {positions.length} position{positions.length !== 1 ? "s" : ""} ready — click &quot;Run Simulation&quot;
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Portfolio performance, Greeks evolution, hedging sim, and P&L attribution
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--text-muted)]">
                    No positions in your portfolio yet
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Go to the Positions tab to add option legs, then come back here to simulate performance
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
