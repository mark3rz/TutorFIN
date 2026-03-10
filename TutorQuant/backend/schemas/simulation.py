"""Monte Carlo simulation schemas for TutorQuant."""

from typing import Optional

from pydantic import BaseModel, Field

from schemas.instruments import OptionContract


class SimulationConfig(BaseModel):
    """Configuration for a Monte Carlo simulation run."""

    num_paths: int = Field(default=1000, gt=0, description="Number of sample paths")
    num_steps: int = Field(
        default=252, gt=0, description="Time steps per path (252 ~ daily for 1yr)"
    )
    seed: Optional[int] = Field(
        default=None, description="RNG seed for reproducibility"
    )
    antithetic: bool = Field(
        default=True, description="Use antithetic variates for variance reduction"
    )


class MonteCarloRequest(BaseModel):
    """Request payload for a Monte Carlo option pricing run."""

    option: OptionContract
    risk_free_rate: float = Field(..., description="Annualised risk-free rate")
    volatility: float = Field(..., gt=0, description="Annualised volatility")
    simulation_config: SimulationConfig = Field(default_factory=SimulationConfig)
    model: str = Field(
        default="gbm",
        description="Dynamics model for the underlying (gbm, heston, merton, ...)",
    )


class PathData(BaseModel):
    """Simulated path payload returned to the frontend for visualisation."""

    representative_path: list[float] = Field(
        ..., description="A single representative (e.g. median) simulated path"
    )
    path_fan: list[list[float]] = Field(
        ..., description="Subset of paths for fan-chart rendering"
    )
    terminal_values: list[float] = Field(
        ..., description="Terminal asset values across all paths"
    )


class ConvergenceDiagnostics(BaseModel):
    """Running statistics used to visualise MC convergence."""

    running_mean: list[float] = Field(
        ..., description="Cumulative mean of the discounted payoff"
    )
    running_std: list[float] = Field(
        ..., description="Cumulative std-dev of the discounted payoff"
    )
    confidence_interval_95: tuple[float, float] = Field(
        ..., description="Final 95% confidence interval (lower, upper)"
    )


class MonteCarloResponse(BaseModel):
    """Response payload for a Monte Carlo pricing request."""

    price: float
    std_error: float
    confidence_interval_95: tuple[float, float]
    paths: PathData
    convergence: ConvergenceDiagnostics
    computation_time_ms: float
