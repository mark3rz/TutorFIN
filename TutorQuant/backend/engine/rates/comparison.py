"""Model comparison layer for short-rate models.

Provides unified simulation interface, yield curve comparison, and a
structured comparison table with model properties.
"""

from __future__ import annotations

from engine.rates.vasicek import (
    simulate_vasicek,
    vasicek_yield_curve,
    vasicek_bond_price,
)
from engine.rates.cir import (
    simulate_cir,
    cir_yield_curve,
    cir_bond_price,
    feller_condition,
)
from engine.rates.hull_white import (
    simulate_hull_white,
    hull_white_yield_curve,
    hull_white_bond_price,
)


# ── Unified simulation dispatch ──────────────────────────────────────────────

def simulate_model(
    model: str,
    r0: float,
    params: dict,
    T: float = 1.0,
    n_steps: int = 252,
    n_paths: int = 100,
    seed: int | None = None,
) -> dict:
    """Dispatch simulation to the appropriate model engine.

    Parameters
    ----------
    model : str
        One of 'vasicek', 'cir', 'hull_white'.
    r0 : float
        Initial short rate.
    params : dict
        Model-specific parameters.
    T : float
        Simulation horizon in years.
    n_steps : int
        Number of time steps.
    n_paths : int
        Number of Monte Carlo paths.
    seed : int | None
        Random seed for reproducibility.

    Returns
    -------
    dict with model simulation results.
    """
    model = model.lower().replace("-", "_")

    if model == "vasicek":
        kappa = params.get("kappa", 0.5)
        theta = params.get("theta", 0.04)
        sigma = params.get("sigma", 0.01)
        result = simulate_vasicek(r0, kappa, theta, sigma, T, n_steps, n_paths, seed)
        result["model"] = "vasicek"
        return result

    elif model == "cir":
        kappa = params.get("kappa", 0.5)
        theta = params.get("theta", 0.04)
        sigma = params.get("sigma", 0.05)
        result = simulate_cir(r0, kappa, theta, sigma, T, n_steps, n_paths, seed)
        result["model"] = "cir"
        return result

    elif model == "hull_white":
        a = params.get("a", 0.5)
        sigma = params.get("sigma", 0.01)
        theta_hw = params.get("theta_hw", 0.02)
        result = simulate_hull_white(r0, a, sigma, theta_hw, T, n_steps, n_paths, seed)
        result["model"] = "hull_white"
        return result

    else:
        raise ValueError(f"Unknown rate model: {model}. Supported: vasicek, cir, hull_white")


# ── Unified yield curve dispatch ─────────────────────────────────────────────

def model_yield_curve(
    model: str,
    r0: float,
    params: dict,
    maturities: list[float] | None = None,
) -> dict:
    """Get analytical yield curve from the specified model.

    Returns dict with maturities, bond_prices, zero_rates.
    """
    model = model.lower().replace("-", "_")

    if model == "vasicek":
        return vasicek_yield_curve(
            r0,
            params.get("kappa", 0.5),
            params.get("theta", 0.04),
            params.get("sigma", 0.01),
            maturities,
        )

    elif model == "cir":
        return cir_yield_curve(
            r0,
            params.get("kappa", 0.5),
            params.get("theta", 0.04),
            params.get("sigma", 0.05),
            maturities,
        )

    elif model == "hull_white":
        return hull_white_yield_curve(
            r0,
            params.get("a", 0.5),
            params.get("sigma", 0.01),
            params.get("theta_hw", 0.02),
            maturities,
        )

    else:
        raise ValueError(f"Unknown rate model: {model}")


# ── Model comparison table ───────────────────────────────────────────────────

MODEL_PROPERTIES = {
    "vasicek": {
        "name": "Vasicek",
        "sde": "dr = \\kappa(\\theta - r)\\,dt + \\sigma\\,dW",
        "mean_reversion": "Yes, constant speed kappa",
        "positivity": "No — rates can go negative (Gaussian process)",
        "volatility_structure": "Constant — independent of rate level",
        "analytical_bond_price": True,
        "practical_intuition": "Simplest mean-reverting model. Good for understanding fundamentals. Negative rates can be a feature or a bug.",
        "common_use_cases": "Teaching, quick analytics, negative-rate environments (EUR, JPY)",
        "limitations": "Constant vol unrealistic; negative rates in most markets are edge cases",
        "distribution": "Normal (Gaussian)",
    },
    "cir": {
        "name": "Cox-Ingersoll-Ross",
        "sde": "dr = \\kappa(\\theta - r)\\,dt + \\sigma\\sqrt{r}\\,dW",
        "mean_reversion": "Yes, constant speed kappa",
        "positivity": "Yes — when Feller condition (2*kappa*theta >= sigma^2) is satisfied",
        "volatility_structure": "Level-dependent — proportional to sqrt(r)",
        "analytical_bond_price": True,
        "practical_intuition": "Rates stay positive and volatility increases with rate level, matching empirical observations.",
        "common_use_cases": "Positive-rate modelling, credit-spread dynamics, real-world scenario generation",
        "limitations": "Cannot fit arbitrary yield curves; Feller condition constrains parameters",
        "distribution": "Non-central chi-squared",
    },
    "hull_white": {
        "name": "Hull-White (Extended Vasicek)",
        "sde": "dr = [\\theta(t) - a\\,r]\\,dt + \\sigma\\,dW",
        "mean_reversion": "Yes, speed a with time-dependent target theta(t)",
        "positivity": "No — Gaussian (like Vasicek)",
        "volatility_structure": "Constant — independent of rate level",
        "analytical_bond_price": True,
        "practical_intuition": "Most popular one-factor model. Time-dependent theta(t) allows perfect fit to the initial yield curve.",
        "common_use_cases": "Swaption pricing, interest-rate derivatives, regulatory capital models",
        "limitations": "Gaussian process, no vol skew, one factor only",
        "distribution": "Normal (Gaussian)",
    },
}


def get_model_comparison() -> list[dict]:
    """Return structured comparison data for all supported models."""
    return [
        {"model_id": k, **v}
        for k, v in MODEL_PROPERTIES.items()
    ]


def compare_yield_curves(
    r0: float,
    models_and_params: list[dict],
    maturities: list[float] | None = None,
) -> list[dict]:
    """Compare yield curves from multiple models.

    Parameters
    ----------
    r0 : float
        Common initial rate.
    models_and_params : list[dict]
        Each entry: {"model": "vasicek", "params": {...}, "label": "..."}
    maturities : list[float] | None
        Maturity grid.

    Returns
    -------
    list of dicts, each with model, label, maturities, bond_prices, zero_rates.
    """
    results = []
    for entry in models_and_params:
        model = entry["model"]
        params = entry.get("params", {})
        label = entry.get("label", model)

        curve = model_yield_curve(model, r0, params, maturities)
        curve["model"] = model
        curve["label"] = label
        results.append(curve)

    return results
