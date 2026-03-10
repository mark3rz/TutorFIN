"""Abstract base class for all pricing engines in TutorQuant.

Every concrete pricing engine (Black-Scholes, binomial, Heston, etc.) must
subclass ``PricingEngine`` and implement :meth:`price`, :attr:`name`, and
:attr:`supported_exercises`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from schemas.instruments import OptionContract


class PricingEngine(ABC):
    """Base class that every option pricing engine must implement."""

    @abstractmethod
    def price(self, option: OptionContract, market_data: dict[str, Any]) -> float:
        """Compute the fair value of *option* given *market_data*.

        Parameters
        ----------
        option:
            Fully specified option contract.
        market_data:
            Dictionary containing at minimum ``risk_free_rate`` and
            ``volatility``.  Model-specific engines may require additional
            keys (e.g. Heston parameters).

        Returns
        -------
        float
            The option's theoretical fair value.
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this pricing engine (e.g. ``'Black-Scholes'``)."""
        ...

    @property
    @abstractmethod
    def supported_exercises(self) -> list[str]:
        """List of exercise styles this engine can handle.

        Must return a subset of ``['european', 'american', 'bermudan']``.
        """
        ...

    # ── concrete helpers ──────────────────────────────────────────────────

    def validate(self, option: OptionContract) -> None:
        """Raise ``ValueError`` if *option*'s exercise style is not supported.

        This is called automatically before :meth:`price` in most router
        dispatch paths.
        """
        style = option.exercise_style.value
        if style not in self.supported_exercises:
            raise ValueError(
                f"Engine '{self.name}' does not support {style!r} options.  "
                f"Supported styles: {self.supported_exercises}"
            )

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name={self.name!r})>"
