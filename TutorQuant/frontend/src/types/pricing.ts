import type { OptionContract, BondSpec } from "./instruments";

/** Supported pricing models */
export type PricingModel =
  | "black_scholes"
  | "binomial_crr"
  | "binomial_jr"
  | "trinomial"
  | "monte_carlo"
  | "baw"       // Barone-Adesi Whaley
  | "heston"
  | "sabr";

/** Request payload to price an option */
export interface OptionPricingRequest {
  contract: OptionContract;
  riskFreeRate: number;
  volatility: number;
  model: PricingModel;
  /** Number of steps for tree models */
  steps?: number;
  /** Number of paths for Monte Carlo */
  numPaths?: number;
}

/** Response from the option pricing endpoint */
export interface OptionPricingResponse {
  price: number;
  model: PricingModel;
  /** Intrinsic value */
  intrinsicValue: number;
  /** Time value */
  timeValue: number;
  /** Optional early exercise premium (American options) */
  earlyExercisePremium?: number;
  /** Computation time in milliseconds */
  computeTimeMs: number;
  /** Convergence diagnostics (tree / MC) */
  convergence?: {
    steps: number[];
    prices: number[];
  };
}

/** Request payload to price a bond */
export interface BondPricingRequest {
  bond: BondSpec;
  yieldToMaturity: number;
  /** Optional array of spot rates for full curve pricing */
  spotRates?: number[];
}

/** Response from the bond pricing endpoint */
export interface BondPricingResponse {
  cleanPrice: number;
  dirtyPrice: number;
  accruedInterest: number;
  yieldToMaturity: number;
  macaulayDuration: number;
  modifiedDuration: number;
  convexity: number;
  dv01: number;
  /** Cashflow schedule */
  cashflows: {
    time: number;
    amount: number;
    presentValue: number;
  }[];
}
