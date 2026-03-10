/** Method used to compute Greeks */
export type GreeksMethod = "analytical" | "finite_difference";

/** Request to compute option Greeks */
export interface GreeksRequest {
  spot: number;
  strike: number;
  expiryYears: number;
  riskFreeRate: number;
  volatility: number;
  optionType: "call" | "put";
  dividendYield: number;
  method: GreeksMethod;
  /** Bump size for finite difference (default 0.01) */
  bumpSize?: number;
}

/** Greeks values returned from the API */
export interface GreeksResponse {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  /** Higher-order Greeks */
  vanna?: number;
  volga?: number;
  charm?: number;
  speed?: number;
  /** Method used */
  method: GreeksMethod;
  /** Computation time in milliseconds */
  computeTimeMs: number;
}
