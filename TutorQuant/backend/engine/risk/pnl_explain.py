"""Greek-based P&L explanation engine.

Decomposes option P&L into contributions from each Greek (delta, gamma,
vega, theta) under a scenario shock.  This is the standard "P&L explain"
used by trading desks to attribute daily P&L.

Taylor Expansion
-----------------
The change in option value under small shocks dS, dsigma, dt:

    dV ≈ Delta * dS
       + ½ * Gamma * dS²
       + Vega * dsigma
       + Theta * dt
       + (higher-order / cross terms)

The residual (unexplained) is: actual dV - sum of Greek contributions.

Conventions
-----------
- dS is an absolute spot move (e.g. +5 means spot goes from 100 to 105).
- dsigma is an absolute vol move (e.g. +0.02 means 20% -> 22%).
- dt is in years (e.g. 1/252 ≈ 0.004 for one trading day).
- All Greeks use the same conventions as bsm_greeks().
"""

from __future__ import annotations

from typing import Any

from engine.models.black_scholes import bsm_price
from engine.greeks.analytical import bsm_greeks


def pnl_explain(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
    dS: float = 0.0,
    dsigma: float = 0.0,
    dt: float = 0.0,
    position_size: float = 1.0,
) -> dict[str, Any]:
    """Decompose option P&L into Greek contributions.

    Parameters
    ----------
    S, K, T, r, sigma, q, option_type :
        Current option parameters.
    dS : float
        Absolute spot move (new spot = S + dS).
    dsigma : float
        Absolute volatility move (new vol = sigma + dsigma).
    dt : float
        Time elapsed in years (positive = time passes).
    position_size : float
        Number of contracts (positive = long, negative = short).

    Returns
    -------
    dict
        Keys: delta_pnl, gamma_pnl, vega_pnl, theta_pnl,
              total_greek_pnl, actual_pnl, unexplained, position_size,
              greeks (dict of current Greeks), scenario.
    """
    greeks = bsm_greeks(S, K, T, r, sigma, q, option_type)

    # Greek-based P&L contributions (per contract)
    delta_pnl = greeks["delta"] * dS
    gamma_pnl = 0.5 * greeks["gamma"] * dS * dS
    vega_pnl = greeks["vega"] * dsigma
    theta_pnl = greeks["theta"] * dt  # theta is already annualised

    total_greek_pnl = delta_pnl + gamma_pnl + vega_pnl + theta_pnl

    # Actual P&L by full repricing
    old_price = bsm_price(S, K, T, r, sigma, q, option_type)

    new_S = S + dS
    new_sigma = sigma + dsigma
    new_T = max(T - dt, 0.0)

    if new_S <= 0:
        new_price = 0.0
    elif new_sigma <= 0:
        # With zero vol, option is worth intrinsic at expiry
        if option_type == "call":
            new_price = max(new_S - K, 0.0) if new_T <= 0 else max(new_S - K * __import__("math").exp(-r * new_T), 0.0)
        else:
            new_price = max(K - new_S, 0.0) if new_T <= 0 else max(K * __import__("math").exp(-r * new_T) - new_S, 0.0)
    else:
        new_price = bsm_price(new_S, K, new_T, r, new_sigma, q, option_type)

    actual_pnl = new_price - old_price
    unexplained = actual_pnl - total_greek_pnl

    # Scale by position size
    return {
        "delta_pnl": delta_pnl * position_size,
        "gamma_pnl": gamma_pnl * position_size,
        "vega_pnl": vega_pnl * position_size,
        "theta_pnl": theta_pnl * position_size,
        "total_greek_pnl": total_greek_pnl * position_size,
        "actual_pnl": actual_pnl * position_size,
        "unexplained": unexplained * position_size,
        "old_price": old_price,
        "new_price": new_price,
        "position_size": position_size,
        "greeks": greeks,
        "scenario": {
            "dS": dS,
            "dsigma": dsigma,
            "dt": dt,
        },
    }


def scenario_grid(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
    spot_shocks: list[float] | None = None,
    vol_shocks: list[float] | None = None,
) -> dict[str, Any]:
    """Compute a grid of P&L values across spot and vol shocks.

    Returns a 2D grid suitable for heatmap display.

    Parameters
    ----------
    spot_shocks : list[float]
        Absolute spot shocks (e.g. [-20, -10, 0, 10, 20]).
    vol_shocks : list[float]
        Absolute vol shocks (e.g. [-0.05, -0.025, 0, 0.025, 0.05]).

    Returns
    -------
    dict
        spot_shocks, vol_shocks, pnl_grid (2D list), base_price.
    """
    if spot_shocks is None:
        spot_shocks = [-20.0, -15.0, -10.0, -5.0, 0.0, 5.0, 10.0, 15.0, 20.0]
    if vol_shocks is None:
        vol_shocks = [-0.05, -0.025, 0.0, 0.025, 0.05]

    base_price = bsm_price(S, K, T, r, sigma, q, option_type)

    pnl_grid: list[list[float]] = []
    for ds in spot_shocks:
        row: list[float] = []
        for dv in vol_shocks:
            new_S = S + ds
            new_sigma = sigma + dv
            if new_S <= 0 or new_sigma <= 0:
                row.append(float("nan"))
            else:
                new_price = bsm_price(new_S, K, T, r, new_sigma, q, option_type)
                row.append(new_price - base_price)
        pnl_grid.append(row)

    return {
        "spot_shocks": spot_shocks,
        "vol_shocks": vol_shocks,
        "pnl_grid": pnl_grid,
        "base_price": base_price,
    }
