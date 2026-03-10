"""Portfolio analytics router.

Endpoints
---------
POST /api/portfolio/analyze   -- Full portfolio valuation, Greeks aggregation, VaR/ES.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from schemas.risk import (
    PortfolioAnalyticsRequest,
    PortfolioAnalyticsResponse,
)
from engine.risk.portfolio import (
    value_portfolio,
    parametric_var_es,
    monte_carlo_var_es,
)

router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])


@router.post("/analyze", response_model=PortfolioAnalyticsResponse)
async def analyze_portfolio(request: PortfolioAnalyticsRequest) -> PortfolioAnalyticsResponse:
    """Compute portfolio-level valuation, Greeks, VaR, and ES."""
    t0 = time.perf_counter()

    # Convert positions to engine format
    positions = []
    for pos in request.positions:
        positions.append({
            "instrument_id": pos.instrument_id,
            "instrument_type": pos.instrument_type,
            "quantity": pos.quantity,
            "side": pos.side,
            "spot": pos.spot,
            "strike": pos.strike,
            "expiry_years": pos.expiry_years,
            "option_type": pos.option_type,
            "dividend_yield": pos.dividend_yield,
        })

    try:
        # Value portfolio and aggregate Greeks
        valuation = value_portfolio(
            positions=positions,
            r=request.risk_free_rate,
            sigma_default=request.volatility,
            vol_overrides=request.vol_overrides,
        )

        # Compute VaR and ES
        risk_metrics = valuation["risk_metrics"]
        pnl_distribution = None

        if request.var_method == "parametric":
            # Get representative spot from first option position
            S = positions[0]["spot"] if positions else 100.0
            var_result = parametric_var_es(
                portfolio_delta=risk_metrics["total_delta"],
                portfolio_gamma=risk_metrics["total_gamma"],
                S=S,
                sigma=request.volatility,
                r=request.risk_free_rate,
                holding_days=request.holding_days,
                confidence=request.confidence,
            )
            var_val = var_result["var"]
            es_val = var_result["es"]
            var_method = var_result["method"]
        elif request.var_method == "monte_carlo":
            mc_result = monte_carlo_var_es(
                positions=positions,
                r=request.risk_free_rate,
                sigma_default=request.volatility,
                holding_days=request.holding_days,
                confidence=request.confidence,
                num_scenarios=request.num_scenarios,
                seed=request.seed,
                vol_overrides=request.vol_overrides,
            )
            var_val = mc_result["var"]
            es_val = mc_result["es"]
            var_method = mc_result["method"]
            pnl_distribution = mc_result["pnl_distribution"]
        else:
            raise ValueError(f"Unknown VaR method: {request.var_method}")

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    return PortfolioAnalyticsResponse(
        total_value=valuation["total_value"],
        positions_valued=valuation["positions_valued"],
        risk_metrics=risk_metrics,
        var=var_val,
        es=es_val,
        var_method=var_method,
        pnl_distribution=pnl_distribution,
        metadata={"computation_time_ms": round(elapsed_ms, 4)},
    )
