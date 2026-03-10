"""Model calibration router."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/calibration", tags=["Calibration"])


@router.post("/calibrate")
async def calibrate_model(payload: dict) -> dict:
    """Calibrate a pricing model to market data.

    Accepts a free-form dict for now; a strict schema will be added once the
    calibration engine is built out.

    Placeholder -- returns stub data until the calibration engine is wired up.
    """
    return {
        "calibrated_params": {},
        "objective_value": 0.0,
        "iterations": 0,
        "metadata": {"note": "placeholder -- engine not yet connected"},
    }
