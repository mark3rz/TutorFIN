"""Cross-currency swap conceptual architecture.

A cross-currency swap (XCCY) involves:
1. Initial exchange of notionals at the spot FX rate
2. Periodic exchange of floating (or fixed) interest payments in two currencies
3. Final re-exchange of notionals at the original spot FX rate

Key features:
  - Unlike single-currency swaps, there IS an exchange of principal
  - The non-USD leg typically includes a basis spread
  - Mark-to-market (MTM) XCCY swaps reset the notional periodically at the
    prevailing FX rate to reduce counterparty credit exposure

Valuation:
  NPV = PV_domestic - PV_foreign * S_0

  where S_0 is the spot FX rate (domestic per foreign).

This module provides conceptual/educational functions rather than a
production cross-currency engine.
"""

from __future__ import annotations

import math


def xccy_swap_overview() -> dict:
    """Return structured conceptual overview of cross-currency swaps.

    Returns
    -------
    dict with educational content about XCCY swap mechanics.
    """
    return {
        "definition": (
            "A cross-currency swap exchanges interest payments and principal "
            "amounts in two different currencies. Unlike single-currency swaps, "
            "notionals are exchanged at inception and maturity."
        ),
        "mechanics": [
            {
                "step": "Initial Exchange",
                "description": (
                    "Counterparties exchange notionals at the prevailing spot FX "
                    "rate. E.g., Party A gives USD 100M, Party B gives EUR 85M "
                    "(at EUR/USD = 1.1765)."
                ),
            },
            {
                "step": "Periodic Payments",
                "description": (
                    "Party A pays USD SOFR on the USD notional. "
                    "Party B pays EUR ESTR + basis spread on the EUR notional."
                ),
            },
            {
                "step": "Final Exchange",
                "description": (
                    "At maturity, the original notionals are re-exchanged at the "
                    "SAME spot rate used at inception (not the prevailing rate). "
                    "This creates FX exposure."
                ),
            },
        ],
        "basis_spread": (
            "The cross-currency basis spread reflects the relative cost of "
            "borrowing in one currency vs. another. A negative USD/EUR basis "
            "means EUR borrowers pay extra to access USD funding. The basis "
            "is driven by supply-demand imbalances, FX hedging flows, and "
            "regulatory capital requirements."
        ),
        "mtm_variant": (
            "Mark-to-Market XCCY swaps reset the FX notional at each payment "
            "date using the prevailing spot rate. A compensating payment is "
            "made to offset the notional change, reducing counterparty credit "
            "exposure compared to the standard (non-MTM) structure."
        ),
        "use_cases": [
            "Converting fixed-rate debt in one currency to floating in another",
            "Hedging foreign currency bond issuance",
            "Exploiting cross-currency funding arbitrage",
            "Central bank FX swap lines (liquidity provision)",
        ],
    }


def simplified_xccy_npv(
    notional_dom: float,
    notional_for: float,
    rate_dom: float,
    rate_for: float,
    basis_spread: float,
    tenor_years: float,
    discount_rate_dom: float,
    discount_rate_for: float,
    spot_fx: float,
    freq: int = 4,
) -> dict:
    """Simplified NPV of a cross-currency basis swap (educational).

    This is a flat-rate approximation for demonstration purposes.
    A production implementation would use full term structures.

    Parameters
    ----------
    notional_dom : float
        Domestic notional (e.g. USD 100M).
    notional_for : float
        Foreign notional (e.g. EUR 85M).
    rate_dom : float
        Domestic floating rate (flat).
    rate_for : float
        Foreign floating rate (flat).
    basis_spread : float
        Spread on the foreign leg.
    tenor_years : float
        Swap maturity.
    discount_rate_dom : float
        Domestic discount rate.
    discount_rate_for : float
        Foreign discount rate.
    spot_fx : float
        Spot FX rate (domestic per foreign).
    freq : int
        Payment frequency.

    Returns
    -------
    dict with npv and leg details.
    """
    if tenor_years <= 0:
        raise ValueError("Tenor must be positive")

    period = 1.0 / freq
    n_periods = max(1, round(tenor_years * freq))

    # Domestic leg PV (in domestic currency)
    dom_pv = 0.0
    for i in range(n_periods):
        t = (i + 1) * period
        cf = notional_dom * rate_dom * period
        df = math.exp(-discount_rate_dom * t)
        dom_pv += cf * df

    # Add back notional at maturity
    dom_pv += notional_dom * math.exp(-discount_rate_dom * tenor_years)

    # Foreign leg PV (in foreign currency, then converted)
    for_pv = 0.0
    for i in range(n_periods):
        t = (i + 1) * period
        cf = notional_for * (rate_for + basis_spread) * period
        df = math.exp(-discount_rate_for * t)
        for_pv += cf * df

    # Add back notional at maturity
    for_pv += notional_for * math.exp(-discount_rate_for * tenor_years)

    # Convert foreign PV to domestic
    for_pv_dom = for_pv * spot_fx

    npv = dom_pv - for_pv_dom

    return {
        "npv_domestic": round(npv, 4),
        "domestic_leg_pv": round(dom_pv, 4),
        "foreign_leg_pv_foreign": round(for_pv, 4),
        "foreign_leg_pv_domestic": round(for_pv_dom, 4),
        "spot_fx": spot_fx,
        "notional_dom": notional_dom,
        "notional_for": notional_for,
        "tenor_years": tenor_years,
    }
