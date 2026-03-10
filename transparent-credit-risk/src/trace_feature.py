"""
Feature trace system: follow a raw field through the entire pipeline.

This is the core transparency tool. Given a source column name (like "age")
and a row index, it produces a step-by-step trace showing:

1. Raw value in the original dataset
2. Cleaning and type information
3. Missing value handling
4. Scaling or encoding transformation
5. Transformed feature name(s) and position(s) in the model input
6. First-layer neural network weights for the feature
7. First hidden layer contribution for the selected row
8. Final prediction output

The trace is exact through preprocessing and the first hidden layer.
Beyond that, attribution becomes approximate because the second layer
and ReLU create non-linear interactions that cannot be decomposed into
per-feature contributions in a simple way. The trace makes this
limitation explicit.

Usage:
    python -m src.trace_feature
    python -m src.trace_feature --feature age --row 0
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from src.config import load_config, resolve_path, ensure_dir
from src.data_dictionary import get_column_info
from src.feature_lineage import FeatureLineage
from src.preprocess import load_processed_data
from src.train import load_trained_model
from src.utils import setup_logging


logger = setup_logging("trace_feature")


def trace_feature(
    feature_name: str,
    row_index: int,
    config: dict = None,
    model=None,
    data: dict = None,
    lineage: FeatureLineage = None,
) -> dict:
    """Trace a raw feature through the entire pipeline for a specific row.

    Args:
        feature_name: Name of the raw source column (e.g., "age").
        row_index: Index within the test set (0-based).
        config: Configuration dictionary.
        model: Trained CreditRiskNet. If None, loads from disk.
        data: Processed data dict. If None, loads from disk.
        lineage: FeatureLineage object. If None, loads from disk.

    Returns:
        Dictionary with trace information at each pipeline stage.
    """
    if config is None:
        config = load_config()
    if model is None:
        model, _ = load_trained_model(config)
    if data is None:
        data = load_processed_data(config)
    if lineage is None:
        lineage_path = resolve_path(config["preprocessing"]["lineage_path"])
        lineage = FeatureLineage.load_json(lineage_path)

    # Load raw data for the trace
    raw_df = pd.read_csv(resolve_path(config["data"]["raw_path"]))
    test_indices = data["test_indices"]
    X_test = data["X_test"]
    y_test = data["y_test"]

    if row_index < 0 or row_index >= len(X_test):
        raise IndexError(f"Row index {row_index} out of range (test set has {len(X_test)} rows).")

    # Map test set index back to original DataFrame row
    original_row_idx = test_indices[row_index]

    trace = {}

    # ---- Stage A: Raw Data ----
    column_info = get_column_info(feature_name)
    raw_value = raw_df.iloc[original_row_idx][feature_name]

    trace["raw_data"] = {
        "stage": "A. Raw Data",
        "column_name": feature_name,
        "description": column_info["description"],
        "source_type": column_info["source_type"],
        "raw_value": _to_serializable(raw_value),
        "original_row_index": int(original_row_idx),
        "dataset": config["data"]["dataset_name"],
    }

    # ---- Stage B: Cleaning ----
    is_missing = pd.isna(raw_value)

    trace["cleaning"] = {
        "stage": "B. Cleaning / Typing",
        "data_type": column_info["source_type"],
        "was_missing": bool(is_missing),
        "coercion_applied": False,
        "notes": (
            "Value was missing and will be imputed." if is_missing
            else "Value present, no imputation needed."
        ),
    }

    # ---- Stage C: Transformation ----
    lineage_records = lineage.get_records_for_source(feature_name)
    if not lineage_records:
        raise ValueError(
            f"No lineage records found for feature '{feature_name}'. "
            f"Available source columns: {lineage.get_all_source_columns()}"
        )

    transformed_indices = [r["transformed_index"] for r in lineage_records]
    transformed_names = [r["transformed_feature_name"] for r in lineage_records]
    transformation_type = lineage_records[0]["transformation_type"]

    # Get the actual transformed values from the test data
    transformed_values = X_test[row_index, transformed_indices].tolist()

    trace["transformation"] = {
        "stage": "C. Transformation",
        "transformation_type": transformation_type,
        "n_transformed_features": len(lineage_records),
        "transformed_feature_names": transformed_names,
        "transformed_indices": transformed_indices,
        "transformed_values": [round(v, 6) for v in transformed_values],
        "lineage_records": lineage_records,
    }

    # ---- Stage D: Neural Net Input ----
    x_tensor = torch.tensor(X_test[row_index], dtype=torch.float32)

    trace["model_input"] = {
        "stage": "D. Neural Network Input",
        "input_vector_length": len(x_tensor),
        "feature_positions": transformed_indices,
        "feature_values_at_positions": [round(x_tensor[i].item(), 6) for i in transformed_indices],
        "notes": (
            "The transformed values enter the input tensor at the positions "
            "listed above. The full input vector has "
            f"{len(x_tensor)} elements from all features combined."
        ),
    }

    # ---- Stage E: First Hidden Layer ----
    model.eval()
    contributions_data = model.compute_hidden_contributions(x_tensor)

    # Extract contributions for just this feature's indices
    feature_contributions = contributions_data["contributions"][:, transformed_indices]
    # Sum contributions across all transformed features for this source column
    # (relevant for one-hot encoded categoricals with multiple columns)
    total_contribution_per_hidden = feature_contributions.sum(dim=1)

    weights_for_feature = model.get_first_layer_weights()[:, transformed_indices]

    trace["first_hidden_layer"] = {
        "stage": "E. First Hidden Layer",
        "hidden_size": int(contributions_data["pre_relu"].shape[0]),
        "weights": {
            "description": (
                f"Weights connecting {feature_name}'s transformed feature(s) "
                "to each hidden neuron. Shape: (hidden_size, n_transformed_features)."
            ),
            "values": weights_for_feature.tolist(),
            "feature_names": transformed_names,
        },
        "contributions": {
            "description": (
                f"Contribution of {feature_name} to each hidden neuron for this row. "
                "Computed as W[h,i] * x[i] summed over the feature's transformed indices. "
                "This is an exact linear decomposition of the pre-ReLU activation."
            ),
            "per_hidden_neuron": total_contribution_per_hidden.tolist(),
        },
        "pre_relu_activations": contributions_data["pre_relu"].tolist(),
        "post_relu_activations": contributions_data["post_relu"].tolist(),
        "notes": (
            "The contributions show how this feature affects each hidden neuron "
            "BEFORE the ReLU activation. After ReLU, neurons with negative "
            "pre-activation are zeroed out, which means contributions to those "
            "neurons have no effect on the final output. This is where the "
            "decomposition becomes approximate."
        ),
    }

    # ---- Stage F: Output ----
    with torch.no_grad():
        logit = model(x_tensor.unsqueeze(0))
        probability = torch.sigmoid(logit).item()

    predicted_class = 1 if probability >= 0.5 else 0
    true_class = int(y_test[row_index])
    positive_label = config["data"]["positive_label"]
    negative_label = config["data"]["negative_label"]

    trace["output"] = {
        "stage": "F. Output",
        "logit": round(logit.item(), 6),
        "probability": round(probability, 6),
        "predicted_class": predicted_class,
        "predicted_label": positive_label if predicted_class == 1 else negative_label,
        "true_class": true_class,
        "true_label": positive_label if true_class == 1 else negative_label,
        "correct": predicted_class == true_class,
    }

    # ---- Stage G: Interpretation Warning ----
    trace["interpretation_warning"] = {
        "stage": "G. Interpretation Caveats",
        "warnings": [
            (
                "DATA LINEAGE: The trace from raw value through preprocessing to "
                "transformed feature positions is exact and verifiable."
            ),
            (
                "FIRST-LAYER CONTRIBUTION: The contribution of this feature to "
                "each hidden neuron (W*x) is an exact linear decomposition of "
                "the pre-ReLU activation. This tells us how the feature affects "
                "each hidden neuron's input."
            ),
            (
                "BEYOND FIRST LAYER: After ReLU and through the second layer, "
                "the feature's contribution to the final output cannot be "
                "decomposed into a simple per-feature sum. ReLU introduces "
                "non-linearity, and the second layer combines all hidden "
                "neurons. The final prediction is a distributed computation "
                "over all features, not a sum of independent contributions."
            ),
            (
                "NOT CAUSAL: This trace does not establish that the feature "
                "caused the prediction. It shows how the feature's value "
                "flows through the network for this specific input, not what "
                "would happen if the feature were different."
            ),
            (
                "NOT A FAIRNESS GUARANTEE: Showing that a feature has a small "
                "first-layer contribution does not mean the model is fair "
                "with respect to that feature. Fairness requires rigorous "
                "testing beyond single-feature inspection."
            ),
        ],
    }

    return trace


def _to_serializable(value):
    """Convert a value to a JSON-serializable type."""
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if pd.isna(value):
        return None
    return value


def save_trace(trace: dict, output_path: str | Path) -> None:
    """Save a feature trace as a JSON file.

    Args:
        trace: Trace dictionary from trace_feature().
        output_path: File path for the output.
    """
    output_path = Path(output_path)
    ensure_dir(output_path.parent)

    # Convert any remaining non-serializable values
    def convert(obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, torch.Tensor):
            return obj.tolist()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    with open(output_path, "w") as f:
        json.dump(trace, f, indent=2, default=convert)

    logger.info(f"Saved feature trace: {output_path}")


def print_trace_summary(trace: dict) -> None:
    """Print a human-readable summary of a feature trace."""
    logger.info("=" * 70)
    logger.info("FEATURE TRACE SUMMARY")
    logger.info("=" * 70)

    # Raw data
    raw = trace["raw_data"]
    logger.info(f"\n{raw['stage']}")
    logger.info(f"  Column: {raw['column_name']}")
    logger.info(f"  Description: {raw['description']}")
    logger.info(f"  Raw value: {raw['raw_value']}")
    logger.info(f"  Type: {raw['source_type']}")

    # Cleaning
    clean = trace["cleaning"]
    logger.info(f"\n{clean['stage']}")
    logger.info(f"  Was missing: {clean['was_missing']}")
    logger.info(f"  Notes: {clean['notes']}")

    # Transformation
    trans = trace["transformation"]
    logger.info(f"\n{trans['stage']}")
    logger.info(f"  Transformation: {trans['transformation_type']}")
    logger.info(f"  Transformed features: {trans['n_transformed_features']}")
    for name, idx, val in zip(
        trans["transformed_feature_names"],
        trans["transformed_indices"],
        trans["transformed_values"],
    ):
        logger.info(f"    {name} (index {idx}): {val}")

    # Model input
    inp = trace["model_input"]
    logger.info(f"\n{inp['stage']}")
    logger.info(f"  Input vector length: {inp['input_vector_length']}")
    logger.info(f"  Feature positions: {inp['feature_positions']}")

    # First hidden layer
    hidden = trace["first_hidden_layer"]
    logger.info(f"\n{hidden['stage']}")
    logger.info(f"  Hidden size: {hidden['hidden_size']}")
    contributions = hidden["contributions"]["per_hidden_neuron"]
    top_contributions = sorted(
        enumerate(contributions), key=lambda x: abs(x[1]), reverse=True
    )[:5]
    logger.info("  Top 5 contributions (by magnitude):")
    for neuron_idx, contrib in top_contributions:
        logger.info(f"    Neuron {neuron_idx}: {contrib:.6f}")

    # Output
    out = trace["output"]
    logger.info(f"\n{out['stage']}")
    logger.info(f"  Predicted probability: {out['probability']}")
    logger.info(f"  Predicted class: {out['predicted_label']} ({out['predicted_class']})")
    logger.info(f"  True class: {out['true_label']} ({out['true_class']})")
    logger.info(f"  Correct: {out['correct']}")

    # Warnings
    logger.info(f"\n{trace['interpretation_warning']['stage']}")
    for warning in trace["interpretation_warning"]["warnings"]:
        logger.info(f"  - {warning}")

    logger.info("=" * 70)


def main():
    """Run a feature trace from the command line."""
    parser = argparse.ArgumentParser(description="Trace a feature through the pipeline")
    parser.add_argument("--feature", type=str, default=None, help="Feature to trace")
    parser.add_argument("--row", type=int, default=0, help="Test set row index")
    args = parser.parse_args()

    config = load_config()
    feature_name = args.feature or config["features"]["default_trace_feature"]

    logger.info(f"Tracing feature '{feature_name}' for test row {args.row}")

    trace = trace_feature(feature_name, args.row, config=config)
    print_trace_summary(trace)

    # Save trace
    traces_dir = resolve_path(config["evaluation"]["traces_dir"])
    output_path = traces_dir / f"trace_{feature_name}_row{args.row}.json"
    save_trace(trace, output_path)


if __name__ == "__main__":
    main()
