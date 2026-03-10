"""
Tests for the FeatureLineage class.

Verifies that lineage records can be added, queried, serialized,
and deserialized correctly.
"""

import json
import tempfile
from pathlib import Path

import pytest

from src.feature_lineage import FeatureLineage


@pytest.fixture
def sample_lineage():
    """Create a FeatureLineage with sample records."""
    lineage = FeatureLineage()

    # Numeric feature: age -> 1 transformed feature
    lineage.add_record(
        source_column="age",
        source_type="numeric",
        transformation_type="standard_scaling",
        transformed_feature_name="age",
        transformed_index=0,
        notes="Scaled to mean=0, std=1.",
    )

    # Numeric feature: duration -> 1 transformed feature
    lineage.add_record(
        source_column="duration",
        source_type="numeric",
        transformation_type="standard_scaling",
        transformed_feature_name="duration",
        transformed_index=1,
        notes="",
    )

    # Categorical feature: housing -> 3 one-hot features
    for i, value in enumerate(["rent", "own", "for free"]):
        lineage.add_record(
            source_column="housing",
            source_type="categorical",
            transformation_type="one_hot_encoding",
            transformed_feature_name=f"housing_{value}",
            transformed_index=2 + i,
            notes=f"1 if housing=={value}, else 0.",
        )

    return lineage


class TestFeatureLineageBasics:
    """Tests for basic lineage operations."""

    def test_add_record_increases_count(self):
        lineage = FeatureLineage()
        assert len(lineage.records) == 0
        lineage.add_record("age", "numeric", "scaling", "age", 0)
        assert len(lineage.records) == 1

    def test_get_records_for_source(self, sample_lineage):
        records = sample_lineage.get_records_for_source("age")
        assert len(records) == 1
        assert records[0]["source_column"] == "age"

    def test_get_records_for_categorical(self, sample_lineage):
        records = sample_lineage.get_records_for_source("housing")
        assert len(records) == 3

    def test_get_records_for_missing_column(self, sample_lineage):
        records = sample_lineage.get_records_for_source("nonexistent")
        assert len(records) == 0

    def test_get_all_source_columns(self, sample_lineage):
        columns = sample_lineage.get_all_source_columns()
        assert columns == ["age", "duration", "housing"]

    def test_get_transformed_indices(self, sample_lineage):
        indices = sample_lineage.get_transformed_indices("housing")
        assert indices == [2, 3, 4]

    def test_get_transformed_names(self, sample_lineage):
        names = sample_lineage.get_transformed_names("housing")
        assert names == ["housing_rent", "housing_own", "housing_for free"]


class TestFeatureLineageSerialization:
    """Tests for saving and loading lineage."""

    def test_save_and_load_json(self, sample_lineage):
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "lineage.json"
            sample_lineage.save_json(json_path)

            assert json_path.exists()

            loaded = FeatureLineage.load_json(json_path)
            assert len(loaded.records) == len(sample_lineage.records)

    def test_json_content_is_valid(self, sample_lineage):
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "lineage.json"
            sample_lineage.save_json(json_path)

            with open(json_path) as f:
                data = json.load(f)

            assert isinstance(data, list)
            assert len(data) == 5
            assert data[0]["source_column"] == "age"

    def test_save_csv(self, sample_lineage):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "lineage.csv"
            sample_lineage.save_csv(csv_path)

            assert csv_path.exists()

    def test_to_dataframe(self, sample_lineage):
        df = sample_lineage.to_dataframe()
        assert len(df) == 5
        assert "source_column" in df.columns
        assert "transformed_index" in df.columns

    def test_load_nonexistent_raises(self):
        with pytest.raises(FileNotFoundError):
            FeatureLineage.load_json("/nonexistent/path.json")

    def test_roundtrip_preserves_data(self, sample_lineage):
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "lineage.json"
            sample_lineage.save_json(json_path)
            loaded = FeatureLineage.load_json(json_path)

            # Check a specific record
            original = sample_lineage.get_records_for_source("age")[0]
            loaded_record = loaded.get_records_for_source("age")[0]

            assert original == loaded_record
