"""Cox-Ross-Rubinstein (CRR) binomial tree pricing engine.

Implements the standard CRR binomial lattice for European and American
vanilla options.  The model discretises the GBM dynamics into an N-step
recombining tree where at each node the underlying moves up by factor *u*
or down by factor *d*.

CRR Parameters
--------------
dt = T / N
u  = exp(sigma * sqrt(dt))
d  = 1 / u
p  = (exp((r - q) * dt) - d) / (u - d)

At each terminal node:
    S_j = S * u^j * d^(N-j),   j = 0, 1, ..., N

Backward induction:
    European:  V_i = exp(-r*dt) * [p * V_up + (1-p) * V_down]
    American:  V_i = max(intrinsic, exp(-r*dt) * [p * V_up + (1-p) * V_down])

Conventions
-----------
- Time is in years, all rates annualised and expressed as decimals.
- Dividend yield is continuous, not discrete.
- Default number of steps: 200 (reasonable accuracy–speed trade-off).
- The engine supports European *and* American exercise.

Convergence
-----------
CRR converges to the BSM price as N -> inf.  For practical use, N >= 100
typically gives < 1 cent error for standard equity options.  Richardson
extrapolation (even/odd N averaging) is not yet implemented.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from engine.models.base import PricingEngine
from schemas.instruments import OptionContract, OptionType


# ---------------------------------------------------------------------------
# Standalone function
# ---------------------------------------------------------------------------

def binomial_price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
    exercise: str = "european",
    steps: int = 200,
) -> dict[str, Any]:
    """Price an option using the CRR binomial tree.

    Parameters
    ----------
    S : float
        Spot price (> 0).
    K : float
        Strike price (> 0).
    T : float
        Time to expiry in years.  If T <= 0, returns intrinsic value.
    r : float
        Continuous risk-free rate (annualised).
    sigma : float
        Annualised volatility (> 0).
    q : float, optional
        Continuous dividend yield, default 0.
    option_type : str
        ``"call"`` or ``"put"``.
    exercise : str
        ``"european"`` or ``"american"``.
    steps : int
        Number of time steps in the tree (default 200).

    Returns
    -------
    dict
        ``price`` : float — the option value,
        ``early_exercise_premium`` : float — American premium over European
            (0 for European options),
        ``tree_params`` : dict — u, d, p, dt for transparency,
        ``steps`` : int — number of steps used.

    Raises
    ------
    ValueError
        If inputs are out of range or exercise style is invalid.
    """
    if S <= 0:
        raise ValueError(f"Spot price S must be > 0, got {S}")
    if K <= 0:
        raise ValueError(f"Strike price K must be > 0, got {K}")
    if sigma <= 0:
        raise ValueError(f"Volatility sigma must be > 0, got {sigma}")
    if steps < 1:
        raise ValueError(f"Steps must be >= 1, got {steps}")
    if exercise not in ("european", "american"):
        raise ValueError(f"Exercise must be 'european' or 'american', got {exercise!r}")

    is_call = option_type == "call"

    # At or past expiry: return intrinsic
    if T <= 0:
        intrinsic = max(S - K, 0.0) if is_call else max(K - S, 0.0)
        return {
            "price": intrinsic,
            "early_exercise_premium": 0.0,
            "tree_params": {"u": 1.0, "d": 1.0, "p": 0.5, "dt": 0.0},
            "steps": steps,
        }

    dt = T / steps
    u = math.exp(sigma * math.sqrt(dt))
    d = 1.0 / u
    disc = math.exp(-r * dt)
    p = (math.exp((r - q) * dt) - d) / (u - d)

    # Guard against arbitrage violation in the tree
    if not (0 < p < 1):
        raise ValueError(
            f"Risk-neutral probability p = {p:.6f} is outside (0, 1). "
            f"This usually means the time step is too large relative to "
            f"the drift and volatility.  Try increasing the number of steps."
        )

    # Terminal asset prices: S * u^j * d^(N-j) for j = 0..N
    # Use numpy for vectorised computation
    j = np.arange(steps + 1)
    ST = S * (u ** (steps - j)) * (d ** j)

    # Terminal payoffs
    if is_call:
        option_values = np.maximum(ST - K, 0.0)
    else:
        option_values = np.maximum(K - ST, 0.0)

    # Backward induction
    is_american = exercise == "american"
    for i in range(steps - 1, -1, -1):
        # Asset prices at step i
        Si = S * (u ** (i - j[:i + 1])) * (d ** j[:i + 1])
        option_values = disc * (p * option_values[:i + 1] + (1 - p) * option_values[1:i + 2])

        if is_american:
            if is_call:
                intrinsic = np.maximum(Si - K, 0.0)
            else:
                intrinsic = np.maximum(K - Si, 0.0)
            option_values = np.maximum(option_values, intrinsic)

    price = float(option_values[0])

    # Early exercise premium: difference vs European price
    early_exercise_premium = 0.0
    if is_american:
        euro_result = binomial_price(
            S, K, T, r, sigma, q, option_type, "european", steps
        )
        early_exercise_premium = max(price - euro_result["price"], 0.0)

    return {
        "price": price,
        "early_exercise_premium": early_exercise_premium,
        "tree_params": {
            "u": float(u),
            "d": float(d),
            "p": float(p),
            "dt": float(dt),
        },
        "steps": steps,
    }


# ---------------------------------------------------------------------------
# PricingEngine subclass
# ---------------------------------------------------------------------------

class BinomialPricingEngine(PricingEngine):
    """CRR binomial tree option pricer.

    Supports European and American exercise.  Number of steps defaults to 200
    but can be overridden via ``model_params["steps"]`` in the market_data dict.
    """

    @property
    def name(self) -> str:
        return "Binomial (CRR)"

    @property
    def supported_exercises(self) -> list[str]:
        return ["european", "american"]

    def price(self, option: OptionContract, market_data: dict[str, Any]) -> float:
        self.validate(option)

        steps = market_data.get("steps", 200)

        result = binomial_price(
            S=option.spot,
            K=option.strike,
            T=option.expiry_years,
            r=market_data["risk_free_rate"],
            sigma=market_data["volatility"],
            q=option.dividend_yield,
            option_type=option.option_type.value,
            exercise=option.exercise_style.value,
            steps=steps,
        )
        return result["price"]


# ---------------------------------------------------------------------------
# Registry registration
# ---------------------------------------------------------------------------

from registry.model_registry import pricing_model_registry  # noqa: E402

pricing_model_registry.register("binomial", BinomialPricingEngine)
