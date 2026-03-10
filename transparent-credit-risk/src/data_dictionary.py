"""
Data dictionary for the German Credit dataset.

Provides human-readable descriptions and metadata for each column,
including data type expectations, value descriptions, and notes on
potential governance or leakage concerns.

This is hardcoded because the German Credit dataset has a fixed schema.
For a production system, this would be loaded from an external file or
database.
"""

# Each entry: {column_name: {description, type, values_or_range, notes}}
DATA_DICTIONARY = {
    "checking_status": {
        "description": "Status of the existing checking account",
        "source_type": "categorical",
        "values": ["<0", "0<=X<200", ">=200", "no checking"],
        "notes": "Ordinal in nature but treated as categorical here.",
    },
    "duration": {
        "description": "Duration of the credit in months",
        "source_type": "numeric",
        "range": "Positive integers",
        "notes": "Could correlate with credit amount. Not leakage.",
    },
    "credit_history": {
        "description": "Credit history of the applicant",
        "source_type": "categorical",
        "values": [
            "no credits/all paid",
            "all paid",
            "existing paid",
            "delayed previously",
            "critical/other existing credit",
        ],
        "notes": "Key predictor. Encoding order matters conceptually but not for one-hot.",
    },
    "purpose": {
        "description": "Purpose of the credit",
        "source_type": "categorical",
        "values": [
            "new car", "used car", "furniture/equipment", "radio/tv",
            "domestic appliance", "repairs", "education", "vacation",
            "retraining", "business", "other",
        ],
        "notes": "High cardinality. One-hot encoding will create many features.",
    },
    "credit_amount": {
        "description": "Credit amount in Deutsche Marks",
        "source_type": "numeric",
        "range": "Positive values",
        "notes": "Right-skewed distribution. Scaling important.",
    },
    "savings_status": {
        "description": "Savings account or bonds balance",
        "source_type": "categorical",
        "values": ["<100", "100<=X<500", "500<=X<1000", ">=1000", "no known savings"],
        "notes": "Ordinal in nature but treated as categorical.",
    },
    "employment": {
        "description": "Present employment duration",
        "source_type": "categorical",
        "values": ["unemployed", "<1", "1<=X<4", "4<=X<7", ">=7"],
        "notes": "Ordinal in nature but treated as categorical.",
    },
    "installment_commitment": {
        "description": "Installment rate as percentage of disposable income",
        "source_type": "numeric",
        "range": "1 to 4",
        "notes": "Integer-valued but treated as numeric.",
    },
    "personal_status": {
        "description": "Personal status and sex (combined field)",
        "source_type": "categorical",
        "values": [
            "male div/sep", "female div/dep/mar", "male single", "male mar/wid",
        ],
        "notes": (
            "GOVERNANCE FLAG: This column encodes both gender and marital status. "
            "Using it in a credit model raises fairness concerns. Flagged for review. "
            "In a production setting, this would likely be excluded or carefully audited."
        ),
    },
    "other_parties": {
        "description": "Other debtors or guarantors",
        "source_type": "categorical",
        "values": ["none", "co applicant", "guarantor"],
        "notes": "",
    },
    "residence_since": {
        "description": "Years at present residence",
        "source_type": "numeric",
        "range": "1 to 4",
        "notes": "Integer-valued but treated as numeric.",
    },
    "property_magnitude": {
        "description": "Property ownership type",
        "source_type": "categorical",
        "values": ["real estate", "life insurance", "car", "no known property"],
        "notes": "",
    },
    "age": {
        "description": "Age of the applicant in years",
        "source_type": "numeric",
        "range": "19 to 75",
        "notes": (
            "Primary feature for transparency demo. Age is a legitimate credit "
            "feature in many jurisdictions but is a protected class in others. "
            "Flagged for awareness."
        ),
    },
    "other_payment_plans": {
        "description": "Other installment plans",
        "source_type": "categorical",
        "values": ["bank", "stores", "none"],
        "notes": "",
    },
    "housing": {
        "description": "Housing situation",
        "source_type": "categorical",
        "values": ["rent", "own", "for free"],
        "notes": "",
    },
    "existing_credits": {
        "description": "Number of existing credits at this bank",
        "source_type": "numeric",
        "range": "1 to 4",
        "notes": "",
    },
    "job": {
        "description": "Job type",
        "source_type": "categorical",
        "values": [
            "unemp/unskilled non res", "unskilled resident",
            "skilled", "high qualif/self emp/mgmt",
        ],
        "notes": "",
    },
    "num_dependents": {
        "description": "Number of people being liable to provide maintenance for",
        "source_type": "numeric",
        "range": "1 to 2",
        "notes": "",
    },
    "own_telephone": {
        "description": "Whether the applicant has a registered telephone",
        "source_type": "categorical",
        "values": ["none", "yes"],
        "notes": "Historical artifact. Less meaningful in modern context.",
    },
    "foreign_worker": {
        "description": "Whether the applicant is a foreign worker",
        "source_type": "categorical",
        "values": ["yes", "no"],
        "notes": (
            "GOVERNANCE FLAG: Immigration/nationality status is ethically sensitive "
            "and legally protected in many jurisdictions. Flagged for review."
        ),
    },
    "class": {
        "description": "Credit risk classification (target variable)",
        "source_type": "categorical",
        "values": ["good", "bad"],
        "notes": (
            "Binary target. 'good' = lower risk (positive class). "
            "'bad' = higher risk (negative class). "
            "The original dataset has an asymmetric cost matrix: "
            "misclassifying bad as good costs 5x more than the reverse."
        ),
    },
}


def get_column_info(column_name: str) -> dict:
    """Get data dictionary entry for a specific column.

    Args:
        column_name: Name of the column.

    Returns:
        Dictionary with column metadata, or a default entry if unknown.
    """
    if column_name in DATA_DICTIONARY:
        return DATA_DICTIONARY[column_name]
    return {
        "description": "Unknown column",
        "source_type": "unknown",
        "notes": "Not found in data dictionary.",
    }


def get_numeric_columns() -> list[str]:
    """Return list of columns expected to be numeric."""
    return [
        col for col, info in DATA_DICTIONARY.items()
        if info["source_type"] == "numeric" and col != "class"
    ]


def get_categorical_columns() -> list[str]:
    """Return list of columns expected to be categorical."""
    return [
        col for col, info in DATA_DICTIONARY.items()
        if info["source_type"] == "categorical" and col != "class"
    ]
