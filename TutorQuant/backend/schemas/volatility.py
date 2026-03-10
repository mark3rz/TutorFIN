"""Volatility Lab schemas: IV solver, smile/surface, historical vol."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ── Implied Volatility ──────────────────────────────────────────────────────

class ImpliedVolRequest(BaseModel):
    """Solve for BSM implied volatility from a market price."""

    spot: float = Field(..., gt=0, description="Current spot price")
    strike: float = Field(..., gt=0, description="Strike price")
    expiry_years: float = Field(..., gt=0, description="Time to expiry in years")
    market_price: float = Field(..., gt=0, description="Observed market price")
    risk_free_rate: float = Field(default=0.05, description="Continuous risk-free rate")
    dividend_yield: float = Field(default=0.0, ge=0, description="Continuous dividend yield")
    option_type: str = Field(default="call", description="'call' or 'put'")


class ImpliedVolResponse(BaseModel):
    """IV solver result with Greeks at the implied vol."""

    implied_vol: float
    bsm_price: float
    moneyness: float
    log_moneyness: float
    time_value: float
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float
    vanna: float
    volga: float
    charm: float


# ── Volatility Surface ──────────────────────────────────────────────────────

class VolSurfaceQuote(BaseModel):
    """A single market quote for surface construction."""

    strike: float = Field(..., gt=0)
    expiry_years: float = Field(..., gt=0)
    market_price: float = Field(..., gt=0)
    option_type: str = Field(default="call")


class VolSurfaceRequest(BaseModel):
    """Request to build an IV surface from market quotes."""

    spot: float = Field(..., gt=0, description="Spot price")
    risk_free_rate: float = Field(default=0.05, description="Risk-free rate")
    dividend_yield: float = Field(default=0.0, ge=0, description="Dividend yield")
    quotes: list[VolSurfaceQuote] = Field(
        ..., min_length=1, description="Market quotes for IV calibration"
    )


class VolSurfacePoint(BaseModel):
    """A single point on the IV surface."""

    strike: float
    expiry_years: float
    market_price: float
    option_type: str
    moneyness: float
    log_moneyness: Optional[float] = None
    implied_vol: Optional[float] = None
    error: Optional[str] = None


class VolSurfaceResponse(BaseModel):
    """Full IV surface response."""

    spot: float
    risk_free_rate: float
    dividend_yield: float
    surface: list[VolSurfacePoint]
    expiries: list[float]
    strikes: list[float]


# ── Demo Surface ────────────────────────────────────────────────────────────

class DemoSurfaceRequest(BaseModel):
    """Generate a parametric demo IV surface."""

    spot: float = Field(default=100.0, gt=0, description="Spot price")
    risk_free_rate: float = Field(default=0.05, description="Risk-free rate")
    dividend_yield: float = Field(default=0.0, ge=0, description="Dividend yield")
    base_vol: float = Field(default=0.20, gt=0, le=2.0, description="ATM base volatility")
    skew_slope: float = Field(default=-0.10, description="Skew slope (neg = equity skew)")
    smile_curvature: float = Field(default=0.05, ge=0, description="Smile curvature coefficient")
    term_slope: float = Field(default=0.02, description="Term structure slope coefficient")
    expiries: Optional[list[float]] = Field(
        default=None, description="Custom expiry times (years)"
    )
    strikes: Optional[list[float]] = Field(
        default=None, description="Custom strike prices"
    )


class DemoSurfacePoint(BaseModel):
    """A single point on the demo surface."""

    strike: float
    expiry_years: float
    implied_vol: float
    market_price: float
    option_type: str
    moneyness: float
    log_moneyness: float


class DemoSurfaceResponse(BaseModel):
    """Demo surface response."""

    spot: float
    risk_free_rate: float
    dividend_yield: float
    expiries: list[float]
    strikes: list[float]
    surface: list[DemoSurfacePoint]


# ── Historical Volatility ──────────────────────────────────────────────────

class HistoricalVolRequest(BaseModel):
    """Compute historical and EWMA volatility from a price series."""

    prices: list[float] = Field(..., min_length=3, description="Chronological price series")
    window: int = Field(default=21, ge=2, le=252, description="Rolling window size")
    ewma_lambda: float = Field(default=0.94, gt=0, lt=1, description="EWMA decay factor")
    ann_factor: float = Field(default=252.0, gt=0, description="Annualisation factor")


class HistoricalVolResponse(BaseModel):
    """Historical and EWMA volatility results."""

    historical_vol: float
    ewma_vol: float
    rolling_indices: list[int]
    rolling_vol: list[float]
    ewma_indices: list[int]
    ewma_vol_series: list[float]
    log_returns: list[float]
    ann_factor: float
    window: int
    ewma_lambda: float


# ── Realized vs Implied ─────────────────────────────────────────────────────

class RealizedVsImpliedRequest(BaseModel):
    """Compare realized vs implied volatility."""

    prices: list[float] = Field(..., min_length=3, description="Price series")
    implied_vol: float = Field(..., gt=0, description="Constant implied vol for comparison")
    window: int = Field(default=21, ge=2, le=252, description="Rolling window")
    ann_factor: float = Field(default=252.0, gt=0, description="Annualisation factor")


class RealizedVsImpliedResponse(BaseModel):
    """Realized vs implied comparison."""

    indices: list[int]
    realized_vol: list[float]
    implied_vol: float
    mean_realized: float
    vol_risk_premium: float


# ── Smile Slice ──────────────────────────────────────────────────────────────

class SmileSliceRequest(BaseModel):
    """Extract a single-expiry smile slice from a surface."""

    spot: float = Field(default=100.0, gt=0)
    risk_free_rate: float = Field(default=0.05)
    dividend_yield: float = Field(default=0.0, ge=0)
    expiry_years: float = Field(default=0.25, gt=0, description="Expiry to slice")
    base_vol: float = Field(default=0.20, gt=0)
    skew_slope: float = Field(default=-0.10)
    smile_curvature: float = Field(default=0.05, ge=0)
    term_slope: float = Field(default=0.02)
    strikes: Optional[list[float]] = Field(default=None)


class SmileSliceResponse(BaseModel):
    """Single-expiry smile/skew data."""

    expiry_years: float
    strikes: list[float]
    implied_vols: list[float]
    moneyness: list[float]
    spot: float


# ── Term Structure ──────────────────────────────────────────────────────────

class TermStructureRequest(BaseModel):
    """Extract ATM term structure from a surface."""

    spot: float = Field(default=100.0, gt=0)
    risk_free_rate: float = Field(default=0.05)
    dividend_yield: float = Field(default=0.0, ge=0)
    base_vol: float = Field(default=0.20, gt=0)
    skew_slope: float = Field(default=-0.10)
    smile_curvature: float = Field(default=0.05, ge=0)
    term_slope: float = Field(default=0.02)
    expiries: Optional[list[float]] = Field(default=None)


class TermStructureResponse(BaseModel):
    """ATM implied vol term structure."""

    expiries: list[float]
    atm_vols: list[float]
    spot: float
