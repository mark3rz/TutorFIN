"""Discount-factor term structure and bootstrapping foundations.

Discount Factors
----------------
The discount factor D(T) is the present value of $1 received at time T:

    D(T) = 1 / (1 + r(T))^T   (for discrete compounding)
    D(T) = e^{-r(T) * T}       (for continuous compounding)

where r(T) is the zero rate for maturity T.

Zero rates from discount factors:
    r(T) = (1/D(T))^{1/T} - 1     (annual compounding)
    r(T) = -ln(D(T)) / T           (continuous compounding)

Bootstrap Algorithm
-------------------
Given a set of par instruments (bonds trading at par with known coupons),
we can iteratively solve for zero rates:

1. The shortest-maturity instrument gives the first zero rate directly.
2. For each subsequent instrument, use previously bootstrapped zero rates
   to discount all but the final cash flow, then solve for the remaining rate.

Forward Rates
-------------
The forward rate between T1 and T2:
    f(T1, T2) = [D(T1)/D(T2) - 1] / (T2 - T1)   (simple)
    f(T1, T2) = [D(T1)/D(T2)]^{1/(T2-T1)} - 1    (annualised)

Conventions
-----------
- By default, we use annual compounding for zero rates.
- Continuous compounding variants are provided for comparison.
"""

from __future__ import annotations

import math
from typing import Optional

import numpy as np


def discount_factors_from_zero_rates(
    times: list[float],
    zero_rates: list[float],
    compounding: str = "annual",
) -> list[float]:
    """Compute discount factors from zero rates.

    Parameters
    ----------
    times : list[float]
        Maturities in years.
    zero_rates : list[float]
        Annualised zero rates for each maturity.
    compounding : str
        "annual", "semi_annual", "quarterly", or "continuous".

    Returns
    -------
    list[float]
        Discount factors.
    """
    dfs = []
    for T, r in zip(times, zero_rates):
        if T <= 0:
            dfs.append(1.0)
            continue
        if compounding == "continuous":
            dfs.append(math.exp(-r * T))
        elif compounding == "semi_annual":
            dfs.append((1.0 + r / 2) ** (-2 * T))
        elif compounding == "quarterly":
            dfs.append((1.0 + r / 4) ** (-4 * T))
        else:  # annual
            dfs.append((1.0 + r) ** (-T))
    return dfs


def zero_rates_from_discount_factors(
    times: list[float],
    dfs: list[float],
    compounding: str = "annual",
) -> list[float]:
    """Compute zero rates from discount factors.

    Parameters
    ----------
    times : list[float]
        Maturities in years.
    dfs : list[float]
        Discount factors.
    compounding : str
        Compounding convention.

    Returns
    -------
    list[float]
        Annualised zero rates.
    """
    rates = []
    for T, d in zip(times, dfs):
        if T <= 0 or d <= 0:
            rates.append(0.0)
            continue
        if compounding == "continuous":
            rates.append(-math.log(d) / T)
        elif compounding == "semi_annual":
            rates.append(2.0 * (d ** (-1.0 / (2.0 * T)) - 1.0))
        elif compounding == "quarterly":
            rates.append(4.0 * (d ** (-1.0 / (4.0 * T)) - 1.0))
        else:  # annual
            rates.append(d ** (-1.0 / T) - 1.0)
    return rates


def forward_rates(
    times: list[float],
    dfs: list[float],
) -> tuple[list[str], list[float]]:
    """Compute forward rates between consecutive maturities.

    Parameters
    ----------
    times : list[float]
        Sorted maturities.
    dfs : list[float]
        Corresponding discount factors.

    Returns
    -------
    tuple[list[str], list[float]]
        (labels, rates) where labels are e.g. ["0y→1y", "1y→2y", ...].
    """
    labels = []
    rates = []
    for i in range(1, len(times)):
        T1 = times[i - 1]
        T2 = times[i]
        d1 = dfs[i - 1]
        d2 = dfs[i]
        dt = T2 - T1
        if dt <= 0 or d2 <= 0:
            continue
        # Annualised forward rate
        fwd = (d1 / d2) ** (1.0 / dt) - 1.0
        labels.append(f"{T1}y→{T2}y")
        rates.append(fwd)
    return labels, rates


def bootstrap_zero_curve(
    par_rates: list[float],
    maturities: list[float],
    coupon_frequency: int = 2,
    face_value: float = 100.0,
) -> dict:
    """Bootstrap a zero-rate curve from par bond yields.

    Assumes bonds are priced at par (clean_price = face_value), so the
    par rate equals the coupon rate.

    Parameters
    ----------
    par_rates : list[float]
        Par yields for each maturity (annualised).
    maturities : list[float]
        Corresponding maturities in years (must be sorted ascending).
    coupon_frequency : int
        Coupons per year (default 2 = semi-annual).
    face_value : float
        Par value.

    Returns
    -------
    dict
        Keys: maturities, zero_rates, discount_factors, par_rates.
    """
    if len(par_rates) != len(maturities):
        raise ValueError("par_rates and maturities must have the same length")

    # Sort by maturity
    sorted_pairs = sorted(zip(maturities, par_rates))
    mats = [p[0] for p in sorted_pairs]
    pars = [p[1] for p in sorted_pairs]

    zero_rates_result: list[float] = []
    dfs_result: list[float] = []

    for idx, (T, par) in enumerate(zip(mats, pars)):
        coupon_per_period = face_value * par / coupon_frequency
        period = 1.0 / coupon_frequency
        n_periods = round(T * coupon_frequency)

        if n_periods <= 1:
            # First instrument: simple solve
            # face_value = (coupon + face) / (1 + z)^T
            total_cf = coupon_per_period + face_value
            z = (total_cf / face_value) ** (1.0 / T) - 1.0
            zero_rates_result.append(z)
            dfs_result.append((1.0 + z) ** (-T))
        else:
            # Use previously bootstrapped rates for intermediate coupons
            sum_pv_coupons = 0.0
            for j in range(1, n_periods):
                t_j = j * period
                # Interpolate DF from known curve
                df_j = _interpolate_df(t_j, mats[:idx], dfs_result)
                sum_pv_coupons += coupon_per_period * df_j

            # Final cash flow: coupon + face
            final_cf = coupon_per_period + face_value
            # P = sum_pv_coupons + final_cf * D(T)
            # face_value = sum_pv_coupons + final_cf * D(T)
            df_T = (face_value - sum_pv_coupons) / final_cf
            if df_T <= 0:
                raise ValueError(
                    f"Bootstrap failed at maturity {T}: negative discount factor"
                )
            z = df_T ** (-1.0 / T) - 1.0
            zero_rates_result.append(z)
            dfs_result.append(df_T)

    return {
        "maturities": mats,
        "zero_rates": zero_rates_result,
        "discount_factors": dfs_result,
        "par_rates": pars,
    }


def _interpolate_df(t: float, known_times: list[float], known_dfs: list[float]) -> float:
    """Linearly interpolate a discount factor in log-DF space."""
    if len(known_times) == 0:
        return 1.0
    if t <= known_times[0]:
        # Extrapolate from origin (t=0, df=1) to first known point
        if known_times[0] > 0:
            log_df_0 = 0.0  # ln(1) = 0
            log_df_1 = math.log(known_dfs[0])
            frac = t / known_times[0]
            return math.exp(log_df_0 + frac * (log_df_1 - log_df_0))
        return known_dfs[0]
    if t >= known_times[-1]:
        # Flat extrapolation of zero rate
        z = known_dfs[-1] ** (-1.0 / known_times[-1]) - 1.0
        return (1.0 + z) ** (-t)

    # Linear interpolation in log-DF space
    arr_t = np.array(known_times)
    arr_ldf = np.log(np.array(known_dfs))
    return float(math.exp(np.interp(t, arr_t, arr_ldf)))


def generate_demo_yield_curve(
    style: str = "normal",
) -> dict:
    """Generate a demo par yield curve.

    Parameters
    ----------
    style : str
        "normal" (upward-sloping), "inverted", "flat", or "humped".

    Returns
    -------
    dict
        Keys: maturities, par_rates, description.
    """
    maturities = [0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 7.0, 10.0, 20.0, 30.0]

    if style == "normal":
        par_rates = [0.035, 0.038, 0.040, 0.042, 0.044, 0.046, 0.047, 0.048, 0.049, 0.050]
        desc = "Normal upward-sloping curve: short rates < long rates"
    elif style == "inverted":
        par_rates = [0.055, 0.053, 0.050, 0.047, 0.045, 0.042, 0.040, 0.038, 0.037, 0.036]
        desc = "Inverted curve: short rates > long rates (recession signal)"
    elif style == "flat":
        par_rates = [0.045] * len(maturities)
        desc = "Flat curve: all maturities at the same yield"
    elif style == "humped":
        par_rates = [0.035, 0.040, 0.045, 0.048, 0.050, 0.049, 0.047, 0.045, 0.043, 0.042]
        desc = "Humped curve: peak at intermediate maturities"
    else:
        raise ValueError(f"Unknown curve style: {style}")

    return {
        "maturities": maturities,
        "par_rates": par_rates,
        "description": desc,
    }
