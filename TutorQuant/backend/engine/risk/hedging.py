"""Discrete hedging error demonstration engine.

Simulates delta-hedging an option position with discrete rebalancing
intervals and transaction costs to illustrate the gap between the
BSM theoretical price and actual hedging cost.

Methodology
-----------
1. Simulate an asset price path using GBM (exact log-normal scheme).
2. At each rebalancing date, compute the BSM delta and adjust the
   hedge position.
3. Track the cumulative hedging cost including:
   - Shares bought/sold times the spot price
   - Transaction costs (proportional to absolute notional traded)
4. At expiry, the final hedge error is:
       hedging_error = hedge_portfolio_value - option_payoff

In the continuous-time limit with zero transaction costs, the hedge
error converges to zero (BSM replication argument).  With discrete
rebalancing and/or transaction costs, there is a non-zero hedge error
whose distribution depends on:
- Rebalancing frequency (more frequent → smaller error, more costs)
- Volatility realised vs implied
- Transaction cost rate

Conventions
-----------
- Transaction cost is expressed as a fraction of notional traded
  (e.g. 0.001 = 10 bps).
- Rebalancing is equally spaced in time.
- One simulation path is shown per run; run multiple times to see
  the distribution of hedge errors.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from engine.models.black_scholes import bsm_price
from engine.greeks.analytical import bsm_greeks


def simulate_hedge(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    q: float = 0.0,
    option_type: str = "call",
    rebalance_steps: int = 50,
    transaction_cost_rate: float = 0.0,
    seed: int | None = None,
    num_paths: int = 1,
) -> dict[str, Any]:
    """Simulate discrete delta-hedging of a short option position.

    Parameters
    ----------
    S, K, T, r, sigma, q, option_type :
        Option parameters.
    rebalance_steps : int
        Number of rebalancing intervals (default 50).
    transaction_cost_rate : float
        Proportional transaction cost (e.g. 0.001 for 10 bps).
    seed : int, optional
        Random seed.
    num_paths : int
        Number of simulation paths (default 1).

    Returns
    -------
    dict
        bsm_price : float — theoretical BSM price (hedging cost in theory),
        paths : list[dict] — per-path results containing:
            spot_path, delta_path, hedge_errors, cumulative_cost,
            total_transaction_costs, final_hedge_error, option_payoff,
        summary : dict — mean/std of hedge errors across paths,
        rebalance_steps, transaction_cost_rate.
    """
    if S <= 0:
        raise ValueError(f"Spot price S must be > 0, got {S}")
    if K <= 0:
        raise ValueError(f"Strike price K must be > 0, got {K}")
    if sigma <= 0:
        raise ValueError(f"Volatility sigma must be > 0, got {sigma}")
    if rebalance_steps < 1:
        raise ValueError(f"rebalance_steps must be >= 1, got {rebalance_steps}")

    rng = np.random.default_rng(seed)
    dt = T / rebalance_steps
    theoretical_price = bsm_price(S, K, T, r, sigma, q, option_type)

    is_call = option_type == "call"

    all_paths = []

    for _ in range(num_paths):
        # Generate asset price path (GBM exact solution)
        Z = rng.standard_normal(rebalance_steps)
        spot_path = np.empty(rebalance_steps + 1)
        spot_path[0] = S

        for i in range(rebalance_steps):
            spot_path[i + 1] = spot_path[i] * math.exp(
                (r - q - 0.5 * sigma * sigma) * dt + sigma * math.sqrt(dt) * Z[i]
            )

        # Delta-hedging simulation
        delta_path = np.empty(rebalance_steps + 1)
        cash = np.empty(rebalance_steps + 1)
        total_tc = 0.0

        # Initial position: sell the option, receive premium, buy delta shares
        time_remaining = T
        greeks_0 = bsm_greeks(S, K, time_remaining, r, sigma, q, option_type)
        delta_0 = greeks_0["delta"]
        delta_path[0] = delta_0

        # Cash = option premium received - cost of delta shares
        cash[0] = theoretical_price - delta_0 * S
        # Transaction cost on initial hedge
        tc = abs(delta_0 * S) * transaction_cost_rate
        cash[0] -= tc
        total_tc += tc

        for i in range(1, rebalance_steps + 1):
            time_remaining = T - i * dt

            if time_remaining > 0 and i < rebalance_steps:
                greeks_i = bsm_greeks(
                    float(spot_path[i]), K, time_remaining, r, sigma, q, option_type
                )
                new_delta = greeks_i["delta"]
            else:
                # At expiry, delta is 1 (ITM) or 0 (OTM)
                if is_call:
                    new_delta = 1.0 if spot_path[i] > K else 0.0
                else:
                    new_delta = -1.0 if spot_path[i] < K else 0.0

            delta_change = new_delta - delta_path[i - 1]
            delta_path[i] = new_delta

            # Buy/sell shares to adjust hedge
            trade_cost = delta_change * spot_path[i]
            tc = abs(trade_cost) * transaction_cost_rate
            total_tc += tc

            # Cash grows at risk-free rate and pays for rebalancing
            cash[i] = cash[i - 1] * math.exp(r * dt) - trade_cost - tc

        # Final hedge portfolio value: shares + cash
        final_spot = float(spot_path[-1])
        final_delta = delta_path[-1]
        hedge_portfolio = final_delta * final_spot + cash[-1]

        # Option payoff at expiry
        if is_call:
            payoff = max(final_spot - K, 0.0)
        else:
            payoff = max(K - final_spot, 0.0)

        # Hedge error: what remains after paying the option payoff
        hedge_error = hedge_portfolio - payoff

        all_paths.append({
            "spot_path": spot_path.tolist(),
            "delta_path": delta_path.tolist(),
            "cash_path": cash.tolist(),
            "total_transaction_costs": total_tc,
            "final_hedge_error": hedge_error,
            "option_payoff": payoff,
            "hedge_portfolio_value": hedge_portfolio,
        })

    # Summary statistics
    errors = [p["final_hedge_error"] for p in all_paths]
    summary = {
        "mean_hedge_error": float(np.mean(errors)),
        "std_hedge_error": float(np.std(errors)),
        "min_hedge_error": float(np.min(errors)),
        "max_hedge_error": float(np.max(errors)),
    }

    return {
        "bsm_price": theoretical_price,
        "paths": all_paths,
        "summary": summary,
        "rebalance_steps": rebalance_steps,
        "transaction_cost_rate": transaction_cost_rate,
    }
