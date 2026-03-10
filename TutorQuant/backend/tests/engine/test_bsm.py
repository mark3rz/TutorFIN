"""Benchmark tests for Black-Scholes-Merton pricing and Greeks.

Reference values are computed from the standard BSM closed-form solution
and verified against widely-published textbook results.

Test parameters (unless otherwise stated):
    S = 100, K = 100, T = 1, r = 0.05, sigma = 0.20, q = 0.0
"""

from __future__ import annotations

import math

import pytest

from engine.models.black_scholes import bsm_price, _d1_d2
from engine.greeks.analytical import bsm_greeks


# ---------------------------------------------------------------------------
# Standard test parameters
# ---------------------------------------------------------------------------

S, K, T, r, sigma, q = 100.0, 100.0, 1.0, 0.05, 0.20, 0.0


# ---------------------------------------------------------------------------
# BSM Price Tests
# ---------------------------------------------------------------------------


class TestBSMPrice:
    """Closed-form BSM price benchmarks."""

    def test_atm_call_price(self) -> None:
        """ATM call ≈ 10.4506 (well-known reference value)."""
        price = bsm_price(S, K, T, r, sigma, q, "call")
        assert price == pytest.approx(10.4506, abs=0.001)

    def test_atm_put_price(self) -> None:
        """ATM put via put-call parity: P = C - S*e^(-qT) + K*e^(-rT)."""
        call = bsm_price(S, K, T, r, sigma, q, "call")
        expected_put = call - S * math.exp(-q * T) + K * math.exp(-r * T)
        put = bsm_price(S, K, T, r, sigma, q, "put")
        assert put == pytest.approx(expected_put, abs=1e-10)

    def test_put_call_parity(self) -> None:
        """C - P = S*e^(-qT) - K*e^(-rT) for any parameters."""
        call = bsm_price(S, K, T, r, sigma, q, "call")
        put = bsm_price(S, K, T, r, sigma, q, "put")
        parity = S * math.exp(-q * T) - K * math.exp(-r * T)
        assert (call - put) == pytest.approx(parity, abs=1e-10)

    def test_put_call_parity_with_dividend(self) -> None:
        """Put-call parity holds with non-zero dividend yield."""
        q_div = 0.03
        call = bsm_price(S, K, T, r, sigma, q_div, "call")
        put = bsm_price(S, K, T, r, sigma, q_div, "put")
        parity = S * math.exp(-q_div * T) - K * math.exp(-r * T)
        assert (call - put) == pytest.approx(parity, abs=1e-10)

    def test_deep_itm_call(self) -> None:
        """Deep ITM call (S=200, K=100) ≈ discounted intrinsic."""
        price = bsm_price(200, K, T, r, sigma, q, "call")
        # Should be very close to S*e^(-qT) - K*e^(-rT)
        lower_bound = 200 * math.exp(-q * T) - K * math.exp(-r * T)
        assert price >= lower_bound - 0.01

    def test_deep_otm_call(self) -> None:
        """Deep OTM call (S=50, K=100) ≈ 0."""
        price = bsm_price(50, K, T, r, sigma, q, "call")
        assert price < 0.05  # essentially zero

    def test_deep_itm_put(self) -> None:
        """Deep ITM put (S=50, K=100) ≈ discounted intrinsic."""
        price = bsm_price(50, K, T, r, sigma, q, "put")
        lower_bound = K * math.exp(-r * T) - 50 * math.exp(-q * T)
        assert price >= lower_bound - 0.01

    def test_zero_expiry_call(self) -> None:
        """At T=0, call returns intrinsic value."""
        assert bsm_price(110, K, 0, r, sigma, q, "call") == 10.0
        assert bsm_price(90, K, 0, r, sigma, q, "call") == 0.0

    def test_zero_expiry_put(self) -> None:
        """At T=0, put returns intrinsic value."""
        assert bsm_price(90, K, 0, r, sigma, q, "put") == 10.0
        assert bsm_price(110, K, 0, r, sigma, q, "put") == 0.0

    def test_negative_spot_raises(self) -> None:
        with pytest.raises(ValueError, match="Spot price"):
            bsm_price(-1, K, T, r, sigma, q, "call")

    def test_negative_strike_raises(self) -> None:
        with pytest.raises(ValueError, match="Strike price"):
            bsm_price(S, -1, T, r, sigma, q, "call")

    def test_negative_vol_raises(self) -> None:
        with pytest.raises(ValueError, match="Volatility"):
            bsm_price(S, K, T, r, -0.1, q, "call")

    def test_price_non_negative(self) -> None:
        """Option prices are always >= 0."""
        for ot in ("call", "put"):
            for s in (50, 80, 100, 120, 200):
                assert bsm_price(s, K, T, r, sigma, q, ot) >= 0.0


# ---------------------------------------------------------------------------
# d1/d2 Tests
# ---------------------------------------------------------------------------


class TestD1D2:
    """Verify d1 and d2 computation."""

    def test_atm_d1_positive(self) -> None:
        """For ATM with r > 0, d1 > 0."""
        d1, d2 = _d1_d2(S, K, T, r, sigma, q)
        assert d1 > 0

    def test_d2_less_than_d1(self) -> None:
        """d2 = d1 - sigma*sqrt(T), so d2 < d1 when sigma > 0."""
        d1, d2 = _d1_d2(S, K, T, r, sigma, q)
        assert d2 < d1
        assert d1 - d2 == pytest.approx(sigma * math.sqrt(T), abs=1e-12)


# ---------------------------------------------------------------------------
# Greeks Tests
# ---------------------------------------------------------------------------


class TestBSMGreeks:
    """Analytical Greeks benchmarks."""

    def test_delta_call_bounds(self) -> None:
        """0 <= Delta_call <= 1."""
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        assert 0 <= g["delta"] <= 1

    def test_delta_put_bounds(self) -> None:
        """-1 <= Delta_put <= 0."""
        g = bsm_greeks(S, K, T, r, sigma, q, "put")
        assert -1 <= g["delta"] <= 0

    def test_atm_call_delta_near_half(self) -> None:
        """ATM call delta ≈ N(d1).  With r=5%, T=1, σ=20%, q=0, d1≈0.35
        so delta ≈ N(0.35) ≈ 0.637.  For true ATM-forward delta ≈ 0.5."""
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        # Delta is N(d1) ≈ 0.637 for these params, not 0.5
        assert g["delta"] == pytest.approx(0.637, abs=0.05)

    def test_call_put_delta_parity(self) -> None:
        """Delta_call - Delta_put = e^(-qT)."""
        gc = bsm_greeks(S, K, T, r, sigma, q, "call")
        gp = bsm_greeks(S, K, T, r, sigma, q, "put")
        assert (gc["delta"] - gp["delta"]) == pytest.approx(math.exp(-q * T), abs=1e-10)

    def test_gamma_positive(self) -> None:
        """Gamma > 0 for both calls and puts."""
        gc = bsm_greeks(S, K, T, r, sigma, q, "call")
        gp = bsm_greeks(S, K, T, r, sigma, q, "put")
        assert gc["gamma"] > 0
        assert gc["gamma"] == pytest.approx(gp["gamma"], abs=1e-12)

    def test_vega_positive(self) -> None:
        """Vega > 0 for both calls and puts."""
        gc = bsm_greeks(S, K, T, r, sigma, q, "call")
        gp = bsm_greeks(S, K, T, r, sigma, q, "put")
        assert gc["vega"] > 0
        assert gc["vega"] == pytest.approx(gp["vega"], abs=1e-12)

    def test_theta_call_negative(self) -> None:
        """For a vanilla call (no dividends, r > 0), theta < 0."""
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        assert g["theta"] < 0

    def test_rho_call_positive(self) -> None:
        """Call rho > 0 (higher rates increase call value)."""
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        assert g["rho"] > 0

    def test_rho_put_negative(self) -> None:
        """Put rho < 0 (higher rates decrease put value)."""
        g = bsm_greeks(S, K, T, r, sigma, q, "put")
        assert g["rho"] < 0

    def test_greeks_at_expiry(self) -> None:
        """At T=0, only delta is non-zero (for ITM options)."""
        g = bsm_greeks(110, K, 0, r, sigma, q, "call")
        assert g["delta"] == 1.0
        assert g["gamma"] == 0.0
        assert g["vega"] == 0.0

    def test_greeks_keys_complete(self) -> None:
        """All 8 Greeks are present in the response."""
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        expected_keys = {"delta", "gamma", "vega", "theta", "rho", "vanna", "volga", "charm"}
        assert set(g.keys()) == expected_keys

    def test_negative_spot_raises(self) -> None:
        with pytest.raises(ValueError, match="Spot price"):
            bsm_greeks(-1, K, T, r, sigma, q, "call")

    def test_negative_vol_raises(self) -> None:
        with pytest.raises(ValueError, match="Volatility"):
            bsm_greeks(S, K, T, r, -0.1, q, "call")

    def test_vega_finite_difference_check(self) -> None:
        """Vega ≈ (C(σ+dσ) - C(σ-dσ)) / (2*dσ), validating the formula."""
        dsigma = 0.001
        c_up = bsm_price(S, K, T, r, sigma + dsigma, q, "call")
        c_dn = bsm_price(S, K, T, r, sigma - dsigma, q, "call")
        fd_vega = (c_up - c_dn) / (2 * dsigma)
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        assert g["vega"] == pytest.approx(fd_vega, abs=0.01)

    def test_delta_finite_difference_check(self) -> None:
        """Delta ≈ (C(S+dS) - C(S-dS)) / (2*dS)."""
        ds = 0.01
        c_up = bsm_price(S + ds, K, T, r, sigma, q, "call")
        c_dn = bsm_price(S - ds, K, T, r, sigma, q, "call")
        fd_delta = (c_up - c_dn) / (2 * ds)
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        assert g["delta"] == pytest.approx(fd_delta, abs=0.001)

    def test_gamma_finite_difference_check(self) -> None:
        """Gamma ≈ (C(S+dS) - 2C(S) + C(S-dS)) / dS^2."""
        ds = 0.01
        c_up = bsm_price(S + ds, K, T, r, sigma, q, "call")
        c_mid = bsm_price(S, K, T, r, sigma, q, "call")
        c_dn = bsm_price(S - ds, K, T, r, sigma, q, "call")
        fd_gamma = (c_up - 2 * c_mid + c_dn) / (ds * ds)
        g = bsm_greeks(S, K, T, r, sigma, q, "call")
        assert g["gamma"] == pytest.approx(fd_gamma, abs=0.01)
