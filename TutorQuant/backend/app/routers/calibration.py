"""Model calibration router — SVI surface fitting and rate model calibration."""

from fastapi import APIRouter, HTTPException

from engine.calibration.svi_surface import (
    calibrate_svi_slice,
    calibrate_svi_surface,
    check_svi_arbitrage,
)
from engine.calibration.rate_model_calibrator import calibrate_rate_model
from schemas.calibration import (
    SVICalibrationRequest,
    SVICalibrationResponse,
    SVISliceResult,
    RateCalibrationRequest,
    RateCalibrationResponse,
    SVIArbitrageCheckRequest,
    SVIArbitrageCheckResponse,
)

router = APIRouter(prefix="/api/calibration", tags=["Calibration"])


# ── SVI Surface Calibration ──────────────────────────────────────────────────


@router.post("/svi", response_model=SVICalibrationResponse)
async def calibrate_svi(request: SVICalibrationRequest) -> SVICalibrationResponse:
    """Calibrate SVI parameters to market IV slices.

    Fits the SVI total variance parameterisation to one or more
    expiry slices of implied volatility data.
    """
    try:
        slices_input = [
            {
                "expiry": s.expiry,
                "strikes": s.strikes,
                "market_ivs": s.market_ivs,
            }
            for s in request.slices
        ]

        result = calibrate_svi_surface(
            slices=slices_input,
            spot=request.spot,
            r=request.risk_free_rate,
            q=request.dividend_yield,
            method=request.method,
        )

        return SVICalibrationResponse(
            slices=[SVISliceResult(**s) for s in result["slices"]],
            aggregate_diagnostics=result["aggregate_diagnostics"],
            n_slices=result["n_slices"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/svi/arbitrage-check", response_model=SVIArbitrageCheckResponse)
async def svi_arbitrage_check(
    request: SVIArbitrageCheckRequest,
) -> SVIArbitrageCheckResponse:
    """Check SVI parameters for butterfly arbitrage conditions."""
    result = check_svi_arbitrage(
        a=request.a,
        b=request.b,
        rho=request.rho,
        m=request.m,
        sigma=request.sigma,
    )
    return SVIArbitrageCheckResponse(**result)


# ── Rate Model Calibration ───────────────────────────────────────────────────


@router.post("/rate-model", response_model=RateCalibrationResponse)
async def calibrate_rate(
    request: RateCalibrationRequest,
) -> RateCalibrationResponse:
    """Calibrate a short-rate model to an observed yield curve.

    Optimises model parameters to minimise the squared error between
    model-implied zero rates and observed zero rates.
    """
    try:
        result = calibrate_rate_model(
            model=request.model,
            maturities=request.maturities,
            target_rates=request.target_rates,
            r0=request.r0,
            method=request.method,
        )
        return RateCalibrationResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
