"""Short-rate and term-structure model schemas for TutorQuant."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from schemas.simulation import SimulationConfig


class RateModel(str, Enum):
    """Supported short-rate / term-structure models."""

    VASICEK = "vasicek"
    CIR = "cir"
    HULL_WHITE = "hull_white"


# ── Simulation ──────────────────────────────────────────────────────────────

class RateModelRequest(BaseModel):
    """Request payload for simulating a short-rate model."""

    model: RateModel = Field(..., description="Rate model to simulate")
    r0: float = Field(default=0.04, description="Initial short rate")
    params: dict = Field(
        default_factory=lambda: {"kappa": 0.5, "theta": 0.04, "sigma": 0.01},
        description="Model-specific parameters",
    )
    simulation_config: Optional[SimulationConfig] = Field(
        default=None, description="MC simulation settings"
    )
    horizon_years: float = Field(
        default=1.0, gt=0, description="Simulation horizon in years"
    )


class RateModelResponse(BaseModel):
    """Response payload for a rate-model simulation."""

    model: str = Field(..., description="Model used")
    times: list[float] = Field(..., description="Time grid")
    paths: list[list[float]] = Field(
        ..., description="Simulated short-rate paths (subset for viz)"
    )
    mean_rate: list[float] = Field(
        ..., description="Cross-path mean rate at each time step"
    )
    std_rate: list[float] = Field(
        ..., description="Cross-path std at each time step"
    )
    terminal_distribution: list[float] = Field(
        ..., description="Terminal rate values across all paths"
    )
    metadata: Optional[dict] = None


# ── Yield Curve ──────────────────────────────────────────────────────────────

class YieldCurveFromModelRequest(BaseModel):
    """Request the analytical yield curve implied by a rate model."""

    model: RateModel = Field(..., description="Rate model")
    r0: float = Field(default=0.04, description="Initial short rate")
    params: dict = Field(
        default_factory=lambda: {"kappa": 0.5, "theta": 0.04, "sigma": 0.01},
        description="Model-specific parameters",
    )
    maturities: Optional[list[float]] = Field(
        default=None,
        description="Maturity grid (years). Defaults to standard tenors.",
    )


class YieldCurveFromModelResponse(BaseModel):
    """Analytical yield curve from a rate model."""

    model: str
    maturities: list[float]
    bond_prices: list[float]
    zero_rates: list[float]


# ── Model Comparison ─────────────────────────────────────────────────────────

class ModelComparisonEntry(BaseModel):
    """Properties of a single rate model for comparison."""

    model_id: str
    name: str
    sde: str
    mean_reversion: str
    positivity: str
    volatility_structure: str
    analytical_bond_price: bool
    practical_intuition: str
    common_use_cases: str
    limitations: str
    distribution: str


class ModelComparisonResponse(BaseModel):
    """Full model comparison table."""

    models: list[ModelComparisonEntry]


# ── Multi-Model Yield Curve Comparison ───────────────────────────────────────

class ModelCurveEntry(BaseModel):
    """A single model + params for yield curve comparison."""

    model: RateModel
    params: dict = Field(default_factory=dict)
    label: str = Field(default="")


class CompareCurvesRequest(BaseModel):
    """Compare yield curves from multiple models."""

    r0: float = Field(default=0.04, description="Common initial rate")
    models: list[ModelCurveEntry] = Field(..., min_length=1, max_length=5)
    maturities: Optional[list[float]] = Field(default=None)


class CurveComparisonSeries(BaseModel):
    """Yield curve data for one model."""

    model: str
    label: str
    maturities: list[float]
    bond_prices: list[float]
    zero_rates: list[float]


class CompareCurvesResponse(BaseModel):
    """Multi-model yield curve comparison result."""

    series: list[CurveComparisonSeries]
