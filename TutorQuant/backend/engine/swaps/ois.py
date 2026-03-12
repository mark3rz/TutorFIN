"""OIS (Overnight Index Swap) discounting engine.

An OIS exchanges a fixed rate against the compounded overnight rate
(e.g. SOFR, ESTR) over each accrual period.

OIS discounting concepts:
  - Pre-crisis: LIBOR was used for both forward projection and discounting.
  - Post-crisis: OIS rates are used for discounting (CSA-collateralised trades),
    while LIBOR/SOFR forwards are used for projection. This is the dual-curve
    framework.

Key formulas:
  Compounded overnight rate for period [t_{i-1}, t_i]:
    R_i = (1/tau_i) * (prod_{k} (1 + r_k * delta_k) - 1)

  where r_k is the overnight rate on day k and delta_k is the day fraction.

  OIS fixed leg PV:  N * c_OIS * sum_i( tau_i * DF_OIS(t_i) )
  OIS float leg PV:  N * sum_i( R_i * tau_i * DF_OIS(t_i) )

For a par OIS, the fixed rate equals:
  c_OIS = (DF_OIS(0) - DF_OIS(T_n)) / sum_i( tau_i * DF_OIS(t_i) )

In practice this is identical in structure to a vanilla IRS par rate
calculation but using the OIS curve for both discounting and projection.

Parameters:
    notional   (float): Notional principal
    ois_rate   (float): Market OIS fixed rate
    tenor_years(float): Swap maturity in years
    ois_curve  (list):  OIS zero-rate curve for discounting
"""

from __future__ import annotations

import math


def _build_schedule(tenor_years: float, freq: int) -> list[float]:
    """Build a payment schedule."""
    if freq <= 0:
        raise ValueError("Frequency must be positive")
    if tenor_years <= 0:
        raise ValueError("Tenor must be positive")
    period = 1.0 / freq
    n_periods = max(1, round(tenor_years * freq))
    return [round((i + 1) * period, 10) for i in range(n_periods)]


def _discount_factor(rate: float, t: float) -> float:
    """Continuous-compounding discount factor."""
    return math.exp(-rate * t)


def _interpolate_rate(rates: list[float], tenors: list[float], t: float) -> float:
    """Linear interpolation with flat extrapolation."""
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


def _get_df(
    t: float,
    flat_rate: float | None = None,
    curve: list[dict] | None = None,
) -> float:
    """Get DF(t) from flat rate or curve."""
    if curve is not None and len(curve) > 0:
        tenors = [p["tenor"] for p in curve]
        rates = [p["rate"] for p in curve]
        r = _interpolate_rate(rates, tenors, t)
        return _discount_factor(r, t)
    if flat_rate is not None:
        return _discount_factor(flat_rate, t)
    raise ValueError("Must provide either flat_rate or curve")


def ois_par_rate(
    tenor_years: float,
    ois_rate: float | None = None,
    ois_curve: list[dict] | None = None,
    freq: int = 1,
) -> float:
    """Compute the par OIS rate for a given tenor.

    par_rate = (1 - DF_OIS(T)) / annuity_OIS
    """
    schedule = _build_schedule(tenor_years, freq)
    annuity = 0.0
    prev_t = 0.0
    for t in schedule:
        tau = t - prev_t
        df = _get_df(t, ois_rate, ois_curve)
        annuity += tau * df
        prev_t = t

    df_n = _get_df(tenor_years, ois_rate, ois_curve)
    if annuity <= 0:
        return 0.0
    return (1.0 - df_n) / annuity


def ois_vs_libor_basis(
    tenor_years: float,
    ois_rate: float,
    libor_rate: float,
    freq: int = 4,
) -> dict:
    """Compute the OIS-LIBOR basis (spread) for educational demonstration.

    The basis is defined as:
      basis = libor_par_rate - ois_par_rate

    This spread reflects counterparty credit risk embedded in LIBOR
    that is absent from OIS rates.

    Returns
    -------
    dict with keys:
        ois_par_rate   : float
        libor_par_rate : float
        basis_bps      : float — spread in basis points
        tenor_years    : float
    """
    ois_pr = ois_par_rate(tenor_years, ois_rate=ois_rate, freq=freq)
    libor_pr = ois_par_rate(tenor_years, ois_rate=libor_rate, freq=freq)
    basis = libor_pr - ois_pr

    return {
        "ois_par_rate": round(ois_pr, 8),
        "libor_par_rate": round(libor_pr, 8),
        "basis_bps": round(basis * 10_000, 4),
        "tenor_years": tenor_years,
    }


def dual_curve_price(
    notional: float,
    fixed_rate: float,
    tenor_years: float,
    projection_rate: float,
    discount_rate: float,
    pay_freq: int = 2,
    rec_freq: int = 4,
    float_spread: float = 0.0,
) -> dict:
    """Price a swap under the dual-curve framework.

    Uses the projection curve for forward rate estimation and the
    OIS curve for discounting — the post-crisis standard.

    Parameters
    ----------
    projection_rate : float
        Flat rate for the projection (forward) curve (e.g. LIBOR/SOFR).
    discount_rate : float
        Flat OIS rate for discounting.

    Returns
    -------
    dict with keys:
        npv, fixed_leg_pv, float_leg_pv, par_rate,
        single_curve_npv (for comparison), basis_adjustment
    """
    from engine.swaps.vanilla_irs import price_vanilla_irs

    # Dual-curve: project with projection_rate, discount with discount_rate
    fixed_schedule = _build_schedule(tenor_years, pay_freq)
    float_schedule = _build_schedule(tenor_years, rec_freq)

    # Fixed leg (discounted at OIS)
    fixed_pv = 0.0
    annuity = 0.0
    prev_t = 0.0
    for t in fixed_schedule:
        tau = t - prev_t
        amount = notional * fixed_rate * tau
        df = _get_df(t, flat_rate=discount_rate)
        fixed_pv += amount * df
        annuity += tau * df
        prev_t = t

    # Floating leg (projected at projection_rate, discounted at OIS)
    float_pv = 0.0
    prev_t = 0.0
    for t in float_schedule:
        tau = t - prev_t
        # Forward rate from projection curve
        fwd = projection_rate  # flat projection
        rate_all_in = fwd + float_spread
        amount = notional * rate_all_in * tau
        df = _get_df(t, flat_rate=discount_rate)
        float_pv += amount * df
        prev_t = t

    npv_dual = float_pv - fixed_pv

    # Par rate under dual-curve
    df_n = _get_df(tenor_years, flat_rate=discount_rate)
    par_rate_dual = (1.0 - df_n) / annuity if annuity > 0 else 0.0

    # Single-curve comparison
    single = price_vanilla_irs(
        notional=notional,
        fixed_rate=fixed_rate,
        tenor_years=tenor_years,
        discount_rate=projection_rate,
        pay_freq=pay_freq,
        rec_freq=rec_freq,
        float_spread=float_spread,
        is_payer=True,
    )

    return {
        "npv": round(npv_dual, 4),
        "fixed_leg_pv": round(fixed_pv, 4),
        "float_leg_pv": round(float_pv, 4),
        "par_rate": round(par_rate_dual, 8),
        "single_curve_npv": single["npv"],
        "single_curve_par_rate": single["par_rate"],
        "basis_adjustment": round(npv_dual - single["npv"], 4),
        "projection_rate": projection_rate,
        "discount_rate": discount_rate,
    }


def get_ois_concepts() -> list[dict]:
    """Return structured educational content about OIS discounting."""
    return [
        {
            "concept": "OIS Rate",
            "description": (
                "The fixed rate exchanged for the compounded overnight rate "
                "(SOFR, ESTR). It is the market's expectation of the average "
                "overnight rate over the swap's tenor."
            ),
        },
        {
            "concept": "Dual-Curve Framework",
            "description": (
                "Post-crisis standard where the OIS curve is used for discounting "
                "(reflecting collateral rates under CSA) and a separate projection "
                "curve (SOFR term rates) is used for forward rate estimation."
            ),
        },
        {
            "concept": "OIS-LIBOR Basis",
            "description": (
                "The spread between LIBOR and OIS rates, reflecting bank credit "
                "risk. Historically ~10 bps pre-crisis, spiked to 300+ bps during "
                "the 2008 financial crisis. Now transitioning to SOFR-based markets."
            ),
        },
        {
            "concept": "CSA Discounting",
            "description": (
                "Under a Credit Support Annex, collateralised trades earn the "
                "overnight rate on posted collateral. Therefore the correct discount "
                "rate is the OIS rate, not LIBOR."
            ),
        },
        {
            "concept": "SOFR Transition",
            "description": (
                "LIBOR cessation (June 2023) shifted markets to SOFR (Secured "
                "Overnight Financing Rate). SOFR is a nearly risk-free rate based "
                "on overnight repo transactions, making OIS discounting the natural "
                "framework."
            ),
        },
    ]
