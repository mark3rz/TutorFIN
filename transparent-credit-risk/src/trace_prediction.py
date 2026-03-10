"""
Full prediction trace: traces ALL features for a given row.

While trace_feature.py traces a single feature in depth, this module
provides a broader view by showing the contribution of every feature
to the prediction for a selected row. This gives a "feature importance
snapshot" for one prediction.

This is useful for understanding which features matter most for a
specific prediction, similar to LIME or SHAP but using the exact
first-layer weight decomposition.

Usage:
    python -m src.trace_prediction --row 0
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from src.config import load_config, resolve_path, ensure_dir
from src.feature_lineage import FeatureLineage
from src.preprocess import load_processed_data
from src.train import load_trained_model
from src.utils import setup_logging


logger = setup_logging("trace_prediction")


def trace_all_features(
    row_index: int,
    config: dict = None,
    model=None,
    data: dict = None,
    lineage: FeatureLineage = None,
) -> dict:
    """Compute first-layer contributions for all source features for one row.

    For each source column, this sums the contributions of all its
    transformed features to each hidden neuron, then sums across
    hidden neurons to get a single "total first-layer contribution"
    per source feature.

    Important: This total contribution is a rough summary. It sums
    signed contributions across hidden neurons, which can cancel out.
    It should be interpreted as a first-order approximation, not as
    the definitive importance of a feature.

    Args:
        row_index: Index within the test set (0-based).
        config: Configuration dictionary.
        model: Trained CreditRiskNet.
        data: Processed data dict.
        lineage: FeatureLineage object.

    Returns:
        Dictionary with per-feature contribution summaries.
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

    X_test = data["X_test"]
    y_test = data["y_test"]

    x_tensor = torch.tensor(X_test[row_index], dtype=torch.float32)

    model.eval()
    contributions_data = model.compute_hidden_contributions(x_tensor)
    all_contributions = contributions_data["contributions"]  # (hidden, input)

    # Get prediction
    with torch.no_grad():
        logit = model(x_tensor.unsqueeze(0))
        probability = torch.sigmoid(logit).item()

    # Aggregate contributions by source column
    source_columns = lineage.get_all_source_columns()
    feature_summaries = []

    for source_col in source_columns:
        indices = lineage.get_transformed_indices(source_col)
        names = lineage.get_transformed_names(source_col)
        records = lineage.get_records_for_source(source_col)

        # Contributions for this feature's indices: shape (hidden, n_indices)
        feat_contribs = all_contributions[:, indices]

        # Sum across indices (for multi-column features like one-hot)
        # Result: (hidden,) -- contribution per hidden neuron
        per_hidden = feat_contribs.sum(dim=1)

        # Total signed contribution (sum across hidden neurons)
        total_signed = per_hidden.sum().item()

        # Total absolute contribution (magnitude regardless of direction)
        total_abs = per_hidden.abs().sum().item()

        feature_summaries.append({
            "source_column": source_col,
            "source_type": records[0]["source_type"],
            "n_transformed_features": len(indices),
            "total_signed_contribution": round(total_signed, 6),
            "total_absolute_contribution": round(total_abs, 6),
            "per_hidden_neuron": per_hidden.tolist(),
        })

    # Sort by absolute contribution for display
    feature_summaries.sort(key=lambda x: x["total_absolute_contribution"], reverse=True)

    predicted_class = 1 if probability >= 0.5 else 0
    true_class = int(y_test[row_index])

    return {
        "row_index": row_index,
        "probability": round(probability, 6),
        "predicted_class": predicted_class,
        "true_class": true_class,
        "correct": predicted_class == true_class,
        "feature_summaries": feature_summaries,
        "caveat": (
            "These contributions reflect the first-layer linear decomposition only. "
            "They do not account for non-linear interactions through ReLU and the "
            "second layer. Use them as a rough guide to feature relevance, not as "
            "exact attribution."
        ),
    }


def plot_feature_contributions(
    trace: dict,
    output_path: str | Path,
    top_n: int = 15,
) -> None:
    """Plot a horizontal bar chart of feature contributions.

    Args:
        trace: Dictionary from trace_all_features().
        output_path: Path to save the figure.
        top_n: Number of top features to show.
    """
    summaries = trace["feature_summaries"][:top_n]

    names = [s["source_column"] for s in summaries]
    values = [s["total_signed_contribution"] for s in summaries]

    # Reverse for horizontal bar chart (top feature at top)
    names = names[::-1]
    values = values[::-1]

    colors = ["#e74c3c" if v < 0 else "#2ecc71" for v in values]

    fig, ax = plt.subplots(figsize=(10, max(6, len(names) * 0.4)))
    ax.barh(names, values, color=colors)
    ax.set_xlabel("Total Signed First-Layer Contribution")
    ax.set_title(
        f"Feature Contributions (Row {trace['row_index']}, "
        f"P(good) = {trace['probability']:.3f})"
    )
    ax.axvline(x=0, color="black", linewidth=0.5)
    ax.grid(True, axis="x", alpha=0.3)

    plt.tight_layout()
    ensure_dir(Path(output_path).parent)
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info(f"Saved contribution plot: {output_path}")


def main():
    """Run a full prediction trace."""
    parser = argparse.ArgumentParser(description="Trace all features for a prediction")
    parser.add_argument("--row", type=int, default=0, help="Test set row index")
    args = parser.parse_args()

    config = load_config()

    trace = trace_all_features(args.row, config=config)

    logger.info(f"\nPrediction Trace for Row {args.row}")
    logger.info(f"  Predicted probability: {trace['probability']}")
    logger.info(f"  Predicted class: {trace['predicted_class']}")
    logger.info(f"  True class: {trace['true_class']}")
    logger.info(f"  Correct: {trace['correct']}")
    logger.info(f"\nTop feature contributions (by absolute magnitude):")

    for i, summary in enumerate(trace["feature_summaries"][:10]):
        logger.info(
            f"  {i+1}. {summary['source_column']:25s} "
            f"signed={summary['total_signed_contribution']:+.4f}  "
            f"abs={summary['total_absolute_contribution']:.4f}"
        )

    # Save outputs
    traces_dir = resolve_path(config["evaluation"]["traces_dir"])
    ensure_dir(traces_dir)

    trace_path = traces_dir / f"prediction_trace_row{args.row}.json"

    # Make JSON serializable
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

    with open(trace_path, "w") as f:
        json.dump(trace, f, indent=2, default=convert)

    figures_dir = resolve_path(config["evaluation"]["figures_dir"])
    plot_path = figures_dir / f"contributions_row{args.row}.png"
    plot_feature_contributions(trace, plot_path)

    logger.info(f"\nSaved trace: {trace_path}")
    logger.info(f"Saved plot: {plot_path}")


if __name__ == "__main__":
    main()
