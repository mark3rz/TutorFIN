"""Implied volatility solver for vanilla European options.

Uses Brent's method (scipy.optimize.brentq) which is guaranteed to converge
for continuous, monotonic functions.  BSM option price is strictly increasing
in sigma for positive time-to-expiry, making Brent's method the optimal
choice.

Newton-Raphson or Halley's method could be faster per iteration (vega is the
derivative), but Brent's method is more robust against bad initial guesses
and does not require the derivative to be non-zero at every iterate.

Algorithm
---------
1. Validate that the market price is within the no-arbitrage bounds:
   - Call: max(0, S*e^(-qT) - K*e^(-rT)) <= C <= S*e^(-qT)
   - Put:  max(0, K*e^(-rT) - S*e^(-qT)) <= P <= K*e^(-rT)
2. Use Brent's method to find sigma such that BSM(sigma) = market_price.
3. The search bracket is [sigma_low, sigma_high] with defaults [1e-6, 10.0]
   (i.e. up to 1000% annualised vol).

Conventions
-----------
- Implied volatility is annualised and expressed as a decimal (0.20 = 20%).
- All rates and yields are continuous and annualised.
"""

from __future__ import annotations

import math
from typing import Optional

import numpy as np
from scipy.optimize import brentq

from engine.models.black_scholes import bsm_price
from engine.greeks.analytical import bsm_greeks


def implied_volatility(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    q: float = 0.0,
    option_type: str = "call",
    sigma_low: float = 1e-6,
    sigma_high: float = 10.0,
    tol: float = 1e-10,
    max_iter: int = 200,
) -> float:
    """Solve for the BSM implied volatility from a market price.

    Parameters
    ----------
    market_price : float
        Observed option market price (must be > 0).
    S : float
        Spot price (> 0).
    K : float
        Strike price (> 0).
    T : float
        Time to expiration in years (> 0).
    r : float
        Continuous risk-free rate.
    q : float, optional
        Continuous dividend yield, default 0.
    option_type : str
        ``"call"`` or ``"put"``.
    sigma_low : float
        Lower bound of the volatility search bracket.
    sigma_high : float
        Upper bound of the volatility search bracket.
    tol : float
        Convergence tolerance for Brent's method.
    max_iter : int
        Maximum number of iterations.

    Returns
    -------
    float
        Implied volatility (annualised, decimal).

    Raises
    ------
    ValueError
        If the market price violates no-arbitrage bounds, or if the solver
        fails to converge.
    """
    # --- Input validation ---
    if S <= 0:
        raise ValueError(f"Spot price must be > 0, got {S}")
    if K <= 0:
        raise ValueError(f"Strike price must be > 0, got {K}")
    if T <= 0:
        raise ValueError(f"Time to expiry must be > 0, got {T}")
    if market_price <= 0:
        raise ValueError(f"Market price must be > 0, got {market_price}")

    # --- No-arbitrage bounds ---
    disc = math.exp(-r * T)
    fwd_adj = math.exp(-q * T)

    if option_type == "call":
        intrinsic = max(0.0, S * fwd_adj - K * disc)
        upper_bound = S * fwd_adj
    else:
        intrinsic = max(0.0, K * disc - S * fwd_adj)
        upper_bound = K * disc

    if market_price < intrinsic - 1e-8:
        raise ValueError(
            f"Market price {market_price:.6f} is below intrinsic value "
            f"{intrinsic:.6f} -- violates no-arbitrage."
        )
    if market_price > upper_bound + 1e-8:
        raise ValueError(
            f"Market price {market_price:.6f} exceeds upper bound "
            f"{upper_bound:.6f} -- violates no-arbitrage."
        )

    # --- Objective: BSM(sigma) - market_price = 0 ---
    def objective(sigma: float) -> float:
        return bsm_price(S, K, T, r, sigma, q, option_type) - market_price

    # Check bracket endpoints
    f_low = objective(sigma_low)
    f_high = objective(sigma_high)

    if f_low * f_high > 0:
        # Try to widen the bracket
        sigma_high = min(sigma_high * 2, 20.0)
        f_high = objective(sigma_high)
        if f_low * f_high > 0:
            raise ValueError(
                f"Cannot find implied vol: BSM price at sigma_low={sigma_low:.6f} "
                f"is {f_low + market_price:.6f}, at sigma_high={sigma_high:.1f} "
                f"is {f_high + market_price:.6f}. Market price={market_price:.6f}."
            )

    try:
        iv = brentq(objective, sigma_low, sigma_high, xtol=tol, maxiter=max_iter)
    except ValueError as exc:
        raise ValueError(f"IV solver failed: {exc}") from exc

    return float(iv)


def implied_volatility_with_greeks(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    q: float = 0.0,
    option_type: str = "call",
) -> dict:
    """Solve for IV and return Greeks at the implied vol.

    Returns
    -------
    dict
        Keys: implied_vol, bsm_price, delta, gamma, vega, theta, rho,
              moneyness, time_value.
    """
    iv = implied_volatility(market_price, S, K, T, r, q, option_type)
    price = bsm_price(S, K, T, r, iv, q, option_type)
    greeks = bsm_greeks(S, K, T, r, iv, q, option_type)

    # Moneyness measures
    if option_type == "call":
        intrinsic = max(S - K, 0.0)
    else:
        intrinsic = max(K - S, 0.0)

    return {
        "implied_vol": iv,
        "bsm_price": price,
        "moneyness": S / K,
        "log_moneyness": math.log(S / K),
        "time_value": price - intrinsic,
        **greeks,
    }


def implied_volatility_surface(
    market_prices: list[dict],
    S: float,
    r: float,
    q: float = 0.0,
) -> list[dict]:
    """Compute implied vols for a grid of market quotes.

    Parameters
    ----------
    market_prices : list[dict]
        Each dict must have keys: strike, expiry_years, market_price,
        option_type (optional, defaults to "call").
    S : float
        Current spot price.
    r : float
        Risk-free rate.
    q : float
        Dividend yield.

    Returns
    -------
    list[dict]
        Each dict augmented with: implied_vol, moneyness, log_moneyness.
        If IV solve fails for a quote, implied_vol is None with an error field.
    """
    results = []
    for quote in market_prices:
        K = quote["strike"]
        T = quote["expiry_years"]
        mp = quote["market_price"]
        otype = quote.get("option_type", "call")

        entry = {
            "strike": K,
            "expiry_years": T,
            "market_price": mp,
            "option_type": otype,
            "moneyness": S / K,
            "log_moneyness": math.log(S / K) if K > 0 else None,
        }

        try:
            iv = implied_volatility(mp, S, K, T, r, q, otype)
            entry["implied_vol"] = iv
            entry["error"] = None
        except ValueError as exc:
            entry["implied_vol"] = None
            entry["error"] = str(exc)

        results.append(entry)

    return results


def generate_demo_surface(
    S: float = 100.0,
    r: float = 0.05,
    q: float = 0.0,
    base_vol: float = 0.20,
    skew_slope: float = -0.10,
    smile_curvature: float = 0.05,
    term_slope: float = 0.02,
    expiries: Optional[list[float]] = None,
    strikes: Optional[list[float]] = None,
) -> dict:
    """Generate a realistic demo implied volatility surface.

    The surface is built from a simple parametric model:
        IV(K, T) = base_vol + skew * ln(K/S) + curvature * ln(K/S)^2 + term * sqrt(T)

    This produces:
    - Negative skew (lower strikes have higher IV) -- typical for equities.
    - Smile curvature (OTM puts and calls have higher IV than ATM).
    - Upward-sloping term structure (longer expiries have slightly higher IV).

    Parameters
    ----------
    S : float
        Spot price.
    r : float
        Risk-free rate.
    q : float
        Dividend yield.
    base_vol : float
        ATM volatility at T = 0 (baseline).
    skew_slope : float
        Coefficient for ln(K/S) -- negative means typical equity skew.
    smile_curvature : float
        Coefficient for ln(K/S)^2 -- positive adds curvature.
    term_slope : float
        Coefficient for sqrt(T) -- positive means upward term structure.
    expiries : list[float] or None
        Expiry times in years.  Default: [0.083, 0.25, 0.5, 1.0, 2.0].
    strikes : list[float] or None
        Strike prices.  Default: 70 to 130 in steps of 5.

    Returns
    -------
    dict
        Keys: spot, risk_free_rate, dividend_yield, expiries, strikes,
              surface (list of dicts with strike, expiry_years, implied_vol,
              market_price, option_type, moneyness).
    """
    if expiries is None:
        expiries = [0.083, 0.25, 0.5, 1.0, 2.0]
    if strikes is None:
        strikes = [float(k) for k in range(70, 135, 5)]

    surface_points = []
    for T in expiries:
        for K in strikes:
            log_m = math.log(K / S)
            iv = (
                base_vol
                + skew_slope * log_m
                + smile_curvature * log_m ** 2
                + term_slope * math.sqrt(T)
            )
            # Clamp IV to sensible range
            iv = max(0.01, min(iv, 3.0))

            # Use put for ITM calls (K < S) for more liquid quote convention
            otype = "put" if K < S else "call"
            mp = bsm_price(S, K, T, r, iv, q, otype)

            surface_points.append({
                "strike": K,
                "expiry_years": T,
                "implied_vol": iv,
                "market_price": mp,
                "option_type": otype,
                "moneyness": S / K,
                "log_moneyness": log_m,
            })

    return {
        "spot": S,
        "risk_free_rate": r,
        "dividend_yield": q,
        "expiries": expiries,
        "strikes": strikes,
        "surface": surface_points,
    }


def realized_vs_implied(
    prices: list[float],
    implied_vol: float,
    window: int = 21,
    ann_factor: float = 252.0,
) -> dict:
    """Compare rolling realized volatility against a fixed implied vol.

    Parameters
    ----------
    prices : list[float]
        Chronological price series.
    implied_vol : float
        Constant implied volatility for comparison.
    window : int
        Rolling window for realized vol calculation.
    ann_factor : float
        Annualisation factor.

    Returns
    -------
    dict
        Keys: indices (list), realized_vol (list), implied_vol (float),
              mean_realized, vol_risk_premium (implied - mean_realized).
    """
    from engine.volatility.historical import rolling_historical_volatility

    indices, rvol = rolling_historical_volatility(prices, window, ann_factor)
    mean_rv = float(np.mean(rvol))

    return {
        "indices": indices.tolist(),
        "realized_vol": rvol.tolist(),
        "implied_vol": implied_vol,
        "mean_realized": mean_rv,
        "vol_risk_premium": implied_vol - mean_rv,
    }
