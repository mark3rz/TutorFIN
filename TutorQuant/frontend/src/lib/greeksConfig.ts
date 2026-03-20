/**
 * Greek metadata configuration.
 *
 * Defines display labels, x-axis strategies, explanations,
 * and formatting rules for all 13 Greeks.
 */

import type { GreekKey, OptionState } from "./greeksEngine";
import { linspace } from "./greeksEngine";

export type XVariable = "spot" | "expiryYears" | "volatility" | "riskFreeRate";

export interface GreekConfig {
  key: GreekKey;
  label: string;
  shortLabel: string;
  symbol: string;
  xVariable: XVariable;
  xLabel: string;
  yLabel: string;
  explanation: string;
  category: "first-order" | "second-order" | "third-order";
  lineColor: string;
  /** Generate x-axis range based on current option state */
  getXRange: (state: OptionState) => number[];
  /** Format x-axis values for display */
  formatX?: (v: number) => string;
  /** Format y-axis values for display */
  formatY?: (v: number) => string;
}

// ── X-range generators ──────────────────────────────────────────────────────

/** Spot range: 50% to 150% of current spot, centered on strike */
function spotRange(state: OptionState): number[] {
  const center = state.strike;
  const lo = Math.max(center * 0.5, 0.01);
  const hi = center * 1.5;
  return linspace(lo, hi, 200);
}

/** Time range: 0.01 to current expiry (sweep from expiry toward zero) */
function timeRange(state: OptionState): number[] {
  const hi = Math.max(state.expiryYears, 0.1);
  return linspace(0.01, hi, 200);
}

/** Volatility range: 1% to 100% */
function volRange(): number[] {
  return linspace(0.01, 1.0, 200);
}

/** Rate range: 0% to 15% */
function rateRange(): number[] {
  return linspace(0.0, 0.15, 200);
}

// ── Color palette ───────────────────────────────────────────────────────────

const COLORS = {
  delta: "#ff9800",     // orange (accent)
  gamma: "#00c853",     // green
  theta: "#ff1744",     // red
  vega: "#2196f3",      // blue
  rho: "#ab47bc",       // purple
  lambda: "#ffab40",    // amber
  vanna: "#26c6da",     // cyan
  charm: "#ef5350",     // red-light
  vomma: "#42a5f5",     // blue-light
  speed: "#66bb6a",     // green-light
  color: "#ff7043",     // deep orange
  zomma: "#7e57c2",     // deep purple
  ultima: "#ec407a",    // pink
};

// ── Config array ────────────────────────────────────────────────────────────

export const GREEK_CONFIGS: GreekConfig[] = [
  // ── First-order ─────────────────────────────────────────
  {
    key: "delta",
    label: "Delta",
    shortLabel: "Delta",
    symbol: "Δ",
    xVariable: "spot",
    xLabel: "Spot Price",
    yLabel: "Delta",
    explanation:
      "Rate of change of option price with respect to spot price (∂V/∂S). " +
      "Call delta ranges from 0 to 1; put delta from -1 to 0. " +
      "Measures directional exposure and approximate hedge ratio.",
    category: "first-order",
    lineColor: COLORS.delta,
    getXRange: spotRange,
  },
  {
    key: "gamma",
    label: "Gamma",
    shortLabel: "Gamma",
    symbol: "Γ",
    xVariable: "spot",
    xLabel: "Spot Price",
    yLabel: "Gamma",
    explanation:
      "Rate of change of delta with respect to spot price (∂²V/∂S²). " +
      "Peaks near ATM and close to expiry. Identical for calls and puts. " +
      "Measures convexity of the option position.",
    category: "first-order",
    lineColor: COLORS.gamma,
    getXRange: spotRange,
  },
  {
    key: "theta",
    label: "Theta",
    shortLabel: "Theta",
    symbol: "Θ",
    xVariable: "expiryYears",
    xLabel: "Time to Expiry (years)",
    yLabel: "Theta (ann.)",
    explanation:
      "Rate of change of option price with respect to time (∂V/∂T). " +
      "Annualised; divide by 365 for daily decay. " +
      "Long options lose value as time passes (negative theta for long calls/puts).",
    category: "first-order",
    lineColor: COLORS.theta,
    getXRange: timeRange,
  },
  {
    key: "vega",
    label: "Vega",
    shortLabel: "Vega",
    symbol: "ν",
    xVariable: "volatility",
    xLabel: "Volatility (σ)",
    yLabel: "Vega",
    explanation:
      "Sensitivity of option price to implied volatility (∂V/∂σ). " +
      "Per unit (1.0) change in sigma. Multiply by 0.01 for 1pp move. " +
      "Identical for calls and puts. Peaks near ATM.",
    category: "first-order",
    lineColor: COLORS.vega,
    getXRange: volRange,
    formatX: (v: number) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: "rho",
    label: "Rho",
    shortLabel: "Rho",
    symbol: "ρ",
    xVariable: "riskFreeRate",
    xLabel: "Risk-Free Rate",
    yLabel: "Rho",
    explanation:
      "Sensitivity of option price to the risk-free rate (∂V/∂r). " +
      "Per unit (1.0) change in r. Multiply by 0.01 for 1pp move. " +
      "Calls have positive rho; puts have negative rho.",
    category: "first-order",
    lineColor: COLORS.rho,
    getXRange: rateRange,
    formatX: (v: number) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: "lambda",
    label: "Lambda",
    shortLabel: "Lambda",
    symbol: "Λ",
    xVariable: "spot",
    xLabel: "Spot Price",
    yLabel: "Lambda",
    explanation:
      "Option elasticity or leverage ratio (Δ × S / V). " +
      "Measures the percentage change in option price for a 1% change in spot. " +
      "High for OTM options (large leverage), converges to 1 deep ITM.",
    category: "first-order",
    lineColor: COLORS.lambda,
    getXRange: spotRange,
  },
  // ── Second-order ────────────────────────────────────────
  {
    key: "vanna",
    label: "Vanna",
    shortLabel: "Vanna",
    symbol: "∂Δ/∂σ",
    xVariable: "spot",
    xLabel: "Spot Price",
    yLabel: "Vanna",
    explanation:
      "Cross-gamma between spot and volatility (∂²V/∂S∂σ = ∂Δ/∂σ = ∂ν/∂S). " +
      "Measures how delta changes when volatility moves, or equivalently how vega " +
      "changes when spot moves. Important for vol-smile hedging.",
    category: "second-order",
    lineColor: COLORS.vanna,
    getXRange: spotRange,
  },
  {
    key: "charm",
    label: "Charm",
    shortLabel: "Charm",
    symbol: "∂Δ/∂T",
    xVariable: "expiryYears",
    xLabel: "Time to Expiry (years)",
    yLabel: "Charm",
    explanation:
      "Delta bleed — how delta changes as time passes (∂Δ/∂T). " +
      "Critical for understanding how your hedge ratio evolves overnight. " +
      "Largest effect near ATM as expiry approaches.",
    category: "second-order",
    lineColor: COLORS.charm,
    getXRange: timeRange,
  },
  {
    key: "vomma",
    label: "Vomma",
    shortLabel: "Vomma",
    symbol: "∂ν/∂σ",
    xVariable: "volatility",
    xLabel: "Volatility (σ)",
    yLabel: "Vomma",
    explanation:
      "Volga — second-order sensitivity of price to volatility (∂²V/∂σ² = ∂ν/∂σ). " +
      "Measures vega convexity. Positive for long options — vega increases as vol rises. " +
      "Important for vol-of-vol risk.",
    category: "second-order",
    lineColor: COLORS.vomma,
    getXRange: volRange,
    formatX: (v: number) => `${(v * 100).toFixed(0)}%`,
  },
  // ── Third-order ─────────────────────────────────────────
  {
    key: "speed",
    label: "Speed",
    shortLabel: "Speed",
    symbol: "∂Γ/∂S",
    xVariable: "spot",
    xLabel: "Spot Price",
    yLabel: "Speed",
    explanation:
      "Third-order spot sensitivity (∂³V/∂S³ = ∂Γ/∂S). " +
      "Measures how gamma changes as spot moves. Important for gamma scalping " +
      "and understanding hedge stability in fast-moving markets.",
    category: "third-order",
    lineColor: COLORS.speed,
    getXRange: spotRange,
  },
  {
    key: "color",
    label: "Color",
    shortLabel: "Color",
    symbol: "∂Γ/∂T",
    xVariable: "expiryYears",
    xLabel: "Time to Expiry (years)",
    yLabel: "Color",
    explanation:
      "Gamma bleed — how gamma changes as time passes (∂Γ/∂T). " +
      "Also called gamma decay or DgammaDtime. " +
      "Matters for understanding how your gamma exposure evolves overnight.",
    category: "third-order",
    lineColor: COLORS.color,
    getXRange: timeRange,
  },
  {
    key: "zomma",
    label: "Zomma",
    shortLabel: "Zomma",
    symbol: "∂Γ/∂σ",
    xVariable: "volatility",
    xLabel: "Volatility (σ)",
    yLabel: "Zomma",
    explanation:
      "Cross-sensitivity of gamma to volatility (∂Γ/∂σ). " +
      "Measures how gamma changes when implied volatility shifts. " +
      "Important for vol regime changes and stress testing.",
    category: "third-order",
    lineColor: COLORS.zomma,
    getXRange: volRange,
    formatX: (v: number) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: "ultima",
    label: "Ultima",
    shortLabel: "Ultima",
    symbol: "∂³V/∂σ³",
    xVariable: "volatility",
    xLabel: "Volatility (σ)",
    yLabel: "Ultima",
    explanation:
      "Third-order volatility sensitivity (∂³V/∂σ³ = ∂Vomma/∂σ). " +
      "Measures the rate of change of vomma with respect to volatility. " +
      "Relevant for exotic vol trading and vol-of-vol-of-vol risk.",
    category: "third-order",
    lineColor: COLORS.ultima,
    getXRange: volRange,
    formatX: (v: number) => `${(v * 100).toFixed(0)}%`,
  },
];

/** Lookup a config by Greek key */
export function getGreekConfig(key: GreekKey): GreekConfig {
  const config = GREEK_CONFIGS.find((c) => c.key === key);
  if (!config) throw new Error(`Unknown Greek: ${key}`);
  return config;
}
