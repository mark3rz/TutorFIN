"""Cox-Ingersoll-Ross (CIR) short-rate model.

SDE:  dr = kappa * (theta - r) * dt + sigma * sqrt(r) * dW

Properties:
- Mean-reverting with level-dependent volatility
- Rates are strictly positive when 2*kappa*theta >= sigma^2 (Feller condition)
- Non-central chi-squared transition distribution
- Analytical bond prices available
- More realistic than Vasicek for modelling positive interest rates

Parameters:
    kappa  (float): Speed of mean reversion (> 0)
    theta  (float): Long-run mean rate (> 0)
    sigma  (float): Vol-of-vol coefficient (> 0)
    r0     (float): Initial short rate (> 0)
"""

from __future__ import annotations

import math

import numpy as np


def feller_condition(kappa: float, theta: float, sigma: float) -> bool:
    """Check whether the Feller condition 2*kappa*theta >= sigma^2 holds.

    When satisfied, the CIR process is strictly positive (boundary at 0 is
    unattainable).
    """
    return 2.0 * kappa * theta >= sigma ** 2


def simulate_cir(
    r0: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
    n_steps: int = 252,
    n_paths: int = 100,
    seed: int | None = None,
) -> dict:
    """Simulate CIR short-rate paths using the full-truncation Euler scheme.

    The full-truncation method applies max(r, 0) inside the drift and
    diffusion to ensure non-negative rates, which has been shown to have
    superior convergence properties for the CIR process.

    Returns
    -------
    dict with keys:
        times       : list[float] — time grid
        paths       : list[list[float]] — visualisation paths
        mean_path   : list[float] — cross-path mean
        std_path    : list[float] — cross-path std
        terminal    : list[float] — terminal rates
        feller_satisfied : bool — whether 2*kappa*theta >= sigma^2
    """
    if kappa <= 0:
        raise ValueError("kappa must be positive")
    if theta <= 0:
        raise ValueError("theta must be positive for CIR")
    if sigma <= 0:
        raise ValueError("sigma must be positive")
    if r0 < 0:
        raise ValueError("r0 must be non-negative for CIR")
    if T <= 0:
        raise ValueError("T must be positive")

    rng = np.random.default_rng(seed)
    dt = T / n_steps
    sqrt_dt = math.sqrt(dt)
    times = [i * dt for i in range(n_steps + 1)]

    rates = np.zeros((n_paths, n_steps + 1))
    rates[:, 0] = r0

    for t in range(n_steps):
        r_pos = np.maximum(rates[:, t], 0.0)
        z = rng.standard_normal(n_paths)
        rates[:, t + 1] = (
            rates[:, t]
            + kappa * (theta - r_pos) * dt
            + sigma * np.sqrt(r_pos) * sqrt_dt * z
        )
        # Ensure non-negativity
        rates[:, t + 1] = np.maximum(rates[:, t + 1], 0.0)

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
        "feller_satisfied": feller_condition(kappa, theta, sigma),
    }


def cir_bond_price(
    r: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
) -> float:
    """Analytical zero-coupon bond price P(0, T) under the CIR model.

    P(0, T) = A(T) * exp(-B(T) * r)

    where:
        gamma = sqrt(kappa^2 + 2*sigma^2)
        B(T) = 2*(exp(gamma*T) - 1) / ((gamma + kappa)*(exp(gamma*T) - 1) + 2*gamma)
        A(T) = [2*gamma * exp((kappa + gamma)*T/2) /
                ((gamma + kappa)*(exp(gamma*T) - 1) + 2*gamma)]^(2*kappa*theta / sigma^2)
    """
    if kappa <= 0:
        raise ValueError("kappa must be positive")
    if T <= 0:
        raise ValueError("T must be positive")

    gamma = math.sqrt(kappa ** 2 + 2.0 * sigma ** 2)
    exp_gT = math.exp(gamma * T)
    denom = (gamma + kappa) * (exp_gT - 1.0) + 2.0 * gamma

    B = 2.0 * (exp_gT - 1.0) / denom

    exponent = 2.0 * kappa * theta / sigma ** 2
    A_base = 2.0 * gamma * math.exp((kappa + gamma) * T / 2.0) / denom
    A = A_base ** exponent

    return A * math.exp(-B * r)


def cir_zero_rate(
    r: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
) -> float:
    """Implied continuously-compounded zero rate: R(T) = -ln(P(T)) / T."""
    P = cir_bond_price(r, kappa, theta, sigma, T)
    return -math.log(P) / T


def cir_yield_curve(
    r: float,
    kappa: float,
    theta: float,
    sigma: float,
    maturities: list[float] | None = None,
) -> dict:
    """Compute the full yield curve implied by the CIR model."""
    if maturities is None:
        maturities = [0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 7.0, 10.0, 15.0, 20.0, 30.0]

    bond_prices = [cir_bond_price(r, kappa, theta, sigma, t) for t in maturities]
    zero_rates = [cir_zero_rate(r, kappa, theta, sigma, t) for t in maturities]

    return {
        "maturities": maturities,
        "bond_prices": bond_prices,
        "zero_rates": zero_rates,
    }


def cir_mean_and_variance(
    r0: float,
    kappa: float,
    theta: float,
    sigma: float,
    T: float,
) -> tuple[float, float]:
    """Analytical mean and variance of r(T) under CIR.

    E[r(T)]   = r0 * exp(-kappa*T) + theta * (1 - exp(-kappa*T))
    Var[r(T)] = r0 * sigma^2/kappa * (exp(-kappa*T) - exp(-2*kappa*T))
                + theta * sigma^2/(2*kappa) * (1 - exp(-kappa*T))^2
    """
    e_neg = math.exp(-kappa * T)
    mean = r0 * e_neg + theta * (1.0 - e_neg)

    var = (
        r0 * sigma ** 2 / kappa * (e_neg - math.exp(-2.0 * kappa * T))
        + theta * sigma ** 2 / (2.0 * kappa) * (1.0 - e_neg) ** 2
    )
    return mean, var
