"""Tests for calibration framework, SVI surface fitting, and rate model calibration."""

from __future__ import annotations

import math

import numpy as np
import pytest

from engine.calibration.framework import (
    ParameterSpec,
    CalibrationResult,
    calibrate,
    compute_diagnostics,
)
from engine.calibration.svi_surface import (
    svi_total_variance,
    svi_implied_vol,
    calibrate_svi_slice,
    calibrate_svi_surface,
    check_svi_arbitrage,
)
from engine.calibration.rate_model_calibrator import (
    calibrate_vasicek,
    calibrate_cir,
    calibrate_rate_model,
)


# ═════════════════════════════════════════════════════════════════════════════
# Framework Tests
# ═════════════════════════════════════════════════════════════════════════════


class TestComputeDiagnostics:
    """Tests for the compute_diagnostics utility."""

    def test_zero_residuals(self):
        """Perfect fit should yield zero errors."""
        residuals = np.zeros(10)
        market = np.ones(10)
        diag = compute_diagnostics(residuals, market)
        assert diag["rmse"] == 0.0
        assert diag["mae"] == 0.0
        assert diag["sse"] == 0.0
        assert diag["max_abs_err"] == 0.0
        assert diag["r_squared"] == 1.0
        assert diag["n_obs"] == 10

    def test_known_residuals(self):
        """Known residuals should yield expected diagnostics."""
        residuals = np.array([0.1, -0.1, 0.2, -0.2])
        market = np.array([1.0, 1.0, 1.0, 1.0])
        diag = compute_diagnostics(residuals, market)
        assert diag["n_obs"] == 4
        assert diag["mae"] > 0
        assert diag["rmse"] > 0
        assert diag["sse"] > 0
        assert diag["max_abs_err"] == pytest.approx(0.2, abs=1e-8)

    def test_r_squared_range(self):
        """R-squared should be between 0 and 1 for reasonable residuals."""
        np.random.seed(42)
        market = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        residuals = np.random.normal(0, 0.1, 5)
        diag = compute_diagnostics(residuals, market)
        assert 0.0 <= diag["r_squared"] <= 1.0

    def test_mape_positive_values(self):
        """MAPE should be computed for positive market values."""
        residuals = np.array([0.05, -0.05])
        market = np.array([1.0, 1.0])
        diag = compute_diagnostics(residuals, market)
        assert diag["mape"] > 0

    def test_empty_residuals(self):
        """Empty arrays should return zero diagnostics."""
        diag = compute_diagnostics(np.array([]), np.array([]))
        assert diag["n_obs"] == 0
        assert diag["rmse"] == 0.0


class TestParameterSpec:
    """Tests for the ParameterSpec dataclass."""

    def test_basic_creation(self):
        """Should create a parameter spec with all fields."""
        spec = ParameterSpec("kappa", initial=0.5, lower=0.01, upper=5.0)
        assert spec.name == "kappa"
        assert spec.initial == 0.5
        assert spec.lower == 0.01
        assert spec.upper == 5.0
        assert spec.fixed is False

    def test_fixed_parameter(self):
        """Fixed parameters should be held at initial value."""
        spec = ParameterSpec("sigma", initial=0.02, fixed=True)
        assert spec.fixed is True


class TestCalibrateGeneric:
    """Tests for the generic calibrate() function."""

    def test_linear_fit(self):
        """Should calibrate a simple linear model y = a*x + b."""
        x = np.linspace(0, 10, 20)
        true_a, true_b = 2.5, 1.0
        y_market = true_a * x + true_b

        def model_fn(params, x_data):
            return params[0] * x_data + params[1]

        specs = [
            ParameterSpec("a", initial=1.0, lower=-10, upper=10),
            ParameterSpec("b", initial=0.0, lower=-10, upper=10),
        ]

        result = calibrate(model_fn, x, y_market, specs, objective="sse")
        assert result.converged
        assert result.params["a"] == pytest.approx(true_a, abs=0.01)
        assert result.params["b"] == pytest.approx(true_b, abs=0.01)
        assert result.diagnostics["rmse"] < 0.01

    def test_quadratic_fit(self):
        """Should calibrate a quadratic model y = a*x^2 + b."""
        x = np.linspace(0, 5, 30)
        y_market = 0.3 * x ** 2 + 1.0

        def model_fn(params, x_data):
            return params[0] * x_data ** 2 + params[1]

        specs = [
            ParameterSpec("a", initial=0.1, lower=0, upper=5),
            ParameterSpec("b", initial=0.0, lower=-5, upper=5),
        ]

        result = calibrate(model_fn, x, y_market, specs, objective="sse")
        assert result.converged
        assert result.params["a"] == pytest.approx(0.3, abs=0.01)
        assert result.params["b"] == pytest.approx(1.0, abs=0.05)

    def test_fixed_parameter_held(self):
        """Fixed parameters should not change during calibration."""
        x = np.linspace(0, 10, 20)
        y_market = 2.0 * x + 5.0

        def model_fn(params, x_data):
            return params[0] * x_data + params[1]

        specs = [
            ParameterSpec("a", initial=2.0, lower=0, upper=10),
            ParameterSpec("b", initial=5.0, fixed=True),
        ]

        result = calibrate(model_fn, x, y_market, specs, objective="sse")
        assert result.params["b"] == 5.0

    def test_result_has_diagnostics(self):
        """CalibrationResult should include diagnostics dict."""
        x = np.array([1.0, 2.0, 3.0])
        y = np.array([1.0, 2.0, 3.0])

        def model_fn(params, x_data):
            return params[0] * x_data

        specs = [ParameterSpec("a", initial=1.0, lower=0, upper=10)]
        result = calibrate(model_fn, x, y, specs)
        assert "rmse" in result.diagnostics
        assert "r_squared" in result.diagnostics
        assert result.elapsed_ms >= 0

    def test_rmse_objective(self):
        """RMSE objective should produce reasonable results."""
        x = np.linspace(0, 5, 20)
        y_market = 1.5 * x

        def model_fn(params, x_data):
            return params[0] * x_data

        specs = [ParameterSpec("a", initial=1.0, lower=0, upper=10)]
        result = calibrate(model_fn, x, y_market, specs, objective="rmse")
        assert result.converged
        assert result.params["a"] == pytest.approx(1.5, abs=0.01)

    def test_differential_evolution(self):
        """differential_evolution method should work."""
        x = np.linspace(0, 5, 15)
        y_market = 2.0 * x + 1.0

        def model_fn(params, x_data):
            return params[0] * x_data + params[1]

        specs = [
            ParameterSpec("a", initial=1.0, lower=0, upper=5),
            ParameterSpec("b", initial=0.0, lower=-2, upper=5),
        ]

        result = calibrate(
            model_fn, x, y_market, specs,
            objective="sse", method="differential_evolution",
        )
        assert result.params["a"] == pytest.approx(2.0, abs=0.05)
        assert result.params["b"] == pytest.approx(1.0, abs=0.1)


# ═════════════════════════════════════════════════════════════════════════════
# SVI Surface Tests
# ═════════════════════════════════════════════════════════════════════════════


class TestSVITotalVariance:
    """Tests for the SVI total variance formula."""

    def test_at_center(self):
        """At k = m, w(m) = a + b * sigma * sqrt(1 - rho^2)... approximately."""
        a, b, rho, m, sigma = 0.04, 0.1, -0.3, 0.0, 0.1
        k = np.array([m])
        w = svi_total_variance(k, a, b, rho, m, sigma)
        expected = a + b * sigma  # rho*(k-m)=0, sqrt(0 + sigma^2) = sigma
        assert w[0] == pytest.approx(expected, abs=1e-10)

    def test_symmetry_zero_rho(self):
        """With rho=0, the smile should be symmetric around m."""
        k = np.linspace(-0.5, 0.5, 100)
        a, b, rho, m, sigma = 0.04, 0.1, 0.0, 0.0, 0.1
        w = svi_total_variance(k, a, b, rho, m, sigma)
        # w(k) should equal w(-k) when rho=0 and m=0
        w_reversed = svi_total_variance(-k, a, b, rho, m, sigma)
        np.testing.assert_allclose(w, w_reversed, atol=1e-12)

    def test_wings_grow(self):
        """Far from center, total variance should grow with |k|."""
        k_near = np.array([0.0])
        k_far = np.array([2.0])
        a, b, rho, m, sigma = 0.04, 0.1, -0.3, 0.0, 0.1
        w_near = svi_total_variance(k_near, a, b, rho, m, sigma)
        w_far = svi_total_variance(k_far, a, b, rho, m, sigma)
        assert w_far[0] > w_near[0]

    def test_non_negative_with_good_params(self):
        """Total variance should be non-negative for reasonable params."""
        k = np.linspace(-1, 1, 100)
        w = svi_total_variance(k, a=0.04, b=0.1, rho=-0.3, m=0.0, sigma=0.1)
        assert np.all(w >= 0)


class TestSVIImpliedVol:
    """Tests for SVI implied vol conversion."""

    def test_positive(self):
        """Implied vol should be positive."""
        k = np.linspace(-0.5, 0.5, 50)
        iv = svi_implied_vol(k, T=0.5, a=0.04, b=0.1, rho=-0.3, m=0.0, sigma=0.1)
        assert np.all(iv > 0)

    def test_scales_with_expiry(self):
        """Shorter expiry should yield higher IV for same total variance params."""
        k = np.array([0.0])
        iv_short = svi_implied_vol(k, T=0.25, a=0.04, b=0.1, rho=-0.3, m=0.0, sigma=0.1)
        iv_long = svi_implied_vol(k, T=1.0, a=0.04, b=0.1, rho=-0.3, m=0.0, sigma=0.1)
        # Same total variance, shorter T => higher IV since IV = sqrt(w/T)
        assert iv_short[0] > iv_long[0]


class TestSVICalibration:
    """Tests for SVI single-slice and surface calibration."""

    def _make_synthetic_data(
        self,
        a=0.04, b=0.08, rho=-0.4, m=0.0, sigma=0.15,
        spot=100.0, T=0.5, r=0.05, q=0.0,
    ):
        """Generate synthetic market data from known SVI params."""
        F = spot * math.exp((r - q) * T)
        strikes = [F * math.exp(k) for k in np.linspace(-0.3, 0.3, 9)]
        k_arr = np.array([math.log(K / F) for K in strikes])
        w = svi_total_variance(k_arr, a, b, rho, m, sigma)
        market_ivs = [float(math.sqrt(max(wi, 1e-10) / T)) for wi in w]
        return strikes, market_ivs

    def test_single_slice_converges(self):
        """SVI calibration should converge on synthetic data."""
        strikes, market_ivs = self._make_synthetic_data()
        result = calibrate_svi_slice(
            strikes=strikes,
            market_ivs=market_ivs,
            spot=100.0,
            T=0.5,
            r=0.05,
            q=0.0,
        )
        assert result["converged"]
        assert result["diagnostics"]["rmse"] < 0.01

    def test_single_slice_output_keys(self):
        """Output dict should contain all expected keys."""
        strikes, market_ivs = self._make_synthetic_data()
        result = calibrate_svi_slice(
            strikes=strikes,
            market_ivs=market_ivs,
            spot=100.0,
            T=0.5,
        )
        expected_keys = {
            "params", "diagnostics", "fitted_ivs", "market_ivs",
            "strikes", "log_moneyness", "residuals", "converged",
            "elapsed_ms", "iterations", "method", "expiry", "forward",
        }
        assert set(result.keys()) == expected_keys

    def test_single_slice_fitted_ivs_close(self):
        """Fitted IVs should be close to market IVs."""
        strikes, market_ivs = self._make_synthetic_data()
        result = calibrate_svi_slice(
            strikes=strikes,
            market_ivs=market_ivs,
            spot=100.0,
            T=0.5,
        )
        max_err = max(abs(f - m) for f, m in zip(result["fitted_ivs"], market_ivs))
        assert max_err < 0.02

    def test_too_few_strikes_raises(self):
        """Should raise ValueError with fewer than 3 strikes."""
        with pytest.raises(ValueError, match="at least 3"):
            calibrate_svi_slice(
                strikes=[100, 105],
                market_ivs=[0.2, 0.22],
                spot=100.0,
                T=0.5,
            )

    def test_mismatched_lengths_raises(self):
        """Should raise ValueError for mismatched strike/IV lengths."""
        with pytest.raises(ValueError, match="same length"):
            calibrate_svi_slice(
                strikes=[90, 100, 110],
                market_ivs=[0.2, 0.22],
                spot=100.0,
                T=0.5,
            )

    def test_surface_multi_slice(self):
        """Surface calibration across multiple slices."""
        slices = []
        for T in [0.25, 0.5, 1.0]:
            F = 100 * math.exp(0.05 * T)
            strikes = [F * math.exp(k) for k in np.linspace(-0.2, 0.2, 7)]
            k_arr = np.array([math.log(K / F) for K in strikes])
            w = svi_total_variance(k_arr, 0.04, 0.08, -0.3, 0.0, 0.12)
            ivs = [float(math.sqrt(max(wi, 1e-10) / T)) for wi in w]
            slices.append({
                "expiry": T,
                "strikes": strikes,
                "market_ivs": ivs,
            })

        result = calibrate_svi_surface(
            slices=slices,
            spot=100.0,
            r=0.05,
            q=0.0,
        )
        assert result["n_slices"] == 3
        assert len(result["slices"]) == 3
        assert "aggregate_diagnostics" in result
        assert result["aggregate_diagnostics"]["rmse"] < 0.02


class TestSVIArbitrage:
    """Tests for SVI arbitrage checking."""

    def test_good_params_no_arbitrage(self):
        """Well-behaved params should be arbitrage-free."""
        result = check_svi_arbitrage(a=0.04, b=0.1, rho=-0.3, m=0.0, sigma=0.1)
        assert result["has_negative_variance"] is False
        assert result["is_likely_arbitrage_free"] is True
        assert result["lee_bound_satisfied"] is True

    def test_negative_variance_detected(self):
        """Params that produce negative variance should be flagged."""
        # Very negative 'a' can produce negative w(k)
        result = check_svi_arbitrage(a=-1.0, b=0.01, rho=0.0, m=0.0, sigma=0.01)
        assert result["has_negative_variance"] is True
        assert result["is_likely_arbitrage_free"] is False

    def test_output_keys(self):
        """Output should contain all expected keys."""
        result = check_svi_arbitrage(a=0.04, b=0.1, rho=-0.3, m=0.0, sigma=0.1)
        expected = {"has_negative_variance", "min_variance", "is_likely_arbitrage_free", "lee_bound_satisfied"}
        assert set(result.keys()) == expected


# ═════════════════════════════════════════════════════════════════════════════
# Rate Model Calibration Tests
# ═════════════════════════════════════════════════════════════════════════════


class TestRateModelCalibration:
    """Tests for rate model calibration to yield curves."""

    # Generate a synthetic upward-sloping yield curve
    MATURITIES = [0.5, 1.0, 2.0, 3.0, 5.0, 7.0, 10.0]
    TARGET_RATES = [0.030, 0.032, 0.035, 0.038, 0.040, 0.042, 0.044]

    def test_vasicek_converges(self):
        """Vasicek calibration should converge."""
        result = calibrate_vasicek(
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        assert result["converged"]
        assert result["model"] == "vasicek"
        assert "kappa" in result["params"]
        assert "theta" in result["params"]
        assert "sigma" in result["params"]

    def test_vasicek_output_keys(self):
        """Vasicek output should have all expected keys."""
        result = calibrate_vasicek(
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        expected = {
            "model", "params", "r0", "maturities", "target_rates",
            "fitted_rates", "residuals", "diagnostics", "converged",
            "elapsed_ms", "iterations", "method",
        }
        assert set(result.keys()) == expected

    def test_vasicek_fitted_rates_reasonable(self):
        """Fitted rates should be within reasonable range of targets."""
        result = calibrate_vasicek(
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        for fitted, target in zip(result["fitted_rates"], self.TARGET_RATES):
            assert abs(fitted - target) < 0.01

    def test_cir_converges(self):
        """CIR calibration should converge."""
        result = calibrate_cir(
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        assert result["converged"]
        assert result["model"] == "cir"

    def test_cir_params_positive(self):
        """CIR calibrated params should satisfy Feller condition direction."""
        result = calibrate_cir(
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        assert result["params"]["kappa"] > 0
        assert result["params"]["theta"] > 0
        assert result["params"]["sigma"] > 0

    def test_dispatch_vasicek(self):
        """Dispatch function should route to vasicek."""
        result = calibrate_rate_model(
            model="vasicek",
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        assert result["model"] == "vasicek"
        assert result["converged"]

    def test_dispatch_cir(self):
        """Dispatch function should route to CIR."""
        result = calibrate_rate_model(
            model="cir",
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        assert result["model"] == "cir"
        assert result["converged"]

    def test_dispatch_unsupported_raises(self):
        """Unsupported model should raise ValueError."""
        with pytest.raises(ValueError, match="Unsupported"):
            calibrate_rate_model(
                model="unknown_model",
                maturities=self.MATURITIES,
                target_rates=self.TARGET_RATES,
            )

    def test_residuals_length(self):
        """Residuals should match number of maturities."""
        result = calibrate_vasicek(
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        assert len(result["residuals"]) == len(self.MATURITIES)

    def test_diagnostics_present(self):
        """Diagnostics should include standard error metrics."""
        result = calibrate_vasicek(
            maturities=self.MATURITIES,
            target_rates=self.TARGET_RATES,
            r0=0.03,
        )
        diag = result["diagnostics"]
        assert "rmse" in diag
        assert "r_squared" in diag
        assert diag["n_obs"] == len(self.MATURITIES)
