"""Geometric Brownian Motion (GBM) Monte Carlo simulation engine.

Implements the exact (log-normal) solution of the GBM stochastic differential
equation for risk-neutral option pricing:

    dS = (r - q) S dt  +  sigma S dW

Exact solution over a time step dt:

    S(t+dt) = S(t) * exp[ (r - q - sigma^2/2) dt  +  sigma * sqrt(dt) * Z ]

where Z ~ N(0, 1).

Variance reduction
------------------
When ``antithetic=True`` (the default), the engine generates ``num_paths // 2``
independent standard-normal draws Z and constructs the complementary paths
using -Z.  This ensures that every pair of paths has perfectly negatively
correlated terminal noise, which typically reduces variance of the price
estimator by a factor of 2-4 for smooth payoffs.

Reproducibility
---------------
The RNG is seeded via ``np.random.default_rng(seed)`` so that identical
``seed`` values yield identical path sets.
"""

from __future__ import annotations

import math

import numpy as np


def simulate_gbm(
    S0: float,
    r: float,
    sigma: float,
    T: float,
    num_paths: int,
    num_steps: int,
    q: float = 0.0,
    seed: int | None = None,
    antithetic: bool = True,
) -> dict[str, np.ndarray]:
    """Simulate GBM paths using the exact log-normal scheme.

    Parameters
    ----------
    S0 : float
        Initial spot price.
    r : float
        Continuous risk-free rate (annualised).
    sigma : float
        Annualised volatility.
    T : float
        Time horizon in years.
    num_paths : int
        Total number of paths to generate.  If ``antithetic=True``,
        ``num_paths // 2`` independent paths are generated and the other
        half are their antithetic mirrors.  The actual number of returned
        paths is ``num_paths`` (rounded down to an even number when
        antithetic is used).
    num_steps : int
        Number of time steps per path.
    q : float, optional
        Continuous dividend yield, default 0.
    seed : int or None, optional
        RNG seed for reproducibility.
    antithetic : bool, optional
        Whether to use antithetic variates, default True.

    Returns
    -------
    dict
        ``paths``           : np.ndarray of shape (num_paths, num_steps + 1)
        ``terminal_values`` : np.ndarray of shape (num_paths,)
    """
    rng = np.random.default_rng(seed)

    dt = T / num_steps
    drift = (r - q - 0.5 * sigma * sigma) * dt
    diffusion = sigma * math.sqrt(dt)

    if antithetic:
        half = num_paths // 2
        # Ensure total paths is even
        actual_paths = half * 2
        Z = rng.standard_normal((half, num_steps))
        Z_full = np.concatenate([Z, -Z], axis=0)  # (actual_paths, num_steps)
    else:
        actual_paths = num_paths
        Z_full = rng.standard_normal((actual_paths, num_steps))

    # Log-price increments
    increments = drift + diffusion * Z_full  # (actual_paths, num_steps)

    # Cumulative sum of log-increments, prepend 0 for the initial price
    log_paths = np.zeros((actual_paths, num_steps + 1))
    log_paths[:, 0] = math.log(S0)
    np.cumsum(increments, axis=1, out=log_paths[:, 1:])
    log_paths[:, 1:] += math.log(S0)

    paths = np.exp(log_paths)
    terminal_values = paths[:, -1]

    return {
        "paths": paths,
        "terminal_values": terminal_values,
    }


def price_option_mc(
    S0: float,
    K: float,
    r: float,
    sigma: float,
    T: float,
    option_type: str,
    num_paths: int = 1000,
    num_steps: int = 252,
    q: float = 0.0,
    seed: int | None = None,
    antithetic: bool = True,
) -> dict:
    """Price a European option via Monte Carlo simulation under GBM.

    Parameters
    ----------
    S0 : float
        Initial spot price.
    K : float
        Strike price.
    r : float
        Continuous risk-free rate.
    sigma : float
        Annualised volatility.
    T : float
        Time to expiration in years.
    option_type : str
        ``"call"`` or ``"put"``.
    num_paths : int, optional
        Number of simulation paths, default 1000.
    num_steps : int, optional
        Time steps per path, default 252 (daily for ~1 year).
    q : float, optional
        Continuous dividend yield, default 0.
    seed : int or None, optional
        RNG seed for reproducibility.
    antithetic : bool, optional
        Use antithetic variates, default True.

    Returns
    -------
    dict
        ``price``                 : float -- mean discounted payoff
        ``std_error``             : float -- standard error of the estimator
        ``confidence_interval_95``: tuple[float, float]
        ``paths``                 : dict with representative_path, path_fan,
                                    terminal_values
        ``convergence``           : dict with running_mean, running_std,
                                    confidence_interval_95
    """
    sim = simulate_gbm(
        S0=S0, r=r, sigma=sigma, T=T,
        num_paths=num_paths, num_steps=num_steps,
        q=q, seed=seed, antithetic=antithetic,
    )

    paths = sim["paths"]
    terminal = sim["terminal_values"]
    actual_paths = paths.shape[0]

    # --- Compute payoffs ---
    if option_type == "call":
        payoffs = np.maximum(terminal - K, 0.0)
    else:
        payoffs = np.maximum(K - terminal, 0.0)

    # Discount factor
    discount = math.exp(-r * T)
    discounted_payoffs = discount * payoffs

    # --- Price statistics ---
    price = float(np.mean(discounted_payoffs))
    std_dev = float(np.std(discounted_payoffs, ddof=1))
    std_error = std_dev / math.sqrt(actual_paths)
    ci_lower = price - 1.96 * std_error
    ci_upper = price + 1.96 * std_error

    # --- Convergence diagnostics ---
    # Cumulative mean/std of discounted payoffs in path order
    cumsum = np.cumsum(discounted_payoffs)
    path_indices = np.arange(1, actual_paths + 1, dtype=np.float64)
    running_mean = cumsum / path_indices

    # Running std: use online formula for numerical stability
    cumsum_sq = np.cumsum(discounted_payoffs ** 2)
    # Var = E[X^2] - E[X]^2, with Bessel correction for n > 1
    running_var = np.zeros(actual_paths)
    running_var[0] = 0.0
    running_var[1:] = (
        (cumsum_sq[1:] / path_indices[1:]) - (running_mean[1:] ** 2)
    ) * (path_indices[1:] / (path_indices[1:] - 1.0))
    running_var = np.maximum(running_var, 0.0)  # guard against floating-point negatives
    running_std = np.sqrt(running_var)

    # --- Path data for visualisation ---
    # Representative path: median terminal value path
    median_idx = int(np.argsort(terminal)[actual_paths // 2])
    representative_path = paths[median_idx].tolist()

    # Path fan: select 20 evenly spaced paths (by index, not by terminal value)
    fan_count = min(20, actual_paths)
    fan_indices = np.linspace(0, actual_paths - 1, fan_count, dtype=int)
    path_fan = [paths[i].tolist() for i in fan_indices]

    return {
        "price": price,
        "std_error": std_error,
        "confidence_interval_95": (float(ci_lower), float(ci_upper)),
        "paths": {
            "representative_path": representative_path,
            "path_fan": path_fan,
            "terminal_values": terminal.tolist(),
        },
        "convergence": {
            "running_mean": running_mean.tolist(),
            "running_std": running_std.tolist(),
            "confidence_interval_95": (float(ci_lower), float(ci_upper)),
        },
    }
