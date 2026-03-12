"""Calibration framework — base interfaces and shared utilities.

Calibration architecture:
  1. CalibrationProblem — defines the objective, parameters, and constraints
  2. CalibrationResult — standardised output with params, diagnostics, errors
  3. Objective functions — RMSE, MAPE, weighted-SSE, etc.
  4. Parameter constraints — bounds, fixed params, regularisation

The framework is designed so that any model can be calibrated by:
  1. Defining a model function  f(x; params) -> y_model
  2. Providing market data      (x_market, y_market)
  3. Specifying constraints      (bounds, initial guess)
  4. Choosing an objective        (RMSE, MAPE, etc.)

Then calling:  result = calibrate(problem)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
from scipy.optimize import minimize, differential_evolution


@dataclass
class ParameterSpec:
    """Specification for a single calibration parameter.

    Attributes
    ----------
    name : str
        Parameter name (for display and result mapping).
    initial : float
        Initial guess.
    lower : float
        Lower bound.
    upper : float
        Upper bound.
    fixed : bool
        If True, parameter is held at its initial value.
    """

    name: str
    initial: float
    lower: float = -np.inf
    upper: float = np.inf
    fixed: bool = False


@dataclass
class CalibrationResult:
    """Standardised calibration output.

    Attributes
    ----------
    params : dict[str, float]
        Calibrated parameter values.
    objective_value : float
        Final value of the objective function.
    iterations : int
        Number of optimiser iterations.
    converged : bool
        Whether the optimiser converged.
    elapsed_ms : float
        Wall-clock time in milliseconds.
    residuals : list[float]
        Per-observation residuals (model - market).
    diagnostics : dict
        Error metrics and diagnostics.
    method : str
        Optimisation method used.
    """

    params: dict[str, float]
    objective_value: float
    iterations: int
    converged: bool
    elapsed_ms: float
    residuals: list[float]
    diagnostics: dict
    method: str


def compute_diagnostics(
    residuals: np.ndarray,
    market_values: np.ndarray,
) -> dict:
    """Compute calibration error diagnostics from residuals.

    Parameters
    ----------
    residuals : array
        model_values - market_values (signed).
    market_values : array
        Observed market data.

    Returns
    -------
    dict with keys:
        rmse         : Root mean squared error
        mae          : Mean absolute error
        mape         : Mean absolute percentage error (if market > 0)
        max_abs_err  : Maximum absolute error
        sse          : Sum of squared errors
        r_squared    : Coefficient of determination
        n_obs        : Number of observations
    """
    n = len(residuals)
    if n == 0:
        return {
            "rmse": 0.0, "mae": 0.0, "mape": 0.0,
            "max_abs_err": 0.0, "sse": 0.0, "r_squared": 0.0, "n_obs": 0,
        }

    abs_res = np.abs(residuals)
    sse = float(np.sum(residuals ** 2))
    rmse = float(np.sqrt(sse / n))
    mae = float(np.mean(abs_res))
    max_abs = float(np.max(abs_res))

    # MAPE — only for positive market values
    mask = market_values > 1e-10
    if np.any(mask):
        mape = float(np.mean(abs_res[mask] / market_values[mask]) * 100)
    else:
        mape = 0.0

    # R-squared
    ss_tot = float(np.sum((market_values - np.mean(market_values)) ** 2))
    r_squared = 1.0 - sse / ss_tot if ss_tot > 0 else 0.0

    return {
        "rmse": round(rmse, 8),
        "mae": round(mae, 8),
        "mape": round(mape, 4),
        "max_abs_err": round(max_abs, 8),
        "sse": round(sse, 8),
        "r_squared": round(r_squared, 6),
        "n_obs": n,
    }


def calibrate(
    model_fn: Callable[[np.ndarray, np.ndarray], np.ndarray],
    x_data: np.ndarray,
    y_market: np.ndarray,
    param_specs: list[ParameterSpec],
    objective: str = "rmse",
    method: str = "L-BFGS-B",
    weights: np.ndarray | None = None,
) -> CalibrationResult:
    """Generic calibration engine.

    Parameters
    ----------
    model_fn : callable
        Function(params_array, x_data) -> y_model_array.
        params_array contains only free (non-fixed) parameters.
    x_data : np.ndarray
        Input data points (independent variables).
    y_market : np.ndarray
        Observed market data (dependent variables).
    param_specs : list[ParameterSpec]
        Parameter specifications with bounds and initial values.
    objective : str
        Objective function: "rmse", "sse", "mape", "wsse" (weighted SSE).
    method : str
        Scipy optimiser: "L-BFGS-B", "Nelder-Mead", "differential_evolution".
    weights : np.ndarray | None
        Per-observation weights for "wsse" objective.

    Returns
    -------
    CalibrationResult
    """
    # Separate free and fixed parameters
    free_specs = [p for p in param_specs if not p.fixed]
    fixed_specs = [p for p in param_specs if p.fixed]

    x0 = np.array([p.initial for p in free_specs])
    bounds = [(p.lower, p.upper) for p in free_specs]

    # Build the full parameter vector from free + fixed
    def _full_params(free_values: np.ndarray) -> np.ndarray:
        full = np.zeros(len(param_specs))
        free_idx = 0
        for i, spec in enumerate(param_specs):
            if spec.fixed:
                full[i] = spec.initial
            else:
                full[i] = free_values[free_idx]
                free_idx += 1
        return full

    # Objective function
    def _objective(free_values: np.ndarray) -> float:
        params = _full_params(free_values)
        y_model = model_fn(params, x_data)
        residuals = y_model - y_market

        if objective == "rmse":
            return float(np.sqrt(np.mean(residuals ** 2)))
        elif objective == "sse":
            return float(np.sum(residuals ** 2))
        elif objective == "mape":
            mask = np.abs(y_market) > 1e-10
            if np.any(mask):
                return float(np.mean(np.abs(residuals[mask] / y_market[mask])))
            return float(np.sqrt(np.mean(residuals ** 2)))
        elif objective == "wsse":
            w = weights if weights is not None else np.ones_like(residuals)
            return float(np.sum(w * residuals ** 2))
        else:
            return float(np.sqrt(np.mean(residuals ** 2)))

    # Run optimisation
    t0 = time.perf_counter()

    if method == "differential_evolution":
        result = differential_evolution(
            _objective,
            bounds=bounds,
            maxiter=500,
            tol=1e-10,
            seed=42,
        )
        iterations = result.nit
        converged = result.success
        optimal = result.x
    else:
        result = minimize(
            _objective,
            x0=x0,
            method=method,
            bounds=bounds if method in ("L-BFGS-B", "TNC", "SLSQP") else None,
            options={"maxiter": 1000, "ftol": 1e-12, "gtol": 1e-8},
        )
        iterations = result.nit if hasattr(result, "nit") else 0
        converged = result.success
        optimal = result.x

    elapsed = (time.perf_counter() - t0) * 1000

    # Final evaluation
    final_params = _full_params(optimal)
    y_model = model_fn(final_params, x_data)
    residuals = y_model - y_market
    diagnostics = compute_diagnostics(residuals, y_market)

    # Map to named parameters
    param_dict = {}
    for i, spec in enumerate(param_specs):
        param_dict[spec.name] = round(float(final_params[i]), 8)

    return CalibrationResult(
        params=param_dict,
        objective_value=round(float(_objective(optimal)), 10),
        iterations=iterations,
        converged=converged,
        elapsed_ms=round(elapsed, 2),
        residuals=[round(float(r), 8) for r in residuals],
        diagnostics=diagnostics,
        method=method,
    )
