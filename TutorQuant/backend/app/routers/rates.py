"""Short-rate / term-structure model simulation router."""

from fastapi import APIRouter

from schemas.rates import RateModelRequest, RateModelResponse

router = APIRouter(prefix="/api/rates", tags=["Rates"])


@router.post("/simulate", response_model=RateModelResponse)
async def simulate_rates(request: RateModelRequest) -> RateModelResponse:
    """Simulate interest-rate paths under the chosen short-rate model.

    Placeholder -- returns stub data until the rates engine is wired up.
    """
    return RateModelResponse(
        paths=[[request.r0]],
        mean_rate=[request.r0],
        terminal_distribution=[request.r0],
        metadata={"note": "placeholder -- engine not yet connected"},
    )
