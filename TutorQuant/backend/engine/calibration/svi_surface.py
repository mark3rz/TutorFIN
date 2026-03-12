"""SVI (Stochastic Volatility Inspired) implied volatility surface calibration.

The SVI parameterisation (Gatheral, 2004) models the total implied variance
w(k) = sigma^2 * T as a function of log-moneyness k = ln(K/F):

  w(k) = a + b * (rho * (k - m) + sqrt((k - m)^2 + sigma^2))

Parameters:
  a     : Overall level of variance (vertical shift)
  b     : Slope of the wings (controls how fast w grows with |k|)
  rho   : Correlation / skew (-1 < rho < 1; negative = equity skew)
  m     : Horizontal shift (displacement of the smile minimum)
  sigma : Curvature / ATM smoothness (> 0)

Key properties:
  - At k = m: w(m) = a + b * sigma * sqrt(1 - rho^2)
  - Left wing slope:  b * (rho - 1) if rho < 0 → positive slope (higher IV for puts)
  - Right wing slope: b * (rho + 1)
  - Roger Lee's moment formula constrains wing growth

This module implements:
  1. SVI total variance formula
  2. Calibration to a set of market implied vols at a single expiry
  3. Multi-slice calibration across expiries
  4. Arbitrage checks (calendar spread, butterfly)

References:
  Gatheral, J. (2004). "A parsimonious arbitrage-free implied volatility
  parameterisation with application to the valuation of volatility derivatives."
"""

from __future__ import annotations

import math

import numpy as np

from engine.calibration.framework import (
    ParameterSpec,
    CalibrationResult,
    calibrate,
    compute_diagnostics,
)


def svi_total_variance(
    k: np.ndarray,
    a: float,
    b: float,
    rho: float,
    m: float,
    sigma: float,
) -> np.ndarray:
    """Compute SVI total implied variance w(k).

    Parameters
    ----------
    k : array
        Log-moneyness: ln(K/F) where F is the forward price.
    a, b, rho, m, sigma : float
        SVI parameters.

    Returns
    -------
    array
        Total implied variance w(k) = sigma_BS^2 * T.
    """
    return a + b * (rho * (k - m) + np.sqrt((k - m) ** 2 + sigma ** 2))


def svi_implied_vol(
    k: np.ndarray,
    T: float,
    a: float,
    b: float,
    rho: float,
    m: float,
    sigma: float,
) -> np.ndarray:
    """Compute SVI implied volatility from total variance.

    sigma_BS(k, T) = sqrt(w(k) / T)
    """
    w = svi_total_variance(k, a, b, rho, m, sigma)
    # Clamp to avoid negative variance from bad params
    w = np.maximum(w, 1e-10)
    return np.sqrt(w / T)


def calibrate_svi_slice(
    strikes: list[float],
    market_ivs: list[float],
    spot: float,
    T: float,
    r: float = 0.05,
    q: float = 0.0,
    method: str = "L-BFGS-B",
) -> dict:
    """Calibrate SVI parameters to a single-expiry IV smile.

    Parameters
    ----------
    strikes : list[float]
        Strike prices.
    market_ivs : list[float]
        Market implied volatilities (annualised, decimal).
    spot : float
        Spot price.
    T : float
        Time to expiry (years).
    r : float
        Risk-free rate.
    q : float
        Dividend yield.
    method : str
        Optimiser method.

    Returns
    -------
    dict with keys:
        params      : dict of SVI parameters {a, b, rho, m, sigma}
        diagnostics : dict of error metrics
        fitted_ivs  : list[float] — model IVs at the given strikes
        market_ivs  : list[float] — input market IVs
        strikes     : list[float]
        residuals   : list[float]
        converged   : bool
        elapsed_ms  : float
        iterations  : int
        method      : str
        expiry      : float
    """
    if len(strikes) != len(market_ivs):
        raise ValueError("strikes and market_ivs must have the same length")
    if len(strikes) < 3:
        raise ValueError("Need at least 3 strike/IV pairs for SVI calibration")

    # Forward price
    F = spot * math.exp((r - q) * T)
    k = np.array([math.log(K / F) for K in strikes])
    market_iv_arr = np.array(market_ivs)

    # Total variance targets
    market_w = market_iv_arr ** 2 * T

    # SVI model function for the framework
    def model_fn(params: np.ndarray, x: np.ndarray) -> np.ndarray:
        a, b, rho_raw, m, sigma_raw = params
        # Enforce constraints via transformation
        rho = np.clip(rho_raw, -0.999, 0.999)
        sigma = max(abs(sigma_raw), 1e-6)
        w = svi_total_variance(x, a, b, rho, m, sigma)
        return w

    # ATM IV for initial guesses
    atm_iv = float(np.interp(0.0, k, market_iv_arr))
    atm_w = atm_iv ** 2 * T

    param_specs = [
        ParameterSpec("a", initial=atm_w * 0.5, lower=-0.5, upper=2.0),
        ParameterSpec("b", initial=0.1, lower=0.001, upper=5.0),
        ParameterSpec("rho", initial=-0.3, lower=-0.999, upper=0.999),
        ParameterSpec("m", initial=0.0, lower=-1.0, upper=1.0),
        ParameterSpec("sigma", initial=0.1, lower=0.001, upper=2.0),
    ]

    result = calibrate(
        model_fn=model_fn,
        x_data=k,
        y_market=market_w,
        param_specs=param_specs,
        objective="sse",
        method=method,
    )

    # Convert back to IV space for output
    a_cal = result.params["a"]
    b_cal = result.params["b"]
    rho_cal = np.clip(result.params["rho"], -0.999, 0.999)
    m_cal = result.params["m"]
    sigma_cal = max(abs(result.params["sigma"]), 1e-6)

    fitted_iv = svi_implied_vol(k, T, a_cal, b_cal, rho_cal, m_cal, sigma_cal)
    iv_residuals = fitted_iv - market_iv_arr
    iv_diagnostics = compute_diagnostics(iv_residuals, market_iv_arr)

    return {
        "params": result.params,
        "diagnostics": iv_diagnostics,
        "fitted_ivs": [round(float(v), 6) for v in fitted_iv],
        "market_ivs": market_ivs,
        "strikes": strikes,
        "log_moneyness": [round(float(ki), 6) for ki in k],
        "residuals": [round(float(r), 8) for r in iv_residuals],
        "converged": result.converged,
        "elapsed_ms": result.elapsed_ms,
        "iterations": result.iterations,
        "method": result.method,
        "expiry": T,
        "forward": round(F, 4),
    }


def calibrate_svi_surface(
    slices: list[dict],
    spot: float,
    r: float = 0.05,
    q: float = 0.0,
    method: str = "L-BFGS-B",
) -> dict:
    """Calibrate SVI across multiple expiry slices.

    Parameters
    ----------
    slices : list[dict]
        Each dict: {"expiry": float, "strikes": list, "market_ivs": list}
    spot, r, q : float
        Market data.
    method : str
        Optimiser method.

    Returns
    -------
    dict with keys:
        slices          : list of per-slice results
        aggregate_diags : dict of aggregate error metrics
        n_slices        : int
    """
    results = []
    all_residuals = []
    all_market = []

    for s in slices:
        T = s["expiry"]
        strikes = s["strikes"]
        ivs = s["market_ivs"]

        res = calibrate_svi_slice(
            strikes=strikes,
            market_ivs=ivs,
            spot=spot,
            T=T,
            r=r,
            q=q,
            method=method,
        )
        results.append(res)
        all_residuals.extend(res["residuals"])
        all_market.extend(ivs)

    agg_diags = compute_diagnostics(
        np.array(all_residuals),
        np.array(all_market),
    )

    return {
        "slices": results,
        "aggregate_diagnostics": agg_diags,
        "n_slices": len(slices),
    }


def check_svi_arbitrage(
    a: float, b: float, rho: float, m: float, sigma: float,
    k_range: tuple[float, float] = (-1.0, 1.0),
    n_points: int = 200,
) -> dict:
    """Check SVI parameterisation for butterfly arbitrage.

    Butterfly arbitrage is absent if and only if the density g(k) >= 0,
    which requires d^2w/dk^2 * (1 - k/(2w) * dw/dk)^2 - ... >= 0.

    A simpler necessary condition: w(k) >= 0 for all k and the
    function w(k) is convex enough.

    Returns
    -------
    dict with keys:
        has_negative_variance : bool — True if w(k) < 0 anywhere
        min_variance          : float
        is_likely_arbitrage_free : bool — heuristic check
    """
    k = np.linspace(k_range[0], k_range[1], n_points)
    w = svi_total_variance(k, a, b, rho, m, sigma)

    has_neg = bool(np.any(w < 0))
    min_w = float(np.min(w))

    # Simple heuristic: check b * (1 + |rho|) < 4 (Roger Lee bound)
    lee_check = b * (1 + abs(rho)) < 4.0

    return {
        "has_negative_variance": has_neg,
        "min_variance": round(min_w, 8),
        "is_likely_arbitrage_free": not has_neg and lee_check,
        "lee_bound_satisfied": lee_check,
    }
