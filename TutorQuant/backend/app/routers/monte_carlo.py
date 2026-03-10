"""Monte Carlo simulation router.

Endpoint
--------
POST /api/monte-carlo/simulate -- Run a Monte Carlo simulation to price an
                                  option under GBM dynamics.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from schemas.simulation import (
    ConvergenceDiagnostics,
    MonteCarloRequest,
    MonteCarloResponse,
    PathData,
)
from engine.simulation.gbm import price_option_mc

router = APIRouter(prefix="/api/monte-carlo", tags=["Monte Carlo"])


@router.post("/simulate", response_model=MonteCarloResponse)
async def simulate(request: MonteCarloRequest) -> MonteCarloResponse:
    """Run a Monte Carlo simulation to price the given option.

    Uses GBM dynamics by default.  The ``simulation_config`` in the request
    controls path count, step count, seed, and antithetic variates.
    """
    cfg = request.simulation_config

    t0 = time.perf_counter()
    try:
        result = price_option_mc(
            S0=request.option.spot,
            K=request.option.strike,
            r=request.risk_free_rate,
            sigma=request.volatility,
            T=request.option.expiry_years,
            option_type=request.option.option_type.value,
            num_paths=cfg.num_paths,
            num_steps=cfg.num_steps,
            q=request.option.dividend_yield,
            seed=cfg.seed,
            antithetic=cfg.antithetic,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # Limit path_fan to at most 20 paths
    path_fan = result["paths"]["path_fan"][:20]

    return MonteCarloResponse(
        price=result["price"],
        std_error=result["std_error"],
        confidence_interval_95=result["confidence_interval_95"],
        paths=PathData(
            representative_path=result["paths"]["representative_path"],
            path_fan=path_fan,
            terminal_values=result["paths"]["terminal_values"],
        ),
        convergence=ConvergenceDiagnostics(
            running_mean=result["convergence"]["running_mean"],
            running_std=result["convergence"]["running_std"],
            confidence_interval_95=result["convergence"]["confidence_interval_95"],
        ),
        computation_time_ms=round(elapsed_ms, 4),
    )
