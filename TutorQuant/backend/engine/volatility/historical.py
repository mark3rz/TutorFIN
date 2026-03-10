"""Historical and EWMA volatility estimators.

All volatility figures are annualised using an explicit annualisation factor
(default 252 trading days per year).  The caller must be aware of whether the
input returns are daily, weekly, or otherwise, and set ``ann_factor``
accordingly.

Close-to-close estimator
------------------------
    sigma_daily = std(log returns)
    sigma_annual = sigma_daily * sqrt(ann_factor)

EWMA (Exponentially Weighted Moving Average)
--------------------------------------------
The RiskMetrics variant uses a decay factor lambda (typically 0.94 for daily
data):

    sigma^2_t = lambda * sigma^2_{t-1} + (1 - lambda) * r_{t-1}^2

This gives more weight to recent observations than the equal-weight estimator
and responds faster to regime changes.

Conventions
-----------
- Prices are assumed to be ordered chronologically (oldest first).
- Log returns: r_t = ln(P_t / P_{t-1}).
- Annualisation factor: 252 (trading days), 365 (calendar days), or 52 (weeks).
"""

from __future__ import annotations

import math

import numpy as np


def log_returns(prices: list[float] | np.ndarray) -> np.ndarray:
    """Compute log returns from an array of prices.

    Parameters
    ----------
    prices : array-like
        Chronological price series (oldest first, length >= 2).

    Returns
    -------
    np.ndarray
        Log returns of length ``len(prices) - 1``.

    Raises
    ------
    ValueError
        If fewer than 2 prices are provided or any price is <= 0.
    """
    prices = np.asarray(prices, dtype=np.float64)
    if len(prices) < 2:
        raise ValueError("Need at least 2 prices to compute returns")
    if np.any(prices <= 0):
        raise ValueError("All prices must be > 0 for log returns")
    return np.diff(np.log(prices))


def historical_volatility(
    prices: list[float] | np.ndarray,
    window: int | None = None,
    ann_factor: float = 252.0,
) -> float:
    """Close-to-close historical volatility (annualised).

    Parameters
    ----------
    prices : array-like
        Chronological price series (>= 2 observations).
    window : int or None
        If provided, use only the last ``window`` returns.  If None, use all.
    ann_factor : float
        Annualisation factor.  252 for daily data (trading days), 365 for
        calendar days, 52 for weekly data.

    Returns
    -------
    float
        Annualised volatility (e.g. 0.20 for 20%).

    Raises
    ------
    ValueError
        If the price series is too short, or window < 2.
    """
    rets = log_returns(prices)
    if window is not None:
        if window < 2:
            raise ValueError(f"Window must be >= 2, got {window}")
        rets = rets[-window:]
    if len(rets) < 2:
        raise ValueError("Need at least 2 returns for volatility estimation")
    daily_vol = float(np.std(rets, ddof=1))
    return daily_vol * math.sqrt(ann_factor)


def rolling_historical_volatility(
    prices: list[float] | np.ndarray,
    window: int = 21,
    ann_factor: float = 252.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Rolling historical volatility (annualised).

    Parameters
    ----------
    prices : array-like
        Chronological price series.
    window : int
        Rolling window size (in number of returns, not prices).
    ann_factor : float
        Annualisation factor.

    Returns
    -------
    tuple[np.ndarray, np.ndarray]
        (indices, volatilities) where indices are 0-based into the
        original price array (offset by window).
    """
    rets = log_returns(prices)
    if window < 2:
        raise ValueError(f"Window must be >= 2, got {window}")
    if len(rets) < window:
        raise ValueError(f"Need at least {window} returns, got {len(rets)}")

    n = len(rets) - window + 1
    vols = np.empty(n)
    sqrt_ann = math.sqrt(ann_factor)
    for i in range(n):
        segment = rets[i : i + window]
        vols[i] = float(np.std(segment, ddof=1)) * sqrt_ann

    # Index into original price array: the vol at position i corresponds
    # to price index (i + window)
    indices = np.arange(window, window + n)
    return indices, vols


def ewma_volatility(
    prices: list[float] | np.ndarray,
    lam: float = 0.94,
    ann_factor: float = 252.0,
) -> float:
    """EWMA (RiskMetrics) volatility estimate (annualised).

    Uses the recursive formula:
        sigma^2_t = lambda * sigma^2_{t-1} + (1 - lambda) * r_{t-1}^2

    Initialised with the sample variance of all returns.

    Parameters
    ----------
    prices : array-like
        Chronological price series.
    lam : float
        Decay factor (0 < lambda < 1).  RiskMetrics default is 0.94 for
        daily data.
    ann_factor : float
        Annualisation factor.

    Returns
    -------
    float
        Annualised EWMA volatility.

    Raises
    ------
    ValueError
        If lambda is out of range or prices too short.
    """
    if not 0 < lam < 1:
        raise ValueError(f"Lambda must be in (0, 1), got {lam}")
    rets = log_returns(prices)
    if len(rets) < 2:
        raise ValueError("Need at least 2 returns for EWMA")

    # Initialise with sample variance
    var = float(np.var(rets, ddof=1))
    for r in rets:
        var = lam * var + (1.0 - lam) * r * r

    return math.sqrt(var * ann_factor)


def ewma_volatility_series(
    prices: list[float] | np.ndarray,
    lam: float = 0.94,
    ann_factor: float = 252.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Full EWMA volatility time series.

    Parameters
    ----------
    prices : array-like
        Chronological price series.
    lam : float
        Decay factor.
    ann_factor : float
        Annualisation factor.

    Returns
    -------
    tuple[np.ndarray, np.ndarray]
        (indices, volatilities) where indices are into the original price
        array (starting at index 1 since the first return is needed).
    """
    if not 0 < lam < 1:
        raise ValueError(f"Lambda must be in (0, 1), got {lam}")
    rets = log_returns(prices)
    if len(rets) < 2:
        raise ValueError("Need at least 2 returns for EWMA series")

    sqrt_ann = math.sqrt(ann_factor)
    var = rets[0] ** 2  # initialise with first squared return
    vols = np.empty(len(rets))
    vols[0] = math.sqrt(var) * sqrt_ann

    for i in range(1, len(rets)):
        var = lam * var + (1.0 - lam) * rets[i] ** 2
        vols[i] = math.sqrt(var) * sqrt_ann

    indices = np.arange(1, len(rets) + 1)
    return indices, vols
