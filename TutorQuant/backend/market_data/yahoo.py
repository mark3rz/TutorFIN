"""Yahoo Finance market data adapter for TutorQuant.

Wraps the ``yfinance`` library to provide live quotes, historical bars,
options chains, and ticker search.  All calls go through the
:class:`~market_data.cache.MarketDataCache` to avoid hammering Yahoo's
servers.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

import yfinance as yf

from market_data.adapter import MarketDataAdapter
from market_data.cache import MarketDataCache


class YahooFinanceAdapter(MarketDataAdapter):
    """Concrete adapter backed by Yahoo Finance via *yfinance*."""

    def __init__(self, cache: MarketDataCache | None = None) -> None:
        self._cache = cache or MarketDataCache()

    # ── MarketDataAdapter ABC ─────────────────────────────────────────

    def get_spot(self, ticker: str) -> float:
        """Return the latest spot (regular-market) price for *ticker*."""
        quote = self.get_quote(ticker)
        return quote["spot"]

    def get_risk_free_rate(self) -> float:
        """Return the 13-week T-Bill yield as a proxy for the risk-free rate."""
        try:
            tbill = yf.Ticker("^IRX")
            hist = tbill.history(period="5d")
            if hist.empty:
                return 0.05  # fallback
            return float(hist["Close"].iloc[-1]) / 100.0
        except Exception:
            return 0.05

    def get_vol_surface(self, ticker: str) -> dict:
        """Build a simple vol surface from the options chain.

        Returns a dict keyed by ``(expiry_years, strike)`` → implied vol.
        """
        surface: dict[tuple[float, float], float] = {}
        try:
            expirations = self.get_expirations(ticker)
            now = dt.date.today()
            for exp_str in expirations[:4]:  # limit to 4 nearest expiries
                exp_date = dt.date.fromisoformat(exp_str)
                t_years = max((exp_date - now).days / 365.0, 0.01)
                chain = self.get_options_chain(ticker, exp_str)
                for opt in chain.get("calls", []) + chain.get("puts", []):
                    iv = opt.get("implied_vol")
                    strike = opt.get("strike")
                    if iv and strike and iv > 0:
                        surface[(round(t_years, 4), strike)] = iv
        except Exception:
            pass
        return surface

    def get_yield_curve(self) -> list[float]:
        """Return a simple yield curve from Treasury ETF proxies.

        Falls back to a reasonable default if fetching fails.
        """
        # Tenors: 1Y, 2Y, 3Y, 5Y, 7Y, 10Y (we interpolate the gaps)
        tickers = {
            "^IRX": 0,   # 13-week T-Bill → proxy for 1Y
            "^FVX": 4,   # 5-year Treasury
            "^TNX": 9,   # 10-year Treasury
        }
        rates = [None] * 10
        try:
            for sym, idx in tickers.items():
                t = yf.Ticker(sym)
                hist = t.history(period="5d")
                if not hist.empty:
                    rates[idx] = float(hist["Close"].iloc[-1]) / 100.0
        except Exception:
            pass

        # Fill gaps with linear interpolation / fallback
        if rates[0] is None:
            rates[0] = 0.04
        if rates[4] is None:
            rates[4] = 0.04
        if rates[9] is None:
            rates[9] = 0.045

        # Linear interpolation between known points
        known = [(0, rates[0]), (4, rates[4]), (9, rates[9])]
        for i in range(10):
            if rates[i] is not None:
                continue
            # Find surrounding known points
            lo = max((k for k, _ in known if k <= i), default=0)
            hi = min((k for k, _ in known if k >= i), default=9)
            lo_val = rates[lo] or 0.04
            hi_val = rates[hi] or 0.045
            if hi == lo:
                rates[i] = lo_val
            else:
                rates[i] = lo_val + (hi_val - lo_val) * (i - lo) / (hi - lo)

        return [r or 0.04 for r in rates]

    # ── Extended methods (beyond ABC) ─────────────────────────────────

    def get_quote(self, ticker: str) -> dict[str, Any]:
        """Fetch a live quote for *ticker*, cached for 30 s."""
        cache_key = f"quote:{ticker.upper()}"
        cached = self._cache.get(cache_key, MarketDataCache.TTL_QUOTE)
        if cached is not None:
            return cached

        t = yf.Ticker(ticker)
        info = t.fast_info
        # fast_info is lightweight — avoids the heavy .info call
        try:
            spot = float(info["lastPrice"])
        except (KeyError, TypeError):
            # Fallback to history
            hist = t.history(period="1d")
            if hist.empty:
                raise ValueError(f"No data found for ticker '{ticker}'")
            spot = float(hist["Close"].iloc[-1])

        import math

        prev_close_raw = info.get("previousClose", spot)
        prev_close = float(prev_close_raw) if prev_close_raw is not None and not (isinstance(prev_close_raw, float) and math.isnan(prev_close_raw)) else spot
        change = spot - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0.0

        def _safe_int_val(val: object, default: int = 0) -> int:
            try:
                f = float(val)  # type: ignore[arg-type]
                return default if math.isnan(f) else int(f)
            except (TypeError, ValueError):
                return default

        result = {
            "ticker": ticker.upper(),
            "name": ticker.upper(),  # fast_info doesn't have longName
            "spot": round(spot, 4),
            "currency": str(info.get("currency", "USD")),
            "change": round(change, 4),
            "change_pct": round(change_pct, 2),
            "volume": _safe_int_val(info.get("lastVolume", 0)),
            "market_cap": _safe_int_val(info.get("marketCap", 0)),
            "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        }

        # Try to get the real company name (cached separately since it's slow)
        name_key = f"name:{ticker.upper()}"
        cached_name = self._cache.get(name_key, 3600)  # cache name for 1h
        if cached_name:
            result["name"] = cached_name
        else:
            try:
                full_info = t.info
                name = full_info.get("longName") or full_info.get("shortName") or ticker.upper()
                result["name"] = name
                self._cache.set(name_key, name)
            except Exception:
                pass

        self._cache.set(cache_key, result)
        return result

    def get_history(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> dict[str, Any]:
        """Fetch OHLCV history for *ticker*."""
        cache_key = f"hist:{ticker.upper()}:{period}:{interval}"
        cached = self._cache.get(cache_key, MarketDataCache.TTL_HISTORY)
        if cached is not None:
            return cached

        t = yf.Ticker(ticker)
        hist = t.history(period=period, interval=interval)
        if hist.empty:
            raise ValueError(f"No history for ticker '{ticker}'")

        bars = []
        for date, row in hist.iterrows():
            bars.append({
                "date": str(date.date()) if hasattr(date, "date") else str(date)[:10],
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row.get("Volume", 0)),
            })

        result = {
            "ticker": ticker.upper(),
            "period": period,
            "interval": interval,
            "bars": bars,
        }

        self._cache.set(cache_key, result)
        return result

    def get_options_chain(
        self,
        ticker: str,
        expiration: str,
    ) -> dict[str, Any]:
        """Fetch the options chain for *ticker* at a given expiration date."""
        cache_key = f"chain:{ticker.upper()}:{expiration}"
        cached = self._cache.get(cache_key, MarketDataCache.TTL_OPTIONS_CHAIN)
        if cached is not None:
            return cached

        t = yf.Ticker(ticker)
        try:
            chain = t.option_chain(expiration)
        except Exception as exc:
            raise ValueError(
                f"No options chain for '{ticker}' at {expiration}: {exc}"
            ) from exc

        def _safe_float(val: Any, default: float = 0.0) -> float:
            """Convert to float, returning *default* for NaN / None."""
            import math
            try:
                f = float(val)
                return default if math.isnan(f) else f
            except (TypeError, ValueError):
                return default

        def _safe_int(val: Any, default: int = 0) -> int:
            """Convert to int, returning *default* for NaN / None."""
            import math
            try:
                f = float(val)
                return default if math.isnan(f) else int(f)
            except (TypeError, ValueError):
                return default

        def _parse_side(df: Any, opt_type: str) -> list[dict]:
            rows = []
            for _, row in df.iterrows():
                rows.append({
                    "strike": round(_safe_float(row.get("strike", 0)), 2),
                    "bid": round(_safe_float(row.get("bid", 0)), 4),
                    "ask": round(_safe_float(row.get("ask", 0)), 4),
                    "last": round(_safe_float(row.get("lastPrice", 0)), 4),
                    "volume": _safe_int(row.get("volume", 0)),
                    "open_interest": _safe_int(row.get("openInterest", 0)),
                    "implied_vol": round(_safe_float(row.get("impliedVolatility", 0)), 6),
                    "option_type": opt_type,
                })
            return rows

        result = {
            "ticker": ticker.upper(),
            "expiration": expiration,
            "calls": _parse_side(chain.calls, "call"),
            "puts": _parse_side(chain.puts, "put"),
        }

        self._cache.set(cache_key, result)
        return result

    def get_expirations(self, ticker: str) -> list[str]:
        """Return available option expiration dates for *ticker*."""
        cache_key = f"exp:{ticker.upper()}"
        cached = self._cache.get(cache_key, MarketDataCache.TTL_EXPIRATIONS)
        if cached is not None:
            return cached

        t = yf.Ticker(ticker)
        try:
            expirations = list(t.options)
        except Exception:
            raise ValueError(f"No options expirations for '{ticker}'")

        self._cache.set(cache_key, expirations)
        return expirations

    def search_ticker(self, query: str) -> list[dict[str, str]]:
        """Search for tickers matching *query*."""
        cache_key = f"search:{query.lower()}"
        cached = self._cache.get(cache_key, MarketDataCache.TTL_SEARCH)
        if cached is not None:
            return cached

        try:
            results = yf.Search(query)
            quotes = getattr(results, "quotes", []) or []
        except Exception:
            quotes = []

        matches = []
        for q in quotes[:15]:  # limit results
            matches.append({
                "symbol": q.get("symbol", ""),
                "name": q.get("longname") or q.get("shortname") or q.get("symbol", ""),
                "exchange": q.get("exchange", ""),
                "instrument_type": q.get("quoteType", "EQUITY"),
            })

        self._cache.set(cache_key, matches)
        return matches
