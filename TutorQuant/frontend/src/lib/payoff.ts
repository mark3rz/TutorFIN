/**
 * Portfolio payoff / P&L computation at expiration.
 *
 * Pure functions — no side effects, no React dependencies.
 * All computation is done client-side for instant chart updates.
 */

export interface PayoffLeg {
  /** Strike price of the option */
  strike: number;
  /** "call" or "put" */
  optionType: "call" | "put";
  /** "long" or "short" */
  side: "long" | "short";
  /** Number of contracts (positive) */
  quantity: number;
  /** Premium per contract (BSM theoretical price at entry) */
  premium: number;
  /** Display label for the leg */
  label?: string;
}

/**
 * Compute the expiration payoff for a single option leg at a given
 * underlying price, net of premium (i.e. P&L, not just intrinsic).
 *
 * - Long call:  max(S - K, 0) - premium
 * - Short call: premium - max(S - K, 0)
 * - Long put:   max(K - S, 0) - premium
 * - Short put:  premium - max(K - S, 0)
 *
 * Result is multiplied by quantity.
 */
export function legPayoff(leg: PayoffLeg, underlyingPrice: number): number {
  const intrinsic =
    leg.optionType === "call"
      ? Math.max(underlyingPrice - leg.strike, 0)
      : Math.max(leg.strike - underlyingPrice, 0);

  const signedDirection = leg.side === "long" ? 1 : -1;
  const perContract = signedDirection * (intrinsic - leg.premium);

  return perContract * leg.quantity;
}

/**
 * Compute the total portfolio payoff at a given underlying price.
 */
export function portfolioPayoff(legs: PayoffLeg[], underlyingPrice: number): number {
  return legs.reduce((sum, leg) => sum + legPayoff(leg, underlyingPrice), 0);
}

/**
 * Generate payoff curves across a range of underlying prices.
 *
 * Returns:
 * - `prices`: array of underlying price points (x-axis)
 * - `legPayoffs`: per-leg payoff arrays (one array per leg)
 * - `totalPayoff`: aggregated portfolio payoff array
 * - `breakevens`: underlying prices where total payoff crosses zero
 */
export function generatePayoffCurves(
  legs: PayoffLeg[],
  prices: number[],
): {
  prices: number[];
  legPayoffs: number[][];
  totalPayoff: number[];
  breakevens: number[];
} {
  const legPayoffs: number[][] = legs.map(() => []);
  const totalPayoff: number[] = [];

  for (const price of prices) {
    let total = 0;
    for (let i = 0; i < legs.length; i++) {
      const val = legPayoff(legs[i], price);
      legPayoffs[i].push(val);
      total += val;
    }
    totalPayoff.push(total);
  }

  // Find break-even points via linear interpolation between sign changes
  const breakevens: number[] = [];
  for (let i = 1; i < totalPayoff.length; i++) {
    const prev = totalPayoff[i - 1];
    const curr = totalPayoff[i];
    if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
      // Linear interpolation for the zero crossing
      const t = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
      const breakeven = prices[i - 1] + t * (prices[i] - prices[i - 1]);
      breakevens.push(breakeven);
    }
  }

  return { prices, legPayoffs, totalPayoff, breakevens };
}

/**
 * Determine a sensible price range for the payoff chart based on
 * the portfolio composition.
 *
 * Strategy:
 * - Find min and max strikes across all legs
 * - Find the average spot price
 * - Center the range around the midpoint of (avg spot, strike range)
 * - Extend ±40% beyond the strike range for full structure visibility
 * - Ensure at least ±20% around spot for single-leg portfolios
 */
export function computePriceRange(
  legs: PayoffLeg[],
  spot: number,
  numPoints: number = 500,
): number[] {
  if (legs.length === 0) return [];

  const strikes = legs.map((l) => l.strike);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);

  const center = (minStrike + maxStrike) / 2;
  const strikeSpread = maxStrike - minStrike;

  // Ensure minimum range around spot and strike zone
  const halfRange = Math.max(
    strikeSpread * 0.7,    // at least 70% beyond strike spread on each side
    spot * 0.3,            // at least ±30% of spot
    20,                    // absolute minimum range
  );

  const lo = Math.max(center - halfRange, 0.01);
  const hi = center + halfRange;

  const step = (hi - lo) / (numPoints - 1);
  return Array.from({ length: numPoints }, (_, i) => lo + i * step);
}
