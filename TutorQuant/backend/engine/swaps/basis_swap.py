"""Basis swap conceptual and structural engine.

A basis swap exchanges two floating-rate legs, typically:
  - Leg A: floating rate index 1 (e.g. 3M SOFR)
  - Leg B: floating rate index 2 (e.g. 1M SOFR) + spread

The basis spread compensates for the difference in credit risk,
liquidity, and supply-demand dynamics between the two indices.

Common types:
  - Tenor basis swap: 3M vs 6M LIBOR (now SOFR term rates)
  - Cross-currency basis: USD SOFR vs EUR ESTR + spread
  - OIS-LIBOR basis: OIS vs LIBOR (historical, pre-SOFR transition)

Valuation:
  NPV = PV(Leg A) - PV(Leg B)
      = N * sum_i(f^A_i * tau_i * DF(t_i)) - N * sum_j((f^B_j + s) * tau_j * DF(t_j))

The par basis spread is the spread s such that NPV = 0.
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


def price_basis_swap(
    notional: float,
    tenor_years: float,
    rate_a: float,
    rate_b: float,
    spread_b: float = 0.0,
    freq_a: int = 4,
    freq_b: int = 12,
    discount_rate: float = 0.04,
) -> dict:
    """Price a simplified tenor basis swap (flat rate approximation).

    Leg A pays at rate_a with frequency freq_a.
    Leg B pays at rate_b + spread_b with frequency freq_b.

    Parameters
    ----------
    notional : float
        Notional principal.
    tenor_years : float
        Swap maturity in years.
    rate_a : float
        Flat projection rate for Leg A (e.g. 3M SOFR).
    rate_b : float
        Flat projection rate for Leg B (e.g. 1M SOFR).
    spread_b : float
        Spread added to Leg B.
    freq_a : int
        Leg A payment frequency (e.g. 4 = quarterly).
    freq_b : int
        Leg B payment frequency (e.g. 12 = monthly).
    discount_rate : float
        Flat discount rate.

    Returns
    -------
    dict with keys:
        npv, leg_a_pv, leg_b_pv, par_basis_spread
    """
    if notional <= 0:
        raise ValueError("Notional must be positive")

    sched_a = _build_schedule(tenor_years, freq_a)
    sched_b = _build_schedule(tenor_years, freq_b)

    # Leg A PV
    leg_a_pv = 0.0
    prev_t = 0.0
    for t in sched_a:
        tau = t - prev_t
        amount = notional * rate_a * tau
        df = _discount_factor(discount_rate, t)
        leg_a_pv += amount * df
        prev_t = t

    # Leg B PV
    leg_b_pv = 0.0
    leg_b_pv_no_spread = 0.0
    annuity_b = 0.0
    prev_t = 0.0
    for t in sched_b:
        tau = t - prev_t
        df = _discount_factor(discount_rate, t)
        leg_b_pv += notional * (rate_b + spread_b) * tau * df
        leg_b_pv_no_spread += notional * rate_b * tau * df
        annuity_b += tau * df
        prev_t = t

    npv = leg_a_pv - leg_b_pv

    # Par basis spread: spread_par such that leg_a_pv = leg_b_pv_no_spread + N * s * annuity_b
    par_spread = 0.0
    if annuity_b > 0 and notional > 0:
        par_spread = (leg_a_pv - leg_b_pv_no_spread) / (notional * annuity_b)

    return {
        "npv": round(npv, 4),
        "leg_a_pv": round(leg_a_pv, 4),
        "leg_b_pv": round(leg_b_pv, 4),
        "par_basis_spread": round(par_spread, 8),
        "par_basis_spread_bps": round(par_spread * 10_000, 4),
        "notional": notional,
        "tenor_years": tenor_years,
    }


def get_basis_swap_types() -> list[dict]:
    """Return structured reference data about basis swap types."""
    return [
        {
            "type": "Tenor Basis Swap",
            "description": (
                "Exchanges floating payments at two different tenors of the same "
                "index (e.g. 3M SOFR vs 1M SOFR). The basis spread compensates "
                "for tenor risk — longer fixings embed more credit and liquidity risk."
            ),
            "example": "Pay 3M SOFR quarterly, receive 1M SOFR + spread monthly",
            "market_context": "Tenor basis spreads are typically 5-20 bps",
        },
        {
            "type": "OIS-LIBOR Basis (Historical)",
            "description": (
                "Exchanged LIBOR floating payments for OIS floating payments + spread. "
                "The spread reflected the credit premium in LIBOR over the risk-free "
                "OIS rate. Now largely obsolete post-LIBOR transition."
            ),
            "example": "Pay 3M LIBOR, receive OIS + spread (quarterly)",
            "market_context": "Basis was ~10 bps pre-crisis, 300+ bps during 2008",
        },
        {
            "type": "Cross-Currency Basis Swap",
            "description": (
                "Exchanges floating rates in two different currencies with an initial "
                "and final exchange of notionals at the spot FX rate. The basis spread "
                "on the non-USD leg reflects relative funding costs between currencies."
            ),
            "example": "Pay USD SOFR, receive EUR ESTR + basis (with notional exchange)",
            "market_context": "XCCY basis can be -50 to +50 bps depending on currency pair",
        },
    ]
