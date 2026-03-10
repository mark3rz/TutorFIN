"""
Preprocessing pipeline for the credit risk dataset.

This module handles the full transformation from raw data to model-ready
features. It is designed for transparency: every transformation is tracked
in a FeatureLineage object so that downstream tools can trace any raw
field to its exact position in the model input matrix.

Pipeline steps:
1. Separate features from target
2. Encode target variable (good -> 1, bad -> 0)
3. Train/test split (stratified)
4. Identify numeric and categorical columns
5. Fit preprocessing on training data only (to avoid data leakage)
6. Transform both train and test sets
7. Record feature lineage for every transformed feature
8. Save all artifacts (preprocessor, lineage, metadata)

Usage:
    python -m src.preprocess
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.config import load_config, resolve_path, ensure_dir
from src.data_dictionary import get_numeric_columns, get_categorical_columns
from src.feature_lineage import FeatureLineage
from src.utils import setup_logging, set_seed


logger = setup_logging("preprocess")


def encode_target(series: pd.Series, positive_label: str) -> np.ndarray:
    """Encode the target variable as binary integers.

    Args:
        series: Target column as a pandas Series.
        positive_label: The label to encode as 1 (e.g., "good").

    Returns:
        NumPy array of 0s and 1s.
    """
    encoded = (series == positive_label).astype(int).values
    logger.info(
        f"Target encoding: '{positive_label}' -> 1, other -> 0. "
        f"Class distribution: {int(encoded.sum())} positive, "
        f"{int(len(encoded) - encoded.sum())} negative"
    )
    return encoded


def identify_columns(df: pd.DataFrame, config: dict) -> tuple[list[str], list[str]]:
    """Identify numeric and categorical feature columns.

    Uses the data dictionary as the primary source for column types,
    falling back to pandas dtype inference for any columns not in the
    dictionary.

    Args:
        df: Feature DataFrame (target column already removed).
        config: Configuration dictionary.

    Returns:
        Tuple of (numeric_columns, categorical_columns).
    """
    drop_cols = config["features"]["drop_columns"]
    target_col = config["data"]["target_column"]

    # Get expected types from data dictionary
    expected_numeric = set(get_numeric_columns())
    expected_categorical = set(get_categorical_columns())

    numeric_cols = []
    categorical_cols = []

    for col in df.columns:
        if col in drop_cols or col == target_col:
            continue

        if col in expected_numeric:
            numeric_cols.append(col)
        elif col in expected_categorical:
            categorical_cols.append(col)
        else:
            # Fallback: infer from dtype
            if pd.api.types.is_numeric_dtype(df[col]):
                numeric_cols.append(col)
            else:
                categorical_cols.append(col)
            logger.warning(f"Column '{col}' not in data dictionary, inferred type from dtype.")

    logger.info(f"Numeric columns ({len(numeric_cols)}): {numeric_cols}")
    logger.info(f"Categorical columns ({len(categorical_cols)}): {categorical_cols}")

    return numeric_cols, categorical_cols


def build_preprocessor(
    numeric_cols: list[str],
    categorical_cols: list[str],
    config: dict,
) -> ColumnTransformer:
    """Build a sklearn ColumnTransformer for the preprocessing pipeline.

    Numeric pipeline: impute missing values (median), then standardize.
    Categorical pipeline: impute missing values (most frequent), then one-hot encode.

    The ColumnTransformer preserves the order: numeric features first,
    then categorical features. This ordering is critical for the feature
    lineage to correctly map transformed indices back to source columns.

    Args:
        numeric_cols: List of numeric column names.
        categorical_cols: List of categorical column names.
        config: Configuration dictionary.

    Returns:
        Unfitted ColumnTransformer.
    """
    preprocess_config = config["preprocessing"]

    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy=preprocess_config["numeric_imputer_strategy"])),
        ("scaler", StandardScaler()),
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy=preprocess_config["categorical_imputer_strategy"])),
        ("encoder", OneHotEncoder(
            handle_unknown="infrequent_if_exist",
            sparse_output=False,
            drop=None,  # Keep all categories for transparency
        )),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, numeric_cols),
            ("cat", categorical_pipeline, categorical_cols),
        ],
        remainder="drop",
    )

    return preprocessor


def build_feature_lineage(
    preprocessor: ColumnTransformer,
    numeric_cols: list[str],
    categorical_cols: list[str],
) -> FeatureLineage:
    """Build the feature lineage from a fitted ColumnTransformer.

    After fitting, the preprocessor knows the exact transformed feature
    names. We walk through them in order and record the mapping from
    each source column to its transformed position(s).

    Args:
        preprocessor: Fitted ColumnTransformer.
        numeric_cols: Original numeric column names.
        categorical_cols: Original categorical column names.

    Returns:
        FeatureLineage object with all mappings recorded.
    """
    lineage = FeatureLineage()
    idx = 0

    # Numeric features: each numeric column produces exactly one transformed feature.
    # The name after StandardScaler is just the original column name.
    for col in numeric_cols:
        lineage.add_record(
            source_column=col,
            source_type="numeric",
            transformation_type="impute_median + standard_scaling",
            transformed_feature_name=col,
            transformed_index=idx,
            notes="Scaled to mean=0, std=1 using training set statistics.",
        )
        idx += 1

    # Categorical features: each category becomes a separate one-hot column.
    # The OneHotEncoder stores the categories it learned during fit.
    if categorical_cols:
        cat_encoder = preprocessor.named_transformers_["cat"].named_steps["encoder"]
        cat_categories = cat_encoder.categories_
    else:
        cat_categories = []
    for col, categories in zip(categorical_cols, cat_categories):
        for cat_value in categories:
            transformed_name = f"{col}_{cat_value}"
            lineage.add_record(
                source_column=col,
                source_type="categorical",
                transformation_type="impute_most_frequent + one_hot_encoding",
                transformed_feature_name=transformed_name,
                transformed_index=idx,
                notes=f"Binary indicator: 1 if {col}=={cat_value}, else 0.",
            )
            idx += 1

    logger.info(f"Built feature lineage: {idx} transformed features from "
                f"{len(numeric_cols) + len(categorical_cols)} source columns")

    return lineage


def log_missingness(df: pd.DataFrame, stage: str) -> dict:
    """Log missing value counts for each column.

    Args:
        df: DataFrame to check.
        stage: Label for the pipeline stage (e.g., "raw", "after_preprocessing").

    Returns:
        Dictionary mapping column names to missing counts.
    """
    missing = df.isnull().sum()
    total_missing = missing.sum()
    logger.info(f"Missingness ({stage}): {total_missing} total missing values")

    missing_cols = {col: int(count) for col, count in missing.items() if count > 0}
    if missing_cols:
        for col, count in missing_cols.items():
            logger.info(f"  {col}: {count} missing ({100 * count / len(df):.1f}%)")
    else:
        logger.info("  No missing values found.")

    return missing_cols


def run_preprocessing(config: dict = None) -> dict:
    """Execute the full preprocessing pipeline.

    Steps:
    1. Load raw data
    2. Encode target
    3. Train/test split
    4. Identify column types
    5. Fit preprocessor on training data
    6. Transform train and test sets
    7. Build feature lineage
    8. Save all artifacts

    Args:
        config: Configuration dictionary. If None, loads from default path.

    Returns:
        Dictionary containing:
        - X_train, X_test: transformed feature arrays (numpy)
        - y_train, y_test: target arrays (numpy)
        - preprocessor: fitted ColumnTransformer
        - lineage: FeatureLineage object
        - numeric_cols, categorical_cols: column name lists
        - train_indices, test_indices: original DataFrame row indices
    """
    if config is None:
        config = load_config()

    set_seed(config["project"]["random_seed"])

    # Load raw data
    raw_path = resolve_path(config["data"]["raw_path"])
    if not raw_path.exists():
        raise FileNotFoundError(
            f"Raw data not found: {raw_path}. Run 'python -m src.data_download' first."
        )
    df = pd.read_csv(raw_path)
    logger.info(f"Loaded raw data: {df.shape}")

    # Log missingness before preprocessing
    log_missingness(df, "raw_data")

    # Separate features and target
    target_col = config["data"]["target_column"]
    y = encode_target(df[target_col], config["data"]["positive_label"])
    X = df.drop(columns=[target_col])

    # Drop any columns specified in config
    drop_cols = [c for c in config["features"]["drop_columns"] if c in X.columns]
    if drop_cols:
        logger.info(f"Dropping columns: {drop_cols}")
        X = X.drop(columns=drop_cols)

    # Train/test split (stratified to preserve class balance)
    X_train, X_test, y_train, y_test, train_idx, test_idx = train_test_split(
        X, y, np.arange(len(X)),
        test_size=config["data"]["test_size"],
        random_state=config["project"]["random_seed"],
        stratify=y,
    )

    logger.info(f"Train set: {X_train.shape[0]} rows, Test set: {X_test.shape[0]} rows")
    logger.info(f"Train class balance: {y_train.mean():.3f} positive rate")
    logger.info(f"Test class balance: {y_test.mean():.3f} positive rate")

    # Identify column types
    numeric_cols, categorical_cols = identify_columns(X_train, config)

    # Build and fit preprocessor on training data only
    preprocessor = build_preprocessor(numeric_cols, categorical_cols, config)
    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)

    logger.info(f"Transformed feature matrix shape: {X_train_transformed.shape}")

    # Build feature lineage from the fitted preprocessor
    lineage = build_feature_lineage(preprocessor, numeric_cols, categorical_cols)

    # Save artifacts
    _save_artifacts(
        preprocessor, lineage, X_train, X_test,
        X_train_transformed, X_test_transformed,
        y_train, y_test, train_idx, test_idx,
        numeric_cols, categorical_cols, config,
    )

    return {
        "X_train": X_train_transformed,
        "X_test": X_test_transformed,
        "y_train": y_train,
        "y_test": y_test,
        "preprocessor": preprocessor,
        "lineage": lineage,
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "train_indices": train_idx,
        "test_indices": test_idx,
    }


def _save_artifacts(
    preprocessor, lineage, X_train_raw, X_test_raw,
    X_train_transformed, X_test_transformed,
    y_train, y_test, train_idx, test_idx,
    numeric_cols, categorical_cols, config,
) -> None:
    """Save all preprocessing artifacts to disk.

    Saves:
    - Fitted preprocessor (joblib)
    - Feature lineage (JSON and CSV)
    - Transformed data (CSV for inspection, NPZ for loading)
    - Column lists and indices
    - Dropped columns log
    """
    preprocess_config = config["preprocessing"]

    # Save preprocessor
    preprocessor_dir = resolve_path(preprocess_config["artifacts_dir"])
    ensure_dir(preprocessor_dir)
    preprocessor_path = preprocessor_dir / "preprocessor.joblib"
    joblib.dump(preprocessor, preprocessor_path)
    logger.info(f"Saved preprocessor: {preprocessor_path}")

    # Save feature lineage
    lineage_path = resolve_path(preprocess_config["lineage_path"])
    feature_map_path = resolve_path(preprocess_config["feature_map_path"])
    lineage.save_json(lineage_path)
    lineage.save_csv(feature_map_path)

    # Save transformed data as NPZ for efficient loading
    processed_dir = resolve_path(config["data"]["processed_dir"])
    ensure_dir(processed_dir)
    np.savez(
        processed_dir / "train_data.npz",
        X=X_train_transformed, y=y_train, indices=train_idx,
    )
    np.savez(
        processed_dir / "test_data.npz",
        X=X_test_transformed, y=y_test, indices=test_idx,
    )
    logger.info(f"Saved processed data to: {processed_dir}")

    # Save column lists for reference
    col_info = {
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "n_transformed_features": X_train_transformed.shape[1],
    }
    col_info_path = resolve_path(config["data"]["metadata_dir"]) / "column_info.json"
    ensure_dir(col_info_path.parent)
    with open(col_info_path, "w") as f:
        json.dump(col_info, f, indent=2)

    # Save dropped columns record
    drop_cols = config["features"]["drop_columns"]
    if drop_cols:
        dropped_df = pd.DataFrame({
            "column": drop_cols,
            "reason": ["specified in config"] * len(drop_cols),
        })
    else:
        dropped_df = pd.DataFrame(columns=["column", "reason"])
    dropped_path = resolve_path(preprocess_config["dropped_columns_path"])
    dropped_df.to_csv(dropped_path, index=False)
    logger.info(f"Saved dropped columns record: {dropped_path}")


def load_processed_data(config: dict = None) -> dict:
    """Load previously saved processed data and artifacts.

    Args:
        config: Configuration dictionary. If None, loads from default.

    Returns:
        Dictionary with X_train, X_test, y_train, y_test, preprocessor,
        lineage, and index arrays.
    """
    if config is None:
        config = load_config()

    processed_dir = resolve_path(config["data"]["processed_dir"])

    train_data = np.load(processed_dir / "train_data.npz")
    test_data = np.load(processed_dir / "test_data.npz")

    preprocessor_path = resolve_path(config["preprocessing"]["artifacts_dir"]) / "preprocessor.joblib"
    preprocessor = joblib.load(preprocessor_path)

    lineage_path = resolve_path(config["preprocessing"]["lineage_path"])
    lineage = FeatureLineage.load_json(lineage_path)

    return {
        "X_train": train_data["X"],
        "X_test": test_data["X"],
        "y_train": train_data["y"],
        "y_test": test_data["y"],
        "train_indices": train_data["indices"],
        "test_indices": test_data["indices"],
        "preprocessor": preprocessor,
        "lineage": lineage,
    }


def main():
    """Run the preprocessing pipeline."""
    config = load_config()
    run_preprocessing(config)
    logger.info("Preprocessing complete.")


if __name__ == "__main__":
    main()
