"""Trinomial tree pricing engine for vanilla options.

Implements a standard trinomial lattice where at each node the underlying
can move up, down, or stay (roughly) unchanged.  Trinomial trees typically
converge faster than binomial trees for the same number of steps and are
better suited for pricing American options and computing Greeks via
finite differences on the tree itself.

Trinomial Parameters (Kamrad-Ritchken parameterisation)
-------------------------------------------------------
dt = T / N
u  = exp(lambda * sigma * sqrt(dt))     where lambda = sqrt(3/2) ≈ 1.2247
d  = 1 / u
m  = 1                                   (middle node stays at same price)

p_u = 1/(2*lambda^2) + (r - q - sigma^2/2)*sqrt(dt) / (2*lambda*sigma)
p_d = 1/(2*lambda^2) - (r - q - sigma^2/2)*sqrt(dt) / (2*lambda*sigma)
p_m = 1 - p_u - p_d

The Kamrad-Ritchken scheme ensures all probabilities are in (0, 1) for
a wider range of parameters than the naive Hull-White trinomial.

Conventions
-----------
- Same conventions as the binomial model: annualised rates, continuous
  dividend yield, time in years.
- Default number of steps: 150 (trinomial converges faster than binomial,
  so fewer steps are needed for comparable accuracy).

Convergence
-----------
Trinomial tree converges to BSM as N -> inf, with O(1/N) convergence rate
(same order as binomial but typically with smaller constants).
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

LAMBDA = math.sqrt(1.5)  # sqrt(3/2) ≈ 1.2247


def trinomial_price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
    exercise: str = "european",
    steps: int = 150,
) -> dict[str, Any]:
    """Price an option using a trinomial tree (Kamrad-Ritchken scheme).

    Parameters
    ----------
    S : float
        Spot price (> 0).
    K : float
        Strike price (> 0).
    T : float
        Time to expiry in years.  If T <= 0, returns intrinsic.
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
        Number of time steps in the tree (default 150).

    Returns
    -------
    dict
        ``price``, ``early_exercise_premium``, ``tree_params``, ``steps``.

    Raises
    ------
    ValueError
        If inputs are out of range.
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

    # At or past expiry
    if T <= 0:
        intrinsic = max(S - K, 0.0) if is_call else max(K - S, 0.0)
        return {
            "price": intrinsic,
            "early_exercise_premium": 0.0,
            "tree_params": {"u": 1.0, "d": 1.0, "p_u": 1 / 3, "p_m": 1 / 3, "p_d": 1 / 3, "dt": 0.0},
            "steps": steps,
        }

    dt = T / steps
    sqrt_dt = math.sqrt(dt)

    u = math.exp(LAMBDA * sigma * sqrt_dt)
    d = 1.0 / u
    disc = math.exp(-r * dt)

    drift = r - q - 0.5 * sigma * sigma
    p_u = 1.0 / (2.0 * LAMBDA * LAMBDA) + drift * sqrt_dt / (2.0 * LAMBDA * sigma)
    p_d = 1.0 / (2.0 * LAMBDA * LAMBDA) - drift * sqrt_dt / (2.0 * LAMBDA * sigma)
    p_m = 1.0 - p_u - p_d

    # Validate probabilities
    if p_u < 0 or p_d < 0 or p_m < 0 or p_u > 1 or p_d > 1 or p_m > 1:
        raise ValueError(
            f"Trinomial probabilities invalid: p_u={p_u:.6f}, p_m={p_m:.6f}, "
            f"p_d={p_d:.6f}.  Try increasing the number of steps."
        )

    # Terminal asset prices at step N:
    # In a trinomial tree with N steps, the asset can end up at
    # 2*N + 1 distinct nodes: S * u^j for j = -N, -N+1, ..., N
    j = np.arange(-steps, steps + 1)
    ST = S * (u ** j)

    # Terminal payoffs
    if is_call:
        option_values = np.maximum(ST - K, 0.0)
    else:
        option_values = np.maximum(K - ST, 0.0)

    # Backward induction
    is_american = exercise == "american"
    for i in range(steps - 1, -1, -1):
        # At step i, there are 2*i + 1 nodes
        num_nodes = 2 * i + 1
        j_i = np.arange(-i, i + 1)
        Si = S * (u ** j_i)

        # Each node j at step i connects to nodes j+1, j, j-1 at step i+1
        # In the option_values array (which has 2*(i+1)+1 elements for step i+1),
        # node j maps to index j + (i+1) in the step i+1 array
        new_values = np.empty(num_nodes)
        for idx, jj in enumerate(j_i):
            # Index in step i+1 array: offset by (i+1)
            up_idx = jj + 1 + (i + 1)
            mid_idx = jj + (i + 1)
            dn_idx = jj - 1 + (i + 1)
            new_values[idx] = disc * (
                p_u * option_values[up_idx]
                + p_m * option_values[mid_idx]
                + p_d * option_values[dn_idx]
            )

        option_values = new_values

        if is_american:
            if is_call:
                intrinsic = np.maximum(Si - K, 0.0)
            else:
                intrinsic = np.maximum(K - Si, 0.0)
            option_values = np.maximum(option_values, intrinsic)

    price = float(option_values[0])

    # Early exercise premium
    early_exercise_premium = 0.0
    if is_american:
        euro_result = trinomial_price(
            S, K, T, r, sigma, q, option_type, "european", steps
        )
        early_exercise_premium = max(price - euro_result["price"], 0.0)

    return {
        "price": price,
        "early_exercise_premium": early_exercise_premium,
        "tree_params": {
            "u": float(u),
            "d": float(d),
            "p_u": float(p_u),
            "p_m": float(p_m),
            "p_d": float(p_d),
            "dt": float(dt),
        },
        "steps": steps,
    }


# ---------------------------------------------------------------------------
# PricingEngine subclass
# ---------------------------------------------------------------------------

class TrinomialPricingEngine(PricingEngine):
    """Trinomial tree option pricer (Kamrad-Ritchken parameterisation).

    Supports European and American exercise.  Number of steps defaults to 150
    but can be overridden via ``model_params["steps"]``.
    """

    @property
    def name(self) -> str:
        return "Trinomial (Kamrad-Ritchken)"

    @property
    def supported_exercises(self) -> list[str]:
        return ["european", "american"]

    def price(self, option: OptionContract, market_data: dict[str, Any]) -> float:
        self.validate(option)

        steps = market_data.get("steps", 150)

        result = trinomial_price(
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

pricing_model_registry.register("trinomial", TrinomialPricingEngine)
