"""Tests for interest-rate model engines: Vasicek, CIR, Hull-White, comparison."""

from __future__ import annotations

import math

import pytest
import numpy as np

from engine.rates.vasicek import (
    simulate_vasicek,
    vasicek_bond_price,
    vasicek_zero_rate,
    vasicek_yield_curve,
    vasicek_mean_and_variance,
)
from engine.rates.cir import (
    simulate_cir,
    cir_bond_price,
    cir_zero_rate,
    cir_yield_curve,
    cir_mean_and_variance,
    feller_condition,
)
from engine.rates.hull_white import (
    simulate_hull_white,
    hull_white_bond_price,
    hull_white_zero_rate,
    hull_white_yield_curve,
    hull_white_mean_and_variance,
)
from engine.rates.comparison import (
    simulate_model,
    model_yield_curve,
    get_model_comparison,
    compare_yield_curves,
)


# ── Vasicek Tests ──────────────────────────────────────────────────────────


class TestVasicekSimulation:
    """Vasicek simulation sanity tests."""

    def test_output_shape(self):
        result = simulate_vasicek(0.04, 0.5, 0.04, 0.01, 1.0, 100, 50, seed=42)
        assert len(result["times"]) == 101
        assert len(result["paths"]) == 50
        assert all(len(p) == 101 for p in result["paths"])
        assert len(result["mean_path"]) == 101
        assert len(result["std_path"]) == 101
        assert len(result["terminal"]) == 50

    def test_initial_value(self):
        result = simulate_vasicek(0.05, 0.5, 0.04, 0.01, 1.0, 50, 20, seed=1)
        for p in result["paths"]:
            assert p[0] == 0.05

    def test_mean_converges_to_theta(self):
        """Over a long horizon, mean rate should approach theta."""
        result = simulate_vasicek(0.08, 1.0, 0.04, 0.005, 10.0, 500, 5000, seed=42)
        terminal_mean = np.mean(result["terminal"])
        assert abs(terminal_mean - 0.04) < 0.005

    def test_mean_and_variance_analytical(self):
        mean, var = vasicek_mean_and_variance(0.05, 0.5, 0.04, 0.01, 2.0)
        expected_mean = 0.05 * math.exp(-1.0) + 0.04 * (1.0 - math.exp(-1.0))
        assert abs(mean - expected_mean) < 1e-10
        assert var > 0

    def test_negative_kappa_raises(self):
        with pytest.raises(ValueError, match="kappa"):
            simulate_vasicek(0.04, -0.5, 0.04, 0.01, 1.0)

    def test_negative_sigma_raises(self):
        with pytest.raises(ValueError, match="sigma"):
            simulate_vasicek(0.04, 0.5, 0.04, -0.01, 1.0)

    def test_reproducibility(self):
        r1 = simulate_vasicek(0.04, 0.5, 0.04, 0.01, 1.0, seed=99)
        r2 = simulate_vasicek(0.04, 0.5, 0.04, 0.01, 1.0, seed=99)
        assert r1["paths"] == r2["paths"]


class TestVasicekBondPrice:
    """Vasicek analytical bond pricing."""

    def test_price_positive(self):
        P = vasicek_bond_price(0.05, 0.5, 0.04, 0.01, 5.0)
        assert 0 < P < 1

    def test_price_decreasing_with_rate(self):
        P1 = vasicek_bond_price(0.03, 0.5, 0.04, 0.01, 5.0)
        P2 = vasicek_bond_price(0.06, 0.5, 0.04, 0.01, 5.0)
        assert P1 > P2

    def test_price_decreasing_with_maturity(self):
        P1 = vasicek_bond_price(0.05, 0.5, 0.04, 0.01, 2.0)
        P2 = vasicek_bond_price(0.05, 0.5, 0.04, 0.01, 10.0)
        assert P1 > P2

    def test_zero_rate_positive(self):
        R = vasicek_zero_rate(0.05, 0.5, 0.04, 0.01, 5.0)
        assert R > 0

    def test_yield_curve_shape(self):
        curve = vasicek_yield_curve(0.05, 0.5, 0.04, 0.01)
        assert len(curve["maturities"]) == 11
        assert len(curve["bond_prices"]) == 11
        assert len(curve["zero_rates"]) == 11
        # Bond prices should be decreasing
        for i in range(len(curve["bond_prices"]) - 1):
            assert curve["bond_prices"][i] >= curve["bond_prices"][i + 1]


# ── CIR Tests ──────────────────────────────────────────────────────────────


class TestCIRSimulation:
    """CIR simulation sanity tests."""

    def test_output_shape(self):
        result = simulate_cir(0.04, 0.5, 0.04, 0.05, 1.0, 100, 50, seed=42)
        assert len(result["times"]) == 101
        assert len(result["paths"]) == 50

    def test_initial_value(self):
        result = simulate_cir(0.05, 0.5, 0.04, 0.05, 1.0, 50, 20, seed=1)
        for p in result["paths"]:
            assert p[0] == 0.05

    def test_rates_non_negative(self):
        """CIR rates should remain non-negative."""
        result = simulate_cir(0.04, 0.5, 0.04, 0.05, 5.0, 500, 200, seed=42)
        for p in result["paths"]:
            assert all(r >= 0 for r in p)

    def test_feller_condition_true(self):
        # 2*0.5*0.04 = 0.04 >= 0.05^2 = 0.0025 → True
        assert feller_condition(0.5, 0.04, 0.05) is True

    def test_feller_condition_false(self):
        # 2*0.1*0.01 = 0.002 < 0.1^2 = 0.01 → False
        assert feller_condition(0.1, 0.01, 0.1) is False

    def test_feller_in_result(self):
        result = simulate_cir(0.04, 0.5, 0.04, 0.05, 1.0, 50, 20, seed=42)
        assert "feller_satisfied" in result
        assert isinstance(result["feller_satisfied"], bool)

    def test_mean_converges_to_theta(self):
        result = simulate_cir(0.08, 1.0, 0.04, 0.05, 10.0, 500, 5000, seed=42)
        terminal_mean = np.mean(result["terminal"])
        assert abs(terminal_mean - 0.04) < 0.005

    def test_negative_r0_raises(self):
        with pytest.raises(ValueError, match="r0"):
            simulate_cir(-0.01, 0.5, 0.04, 0.05, 1.0)

    def test_negative_theta_raises(self):
        with pytest.raises(ValueError, match="theta"):
            simulate_cir(0.04, 0.5, -0.01, 0.05, 1.0)

    def test_reproducibility(self):
        r1 = simulate_cir(0.04, 0.5, 0.04, 0.05, 1.0, seed=99)
        r2 = simulate_cir(0.04, 0.5, 0.04, 0.05, 1.0, seed=99)
        assert r1["paths"] == r2["paths"]


class TestCIRBondPrice:
    """CIR analytical bond pricing."""

    def test_price_positive(self):
        P = cir_bond_price(0.05, 0.5, 0.04, 0.05, 5.0)
        assert 0 < P < 1

    def test_price_decreasing_with_rate(self):
        P1 = cir_bond_price(0.03, 0.5, 0.04, 0.05, 5.0)
        P2 = cir_bond_price(0.06, 0.5, 0.04, 0.05, 5.0)
        assert P1 > P2

    def test_zero_rate_positive(self):
        R = cir_zero_rate(0.05, 0.5, 0.04, 0.05, 5.0)
        assert R > 0

    def test_yield_curve_shape(self):
        curve = cir_yield_curve(0.05, 0.5, 0.04, 0.05)
        assert len(curve["maturities"]) == 11
        for i in range(len(curve["bond_prices"]) - 1):
            assert curve["bond_prices"][i] >= curve["bond_prices"][i + 1]

    def test_mean_and_variance(self):
        mean, var = cir_mean_and_variance(0.05, 0.5, 0.04, 0.05, 2.0)
        assert mean > 0
        assert var > 0


# ── Hull-White Tests ──────────────────────────────────────────────────────────


class TestHullWhiteSimulation:
    """Hull-White simulation sanity tests."""

    def test_output_shape(self):
        result = simulate_hull_white(0.04, 0.5, 0.01, 0.02, 1.0, 100, 50, seed=42)
        assert len(result["times"]) == 101
        assert len(result["paths"]) == 50

    def test_initial_value(self):
        result = simulate_hull_white(0.05, 0.5, 0.01, 0.02, 1.0, 50, 20, seed=1)
        for p in result["paths"]:
            assert p[0] == 0.05

    def test_mean_converges(self):
        """HW(const theta) equivalent to Vasicek: mean → theta_hw/a."""
        a, theta_hw = 1.0, 0.04  # b = theta_hw/a = 0.04
        result = simulate_hull_white(0.08, a, 0.005, theta_hw, 10.0, 500, 5000, seed=42)
        terminal_mean = np.mean(result["terminal"])
        assert abs(terminal_mean - 0.04) < 0.005

    def test_negative_a_raises(self):
        with pytest.raises(ValueError, match="a"):
            simulate_hull_white(0.04, -0.5, 0.01, 0.02, 1.0)

    def test_reproducibility(self):
        r1 = simulate_hull_white(0.04, 0.5, 0.01, 0.02, 1.0, seed=99)
        r2 = simulate_hull_white(0.04, 0.5, 0.01, 0.02, 1.0, seed=99)
        assert r1["paths"] == r2["paths"]


class TestHullWhiteBondPrice:
    """Hull-White analytical bond pricing."""

    def test_price_positive(self):
        P = hull_white_bond_price(0.05, 0.5, 0.01, 0.02, 5.0)
        assert 0 < P < 1

    def test_price_decreasing_with_rate(self):
        P1 = hull_white_bond_price(0.03, 0.5, 0.01, 0.02, 5.0)
        P2 = hull_white_bond_price(0.06, 0.5, 0.01, 0.02, 5.0)
        assert P1 > P2

    def test_equivalence_to_vasicek(self):
        """HW with constant theta should give same price as Vasicek."""
        a, sigma, theta_hw = 0.5, 0.01, 0.02
        r = 0.05
        T = 5.0
        P_hw = hull_white_bond_price(r, a, sigma, theta_hw, T)
        P_v = vasicek_bond_price(r, a, theta_hw / a, sigma, T)
        assert abs(P_hw - P_v) < 1e-12

    def test_mean_and_variance(self):
        mean, var = hull_white_mean_and_variance(0.05, 0.5, 0.01, 0.02, 2.0)
        # Should match Vasicek with kappa=0.5, theta=0.04
        v_mean, v_var = vasicek_mean_and_variance(0.05, 0.5, 0.04, 0.01, 2.0)
        assert abs(mean - v_mean) < 1e-12
        assert abs(var - v_var) < 1e-12


# ── Comparison Layer Tests ────────────────────────────────────────────────────


class TestSimulateModel:
    """Unified simulation dispatch tests."""

    def test_vasicek_dispatch(self):
        result = simulate_model("vasicek", 0.04, {"kappa": 0.5, "theta": 0.04, "sigma": 0.01}, seed=42)
        assert result["model"] == "vasicek"
        assert "paths" in result

    def test_cir_dispatch(self):
        result = simulate_model("cir", 0.04, {"kappa": 0.5, "theta": 0.04, "sigma": 0.05}, seed=42)
        assert result["model"] == "cir"

    def test_hull_white_dispatch(self):
        result = simulate_model("hull_white", 0.04, {"a": 0.5, "sigma": 0.01, "theta_hw": 0.02}, seed=42)
        assert result["model"] == "hull_white"

    def test_unknown_model_raises(self):
        with pytest.raises(ValueError, match="Unknown"):
            simulate_model("sabr", 0.04, {})


class TestModelYieldCurve:
    """Unified yield curve dispatch tests."""

    def test_vasicek_curve(self):
        curve = model_yield_curve("vasicek", 0.04, {"kappa": 0.5, "theta": 0.04, "sigma": 0.01})
        assert "maturities" in curve
        assert "zero_rates" in curve

    def test_cir_curve(self):
        curve = model_yield_curve("cir", 0.04, {"kappa": 0.5, "theta": 0.04, "sigma": 0.05})
        assert all(r > 0 for r in curve["zero_rates"])

    def test_hull_white_curve(self):
        curve = model_yield_curve("hull_white", 0.04, {"a": 0.5, "sigma": 0.01, "theta_hw": 0.02})
        assert len(curve["maturities"]) == 11


class TestModelComparison:
    """Model comparison table tests."""

    def test_comparison_has_all_models(self):
        comp = get_model_comparison()
        model_ids = {c["model_id"] for c in comp}
        assert model_ids == {"vasicek", "cir", "hull_white"}

    def test_comparison_fields_complete(self):
        comp = get_model_comparison()
        required = {"model_id", "name", "sde", "mean_reversion", "positivity",
                     "volatility_structure", "analytical_bond_price",
                     "practical_intuition", "common_use_cases", "limitations",
                     "distribution"}
        for entry in comp:
            assert required.issubset(set(entry.keys()))

    def test_compare_yield_curves(self):
        results = compare_yield_curves(
            0.04,
            [
                {"model": "vasicek", "params": {"kappa": 0.5, "theta": 0.04, "sigma": 0.01}, "label": "Vasicek"},
                {"model": "cir", "params": {"kappa": 0.5, "theta": 0.04, "sigma": 0.05}, "label": "CIR"},
            ],
        )
        assert len(results) == 2
        assert results[0]["label"] == "Vasicek"
        assert results[1]["label"] == "CIR"
        assert len(results[0]["maturities"]) == len(results[1]["maturities"])


# ── Cross-Model Consistency ──────────────────────────────────────────────────


class TestCrossModel:
    """Cross-model consistency and edge case tests."""

    def test_hw_vasicek_simulation_equivalence(self):
        """HW with constant theta and Vasicek should have similar terminal distributions."""
        kappa, theta, sigma = 0.5, 0.04, 0.01
        r0, T, n = 0.06, 5.0, 5000

        v_result = simulate_vasicek(r0, kappa, theta, sigma, T, 500, n, seed=42)
        hw_result = simulate_hull_white(r0, kappa, sigma, kappa * theta, T, 500, n, seed=42)

        v_mean = np.mean(v_result["terminal"])
        hw_mean = np.mean(hw_result["terminal"])
        # Both should converge to theta=0.04 over 5 years
        assert abs(v_mean - hw_mean) < 0.002

    def test_short_horizon_all_near_r0(self):
        """Over very short horizons, rates stay near r0 for all models."""
        r0 = 0.05
        for m in ["vasicek", "cir", "hull_white"]:
            params = {"kappa": 0.5, "theta": 0.04, "sigma": 0.01}
            if m == "hull_white":
                params = {"a": 0.5, "sigma": 0.01, "theta_hw": 0.02}
            if m == "cir":
                params = {"kappa": 0.5, "theta": 0.04, "sigma": 0.05}

            result = simulate_model(m, r0, params, T=0.001, n_steps=1, n_paths=100, seed=42)
            terminal_mean = np.mean(result["terminal"])
            assert abs(terminal_mean - r0) < 0.01

    def test_bond_prices_all_between_zero_and_one(self):
        """ZCB prices should always be in (0, 1) for positive rates."""
        r = 0.05
        for T in [0.5, 1.0, 5.0, 10.0, 30.0]:
            assert 0 < vasicek_bond_price(r, 0.5, 0.04, 0.01, T) < 1
            assert 0 < cir_bond_price(r, 0.5, 0.04, 0.05, T) < 1
            assert 0 < hull_white_bond_price(r, 0.5, 0.01, 0.02, T) < 1
