"""Volatility Lab API router.

Endpoints for implied volatility solving, volatility surface construction,
historical / EWMA volatility, smile slicing, and term structure extraction.
"""

from __future__ import annotations

import math

from fastapi import APIRouter, HTTPException

from engine.volatility.implied import (
    implied_volatility_with_greeks,
    implied_volatility_surface,
    generate_demo_surface,
    realized_vs_implied,
)
from engine.volatility.historical import (
    historical_volatility,
    ewma_volatility,
    rolling_historical_volatility,
    ewma_volatility_series,
    log_returns,
)
from engine.models.black_scholes import bsm_price
from schemas.volatility import (
    ImpliedVolRequest,
    ImpliedVolResponse,
    VolSurfaceRequest,
    VolSurfaceResponse,
    VolSurfacePoint,
    DemoSurfaceRequest,
    DemoSurfaceResponse,
    DemoSurfacePoint,
    HistoricalVolRequest,
    HistoricalVolResponse,
    RealizedVsImpliedRequest,
    RealizedVsImpliedResponse,
    SmileSliceRequest,
    SmileSliceResponse,
    TermStructureRequest,
    TermStructureResponse,
)

router = APIRouter(prefix="/api/volatility", tags=["Volatility"])


# ── Implied Volatility Solver ────────────────────────────────────────────────

@router.post("/implied-vol", response_model=ImpliedVolResponse)
async def solve_implied_vol(req: ImpliedVolRequest) -> ImpliedVolResponse:
    """Solve for BSM implied volatility from a market price."""
    try:
        result = implied_volatility_with_greeks(
            market_price=req.market_price,
            S=req.spot,
            K=req.strike,
            T=req.expiry_years,
            r=req.risk_free_rate,
            q=req.dividend_yield,
            option_type=req.option_type,
        )
        return ImpliedVolResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Volatility Surface from Market Quotes ────────────────────────────────────

@router.post("/surface", response_model=VolSurfaceResponse)
async def build_surface(req: VolSurfaceRequest) -> VolSurfaceResponse:
    """Build an implied volatility surface from market quotes."""
    quotes = [
        {
            "strike": q.strike,
            "expiry_years": q.expiry_years,
            "market_price": q.market_price,
            "option_type": q.option_type,
        }
        for q in req.quotes
    ]

    try:
        results = implied_volatility_surface(
            market_prices=quotes,
            S=req.spot,
            r=req.risk_free_rate,
            q=req.dividend_yield,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    surface_points = [VolSurfacePoint(**r) for r in results]
    expiries = sorted(set(r["expiry_years"] for r in results))
    strikes = sorted(set(r["strike"] for r in results))

    return VolSurfaceResponse(
        spot=req.spot,
        risk_free_rate=req.risk_free_rate,
        dividend_yield=req.dividend_yield,
        surface=surface_points,
        expiries=expiries,
        strikes=strikes,
    )


# ── Demo Surface ────────────────────────────────────────────────────────────

@router.post("/demo-surface", response_model=DemoSurfaceResponse)
async def demo_surface(req: DemoSurfaceRequest) -> DemoSurfaceResponse:
    """Generate a parametric demo implied volatility surface."""
    try:
        result = generate_demo_surface(
            S=req.spot,
            r=req.risk_free_rate,
            q=req.dividend_yield,
            base_vol=req.base_vol,
            skew_slope=req.skew_slope,
            smile_curvature=req.smile_curvature,
            term_slope=req.term_slope,
            expiries=req.expiries,
            strikes=req.strikes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    surface_points = [DemoSurfacePoint(**p) for p in result["surface"]]

    return DemoSurfaceResponse(
        spot=result["spot"],
        risk_free_rate=result["risk_free_rate"],
        dividend_yield=result["dividend_yield"],
        expiries=result["expiries"],
        strikes=result["strikes"],
        surface=surface_points,
    )


# ── Historical Volatility ──────────────────────────────────────────────────

@router.post("/historical", response_model=HistoricalVolResponse)
async def compute_historical_vol(req: HistoricalVolRequest) -> HistoricalVolResponse:
    """Compute historical and EWMA volatility from a price series."""
    try:
        hvol = historical_volatility(req.prices, ann_factor=req.ann_factor)
        evol = ewma_volatility(req.prices, lam=req.ewma_lambda, ann_factor=req.ann_factor)
        rets = log_returns(req.prices)

        # Rolling vol (may fail if window > len(returns))
        try:
            r_idx, r_vol = rolling_historical_volatility(
                req.prices, window=req.window, ann_factor=req.ann_factor
            )
        except ValueError:
            r_idx, r_vol = [], []

        # EWMA series
        try:
            e_idx, e_vol = ewma_volatility_series(
                req.prices, lam=req.ewma_lambda, ann_factor=req.ann_factor
            )
        except ValueError:
            e_idx, e_vol = [], []

        return HistoricalVolResponse(
            historical_vol=hvol,
            ewma_vol=evol,
            rolling_indices=r_idx.tolist() if hasattr(r_idx, 'tolist') else list(r_idx),
            rolling_vol=r_vol.tolist() if hasattr(r_vol, 'tolist') else list(r_vol),
            ewma_indices=e_idx.tolist() if hasattr(e_idx, 'tolist') else list(e_idx),
            ewma_vol_series=e_vol.tolist() if hasattr(e_vol, 'tolist') else list(e_vol),
            log_returns=rets.tolist(),
            ann_factor=req.ann_factor,
            window=req.window,
            ewma_lambda=req.ewma_lambda,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Realized vs Implied ─────────────────────────────────────────────────────

@router.post("/realized-vs-implied", response_model=RealizedVsImpliedResponse)
async def compare_realized_implied(
    req: RealizedVsImpliedRequest,
) -> RealizedVsImpliedResponse:
    """Compare rolling realized volatility against a constant implied vol."""
    try:
        result = realized_vs_implied(
            prices=req.prices,
            implied_vol=req.implied_vol,
            window=req.window,
            ann_factor=req.ann_factor,
        )
        return RealizedVsImpliedResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Smile Slice ──────────────────────────────────────────────────────────────

@router.post("/smile-slice", response_model=SmileSliceResponse)
async def smile_slice(req: SmileSliceRequest) -> SmileSliceResponse:
    """Extract a single-expiry smile/skew slice."""
    strikes = req.strikes or [float(k) for k in range(70, 135, 5)]
    T = req.expiry_years
    S = req.spot

    ivols = []
    moneyness_list = []
    for K in strikes:
        log_m = math.log(K / S)
        iv = (
            req.base_vol
            + req.skew_slope * log_m
            + req.smile_curvature * log_m ** 2
            + req.term_slope * math.sqrt(T)
        )
        iv = max(0.01, min(iv, 3.0))
        ivols.append(iv)
        moneyness_list.append(S / K)

    return SmileSliceResponse(
        expiry_years=T,
        strikes=strikes,
        implied_vols=ivols,
        moneyness=moneyness_list,
        spot=S,
    )


# ── Term Structure ──────────────────────────────────────────────────────────

@router.post("/term-structure", response_model=TermStructureResponse)
async def term_structure(req: TermStructureRequest) -> TermStructureResponse:
    """Extract ATM implied vol term structure."""
    expiries = req.expiries or [0.083, 0.167, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0]
    S = req.spot
    K = S  # ATM

    atm_vols = []
    for T in expiries:
        log_m = math.log(K / S)  # = 0 for ATM
        iv = (
            req.base_vol
            + req.skew_slope * log_m
            + req.smile_curvature * log_m ** 2
            + req.term_slope * math.sqrt(T)
        )
        iv = max(0.01, min(iv, 3.0))
        atm_vols.append(iv)

    return TermStructureResponse(
        expiries=expiries,
        atm_vols=atm_vols,
        spot=S,
    )
