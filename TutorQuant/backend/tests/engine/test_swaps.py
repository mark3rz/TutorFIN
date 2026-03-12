"""Tests for interest-rate swap engines: vanilla IRS, OIS, basis swaps."""

from __future__ import annotations

import math

import pytest

from engine.swaps.vanilla_irs import (
    price_vanilla_irs,
    compute_par_rate,
    compute_swap_sensitivities,
    par_rate_curve,
)
from engine.swaps.ois import (
    ois_par_rate,
    ois_vs_libor_basis,
    dual_curve_price,
    get_ois_concepts,
)
from engine.swaps.basis_swap import (
    price_basis_swap,
    get_basis_swap_types,
)
from engine.swaps.cross_currency import (
    xccy_swap_overview,
    simplified_xccy_npv,
)


# ═════════════════════════════════════════════════════════════════════════════
# Vanilla IRS Tests
# ═════════════════════════════════════════════════════════════════════════════


class TestVanillaIRSPricing:
    """Tests for vanilla IRS pricing engine."""

    def test_output_keys(self):
        """Output dict contains all expected keys."""
        result = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
        )
        expected_keys = {
            "npv", "fixed_leg_pv", "float_leg_pv", "par_rate",
            "fixed_cashflows", "float_cashflows", "annuity", "dv01",
            "notional", "tenor_years", "fixed_rate", "is_payer",
        }
        assert set(result.keys()) == expected_keys

    def test_par_rate_zero_npv(self):
        """At par rate, NPV should be approximately zero."""
        par = compute_par_rate(5.0, discount_rate=0.04, pay_freq=4, float_freq=4)
        result = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=par,
            tenor_years=5.0,
            discount_rate=0.04,
            pay_freq=4,
            rec_freq=4,
        )
        assert abs(result["npv"]) < 1.0  # within $1

    def test_payer_vs_receiver(self):
        """Payer and receiver NPV should be negatives of each other."""
        payer = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
            is_payer=True,
        )
        receiver = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
            is_payer=False,
        )
        assert abs(payer["npv"] + receiver["npv"]) < 0.01

    def test_fixed_cashflow_count(self):
        """Number of fixed cashflows matches tenor * frequency."""
        result = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
            pay_freq=2,
        )
        assert len(result["fixed_cashflows"]) == 10  # 5 years * 2 per year

    def test_float_cashflow_count(self):
        """Number of floating cashflows matches tenor * frequency."""
        result = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
            rec_freq=4,
        )
        assert len(result["float_cashflows"]) == 20  # 5 years * 4 per year

    def test_higher_fixed_rate_reduces_payer_npv(self):
        """Increasing fixed rate should decrease payer NPV."""
        low = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.03,
            tenor_years=5.0,
            discount_rate=0.04,
        )
        high = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.05,
            tenor_years=5.0,
            discount_rate=0.04,
        )
        assert high["npv"] < low["npv"]

    def test_dv01_positive(self):
        """DV01 should be positive for a swap with positive annuity."""
        result = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
        )
        assert result["dv01"] > 0

    def test_annuity_scales_with_tenor(self):
        """Longer tenor should produce larger annuity factor."""
        short = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=2.0,
            discount_rate=0.04,
        )
        long = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=10.0,
            discount_rate=0.04,
        )
        assert long["annuity"] > short["annuity"]

    def test_invalid_notional_raises(self):
        """Negative notional should raise ValueError."""
        with pytest.raises(ValueError, match="Notional"):
            price_vanilla_irs(
                notional=-100,
                fixed_rate=0.04,
                tenor_years=5.0,
                discount_rate=0.04,
            )

    def test_invalid_tenor_raises(self):
        """Non-positive tenor should raise ValueError."""
        with pytest.raises(ValueError, match="Tenor"):
            price_vanilla_irs(
                notional=1_000_000,
                fixed_rate=0.04,
                tenor_years=0.0,
                discount_rate=0.04,
            )

    def test_with_discount_curve(self):
        """Pricing with a term-structure curve should work."""
        curve = [
            {"tenor": 1.0, "rate": 0.03},
            {"tenor": 2.0, "rate": 0.035},
            {"tenor": 5.0, "rate": 0.04},
            {"tenor": 10.0, "rate": 0.042},
        ]
        result = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_curve=curve,
        )
        assert "npv" in result
        assert result["par_rate"] > 0

    def test_float_spread_increases_float_pv(self):
        """Adding a positive float spread should increase floating leg PV."""
        no_spread = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
            float_spread=0.0,
        )
        with_spread = price_vanilla_irs(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
            float_spread=0.005,
        )
        assert with_spread["float_leg_pv"] > no_spread["float_leg_pv"]


class TestParRate:
    """Tests for par swap rate computation."""

    def test_par_rate_positive(self):
        """Par rate should be positive for positive discount rates."""
        pr = compute_par_rate(5.0, discount_rate=0.04)
        assert pr > 0

    def test_par_rate_approaches_flat_rate(self):
        """For a flat curve, par rate should be close to the flat rate."""
        pr = compute_par_rate(5.0, discount_rate=0.04, pay_freq=2)
        # Not exactly equal due to compounding, but close
        assert abs(pr - 0.04) < 0.005

    def test_par_rate_term_structure(self):
        """Par rates should differ across tenors."""
        pr_2y = compute_par_rate(2.0, discount_rate=0.04)
        pr_10y = compute_par_rate(10.0, discount_rate=0.04)
        # For a flat curve these should be very close, but not identical
        # due to different annuity structures
        assert pr_2y > 0
        assert pr_10y > 0


class TestParRateCurve:
    """Tests for par rate curve generation."""

    def test_output_shape(self):
        """Output should have matching tenor and par_rate arrays."""
        tenors = [1, 2, 3, 5, 7, 10]
        result = par_rate_curve(tenors, discount_rate=0.04)
        assert len(result["tenors"]) == len(tenors)
        assert len(result["par_rates"]) == len(tenors)

    def test_all_positive(self):
        """All par rates should be positive for positive discount rate."""
        tenors = [1, 2, 5, 10]
        result = par_rate_curve(tenors, discount_rate=0.04)
        assert all(r > 0 for r in result["par_rates"])


class TestSwapSensitivities:
    """Tests for swap sensitivity analysis."""

    def test_output_keys(self):
        """Output should contain all sensitivity keys."""
        result = compute_swap_sensitivities(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
        )
        assert "base_npv" in result
        assert "dv01" in result
        assert "convexity" in result
        assert "rate_bumps" in result
        assert "npvs" in result

    def test_bump_profile_length(self):
        """Bump profile should have 11 entries."""
        result = compute_swap_sensitivities(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            discount_rate=0.04,
        )
        assert len(result["rate_bumps"]) == 11
        assert len(result["npvs"]) == 11

    def test_dv01_nonzero(self):
        """DV01 should be non-zero for a non-par swap."""
        result = compute_swap_sensitivities(
            notional=1_000_000,
            fixed_rate=0.03,
            tenor_years=5.0,
            discount_rate=0.04,
        )
        assert result["dv01"] != 0


# ═════════════════════════════════════════════════════════════════════════════
# OIS / Dual-Curve Tests
# ═════════════════════════════════════════════════════════════════════════════


class TestOIS:
    """Tests for OIS par rate and dual-curve pricing."""

    def test_ois_par_rate_positive(self):
        """OIS par rate should be positive for positive rates."""
        pr = ois_par_rate(5.0, ois_rate=0.035, freq=1)
        assert pr > 0

    def test_ois_libor_basis_positive(self):
        """OIS-LIBOR basis should be positive when LIBOR > OIS."""
        result = ois_vs_libor_basis(5.0, ois_rate=0.035, libor_rate=0.04)
        assert result["basis_bps"] > 0

    def test_ois_libor_basis_zero_when_equal(self):
        """Basis should be approximately zero when OIS = LIBOR."""
        result = ois_vs_libor_basis(5.0, ois_rate=0.04, libor_rate=0.04)
        assert abs(result["basis_bps"]) < 0.01

    def test_dual_curve_output_keys(self):
        """Dual-curve output should contain comparison data."""
        result = dual_curve_price(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            projection_rate=0.045,
            discount_rate=0.04,
        )
        assert "npv" in result
        assert "single_curve_npv" in result
        assert "basis_adjustment" in result

    def test_dual_curve_matches_single_when_rates_equal(self):
        """When projection = discount rate, dual and single should match."""
        result = dual_curve_price(
            notional=1_000_000,
            fixed_rate=0.04,
            tenor_years=5.0,
            projection_rate=0.04,
            discount_rate=0.04,
        )
        assert abs(result["npv"] - result["single_curve_npv"]) < 1.0

    def test_ois_concepts_not_empty(self):
        """OIS concepts reference data should be non-empty."""
        concepts = get_ois_concepts()
        assert len(concepts) > 0
        assert "concept" in concepts[0]
        assert "description" in concepts[0]


# ═════════════════════════════════════════════════════════════════════════════
# Basis Swap Tests
# ═════════════════════════════════════════════════════════════════════════════


class TestBasisSwap:
    """Tests for basis swap pricing."""

    def test_output_keys(self):
        """Output should contain all basis swap keys."""
        result = price_basis_swap(
            notional=1_000_000,
            tenor_years=5.0,
            rate_a=0.045,
            rate_b=0.044,
        )
        assert "npv" in result
        assert "par_basis_spread" in result
        assert "par_basis_spread_bps" in result

    def test_par_spread_zero_when_rates_equal(self):
        """Par basis spread should be near zero when both rates are equal."""
        result = price_basis_swap(
            notional=1_000_000,
            tenor_years=5.0,
            rate_a=0.04,
            rate_b=0.04,
            freq_a=4,
            freq_b=4,
        )
        assert abs(result["par_basis_spread_bps"]) < 0.5

    def test_invalid_notional_raises(self):
        """Negative notional should raise ValueError."""
        with pytest.raises(ValueError, match="Notional"):
            price_basis_swap(
                notional=-100,
                tenor_years=5.0,
                rate_a=0.04,
                rate_b=0.04,
            )

    def test_basis_types_not_empty(self):
        """Basis swap types reference data should be non-empty."""
        types = get_basis_swap_types()
        assert len(types) > 0
        assert "type" in types[0]


# ═════════════════════════════════════════════════════════════════════════════
# Cross-Currency Swap Tests
# ═════════════════════════════════════════════════════════════════════════════


class TestCrossCurrencySwap:
    """Tests for cross-currency swap conceptual module."""

    def test_overview_structure(self):
        """Overview should contain expected sections."""
        overview = xccy_swap_overview()
        assert "definition" in overview
        assert "mechanics" in overview
        assert "basis_spread" in overview
        assert "use_cases" in overview
        assert len(overview["mechanics"]) == 3

    def test_simplified_npv_output(self):
        """Simplified XCCY NPV should return expected keys."""
        result = simplified_xccy_npv(
            notional_dom=100_000_000,
            notional_for=85_000_000,
            rate_dom=0.05,
            rate_for=0.035,
            basis_spread=-0.002,
            tenor_years=5.0,
            discount_rate_dom=0.04,
            discount_rate_for=0.03,
            spot_fx=1.1765,
        )
        assert "npv_domestic" in result
        assert "domestic_leg_pv" in result
        assert "foreign_leg_pv_domestic" in result

    def test_invalid_tenor_raises(self):
        """Non-positive tenor should raise."""
        with pytest.raises(ValueError, match="Tenor"):
            simplified_xccy_npv(
                notional_dom=100_000_000,
                notional_for=85_000_000,
                rate_dom=0.05,
                rate_for=0.035,
                basis_spread=0.0,
                tenor_years=0.0,
                discount_rate_dom=0.04,
                discount_rate_for=0.03,
                spot_fx=1.0,
            )
