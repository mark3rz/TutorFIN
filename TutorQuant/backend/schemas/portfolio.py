"""Portfolio analytics schemas for TutorQuant."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PositionSide(str, Enum):
    """Direction of a portfolio position."""

    LONG = "long"
    SHORT = "short"


class PortfolioPosition(BaseModel):
    """A single position inside a portfolio."""

    instrument_id: str = Field(..., description="Unique instrument identifier")
    instrument_type: str = Field(
        ..., description="Instrument type (option, bond, swap, equity, ...)"
    )
    quantity: float = Field(..., description="Number of contracts / units")
    side: PositionSide
    entry_price: Optional[float] = Field(
        default=None, description="Entry price (for P&L tracking)"
    )

    model_config = {"from_attributes": True}


class PortfolioRequest(BaseModel):
    """Request payload for portfolio-level analytics."""

    positions: list[PortfolioPosition]
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility_assumptions: Optional[dict] = Field(
        default=None,
        description="Per-instrument vol overrides keyed by instrument_id",
    )


class PortfolioRiskMetrics(BaseModel):
    """Aggregated risk metrics for a portfolio."""

    total_delta: float
    total_gamma: float
    total_vega: float
    total_theta: float
    var_95: Optional[float] = Field(
        default=None, description="95% Value-at-Risk"
    )
    es_95: Optional[float] = Field(
        default=None, description="95% Expected Shortfall"
    )


class PortfolioResponse(BaseModel):
    """Response payload for portfolio analytics."""

    total_value: float
    positions_valued: list[dict] = Field(
        ..., description="Per-position valuation detail"
    )
    risk_metrics: PortfolioRiskMetrics
    metadata: Optional[dict] = None
