"""
Leakage review for the credit risk dataset.

Systematically reviews each feature column for potential data leakage,
governance concerns, and modeling notes. Outputs a CSV artifact that
documents the review for every column.

Leakage in credit risk can occur when:
- A feature encodes information that would only be known after the
  lending decision (e.g., repayment behavior on this loan).
- A feature is derived from the target variable.
- A feature is a near-perfect proxy for the target.

For the German Credit dataset, true leakage is unlikely because the
features represent application-time information. However, we document
the review explicitly as a practice for production pipelines.

Usage:
    python -m src.leakage_review
"""

import pandas as pd

from src.config import load_config, resolve_path, ensure_dir
from src.data_dictionary import DATA_DICTIONARY
from src.utils import setup_logging


logger = setup_logging("leakage_review")


# Leakage assessment for each column
# risk_level: "none", "low", "medium", "high"
# reason: why the assessment was made
LEAKAGE_ASSESSMENTS = {
    "checking_status": {
        "risk_level": "low",
        "reason": (
            "Checking account status is known at application time. "
            "Low leakage risk. However, if this reflects post-decision "
            "account activity, it could leak."
        ),
        "governance_flag": False,
    },
    "duration": {
        "risk_level": "none",
        "reason": "Loan duration is set at application time.",
        "governance_flag": False,
    },
    "credit_history": {
        "risk_level": "low",
        "reason": (
            "Credit history predates the current application. If it includes "
            "information about this specific loan's outcome, it would be leakage. "
            "In this dataset, it reflects prior history."
        ),
        "governance_flag": False,
    },
    "purpose": {
        "risk_level": "none",
        "reason": "Purpose is stated at application time.",
        "governance_flag": False,
    },
    "credit_amount": {
        "risk_level": "none",
        "reason": "Amount is set at application time.",
        "governance_flag": False,
    },
    "savings_status": {
        "risk_level": "low",
        "reason": "Savings status at application time. Low risk unless post-dated.",
        "governance_flag": False,
    },
    "employment": {
        "risk_level": "none",
        "reason": "Employment status at application time.",
        "governance_flag": False,
    },
    "installment_commitment": {
        "risk_level": "none",
        "reason": "Installment rate is set at application time.",
        "governance_flag": False,
    },
    "personal_status": {
        "risk_level": "none",
        "reason": "Known at application time. No leakage risk.",
        "governance_flag": True,
    },
    "other_parties": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "residence_since": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "property_magnitude": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "age": {
        "risk_level": "none",
        "reason": "Age is known at application time.",
        "governance_flag": False,
    },
    "other_payment_plans": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "housing": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "existing_credits": {
        "risk_level": "low",
        "reason": (
            "Number of existing credits. Could include this loan if counted, "
            "which would be minor leakage. Likely refers to prior credits."
        ),
        "governance_flag": False,
    },
    "job": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "num_dependents": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "own_telephone": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": False,
    },
    "foreign_worker": {
        "risk_level": "none",
        "reason": "Known at application time.",
        "governance_flag": True,
    },
}


def run_leakage_review(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """Generate a leakage review table for all feature columns.

    Args:
        df: Raw DataFrame.
        config: Configuration dictionary.

    Returns:
        DataFrame with leakage review for each column.
    """
    target_col = config["data"]["target_column"]
    flag_columns = config["features"]["flag_columns"]

    rows = []
    for col in df.columns:
        if col == target_col:
            continue

        assessment = LEAKAGE_ASSESSMENTS.get(col, {
            "risk_level": "unknown",
            "reason": "Column not found in leakage assessment registry.",
            "governance_flag": False,
        })

        rows.append({
            "column": col,
            "leakage_risk": assessment["risk_level"],
            "leakage_reason": assessment["reason"],
            "governance_flag": assessment["governance_flag"] or (col in flag_columns),
            "recommendation": "review" if assessment["governance_flag"] else "keep",
        })

    review_df = pd.DataFrame(rows)
    return review_df


def save_leakage_review(review_df: pd.DataFrame, config: dict) -> None:
    """Save the leakage review as a CSV artifact.

    Args:
        review_df: Leakage review DataFrame.
        config: Configuration dictionary.
    """
    output_path = resolve_path(config["preprocessing"]["leakage_review_path"])
    ensure_dir(output_path.parent)
    review_df.to_csv(output_path, index=False)
    logger.info(f"Saved leakage review to: {output_path}")


def main():
    """Run leakage review on the raw dataset."""
    config = load_config()
    raw_path = resolve_path(config["data"]["raw_path"])

    if not raw_path.exists():
        logger.error(f"Raw data not found: {raw_path}")
        logger.error("Run 'python -m src.data_download' first.")
        return

    df = pd.read_csv(raw_path)
    review_df = run_leakage_review(df, config)
    save_leakage_review(review_df, config)

    # Print summary
    high_risk = review_df[review_df["leakage_risk"].isin(["medium", "high"])]
    flagged = review_df[review_df["governance_flag"]]

    logger.info(f"Reviewed {len(review_df)} columns")
    logger.info(f"High/medium leakage risk: {len(high_risk)}")
    logger.info(f"Governance flags: {len(flagged)}")

    if len(flagged) > 0:
        logger.info("Flagged columns:")
        for _, row in flagged.iterrows():
            logger.info(f"  - {row['column']}: {row['leakage_reason']}")


if __name__ == "__main__":
    main()
