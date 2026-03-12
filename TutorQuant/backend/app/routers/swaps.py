"""Interest rate swap pricing and analytics router."""

from fastapi import APIRouter, HTTPException

from engine.swaps.vanilla_irs import (
    price_vanilla_irs,
    compute_swap_sensitivities,
    par_rate_curve,
)
from engine.swaps.ois import (
    dual_curve_price,
    get_ois_concepts,
)
from engine.swaps.basis_swap import (
    price_basis_swap,
    get_basis_swap_types,
)
from schemas.swaps import (
    SwapPriceRequest,
    SwapPriceResponse,
    SwapSensitivityRequest,
    SwapSensitivityResponse,
    ParRateCurveRequest,
    ParRateCurveResponse,
    DualCurvePriceRequest,
    DualCurvePriceResponse,
    BasisSwapRequest,
    BasisSwapResponse,
    OISConceptsResponse,
    SwapConceptEntry,
    BasisSwapTypesResponse,
    SwapTypeEntry,
)

router = APIRouter(prefix="/api/swaps", tags=["Swaps"])

# ── Standard tenor grid ──────────────────────────────────────────────────────

STANDARD_TENORS = [0.5, 1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30]


# ── Vanilla IRS ──────────────────────────────────────────────────────────────


@router.post("/price", response_model=SwapPriceResponse)
async def price_swap(request: SwapPriceRequest) -> SwapPriceResponse:
    """Price a vanilla fixed-for-floating interest rate swap.

    Computes present values of fixed and floating legs, par swap rate,
    and DV01. Supports flat discount rates or a term-structure curve.
    """
    try:
        curve = None
        if request.discount_curve is not None:
            curve = [
                {"tenor": p.tenor, "rate": p.rate} for p in request.discount_curve
            ]

        result = price_vanilla_irs(
            notional=request.notional,
            fixed_rate=request.fixed_rate,
            tenor_years=request.tenor_years,
            discount_rate=request.discount_rate,
            discount_curve=curve,
            pay_freq=request.pay_freq,
            rec_freq=request.rec_freq,
            float_spread=request.float_spread,
            is_payer=request.is_payer,
        )
        return SwapPriceResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Sensitivity ──────────────────────────────────────────────────────────────


@router.post("/sensitivity", response_model=SwapSensitivityResponse)
async def swap_sensitivity(
    request: SwapSensitivityRequest,
) -> SwapSensitivityResponse:
    """Compute rate sensitivities (DV01, convexity) for a vanilla IRS.

    Bumps the flat discount rate and recomputes NPV to produce a
    sensitivity profile.
    """
    try:
        result = compute_swap_sensitivities(
            notional=request.notional,
            fixed_rate=request.fixed_rate,
            tenor_years=request.tenor_years,
            discount_rate=request.discount_rate,
            pay_freq=request.pay_freq,
            rec_freq=request.rec_freq,
            float_spread=request.float_spread,
            bump_bps=request.bump_bps,
        )
        return SwapSensitivityResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Par Rate Curve ───────────────────────────────────────────────────────────


@router.post("/par-curve", response_model=ParRateCurveResponse)
async def get_par_curve(request: ParRateCurveRequest) -> ParRateCurveResponse:
    """Compute the par swap rate curve across a range of tenors.

    Shows how the par swap rate varies with maturity — the swap curve.
    """
    try:
        tenors = request.tenors or STANDARD_TENORS
        curve = None
        if request.discount_curve is not None:
            curve = [
                {"tenor": p.tenor, "rate": p.rate} for p in request.discount_curve
            ]

        result = par_rate_curve(
            tenors=tenors,
            discount_rate=request.discount_rate,
            discount_curve=curve,
            pay_freq=request.pay_freq,
        )
        return ParRateCurveResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Dual-Curve / OIS Discounting ─────────────────────────────────────────────


@router.post("/dual-curve", response_model=DualCurvePriceResponse)
async def price_dual_curve(
    request: DualCurvePriceRequest,
) -> DualCurvePriceResponse:
    """Price a swap under the dual-curve framework (OIS discounting).

    Compares single-curve vs dual-curve valuation to illustrate the
    impact of OIS discounting.
    """
    try:
        result = dual_curve_price(
            notional=request.notional,
            fixed_rate=request.fixed_rate,
            tenor_years=request.tenor_years,
            projection_rate=request.projection_rate,
            discount_rate=request.discount_rate,
            pay_freq=request.pay_freq,
            rec_freq=request.rec_freq,
            float_spread=request.float_spread,
        )
        return DualCurvePriceResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Basis Swap ───────────────────────────────────────────────────────────────


@router.post("/basis-swap", response_model=BasisSwapResponse)
async def price_basis(request: BasisSwapRequest) -> BasisSwapResponse:
    """Price a simplified tenor basis swap.

    Demonstrates basis swap mechanics with flat rate approximation.
    """
    try:
        result = price_basis_swap(
            notional=request.notional,
            tenor_years=request.tenor_years,
            rate_a=request.rate_a,
            rate_b=request.rate_b,
            spread_b=request.spread_b,
            freq_a=request.freq_a,
            freq_b=request.freq_b,
            discount_rate=request.discount_rate,
        )
        return BasisSwapResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Reference Data (GET) ────────────────────────────────────────────────────


@router.get("/ois-concepts", response_model=OISConceptsResponse)
async def get_ois_concepts_endpoint() -> OISConceptsResponse:
    """Get structured educational content about OIS discounting."""
    entries = get_ois_concepts()
    return OISConceptsResponse(
        concepts=[SwapConceptEntry(**e) for e in entries]
    )


@router.get("/basis-types", response_model=BasisSwapTypesResponse)
async def get_basis_types() -> BasisSwapTypesResponse:
    """Get reference data about basis swap types."""
    entries = get_basis_swap_types()
    return BasisSwapTypesResponse(
        types=[SwapTypeEntry(**e) for e in entries]
    )
