"""Tests for the model encyclopedia."""

import pytest

from engine.encyclopedia import (
    get_encyclopedia,
    get_encyclopedia_by_category,
    get_model_detail,
    get_categories,
    MODEL_CATALOGUE,
)


class TestEncyclopedia:
    """Tests for encyclopedia data and retrieval."""

    def test_catalogue_not_empty(self):
        """Catalogue should contain models."""
        assert len(MODEL_CATALOGUE) >= 9

    def test_get_encyclopedia_returns_all(self):
        """get_encyclopedia should return all models."""
        models = get_encyclopedia()
        assert len(models) == len(MODEL_CATALOGUE)

    def test_all_models_have_required_fields(self):
        """Every model entry should have all required fields."""
        required_keys = {
            "id", "name", "category", "formula", "process",
            "assumptions", "suitable_instruments", "strengths",
            "weaknesses", "calibration_burden", "computational_cost",
            "desk_usage", "failure_modes", "fragility_warning",
        }
        for model in MODEL_CATALOGUE:
            missing = required_keys - set(model.keys())
            assert not missing, f"Model '{model.get('id', '?')}' missing keys: {missing}"

    def test_unique_ids(self):
        """Model IDs should be unique."""
        ids = [m["id"] for m in MODEL_CATALOGUE]
        assert len(ids) == len(set(ids)), f"Duplicate IDs found: {ids}"

    def test_category_filter_option(self):
        """Should filter option models correctly."""
        option_models = get_encyclopedia_by_category("option")
        assert len(option_models) >= 3
        assert all(m["category"] == "option" for m in option_models)

    def test_category_filter_rate(self):
        """Should filter rate models correctly."""
        rate_models = get_encyclopedia_by_category("rate")
        assert len(rate_models) >= 3
        assert all(m["category"] == "rate" for m in rate_models)

    def test_category_filter_volatility(self):
        """Should filter vol models correctly."""
        vol_models = get_encyclopedia_by_category("volatility")
        assert len(vol_models) >= 1
        assert all(m["category"] == "volatility" for m in vol_models)

    def test_category_filter_empty(self):
        """Non-existent category should return empty list."""
        result = get_encyclopedia_by_category("nonexistent")
        assert result == []

    def test_get_model_detail_exists(self):
        """Should return details for a known model."""
        model = get_model_detail("black_scholes")
        assert model is not None
        assert model["name"] == "Black-Scholes-Merton"

    def test_get_model_detail_not_found(self):
        """Should return None for unknown model."""
        result = get_model_detail("nonexistent_model")
        assert result is None

    def test_get_categories(self):
        """Should return category list with counts."""
        cats = get_categories()
        assert len(cats) >= 3
        for cat in cats:
            assert "id" in cat
            assert "label" in cat
            assert "count" in cat
            assert cat["count"] > 0

    def test_assumptions_are_lists(self):
        """Assumptions should be non-empty lists of strings."""
        for model in MODEL_CATALOGUE:
            assert isinstance(model["assumptions"], list)
            assert len(model["assumptions"]) >= 1
            assert all(isinstance(a, str) for a in model["assumptions"])

    def test_strengths_weaknesses_non_empty(self):
        """Strengths and weaknesses should be non-empty."""
        for model in MODEL_CATALOGUE:
            assert len(model["strengths"]) >= 1, f"{model['id']} has no strengths"
            assert len(model["weaknesses"]) >= 1, f"{model['id']} has no weaknesses"

    def test_failure_modes_present(self):
        """Every model should have at least one failure mode."""
        for model in MODEL_CATALOGUE:
            assert len(model["failure_modes"]) >= 1, f"{model['id']} has no failure modes"

    def test_formula_contains_latex(self):
        """Formulas should contain LaTeX-like content."""
        for model in MODEL_CATALOGUE:
            # Should have at least a backslash or math operator
            formula = model["formula"]
            assert len(formula) > 5, f"{model['id']} has a very short formula"
