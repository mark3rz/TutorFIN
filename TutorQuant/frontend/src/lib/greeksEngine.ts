/**
 * Client-side BSM Greeks computation engine.
 *
 * Computes all 13 Greeks analytically for European options under the
 * Black-Scholes-Merton framework with continuous dividend yield q.
 *
 * All rates and volatility are decimals (0.05 = 5%).
 * Theta is annualised. Vega/Rho are per unit change.
 */

// ── Normal distribution helpers ─────────────────────────────────────────────

/** Standard normal PDF: n(x) = (1/√2π) * e^(-x²/2) */
function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Standard normal CDF via rational approximation (Abramowitz & Stegun 26.2.17) */
function normCdf(x: number): number {
  if (x > 8) return 1;
  if (x < -8) return 0;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

// ── BSM parameters ──────────────────────────────────────────────────────────

function d1d2(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number,
): [number, number] {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return [d1, d2];
}

// ── Option state interface ──────────────────────────────────────────────────

export interface OptionState {
  spot: number;
  strike: number;
  expiryYears: number;
  riskFreeRate: number;   // decimal
  volatility: number;     // decimal
  dividendYield: number;  // decimal
  optionType: "call" | "put";
}

// ── BSM price ───────────────────────────────────────────────────────────────

export function bsmPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number,
  isCall: boolean,
): number {
  if (T <= 0) return isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
  if (S <= 0 || K <= 0 || sigma <= 0) return 0;

  const [d1, d2] = d1d2(S, K, T, r, sigma, q);
  const expQT = Math.exp(-q * T);
  const expRT = Math.exp(-r * T);

  if (isCall) {
    return S * expQT * normCdf(d1) - K * expRT * normCdf(d2);
  } else {
    return K * expRT * normCdf(-d2) - S * expQT * normCdf(-d1);
  }
}

// ── All 13 Greeks ───────────────────────────────────────────────────────────

export interface AllGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  lambda: number;   // leverage / elasticity
  vanna: number;     // d(delta)/d(sigma) = d(vega)/d(S)
  charm: number;     // d(delta)/d(T) — delta bleed
  vomma: number;     // d(vega)/d(sigma) — volga
  speed: number;     // d(gamma)/d(S) — third-order spot
  color: number;     // d(gamma)/d(T) — gamma bleed
  zomma: number;     // d(gamma)/d(sigma)
  ultima: number;    // d(vomma)/d(sigma) — third-order vol
}

/**
 * Compute all 13 analytical BSM Greeks at a single point.
 */
export function computeAllGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number,
  isCall: boolean,
): AllGreeks {
  // Limit cases
  if (T <= 1e-10 || S <= 0 || K <= 0 || sigma <= 1e-10) {
    let delta = 0;
    if (T <= 1e-10 && S > 0 && K > 0) {
      if (isCall) delta = S > K ? 1 : (S === K ? 0.5 : 0);
      else delta = S < K ? -1 : (S === K ? -0.5 : 0);
    }
    return {
      delta, gamma: 0, theta: 0, vega: 0, rho: 0, lambda: 0,
      vanna: 0, charm: 0, vomma: 0, speed: 0, color: 0, zomma: 0, ultima: 0,
    };
  }

  const [d1, d2] = d1d2(S, K, T, r, sigma, q);
  const sqrtT = Math.sqrt(T);
  const expQT = Math.exp(-q * T);
  const expRT = Math.exp(-r * T);
  const nd1 = normPdf(d1);
  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const Nnd1 = normCdf(-d1);
  const Nnd2 = normCdf(-d2);

  // ── First-order ─────────────────────────────────────────────────────

  const delta = isCall ? expQT * Nd1 : -expQT * Nnd1;

  // Gamma (same for calls and puts)
  const gamma = expQT * nd1 / (S * sigma * sqrtT);

  // Vega (same for calls and puts) — per unit sigma
  const vega = S * expQT * nd1 * sqrtT;

  // Theta (annualised)
  const commonTheta = -(S * sigma * expQT * nd1) / (2 * sqrtT);
  const theta = isCall
    ? commonTheta - r * K * expRT * Nd2 + q * S * expQT * Nd1
    : commonTheta + r * K * expRT * Nnd2 - q * S * expQT * Nnd1;

  // Rho
  const rho = isCall
    ? K * T * expRT * Nd2
    : -K * T * expRT * Nnd2;

  // Lambda (elasticity) = delta * S / V
  const price = bsmPrice(S, K, T, r, sigma, q, isCall);
  const lambda = price > 1e-12 ? delta * S / price : 0;

  // ── Second-order ────────────────────────────────────────────────────

  // Vanna = d(delta)/d(sigma) = d(vega)/d(S)
  const vanna = -expQT * nd1 * d2 / sigma;

  // Charm = d(delta)/d(T)
  const charmNumerator = 2 * (r - q) * T - d2 * sigma * sqrtT;
  const charmCommon = -expQT * nd1 * charmNumerator / (2 * T * sigma * sqrtT);
  const charm = isCall ? charmCommon : charmCommon + q * expQT;

  // Vomma (Volga) = d(vega)/d(sigma)
  const vomma = S * expQT * nd1 * sqrtT * d1 * d2 / sigma;

  // ── Third-order ─────────────────────────────────────────────────────

  // Speed = d(gamma)/d(S) = -(gamma / S) * (1 + d1 / (sigma * sqrt(T)))
  const speed = -(gamma / S) * (1 + d1 / (sigma * sqrtT));

  // Color = d(gamma)/d(T) — gamma bleed
  // Color = -expQT * nd1 / (2*S*T*sigma*sqrtT) *
  //         (2*q*T + 1 + d1*(2*(r-q)*T - d2*sigma*sqrtT)/(sigma*sqrtT))
  const color = -expQT * nd1 / (2 * S * T * sigma * sqrtT) *
    (2 * q * T + 1 + d1 * (2 * (r - q) * T - d2 * sigma * sqrtT) / (sigma * sqrtT));

  // Zomma = d(gamma)/d(sigma) = gamma * (d1*d2 - 1) / sigma
  const zomma = gamma * (d1 * d2 - 1) / sigma;

  // Ultima = d(vomma)/d(sigma)
  // Ultima = -vega/(sigma^2) * [d1*d2*(1 - d1*d2) + d1^2 + d2^2]
  const ultima = -vega / (sigma * sigma) * (d1 * d2 * (1 - d1 * d2) + d1 * d1 + d2 * d2);

  return {
    delta, gamma, theta, vega, rho, lambda,
    vanna, charm, vomma, speed, color, zomma, ultima,
  };
}

// ── Curve generation ────────────────────────────────────────────────────────

export type GreekKey = keyof AllGreeks;

/**
 * Generate a curve for a single Greek across a range of x-values.
 * The xVariable determines which parameter is swept; all others
 * are held constant from the option state.
 */
export function generateGreekCurve(
  state: OptionState,
  greekKey: GreekKey,
  xVariable: "spot" | "expiryYears" | "volatility" | "riskFreeRate",
  xValues: number[],
): { x: number[]; y: number[] } {
  const isCall = state.optionType === "call";
  const yValues: number[] = [];

  for (const xVal of xValues) {
    const S = xVariable === "spot" ? xVal : state.spot;
    const K = state.strike;
    const T = xVariable === "expiryYears" ? xVal : state.expiryYears;
    const r = xVariable === "riskFreeRate" ? xVal : state.riskFreeRate;
    const sigma = xVariable === "volatility" ? xVal : state.volatility;
    const q = state.dividendYield;

    // Guard against invalid inputs
    if (S <= 0 || K <= 0 || sigma <= 0 || T <= 0) {
      yValues.push(0);
      continue;
    }

    const greeks = computeAllGreeks(S, K, T, r, sigma, q, isCall);
    yValues.push(greeks[greekKey]);
  }

  return { x: xValues, y: yValues };
}

/**
 * Generate an evenly-spaced array of values.
 */
export function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + i * step);
}
