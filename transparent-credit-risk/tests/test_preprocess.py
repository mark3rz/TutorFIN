"""
Tests for the preprocessing pipeline.

These tests verify that preprocessing produces correct outputs,
preserves data integrity, and creates valid artifacts. They use
small synthetic data to avoid depending on the downloaded dataset.
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.compose import ColumnTransformer

from src.preprocess import (
    encode_target,
    identify_columns,
    build_preprocessor,
    build_feature_lineage,
)


@pytest.fixture
def sample_config():
    """Minimal config for testing."""
    return {
        "project": {"random_seed": 42},
        "data": {
            "target_column": "class",
            "positive_label": "good",
            "negative_label": "bad",
            "test_size": 0.2,
            "validation_size": 0.15,
            "raw_path": "data/raw/credit_data.csv",
            "processed_dir": "data/processed",
            "metadata_dir": "data/metadata",
        },
        "features": {
            "drop_columns": [],
            "flag_columns": [],
            "default_trace_feature": "age",
        },
        "preprocessing": {
            "numeric_imputer_strategy": "median",
            "categorical_imputer_strategy": "most_frequent",
            "numeric_scaler": "standard",
            "handle_unknown_categories": "infrequent_if_exist",
            "artifacts_dir": "models/preprocessors",
            "lineage_path": "data/metadata/feature_lineage.json",
            "feature_map_path": "data/metadata/transformed_feature_map.csv",
            "dropped_columns_path": "data/metadata/dropped_columns.csv",
            "leakage_review_path": "data/metadata/leakage_review.csv",
        },
    }


@pytest.fixture
def sample_df():
    """Create a small synthetic DataFrame mimicking the credit dataset."""
    np.random.seed(42)
    n = 50
    return pd.DataFrame({
        "age": np.random.randint(20, 70, n),
        "duration": np.random.randint(6, 48, n),
        "credit_amount": np.random.randint(500, 10000, n),
        "housing": np.random.choice(["rent", "own", "for free"], n),
        "job": np.random.choice(["skilled", "unskilled resident"], n),
        "class": np.random.choice(["good", "bad"], n),
    })


class TestEncodeTarget:
    """Tests for target variable encoding."""

    def test_encode_good_as_positive(self):
        series = pd.Series(["good", "bad", "good", "bad"])
        result = encode_target(series, "good")
        np.testing.assert_array_equal(result, [1, 0, 1, 0])

    def test_encode_bad_as_positive(self):
        series = pd.Series(["good", "bad", "good"])
        result = encode_target(series, "bad")
        np.testing.assert_array_equal(result, [0, 1, 0])

    def test_returns_numpy_array(self):
        series = pd.Series(["good", "bad"])
        result = encode_target(series, "good")
        assert isinstance(result, np.ndarray)

    def test_output_is_integer(self):
        series = pd.Series(["good", "bad"])
        result = encode_target(series, "good")
        assert result.dtype == int


class TestBuildPreprocessor:
    """Tests for preprocessor construction."""

    def test_returns_column_transformer(self, sample_config):
        numeric_cols = ["age", "duration"]
        categorical_cols = ["housing"]
        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)
        assert isinstance(preprocessor, ColumnTransformer)

    def test_fit_transform_produces_correct_shape(self, sample_df, sample_config):
        numeric_cols = ["age", "duration", "credit_amount"]
        categorical_cols = ["housing", "job"]
        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)

        X = sample_df.drop(columns=["class"])
        result = preprocessor.fit_transform(X)

        # Should have 3 numeric + (3 housing categories + 2 job categories) = 8
        assert result.shape[0] == len(X)
        assert result.shape[1] >= 5  # At least numeric cols + some one-hot

    def test_numeric_features_are_scaled(self, sample_df, sample_config):
        numeric_cols = ["age"]
        categorical_cols = []
        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)

        X = sample_df[["age"]]
        result = preprocessor.fit_transform(X)

        # After standard scaling, mean should be approximately 0
        assert abs(result.mean()) < 0.1

    def test_no_nans_in_output(self, sample_df, sample_config):
        numeric_cols = ["age", "duration", "credit_amount"]
        categorical_cols = ["housing", "job"]
        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)

        X = sample_df.drop(columns=["class"])
        result = preprocessor.fit_transform(X)

        assert not np.isnan(result).any()


class TestBuildFeatureLineage:
    """Tests for feature lineage construction."""

    def test_lineage_has_correct_number_of_records(self, sample_df, sample_config):
        numeric_cols = ["age", "duration"]
        categorical_cols = ["housing"]

        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)
        X = sample_df.drop(columns=["class"])
        preprocessor.fit(X)

        lineage = build_feature_lineage(preprocessor, numeric_cols, categorical_cols)

        # 2 numeric + number of housing categories
        n_housing_cats = sample_df["housing"].nunique()
        expected = 2 + n_housing_cats
        assert len(lineage.records) == expected

    def test_numeric_lineage_records_are_correct(self, sample_df, sample_config):
        numeric_cols = ["age"]
        categorical_cols = []

        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)
        X = sample_df[["age"]]
        preprocessor.fit(X)

        lineage = build_feature_lineage(preprocessor, numeric_cols, categorical_cols)

        records = lineage.get_records_for_source("age")
        assert len(records) == 1
        assert records[0]["source_column"] == "age"
        assert records[0]["source_type"] == "numeric"
        assert records[0]["transformed_index"] == 0

    def test_categorical_lineage_creates_multiple_records(self, sample_df, sample_config):
        numeric_cols = []
        categorical_cols = ["housing"]

        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)
        X = sample_df[["housing"]]
        preprocessor.fit(X)

        lineage = build_feature_lineage(preprocessor, numeric_cols, categorical_cols)

        records = lineage.get_records_for_source("housing")
        n_categories = sample_df["housing"].nunique()
        assert len(records) == n_categories

    def test_indices_are_sequential(self, sample_df, sample_config):
        numeric_cols = ["age", "duration"]
        categorical_cols = ["housing"]

        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)
        X = sample_df.drop(columns=["class"])
        preprocessor.fit(X)

        lineage = build_feature_lineage(preprocessor, numeric_cols, categorical_cols)

        indices = [r["transformed_index"] for r in lineage.records]
        assert indices == list(range(len(indices)))

    def test_all_source_columns_recoverable(self, sample_df, sample_config):
        numeric_cols = ["age", "duration"]
        categorical_cols = ["housing"]

        preprocessor = build_preprocessor(numeric_cols, categorical_cols, sample_config)
        X = sample_df.drop(columns=["class"])
        preprocessor.fit(X)

        lineage = build_feature_lineage(preprocessor, numeric_cols, categorical_cols)

        source_cols = lineage.get_all_source_columns()
        assert set(source_cols) == {"age", "duration", "housing"}
