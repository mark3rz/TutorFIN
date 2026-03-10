"""
Data download script for the German Credit dataset from OpenML.

Downloads the dataset, saves a local CSV copy, and writes metadata
including row count, column names, target variable, and a checksum.
This ensures the exact dataset version is documented and reproducible.

Usage:
    python -m src.data_download
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sklearn.datasets import fetch_openml

from src.config import load_config, resolve_path, ensure_dir
from src.utils import setup_logging


logger = setup_logging("data_download")


def compute_checksum(filepath: Path) -> str:
    """Compute SHA-256 checksum of a file for versioning.

    Args:
        filepath: Path to the file.

    Returns:
        Hex string of SHA-256 hash.
    """
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def download_dataset(config: dict) -> pd.DataFrame:
    """Download the German Credit dataset from OpenML.

    Uses sklearn's fetch_openml to retrieve the dataset by its OpenML ID.
    The dataset is returned as a pandas DataFrame with the target column
    included.

    Args:
        config: Configuration dictionary.

    Returns:
        DataFrame containing features and target column.
    """
    data_config = config["data"]
    openml_id = data_config["openml_id"]

    logger.info(f"Downloading dataset from OpenML (ID: {openml_id})...")
    dataset = fetch_openml(data_id=openml_id, as_frame=True, parser="auto")

    # Combine features and target into a single DataFrame
    df = dataset.data.copy()
    df[data_config["target_column"]] = dataset.target

    logger.info(f"Downloaded {len(df)} rows, {len(df.columns)} columns")
    return df


def save_raw_data(df: pd.DataFrame, config: dict) -> Path:
    """Save the raw dataset as a CSV file.

    Args:
        df: Raw DataFrame.
        config: Configuration dictionary.

    Returns:
        Path to the saved CSV file.
    """
    raw_path = resolve_path(config["data"]["raw_path"])
    ensure_dir(raw_path.parent)
    df.to_csv(raw_path, index=False)
    logger.info(f"Saved raw data to: {raw_path}")
    return raw_path


def save_metadata(df: pd.DataFrame, raw_path: Path, config: dict) -> Path:
    """Save dataset metadata as a JSON file.

    Metadata includes:
    - download timestamp
    - OpenML dataset ID and name
    - row and column counts
    - column names and dtypes
    - target variable info
    - file checksum for versioning

    Args:
        df: Raw DataFrame.
        raw_path: Path to the saved CSV file.
        config: Configuration dictionary.

    Returns:
        Path to the saved metadata file.
    """
    data_config = config["data"]
    metadata_dir = resolve_path(data_config["metadata_dir"])
    ensure_dir(metadata_dir)

    # Build dtype info as a serializable dict
    dtype_info = {col: str(dtype) for col, dtype in df.dtypes.items()}

    # Compute missingness summary
    missing = df.isnull().sum()
    missing_info = {col: int(count) for col, count in missing.items() if count > 0}

    metadata = {
        "download_timestamp": datetime.now(timezone.utc).isoformat(),
        "openml_id": data_config["openml_id"],
        "dataset_name": data_config["dataset_name"],
        "num_rows": len(df),
        "num_columns": len(df.columns),
        "columns": list(df.columns),
        "dtypes": dtype_info,
        "target_column": data_config["target_column"],
        "target_values": sorted(df[data_config["target_column"]].unique().tolist()),
        "missing_values": missing_info if missing_info else "none",
        "file_checksum_sha256": compute_checksum(raw_path),
        "file_path": str(raw_path),
    }

    metadata_path = metadata_dir / "dataset_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Saved metadata to: {metadata_path}")
    return metadata_path


def main():
    """Download dataset, save raw CSV, and write metadata."""
    config = load_config()

    raw_path = resolve_path(config["data"]["raw_path"])

    if raw_path.exists():
        logger.info(f"Raw data already exists at {raw_path}. Skipping download.")
        logger.info("Delete the file and re-run to force a fresh download.")
        df = pd.read_csv(raw_path)
    else:
        df = download_dataset(config)
        raw_path = save_raw_data(df, config)

    save_metadata(df, raw_path, config)

    logger.info("Data download complete.")
    logger.info(f"  Rows: {len(df)}")
    logger.info(f"  Columns: {list(df.columns)}")
    logger.info(f"  Target: {config['data']['target_column']}")


if __name__ == "__main__":
    main()
