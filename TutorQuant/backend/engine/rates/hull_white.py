"""Hull-White (extended Vasicek) short-rate model.

SDE:  dr = [theta(t) - a * r] * dt + sigma * dW

In the time-homogeneous calibration used here, theta(t) is treated as
a constant drift target (theta_hw), making the model equivalent to the
Vasicek model but with different parameterisation conventions.  In
practice, theta(t) is calibrated to perfectly fit the initial term
structure — this time-dependent functionality is noted for future extension.

For simulation and analytics, we use the equivalent representation:
    dr = a * (b - r) * dt + sigma * dW
where b = theta_hw / a is the long-run mean (constant theta case).

Properties:
- Mean-reverting with constant volatility (like Vasicek)
- Can go negative (Gaussian)
- Time-dependent theta(t) allows exact fit to initial yield curve
- The most popular one-factor model in practice

Parameters:
    a      (float): Speed of mean reversion (> 0)
    sigma  (float): Volatility of the short rate (> 0)
    theta_hw (float): Mean reversion target (constant approx)
    r0     (float): Initial short rate
"""

from __future__ import annotations

import math

import numpy as np


def simulate_hull_white(
    r0: float,
    a: float,
    sigma: float,
    theta_hw: float,
    T: float,
    n_steps: int = 252,
    n_paths: int = 100,
    seed: int | None = None,
) -> dict:
    """Simulate Hull-White paths using exact Gaussian transitions.

    In the constant-theta case, the HW model is equivalent to Vasicek
    with kappa=a and theta=theta_hw/a, so we can use the exact transition
    distribution.

    Returns
    -------
    dict with keys:
        times      : list[float]
        paths      : list[list[float]]
        mean_path  : list[float]
        std_path   : list[float]
        terminal   : list[float]
    """
    if a <= 0:
        raise ValueError("a (mean reversion speed) must be positive")
    if sigma <= 0:
        raise ValueError("sigma must be positive")
    if T <= 0:
        raise ValueError("T must be positive")

    rng = np.random.default_rng(seed)
    dt = T / n_steps
    times = [i * dt for i in range(n_steps + 1)]

    # Equivalent Vasicek parameters
    b = theta_hw / a  # long-run mean

    exp_neg_adt = math.exp(-a * dt)
    var_dt = sigma ** 2 / (2.0 * a) * (1.0 - math.exp(-2.0 * a * dt))
    std_dt = math.sqrt(var_dt)

    rates = np.zeros((n_paths, n_steps + 1))
    rates[:, 0] = r0

    for t in range(n_steps):
        z = rng.standard_normal(n_paths)
        rates[:, t + 1] = (
            rates[:, t] * exp_neg_adt + b * (1.0 - exp_neg_adt) + std_dt * z
        )

    mean_path = rates.mean(axis=0).tolist()
    std_path = rates.std(axis=0).tolist()
    terminal = rates[:, -1].tolist()

    n_vis = min(n_paths, 50)
    vis_paths = rates[:n_vis].tolist()

    return {
        "times": times,
        "paths": vis_paths,
        "mean_path": mean_path,
        "std_path": std_path,
        "terminal": terminal,
    }


def hull_white_bond_price(
    r: float,
    a: float,
    sigma: float,
    theta_hw: float,
    T: float,
) -> float:
    """Analytical ZCB price under constant-theta Hull-White.

    Equivalent to the Vasicek bond price with kappa=a, theta=theta_hw/a.
    """
    if a <= 0:
        raise ValueError("a must be positive")
    if T <= 0:
        raise ValueError("T must be positive")

    b = theta_hw / a  # long-run mean

    B = (1.0 - math.exp(-a * T)) / a
    A_exp = (
        (B - T) * (a ** 2 * b - sigma ** 2 / 2.0) / a ** 2
        - sigma ** 2 * B ** 2 / (4.0 * a)
    )
    A = math.exp(A_exp)
    return A * math.exp(-B * r)


def hull_white_zero_rate(
    r: float,
    a: float,
    sigma: float,
    theta_hw: float,
    T: float,
) -> float:
    """Implied continuously-compounded zero rate."""
    P = hull_white_bond_price(r, a, sigma, theta_hw, T)
    return -math.log(P) / T


def hull_white_yield_curve(
    r: float,
    a: float,
    sigma: float,
    theta_hw: float,
    maturities: list[float] | None = None,
) -> dict:
    """Compute the full yield curve implied by the Hull-White model."""
    if maturities is None:
        maturities = [0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 7.0, 10.0, 15.0, 20.0, 30.0]

    bond_prices = [hull_white_bond_price(r, a, sigma, theta_hw, t) for t in maturities]
    zero_rates = [hull_white_zero_rate(r, a, sigma, theta_hw, t) for t in maturities]

    return {
        "maturities": maturities,
        "bond_prices": bond_prices,
        "zero_rates": zero_rates,
    }


def hull_white_mean_and_variance(
    r0: float,
    a: float,
    sigma: float,
    theta_hw: float,
    T: float,
) -> tuple[float, float]:
    """Analytical mean and variance of r(T) under Hull-White (constant theta)."""
    b = theta_hw / a
    mean = r0 * math.exp(-a * T) + b * (1.0 - math.exp(-a * T))
    var = sigma ** 2 / (2.0 * a) * (1.0 - math.exp(-2.0 * a * T))
    return mean, var
