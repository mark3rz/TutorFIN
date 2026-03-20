"""Swap pricing and analytics schemas for TutorQuant."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────────


class SwapType(str, Enum):
    """Supported swap types."""

    VANILLA_IRS = "vanilla_irs"
    BASIS = "basis"
    OIS = "ois"


class SwapDirection(str, Enum):
    """Swap direction from the perspective of the requester."""

    PAYER = "payer"
    RECEIVER = "receiver"


# ── Curve Point ──────────────────────────────────────────────────────────────


class CurvePoint(BaseModel):
    """A single point on a discount/projection curve."""

    tenor: float = Field(..., gt=0, description="Maturity in years")
    rate: float = Field(..., description="Continuously-compounded zero rate")


# ── Vanilla IRS ──────────────────────────────────────────────────────────────


class SwapPriceRequest(BaseModel):
    """Request payload for pricing a vanilla IRS."""

    notional: float = Field(default=1_000_000, gt=0, description="Notional principal")
    fixed_rate: float = Field(
        default=0.04, description="Fixed leg coupon rate (annualised, e.g. 0.04 = 4%)"
    )
    tenor_years: float = Field(default=5.0, gt=0, description="Swap maturity in years")
    discount_rate: Optional[float] = Field(
        default=0.04, description="Flat discount rate (continuous compounding)"
    )
    discount_curve: Optional[list[CurvePoint]] = Field(
        default=None,
        description="Term-structure discount curve. Overrides discount_rate if provided.",
    )
    pay_freq: int = Field(
        default=2, gt=0, description="Fixed leg payments per year (e.g. 2 = semi-annual)"
    )
    rec_freq: int = Field(
        default=4, gt=0, description="Floating leg payments per year (e.g. 4 = quarterly)"
    )
    float_spread: float = Field(
        default=0.0, description="Spread over the floating index (e.g. 0.001 = 10 bps)"
    )
    is_payer: bool = Field(
        default=True, description="True = payer swap (pay fixed, receive float)"
    )


class CashflowDetail(BaseModel):
    """Detail of a single cashflow."""

    time: float
    tau: float
    amount: float
    df: float
    pv: float


class FloatCashflowDetail(BaseModel):
    """Detail of a single floating-leg cashflow."""

    time: float
    tau: float
    forward_rate: float
    spread: float
    all_in_rate: float
    amount: float
    df: float
    pv: float


class SwapPriceResponse(BaseModel):
    """Response payload for a vanilla IRS pricing."""

    npv: float = Field(..., description="Net present value")
    fixed_leg_pv: float = Field(..., description="Fixed leg present value")
    float_leg_pv: float = Field(..., description="Floating leg present value")
    par_rate: float = Field(..., description="Par swap rate")
    fixed_cashflows: list[CashflowDetail]
    float_cashflows: list[FloatCashflowDetail]
    annuity: float = Field(..., description="Annuity factor")
    dv01: float = Field(..., description="Dollar value of 1 bp")
    notional: float
    tenor_years: float
    fixed_rate: float
    is_payer: bool


# ── Sensitivity ──────────────────────────────────────────────────────────────


class SwapSensitivityRequest(BaseModel):
    """Request for swap rate sensitivity analysis."""

    notional: float = Field(default=1_000_000, gt=0)
    fixed_rate: float = Field(default=0.04)
    tenor_years: float = Field(default=5.0, gt=0)
    discount_rate: float = Field(default=0.04)
    pay_freq: int = Field(default=2, gt=0)
    rec_freq: int = Field(default=4, gt=0)
    float_spread: float = Field(default=0.0)
    bump_bps: float = Field(default=1.0, gt=0, description="Bump size in bps")


class SwapSensitivityResponse(BaseModel):
    """Swap sensitivity analysis results."""

    base_npv: float
    dv01: float
    convexity: float
    par_rate: float
    rate_bumps: list[float]
    npvs: list[float]


# ── Par Rate Curve ───────────────────────────────────────────────────────────


class ParRateCurveRequest(BaseModel):
    """Request for a par swap rate curve."""

    discount_rate: Optional[float] = Field(default=0.04)
    discount_curve: Optional[list[CurvePoint]] = Field(default=None)
    pay_freq: int = Field(default=2, gt=0)
    tenors: Optional[list[float]] = Field(
        default=None,
        description="Tenor grid (years). Defaults to standard tenors.",
    )


class ParRateCurveResponse(BaseModel):
    """Par swap rate curve result."""

    tenors: list[float]
    par_rates: list[float]


# ── OIS / Dual-Curve ────────────────────────────────────────────────────────


class DualCurvePriceRequest(BaseModel):
    """Request for dual-curve (OIS discounting) swap pricing."""

    notional: float = Field(default=1_000_000, gt=0)
    fixed_rate: float = Field(default=0.04)
    tenor_years: float = Field(default=5.0, gt=0)
    projection_rate: float = Field(
        default=0.045,
        description="Projection (forward) curve flat rate",
    )
    discount_rate: float = Field(
        default=0.04,
        description="OIS discount curve flat rate",
    )
    pay_freq: int = Field(default=2, gt=0)
    rec_freq: int = Field(default=4, gt=0)
    float_spread: float = Field(default=0.0)


class DualCurvePriceResponse(BaseModel):
    """Dual-curve pricing result with single-curve comparison."""

    npv: float
    fixed_leg_pv: float
    float_leg_pv: float
    par_rate: float
    single_curve_npv: float
    single_curve_par_rate: float
    basis_adjustment: float
    projection_rate: float
    discount_rate: float


# ── Basis Swap ───────────────────────────────────────────────────────────────


class BasisSwapRequest(BaseModel):
    """Request for basis swap pricing."""

    notional: float = Field(default=1_000_000, gt=0)
    tenor_years: float = Field(default=5.0, gt=0)
    rate_a: float = Field(
        default=0.045, description="Leg A projection rate (e.g. 3M SOFR)"
    )
    rate_b: float = Field(
        default=0.044, description="Leg B projection rate (e.g. 1M SOFR)"
    )
    spread_b: float = Field(
        default=0.0, description="Spread on Leg B"
    )
    freq_a: int = Field(default=4, gt=0, description="Leg A frequency")
    freq_b: int = Field(default=12, gt=0, description="Leg B frequency")
    discount_rate: float = Field(default=0.04)


class BasisSwapResponse(BaseModel):
    """Basis swap pricing result."""

    npv: float
    leg_a_pv: float
    leg_b_pv: float
    par_basis_spread: float
    par_basis_spread_bps: float
    notional: float
    tenor_years: float


# ── Reference Data ───────────────────────────────────────────────────────────


class SwapConceptEntry(BaseModel):
    """A single educational concept about swaps."""

    concept: str
    description: str


class SwapTypeEntry(BaseModel):
    """A single basis swap type description."""

    type: str
    description: str
    example: str
    market_context: str


class OISConceptsResponse(BaseModel):
    """OIS discounting educational content."""

    concepts: list[SwapConceptEntry]


class BasisSwapTypesResponse(BaseModel):
    """Basis swap types reference data."""

    types: list[SwapTypeEntry]
