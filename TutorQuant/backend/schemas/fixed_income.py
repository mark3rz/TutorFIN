"""Fixed-income analytics schemas: bond pricing, YTM, duration, convexity, curves."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ── Full Bond Analytics ────────────────────────────────────────────────────

class BondAnalyticsRequest(BaseModel):
    """Request for comprehensive bond analytics."""

    face_value: float = Field(default=100.0, gt=0, description="Par / face value")
    coupon_rate: float = Field(default=0.05, ge=0, description="Annual coupon rate (0.05 = 5%)")
    coupon_frequency: int = Field(default=2, ge=1, le=12, description="Coupons per year (2 = semi-annual)")
    maturity_years: float = Field(default=10.0, gt=0, description="Years to maturity")
    ytm: float = Field(default=0.05, description="Yield to maturity (annualised)")
    settlement_offset: float = Field(default=0.0, ge=0, lt=1, description="Fraction of coupon period elapsed")


class BondAnalyticsResponse(BaseModel):
    """Comprehensive bond analytics response."""

    dirty_price: float
    clean_price: float
    accrued_interest: float
    ytm: float
    macaulay_duration: float
    modified_duration: float
    convexity: float
    dv01: float
    cashflow_times: list[float]
    cashflow_amounts: list[float]
    n_remaining_coupons: int


# ── YTM Solver ──────────────────────────────────────────────────────────────

class YTMSolveRequest(BaseModel):
    """Solve for YTM given a market price."""

    dirty_price: float = Field(..., gt=0, description="Observed dirty price")
    face_value: float = Field(default=100.0, gt=0)
    coupon_rate: float = Field(default=0.05, ge=0)
    coupon_frequency: int = Field(default=2, ge=1, le=12)
    maturity_years: float = Field(default=10.0, gt=0)
    settlement_offset: float = Field(default=0.0, ge=0, lt=1)


class YTMSolveResponse(BaseModel):
    """YTM solver result."""

    ytm: float
    dirty_price: float
    clean_price: float
    accrued_interest: float
    macaulay_duration: float
    modified_duration: float
    convexity: float
    dv01: float


# ── Price-Yield Curve ───────────────────────────────────────────────────────

class PriceYieldCurveRequest(BaseModel):
    """Generate price vs yield data."""

    face_value: float = Field(default=100.0, gt=0)
    coupon_rate: float = Field(default=0.05, ge=0)
    coupon_frequency: int = Field(default=2, ge=1, le=12)
    maturity_years: float = Field(default=10.0, gt=0)
    settlement_offset: float = Field(default=0.0, ge=0, lt=1)
    yield_min: float = Field(default=0.0, ge=-0.05)
    yield_max: float = Field(default=0.15, le=1.0)
    n_points: int = Field(default=50, ge=10, le=200)


class PriceYieldCurveResponse(BaseModel):
    """Price vs yield data."""

    yields: list[float]
    dirty_prices: list[float]
    clean_prices: list[float]
    face_value: float
    coupon_rate: float


# ── Yield Curve / Discount Factors ──────────────────────────────────────────

class YieldCurveRequest(BaseModel):
    """Request to build a zero curve from par rates."""

    par_rates: list[float] = Field(..., min_length=2, description="Par yields")
    maturities: list[float] = Field(..., min_length=2, description="Maturities in years")
    coupon_frequency: int = Field(default=2, ge=1, le=12)
    face_value: float = Field(default=100.0, gt=0)


class YieldCurveResponse(BaseModel):
    """Bootstrapped zero curve."""

    maturities: list[float]
    zero_rates: list[float]
    discount_factors: list[float]
    par_rates: list[float]
    forward_labels: list[str]
    forward_rates: list[float]


# ── Demo Curve ──────────────────────────────────────────────────────────────

class DemoCurveRequest(BaseModel):
    """Request a demo yield curve."""

    style: str = Field(default="normal", description="'normal', 'inverted', 'flat', or 'humped'")


class DemoCurveResponse(BaseModel):
    """Demo curve with bootstrapped zero rates."""

    maturities: list[float]
    par_rates: list[float]
    zero_rates: list[float]
    discount_factors: list[float]
    forward_labels: list[str]
    forward_rates: list[float]
    description: str


# ── Bond Comparison ─────────────────────────────────────────────────────────

class BondComparisonEntry(BaseModel):
    """A single bond spec for comparison."""

    label: str = Field(default="Bond", description="Display label")
    face_value: float = Field(default=100.0, gt=0)
    coupon_rate: float = Field(default=0.05, ge=0)
    coupon_frequency: int = Field(default=2, ge=1, le=12)
    maturity_years: float = Field(default=10.0, gt=0)


class BondComparisonRequest(BaseModel):
    """Compare multiple bonds across a range of yields."""

    bonds: list[BondComparisonEntry] = Field(..., min_length=1, max_length=5)
    yield_min: float = Field(default=0.0, ge=-0.05)
    yield_max: float = Field(default=0.15, le=1.0)
    n_points: int = Field(default=50, ge=10, le=200)


class BondComparisonSeries(BaseModel):
    """Price-yield series for one bond."""

    label: str
    yields: list[float]
    prices: list[float]
    duration: float
    convexity: float


class BondComparisonResponse(BaseModel):
    """Multi-bond comparison result."""

    series: list[BondComparisonSeries]
