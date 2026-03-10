"""Tests for volatility utilities: historical vol, EWMA, IV solver, surface.

Test groups
-----------
1. Log returns computation
2. Historical (close-to-close) volatility
3. Rolling historical volatility
4. EWMA volatility
5. EWMA volatility series
6. Implied volatility solver
7. IV with Greeks
8. IV surface from quotes
9. Demo surface generation
10. Realized vs implied comparison
11. Edge cases and error handling
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from engine.volatility.historical import (
    log_returns,
    historical_volatility,
    rolling_historical_volatility,
    ewma_volatility,
    ewma_volatility_series,
)
from engine.volatility.implied import (
    implied_volatility,
    implied_volatility_with_greeks,
    implied_volatility_surface,
    generate_demo_surface,
    realized_vs_implied,
)
from engine.models.black_scholes import bsm_price


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_daily_gbm_prices(
    S0: float = 100.0,
    mu: float = 0.05,
    sigma: float = 0.20,
    n_days: int = 252,
    seed: int = 42,
) -> list[float]:
    """Generate GBM daily price path for testing.

    Each step represents one trading day (dt = 1/252 year).
    Use ann_factor=252 when computing volatility from these prices.
    """
    rng = np.random.default_rng(seed)
    dt = 1.0 / 252.0  # one trading day
    prices = [S0]
    for _ in range(n_days):
        z = rng.standard_normal()
        S_new = prices[-1] * math.exp((mu - 0.5 * sigma ** 2) * dt + sigma * math.sqrt(dt) * z)
        prices.append(S_new)
    return prices


# ---------------------------------------------------------------------------
# 1. Log Returns
# ---------------------------------------------------------------------------

class TestLogReturns:
    def test_basic(self):
        prices = [100, 110, 105, 115]
        rets = log_returns(prices)
        assert len(rets) == 3
        assert abs(rets[0] - math.log(110 / 100)) < 1e-12
        assert abs(rets[1] - math.log(105 / 110)) < 1e-12

    def test_too_few_prices(self):
        with pytest.raises(ValueError, match="at least 2"):
            log_returns([100])

    def test_negative_price(self):
        with pytest.raises(ValueError, match="must be > 0"):
            log_returns([100, -50, 80])

    def test_zero_price(self):
        with pytest.raises(ValueError, match="must be > 0"):
            log_returns([100, 0, 80])

    def test_constant_prices(self):
        rets = log_returns([100, 100, 100])
        assert np.allclose(rets, 0.0)


# ---------------------------------------------------------------------------
# 2. Historical Volatility
# ---------------------------------------------------------------------------

class TestHistoricalVolatility:
    def test_known_vol(self):
        """GBM with known sigma should give close estimate."""
        true_sigma = 0.20
        prices = _generate_daily_gbm_prices(sigma=true_sigma, n_days=5000, seed=123)
        hvol = historical_volatility(prices, ann_factor=252.0)
        # With 5000 daily observations, estimate should be within 3pp
        assert abs(hvol - true_sigma) < 0.03, f"Expected ~{true_sigma}, got {hvol}"

    def test_window(self):
        prices = _generate_daily_gbm_prices(n_days=252)
        hvol_full = historical_volatility(prices)
        hvol_window = historical_volatility(prices, window=50)
        # Both should be positive, but may differ
        assert hvol_full > 0
        assert hvol_window > 0

    def test_window_too_small(self):
        with pytest.raises(ValueError, match="Window must be >= 2"):
            historical_volatility([100, 110, 105], window=1)

    def test_ann_factor(self):
        prices = _generate_daily_gbm_prices(n_days=100)
        hvol_252 = historical_volatility(prices, ann_factor=252)
        hvol_52 = historical_volatility(prices, ann_factor=52)
        # sqrt(252/52) ≈ 2.2, so daily-annualised should be larger
        assert hvol_252 > hvol_52


# ---------------------------------------------------------------------------
# 3. Rolling Historical Volatility
# ---------------------------------------------------------------------------

class TestRollingHistoricalVol:
    def test_output_length(self):
        prices = _generate_daily_gbm_prices(n_days=100)
        idx, vols = rolling_historical_volatility(prices, window=21)
        expected_len = 100 - 21 + 1  # 100 returns, window 21
        assert len(idx) == expected_len
        assert len(vols) == expected_len

    def test_all_positive(self):
        prices = _generate_daily_gbm_prices(n_days=100)
        _, vols = rolling_historical_volatility(prices, window=21)
        assert np.all(vols > 0)

    def test_window_too_large(self):
        prices = _generate_daily_gbm_prices(n_days=10)
        with pytest.raises(ValueError, match="Need at least"):
            rolling_historical_volatility(prices, window=20)


# ---------------------------------------------------------------------------
# 4. EWMA Volatility
# ---------------------------------------------------------------------------

class TestEWMAVolatility:
    def test_positive(self):
        prices = _generate_daily_gbm_prices(n_days=100)
        evol = ewma_volatility(prices)
        assert evol > 0

    def test_known_vol_estimate(self):
        """EWMA should give a reasonable estimate of the generating volatility."""
        true_sigma = 0.25
        prices = _generate_daily_gbm_prices(sigma=true_sigma, n_days=5000, seed=456)
        evol = ewma_volatility(prices, lam=0.94)
        # EWMA is end-weighted so might deviate more, but should be in ballpark
        assert abs(evol - true_sigma) < 0.08, f"Expected ~{true_sigma}, got {evol}"

    def test_lambda_bounds(self):
        prices = _generate_daily_gbm_prices(n_days=50)
        with pytest.raises(ValueError, match="Lambda must be in"):
            ewma_volatility(prices, lam=0.0)
        with pytest.raises(ValueError, match="Lambda must be in"):
            ewma_volatility(prices, lam=1.0)
        with pytest.raises(ValueError, match="Lambda must be in"):
            ewma_volatility(prices, lam=-0.1)

    def test_high_vs_low_lambda(self):
        """Lower lambda means more reactive to recent data."""
        prices = _generate_daily_gbm_prices(n_days=100)
        evol_high = ewma_volatility(prices, lam=0.99)
        evol_low = ewma_volatility(prices, lam=0.80)
        # Both should be positive
        assert evol_high > 0
        assert evol_low > 0


# ---------------------------------------------------------------------------
# 5. EWMA Volatility Series
# ---------------------------------------------------------------------------

class TestEWMAVolatilitySeries:
    def test_output_length(self):
        prices = _generate_daily_gbm_prices(n_days=50)
        idx, vols = ewma_volatility_series(prices)
        # Returns are len(prices)-1 = 50, so EWMA series has 50 points
        assert len(idx) == 50
        assert len(vols) == 50

    def test_all_positive(self):
        prices = _generate_daily_gbm_prices(n_days=50)
        _, vols = ewma_volatility_series(prices)
        assert np.all(vols > 0)


# ---------------------------------------------------------------------------
# 6. Implied Volatility Solver
# ---------------------------------------------------------------------------

class TestImpliedVolatility:
    def test_roundtrip_call(self):
        """bsm_price(sigma) -> IV solver should recover sigma."""
        S, K, T, r, sigma, q = 100, 100, 1.0, 0.05, 0.20, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "call")
        iv = implied_volatility(price, S, K, T, r, q, "call")
        assert abs(iv - sigma) < 1e-8, f"Expected {sigma}, got {iv}"

    def test_roundtrip_put(self):
        S, K, T, r, sigma, q = 100, 100, 1.0, 0.05, 0.20, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "put")
        iv = implied_volatility(price, S, K, T, r, q, "put")
        assert abs(iv - sigma) < 1e-8

    def test_otm_call(self):
        S, K, T, r, sigma, q = 100, 120, 0.5, 0.03, 0.30, 0.01
        price = bsm_price(S, K, T, r, sigma, q, "call")
        iv = implied_volatility(price, S, K, T, r, q, "call")
        assert abs(iv - sigma) < 1e-8

    def test_itm_put(self):
        S, K, T, r, sigma, q = 100, 80, 0.25, 0.04, 0.15, 0.02
        price = bsm_price(S, K, T, r, sigma, q, "put")
        iv = implied_volatility(price, S, K, T, r, q, "put")
        assert abs(iv - sigma) < 1e-8

    def test_high_vol(self):
        """Test with high volatility (100%)."""
        S, K, T, r, sigma, q = 100, 100, 1.0, 0.05, 1.0, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "call")
        iv = implied_volatility(price, S, K, T, r, q, "call")
        assert abs(iv - sigma) < 1e-6

    def test_low_vol(self):
        """Test with low volatility (1%)."""
        S, K, T, r, sigma, q = 100, 100, 1.0, 0.05, 0.01, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "call")
        iv = implied_volatility(price, S, K, T, r, q, "call")
        assert abs(iv - sigma) < 1e-6

    def test_short_expiry(self):
        S, K, T, r, sigma, q = 100, 100, 0.01, 0.05, 0.20, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "call")
        iv = implied_volatility(price, S, K, T, r, q, "call")
        assert abs(iv - sigma) < 1e-6

    def test_with_dividend(self):
        S, K, T, r, sigma, q = 100, 100, 1.0, 0.05, 0.20, 0.03
        price = bsm_price(S, K, T, r, sigma, q, "call")
        iv = implied_volatility(price, S, K, T, r, q, "call")
        assert abs(iv - sigma) < 1e-8

    def test_negative_spot(self):
        with pytest.raises(ValueError, match="Spot price must be > 0"):
            implied_volatility(5.0, -100, 100, 1.0, 0.05)

    def test_negative_strike(self):
        with pytest.raises(ValueError, match="Strike price must be > 0"):
            implied_volatility(5.0, 100, -100, 1.0, 0.05)

    def test_negative_expiry(self):
        with pytest.raises(ValueError, match="Time to expiry must be > 0"):
            implied_volatility(5.0, 100, 100, -1.0, 0.05)

    def test_negative_market_price(self):
        with pytest.raises(ValueError, match="Market price must be > 0"):
            implied_volatility(-5.0, 100, 100, 1.0, 0.05)

    def test_price_below_intrinsic(self):
        """Call with price below intrinsic should fail."""
        S, K, T, r = 120, 100, 1.0, 0.05
        intrinsic = S * math.exp(0) - K * math.exp(-r * T)  # approximately 24.88
        with pytest.raises(ValueError, match="below intrinsic"):
            implied_volatility(0.01, S, K, T, r, 0.0, "call")

    def test_price_above_upper_bound(self):
        """Call with price above S should fail."""
        with pytest.raises(ValueError, match="exceeds upper bound"):
            implied_volatility(150.0, 100, 100, 1.0, 0.05, 0.0, "call")


# ---------------------------------------------------------------------------
# 7. IV with Greeks
# ---------------------------------------------------------------------------

class TestImpliedVolWithGreeks:
    def test_full_result(self):
        S, K, T, r, sigma, q = 100, 100, 1.0, 0.05, 0.20, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "call")
        result = implied_volatility_with_greeks(price, S, K, T, r, q, "call")

        assert abs(result["implied_vol"] - sigma) < 1e-8
        assert abs(result["bsm_price"] - price) < 1e-8
        assert abs(result["moneyness"] - 1.0) < 1e-12
        assert abs(result["log_moneyness"]) < 1e-12
        assert result["time_value"] > 0
        assert "delta" in result
        assert "gamma" in result
        assert "vega" in result
        assert "theta" in result

    def test_put(self):
        S, K, T, r, sigma, q = 100, 110, 0.5, 0.05, 0.25, 0.01
        price = bsm_price(S, K, T, r, sigma, q, "put")
        result = implied_volatility_with_greeks(price, S, K, T, r, q, "put")
        assert abs(result["implied_vol"] - sigma) < 1e-8
        assert result["delta"] < 0  # put delta is negative


# ---------------------------------------------------------------------------
# 8. IV Surface from Quotes
# ---------------------------------------------------------------------------

class TestImpliedVolSurface:
    def test_basic_surface(self):
        S, r, q, sigma = 100, 0.05, 0.0, 0.20
        quotes = []
        for K in [90, 100, 110]:
            for T in [0.25, 1.0]:
                mp = bsm_price(S, K, T, r, sigma, q, "call")
                quotes.append({
                    "strike": K,
                    "expiry_years": T,
                    "market_price": mp,
                    "option_type": "call",
                })

        results = implied_volatility_surface(quotes, S, r, q)
        assert len(results) == 6
        for r_item in results:
            assert r_item["implied_vol"] is not None
            assert abs(r_item["implied_vol"] - sigma) < 1e-6
            assert r_item["error"] is None

    def test_invalid_quote_graceful(self):
        """Bad quote should result in error field, not an exception."""
        S, r, q = 100, 0.05, 0.0
        quotes = [
            {
                "strike": 100,
                "expiry_years": 1.0,
                "market_price": 200.0,  # above upper bound
                "option_type": "call",
            }
        ]
        results = implied_volatility_surface(quotes, S, r, q)
        assert results[0]["implied_vol"] is None
        assert results[0]["error"] is not None


# ---------------------------------------------------------------------------
# 9. Demo Surface Generation
# ---------------------------------------------------------------------------

class TestDemoSurface:
    def test_default_surface(self):
        result = generate_demo_surface()
        assert result["spot"] == 100.0
        assert len(result["expiries"]) == 5
        assert len(result["strikes"]) == 13  # 70 to 130, step 5
        assert len(result["surface"]) == 5 * 13

    def test_custom_params(self):
        result = generate_demo_surface(
            S=50, r=0.03, base_vol=0.30,
            expiries=[0.25, 0.5],
            strikes=[40, 45, 50, 55, 60],
        )
        assert result["spot"] == 50.0
        assert len(result["expiries"]) == 2
        assert len(result["strikes"]) == 5
        assert len(result["surface"]) == 10

    def test_skew_present(self):
        """Lower strikes should have higher IV due to negative skew."""
        result = generate_demo_surface(skew_slope=-0.10, smile_curvature=0.0)
        # For a fixed expiry, find IV at K=80 and K=120
        T = 0.25
        pts = [p for p in result["surface"] if p["expiry_years"] == T]
        iv_low_K = next(p["implied_vol"] for p in pts if p["strike"] == 80)
        iv_high_K = next(p["implied_vol"] for p in pts if p["strike"] == 120)
        assert iv_low_K > iv_high_K, "Negative skew means lower strikes have higher IV"

    def test_term_structure_upward(self):
        """Longer expiries should have higher ATM IV with positive term slope."""
        result = generate_demo_surface(
            skew_slope=0, smile_curvature=0, term_slope=0.05
        )
        # ATM strike = 100 (= spot)
        atm_pts = [p for p in result["surface"] if p["strike"] == 100]
        ivs = [p["implied_vol"] for p in sorted(atm_pts, key=lambda x: x["expiry_years"])]
        # Should be monotonically increasing
        for i in range(1, len(ivs)):
            assert ivs[i] >= ivs[i - 1], f"ATM term structure not increasing at index {i}"

    def test_all_ivs_positive(self):
        result = generate_demo_surface()
        for p in result["surface"]:
            assert p["implied_vol"] > 0
            assert p["market_price"] > 0

    def test_roundtrip_iv(self):
        """We should be able to solve IV from the generated market prices
        and recover the original parametric IV."""
        result = generate_demo_surface()
        S = result["spot"]
        r = result["risk_free_rate"]
        q = result["dividend_yield"]

        # Test a subset to keep test fast
        for p in result["surface"][:10]:
            iv_solved = implied_volatility(
                p["market_price"], S, p["strike"], p["expiry_years"],
                r, q, p["option_type"]
            )
            assert abs(iv_solved - p["implied_vol"]) < 1e-6, (
                f"Roundtrip failed: generated IV={p['implied_vol']:.6f}, "
                f"solved IV={iv_solved:.6f}"
            )


# ---------------------------------------------------------------------------
# 10. Realized vs Implied Comparison
# ---------------------------------------------------------------------------

class TestRealizedVsImplied:
    def test_basic(self):
        prices = _generate_daily_gbm_prices(sigma=0.20, n_days=100)
        result = realized_vs_implied(prices, implied_vol=0.20, window=21)
        assert len(result["indices"]) == len(result["realized_vol"])
        assert result["implied_vol"] == 0.20
        assert result["mean_realized"] > 0
        # vol_risk_premium = implied - mean_realized
        assert abs(
            result["vol_risk_premium"]
            - (result["implied_vol"] - result["mean_realized"])
        ) < 1e-12

    def test_short_series(self):
        """Series shorter than window should still work (fewer rolling points)."""
        prices = _generate_daily_gbm_prices(sigma=0.20, n_days=30)
        result = realized_vs_implied(prices, implied_vol=0.20, window=21)
        assert len(result["indices"]) > 0


# ---------------------------------------------------------------------------
# 11. Edge Cases and Integration
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_deep_itm_call_iv(self):
        """Deep ITM call should solve correctly."""
        S, K, T, r, sigma, q = 150, 100, 1.0, 0.05, 0.30, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "call")
        iv = implied_volatility(price, S, K, T, r, q, "call")
        assert abs(iv - sigma) < 1e-6

    def test_deep_otm_put_iv(self):
        """Deep OTM put should solve correctly."""
        S, K, T, r, sigma, q = 150, 100, 1.0, 0.05, 0.30, 0.0
        price = bsm_price(S, K, T, r, sigma, q, "put")
        iv = implied_volatility(price, S, K, T, r, q, "put")
        assert abs(iv - sigma) < 1e-6

    def test_many_strikes_roundtrip(self):
        """IV solve across a range of strikes."""
        S, T, r, sigma, q = 100, 0.5, 0.05, 0.25, 0.0
        for K in range(80, 121, 5):
            for otype in ["call", "put"]:
                price = bsm_price(S, K, T, r, sigma, q, otype)
                iv = implied_volatility(price, S, K, T, r, q, otype)
                assert abs(iv - sigma) < 1e-6, (
                    f"Failed for K={K}, type={otype}: expected {sigma}, got {iv}"
                )

    def test_historical_vol_constant_prices(self):
        """All same prices should give zero vol (or near-zero)."""
        prices = [100.0] * 50
        # log returns are all zero
        hvol = historical_volatility(prices)
        assert hvol == 0.0

    def test_ewma_constant_prices(self):
        """EWMA of constant prices should converge to zero."""
        prices = [100.0] * 50
        evol = ewma_volatility(prices)
        assert evol == 0.0
