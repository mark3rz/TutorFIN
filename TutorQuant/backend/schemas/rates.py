"""Short-rate and term-structure model schemas for TutorQuant."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from schemas.simulation import SimulationConfig


class RateModel(str, Enum):
    """Supported short-rate / term-structure models."""

    VASICEK = "vasicek"
    CIR = "cir"
    HULL_WHITE = "hull_white"
    LMM = "lmm"


class RateModelRequest(BaseModel):
    """Request payload for simulating a short-rate model."""

    model: RateModel = Field(..., description="Rate model to simulate")
    r0: float = Field(..., description="Initial short rate")
    params: dict = Field(
        ...,
        description="Model-specific parameters (e.g. {'kappa': 0.5, 'theta': 0.04, 'sigma': 0.01})",
    )
    simulation_config: Optional[SimulationConfig] = Field(
        default=None, description="MC simulation settings (if applicable)"
    )
    horizon_years: float = Field(
        default=1.0, gt=0, description="Simulation horizon in years"
    )


class RateModelResponse(BaseModel):
    """Response payload for a rate-model simulation."""

    paths: list[list[float]] = Field(
        ..., description="Simulated short-rate paths"
    )
    mean_rate: list[float] = Field(
        ..., description="Cross-path mean rate at each time step"
    )
    terminal_distribution: list[float] = Field(
        ..., description="Terminal rate values across all paths"
    )
    zero_curve: Optional[list[float]] = Field(
        default=None, description="Implied zero-coupon curve (if computed)"
    )
    metadata: Optional[dict] = None
