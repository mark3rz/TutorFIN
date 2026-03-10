"""
Data validation checks for the credit risk dataset.

Performs basic sanity checks on the raw data before preprocessing.
This is not exhaustive validation -- it catches obvious problems
like missing target values, unexpected column counts, or zero-row files.

Usage:
    python -m src.data_validation
"""

import pandas as pd

from src.config import load_config, resolve_path
from src.utils import setup_logging


logger = setup_logging("data_validation")


def validate_raw_data(df: pd.DataFrame, config: dict) -> dict:
    """Run validation checks on the raw dataset.

    Checks performed:
    1. DataFrame is not empty
    2. Target column exists
    3. Target column has exactly two unique values (binary classification)
    4. No fully empty columns
    5. Expected columns are present (age, for the trace demo)

    Args:
        df: Raw DataFrame to validate.
        config: Configuration dictionary.

    Returns:
        Dictionary with validation results.
    """
    data_config = config["data"]
    target_col = data_config["target_column"]
    results = {"passed": True, "checks": []}

    def add_check(name: str, passed: bool, detail: str = ""):
        results["checks"].append({
            "check": name,
            "passed": passed,
            "detail": detail,
        })
        if not passed:
            results["passed"] = False

    # Check 1: Non-empty
    add_check(
        "non_empty",
        len(df) > 0,
        f"Row count: {len(df)}"
    )

    # Check 2: Target column exists
    has_target = target_col in df.columns
    add_check(
        "target_exists",
        has_target,
        f"Target column '{target_col}' {'found' if has_target else 'NOT found'}"
    )

    # Check 3: Binary target
    if has_target:
        n_classes = df[target_col].nunique()
        target_values = sorted(df[target_col].unique().tolist())
        add_check(
            "binary_target",
            n_classes == 2,
            f"Target has {n_classes} unique values: {target_values}"
        )

    # Check 4: No fully empty columns
    empty_cols = [col for col in df.columns if df[col].isnull().all()]
    add_check(
        "no_empty_columns",
        len(empty_cols) == 0,
        f"Fully empty columns: {empty_cols}" if empty_cols else "None"
    )

    # Check 5: Trace feature exists
    trace_feature = config["features"]["default_trace_feature"]
    has_trace = trace_feature in df.columns
    add_check(
        "trace_feature_exists",
        has_trace,
        f"Trace feature '{trace_feature}' {'found' if has_trace else 'NOT found'}"
    )

    # Check 6: No duplicate rows (informational)
    n_dupes = df.duplicated().sum()
    add_check(
        "duplicate_check",
        True,  # Informational, does not fail validation
        f"Duplicate rows: {n_dupes}"
    )

    return results


def print_validation_report(results: dict) -> None:
    """Print a human-readable validation report.

    Args:
        results: Dictionary from validate_raw_data().
    """
    status = "PASSED" if results["passed"] else "FAILED"
    logger.info(f"Data Validation: {status}")
    logger.info("-" * 50)

    for check in results["checks"]:
        icon = "[OK]" if check["passed"] else "[FAIL]"
        logger.info(f"  {icon} {check['check']}: {check['detail']}")

    logger.info("-" * 50)


def main():
    """Load raw data and run validation checks."""
    config = load_config()
    raw_path = resolve_path(config["data"]["raw_path"])

    if not raw_path.exists():
        logger.error(f"Raw data file not found: {raw_path}")
        logger.error("Run 'python -m src.data_download' first.")
        return

    df = pd.read_csv(raw_path)
    results = validate_raw_data(df, config)
    print_validation_report(results)

    if not results["passed"]:
        raise ValueError("Data validation failed. See report above.")


if __name__ == "__main__":
    main()
