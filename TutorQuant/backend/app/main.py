"""TutorQuant API -- FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    calibration,
    fixed_income,
    greeks,
    monte_carlo,
    options,
    portfolio,
    rates,
    risk,
    swaps,
    volatility,
)

app = FastAPI(
    title="TutorQuant API",
    description=(
        "Professional-grade quantitative finance backend providing option pricing, "
        "Greeks computation, Monte Carlo simulation, fixed-income analytics, "
        "rate modelling, swap valuation, portfolio risk, and model calibration."
    ),
    version="0.1.0",
)

# ── CORS (permissive for local dev) ──────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(options.router)
app.include_router(greeks.router)
app.include_router(monte_carlo.router)
app.include_router(fixed_income.router)
app.include_router(rates.router)
app.include_router(swaps.router)
app.include_router(portfolio.router)
app.include_router(risk.router)
app.include_router(calibration.router)
app.include_router(volatility.router)

# ── Health check ──────────────────────────────────────────────────────────────


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Liveness probe -- returns 200 when the service is up."""
    return {"status": "ok"}
