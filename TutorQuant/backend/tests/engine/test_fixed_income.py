"""Tests for fixed-income module: bond pricing, YTM, duration, convexity, curves.

Test groups
-----------
1. Cash-flow generation
2. Zero-coupon bond pricing
3. Coupon bond pricing
4. Accrued interest
5. Clean vs dirty price
6. Yield to maturity solver
7. Macaulay duration
8. Modified duration
9. Convexity
10. DV01
11. Price-yield relationship
12. Discount factor conversions
13. Bootstrap zero curve
14. Forward rates
15. Edge cases and input validation
"""

from __future__ import annotations

import math

import pytest

from engine.fixed_income.bonds import (
    generate_cashflows,
    price_bond_from_yield,
    accrued_interest,
)
from engine.fixed_income.analytics import (
    yield_to_maturity,
    macaulay_duration,
    modified_duration,
    convexity,
    dv01,
    price_yield_curve,
    full_bond_analytics,
)
from engine.fixed_income.curves import (
    discount_factors_from_zero_rates,
    zero_rates_from_discount_factors,
    forward_rates,
    bootstrap_zero_curve,
    generate_demo_yield_curve,
)


# ---------------------------------------------------------------------------
# 1. Cash-flow Generation
# ---------------------------------------------------------------------------

class TestCashflows:
    def test_annual_coupon(self):
        """Annual 5% coupon on 100 face, 3 years."""
        times, cfs = generate_cashflows(100, 0.05, 1, 3.0)
        assert len(times) == 3
        assert cfs[0] == pytest.approx(5.0)
        assert cfs[1] == pytest.approx(5.0)
        assert cfs[2] == pytest.approx(105.0)  # coupon + face

    def test_semiannual_coupon(self):
        """Semi-annual 6% coupon on 1000 face, 2 years."""
        times, cfs = generate_cashflows(1000, 0.06, 2, 2.0)
        assert len(times) == 4
        assert cfs[0] == pytest.approx(30.0)  # 1000 * 0.06 / 2
        assert cfs[3] == pytest.approx(1030.0)

    def test_zero_coupon(self):
        """Zero-coupon bond: single cash flow at maturity."""
        times, cfs = generate_cashflows(100, 0.0, 1, 5.0)
        assert len(times) == 5
        # First 4 have CF = 0, last has face value
        assert cfs[0] == pytest.approx(0.0)
        assert cfs[4] == pytest.approx(100.0)

    def test_settlement_offset(self):
        """Settlement offset should shift first payment closer."""
        times_no_offset, _ = generate_cashflows(100, 0.05, 2, 2.0, settlement_offset=0.0)
        times_with_offset, _ = generate_cashflows(100, 0.05, 2, 2.0, settlement_offset=0.5)
        # With offset, first payment is sooner
        assert times_with_offset[0] < times_no_offset[0]

    def test_invalid_face_value(self):
        with pytest.raises(ValueError, match="Face value"):
            generate_cashflows(-100, 0.05, 2, 5.0)

    def test_invalid_coupon_rate(self):
        with pytest.raises(ValueError, match="Coupon rate"):
            generate_cashflows(100, -0.01, 2, 5.0)


# ---------------------------------------------------------------------------
# 2. Zero-Coupon Bond Pricing
# ---------------------------------------------------------------------------

class TestZeroCouponPricing:
    def test_zcb_price(self):
        """ZCB: price = face / (1 + y)^T."""
        result = price_bond_from_yield(100, 0.0, 1, 5.0, ytm=0.05)
        expected = 100 / (1.05 ** 5)
        assert result["dirty_price"] == pytest.approx(expected, rel=1e-6)

    def test_zcb_at_zero_yield(self):
        """At y=0, ZCB price = face value."""
        result = price_bond_from_yield(100, 0.0, 1, 10.0, ytm=0.0)
        assert result["dirty_price"] == pytest.approx(100.0, rel=1e-6)

    def test_zcb_no_accrued(self):
        """ZCB has no accrued interest at settlement_offset=0."""
        result = price_bond_from_yield(100, 0.0, 2, 5.0, ytm=0.05)
        assert result["accrued_interest"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 3. Coupon Bond Pricing
# ---------------------------------------------------------------------------

class TestCouponBondPricing:
    def test_par_bond(self):
        """Bond trading at par: coupon rate = YTM => price ≈ face."""
        result = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=0.05)
        assert result["dirty_price"] == pytest.approx(100.0, rel=1e-4)

    def test_premium_bond(self):
        """Coupon > YTM => price > face."""
        result = price_bond_from_yield(100, 0.08, 2, 10.0, ytm=0.05)
        assert result["dirty_price"] > 100.0

    def test_discount_bond(self):
        """Coupon < YTM => price < face."""
        result = price_bond_from_yield(100, 0.03, 2, 10.0, ytm=0.05)
        assert result["dirty_price"] < 100.0

    def test_price_decreases_with_yield(self):
        """Higher yield => lower price (inverse relationship)."""
        p_low = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=0.03)["dirty_price"]
        p_high = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=0.08)["dirty_price"]
        assert p_low > p_high


# ---------------------------------------------------------------------------
# 4. Accrued Interest
# ---------------------------------------------------------------------------

class TestAccruedInterest:
    def test_zero_offset(self):
        """No accrued interest right after coupon payment."""
        ai = accrued_interest(100, 0.06, 2, 0.0)
        assert ai == 0.0

    def test_half_period(self):
        """Half period elapsed: AI = half of coupon payment."""
        ai = accrued_interest(100, 0.06, 2, 0.5)
        assert ai == pytest.approx(1.5)  # 100 * 0.06 / 2 * 0.5

    def test_full_period_approach(self):
        """Almost full period: AI ≈ full coupon payment."""
        ai = accrued_interest(100, 0.06, 2, 0.99)
        assert ai == pytest.approx(100 * 0.06 / 2 * 0.99, rel=1e-6)


# ---------------------------------------------------------------------------
# 5. Clean vs Dirty Price
# ---------------------------------------------------------------------------

class TestCleanDirtyPrice:
    def test_clean_equals_dirty_at_coupon_date(self):
        """At settlement_offset=0, clean = dirty."""
        result = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=0.05, settlement_offset=0.0)
        assert result["clean_price"] == pytest.approx(result["dirty_price"])

    def test_dirty_exceeds_clean_between_coupons(self):
        """Between coupon dates, dirty > clean."""
        result = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=0.05, settlement_offset=0.5)
        assert result["dirty_price"] > result["clean_price"]
        assert result["accrued_interest"] > 0

    def test_clean_dirty_difference(self):
        """dirty - clean = accrued interest."""
        result = price_bond_from_yield(100, 0.06, 2, 5.0, ytm=0.04, settlement_offset=0.3)
        diff = result["dirty_price"] - result["clean_price"]
        assert diff == pytest.approx(result["accrued_interest"], rel=1e-8)


# ---------------------------------------------------------------------------
# 6. Yield to Maturity Solver
# ---------------------------------------------------------------------------

class TestYTMSolver:
    def test_roundtrip(self):
        """Price at y=5%, solve YTM => should recover 5%."""
        result = price_bond_from_yield(100, 0.06, 2, 10.0, ytm=0.05)
        ytm = yield_to_maturity(result["dirty_price"], 100, 0.06, 2, 10.0)
        assert ytm == pytest.approx(0.05, abs=1e-8)

    def test_par_bond_ytm(self):
        """Par bond: YTM = coupon rate."""
        ytm = yield_to_maturity(100.0, 100, 0.05, 2, 10.0)
        assert ytm == pytest.approx(0.05, abs=1e-6)

    def test_discount_bond_ytm(self):
        """Discount bond: YTM > coupon rate."""
        ytm = yield_to_maturity(90.0, 100, 0.03, 2, 10.0)
        assert ytm > 0.03

    def test_premium_bond_ytm(self):
        """Premium bond: YTM < coupon rate."""
        ytm = yield_to_maturity(110.0, 100, 0.08, 2, 10.0)
        assert ytm < 0.08

    def test_zcb_ytm(self):
        """ZCB YTM solve."""
        price = 100 / (1.06 ** 5)
        ytm = yield_to_maturity(price, 100, 0.0, 1, 5.0)
        assert ytm == pytest.approx(0.06, abs=1e-6)

    def test_negative_price_fails(self):
        with pytest.raises(ValueError, match="Dirty price must be > 0"):
            yield_to_maturity(-50, 100, 0.05, 2, 10.0)


# ---------------------------------------------------------------------------
# 7. Macaulay Duration
# ---------------------------------------------------------------------------

class TestMacaulayDuration:
    def test_zcb_duration_equals_maturity(self):
        """ZCB Macaulay duration = maturity."""
        d = macaulay_duration(100, 0.0, 1, 10.0, ytm=0.05)
        assert d == pytest.approx(10.0, rel=1e-4)

    def test_coupon_bond_duration_less_than_maturity(self):
        """Coupon bond: duration < maturity."""
        d = macaulay_duration(100, 0.05, 2, 10.0, ytm=0.05)
        assert d < 10.0
        assert d > 0

    def test_higher_coupon_shorter_duration(self):
        """Higher coupon => shorter duration."""
        d_low = macaulay_duration(100, 0.02, 2, 10.0, ytm=0.05)
        d_high = macaulay_duration(100, 0.10, 2, 10.0, ytm=0.05)
        assert d_low > d_high


# ---------------------------------------------------------------------------
# 8. Modified Duration
# ---------------------------------------------------------------------------

class TestModifiedDuration:
    def test_mod_less_than_mac(self):
        """Modified duration < Macaulay duration (for positive yield)."""
        d_mac = macaulay_duration(100, 0.05, 2, 10.0, ytm=0.05)
        d_mod = modified_duration(100, 0.05, 2, 10.0, ytm=0.05)
        assert d_mod < d_mac

    def test_mod_equals_mac_at_zero_yield(self):
        """At y=0, modified = Macaulay."""
        d_mac = macaulay_duration(100, 0.05, 2, 10.0, ytm=0.0)
        d_mod = modified_duration(100, 0.05, 2, 10.0, ytm=0.0)
        assert d_mod == pytest.approx(d_mac, rel=1e-10)

    def test_price_sensitivity(self):
        """Approximate price change: dP ≈ -D_mod * P * dy."""
        ytm = 0.05
        dy = 0.001
        d_mod = modified_duration(100, 0.05, 2, 10.0, ytm=ytm)
        p0 = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=ytm)["dirty_price"]
        p1 = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=ytm + dy)["dirty_price"]
        actual_dp = p1 - p0
        approx_dp = -d_mod * p0 * dy
        # Should be close (first-order approximation)
        assert abs(actual_dp - approx_dp) < 0.05


# ---------------------------------------------------------------------------
# 9. Convexity
# ---------------------------------------------------------------------------

class TestConvexity:
    def test_positive(self):
        """Convexity should be positive for standard bonds."""
        c = convexity(100, 0.05, 2, 10.0, ytm=0.05)
        assert c > 0

    def test_longer_maturity_higher_convexity(self):
        """Longer maturity => higher convexity."""
        c_short = convexity(100, 0.05, 2, 5.0, ytm=0.05)
        c_long = convexity(100, 0.05, 2, 30.0, ytm=0.05)
        assert c_long > c_short

    def test_second_order_approximation(self):
        """Price change with duration + convexity should be more accurate."""
        ytm = 0.05
        dy = 0.01
        p0 = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=ytm)["dirty_price"]
        p1 = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=ytm + dy)["dirty_price"]

        d_mod = modified_duration(100, 0.05, 2, 10.0, ytm=ytm)
        c = convexity(100, 0.05, 2, 10.0, ytm=ytm)

        actual_dp = p1 - p0
        first_order = -d_mod * p0 * dy
        second_order = first_order + 0.5 * c * p0 * dy ** 2

        # Second-order should be closer to actual
        assert abs(actual_dp - second_order) < abs(actual_dp - first_order)


# ---------------------------------------------------------------------------
# 10. DV01
# ---------------------------------------------------------------------------

class TestDV01:
    def test_positive(self):
        """DV01 should be positive."""
        d = dv01(100, 0.05, 2, 10.0, ytm=0.05)
        assert d > 0

    def test_numerical_check(self):
        """DV01 should approximate actual price change for 1bp."""
        ytm = 0.05
        d = dv01(100, 0.05, 2, 10.0, ytm=ytm)
        p0 = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=ytm)["dirty_price"]
        p1 = price_bond_from_yield(100, 0.05, 2, 10.0, ytm=ytm + 0.0001)["dirty_price"]
        actual_change = abs(p1 - p0)
        assert d == pytest.approx(actual_change, rel=0.01)


# ---------------------------------------------------------------------------
# 11. Price-Yield Relationship
# ---------------------------------------------------------------------------

class TestPriceYieldCurve:
    def test_output_shape(self):
        result = price_yield_curve(100, 0.05, 2, 10.0, n_points=20)
        assert len(result["yields"]) == 20
        assert len(result["dirty_prices"]) == 20
        assert len(result["clean_prices"]) == 20

    def test_monotone_decreasing(self):
        """Prices should decrease as yields increase."""
        result = price_yield_curve(100, 0.05, 2, 10.0, yield_min=0.01, yield_max=0.10)
        for i in range(1, len(result["dirty_prices"])):
            assert result["dirty_prices"][i] <= result["dirty_prices"][i - 1]


# ---------------------------------------------------------------------------
# 12. Discount Factor Conversions
# ---------------------------------------------------------------------------

class TestDiscountFactors:
    def test_annual_roundtrip(self):
        times = [1.0, 2.0, 5.0, 10.0]
        rates = [0.03, 0.04, 0.05, 0.06]
        dfs = discount_factors_from_zero_rates(times, rates, "annual")
        rates_back = zero_rates_from_discount_factors(times, dfs, "annual")
        for r_orig, r_back in zip(rates, rates_back):
            assert r_back == pytest.approx(r_orig, abs=1e-10)

    def test_continuous_roundtrip(self):
        times = [1.0, 2.0, 5.0]
        rates = [0.03, 0.04, 0.05]
        dfs = discount_factors_from_zero_rates(times, rates, "continuous")
        rates_back = zero_rates_from_discount_factors(times, dfs, "continuous")
        for r_orig, r_back in zip(rates, rates_back):
            assert r_back == pytest.approx(r_orig, abs=1e-10)

    def test_df_less_than_one(self):
        """Positive rates => DF < 1."""
        dfs = discount_factors_from_zero_rates([1.0, 5.0, 10.0], [0.05, 0.05, 0.05])
        for df in dfs:
            assert 0 < df < 1


# ---------------------------------------------------------------------------
# 13. Bootstrap Zero Curve
# ---------------------------------------------------------------------------

class TestBootstrap:
    def test_flat_par_curve(self):
        """Flat par curve: zero rates should approximately equal par rate."""
        mats = [0.5, 1.0, 2.0, 3.0, 5.0]
        par_rates = [0.05] * len(mats)
        result = bootstrap_zero_curve(par_rates, mats, coupon_frequency=2)
        for z in result["zero_rates"]:
            assert abs(z - 0.05) < 0.005

    def test_upward_sloping(self):
        """Normal curve: zero rates should be above par rates for longer maturities."""
        mats = [1.0, 2.0, 5.0, 10.0]
        par_rates = [0.03, 0.04, 0.05, 0.06]
        result = bootstrap_zero_curve(par_rates, mats, coupon_frequency=2)
        # Zero rate for 10y should be >= par rate for 10y
        assert result["zero_rates"][-1] >= par_rates[-1] - 0.005

    def test_dfs_monotone_decreasing(self):
        """Discount factors should decrease with maturity."""
        mats = [1.0, 2.0, 5.0, 10.0]
        par_rates = [0.04, 0.045, 0.05, 0.055]
        result = bootstrap_zero_curve(par_rates, mats)
        for i in range(1, len(result["discount_factors"])):
            assert result["discount_factors"][i] < result["discount_factors"][i - 1]


# ---------------------------------------------------------------------------
# 14. Forward Rates
# ---------------------------------------------------------------------------

class TestForwardRates:
    def test_output_length(self):
        times = [1.0, 2.0, 5.0, 10.0]
        dfs = discount_factors_from_zero_rates(times, [0.04, 0.045, 0.05, 0.055])
        labels, rates = forward_rates(times, dfs)
        assert len(labels) == 3
        assert len(rates) == 3

    def test_forward_positive(self):
        """Forward rates should be positive for upward-sloping curve."""
        times = [1.0, 2.0, 5.0]
        dfs = discount_factors_from_zero_rates(times, [0.03, 0.04, 0.05])
        _, rates = forward_rates(times, dfs)
        for r in rates:
            assert r > 0


# ---------------------------------------------------------------------------
# 15. Edge Cases and Full Analytics
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_full_analytics(self):
        """full_bond_analytics should return all fields."""
        result = full_bond_analytics(100, 0.05, 2, 10.0, ytm=0.05)
        assert "dirty_price" in result
        assert "clean_price" in result
        assert "macaulay_duration" in result
        assert "modified_duration" in result
        assert "convexity" in result
        assert "dv01" in result
        assert result["dirty_price"] == pytest.approx(100.0, rel=1e-4)

    def test_demo_curve_normal(self):
        result = generate_demo_yield_curve("normal")
        assert len(result["maturities"]) == 10
        assert len(result["par_rates"]) == 10
        # Should be upward-sloping
        assert result["par_rates"][-1] > result["par_rates"][0]

    def test_demo_curve_inverted(self):
        result = generate_demo_yield_curve("inverted")
        assert result["par_rates"][-1] < result["par_rates"][0]

    def test_demo_curve_flat(self):
        result = generate_demo_yield_curve("flat")
        assert all(r == result["par_rates"][0] for r in result["par_rates"])

    def test_demo_curve_invalid(self):
        with pytest.raises(ValueError, match="Unknown curve style"):
            generate_demo_yield_curve("zigzag")

    def test_short_maturity_bond(self):
        """Bond with 0.5 year maturity should work."""
        result = price_bond_from_yield(100, 0.04, 2, 0.5, ytm=0.04)
        assert result["dirty_price"] > 0
        assert result["n_remaining_coupons"] == 1
