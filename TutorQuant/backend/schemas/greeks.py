"""Greeks request / response schemas for TutorQuant."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from schemas.instruments import OptionContract
from schemas.pricing import PricingModel


class GreeksMethod(str, Enum):
    """Method used to compute Greeks."""

    ANALYTICAL = "analytical"
    FINITE_DIFFERENCE = "finite_difference"


class GreeksRequest(BaseModel):
    """Request payload for computing option Greeks."""

    option: OptionContract
    model: PricingModel = Field(..., description="Underlying pricing model")
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Annualised volatility")
    method: GreeksMethod = Field(
        default=GreeksMethod.ANALYTICAL,
        description="Computation method (analytical or finite-difference)",
    )
    fd_bump: float = Field(
        default=0.01,
        gt=0,
        description="Relative bump size for finite-difference Greeks",
    )


class GreeksResponse(BaseModel):
    """Response payload containing computed Greeks."""

    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float
    vanna: Optional[float] = None
    volga: Optional[float] = None
    charm: Optional[float] = None
    method_used: str
    metadata: Optional[dict] = None
