"""Short-rate / term-structure model simulation router.

Endpoints for simulating Vasicek, CIR, and Hull-White models, computing
analytical yield curves, and comparing model properties.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from engine.rates.comparison import (
    simulate_model,
    model_yield_curve,
    get_model_comparison,
    compare_yield_curves,
)
from schemas.rates import (
    RateModelRequest,
    RateModelResponse,
    YieldCurveFromModelRequest,
    YieldCurveFromModelResponse,
    ModelComparisonResponse,
    ModelComparisonEntry,
    CompareCurvesRequest,
    CompareCurvesResponse,
    CurveComparisonSeries,
)

router = APIRouter(prefix="/api/rates", tags=["Rates"])


# ── Simulate ─────────────────────────────────────────────────────────────────

@router.post("/simulate", response_model=RateModelResponse)
async def simulate_rates(request: RateModelRequest) -> RateModelResponse:
    """Simulate interest-rate paths under the chosen short-rate model."""
    try:
        # Extract simulation config
        n_steps = 252
        n_paths = 100
        seed = None
        if request.simulation_config:
            n_steps = request.simulation_config.num_steps
            n_paths = request.simulation_config.num_paths
            seed = request.simulation_config.seed

        result = simulate_model(
            model=request.model.value,
            r0=request.r0,
            params=request.params,
            T=request.horizon_years,
            n_steps=n_steps,
            n_paths=n_paths,
            seed=seed,
        )

        return RateModelResponse(
            model=result["model"],
            times=result["times"],
            paths=result["paths"],
            mean_rate=result["mean_path"],
            std_rate=result["std_path"],
            terminal_distribution=result["terminal"],
            metadata={
                k: v
                for k, v in result.items()
                if k not in ("model", "times", "paths", "mean_path", "std_path", "terminal")
            } or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Analytical Yield Curve ───────────────────────────────────────────────────

@router.post("/yield-curve", response_model=YieldCurveFromModelResponse)
async def get_yield_curve(request: YieldCurveFromModelRequest) -> YieldCurveFromModelResponse:
    """Compute the analytical yield curve implied by a rate model."""
    try:
        result = model_yield_curve(
            model=request.model.value,
            r0=request.r0,
            params=request.params,
            maturities=request.maturities,
        )
        return YieldCurveFromModelResponse(
            model=request.model.value,
            maturities=result["maturities"],
            bond_prices=result["bond_prices"],
            zero_rates=result["zero_rates"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Model Comparison Table ───────────────────────────────────────────────────

@router.get("/comparison", response_model=ModelComparisonResponse)
async def get_model_comparison_table() -> ModelComparisonResponse:
    """Return a structured comparison of all supported rate models."""
    entries = get_model_comparison()
    return ModelComparisonResponse(
        models=[ModelComparisonEntry(**e) for e in entries]
    )


# ── Multi-Model Curve Comparison ─────────────────────────────────────────────

@router.post("/compare-curves", response_model=CompareCurvesResponse)
async def compare_model_curves(request: CompareCurvesRequest) -> CompareCurvesResponse:
    """Compare yield curves from multiple models side by side."""
    try:
        models_and_params = [
            {
                "model": m.model.value,
                "params": m.params,
                "label": m.label or m.model.value,
            }
            for m in request.models
        ]
        results = compare_yield_curves(
            r0=request.r0,
            models_and_params=models_and_params,
            maturities=request.maturities,
        )
        return CompareCurvesResponse(
            series=[
                CurveComparisonSeries(
                    model=r["model"],
                    label=r["label"],
                    maturities=r["maturities"],
                    bond_prices=r["bond_prices"],
                    zero_rates=r["zero_rates"],
                )
                for r in results
            ]
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
