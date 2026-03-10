"""Greeks computation router.

Endpoint
--------
POST /api/greeks/compute -- Compute option Greeks using the specified model
                            and method.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from schemas.greeks import GreeksMethod, GreeksRequest, GreeksResponse
from engine.greeks.analytical import bsm_greeks

router = APIRouter(prefix="/api/greeks", tags=["Greeks"])


@router.post("/compute", response_model=GreeksResponse)
async def compute_greeks(request: GreeksRequest) -> GreeksResponse:
    """Compute option Greeks using the specified model and method.

    Currently supports analytical BSM Greeks.  Finite-difference and other
    model-specific methods will be added in subsequent phases.
    """
    method = request.method

    if method == GreeksMethod.ANALYTICAL:
        t0 = time.perf_counter()
        try:
            greeks = bsm_greeks(
                S=request.option.spot,
                K=request.option.strike,
                T=request.option.expiry_years,
                r=request.risk_free_rate,
                sigma=request.volatility,
                q=request.option.dividend_yield,
                option_type=request.option.option_type.value,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        return GreeksResponse(
            delta=greeks["delta"],
            gamma=greeks["gamma"],
            vega=greeks["vega"],
            theta=greeks["theta"],
            rho=greeks["rho"],
            vanna=greeks["vanna"],
            volga=greeks["volga"],
            charm=greeks["charm"],
            method_used=method.value,
            metadata={
                "computation_time_ms": round(elapsed_ms, 4),
                "risk_free_rate": request.risk_free_rate,
                "volatility": request.volatility,
                "dividend_yield": request.option.dividend_yield,
            },
        )
    else:
        raise HTTPException(
            status_code=501,
            detail=(
                f"Method {method.value!r} is not yet implemented. "
                f"Currently only 'analytical' is supported."
            ),
        )
