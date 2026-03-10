"""Tests for P&L explain, portfolio analytics, VaR/ES, and hedging error engines.

Standard test parameters:
    S = 100, K = 100, T = 1, r = 0.05, sigma = 0.20, q = 0.0
"""

from __future__ import annotations

import math

import pytest

from engine.risk.pnl_explain import pnl_explain, scenario_grid
from engine.risk.portfolio import value_portfolio, parametric_var_es, monte_carlo_var_es
from engine.risk.hedging import simulate_hedge
from engine.models.black_scholes import bsm_price


# ---------------------------------------------------------------------------
# Standard test parameters
# ---------------------------------------------------------------------------

S, K, T, r, sigma, q = 100.0, 100.0, 1.0, 0.05, 0.20, 0.0


# ---------------------------------------------------------------------------
# P&L Explain Tests
# ---------------------------------------------------------------------------


class TestPnlExplain:
    """Greek-based P&L decomposition tests."""

    def test_zero_shock_zero_pnl(self) -> None:
        """No shocks → zero P&L."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dS=0, dsigma=0, dt=0)
        assert result["actual_pnl"] == pytest.approx(0.0, abs=1e-10)
        assert result["total_greek_pnl"] == pytest.approx(0.0, abs=1e-10)

    def test_small_spot_shock_dominated_by_delta(self) -> None:
        """Small spot move → delta P&L dominates."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dS=0.1)
        assert abs(result["delta_pnl"]) > abs(result["gamma_pnl"])
        assert abs(result["delta_pnl"]) > abs(result["unexplained"])

    def test_large_spot_shock_gamma_matters(self) -> None:
        """Large spot move → gamma P&L is significant."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dS=10.0)
        assert result["gamma_pnl"] > 0.1  # gamma contribution should be notable

    def test_vol_shock_vega_pnl(self) -> None:
        """Vol increase → positive vega P&L for long call."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dsigma=0.01)
        assert result["vega_pnl"] > 0

    def test_time_decay_theta(self) -> None:
        """Time passing → negative theta P&L for long call."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dt=1 / 252)
        assert result["theta_pnl"] < 0

    def test_unexplained_small_for_small_shocks(self) -> None:
        """For small shocks, higher-order terms (unexplained) are tiny."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dS=0.5, dsigma=0.001, dt=1 / 252)
        assert abs(result["unexplained"]) < abs(result["total_greek_pnl"]) * 0.1

    def test_pnl_add_up(self) -> None:
        """Greek P&Ls + unexplained = actual P&L."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dS=5.0, dsigma=0.01, dt=1 / 252)
        expected = result["total_greek_pnl"] + result["unexplained"]
        assert expected == pytest.approx(result["actual_pnl"], abs=1e-10)

    def test_position_size_scaling(self) -> None:
        """Position size scales all P&L components linearly."""
        r1 = pnl_explain(S, K, T, r, sigma, q, "call", dS=5.0, position_size=1.0)
        r10 = pnl_explain(S, K, T, r, sigma, q, "call", dS=5.0, position_size=10.0)
        assert r10["delta_pnl"] == pytest.approx(r1["delta_pnl"] * 10, abs=1e-10)
        assert r10["actual_pnl"] == pytest.approx(r1["actual_pnl"] * 10, abs=1e-10)

    def test_short_position_pnl(self) -> None:
        """Short position has opposite P&L."""
        r_long = pnl_explain(S, K, T, r, sigma, q, "call", dS=5.0, position_size=1.0)
        r_short = pnl_explain(S, K, T, r, sigma, q, "call", dS=5.0, position_size=-1.0)
        assert r_short["actual_pnl"] == pytest.approx(-r_long["actual_pnl"], abs=1e-10)

    def test_greeks_returned(self) -> None:
        """Result includes current Greeks."""
        result = pnl_explain(S, K, T, r, sigma, q, "call", dS=1.0)
        assert "delta" in result["greeks"]
        assert "gamma" in result["greeks"]
        assert "vega" in result["greeks"]
        assert "theta" in result["greeks"]


class TestScenarioGrid:
    """Scenario grid (spot × vol) tests."""

    def test_grid_shape(self) -> None:
        """Grid has correct dimensions."""
        result = scenario_grid(S, K, T, r, sigma, q, "call")
        n_spot = len(result["spot_shocks"])
        n_vol = len(result["vol_shocks"])
        assert len(result["pnl_grid"]) == n_spot
        for row in result["pnl_grid"]:
            assert len(row) == n_vol

    def test_zero_shock_zero_pnl(self) -> None:
        """At zero spot and vol shock, P&L = 0."""
        shocks_s = [-10, 0, 10]
        shocks_v = [-0.05, 0.0, 0.05]
        result = scenario_grid(S, K, T, r, sigma, q, "call", shocks_s, shocks_v)
        # Row index 1, col index 1 is (dS=0, dv=0)
        assert result["pnl_grid"][1][1] == pytest.approx(0.0, abs=1e-10)

    def test_custom_shocks(self) -> None:
        """Custom shock lists work."""
        result = scenario_grid(S, K, T, r, sigma, q, "put", [-5, 0, 5], [-0.01, 0, 0.01])
        assert result["spot_shocks"] == [-5, 0, 5]
        assert result["vol_shocks"] == [-0.01, 0, 0.01]

    def test_base_price_returned(self) -> None:
        """Base price matches BSM."""
        result = scenario_grid(S, K, T, r, sigma, q, "call")
        expected = bsm_price(S, K, T, r, sigma, q, "call")
        assert result["base_price"] == pytest.approx(expected, abs=1e-10)


# ---------------------------------------------------------------------------
# Portfolio Analytics Tests
# ---------------------------------------------------------------------------


class TestPortfolioValuation:
    """Portfolio valuation and Greeks aggregation tests."""

    def _single_call_positions(self) -> list[dict]:
        return [{
            "instrument_id": "opt1",
            "instrument_type": "option",
            "quantity": 10.0,
            "side": "long",
            "spot": S,
            "strike": K,
            "expiry_years": T,
            "option_type": "call",
            "dividend_yield": q,
        }]

    def test_single_long_call_value(self) -> None:
        """Single long call: value = price * quantity."""
        positions = self._single_call_positions()
        result = value_portfolio(positions, r, sigma)
        expected_price = bsm_price(S, K, T, r, sigma, q, "call")
        assert result["total_value"] == pytest.approx(expected_price * 10, abs=0.01)

    def test_greeks_aggregated(self) -> None:
        """Greeks are scaled by signed quantity."""
        positions = self._single_call_positions()
        result = value_portfolio(positions, r, sigma)
        rm = result["risk_metrics"]
        assert rm["total_delta"] > 0  # long calls have positive delta
        assert rm["total_gamma"] > 0
        assert rm["total_vega"] > 0
        assert rm["total_theta"] < 0  # long calls have negative theta

    def test_short_call_negative_delta(self) -> None:
        """Short calls have negative delta."""
        positions = [{
            "instrument_id": "opt1",
            "instrument_type": "option",
            "quantity": 5.0,
            "side": "short",
            "spot": S, "strike": K, "expiry_years": T,
            "option_type": "call", "dividend_yield": q,
        }]
        result = value_portfolio(positions, r, sigma)
        assert result["risk_metrics"]["total_delta"] < 0

    def test_delta_neutral_portfolio(self) -> None:
        """Long call + short call = near-zero delta."""
        positions = [
            {
                "instrument_id": "long_call",
                "instrument_type": "option",
                "quantity": 1.0,
                "side": "long",
                "spot": S, "strike": K, "expiry_years": T,
                "option_type": "call", "dividend_yield": q,
            },
            {
                "instrument_id": "short_call",
                "instrument_type": "option",
                "quantity": 1.0,
                "side": "short",
                "spot": S, "strike": K, "expiry_years": T,
                "option_type": "call", "dividend_yield": q,
            },
        ]
        result = value_portfolio(positions, r, sigma)
        assert result["risk_metrics"]["total_delta"] == pytest.approx(0.0, abs=1e-10)
        assert result["total_value"] == pytest.approx(0.0, abs=1e-10)

    def test_positions_valued_has_detail(self) -> None:
        """Each position has valuation detail."""
        positions = self._single_call_positions()
        result = value_portfolio(positions, r, sigma)
        assert len(result["positions_valued"]) == 1
        pv = result["positions_valued"][0]
        assert "instrument_id" in pv
        assert "price" in pv
        assert "position_value" in pv
        assert "delta" in pv


# ---------------------------------------------------------------------------
# VaR and ES Tests
# ---------------------------------------------------------------------------


class TestParametricVaR:
    """Parametric (delta-normal) VaR and ES tests."""

    def test_var_positive(self) -> None:
        """VaR should be positive (represents a loss)."""
        result = parametric_var_es(
            portfolio_delta=5.0, portfolio_gamma=0.1,
            S=100, sigma=0.20, r=0.05,
            holding_days=1, confidence=0.95,
        )
        assert result["var"] > 0

    def test_es_geq_var(self) -> None:
        """Expected Shortfall >= VaR."""
        result = parametric_var_es(
            portfolio_delta=5.0, portfolio_gamma=0.1,
            S=100, sigma=0.20, r=0.05,
            holding_days=1, confidence=0.95,
        )
        assert result["es"] >= result["var"] - 1e-10

    def test_higher_confidence_higher_var(self) -> None:
        """99% VaR > 95% VaR."""
        v95 = parametric_var_es(
            portfolio_delta=5.0, portfolio_gamma=0.1,
            S=100, sigma=0.20, holding_days=1, confidence=0.95,
        )
        v99 = parametric_var_es(
            portfolio_delta=5.0, portfolio_gamma=0.1,
            S=100, sigma=0.20, holding_days=1, confidence=0.99,
        )
        assert v99["var"] > v95["var"]

    def test_longer_holding_higher_var(self) -> None:
        """10-day VaR > 1-day VaR (square root of time scaling)."""
        v1 = parametric_var_es(
            portfolio_delta=5.0, portfolio_gamma=0.1,
            S=100, sigma=0.20, holding_days=1, confidence=0.95,
        )
        v10 = parametric_var_es(
            portfolio_delta=5.0, portfolio_gamma=0.1,
            S=100, sigma=0.20, holding_days=10, confidence=0.95,
        )
        assert v10["var"] > v1["var"]

    def test_zero_delta_zero_var(self) -> None:
        """Delta-neutral portfolio has ~zero parametric VaR (first-order)."""
        result = parametric_var_es(
            portfolio_delta=0.0, portfolio_gamma=0.1,
            S=100, sigma=0.20, holding_days=1, confidence=0.95,
        )
        assert result["var"] == pytest.approx(0.0, abs=0.01)


class TestMonteCarloVaR:
    """Monte Carlo VaR tests."""

    def _positions(self) -> list[dict]:
        return [{
            "instrument_id": "opt1",
            "instrument_type": "option",
            "quantity": 10.0,
            "side": "long",
            "spot": S, "strike": K, "expiry_years": T,
            "option_type": "call", "dividend_yield": q,
        }]

    def test_mc_var_positive(self) -> None:
        """MC VaR should be positive."""
        result = monte_carlo_var_es(
            self._positions(), r, sigma,
            holding_days=1, confidence=0.95,
            num_scenarios=5000, seed=42,
        )
        assert result["var"] > 0

    def test_mc_es_geq_var(self) -> None:
        """MC ES >= VaR."""
        result = monte_carlo_var_es(
            self._positions(), r, sigma,
            holding_days=1, confidence=0.95,
            num_scenarios=5000, seed=42,
        )
        assert result["es"] >= result["var"] - 0.01

    def test_mc_returns_distribution(self) -> None:
        """MC returns a P&L distribution sample."""
        result = monte_carlo_var_es(
            self._positions(), r, sigma,
            holding_days=1, confidence=0.95,
            num_scenarios=5000, seed=42,
        )
        assert len(result["pnl_distribution"]) > 0
        assert len(result["pnl_distribution"]) <= 500  # subsampled

    def test_reproducible_with_seed(self) -> None:
        """Same seed gives same VaR."""
        r1 = monte_carlo_var_es(
            self._positions(), r, sigma,
            num_scenarios=5000, seed=42,
        )
        r2 = monte_carlo_var_es(
            self._positions(), r, sigma,
            num_scenarios=5000, seed=42,
        )
        assert r1["var"] == pytest.approx(r2["var"], abs=1e-10)


# ---------------------------------------------------------------------------
# Hedging Error Tests
# ---------------------------------------------------------------------------


class TestHedgingError:
    """Discrete hedging error simulation tests."""

    def test_returns_expected_fields(self) -> None:
        """Result has all expected fields."""
        result = simulate_hedge(S, K, T, r, sigma, q, "call", rebalance_steps=20, seed=42)
        assert "bsm_price" in result
        assert "paths" in result
        assert "summary" in result
        assert len(result["paths"]) == 1

    def test_bsm_price_matches(self) -> None:
        """Returned BSM price matches standalone function."""
        result = simulate_hedge(S, K, T, r, sigma, q, "call", rebalance_steps=20, seed=42)
        expected = bsm_price(S, K, T, r, sigma, q, "call")
        assert result["bsm_price"] == pytest.approx(expected, abs=1e-10)

    def test_path_lengths(self) -> None:
        """Spot and delta paths have correct length."""
        steps = 50
        result = simulate_hedge(S, K, T, r, sigma, q, "call", rebalance_steps=steps, seed=42)
        path = result["paths"][0]
        assert len(path["spot_path"]) == steps + 1
        assert len(path["delta_path"]) == steps + 1
        assert len(path["cash_path"]) == steps + 1

    def test_zero_txn_cost(self) -> None:
        """With zero transaction costs, hedging error should be small on average."""
        result = simulate_hedge(
            S, K, T, r, sigma, q, "call",
            rebalance_steps=252, transaction_cost_rate=0.0,
            seed=42, num_paths=100,
        )
        # Mean hedge error should be near zero (within a few dollars)
        assert abs(result["summary"]["mean_hedge_error"]) < 3.0

    def test_txn_cost_increases_error(self) -> None:
        """Transaction costs reduce the hedge portfolio value."""
        r_no_tc = simulate_hedge(
            S, K, T, r, sigma, q, "call",
            rebalance_steps=50, transaction_cost_rate=0.0,
            seed=42, num_paths=50,
        )
        r_with_tc = simulate_hedge(
            S, K, T, r, sigma, q, "call",
            rebalance_steps=50, transaction_cost_rate=0.005,
            seed=42, num_paths=50,
        )
        # With transaction costs, mean hedge error should be lower (more negative)
        assert r_with_tc["summary"]["mean_hedge_error"] < r_no_tc["summary"]["mean_hedge_error"] + 0.1

    def test_multiple_paths(self) -> None:
        """Can run multiple paths."""
        result = simulate_hedge(
            S, K, T, r, sigma, q, "call",
            rebalance_steps=20, seed=42, num_paths=10,
        )
        assert len(result["paths"]) == 10

    def test_negative_spot_raises(self) -> None:
        with pytest.raises(ValueError, match="Spot price"):
            simulate_hedge(-1, K, T, r, sigma, q, "call")

    def test_negative_vol_raises(self) -> None:
        with pytest.raises(ValueError, match="Volatility"):
            simulate_hedge(S, K, T, r, -0.1, q, "call")
