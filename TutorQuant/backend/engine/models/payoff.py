"""Payoff computation utilities for vanilla options.

Provides functions for computing option payoff profiles (long/short, with
premium) and generating structured payoff data suitable for charting on
the frontend.
"""

from __future__ import annotations

import numpy as np


def compute_payoff(
    spot_range: np.ndarray,
    strike: float,
    option_type: str,
    position: str = "long",
    premium: float = 0.0,
) -> np.ndarray:
    """Compute the payoff (P&L) for a vanilla option position.

    Parameters
    ----------
    spot_range : np.ndarray
        Array of underlying prices at expiry.
    strike : float
        Strike price of the option.
    option_type : str
        ``"call"`` or ``"put"``.
    position : str, optional
        ``"long"`` or ``"short"``, default ``"long"``.
    premium : float, optional
        Option premium paid (for long) or received (for short).
        Default 0.0 (intrinsic payoff only).

    Returns
    -------
    np.ndarray
        Payoff (P&L) at each spot level, same shape as *spot_range*.

    Raises
    ------
    ValueError
        If *option_type* or *position* is invalid.
    """
    if option_type not in ("call", "put"):
        raise ValueError(f"option_type must be 'call' or 'put', got {option_type!r}")
    if position not in ("long", "short"):
        raise ValueError(f"position must be 'long' or 'short', got {position!r}")

    if option_type == "call":
        intrinsic = np.maximum(spot_range - strike, 0.0)
    else:
        intrinsic = np.maximum(strike - spot_range, 0.0)

    if position == "long":
        return intrinsic - premium
    else:
        return premium - intrinsic


def generate_payoff_data(
    strike: float,
    option_type: str,
    premium: float = 0.0,
    spot_min: float | None = None,
    spot_max: float | None = None,
    num_points: int = 200,
) -> dict:
    """Generate payoff profile data for charting.

    Parameters
    ----------
    strike : float
        Strike price.
    option_type : str
        ``"call"`` or ``"put"``.
    premium : float, optional
        Option premium, default 0.
    spot_min : float or None, optional
        Lower bound of the spot range.  Defaults to ``strike * 0.5``.
    spot_max : float or None, optional
        Upper bound of the spot range.  Defaults to ``strike * 1.5``.
    num_points : int, optional
        Number of points in the range, default 200.

    Returns
    -------
    dict
        ``spot_range``  : list[float]
        ``long_payoff``  : list[float]
        ``short_payoff`` : list[float]
        ``breakeven``    : float
    """
    if spot_min is None:
        spot_min = strike * 0.5
    if spot_max is None:
        spot_max = strike * 1.5

    spots = np.linspace(spot_min, spot_max, num_points)

    long_pnl = compute_payoff(spots, strike, option_type, position="long", premium=premium)
    short_pnl = compute_payoff(spots, strike, option_type, position="short", premium=premium)

    # Breakeven: spot level where long P&L = 0
    if option_type == "call":
        breakeven = strike + premium
    else:
        breakeven = strike - premium

    return {
        "spot_range": spots.tolist(),
        "long_payoff": long_pnl.tolist(),
        "short_payoff": short_pnl.tolist(),
        "breakeven": float(breakeven),
    }
