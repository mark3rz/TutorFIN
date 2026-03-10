"""Instrument specification schemas for TutorQuant.

Defines the canonical Pydantic models for options, bonds, and swaps that are
shared across every pricing, risk, and calibration endpoint.
"""

from enum import Enum

from pydantic import BaseModel, Field


class OptionType(str, Enum):
    """Vanilla option direction."""

    CALL = "call"
    PUT = "put"


class ExerciseStyle(str, Enum):
    """Option exercise convention."""

    EUROPEAN = "european"
    AMERICAN = "american"
    BERMUDAN = "bermudan"


class OptionContract(BaseModel):
    """Full specification of a vanilla option contract."""

    spot: float = Field(..., gt=0, description="Current underlying spot price")
    strike: float = Field(..., gt=0, description="Strike price")
    expiry_years: float = Field(
        ..., gt=0, description="Time to expiration in years"
    )
    option_type: OptionType = Field(..., description="Call or put")
    exercise_style: ExerciseStyle = Field(
        ..., description="European, American, or Bermudan"
    )
    dividend_yield: float = Field(
        default=0.0, ge=0, description="Continuous dividend yield"
    )

    model_config = {"from_attributes": True}


class BondSpec(BaseModel):
    """Specification for a fixed-coupon bond."""

    face_value: float = Field(..., gt=0, description="Par / face value")
    coupon_rate: float = Field(
        ..., ge=0, description="Annual coupon rate (e.g. 0.05 for 5%)"
    )
    coupon_frequency: int = Field(
        ..., gt=0, description="Coupon payments per year (e.g. 2 for semi-annual)"
    )
    maturity_years: float = Field(..., gt=0, description="Years to maturity")
    day_count_convention: str = Field(
        default="ACT/365", description="Day-count convention string"
    )

    model_config = {"from_attributes": True}


class SwapSpec(BaseModel):
    """Specification for a plain-vanilla interest rate swap."""

    notional: float = Field(..., gt=0, description="Notional principal")
    fixed_rate: float = Field(..., description="Fixed leg coupon rate")
    float_spread: float = Field(
        default=0.0, description="Spread over the floating index"
    )
    tenor_years: float = Field(..., gt=0, description="Swap tenor in years")
    payment_frequency: int = Field(
        ..., gt=0, description="Payments per year"
    )
    day_count_convention: str = Field(
        default="ACT/360", description="Day-count convention string"
    )

    model_config = {"from_attributes": True}
