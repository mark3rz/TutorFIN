"""Risk analytics schemas: P&L explain, VaR, ES, hedging error."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from schemas.instruments import OptionContract


# ── P&L Explain ──────────────────────────────────────────────────────────────

class PnlExplainRequest(BaseModel):
    """Request payload for Greek-based P&L explanation."""

    option: OptionContract
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Annualised volatility")
    dS: float = Field(default=0.0, description="Absolute spot shock")
    dsigma: float = Field(default=0.0, description="Absolute vol shock")
    dt: float = Field(default=0.0, ge=0, description="Time elapsed in years")
    position_size: float = Field(default=1.0, description="Number of contracts (neg = short)")


class PnlExplainResponse(BaseModel):
    """Response payload for P&L explanation."""

    delta_pnl: float
    gamma_pnl: float
    vega_pnl: float
    theta_pnl: float
    total_greek_pnl: float
    actual_pnl: float
    unexplained: float
    old_price: float
    new_price: float
    position_size: float
    greeks: dict[str, float]
    scenario: dict[str, float]


class ScenarioGridRequest(BaseModel):
    """Request for a P&L scenario grid (spot × vol shocks)."""

    option: OptionContract
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Annualised volatility")
    spot_shocks: Optional[list[float]] = Field(
        default=None, description="Absolute spot shocks"
    )
    vol_shocks: Optional[list[float]] = Field(
        default=None, description="Absolute vol shocks"
    )


class ScenarioGridResponse(BaseModel):
    """P&L grid across spot and vol shocks."""

    spot_shocks: list[float]
    vol_shocks: list[float]
    pnl_grid: list[list[float]]
    base_price: float


# ── Model Comparison ─────────────────────────────────────────────────────────

class ModelComparisonRequest(BaseModel):
    """Request to compare prices across multiple models."""

    option: OptionContract
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Annualised volatility")
    models: list[str] = Field(
        ..., description="List of model keys to compare (e.g. ['black_scholes', 'binomial', 'trinomial'])"
    )
    steps: int = Field(default=200, ge=1, description="Number of tree steps")


class ModelComparisonResult(BaseModel):
    """Result for a single model in the comparison."""

    model: str
    model_name: str
    price: float
    computation_time_ms: float
    metadata: Optional[dict] = None


class ModelComparisonResponse(BaseModel):
    """Response containing comparison results for all requested models."""

    results: list[ModelComparisonResult]
    reference_model: str = Field(
        default="black_scholes", description="Which model is the reference"
    )


# ── Portfolio Analytics ──────────────────────────────────────────────────────

class PortfolioPositionInput(BaseModel):
    """A single option position for portfolio analytics."""

    instrument_id: str = Field(..., description="Unique identifier")
    instrument_type: str = Field(default="option", description="option or equity")
    quantity: float = Field(..., gt=0, description="Number of contracts")
    side: str = Field(..., description="'long' or 'short'")
    spot: float = Field(..., gt=0, description="Underlying spot price")
    strike: float = Field(default=100.0, gt=0, description="Strike price (for options)")
    expiry_years: float = Field(default=1.0, gt=0, description="Time to expiry (for options)")
    option_type: str = Field(default="call", description="'call' or 'put'")
    dividend_yield: float = Field(default=0.0, ge=0, description="Continuous dividend yield")


class PortfolioAnalyticsRequest(BaseModel):
    """Full portfolio analytics request."""

    positions: list[PortfolioPositionInput]
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Default annualised vol")
    vol_overrides: Optional[dict[str, float]] = Field(
        default=None, description="Per-instrument vol overrides"
    )
    confidence: float = Field(default=0.95, gt=0, lt=1, description="VaR confidence level")
    holding_days: int = Field(default=1, ge=1, description="Holding period in trading days")
    var_method: str = Field(default="parametric", description="'parametric' or 'monte_carlo'")
    num_scenarios: int = Field(default=10000, ge=100, description="MC VaR scenarios")
    seed: Optional[int] = Field(default=None, description="Random seed for MC")


class PortfolioAnalyticsResponse(BaseModel):
    """Full portfolio analytics response."""

    total_value: float
    positions_valued: list[dict]
    risk_metrics: dict
    var: float
    es: float
    var_method: str
    pnl_distribution: Optional[list[float]] = None
    metadata: Optional[dict] = None


# ── Hedging Error ────────────────────────────────────────────────────────────

class HedgingSimRequest(BaseModel):
    """Request for a discrete hedging error simulation."""

    option: OptionContract
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Annualised volatility")
    rebalance_steps: int = Field(
        default=50, ge=1, le=1000, description="Number of rebalancing intervals"
    )
    transaction_cost_rate: float = Field(
        default=0.0, ge=0, le=0.1, description="Proportional txn cost (e.g. 0.001 = 10bps)"
    )
    num_paths: int = Field(default=1, ge=1, le=500, description="Number of simulation paths")
    seed: Optional[int] = Field(default=None, description="Random seed")


class HedgingPathResult(BaseModel):
    """Result for a single hedging simulation path."""

    spot_path: list[float]
    delta_path: list[float]
    cash_path: list[float]
    total_transaction_costs: float
    final_hedge_error: float
    option_payoff: float
    hedge_portfolio_value: float


class HedgingSimResponse(BaseModel):
    """Response from the hedging error simulation."""

    bsm_price: float
    paths: list[HedgingPathResult]
    summary: dict[str, float]
    rebalance_steps: int
    transaction_cost_rate: float
