"""Interest rate swap pricing router."""

from fastapi import APIRouter

from schemas.instruments import SwapSpec

router = APIRouter(prefix="/api/swaps", tags=["Swaps"])


@router.post("/price")
async def price_swap(spec: SwapSpec) -> dict:
    """Price an interest rate swap.

    Placeholder -- returns stub data until the swap engine is wired up.
    """
    return {
        "npv": 0.0,
        "fixed_leg_pv": 0.0,
        "float_leg_pv": 0.0,
        "par_rate": 0.0,
        "metadata": {"note": "placeholder -- engine not yet connected"},
    }
