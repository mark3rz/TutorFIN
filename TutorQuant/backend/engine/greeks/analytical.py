"""Analytical (closed-form) BSM Greeks computation.

All formulas are derived under the standard Black-Scholes-Merton framework
with continuous dividend yield *q*.

Conventions
-----------
- **Theta** is per year (annualised).  Divide by 365 for a per-calendar-day
  figure, or by 252 for per-trading-day.
- **Vega** is per unit change in volatility (i.e. per 1.0 change in sigma,
  not per 1 percentage-point change).  Multiply by 0.01 to get the
  sensitivity to a 1-pp vol move.
- **Rho** is per unit change in the risk-free rate.  Multiply by 0.01 for
  the sensitivity to a 1-pp rate move.
- **Vanna** = d(Delta)/d(sigma) = d(Vega)/d(S).  Cross-gamma between spot
  and volatility.
- **Volga** (also called Vomma) = d(Vega)/d(sigma).  Second-order
  sensitivity of option price to volatility.
- **Charm** = d(Delta)/d(T).  Also known as Delta bleed -- measures how
  Delta changes as time passes (with the sign convention that positive T
  means time *remaining*, so Charm = -d(Delta)/d(t) where t is elapsed
  time).

Formulas (BSM, continuous dividend yield q)
-------------------------------------------
d1, d2    : standard BSM parameters (see :func:`engine.models.black_scholes._d1_d2`)

Delta_call = e^(-qT) * N(d1)
Delta_put  = -e^(-qT) * N(-d1)

Gamma      = e^(-qT) * n(d1) / (S * sigma * sqrt(T))   [same for call and put]

Vega       = S * e^(-qT) * n(d1) * sqrt(T)              [same for call and put]

Theta_call = -(S * sigma * e^(-qT) * n(d1)) / (2*sqrt(T))
             - r * K * e^(-rT) * N(d2)
             + q * S * e^(-qT) * N(d1)

Theta_put  = -(S * sigma * e^(-qT) * n(d1)) / (2*sqrt(T))
             + r * K * e^(-rT) * N(-d2)
             - q * S * e^(-qT) * N(-d1)

Rho_call   = K * T * e^(-rT) * N(d2)
Rho_put    = -K * T * e^(-rT) * N(-d2)

Vanna      = -e^(-qT) * n(d1) * d2 / sigma

Volga      = S * e^(-qT) * n(d1) * sqrt(T) * d1 * d2 / sigma

Charm_call = -e^(-qT) * [ n(d1) * (2*(r-q)*T - d2*sigma*sqrt(T)) / (2*T*sigma*sqrt(T)) ]
             (derivative of Delta_call w.r.t. time remaining T)

Where N() is the standard normal CDF and n() is the standard normal PDF.
"""

from __future__ import annotations

import math

from scipy.stats import norm

from engine.models.black_scholes import _d1_d2


def bsm_greeks(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
) -> dict[str, float]:
    """Compute all analytical BSM Greeks for a European option.

    Parameters
    ----------
    S : float
        Spot price (> 0).
    K : float
        Strike price (> 0).
    T : float
        Time to expiration in years.  If T <= 0, limit-case Greeks are
        returned (delta = 1 or 0 for ITM/OTM, all others = 0).
    r : float
        Continuous risk-free rate (annualised).
    sigma : float
        Annualised volatility (> 0).
    q : float, optional
        Continuous dividend yield, default 0.
    option_type : str, optional
        ``"call"`` or ``"put"``, default ``"call"``.

    Returns
    -------
    dict[str, float]
        Keys: delta, gamma, vega, theta, rho, vanna, volga, charm.

    Raises
    ------
    ValueError
        If S <= 0, K <= 0, or sigma <= 0.
    """
    if S <= 0:
        raise ValueError(f"Spot price S must be > 0, got {S}")
    if K <= 0:
        raise ValueError(f"Strike price K must be > 0, got {K}")
    if sigma <= 0:
        raise ValueError(f"Volatility sigma must be > 0, got {sigma}")

    is_call = option_type == "call"

    # --- Limit case: at or past expiry ---
    if T <= 0:
        if is_call:
            delta = 1.0 if S > K else (0.5 if S == K else 0.0)
        else:
            delta = -1.0 if S < K else (-0.5 if S == K else 0.0)
        return {
            "delta": delta,
            "gamma": 0.0,
            "vega": 0.0,
            "theta": 0.0,
            "rho": 0.0,
            "vanna": 0.0,
            "volga": 0.0,
            "charm": 0.0,
        }

    d1, d2 = _d1_d2(S, K, T, r, sigma, q)

    sqrt_T = math.sqrt(T)
    exp_qT = math.exp(-q * T)
    exp_rT = math.exp(-r * T)
    n_d1 = norm.pdf(d1)    # standard normal density at d1
    N_d1 = norm.cdf(d1)    # standard normal CDF at d1
    N_d2 = norm.cdf(d2)
    N_neg_d1 = norm.cdf(-d1)
    N_neg_d2 = norm.cdf(-d2)

    # --- First-order Greeks ---

    if is_call:
        delta = exp_qT * N_d1
    else:
        delta = -exp_qT * N_neg_d1

    # Gamma is the same for calls and puts
    gamma = exp_qT * n_d1 / (S * sigma * sqrt_T)

    # Vega is the same for calls and puts (per unit change in sigma)
    vega = S * exp_qT * n_d1 * sqrt_T

    # Theta (annualised)
    common_theta = -(S * sigma * exp_qT * n_d1) / (2.0 * sqrt_T)
    if is_call:
        theta = common_theta - r * K * exp_rT * N_d2 + q * S * exp_qT * N_d1
    else:
        theta = common_theta + r * K * exp_rT * N_neg_d2 - q * S * exp_qT * N_neg_d1

    # Rho
    if is_call:
        rho = K * T * exp_rT * N_d2
    else:
        rho = -K * T * exp_rT * N_neg_d2

    # --- Second-order / cross Greeks ---

    # Vanna = d(Delta)/d(sigma) = d(Vega)/d(S)
    vanna = -exp_qT * n_d1 * d2 / sigma

    # Volga (Vomma) = d(Vega)/d(sigma)
    volga = S * exp_qT * n_d1 * sqrt_T * d1 * d2 / sigma

    # Charm = d(Delta)/d(T) -- how Delta changes as time remaining decreases
    # For a call:
    #   Charm = -e^(-qT) * [ n(d1) * (2(r-q)T - d2*sigma*sqrt(T)) / (2*T*sigma*sqrt(T)) ]
    # For a put, Charm_put = Charm_call + q*e^(-qT) ... but we derive directly.
    charm_numerator = 2.0 * (r - q) * T - d2 * sigma * sqrt_T
    charm_common = -exp_qT * n_d1 * charm_numerator / (2.0 * T * sigma * sqrt_T)

    if is_call:
        charm = charm_common
    else:
        # Put charm via put-call parity for delta:
        # Delta_put = Delta_call - e^(-qT)
        # d(Delta_put)/dT = d(Delta_call)/dT + q*e^(-qT)
        charm = charm_common + q * exp_qT

    return {
        "delta": float(delta),
        "gamma": float(gamma),
        "vega": float(vega),
        "theta": float(theta),
        "rho": float(rho),
        "vanna": float(vanna),
        "volga": float(volga),
        "charm": float(charm),
    }
