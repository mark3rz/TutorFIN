"""Black-Scholes-Merton (BSM) closed-form pricing engine for European options.

Implements the BSM model with continuous dividend yield under the risk-neutral
measure.  All formulas follow the standard BSM framework:

    d1 = [ln(S/K) + (r - q + sigma^2/2) * T] / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)

    Call = S * e^(-qT) * N(d1) - K * e^(-rT) * N(d2)
    Put  = K * e^(-rT) * N(-d2) - S * e^(-qT) * N(-d1)

Where:
    S     = current spot price of the underlying
    K     = strike price
    T     = time to expiration in years
    r     = continuous risk-free rate (annualised)
    q     = continuous dividend yield (annualised)
    sigma = volatility of the underlying (annualised)
    N()   = standard normal cumulative distribution function

Conventions:
    - Time is in years.
    - All rates and volatility are annualised and expressed as decimals
      (e.g. 5% = 0.05).
    - Dividend yield is continuous, not discrete.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy.stats import norm

from engine.models.base import PricingEngine
from schemas.instruments import OptionContract, OptionType


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _d1_d2(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
) -> tuple[float, float]:
    """Compute the BSM d1 and d2 parameters.

    Parameters
    ----------
    S : float
        Spot price (must be > 0).
    K : float
        Strike price (must be > 0).
    T : float
        Time to expiration in years (must be > 0).
    r : float
        Continuous risk-free rate (annualised).
    sigma : float
        Volatility (annualised, must be > 0).
    q : float, optional
        Continuous dividend yield (annualised), default 0.

    Returns
    -------
    tuple[float, float]
        (d1, d2)
    """
    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T
    return d1, d2


def bsm_price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
) -> float:
    """Compute the BSM closed-form option price.

    This is a standalone convenience function that does not require
    constructing an :class:`OptionContract` or engine instance.

    Parameters
    ----------
    S : float
        Spot price (> 0).
    K : float
        Strike price (> 0).
    T : float
        Time to expiration in years.  If T <= 0 the intrinsic value is
        returned.
    r : float
        Continuous risk-free rate.
    sigma : float
        Annualised volatility (> 0).
    q : float, optional
        Continuous dividend yield, default 0.
    option_type : str, optional
        ``"call"`` or ``"put"``, default ``"call"``.

    Returns
    -------
    float
        Theoretical option price.

    Raises
    ------
    ValueError
        If S <= 0, K <= 0, or sigma <= 0.
    """
    if S <= 0:
        raise ValueError(f"Spot price S must be > 0, got {S}")
    if K <= 0:
        raise ValueError(f"Strike price K must be > 0, got {K}")
    if sigma <= 0:
        raise ValueError(f"Volatility sigma must be > 0, got {sigma}")

    # At or past expiry: return intrinsic value
    if T <= 0:
        if option_type == "call":
            return max(S - K, 0.0)
        else:
            return max(K - S, 0.0)

    d1, d2 = _d1_d2(S, K, T, r, sigma, q)

    discount = math.exp(-r * T)
    forward_adj = math.exp(-q * T)

    if option_type == "call":
        price = S * forward_adj * norm.cdf(d1) - K * discount * norm.cdf(d2)
    else:
        price = K * discount * norm.cdf(-d2) - S * forward_adj * norm.cdf(-d1)

    return float(price)


# ---------------------------------------------------------------------------
# PricingEngine subclass
# ---------------------------------------------------------------------------

class BlackScholesPricingEngine(PricingEngine):
    """Closed-form European option pricer using the Black-Scholes-Merton model.

    Formulas
    --------
    d1 = [ln(S/K) + (r - q + sigma^2/2) * T] / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)

    Call = S * e^(-qT) * N(d1)  -  K * e^(-rT) * N(d2)
    Put  = K * e^(-rT) * N(-d2) -  S * e^(-qT) * N(-d1)

    Supported exercise styles: European only.
    """

    @property
    def name(self) -> str:
        return "Black-Scholes-Merton"

    @property
    def supported_exercises(self) -> list[str]:
        return ["european"]

    def price(self, option: OptionContract, market_data: dict[str, Any]) -> float:
        """Price a European option using BSM closed-form solution.

        Parameters
        ----------
        option : OptionContract
            Must have exercise_style == "european".
        market_data : dict
            Must contain ``risk_free_rate`` (float) and ``volatility`` (float).
            May also contain ``dividend_yield`` to override the option-level
            value, but the option's own ``dividend_yield`` is used by default.

        Returns
        -------
        float
            Theoretical fair value of the option.
        """
        self.validate(option)

        r = market_data["risk_free_rate"]
        sigma = market_data["volatility"]
        q = option.dividend_yield

        return bsm_price(
            S=option.spot,
            K=option.strike,
            T=option.expiry_years,
            r=r,
            sigma=sigma,
            q=q,
            option_type=option.option_type.value,
        )


# ---------------------------------------------------------------------------
# Registry registration (runs at import time)
# ---------------------------------------------------------------------------

from registry.model_registry import pricing_model_registry  # noqa: E402

pricing_model_registry.register("black_scholes", BlackScholesPricingEngine)
