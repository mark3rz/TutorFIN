"""Options pricing router.

Endpoints
---------
POST /api/options/price   -- Price a vanilla option using the specified model.
POST /api/options/payoff  -- Generate payoff profile data for charting.
"""

from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from schemas.pricing import OptionPricingRequest, OptionPricingResponse

# Import engine modules to trigger registry registration at import time
import engine.models.black_scholes  # noqa: F401
import engine.models.binomial  # noqa: F401
import engine.models.trinomial  # noqa: F401
from registry.model_registry import pricing_model_registry
from engine.models.payoff import generate_payoff_data

router = APIRouter(prefix="/api/options", tags=["Options"])


# ---------------------------------------------------------------------------
# Payoff request schema (lightweight, defined here to avoid bloating schemas/)
# ---------------------------------------------------------------------------

class PayoffRequest(BaseModel):
    """Request payload for generating a payoff profile."""

    strike: float = Field(..., gt=0, description="Strike price")
    option_type: str = Field(..., description="'call' or 'put'")
    premium: float = Field(default=0.0, ge=0, description="Option premium paid")
    spot_min: Optional[float] = Field(
        default=None, gt=0, description="Lower bound of spot range"
    )
    spot_max: Optional[float] = Field(
        default=None, gt=0, description="Upper bound of spot range"
    )


class PayoffResponse(BaseModel):
    """Response payload for a payoff profile request."""

    spot_range: list[float]
    long_payoff: list[float]
    short_payoff: list[float]
    breakeven: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/price", response_model=OptionPricingResponse)
async def price_option(request: OptionPricingRequest) -> OptionPricingResponse:
    """Price a vanilla option using the specified model.

    Currently supports ``black_scholes``.  Other models will be wired up
    in subsequent phases.
    """
    model_key = request.model.value

    try:
        engine_cls = pricing_model_registry.get(model_key)
    except KeyError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    engine = engine_cls()

    market_data = {
        "risk_free_rate": request.risk_free_rate,
        "volatility": request.volatility,
    }
    if request.model_params:
        market_data.update(request.model_params)

    t0 = time.perf_counter()
    try:
        price = engine.price(request.option, market_data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    return OptionPricingResponse(
        price=price,
        model_used=engine.name,
        computation_time_ms=round(elapsed_ms, 4),
        metadata={
            "risk_free_rate": request.risk_free_rate,
            "volatility": request.volatility,
            "dividend_yield": request.option.dividend_yield,
        },
    )


@router.post("/payoff", response_model=PayoffResponse)
async def payoff_profile(request: PayoffRequest) -> PayoffResponse:
    """Generate payoff (P&L) profile data for a vanilla option."""
    try:
        data = generate_payoff_data(
            strike=request.strike,
            option_type=request.option_type,
            premium=request.premium,
            spot_min=request.spot_min,
            spot_max=request.spot_max,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return PayoffResponse(**data)
