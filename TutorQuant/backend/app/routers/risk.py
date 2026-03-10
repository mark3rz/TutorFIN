"""Risk analytics router: P&L explain, scenario grids, model comparison, hedging.

Endpoints
---------
POST /api/risk/pnl-explain        -- Greek-based P&L decomposition
POST /api/risk/scenario-grid      -- Spot × vol P&L heatmap data
POST /api/risk/model-comparison   -- Compare prices across models
POST /api/risk/hedging-sim        -- Discrete hedging error simulation
"""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from schemas.risk import (
    PnlExplainRequest,
    PnlExplainResponse,
    ScenarioGridRequest,
    ScenarioGridResponse,
    ModelComparisonRequest,
    ModelComparisonResponse,
    ModelComparisonResult,
    HedgingSimRequest,
    HedgingSimResponse,
    HedgingPathResult,
)

from engine.risk.pnl_explain import pnl_explain, scenario_grid
from engine.risk.hedging import simulate_hedge

# Ensure tree models are registered
import engine.models.black_scholes  # noqa: F401
import engine.models.binomial  # noqa: F401
import engine.models.trinomial  # noqa: F401
from registry.model_registry import pricing_model_registry

router = APIRouter(prefix="/api/risk", tags=["Risk"])


# ── P&L Explain ──────────────────────────────────────────────────────────────

@router.post("/pnl-explain", response_model=PnlExplainResponse)
async def compute_pnl_explain(request: PnlExplainRequest) -> PnlExplainResponse:
    """Decompose option P&L into delta, gamma, vega, theta contributions."""
    try:
        result = pnl_explain(
            S=request.option.spot,
            K=request.option.strike,
            T=request.option.expiry_years,
            r=request.risk_free_rate,
            sigma=request.volatility,
            q=request.option.dividend_yield,
            option_type=request.option.option_type.value,
            dS=request.dS,
            dsigma=request.dsigma,
            dt=request.dt,
            position_size=request.position_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return PnlExplainResponse(**result)


# ── Scenario Grid ────────────────────────────────────────────────────────────

@router.post("/scenario-grid", response_model=ScenarioGridResponse)
async def compute_scenario_grid(request: ScenarioGridRequest) -> ScenarioGridResponse:
    """Compute a P&L grid across spot and vol shocks for heatmap display."""
    try:
        result = scenario_grid(
            S=request.option.spot,
            K=request.option.strike,
            T=request.option.expiry_years,
            r=request.risk_free_rate,
            sigma=request.volatility,
            q=request.option.dividend_yield,
            option_type=request.option.option_type.value,
            spot_shocks=request.spot_shocks,
            vol_shocks=request.vol_shocks,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ScenarioGridResponse(**result)


# ── Model Comparison ─────────────────────────────────────────────────────────

@router.post("/model-comparison", response_model=ModelComparisonResponse)
async def compare_models(request: ModelComparisonRequest) -> ModelComparisonResponse:
    """Price an option using multiple models and compare the results."""
    results: list[ModelComparisonResult] = []

    market_data = {
        "risk_free_rate": request.risk_free_rate,
        "volatility": request.volatility,
        "steps": request.steps,
    }

    for model_key in request.models:
        try:
            engine_cls = pricing_model_registry.get(model_key)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        engine = engine_cls()

        t0 = time.perf_counter()
        try:
            engine.validate(request.option)
            price = engine.price(request.option, market_data)
        except ValueError as exc:
            # Model doesn't support this exercise style — skip gracefully
            results.append(ModelComparisonResult(
                model=model_key,
                model_name=engine.name,
                price=float("nan"),
                computation_time_ms=0.0,
                metadata={"error": str(exc)},
            ))
            continue
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        results.append(ModelComparisonResult(
            model=model_key,
            model_name=engine.name,
            price=price,
            computation_time_ms=round(elapsed_ms, 4),
        ))

    return ModelComparisonResponse(results=results)


# ── Hedging Error Simulation ─────────────────────────────────────────────────

@router.post("/hedging-sim", response_model=HedgingSimResponse)
async def run_hedging_sim(request: HedgingSimRequest) -> HedgingSimResponse:
    """Simulate discrete delta-hedging with transaction costs."""
    try:
        result = simulate_hedge(
            S=request.option.spot,
            K=request.option.strike,
            T=request.option.expiry_years,
            r=request.risk_free_rate,
            sigma=request.volatility,
            q=request.option.dividend_yield,
            option_type=request.option.option_type.value,
            rebalance_steps=request.rebalance_steps,
            transaction_cost_rate=request.transaction_cost_rate,
            seed=request.seed,
            num_paths=request.num_paths,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    paths = [HedgingPathResult(**p) for p in result["paths"]]

    return HedgingSimResponse(
        bsm_price=result["bsm_price"],
        paths=paths,
        summary=result["summary"],
        rebalance_steps=result["rebalance_steps"],
        transaction_cost_rate=result["transaction_cost_rate"],
    )
