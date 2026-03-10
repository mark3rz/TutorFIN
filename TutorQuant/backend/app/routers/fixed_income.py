"""Fixed-income pricing and analytics router.

Endpoints for bond pricing, YTM solving, duration/convexity, price-yield
sensitivity, yield curve bootstrapping, and bond comparison.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from engine.fixed_income.bonds import price_bond_from_yield
from engine.fixed_income.analytics import (
    yield_to_maturity,
    full_bond_analytics,
    price_yield_curve,
    macaulay_duration,
    modified_duration,
    convexity,
    dv01,
)
from engine.fixed_income.curves import (
    bootstrap_zero_curve,
    forward_rates,
    discount_factors_from_zero_rates,
    generate_demo_yield_curve,
)
from schemas.pricing import BondPricingRequest, BondPricingResponse
from schemas.fixed_income import (
    BondAnalyticsRequest,
    BondAnalyticsResponse,
    YTMSolveRequest,
    YTMSolveResponse,
    PriceYieldCurveRequest,
    PriceYieldCurveResponse,
    YieldCurveRequest,
    YieldCurveResponse,
    DemoCurveRequest,
    DemoCurveResponse,
    BondComparisonRequest,
    BondComparisonResponse,
    BondComparisonSeries,
)

router = APIRouter(prefix="/api/fixed-income", tags=["Fixed Income"])


# ── Legacy endpoint (keep for backwards compat) ─────────────────────────────

@router.post("/price-bond", response_model=BondPricingResponse)
async def price_bond(request: BondPricingRequest) -> BondPricingResponse:
    """Price a fixed-coupon bond given a yield curve.

    Uses the bond spec and a flat yield (first element of yield_curve) to compute
    clean/dirty price, accrued interest, YTM, duration, and convexity.
    """
    bond = request.bond
    ytm_input = request.yield_curve[0] if request.yield_curve else 0.05

    try:
        result = full_bond_analytics(
            face_value=bond.face_value,
            coupon_rate=bond.coupon_rate,
            coupon_frequency=bond.coupon_frequency,
            maturity_years=bond.maturity_years,
            ytm=ytm_input,
        )
        return BondPricingResponse(
            clean_price=result["clean_price"],
            dirty_price=result["dirty_price"],
            accrued_interest=result["accrued_interest"],
            ytm=result["ytm"],
            duration=result["modified_duration"],
            convexity=result["convexity"],
            metadata={"macaulay_duration": result["macaulay_duration"], "dv01": result["dv01"]},
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Full Bond Analytics ──────────────────────────────────────────────────────

@router.post("/analytics", response_model=BondAnalyticsResponse)
async def bond_analytics(req: BondAnalyticsRequest) -> BondAnalyticsResponse:
    """Compute comprehensive bond analytics: pricing, duration, convexity, DV01."""
    try:
        result = full_bond_analytics(
            face_value=req.face_value,
            coupon_rate=req.coupon_rate,
            coupon_frequency=req.coupon_frequency,
            maturity_years=req.maturity_years,
            ytm=req.ytm,
            settlement_offset=req.settlement_offset,
        )
        return BondAnalyticsResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── YTM Solver ──────────────────────────────────────────────────────────────

@router.post("/ytm-solve", response_model=YTMSolveResponse)
async def solve_ytm(req: YTMSolveRequest) -> YTMSolveResponse:
    """Solve for yield to maturity from a market dirty price."""
    try:
        ytm = yield_to_maturity(
            dirty_price=req.dirty_price,
            face_value=req.face_value,
            coupon_rate=req.coupon_rate,
            coupon_frequency=req.coupon_frequency,
            maturity_years=req.maturity_years,
            settlement_offset=req.settlement_offset,
        )
        result = full_bond_analytics(
            face_value=req.face_value,
            coupon_rate=req.coupon_rate,
            coupon_frequency=req.coupon_frequency,
            maturity_years=req.maturity_years,
            ytm=ytm,
            settlement_offset=req.settlement_offset,
        )
        return YTMSolveResponse(
            ytm=ytm,
            dirty_price=result["dirty_price"],
            clean_price=result["clean_price"],
            accrued_interest=result["accrued_interest"],
            macaulay_duration=result["macaulay_duration"],
            modified_duration=result["modified_duration"],
            convexity=result["convexity"],
            dv01=result["dv01"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Price-Yield Curve ───────────────────────────────────────────────────────

@router.post("/price-yield-curve", response_model=PriceYieldCurveResponse)
async def get_price_yield_curve(req: PriceYieldCurveRequest) -> PriceYieldCurveResponse:
    """Generate price vs yield sensitivity data."""
    try:
        result = price_yield_curve(
            face_value=req.face_value,
            coupon_rate=req.coupon_rate,
            coupon_frequency=req.coupon_frequency,
            maturity_years=req.maturity_years,
            settlement_offset=req.settlement_offset,
            yield_min=req.yield_min,
            yield_max=req.yield_max,
            n_points=req.n_points,
        )
        return PriceYieldCurveResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Yield Curve Bootstrap ───────────────────────────────────────────────────

@router.post("/bootstrap-curve", response_model=YieldCurveResponse)
async def bootstrap_curve(req: YieldCurveRequest) -> YieldCurveResponse:
    """Bootstrap a zero-rate curve from par bond yields."""
    try:
        result = bootstrap_zero_curve(
            par_rates=req.par_rates,
            maturities=req.maturities,
            coupon_frequency=req.coupon_frequency,
            face_value=req.face_value,
        )
        fwd_labels, fwd_rates = forward_rates(result["maturities"], result["discount_factors"])
        return YieldCurveResponse(
            maturities=result["maturities"],
            zero_rates=result["zero_rates"],
            discount_factors=result["discount_factors"],
            par_rates=result["par_rates"],
            forward_labels=fwd_labels,
            forward_rates=fwd_rates,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Demo Curve ──────────────────────────────────────────────────────────────

@router.post("/demo-curve", response_model=DemoCurveResponse)
async def demo_curve(req: DemoCurveRequest) -> DemoCurveResponse:
    """Generate a demo yield curve and bootstrap zero rates."""
    try:
        demo = generate_demo_yield_curve(style=req.style)
        boot = bootstrap_zero_curve(
            par_rates=demo["par_rates"],
            maturities=demo["maturities"],
        )
        fwd_labels, fwd_rates = forward_rates(boot["maturities"], boot["discount_factors"])
        return DemoCurveResponse(
            maturities=boot["maturities"],
            par_rates=boot["par_rates"],
            zero_rates=boot["zero_rates"],
            discount_factors=boot["discount_factors"],
            forward_labels=fwd_labels,
            forward_rates=fwd_rates,
            description=demo["description"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Bond Comparison ─────────────────────────────────────────────────────────

@router.post("/bond-comparison", response_model=BondComparisonResponse)
async def bond_comparison(req: BondComparisonRequest) -> BondComparisonResponse:
    """Compare price-yield profiles of multiple bonds."""
    try:
        series = []
        for bond in req.bonds:
            pyc = price_yield_curve(
                face_value=bond.face_value,
                coupon_rate=bond.coupon_rate,
                coupon_frequency=bond.coupon_frequency,
                maturity_years=bond.maturity_years,
                yield_min=req.yield_min,
                yield_max=req.yield_max,
                n_points=req.n_points,
            )
            # Compute duration/convexity at mid-yield
            mid_yield = (req.yield_min + req.yield_max) / 2
            d = modified_duration(
                bond.face_value, bond.coupon_rate, bond.coupon_frequency,
                bond.maturity_years, mid_yield,
            )
            c = convexity(
                bond.face_value, bond.coupon_rate, bond.coupon_frequency,
                bond.maturity_years, mid_yield,
            )
            series.append(BondComparisonSeries(
                label=bond.label,
                yields=pyc["yields"],
                prices=pyc["dirty_prices"],
                duration=d,
                convexity=c,
            ))
        return BondComparisonResponse(series=series)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
