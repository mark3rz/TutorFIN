"""Bond pricing, accrued interest, and cash-flow schedule generation.

Covers fixed-coupon bonds (including zero-coupon as the coupon_rate = 0 case).

Pricing formula
---------------
The dirty price of a fixed-coupon bond paying c/m per period for N remaining
periods, discounted at yield y (compounding m times per year):

    P_dirty = sum_{i=1}^{N} CF_i / (1 + y/m)^{t_i * m}

where CF_i is the cash flow at time t_i (coupon or coupon + face at maturity).

Clean vs dirty price:
    P_clean = P_dirty - Accrued_Interest

Accrued interest:
    AI = (coupon_per_period) * (days_since_last_coupon / days_in_coupon_period)

Day-count conventions
---------------------
- ACT/365: actual days / 365
- ACT/360: actual days / 360
- 30/360:  (360*(Y2-Y1) + 30*(M2-M1) + (D2-D1)) / 360

For simplicity in demo mode, we use a fractional-year model where the
settlement is parameterised as a fraction of a coupon period already elapsed.
This avoids calendar complexities while being transparent about the
approximation.

Compounding
-----------
All yields are compounded at the coupon frequency (m times per year).
Continuous compounding is not used for bond pricing (convention).
"""

from __future__ import annotations

import math
from typing import Optional


def generate_cashflows(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    settlement_offset: float = 0.0,
) -> tuple[list[float], list[float]]:
    """Generate the remaining cash-flow schedule.

    Parameters
    ----------
    face_value : float
        Par / face value of the bond.
    coupon_rate : float
        Annual coupon rate (e.g. 0.05 for 5%).
    coupon_frequency : int
        Number of coupon payments per year (1 = annual, 2 = semi-annual, 4 = quarterly).
    maturity_years : float
        Years to maturity from issue or reference date.
    settlement_offset : float
        Fraction of the current coupon period that has already elapsed
        (0 = just after a coupon, 0.5 = midway through a period).

    Returns
    -------
    tuple[list[float], list[float]]
        (times, cashflows) where times are in years from settlement,
        and cashflows are the corresponding payments.
    """
    if face_value <= 0:
        raise ValueError(f"Face value must be > 0, got {face_value}")
    if coupon_rate < 0:
        raise ValueError(f"Coupon rate must be >= 0, got {coupon_rate}")
    if coupon_frequency < 1:
        raise ValueError(f"Coupon frequency must be >= 1, got {coupon_frequency}")
    if maturity_years <= 0:
        raise ValueError(f"Maturity must be > 0, got {maturity_years}")
    if not 0 <= settlement_offset < 1:
        raise ValueError(f"Settlement offset must be in [0, 1), got {settlement_offset}")

    period_length = 1.0 / coupon_frequency
    coupon_per_period = face_value * coupon_rate / coupon_frequency
    n_total_periods = round(maturity_years * coupon_frequency)

    times: list[float] = []
    cashflows: list[float] = []

    for i in range(1, n_total_periods + 1):
        t = i * period_length - settlement_offset * period_length
        if t <= 0:
            continue
        cf = coupon_per_period
        if i == n_total_periods:
            cf += face_value  # Principal repayment at maturity
        times.append(round(t, 10))
        cashflows.append(cf)

    return times, cashflows


def price_bond_from_yield(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    ytm: float,
    settlement_offset: float = 0.0,
) -> dict:
    """Price a fixed-coupon bond given a flat yield.

    Parameters
    ----------
    face_value : float
        Par / face value.
    coupon_rate : float
        Annual coupon rate.
    coupon_frequency : int
        Coupons per year.
    maturity_years : float
        Years to maturity.
    ytm : float
        Yield to maturity (annualised, compounded at coupon frequency).
    settlement_offset : float
        Fraction of current coupon period elapsed.

    Returns
    -------
    dict
        Keys: dirty_price, clean_price, accrued_interest, cashflow_times,
              cashflow_amounts, n_remaining_coupons.
    """
    times, cashflows = generate_cashflows(
        face_value, coupon_rate, coupon_frequency, maturity_years, settlement_offset
    )

    if len(times) == 0:
        return {
            "dirty_price": face_value,
            "clean_price": face_value,
            "accrued_interest": 0.0,
            "cashflow_times": [],
            "cashflow_amounts": [],
            "n_remaining_coupons": 0,
        }

    # Discount factor for each cash flow
    m = coupon_frequency
    dirty_price = 0.0
    for t, cf in zip(times, cashflows):
        # Number of compounding periods from settlement to payment
        df = (1.0 + ytm / m) ** (-(t * m))
        dirty_price += cf * df

    # Accrued interest
    coupon_per_period = face_value * coupon_rate / coupon_frequency
    accrued = coupon_per_period * settlement_offset

    clean_price = dirty_price - accrued

    return {
        "dirty_price": dirty_price,
        "clean_price": clean_price,
        "accrued_interest": accrued,
        "cashflow_times": times,
        "cashflow_amounts": cashflows,
        "n_remaining_coupons": len(times),
    }


def price_bond_from_discount_factors(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    discount_curve_times: list[float],
    discount_curve_dfs: list[float],
    settlement_offset: float = 0.0,
) -> dict:
    """Price a bond using a discount-factor curve (interpolated linearly in log-DF space).

    Parameters
    ----------
    discount_curve_times : list[float]
        Time points for the discount curve (years).
    discount_curve_dfs : list[float]
        Discount factors at each time point (e.g. [1.0, 0.98, 0.95, ...]).

    Returns
    -------
    dict
        Same structure as price_bond_from_yield.
    """
    import numpy as np

    times, cashflows = generate_cashflows(
        face_value, coupon_rate, coupon_frequency, maturity_years, settlement_offset
    )

    if len(times) == 0:
        return {
            "dirty_price": face_value,
            "clean_price": face_value,
            "accrued_interest": 0.0,
            "cashflow_times": [],
            "cashflow_amounts": [],
            "n_remaining_coupons": 0,
        }

    # Interpolate discount factors (log-linear)
    ct = np.array(discount_curve_times)
    cdf = np.array(discount_curve_dfs)
    log_dfs = np.log(np.maximum(cdf, 1e-15))

    dirty_price = 0.0
    for t, cf in zip(times, cashflows):
        log_df = float(np.interp(t, ct, log_dfs))
        df = math.exp(log_df)
        dirty_price += cf * df

    coupon_per_period = face_value * coupon_rate / coupon_frequency
    accrued = coupon_per_period * settlement_offset
    clean_price = dirty_price - accrued

    return {
        "dirty_price": dirty_price,
        "clean_price": clean_price,
        "accrued_interest": accrued,
        "cashflow_times": times,
        "cashflow_amounts": cashflows,
        "n_remaining_coupons": len(times),
    }


def accrued_interest(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    settlement_offset: float,
) -> float:
    """Compute accrued interest.

    Parameters
    ----------
    face_value : float
        Par value.
    coupon_rate : float
        Annual coupon rate.
    coupon_frequency : int
        Coupons per year.
    settlement_offset : float
        Fraction of coupon period elapsed since last coupon.

    Returns
    -------
    float
        Accrued interest.
    """
    return face_value * coupon_rate / coupon_frequency * settlement_offset
