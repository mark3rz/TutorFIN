"""Vanilla fixed-for-floating interest rate swap engine.

A plain-vanilla IRS exchanges:
  - Fixed leg: periodic payments of  N * c * tau_i
  - Floating leg: periodic payments of  N * L_i * tau_i

where N is the notional, c is the fixed coupon, L_i is the floating rate
for period i, and tau_i is the year fraction (day-count).

Valuation:
  PV_fixed  = N * c * sum_i( tau_i * DF(t_i) )
  PV_float  = N * sum_i( L_i * tau_i * DF(t_i) )
  NPV_payer = PV_float - PV_fixed   (payer swap = pay fixed, receive float)

For a par swap (NPV = 0), the par swap rate is:
  c_par = sum_i( f_i * tau_i * DF(t_i) ) / sum_i( tau_i * DF(t_i) )
        = (DF(0) - DF(T_n)) / sum_i( tau_i * DF(t_i) )

where f_i is the forward rate for period [t_{i-1}, t_i].

Parameters:
    notional       (float): Notional principal
    fixed_rate     (float): Fixed leg coupon rate (annualised)
    tenor_years    (float): Swap maturity in years
    pay_freq       (int):   Fixed leg payments per year (e.g. 2 = semi-annual)
    rec_freq       (int):   Floating leg payments per year (e.g. 4 = quarterly)
    float_spread   (float): Spread added to forward rates on the floating leg
    discount_rates (list):  Flat or term-structure of discount rates
"""

from __future__ import annotations

import math


def _build_schedule(tenor_years: float, freq: int) -> list[float]:
    """Build a payment schedule from 0 to tenor_years with given frequency.

    Returns a list of payment times (in years), excluding time 0.
    """
    if freq <= 0:
        raise ValueError("Payment frequency must be positive")
    if tenor_years <= 0:
        raise ValueError("Tenor must be positive")

    period = 1.0 / freq
    n_periods = max(1, round(tenor_years * freq))
    return [round((i + 1) * period, 10) for i in range(n_periods)]


def _discount_factor(rate: float, t: float) -> float:
    """Continuous-compounding discount factor DF(t) = exp(-r * t)."""
    return math.exp(-rate * t)


def _interpolate_rate(
    rates: list[float],
    tenors: list[float],
    t: float,
) -> float:
    """Linear interpolation on a rate curve. Flat extrapolation at edges."""
    if len(rates) == 1:
        return rates[0]
    if t <= tenors[0]:
        return rates[0]
    if t >= tenors[-1]:
        return rates[-1]
    for i in range(len(tenors) - 1):
        if tenors[i] <= t <= tenors[i + 1]:
            frac = (t - tenors[i]) / (tenors[i + 1] - tenors[i])
            return rates[i] + frac * (rates[i + 1] - rates[i])
    return rates[-1]


def _get_discount_factor(
    t: float,
    discount_rate: float | None = None,
    discount_curve: list[dict] | None = None,
) -> float:
    """Get DF(t) from either a flat rate or a term-structure curve.

    discount_curve: list of {"tenor": float, "rate": float} dicts.
    """
    if discount_curve is not None and len(discount_curve) > 0:
        tenors = [p["tenor"] for p in discount_curve]
        rates = [p["rate"] for p in discount_curve]
        r = _interpolate_rate(rates, tenors, t)
        return _discount_factor(r, t)
    if discount_rate is not None:
        return _discount_factor(discount_rate, t)
    raise ValueError("Must provide either discount_rate or discount_curve")


def _forward_rate(
    t1: float,
    t2: float,
    discount_rate: float | None = None,
    discount_curve: list[dict] | None = None,
) -> float:
    """Implied forward rate for [t1, t2] from the discount curve.

    f(t1, t2) = (1 / (t2 - t1)) * ln(DF(t1) / DF(t2))
    """
    tau = t2 - t1
    if tau <= 0:
        raise ValueError("t2 must be greater than t1")
    df1 = _get_discount_factor(t1, discount_rate, discount_curve)
    df2 = _get_discount_factor(t2, discount_rate, discount_curve)
    return math.log(df1 / df2) / tau


def price_vanilla_irs(
    notional: float,
    fixed_rate: float,
    tenor_years: float,
    discount_rate: float | None = None,
    discount_curve: list[dict] | None = None,
    pay_freq: int = 2,
    rec_freq: int = 4,
    float_spread: float = 0.0,
    is_payer: bool = True,
) -> dict:
    """Price a plain-vanilla fixed-for-floating IRS.

    Parameters
    ----------
    notional : float
        Notional principal (> 0).
    fixed_rate : float
        Fixed leg annual coupon rate (e.g. 0.03 for 3 %).
    tenor_years : float
        Swap maturity in years (> 0).
    discount_rate : float | None
        Flat discount rate (continuous compounding). Used when
        discount_curve is not provided.
    discount_curve : list[dict] | None
        Term-structure curve: [{"tenor": t, "rate": r}, ...].
        Rates are continuously-compounded zero rates.
    pay_freq : int
        Fixed leg payment frequency (payments per year). Default 2 (semi-annual).
    rec_freq : int
        Floating leg payment frequency (payments per year). Default 4 (quarterly).
    float_spread : float
        Spread over the floating index (e.g. 0.001 for 10 bps).
    is_payer : bool
        True = payer swap (pay fixed, receive float).
        False = receiver swap (receive fixed, pay float).

    Returns
    -------
    dict with keys:
        npv             : float — Net present value (from perspective of is_payer)
        fixed_leg_pv    : float — Present value of the fixed leg
        float_leg_pv    : float — Present value of the floating leg
        par_rate        : float — Par swap rate (rate at which NPV = 0)
        fixed_cashflows : list[dict] — {time, amount, df, pv}
        float_cashflows : list[dict] — {time, forward_rate, amount, df, pv}
        annuity         : float — Sum of tau_i * DF(t_i) (the annuity factor)
        dv01            : float — Dollar value of 1 bp parallel shift
        notional        : float
        tenor_years     : float
        fixed_rate      : float
    """
    if notional <= 0:
        raise ValueError("Notional must be positive")
    if tenor_years <= 0:
        raise ValueError("Tenor must be positive")

    # Build payment schedules
    fixed_schedule = _build_schedule(tenor_years, pay_freq)
    float_schedule = _build_schedule(tenor_years, rec_freq)

    # ── Fixed leg ────────────────────────────────────────────
    fixed_cashflows = []
    fixed_leg_pv = 0.0
    annuity = 0.0
    prev_t = 0.0
    for t in fixed_schedule:
        tau = t - prev_t
        amount = notional * fixed_rate * tau
        df = _get_discount_factor(t, discount_rate, discount_curve)
        pv = amount * df
        fixed_leg_pv += pv
        annuity += tau * df
        fixed_cashflows.append({
            "time": round(t, 6),
            "tau": round(tau, 6),
            "amount": round(amount, 4),
            "df": round(df, 8),
            "pv": round(pv, 4),
        })
        prev_t = t

    # ── Floating leg ─────────────────────────────────────────
    float_cashflows = []
    float_leg_pv = 0.0
    prev_t = 0.0
    for t in float_schedule:
        tau = t - prev_t
        fwd = _forward_rate(prev_t, t, discount_rate, discount_curve)
        rate_with_spread = fwd + float_spread
        amount = notional * rate_with_spread * tau
        df = _get_discount_factor(t, discount_rate, discount_curve)
        pv = amount * df
        float_leg_pv += pv
        float_cashflows.append({
            "time": round(t, 6),
            "tau": round(tau, 6),
            "forward_rate": round(fwd, 8),
            "spread": round(float_spread, 8),
            "all_in_rate": round(rate_with_spread, 8),
            "amount": round(amount, 4),
            "df": round(df, 8),
            "pv": round(pv, 4),
        })
        prev_t = t

    # ── Par swap rate ────────────────────────────────────────
    # Compute from the actual discrete floating leg PV (excluding spread)
    # so that par_rate * N * annuity == float_leg_pv_no_spread exactly.
    float_pv_no_spread = 0.0
    prev_t2 = 0.0
    for t in float_schedule:
        tau2 = t - prev_t2
        fwd = _forward_rate(prev_t2, t, discount_rate, discount_curve)
        df = _get_discount_factor(t, discount_rate, discount_curve)
        float_pv_no_spread += notional * fwd * tau2 * df
        prev_t2 = t

    par_rate = float_pv_no_spread / (notional * annuity) if annuity > 0 else 0.0

    # ── NPV ──────────────────────────────────────────────────
    if is_payer:
        npv = float_leg_pv - fixed_leg_pv
    else:
        npv = fixed_leg_pv - float_leg_pv

    # ── DV01 (dollar value of 1 bp) ─────────────────────────
    # DV01 = notional * annuity * 0.0001
    dv01 = notional * annuity * 0.0001

    return {
        "npv": round(npv, 4),
        "fixed_leg_pv": round(fixed_leg_pv, 4),
        "float_leg_pv": round(float_leg_pv, 4),
        "par_rate": round(par_rate, 8),
        "fixed_cashflows": fixed_cashflows,
        "float_cashflows": float_cashflows,
        "annuity": round(annuity, 8),
        "dv01": round(dv01, 4),
        "notional": notional,
        "tenor_years": tenor_years,
        "fixed_rate": fixed_rate,
        "is_payer": is_payer,
    }


def compute_par_rate(
    tenor_years: float,
    discount_rate: float | None = None,
    discount_curve: list[dict] | None = None,
    pay_freq: int = 2,
    float_freq: int | None = None,
) -> float:
    """Compute the par swap rate for a given tenor and discount curve.

    Uses the discrete float leg PV divided by the annuity, which is
    consistent with the pricing engine and avoids the continuous-vs-discrete
    compounding mismatch of the analytical shortcut.

    Parameters
    ----------
    pay_freq : int
        Fixed leg frequency (used for the annuity).
    float_freq : int | None
        Floating leg frequency for forward rate computation.
        Defaults to pay_freq if not provided.
    """
    if float_freq is None:
        float_freq = pay_freq

    fixed_schedule = _build_schedule(tenor_years, pay_freq)
    float_schedule = _build_schedule(tenor_years, float_freq)

    # Annuity from fixed schedule
    annuity = 0.0
    prev_t = 0.0
    for t in fixed_schedule:
        tau = t - prev_t
        df = _get_discount_factor(t, discount_rate, discount_curve)
        annuity += tau * df
        prev_t = t

    if annuity <= 0:
        return 0.0

    # Float leg PV from discrete forwards
    float_pv = 0.0
    prev_t = 0.0
    for t in float_schedule:
        tau = t - prev_t
        fwd = _forward_rate(prev_t, t, discount_rate, discount_curve)
        df = _get_discount_factor(t, discount_rate, discount_curve)
        float_pv += fwd * tau * df
        prev_t = t

    return float_pv / annuity


def compute_swap_sensitivities(
    notional: float,
    fixed_rate: float,
    tenor_years: float,
    discount_rate: float,
    pay_freq: int = 2,
    rec_freq: int = 4,
    float_spread: float = 0.0,
    bump_bps: float = 1.0,
) -> dict:
    """Compute rate sensitivities for a vanilla IRS via finite differences.

    Bumps the flat discount rate by +/- bump_bps and recomputes NPV.

    Returns
    -------
    dict with keys:
        base_npv    : float — NPV at the base rate
        dv01        : float — Dollar value of 1 bp (central difference)
        convexity   : float — Second-order sensitivity (per bp^2)
        par_rate    : float — Par swap rate
        rate_bumps  : list[float] — Bump sizes used
        npvs        : list[float] — NPVs at each bump level
    """
    bump = bump_bps / 10_000.0

    # Evaluate NPV at multiple bump levels for a sensitivity profile
    bump_range = [-50, -25, -10, -5, -1, 0, 1, 5, 10, 25, 50]
    rate_bumps = []
    npvs = []

    for b in bump_range:
        shifted_rate = discount_rate + b * bump
        result = price_vanilla_irs(
            notional=notional,
            fixed_rate=fixed_rate,
            tenor_years=tenor_years,
            discount_rate=shifted_rate,
            pay_freq=pay_freq,
            rec_freq=rec_freq,
            float_spread=float_spread,
            is_payer=True,
        )
        rate_bumps.append(b)
        npvs.append(result["npv"])

    # Central difference DV01
    npv_up = price_vanilla_irs(
        notional=notional,
        fixed_rate=fixed_rate,
        tenor_years=tenor_years,
        discount_rate=discount_rate + bump,
        pay_freq=pay_freq,
        rec_freq=rec_freq,
        float_spread=float_spread,
        is_payer=True,
    )["npv"]

    npv_down = price_vanilla_irs(
        notional=notional,
        fixed_rate=fixed_rate,
        tenor_years=tenor_years,
        discount_rate=discount_rate - bump,
        pay_freq=pay_freq,
        rec_freq=rec_freq,
        float_spread=float_spread,
        is_payer=True,
    )["npv"]

    base = price_vanilla_irs(
        notional=notional,
        fixed_rate=fixed_rate,
        tenor_years=tenor_years,
        discount_rate=discount_rate,
        pay_freq=pay_freq,
        rec_freq=rec_freq,
        float_spread=float_spread,
        is_payer=True,
    )

    dv01_cd = (npv_up - npv_down) / 2.0
    convexity = (npv_up - 2.0 * base["npv"] + npv_down) / (bump ** 2)

    return {
        "base_npv": base["npv"],
        "dv01": round(dv01_cd, 4),
        "convexity": round(convexity, 4),
        "par_rate": base["par_rate"],
        "rate_bumps": rate_bumps,
        "npvs": [round(n, 4) for n in npvs],
    }


def par_rate_curve(
    tenors: list[float],
    discount_rate: float | None = None,
    discount_curve: list[dict] | None = None,
    pay_freq: int = 2,
) -> dict:
    """Compute par swap rates across a range of tenors.

    Returns
    -------
    dict with keys:
        tenors    : list[float]
        par_rates : list[float]
    """
    par_rates = []
    for t in tenors:
        pr = compute_par_rate(t, discount_rate, discount_curve, pay_freq)
        par_rates.append(round(pr, 8))
    return {
        "tenors": tenors,
        "par_rates": par_rates,
    }
