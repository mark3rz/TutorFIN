"""Portfolio analytics engine: valuation, Greeks aggregation, VaR, and ES.

Provides portfolio-level analytics for collections of option positions:
- Position-level and aggregate valuation via BSM
- Greeks aggregation (delta-equivalent weighting)
- Parametric VaR and Expected Shortfall (Cornish-Fisher not included in v1)
- Historical simulation VaR placeholder (requires return data)
- Monte Carlo VaR via simulated portfolio P&L

VaR and ES Methodology
----------------------
**Parametric (delta-normal) VaR:**
    VaR_alpha = -mu_P + z_alpha * sigma_P

    where:
        mu_P    = portfolio delta * S * (r - q) * dt (expected drift)
        sigma_P = |portfolio delta| * S * sigma * sqrt(dt)
        z_alpha = N^{-1}(alpha)   (e.g. 1.645 for 95%)

    This is a first-order approximation suitable when the portfolio is
    approximately delta-linear.

**Monte Carlo VaR:**
    Simulate N scenarios of the underlying(s), reprice the portfolio
    under each scenario, compute portfolio P&L distribution, then:
        VaR   = -percentile(P&L, 1 - alpha)
        ES    = -mean(P&L | P&L < -VaR)

Conventions
-----------
- VaR is reported as a *positive* number representing a loss.
- ES (CVaR) is the average loss conditional on exceeding VaR.
- Holding period in trading days (default 1).
- Confidence level as decimal (e.g. 0.95, 0.99).
- All positions are vanilla options on the same underlying.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy.stats import norm

from engine.models.black_scholes import bsm_price
from engine.greeks.analytical import bsm_greeks


def value_portfolio(
    positions: list[dict[str, Any]],
    r: float,
    sigma_default: float,
    vol_overrides: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Value a portfolio of option positions and aggregate Greeks.

    Parameters
    ----------
    positions : list[dict]
        Each dict must contain:
            instrument_id, instrument_type, quantity, side,
            spot, strike, expiry_years, option_type, exercise_style,
            dividend_yield (optional, default 0).
        ``side`` is ``"long"`` or ``"short"`` (sign is applied to quantity).
    r : float
        Risk-free rate.
    sigma_default : float
        Default volatility (can be overridden per-instrument).
    vol_overrides : dict, optional
        {instrument_id: vol} overrides.

    Returns
    -------
    dict
        total_value, positions_valued (list), risk_metrics (aggregated Greeks).
    """
    vol_overrides = vol_overrides or {}
    positions_valued = []
    total_value = 0.0
    total_delta = 0.0
    total_gamma = 0.0
    total_vega = 0.0
    total_theta = 0.0

    for pos in positions:
        iid = pos["instrument_id"]
        itype = pos.get("instrument_type", "option")
        qty = pos["quantity"]
        side = pos["side"]
        sign = 1.0 if side == "long" else -1.0
        signed_qty = qty * sign

        if itype == "option":
            spot = pos["spot"]
            strike = pos["strike"]
            T = pos["expiry_years"]
            otype = pos["option_type"]
            q = pos.get("dividend_yield", 0.0)
            sigma = vol_overrides.get(iid, sigma_default)

            price = bsm_price(spot, strike, T, r, sigma, q, otype)
            greeks = bsm_greeks(spot, strike, T, r, sigma, q, otype)

            position_value = price * signed_qty
            total_value += position_value
            total_delta += greeks["delta"] * signed_qty
            total_gamma += greeks["gamma"] * signed_qty
            total_vega += greeks["vega"] * signed_qty
            total_theta += greeks["theta"] * signed_qty

            positions_valued.append({
                "instrument_id": iid,
                "instrument_type": itype,
                "price": price,
                "quantity": qty,
                "side": side,
                "position_value": position_value,
                "delta": greeks["delta"] * signed_qty,
                "gamma": greeks["gamma"] * signed_qty,
                "vega": greeks["vega"] * signed_qty,
                "theta": greeks["theta"] * signed_qty,
            })
        else:
            # Equity positions (simple: value = spot * qty)
            spot = pos.get("spot", pos.get("entry_price", 0.0))
            position_value = spot * signed_qty
            total_value += position_value
            total_delta += signed_qty  # equity delta = 1 per share
            positions_valued.append({
                "instrument_id": iid,
                "instrument_type": itype,
                "price": spot,
                "quantity": qty,
                "side": side,
                "position_value": position_value,
                "delta": signed_qty,
                "gamma": 0.0,
                "vega": 0.0,
                "theta": 0.0,
            })

    return {
        "total_value": total_value,
        "positions_valued": positions_valued,
        "risk_metrics": {
            "total_delta": total_delta,
            "total_gamma": total_gamma,
            "total_vega": total_vega,
            "total_theta": total_theta,
        },
    }


def parametric_var_es(
    portfolio_delta: float,
    portfolio_gamma: float,
    S: float,
    sigma: float,
    r: float = 0.0,
    q: float = 0.0,
    holding_days: int = 1,
    confidence: float = 0.95,
) -> dict[str, float]:
    """Compute parametric (delta-normal) VaR and ES.

    This is a first-order approximation.  For portfolios with significant
    gamma, the delta-gamma-normal or Cornish-Fisher approach would be
    more appropriate (not implemented in v1).

    Parameters
    ----------
    portfolio_delta : float
        Net portfolio delta.
    portfolio_gamma : float
        Net portfolio gamma (used for delta-gamma VaR).
    S : float
        Underlying spot price.
    sigma : float
        Annualised volatility.
    r, q : float
        Risk-free rate and dividend yield (for drift).
    holding_days : int
        Holding period in trading days (default 1).
    confidence : float
        Confidence level (e.g. 0.95, 0.99).

    Returns
    -------
    dict
        var : float — Value at Risk (positive = loss),
        es : float — Expected Shortfall,
        method : str — "parametric_delta_normal".
    """
    dt = holding_days / 252.0
    z = norm.ppf(confidence)

    # Portfolio P&L standard deviation (first-order delta approximation)
    sigma_portfolio = abs(portfolio_delta) * S * sigma * math.sqrt(dt)

    # Expected drift
    mu_portfolio = portfolio_delta * S * (r - q) * dt

    # Delta-normal VaR
    var = -mu_portfolio + z * sigma_portfolio

    # Delta-normal ES: E[-P&L | P&L < -VaR]
    # For normal distribution: ES = mu - sigma * phi(z) / (1 - alpha)
    es = -mu_portfolio + sigma_portfolio * norm.pdf(z) / (1.0 - confidence)

    return {
        "var": max(var, 0.0),
        "es": max(es, 0.0),
        "method": "parametric_delta_normal",
    }


def monte_carlo_var_es(
    positions: list[dict[str, Any]],
    r: float,
    sigma_default: float,
    holding_days: int = 1,
    confidence: float = 0.95,
    num_scenarios: int = 10000,
    seed: int | None = None,
    vol_overrides: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Compute VaR and ES via Monte Carlo simulation.

    Simulates the underlying price under GBM for the holding period,
    reprices all positions, and computes the portfolio P&L distribution.

    All positions are assumed to be on the *same* underlying (single-asset
    portfolio assumption for v1).

    Parameters
    ----------
    positions, r, sigma_default, vol_overrides :
        Same as :func:`value_portfolio`.
    holding_days : int
        Holding period in trading days.
    confidence : float
        Confidence level.
    num_scenarios : int
        Number of Monte Carlo scenarios (default 10,000).
    seed : int, optional
        Random seed for reproducibility.

    Returns
    -------
    dict
        var, es, pnl_distribution (sampled), method, num_scenarios.
    """
    vol_overrides = vol_overrides or {}
    rng = np.random.default_rng(seed)

    dt = holding_days / 252.0

    # Get the underlying spot from the first option position
    S = None
    for pos in positions:
        if "spot" in pos:
            S = pos["spot"]
            break

    if S is None:
        raise ValueError("No position with 'spot' price found")

    # Current portfolio value
    current = value_portfolio(positions, r, sigma_default, vol_overrides)
    current_value = current["total_value"]

    # Simulate underlying scenarios
    sigma_sim = sigma_default  # use default vol for simulation
    Z = rng.standard_normal(num_scenarios)
    S_new = S * np.exp((r - 0.5 * sigma_sim ** 2) * dt + sigma_sim * math.sqrt(dt) * Z)

    # Reprice portfolio under each scenario
    pnl = np.empty(num_scenarios)
    for i, s_new in enumerate(S_new):
        scenario_value = 0.0
        for pos in positions:
            iid = pos["instrument_id"]
            itype = pos.get("instrument_type", "option")
            qty = pos["quantity"]
            side = pos["side"]
            sign = 1.0 if side == "long" else -1.0
            signed_qty = qty * sign

            if itype == "option":
                strike = pos["strike"]
                T = pos["expiry_years"]
                otype = pos["option_type"]
                q = pos.get("dividend_yield", 0.0)
                sigma = vol_overrides.get(iid, sigma_default)
                new_T = max(T - dt, 0.0)

                if s_new <= 0 or sigma <= 0:
                    px = 0.0
                else:
                    px = bsm_price(float(s_new), strike, new_T, r, sigma, q, otype)
                scenario_value += px * signed_qty
            else:
                scenario_value += float(s_new) * signed_qty

        pnl[i] = scenario_value - current_value

    # VaR and ES from empirical distribution
    var_quantile = np.percentile(pnl, (1 - confidence) * 100)
    var = -var_quantile  # positive = loss
    tail_losses = pnl[pnl <= var_quantile]
    es = -float(np.mean(tail_losses)) if len(tail_losses) > 0 else var

    # Subsample the distribution for frontend charting (max 500 points)
    subsample_size = min(500, num_scenarios)
    indices = rng.choice(num_scenarios, size=subsample_size, replace=False)
    pnl_sample = pnl[np.sort(indices)].tolist()

    return {
        "var": max(float(var), 0.0),
        "es": max(float(es), 0.0),
        "pnl_distribution": pnl_sample,
        "method": "monte_carlo",
        "num_scenarios": num_scenarios,
        "current_value": current_value,
    }
