"""Pricing request / response schemas for TutorQuant.

Covers option and bond pricing across every supported model.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from schemas.instruments import BondSpec, OptionContract


class PricingModel(str, Enum):
    """Supported option pricing models."""

    BLACK_SCHOLES = "black_scholes"
    BINOMIAL = "binomial"
    TRINOMIAL = "trinomial"
    MONTE_CARLO = "monte_carlo"
    LOCAL_VOL = "local_vol"
    HESTON = "heston"
    SABR = "sabr"
    MERTON_JUMP = "merton_jump"


# ── Option pricing ────────────────────────────────────────────────────────────


class OptionPricingRequest(BaseModel):
    """Request payload for pricing a vanilla option."""

    option: OptionContract
    model: PricingModel = Field(..., description="Pricing model to use")
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Annualised volatility")
    model_params: Optional[dict] = Field(
        default=None,
        description="Additional model-specific parameters (e.g. Heston params)",
    )


class OptionPricingResponse(BaseModel):
    """Response payload for an option pricing request."""

    price: float
    model_used: str
    computation_time_ms: float
    metadata: Optional[dict] = None


# ── Bond pricing ──────────────────────────────────────────────────────────────


class BondPricingRequest(BaseModel):
    """Request payload for pricing a fixed-coupon bond."""

    bond: BondSpec
    yield_curve: list[float] = Field(
        ..., description="Yield curve nodes (annualised rates)"
    )
    discount_method: str = Field(
        default="zero_rate",
        description="Discounting methodology (zero_rate, par_rate, ...)",
    )


class BondPricingResponse(BaseModel):
    """Response payload for a bond pricing request."""

    clean_price: float
    dirty_price: float
    accrued_interest: float
    ytm: Optional[float] = None
    duration: Optional[float] = None
    convexity: Optional[float] = None
    metadata: Optional[dict] = None
