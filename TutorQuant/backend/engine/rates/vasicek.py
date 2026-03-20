"""Vasicek short-rate model.

SDE:  dr = kappa * (theta - r) * dt + sigma * dW

Properties:
- Mean-reverting (Ornstein-Uhlenbeck process)
- Gaussian distributed rates → can go negative
- Analytical bond price and zero-rate formulas available
- Constant volatility independent of the rate level

Parameters:
    kappa  (float): Speed of mean reversion (> 0)
    theta  (float): Long-run mean rate
    sigma  (float): Volatility of the short rate (> 0)
    r0     (float): Initial short rate
"""

from __future__ import annotations

import math

import numpy as np


def simulate_vasicek(
    r0: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
    n_steps: int = 252,
    n_paths: int = 100,
    seed: int | None = None,
) -> dict:
    """Simulate Vasicek short-rate paths using exact discretisation.

    Uses the known transition distribution (Gaussian) to generate
    exact samples rather than an Euler scheme, eliminating discretisation bias.

    Returns
    -------
    dict with keys:
        times      : list[float] — time grid [0, dt, 2dt, ..., T]
        paths      : list[list[float]] — n_paths simulated rate paths
        mean_path  : list[float] — cross-path mean at each time step
        std_path   : list[float] — cross-path std at each time step
        terminal   : list[float] — terminal rate values
    """
    if kappa <= 0:
        raise ValueError("kappa must be positive")
    if sigma <= 0:
        raise ValueError("sigma must be positive")
    if T <= 0:
        raise ValueError("T must be positive")

    rng = np.random.default_rng(seed)
    dt = T / n_steps
    times = [i * dt for i in range(n_steps + 1)]

    # Exact transition: r(t+dt) | r(t) ~ N(mu, var)
    # mu  = r(t) * exp(-kappa*dt) + theta * (1 - exp(-kappa*dt))
    # var = sigma^2 / (2*kappa) * (1 - exp(-2*kappa*dt))
    exp_neg_kdt = math.exp(-kappa * dt)
    var_dt = (sigma ** 2) / (2.0 * kappa) * (1.0 - math.exp(-2.0 * kappa * dt))
    std_dt = math.sqrt(var_dt)

    rates = np.zeros((n_paths, n_steps + 1))
    rates[:, 0] = r0

    for t in range(n_steps):
        z = rng.standard_normal(n_paths)
        rates[:, t + 1] = (
            rates[:, t] * exp_neg_kdt + theta * (1.0 - exp_neg_kdt) + std_dt * z
        )

    mean_path = rates.mean(axis=0).tolist()
    std_path = rates.std(axis=0).tolist()
    terminal = rates[:, -1].tolist()

    # Return a subset of paths for visualisation (max 50)
    n_vis = min(n_paths, 50)
    vis_paths = rates[:n_vis].tolist()

    return {
        "times": times,
        "paths": vis_paths,
        "mean_path": mean_path,
        "std_path": std_path,
        "terminal": terminal,
    }


def vasicek_bond_price(
    r: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
) -> float:
    """Analytical zero-coupon bond price P(0, T) under the Vasicek model.

    P(0, T) = A(T) * exp(-B(T) * r)

    where:
        B(T) = (1 - exp(-kappa*T)) / kappa
        A(T) = exp[(B(T) - T)(kappa^2*theta - sigma^2/2) / kappa^2
                     - sigma^2 * B(T)^2 / (4*kappa)]
    """
    if kappa <= 0:
        raise ValueError("kappa must be positive")
    if T <= 0:
        raise ValueError("T must be positive")

    B = (1.0 - math.exp(-kappa * T)) / kappa
    A_exp = (
        (B - T) * (kappa ** 2 * theta - sigma ** 2 / 2.0) / kappa ** 2
        - sigma ** 2 * B ** 2 / (4.0 * kappa)
    )
    A = math.exp(A_exp)
    return A * math.exp(-B * r)


def vasicek_zero_rate(
    r: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
) -> float:
    """Implied continuously-compounded zero rate: R(T) = -ln(P(T)) / T."""
    P = vasicek_bond_price(r, kappa, theta, sigma, T)
    return -math.log(P) / T


def vasicek_yield_curve(
    r: float,
    kappa: float,
    theta: float,
    sigma: float,
    maturities: list[float] | None = None,
) -> dict:
    """Compute the full yield curve implied by the Vasicek model.

    Returns
    -------
    dict with keys:
        maturities    : list[float]
        bond_prices   : list[float]
        zero_rates    : list[float]
    """
    if maturities is None:
        maturities = [0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 7.0, 10.0, 15.0, 20.0, 30.0]

    bond_prices = [vasicek_bond_price(r, kappa, theta, sigma, t) for t in maturities]
    zero_rates = [vasicek_zero_rate(r, kappa, theta, sigma, t) for t in maturities]

    return {
        "maturities": maturities,
        "bond_prices": bond_prices,
        "zero_rates": zero_rates,
    }


def vasicek_mean_and_variance(
    r0: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
) -> tuple[float, float]:
    """Analytical mean and variance of r(T) under Vasicek.

    E[r(T)] = r0 * exp(-kappa*T) + theta * (1 - exp(-kappa*T))
    Var[r(T)] = sigma^2 / (2*kappa) * (1 - exp(-2*kappa*T))
    """
    mean = r0 * math.exp(-kappa * T) + theta * (1.0 - math.exp(-kappa * T))
    var = sigma ** 2 / (2.0 * kappa) * (1.0 - math.exp(-2.0 * kappa * T))
    return mean, var
