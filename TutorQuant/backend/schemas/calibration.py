"""Calibration schemas for TutorQuant."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ── SVI Surface Calibration ──────────────────────────────────────────────────


class SVISliceInput(BaseModel):
    """A single-expiry IV slice for SVI calibration."""

    expiry: float = Field(..., gt=0, description="Time to expiry (years)")
    strikes: list[float] = Field(..., min_length=3, description="Strike prices")
    market_ivs: list[float] = Field(
        ..., min_length=3, description="Market implied vols (annualised decimal)"
    )


class SVICalibrationRequest(BaseModel):
    """Request to calibrate SVI model to market IV data."""

    spot: float = Field(default=100.0, gt=0, description="Spot price")
    risk_free_rate: float = Field(default=0.05, description="Risk-free rate")
    dividend_yield: float = Field(default=0.0, ge=0, description="Dividend yield")
    slices: list[SVISliceInput] = Field(
        ..., min_length=1, description="IV slices by expiry"
    )
    method: str = Field(
        default="L-BFGS-B",
        description="Optimisation method: L-BFGS-B, Nelder-Mead, differential_evolution",
    )


class SVISliceResult(BaseModel):
    """Calibration result for a single SVI slice."""

    expiry: float
    forward: float
    params: dict[str, float]
    fitted_ivs: list[float]
    market_ivs: list[float]
    strikes: list[float]
    log_moneyness: list[float]
    residuals: list[float]
    diagnostics: dict
    converged: bool
    elapsed_ms: float
    iterations: int
    method: str


class SVICalibrationResponse(BaseModel):
    """Full SVI calibration response."""

    slices: list[SVISliceResult]
    aggregate_diagnostics: dict
    n_slices: int


# ── Rate Model Calibration ───────────────────────────────────────────────────


class RateCalibrationRequest(BaseModel):
    """Request to calibrate a rate model to an observed yield curve."""

    model: str = Field(
        default="vasicek",
        description="Rate model: vasicek or cir",
    )
    r0: float = Field(default=0.04, description="Current short rate")
    maturities: list[float] = Field(
        ..., min_length=2, description="Maturity grid (years)"
    )
    target_rates: list[float] = Field(
        ..., min_length=2, description="Observed zero rates at each maturity"
    )
    method: str = Field(
        default="L-BFGS-B",
        description="Optimisation method",
    )


class RateCalibrationResponse(BaseModel):
    """Rate model calibration result."""

    model: str
    params: dict[str, float]
    r0: float
    maturities: list[float]
    target_rates: list[float]
    fitted_rates: list[float]
    residuals: list[float]
    diagnostics: dict
    converged: bool
    elapsed_ms: float
    iterations: int
    method: str


# ── Diagnostics ──────────────────────────────────────────────────────────────


class DiagnosticsResponse(BaseModel):
    """Calibration error diagnostics."""

    rmse: float = Field(..., description="Root mean squared error")
    mae: float = Field(..., description="Mean absolute error")
    mape: float = Field(..., description="Mean absolute percentage error (%)")
    max_abs_err: float = Field(..., description="Maximum absolute error")
    sse: float = Field(..., description="Sum of squared errors")
    r_squared: float = Field(..., description="R-squared (coefficient of determination)")
    n_obs: int = Field(..., description="Number of observations")


# ── Arbitrage Check ──────────────────────────────────────────────────────────


class SVIArbitrageCheckRequest(BaseModel):
    """Check SVI parameters for butterfly arbitrage."""

    a: float = Field(..., description="SVI level parameter")
    b: float = Field(..., gt=0, description="SVI slope parameter")
    rho: float = Field(..., gt=-1, lt=1, description="SVI skew parameter")
    m: float = Field(..., description="SVI shift parameter")
    sigma: float = Field(..., gt=0, description="SVI curvature parameter")


class SVIArbitrageCheckResponse(BaseModel):
    """SVI arbitrage check result."""

    has_negative_variance: bool
    min_variance: float
    is_likely_arbitrage_free: bool
    lee_bound_satisfied: bool
