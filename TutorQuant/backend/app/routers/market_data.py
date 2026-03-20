"""Market data router — live quotes, history, and options chains via Yahoo Finance.

All endpoints are **GET** (read-only data fetching), unlike the compute-heavy
POST endpoints elsewhere in the API.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from market_data.cache import MarketDataCache
from market_data.yahoo import YahooFinanceAdapter
from schemas.market_data import (
    ExpirationResponse,
    HistoryBar,
    HistoryResponse,
    OptionQuote,
    OptionsChainResponse,
    QuoteResponse,
    SearchResponse,
    TickerSearchResult,
)

router = APIRouter(prefix="/api/market-data", tags=["Market Data"])

# Shared adapter + cache (module-level singletons)
_cache = MarketDataCache()
_adapter = YahooFinanceAdapter(cache=_cache)


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/quote", response_model=QuoteResponse)
async def get_quote(
    ticker: str = Query(..., description="Ticker symbol, e.g. AAPL"),
) -> QuoteResponse:
    """Fetch a real-time quote for a single ticker."""
    try:
        data = _adapter.get_quote(ticker)
        return QuoteResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Market data unavailable: {exc}",
        ) from exc


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    ticker: str = Query(..., description="Ticker symbol"),
    period: str = Query("1y", description="Period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max)"),
    interval: str = Query("1d", description="Bar interval (1m, 5m, 15m, 1h, 1d, 1wk, 1mo)"),
) -> HistoryResponse:
    """Fetch OHLCV historical bars."""
    try:
        data = _adapter.get_history(ticker, period=period, interval=interval)
        return HistoryResponse(
            ticker=data["ticker"],
            period=data["period"],
            interval=data["interval"],
            bars=[HistoryBar(**b) for b in data["bars"]],
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Market data unavailable: {exc}",
        ) from exc


@router.get("/options", response_model=OptionsChainResponse)
async def get_options_chain(
    ticker: str = Query(..., description="Ticker symbol"),
    expiration: str = Query(..., description="Expiration date (YYYY-MM-DD)"),
) -> OptionsChainResponse:
    """Fetch the full options chain for one expiration."""
    try:
        data = _adapter.get_options_chain(ticker, expiration)
        return OptionsChainResponse(
            ticker=data["ticker"],
            expiration=data["expiration"],
            calls=[OptionQuote(**c) for c in data["calls"]],
            puts=[OptionQuote(**p) for p in data["puts"]],
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Market data unavailable: {exc}",
        ) from exc


@router.get("/expirations", response_model=ExpirationResponse)
async def get_expirations(
    ticker: str = Query(..., description="Ticker symbol"),
) -> ExpirationResponse:
    """List available option expiration dates."""
    try:
        exps = _adapter.get_expirations(ticker)
        return ExpirationResponse(ticker=ticker.upper(), expirations=exps)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Market data unavailable: {exc}",
        ) from exc


@router.get("/search", response_model=SearchResponse)
async def search_tickers(
    q: str = Query(..., min_length=1, description="Search query"),
) -> SearchResponse:
    """Search for ticker symbols matching a query string."""
    try:
        matches = _adapter.search_ticker(q)
        return SearchResponse(
            results=[TickerSearchResult(**m) for m in matches],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Search unavailable: {exc}",
        ) from exc
