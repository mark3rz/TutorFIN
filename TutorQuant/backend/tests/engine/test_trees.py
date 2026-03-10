"""Tests for binomial and trinomial tree pricing engines.

Validates:
- Convergence to BSM for European options
- Put-call parity on trees
- American option early exercise premium
- Input validation
- Edge cases (at expiry, deep ITM/OTM)
- Model registry integration

Standard test parameters:
    S = 100, K = 100, T = 1, r = 0.05, sigma = 0.20, q = 0.0
"""

from __future__ import annotations

import math

import pytest

from engine.models.black_scholes import bsm_price
from engine.models.binomial import binomial_price, BinomialPricingEngine
from engine.models.trinomial import trinomial_price, TrinomialPricingEngine
from registry.model_registry import pricing_model_registry


# ---------------------------------------------------------------------------
# Standard test parameters
# ---------------------------------------------------------------------------

S, K, T, r, sigma, q = 100.0, 100.0, 1.0, 0.05, 0.20, 0.0


# ---------------------------------------------------------------------------
# Binomial Tree Tests
# ---------------------------------------------------------------------------


class TestBinomialPrice:
    """CRR binomial tree benchmarks."""

    def test_european_call_converges_to_bsm(self) -> None:
        """Binomial European call price converges to BSM as N increases."""
        bsm = bsm_price(S, K, T, r, sigma, q, "call")
        result = binomial_price(S, K, T, r, sigma, q, "call", "european", steps=500)
        assert result["price"] == pytest.approx(bsm, abs=0.05)

    def test_european_put_converges_to_bsm(self) -> None:
        """Binomial European put price converges to BSM."""
        bsm = bsm_price(S, K, T, r, sigma, q, "put")
        result = binomial_price(S, K, T, r, sigma, q, "put", "european", steps=500)
        assert result["price"] == pytest.approx(bsm, abs=0.05)

    def test_put_call_parity_european(self) -> None:
        """Put-call parity holds on the binomial tree."""
        call = binomial_price(S, K, T, r, sigma, q, "call", "european", steps=200)
        put = binomial_price(S, K, T, r, sigma, q, "put", "european", steps=200)
        parity = S * math.exp(-q * T) - K * math.exp(-r * T)
        assert (call["price"] - put["price"]) == pytest.approx(parity, abs=0.1)

    def test_american_put_geq_european_put(self) -> None:
        """American put >= European put (early exercise premium >= 0)."""
        euro = binomial_price(S, K, T, r, sigma, q, "put", "european", steps=200)
        amer = binomial_price(S, K, T, r, sigma, q, "put", "american", steps=200)
        assert amer["price"] >= euro["price"] - 1e-10

    def test_american_call_no_div_equals_european(self) -> None:
        """Without dividends, American call = European call (no early exercise)."""
        euro = binomial_price(S, K, T, r, sigma, 0.0, "call", "european", steps=200)
        amer = binomial_price(S, K, T, r, sigma, 0.0, "call", "american", steps=200)
        assert amer["price"] == pytest.approx(euro["price"], abs=0.05)

    def test_american_call_with_dividend_has_premium(self) -> None:
        """With dividends, American call may have early exercise premium."""
        q_div = 0.08  # high dividend yield
        amer = binomial_price(S, K, T, r, sigma, q_div, "call", "american", steps=200)
        euro = binomial_price(S, K, T, r, sigma, q_div, "call", "european", steps=200)
        assert amer["early_exercise_premium"] >= 0

    def test_deep_itm_put(self) -> None:
        """Deep ITM put ≈ discounted intrinsic."""
        result = binomial_price(50, K, T, r, sigma, q, "put", "european", steps=200)
        lower_bound = K * math.exp(-r * T) - 50
        assert result["price"] >= lower_bound - 0.5

    def test_deep_otm_call(self) -> None:
        """Deep OTM call ≈ 0."""
        result = binomial_price(50, K, T, r, sigma, q, "call", "european", steps=200)
        assert result["price"] < 0.1

    def test_at_expiry_call(self) -> None:
        """At T=0, call returns intrinsic."""
        result = binomial_price(110, K, 0, r, sigma, q, "call", "european", steps=200)
        assert result["price"] == 10.0

    def test_at_expiry_put(self) -> None:
        """At T=0, put returns intrinsic."""
        result = binomial_price(90, K, 0, r, sigma, q, "put", "european", steps=200)
        assert result["price"] == 10.0

    def test_returns_tree_params(self) -> None:
        """Result includes tree parameters (u, d, p, dt)."""
        result = binomial_price(S, K, T, r, sigma, q, "call", "european", steps=50)
        assert "u" in result["tree_params"]
        assert "d" in result["tree_params"]
        assert "p" in result["tree_params"]
        assert "dt" in result["tree_params"]
        assert result["tree_params"]["u"] > 1
        assert result["tree_params"]["d"] < 1
        assert 0 < result["tree_params"]["p"] < 1

    def test_price_non_negative(self) -> None:
        """Option prices are always >= 0."""
        for ot in ("call", "put"):
            for s in (50, 80, 100, 120, 200):
                result = binomial_price(s, K, T, r, sigma, q, ot, "european", steps=50)
                assert result["price"] >= 0.0

    def test_negative_spot_raises(self) -> None:
        with pytest.raises(ValueError, match="Spot price"):
            binomial_price(-1, K, T, r, sigma, q, "call")

    def test_negative_strike_raises(self) -> None:
        with pytest.raises(ValueError, match="Strike price"):
            binomial_price(S, -1, T, r, sigma, q, "call")

    def test_negative_vol_raises(self) -> None:
        with pytest.raises(ValueError, match="Volatility"):
            binomial_price(S, K, T, r, -0.1, q, "call")

    def test_invalid_exercise_raises(self) -> None:
        with pytest.raises(ValueError, match="Exercise"):
            binomial_price(S, K, T, r, sigma, q, "call", "bermudan")

    def test_monotonicity_in_steps(self) -> None:
        """With more steps, price should be closer to BSM."""
        bsm = bsm_price(S, K, T, r, sigma, q, "call")
        p50 = binomial_price(S, K, T, r, sigma, q, "call", "european", steps=50)
        p200 = binomial_price(S, K, T, r, sigma, q, "call", "european", steps=200)
        assert abs(p200["price"] - bsm) <= abs(p50["price"] - bsm) + 0.1


# ---------------------------------------------------------------------------
# Trinomial Tree Tests
# ---------------------------------------------------------------------------


class TestTrinomialPrice:
    """Trinomial tree (Kamrad-Ritchken) benchmarks."""

    def test_european_call_converges_to_bsm(self) -> None:
        """Trinomial European call converges to BSM."""
        bsm = bsm_price(S, K, T, r, sigma, q, "call")
        result = trinomial_price(S, K, T, r, sigma, q, "call", "european", steps=300)
        assert result["price"] == pytest.approx(bsm, abs=0.05)

    def test_european_put_converges_to_bsm(self) -> None:
        """Trinomial European put converges to BSM."""
        bsm = bsm_price(S, K, T, r, sigma, q, "put")
        result = trinomial_price(S, K, T, r, sigma, q, "put", "european", steps=300)
        assert result["price"] == pytest.approx(bsm, abs=0.05)

    def test_put_call_parity(self) -> None:
        """Put-call parity holds on the trinomial tree."""
        call = trinomial_price(S, K, T, r, sigma, q, "call", "european", steps=150)
        put = trinomial_price(S, K, T, r, sigma, q, "put", "european", steps=150)
        parity = S * math.exp(-q * T) - K * math.exp(-r * T)
        assert (call["price"] - put["price"]) == pytest.approx(parity, abs=0.1)

    def test_american_put_geq_european(self) -> None:
        """American put >= European put."""
        euro = trinomial_price(S, K, T, r, sigma, q, "put", "european", steps=150)
        amer = trinomial_price(S, K, T, r, sigma, q, "put", "american", steps=150)
        assert amer["price"] >= euro["price"] - 1e-10

    def test_at_expiry(self) -> None:
        """At T=0, returns intrinsic value."""
        result = trinomial_price(110, K, 0, r, sigma, q, "call")
        assert result["price"] == 10.0

    def test_returns_tree_params(self) -> None:
        """Result includes trinomial tree parameters."""
        result = trinomial_price(S, K, T, r, sigma, q, "call", "european", steps=50)
        assert "u" in result["tree_params"]
        assert "d" in result["tree_params"]
        assert "p_u" in result["tree_params"]
        assert "p_m" in result["tree_params"]
        assert "p_d" in result["tree_params"]

    def test_probabilities_sum_to_one(self) -> None:
        """p_u + p_m + p_d = 1."""
        result = trinomial_price(S, K, T, r, sigma, q, "call", "european", steps=50)
        tp = result["tree_params"]
        assert (tp["p_u"] + tp["p_m"] + tp["p_d"]) == pytest.approx(1.0, abs=1e-12)

    def test_negative_spot_raises(self) -> None:
        with pytest.raises(ValueError, match="Spot price"):
            trinomial_price(-1, K, T, r, sigma, q, "call")

    def test_negative_vol_raises(self) -> None:
        with pytest.raises(ValueError, match="Volatility"):
            trinomial_price(S, K, T, r, -0.1, q, "call")

    def test_price_non_negative(self) -> None:
        """Trinomial prices are always >= 0."""
        for ot in ("call", "put"):
            for s in (50, 80, 100, 120, 200):
                result = trinomial_price(s, K, T, r, sigma, q, ot, "european", steps=50)
                assert result["price"] >= 0.0


# ---------------------------------------------------------------------------
# Registry Tests
# ---------------------------------------------------------------------------


class TestTreeRegistration:
    """Verify tree models are registered in the pricing registry."""

    def test_binomial_registered(self) -> None:
        assert "binomial" in pricing_model_registry

    def test_trinomial_registered(self) -> None:
        assert "trinomial" in pricing_model_registry

    def test_binomial_engine_instantiation(self) -> None:
        cls = pricing_model_registry.get("binomial")
        engine = cls()
        assert engine.name == "Binomial (CRR)"
        assert "european" in engine.supported_exercises
        assert "american" in engine.supported_exercises

    def test_trinomial_engine_instantiation(self) -> None:
        cls = pricing_model_registry.get("trinomial")
        engine = cls()
        assert engine.name == "Trinomial (Kamrad-Ritchken)"
        assert "european" in engine.supported_exercises
        assert "american" in engine.supported_exercises


# ---------------------------------------------------------------------------
# Cross-model comparison
# ---------------------------------------------------------------------------


class TestCrossModelConsistency:
    """Verify binomial and trinomial agree with each other and BSM."""

    def test_all_three_agree_european_call(self) -> None:
        """BSM, binomial, and trinomial give similar prices."""
        bsm = bsm_price(S, K, T, r, sigma, q, "call")
        binom = binomial_price(S, K, T, r, sigma, q, "call", "european", steps=500)
        trinom = trinomial_price(S, K, T, r, sigma, q, "call", "european", steps=300)

        assert binom["price"] == pytest.approx(bsm, abs=0.05)
        assert trinom["price"] == pytest.approx(bsm, abs=0.05)
        assert binom["price"] == pytest.approx(trinom["price"], abs=0.1)

    def test_all_three_agree_european_put(self) -> None:
        """BSM, binomial, and trinomial give similar put prices."""
        bsm = bsm_price(S, K, T, r, sigma, q, "put")
        binom = binomial_price(S, K, T, r, sigma, q, "put", "european", steps=500)
        trinom = trinomial_price(S, K, T, r, sigma, q, "put", "european", steps=300)

        assert binom["price"] == pytest.approx(bsm, abs=0.05)
        assert trinom["price"] == pytest.approx(bsm, abs=0.05)

    def test_american_put_binomial_vs_trinomial(self) -> None:
        """Binomial and trinomial American put prices should be close."""
        binom = binomial_price(S, K, T, r, sigma, q, "put", "american", steps=200)
        trinom = trinomial_price(S, K, T, r, sigma, q, "put", "american", steps=150)
        assert binom["price"] == pytest.approx(trinom["price"], abs=0.2)

    def test_with_dividend_yield(self) -> None:
        """All models agree with non-zero dividend yield."""
        q_div = 0.03
        bsm = bsm_price(S, K, T, r, sigma, q_div, "call")
        binom = binomial_price(S, K, T, r, sigma, q_div, "call", "european", steps=500)
        trinom = trinomial_price(S, K, T, r, sigma, q_div, "call", "european", steps=300)
        assert binom["price"] == pytest.approx(bsm, abs=0.05)
        assert trinom["price"] == pytest.approx(bsm, abs=0.05)
