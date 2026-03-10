"""Tests for the GBM Monte Carlo simulation engine.

Verifies path generation, antithetic variates, reproducibility,
convergence to BSM, and diagnostic output shapes.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from engine.simulation.gbm import simulate_gbm, price_option_mc
from engine.models.black_scholes import bsm_price


# ---------------------------------------------------------------------------
# Standard test parameters
# ---------------------------------------------------------------------------

S0, K, T, r, sigma, q = 100.0, 100.0, 1.0, 0.05, 0.20, 0.0
SEED = 42


# ---------------------------------------------------------------------------
# Path Generation Tests
# ---------------------------------------------------------------------------


class TestSimulateGBM:
    """Tests for the low-level path simulator."""

    def test_paths_shape(self) -> None:
        """Output paths have shape (num_paths, num_steps + 1)."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, seed=SEED)
        assert result["paths"].shape == (100, 51)

    def test_paths_shape_antithetic(self) -> None:
        """With antithetic variates, path count is rounded to even."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=101, num_steps=50, antithetic=True, seed=SEED)
        # 101 // 2 = 50 => 100 total paths
        assert result["paths"].shape[0] == 100

    def test_initial_price(self) -> None:
        """All paths start at S0."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, seed=SEED)
        np.testing.assert_allclose(result["paths"][:, 0], S0)

    def test_terminal_values_shape(self) -> None:
        """Terminal values has shape (num_paths,)."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=200, num_steps=50, seed=SEED)
        assert result["terminal_values"].shape == (200,)

    def test_terminal_values_match_paths(self) -> None:
        """terminal_values == paths[:, -1]."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, seed=SEED)
        np.testing.assert_array_equal(result["terminal_values"], result["paths"][:, -1])

    def test_positive_prices(self) -> None:
        """GBM paths are always positive."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=500, num_steps=252, seed=SEED)
        assert np.all(result["paths"] > 0)

    def test_seeded_reproducibility(self) -> None:
        """Same seed produces identical paths."""
        r1 = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, seed=SEED)
        r2 = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, seed=SEED)
        np.testing.assert_array_equal(r1["paths"], r2["paths"])

    def test_different_seeds_differ(self) -> None:
        """Different seeds produce different paths."""
        r1 = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, seed=42)
        r2 = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, seed=99)
        assert not np.array_equal(r1["paths"], r2["paths"])

    def test_antithetic_symmetry(self) -> None:
        """With antithetic variates, first and second halves have mirrored noise."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=100, num_steps=50, antithetic=True, seed=SEED)
        paths = result["paths"]
        half = paths.shape[0] // 2
        # Log-returns of first and second half should be negatively correlated
        log_returns_first = np.log(paths[:half, -1] / paths[:half, 0])
        log_returns_second = np.log(paths[half:, -1] / paths[half:, 0])
        correlation = np.corrcoef(log_returns_first, log_returns_second)[0, 1]
        assert correlation < -0.9  # Should be strongly negatively correlated

    def test_mean_terminal_value(self) -> None:
        """E[S_T] ≈ S0 * exp((r-q)*T) under risk-neutral measure."""
        result = simulate_gbm(S0, r, sigma, T, num_paths=50000, num_steps=252, seed=SEED)
        expected_mean = S0 * math.exp((r - q) * T)
        actual_mean = np.mean(result["terminal_values"])
        assert actual_mean == pytest.approx(expected_mean, rel=0.02)


# ---------------------------------------------------------------------------
# Option Pricing Tests
# ---------------------------------------------------------------------------


class TestPriceOptionMC:
    """Tests for the MC option pricer."""

    def test_mc_call_converges_to_bsm(self) -> None:
        """MC call price (10000 paths) within 2 std errors of BSM."""
        result = price_option_mc(S0, K, r, sigma, T, "call", num_paths=10000, seed=SEED)
        bsm = bsm_price(S0, K, T, r, sigma, q, "call")
        assert abs(result["price"] - bsm) < 2 * result["std_error"]

    def test_mc_put_converges_to_bsm(self) -> None:
        """MC put price (10000 paths) within 2 std errors of BSM."""
        result = price_option_mc(S0, K, r, sigma, T, "put", num_paths=10000, seed=SEED)
        bsm = bsm_price(S0, K, T, r, sigma, q, "put")
        assert abs(result["price"] - bsm) < 2 * result["std_error"]

    def test_confidence_interval_contains_bsm(self) -> None:
        """95% CI from MC should contain the BSM price."""
        result = price_option_mc(S0, K, r, sigma, T, "call", num_paths=10000, seed=SEED)
        bsm = bsm_price(S0, K, T, r, sigma, q, "call")
        ci = result["confidence_interval_95"]
        assert ci[0] <= bsm <= ci[1]

    def test_std_error_decreases_with_paths(self) -> None:
        """More paths should yield smaller standard error."""
        r1 = price_option_mc(S0, K, r, sigma, T, "call", num_paths=500, seed=SEED)
        r2 = price_option_mc(S0, K, r, sigma, T, "call", num_paths=5000, seed=SEED)
        assert r2["std_error"] < r1["std_error"]

    def test_result_keys(self) -> None:
        """Result dict has all expected keys."""
        result = price_option_mc(S0, K, r, sigma, T, "call", num_paths=100, seed=SEED)
        assert "price" in result
        assert "std_error" in result
        assert "confidence_interval_95" in result
        assert "paths" in result
        assert "convergence" in result

    def test_paths_data_structure(self) -> None:
        """paths sub-dict has representative_path, path_fan, terminal_values."""
        result = price_option_mc(S0, K, r, sigma, T, "call", num_paths=100, seed=SEED)
        paths = result["paths"]
        assert "representative_path" in paths
        assert "path_fan" in paths
        assert "terminal_values" in paths
        assert len(paths["representative_path"]) > 0
        assert len(paths["path_fan"]) <= 20

    def test_convergence_diagnostics_length(self) -> None:
        """running_mean and running_std have length == actual path count."""
        n = 200
        result = price_option_mc(S0, K, r, sigma, T, "call", num_paths=n, seed=SEED)
        # With antithetic, actual_paths = (n//2)*2 = n (if even)
        actual = len(result["convergence"]["running_mean"])
        assert actual == n

    def test_running_mean_final_equals_price(self) -> None:
        """Last element of running_mean should equal the price."""
        result = price_option_mc(S0, K, r, sigma, T, "call", num_paths=500, seed=SEED)
        final_mean = result["convergence"]["running_mean"][-1]
        assert final_mean == pytest.approx(result["price"], abs=1e-10)

    def test_seeded_mc_reproducible(self) -> None:
        """Same seed gives identical MC price."""
        r1 = price_option_mc(S0, K, r, sigma, T, "call", num_paths=1000, seed=SEED)
        r2 = price_option_mc(S0, K, r, sigma, T, "call", num_paths=1000, seed=SEED)
        assert r1["price"] == r2["price"]

    def test_put_call_parity_mc(self) -> None:
        """MC call - MC put ≈ S*e^(-qT) - K*e^(-rT) (within tolerance)."""
        call = price_option_mc(S0, K, r, sigma, T, "call", num_paths=10000, seed=SEED)
        put = price_option_mc(S0, K, r, sigma, T, "put", num_paths=10000, seed=SEED)
        parity = S0 * math.exp(-q * T) - K * math.exp(-r * T)
        # Combined std error for the difference
        combined_se = math.sqrt(call["std_error"]**2 + put["std_error"]**2)
        assert abs((call["price"] - put["price"]) - parity) < 3 * combined_se
