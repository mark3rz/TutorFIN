"""
Feature lineage tracking for the preprocessing pipeline.

This module maintains a complete mapping from raw source columns to
transformed feature names and their positions in the model input matrix.
This is the backbone of the transparency system: it lets us trace any
raw field (like 'age') forward to the exact indices and names it
occupies after preprocessing.

The lineage record for each transformed feature includes:
- source_column: the original raw column name
- source_type: "numeric" or "categorical"
- transformation_type: e.g., "standard_scaling", "one_hot_encoding"
- transformed_feature_name: name after transformation
- transformed_index: position in the final feature matrix
- notes: any additional context

Lineage is stored as both JSON (for programmatic access) and CSV
(for human inspection).
"""

import json
from pathlib import Path

import pandas as pd

from src.config import ensure_dir
from src.utils import setup_logging


logger = setup_logging("feature_lineage")


class FeatureLineage:
    """Tracks the mapping from raw columns to transformed features.

    This class is populated during preprocessing and then saved as
    artifacts that downstream tools (trace_feature, trace_prediction,
    the Streamlit app) can load to reconstruct the data path.
    """

    def __init__(self):
        self.records: list[dict] = []

    def add_record(
        self,
        source_column: str,
        source_type: str,
        transformation_type: str,
        transformed_feature_name: str,
        transformed_index: int,
        notes: str = "",
    ) -> None:
        """Add a lineage record for one transformed feature.

        Args:
            source_column: Original raw column name.
            source_type: "numeric" or "categorical".
            transformation_type: Description of the transformation applied.
            transformed_feature_name: Name of the feature after transformation.
            transformed_index: Column index in the final feature matrix.
            notes: Optional notes.
        """
        self.records.append({
            "source_column": source_column,
            "source_type": source_type,
            "transformation_type": transformation_type,
            "transformed_feature_name": transformed_feature_name,
            "transformed_index": transformed_index,
            "notes": notes,
        })

    def get_records_for_source(self, source_column: str) -> list[dict]:
        """Get all lineage records for a given raw source column.

        A single raw column may produce multiple transformed features
        (e.g., one-hot encoding produces one feature per category).

        Args:
            source_column: Original raw column name.

        Returns:
            List of lineage record dicts for that source column.
        """
        return [r for r in self.records if r["source_column"] == source_column]

    def get_all_source_columns(self) -> list[str]:
        """Return a deduplicated list of all source column names."""
        seen = set()
        result = []
        for r in self.records:
            if r["source_column"] not in seen:
                seen.add(r["source_column"])
                result.append(r["source_column"])
        return result

    def get_transformed_indices(self, source_column: str) -> list[int]:
        """Get the transformed feature indices for a source column.

        Args:
            source_column: Original raw column name.

        Returns:
            List of integer indices into the model input matrix.
        """
        return [r["transformed_index"] for r in self.get_records_for_source(source_column)]

    def get_transformed_names(self, source_column: str) -> list[str]:
        """Get the transformed feature names for a source column.

        Args:
            source_column: Original raw column name.

        Returns:
            List of transformed feature name strings.
        """
        return [r["transformed_feature_name"] for r in self.get_records_for_source(source_column)]

    def save_json(self, path: str | Path) -> None:
        """Save the full lineage as a JSON file.

        Args:
            path: Output file path.
        """
        path = Path(path)
        ensure_dir(path.parent)
        with open(path, "w") as f:
            json.dump(self.records, f, indent=2)
        logger.info(f"Saved lineage JSON: {path} ({len(self.records)} records)")

    def save_csv(self, path: str | Path) -> None:
        """Save the lineage as a CSV for human inspection.

        Args:
            path: Output file path.
        """
        path = Path(path)
        ensure_dir(path.parent)
        df = pd.DataFrame(self.records)
        df.to_csv(path, index=False)
        logger.info(f"Saved lineage CSV: {path} ({len(self.records)} records)")

    def to_dataframe(self) -> pd.DataFrame:
        """Convert lineage records to a DataFrame."""
        return pd.DataFrame(self.records)

    @classmethod
    def load_json(cls, path: str | Path) -> "FeatureLineage":
        """Load lineage from a previously saved JSON file.

        Args:
            path: Path to the JSON file.

        Returns:
            FeatureLineage instance with loaded records.
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Lineage file not found: {path}")

        with open(path, "r") as f:
            records = json.load(f)

        lineage = cls()
        lineage.records = records
        logger.info(f"Loaded lineage from {path} ({len(records)} records)")
        return lineage
