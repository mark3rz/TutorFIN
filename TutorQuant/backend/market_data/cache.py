"""Simple TTL-based in-memory cache for market data.

Provides a lightweight caching layer so that repeated requests for the same
ticker / period don't hammer the upstream data source.  No external
dependencies — just a dict + timestamps.
"""

from __future__ import annotations

import time
from typing import Any


class MarketDataCache:
    """Thread-safe(*) in-memory cache with per-key TTL.

    (*) CPython's GIL makes dict operations atomic for our use-case
    (single-process educational app).  For production, swap in Redis.
    """

    # Default TTLs (seconds) for each data category
    TTL_QUOTE = 30          # live quotes refresh fast
    TTL_HISTORY = 300       # historical bars change slowly
    TTL_OPTIONS_CHAIN = 60  # option chains update with the market
    TTL_EXPIRATIONS = 600   # available expirations rarely change
    TTL_SEARCH = 600        # ticker search results are very stable

    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str, ttl: float | None = None) -> Any | None:
        """Return cached value if present and not expired, else ``None``."""
        entry = self._store.get(key)
        if entry is None:
            return None
        stored_at, value = entry
        if ttl is not None and (time.time() - stored_at) > ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        """Store *value* under *key* with the current timestamp."""
        self._store[key] = (time.time(), value)

    def invalidate(self, key: str) -> None:
        """Remove a specific key from the cache."""
        self._store.pop(key, None)

    def clear(self) -> None:
        """Flush the entire cache."""
        self._store.clear()

    @property
    def size(self) -> int:
        """Return the number of entries currently held."""
        return len(self._store)
