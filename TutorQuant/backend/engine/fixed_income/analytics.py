"""Bond analytics: yield to maturity, duration, convexity, DV01.

Yield to Maturity (YTM)
-----------------------
The YTM is the single discount rate y that makes the present value of all
remaining cash flows equal to the dirty market price:

    P_dirty = sum_{i=1}^{N} CF_i / (1 + y/m)^{n_i}

where n_i is the number of compounding periods to cash flow i.

We solve this using Brent's method (guaranteed convergence for well-bracketed
monotone functions).

Macaulay Duration
-----------------
Weighted average time to receipt of cash flows, with weights proportional
to their present values:

    D_mac = (1/P) * sum_{i=1}^{N} t_i * CF_i / (1 + y/m)^{n_i}

Modified Duration
-----------------
Sensitivity of price to a parallel yield shift:

    D_mod = D_mac / (1 + y/m)

Dollar duration (DV01):
    DV01 = D_mod * P * 0.0001

Convexity
---------
Second-order sensitivity of price to yield:

    C = (1/P) * sum_{i=1}^{N} t_i * (t_i + 1/m) * CF_i / (1 + y/m)^{n_i + 2}

Price-yield relationship (second-order Taylor expansion):
    dP/P ≈ -D_mod * dy + 0.5 * C * dy^2

Conventions
-----------
- All yields are annualised and compounded at the bond's coupon frequency.
- Duration is in years.
- Convexity is in years^2.
"""

from __future__ import annotations

import math

from scipy.optimize import brentq

from engine.fixed_income.bonds import generate_cashflows, price_bond_from_yield


def yield_to_maturity(
    dirty_price: float,
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    settlement_offset: float = 0.0,
    ytm_low: float = -0.05,
    ytm_high: float = 1.0,
    tol: float = 1e-10,
    max_iter: int = 200,
) -> float:
    """Solve for the yield to maturity.

    Parameters
    ----------
    dirty_price : float
        Observed dirty (full) price of the bond.
    face_value : float
        Par / face value.
    coupon_rate : float
        Annual coupon rate.
    coupon_frequency : int
        Coupons per year.
    maturity_years : float
        Years to maturity.
    settlement_offset : float
        Fraction of current coupon period elapsed.
    ytm_low : float
        Lower bound of the yield search bracket.
    ytm_high : float
        Upper bound of the yield search bracket.

    Returns
    -------
    float
        Yield to maturity (annualised, compounded at coupon frequency).

    Raises
    ------
    ValueError
        If the solver cannot find a root.
    """
    if dirty_price <= 0:
        raise ValueError(f"Dirty price must be > 0, got {dirty_price}")

    def objective(y: float) -> float:
        result = price_bond_from_yield(
            face_value, coupon_rate, coupon_frequency, maturity_years, y, settlement_offset
        )
        return result["dirty_price"] - dirty_price

    # Validate bracket
    f_low = objective(ytm_low)
    f_high = objective(ytm_high)

    if f_low * f_high > 0:
        # Try wider bracket
        ytm_high = 2.0
        f_high = objective(ytm_high)
        if f_low * f_high > 0:
            raise ValueError(
                f"Cannot bracket YTM: price at y={ytm_low} is "
                f"{f_low + dirty_price:.4f}, at y={ytm_high} is "
                f"{f_high + dirty_price:.4f}. Target dirty_price={dirty_price:.4f}."
            )

    try:
        ytm = brentq(objective, ytm_low, ytm_high, xtol=tol, maxiter=max_iter)
    except ValueError as exc:
        raise ValueError(f"YTM solver failed: {exc}") from exc

    return float(ytm)


def macaulay_duration(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    ytm: float,
    settlement_offset: float = 0.0,
) -> float:
    """Compute Macaulay duration.

    Parameters
    ----------
    ytm : float
        Yield to maturity (annualised).

    Returns
    -------
    float
        Macaulay duration in years.
    """
    times, cashflows = generate_cashflows(
        face_value, coupon_rate, coupon_frequency, maturity_years, settlement_offset
    )

    if len(times) == 0:
        return 0.0

    m = coupon_frequency
    price = 0.0
    weighted_time = 0.0

    for t, cf in zip(times, cashflows):
        df = (1.0 + ytm / m) ** (-(t * m))
        pv = cf * df
        price += pv
        weighted_time += t * pv

    if price <= 0:
        return 0.0

    return weighted_time / price


def modified_duration(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    ytm: float,
    settlement_offset: float = 0.0,
) -> float:
    """Compute modified duration.

    D_mod = D_mac / (1 + y/m)

    Returns
    -------
    float
        Modified duration in years.
    """
    d_mac = macaulay_duration(
        face_value, coupon_rate, coupon_frequency, maturity_years, ytm, settlement_offset
    )
    m = coupon_frequency
    return d_mac / (1.0 + ytm / m)


def convexity(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    ytm: float,
    settlement_offset: float = 0.0,
) -> float:
    """Compute convexity.

    C = (1/P) * sum_i t_i * (t_i + 1/m) * CF_i / (1 + y/m)^{n_i + 2}

    Returns
    -------
    float
        Convexity in years^2.
    """
    times, cashflows = generate_cashflows(
        face_value, coupon_rate, coupon_frequency, maturity_years, settlement_offset
    )

    if len(times) == 0:
        return 0.0

    m = coupon_frequency
    price = 0.0
    conv_sum = 0.0

    for t, cf in zip(times, cashflows):
        n = t * m  # number of periods
        df = (1.0 + ytm / m) ** (-n)
        price += cf * df
        # Convexity contribution
        conv_sum += t * (t + 1.0 / m) * cf * (1.0 + ytm / m) ** (-(n + 2))

    if price <= 0:
        return 0.0

    return conv_sum / price


def dv01(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    ytm: float,
    settlement_offset: float = 0.0,
) -> float:
    """Compute DV01 (dollar value of a basis point).

    DV01 = D_mod * P * 0.0001

    Returns
    -------
    float
        Price change for a 1bp yield increase.
    """
    d_mod = modified_duration(
        face_value, coupon_rate, coupon_frequency, maturity_years, ytm, settlement_offset
    )
    result = price_bond_from_yield(
        face_value, coupon_rate, coupon_frequency, maturity_years, ytm, settlement_offset
    )
    return d_mod * result["dirty_price"] * 0.0001


def price_yield_curve(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    settlement_offset: float = 0.0,
    yield_min: float = 0.0,
    yield_max: float = 0.15,
    n_points: int = 50,
) -> dict:
    """Generate price vs yield data for a bond.

    Returns
    -------
    dict
        Keys: yields (list[float]), dirty_prices (list[float]),
              clean_prices (list[float]), face_value, coupon_rate.
    """
    import numpy as np

    yields = np.linspace(yield_min, yield_max, n_points).tolist()
    dirty_prices = []
    clean_prices = []

    for y in yields:
        result = price_bond_from_yield(
            face_value, coupon_rate, coupon_frequency, maturity_years, y, settlement_offset
        )
        dirty_prices.append(result["dirty_price"])
        clean_prices.append(result["clean_price"])

    return {
        "yields": yields,
        "dirty_prices": dirty_prices,
        "clean_prices": clean_prices,
        "face_value": face_value,
        "coupon_rate": coupon_rate,
    }


def full_bond_analytics(
    face_value: float,
    coupon_rate: float,
    coupon_frequency: int,
    maturity_years: float,
    ytm: float,
    settlement_offset: float = 0.0,
) -> dict:
    """Compute all bond analytics in one call.

    Returns
    -------
    dict
        Complete analytics: pricing, duration, convexity, DV01, cashflows.
    """
    pricing = price_bond_from_yield(
        face_value, coupon_rate, coupon_frequency, maturity_years, ytm, settlement_offset
    )

    d_mac = macaulay_duration(
        face_value, coupon_rate, coupon_frequency, maturity_years, ytm, settlement_offset
    )
    d_mod = d_mac / (1.0 + ytm / coupon_frequency)
    conv = convexity(
        face_value, coupon_rate, coupon_frequency, maturity_years, ytm, settlement_offset
    )
    dv = d_mod * pricing["dirty_price"] * 0.0001

    return {
        **pricing,
        "ytm": ytm,
        "macaulay_duration": d_mac,
        "modified_duration": d_mod,
        "convexity": conv,
        "dv01": dv,
    }
