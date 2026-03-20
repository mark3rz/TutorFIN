"""Pydantic schemas for market data endpoints.

All models here are **response-only** — the market-data router uses GET
endpoints with query parameters rather than POST request bodies.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Quote ────────────────────────────────────────────────────────────────────


class QuoteResponse(BaseModel):
    """Real-time quote snapshot for a single ticker."""

    ticker: str = Field(..., description="Normalised ticker symbol (uppercase)")
    name: str = Field(..., description="Company / instrument name")
    spot: float = Field(..., description="Last traded price")
    currency: str = Field("USD", description="Quote currency")
    change: float = Field(0.0, description="Absolute price change vs previous close")
    change_pct: float = Field(0.0, description="Percentage change vs previous close")
    volume: int = Field(0, description="Latest trading volume")
    market_cap: int = Field(0, description="Market capitalisation")
    timestamp: str = Field(..., description="ISO-8601 timestamp of the quote")


# ── Historical Bars ──────────────────────────────────────────────────────────


class HistoryBar(BaseModel):
    """Single OHLCV bar."""

    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int = 0


class HistoryResponse(BaseModel):
    """Historical price series."""

    ticker: str
    period: str
    interval: str
    bars: list[HistoryBar]


# ── Options Chain ────────────────────────────────────────────────────────────


class OptionQuote(BaseModel):
    """Single option quote from the chain."""

    strike: float
    bid: float = 0.0
    ask: float = 0.0
    last: float = 0.0
    volume: int = 0
    open_interest: int = 0
    implied_vol: float = 0.0
    option_type: str = "call"


class OptionsChainResponse(BaseModel):
    """Full option chain for one expiration."""

    ticker: str
    expiration: str
    calls: list[OptionQuote]
    puts: list[OptionQuote]


# ── Expirations ──────────────────────────────────────────────────────────────


class ExpirationResponse(BaseModel):
    """Available option expiration dates for a ticker."""

    ticker: str
    expirations: list[str]


# ── Ticker Search ────────────────────────────────────────────────────────────


class TickerSearchResult(BaseModel):
    """Single search result."""

    symbol: str
    name: str
    exchange: str = ""
    instrument_type: str = "EQUITY"


class SearchResponse(BaseModel):
    """Search results wrapper."""

    results: list[TickerSearchResult]
