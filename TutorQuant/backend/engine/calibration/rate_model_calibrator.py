"""Rate model calibration engine.

Calibrates short-rate model parameters to match an observed yield curve
(zero rates or bond prices at standard tenors).

Supported models:
  - Vasicek: calibrate (kappa, theta, sigma) to match zero rates
  - CIR:     calibrate (kappa, theta, sigma) to match zero rates
  - Hull-White: calibrate (a, sigma) to match zero rates (theta_hw derived)

The objective is to minimise the squared error between the model-implied
zero rates and the observed zero rates across a set of maturities.
"""

from __future__ import annotations

import numpy as np

from engine.calibration.framework import (
    ParameterSpec,
    calibrate,
    compute_diagnostics,
)
from engine.rates.vasicek import vasicek_zero_rate
from engine.rates.cir import cir_zero_rate
from engine.rates.hull_white import hull_white_zero_rate


def calibrate_vasicek(
    maturities: list[float],
    target_rates: list[float],
    r0: float = 0.04,
    method: str = "L-BFGS-B",
) -> dict:
    """Calibrate Vasicek model to observed zero rates.

    Parameters
    ----------
    maturities : list[float]
        Maturity grid (years).
    target_rates : list[float]
        Observed zero rates at each maturity.
    r0 : float
        Current short rate.
    method : str
        Optimiser method.

    Returns
    -------
    dict with calibrated params, diagnostics, fitted rates, residuals.
    """
    mat = np.array(maturities)
    target = np.array(target_rates)

    def model_fn(params: np.ndarray, x: np.ndarray) -> np.ndarray:
        kappa, theta, sigma = params
        kappa = max(kappa, 1e-6)
        sigma = max(sigma, 1e-6)
        return np.array([
            vasicek_zero_rate(r0, kappa, theta, sigma, float(t))
            for t in x
        ])

    param_specs = [
        ParameterSpec("kappa", initial=0.5, lower=0.01, upper=5.0),
        ParameterSpec("theta", initial=target[-1], lower=-0.05, upper=0.20),
        ParameterSpec("sigma", initial=0.01, lower=0.0001, upper=0.10),
    ]

    result = calibrate(
        model_fn=model_fn,
        x_data=mat,
        y_market=target,
        param_specs=param_specs,
        objective="sse",
        method=method,
    )

    fitted = model_fn(
        np.array([result.params["kappa"], result.params["theta"], result.params["sigma"]]),
        mat,
    )

    return {
        "model": "vasicek",
        "params": result.params,
        "r0": r0,
        "maturities": maturities,
        "target_rates": target_rates,
        "fitted_rates": [round(float(v), 8) for v in fitted],
        "residuals": [round(float(r), 8) for r in (fitted - target)],
        "diagnostics": result.diagnostics,
        "converged": result.converged,
        "elapsed_ms": result.elapsed_ms,
        "iterations": result.iterations,
        "method": result.method,
    }


def calibrate_cir(
    maturities: list[float],
    target_rates: list[float],
    r0: float = 0.04,
    method: str = "L-BFGS-B",
) -> dict:
    """Calibrate CIR model to observed zero rates."""
    mat = np.array(maturities)
    target = np.array(target_rates)

    def model_fn(params: np.ndarray, x: np.ndarray) -> np.ndarray:
        kappa, theta, sigma = params
        kappa = max(kappa, 1e-6)
        theta = max(theta, 1e-6)
        sigma = max(sigma, 1e-6)
        return np.array([
            cir_zero_rate(r0, kappa, theta, sigma, float(t))
            for t in x
        ])

    param_specs = [
        ParameterSpec("kappa", initial=0.5, lower=0.01, upper=5.0),
        ParameterSpec("theta", initial=max(target[-1], 0.001), lower=0.001, upper=0.20),
        ParameterSpec("sigma", initial=0.05, lower=0.001, upper=0.50),
    ]

    result = calibrate(
        model_fn=model_fn,
        x_data=mat,
        y_market=target,
        param_specs=param_specs,
        objective="sse",
        method=method,
    )

    fitted = model_fn(
        np.array([result.params["kappa"], result.params["theta"], result.params["sigma"]]),
        mat,
    )

    return {
        "model": "cir",
        "params": result.params,
        "r0": r0,
        "maturities": maturities,
        "target_rates": target_rates,
        "fitted_rates": [round(float(v), 8) for v in fitted],
        "residuals": [round(float(r), 8) for r in (fitted - target)],
        "diagnostics": result.diagnostics,
        "converged": result.converged,
        "elapsed_ms": result.elapsed_ms,
        "iterations": result.iterations,
        "method": result.method,
    }


def calibrate_rate_model(
    model: str,
    maturities: list[float],
    target_rates: list[float],
    r0: float = 0.04,
    method: str = "L-BFGS-B",
) -> dict:
    """Dispatch rate model calibration to the appropriate engine.

    Parameters
    ----------
    model : str
        "vasicek" or "cir".
    """
    model = model.lower().replace("-", "_")

    if model == "vasicek":
        return calibrate_vasicek(maturities, target_rates, r0, method)
    elif model == "cir":
        return calibrate_cir(maturities, target_rates, r0, method)
    else:
        raise ValueError(f"Unsupported rate model for calibration: {model}")
