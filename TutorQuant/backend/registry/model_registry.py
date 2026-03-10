"""Generic model registry implementing the factory / service-locator pattern.

Usage:
    from registry.model_registry import pricing_model_registry

    # Registration (typically at import time inside each engine module)
    pricing_model_registry.register("black_scholes", BlackScholesPricingEngine)

    # Lookup
    engine_cls = pricing_model_registry.get("black_scholes")
    engine = engine_cls()
    price = engine.price(option, market_data)
"""

from __future__ import annotations

from typing import Any


class ModelRegistry:
    """A simple key -> class registry with lookup and listing helpers."""

    def __init__(self, name: str = "unnamed") -> None:
        self._name = name
        self._registry: dict[str, Any] = {}

    # ── public API ────────────────────────────────────────────────────────

    def register(self, model_key: str, model_class: Any) -> None:
        """Register *model_class* under *model_key*.

        Overwrites silently if the key already exists so that hot-reloading
        during development does not raise.
        """
        self._registry[model_key] = model_class

    def get(self, model_key: str) -> Any:
        """Return the class registered under *model_key*.

        Raises:
            KeyError: If *model_key* has not been registered.  The error
                message lists all available keys to aid debugging.
        """
        try:
            return self._registry[model_key]
        except KeyError:
            available = ", ".join(sorted(self._registry)) or "(none)"
            raise KeyError(
                f"Model '{model_key}' is not registered in the "
                f"'{self._name}' registry.  Available models: {available}"
            ) from None

    def list_models(self) -> list[str]:
        """Return a sorted list of all registered model keys."""
        return sorted(self._registry)

    # ── dunder helpers ────────────────────────────────────────────────────

    def __contains__(self, key: str) -> bool:
        return key in self._registry

    def __len__(self) -> int:
        return len(self._registry)

    def __repr__(self) -> str:
        return (
            f"ModelRegistry(name={self._name!r}, "
            f"models={self.list_models()})"
        )


# ── Global singleton registries ──────────────────────────────────────────────

pricing_model_registry = ModelRegistry(name="pricing")
rate_model_registry = ModelRegistry(name="rate")
vol_model_registry = ModelRegistry(name="volatility")
