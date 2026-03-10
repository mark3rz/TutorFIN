"""Market data adapter layer for TutorQuant.

Provides an abstract interface for market data retrieval and a concrete
``DemoMarketDataAdapter`` that returns hard-coded values suitable for local
development and unit testing.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class MarketDataAdapter(ABC):
    """Abstract interface every market data source must implement."""

    @abstractmethod
    def get_spot(self, ticker: str) -> float:
        """Return the current spot price for *ticker*."""
        ...

    @abstractmethod
    def get_risk_free_rate(self) -> float:
        """Return the current annualised risk-free rate."""
        ...

    @abstractmethod
    def get_vol_surface(self, ticker: str) -> dict:
        """Return a volatility surface for *ticker*.

        The returned dict should be keyed by ``(expiry, strike)`` tuples
        mapping to implied volatilities.  Concrete implementations may
        return a more structured object.
        """
        ...

    @abstractmethod
    def get_yield_curve(self) -> list[float]:
        """Return the current zero-coupon yield curve as a list of rates.

        Element *i* corresponds to the rate for tenor *i + 1* years.
        """
        ...


class DemoMarketDataAdapter(MarketDataAdapter):
    """Hard-coded demo data for development and testing.

    All methods return deterministic, financially reasonable placeholder
    values so that the API can be exercised without a live data feed.
    """

    def get_spot(self, ticker: str) -> float:
        """Return a fixed demo spot price of 100.0 for any ticker."""
        return 100.0

    def get_risk_free_rate(self) -> float:
        """Return a demo risk-free rate of 5%."""
        return 0.05

    def get_vol_surface(self, ticker: str) -> dict:
        """Return a flat 20% implied vol surface.

        The surface contains a small grid of expiry/strike nodes, all set
        to the same volatility for simplicity.
        """
        surface: dict[tuple[float, float], float] = {}
        expiries = [0.25, 0.5, 1.0, 2.0]
        strikes = [80.0, 90.0, 100.0, 110.0, 120.0]
        for exp in expiries:
            for k in strikes:
                surface[(exp, k)] = 0.20
        return surface

    def get_yield_curve(self) -> list[float]:
        """Return a simple upward-sloping demo yield curve (1Y-10Y)."""
        return [
            0.040,  # 1Y
            0.042,  # 2Y
            0.044,  # 3Y
            0.046,  # 4Y
            0.048,  # 5Y
            0.049,  # 6Y
            0.050,  # 7Y
            0.051,  # 8Y
            0.052,  # 9Y
            0.053,  # 10Y
        ]
