"""
Evaluation script for all trained models (neural net and baselines).

Computes standard binary classification metrics and generates
visualizations for model comparison. This script is designed to
be run after training all models.

Metrics computed:
- ROC-AUC (primary metric for ranking ability)
- Accuracy (overall correctness, but misleading with class imbalance)
- Precision (of predicted positives, how many are truly positive)
- Recall (of actual positives, how many were correctly identified)
- F1 score (harmonic mean of precision and recall)
- Confusion matrix (detailed breakdown of prediction outcomes)

Visualizations:
- ROC curves for all models
- Precision-recall curves for all models
- Training loss curves for neural net
- Model comparison bar chart

Usage:
    python -m src.evaluate
"""

import json
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for saving figures
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
import torch

from src.config import load_config, resolve_path, ensure_dir
from src.model import CreditRiskNet
from src.preprocess import load_processed_data
from src.train import load_trained_model
from src.utils import setup_logging


logger = setup_logging("evaluate")


def evaluate_neural_net(config: dict, data: dict) -> dict:
    """Evaluate the trained neural network on the test set.

    Args:
        config: Configuration dictionary.
        data: Dictionary from load_processed_data().

    Returns:
        Dictionary with metrics and predictions.
    """
    model, _ = load_trained_model(config)
    device = torch.device("cpu")
    model = model.to(device)
    model.eval()

    X_test = torch.tensor(data["X_test"], dtype=torch.float32).to(device)
    y_test = data["y_test"]

    with torch.no_grad():
        logits = model(X_test)
        probabilities = torch.sigmoid(logits).cpu().numpy().flatten()

    predictions = (probabilities >= 0.5).astype(int)

    metrics = _compute_metrics(y_test, predictions, probabilities)
    metrics["model_name"] = "Neural Network"

    logger.info(f"Neural Network - ROC-AUC: {metrics['roc_auc']:.4f}, "
                f"Accuracy: {metrics['accuracy']:.4f}, F1: {metrics['f1']:.4f}")

    return {
        "metrics": metrics,
        "probabilities": probabilities,
        "predictions": predictions,
        "y_true": y_test,
    }


def evaluate_baselines(config: dict, data: dict) -> list[dict]:
    """Evaluate baseline models on the test set.

    Loads saved baseline models and computes the same metrics as the
    neural network for fair comparison.

    Args:
        config: Configuration dictionary.
        data: Dictionary from load_processed_data().

    Returns:
        List of result dictionaries, one per baseline model.
    """
    results = []
    model_dir = resolve_path(config["baselines"]["models_dir"])
    y_test = data["y_test"]
    X_test = data["X_test"]

    # Logistic Regression
    lr_path = model_dir / "logistic_regression.joblib"
    if lr_path.exists():
        lr_model = joblib.load(lr_path)
        lr_probs = lr_model.predict_proba(X_test)[:, 1]
        lr_preds = (lr_probs >= 0.5).astype(int)
        lr_metrics = _compute_metrics(y_test, lr_preds, lr_probs)
        lr_metrics["model_name"] = "Logistic Regression"
        results.append({
            "metrics": lr_metrics,
            "probabilities": lr_probs,
            "predictions": lr_preds,
            "y_true": y_test,
        })
        logger.info(f"Logistic Regression - ROC-AUC: {lr_metrics['roc_auc']:.4f}, "
                    f"Accuracy: {lr_metrics['accuracy']:.4f}, F1: {lr_metrics['f1']:.4f}")
    else:
        logger.warning(f"Logistic regression model not found at {lr_path}")

    # XGBoost
    xgb_path = model_dir / "xgboost.joblib"
    if xgb_path.exists():
        xgb_model = joblib.load(xgb_path)
        xgb_probs = xgb_model.predict_proba(X_test)[:, 1]
        xgb_preds = (xgb_probs >= 0.5).astype(int)
        xgb_metrics = _compute_metrics(y_test, xgb_preds, xgb_probs)
        xgb_metrics["model_name"] = "XGBoost"
        results.append({
            "metrics": xgb_metrics,
            "probabilities": xgb_probs,
            "predictions": xgb_preds,
            "y_true": y_test,
        })
        logger.info(f"XGBoost - ROC-AUC: {xgb_metrics['roc_auc']:.4f}, "
                    f"Accuracy: {xgb_metrics['accuracy']:.4f}, F1: {xgb_metrics['f1']:.4f}")
    else:
        logger.warning(f"XGBoost model not found at {xgb_path}")

    # Random Forest (fallback)
    rf_path = model_dir / "random_forest.joblib"
    if rf_path.exists():
        rf_model = joblib.load(rf_path)
        rf_probs = rf_model.predict_proba(X_test)[:, 1]
        rf_preds = (rf_probs >= 0.5).astype(int)
        rf_metrics = _compute_metrics(y_test, rf_preds, rf_probs)
        rf_metrics["model_name"] = "Random Forest"
        results.append({
            "metrics": rf_metrics,
            "probabilities": rf_probs,
            "predictions": rf_preds,
            "y_true": y_test,
        })
        logger.info(f"Random Forest - ROC-AUC: {rf_metrics['roc_auc']:.4f}, "
                    f"Accuracy: {rf_metrics['accuracy']:.4f}, F1: {rf_metrics['f1']:.4f}")

    return results


def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray) -> dict:
    """Compute standard binary classification metrics.

    Args:
        y_true: True labels (0 or 1).
        y_pred: Predicted labels (0 or 1).
        y_prob: Predicted probabilities for the positive class.

    Returns:
        Dictionary of metric names to values.
    """
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }


def plot_roc_curves(all_results: list[dict], output_dir: Path) -> None:
    """Plot ROC curves for all models on the same axes.

    Args:
        all_results: List of evaluation result dicts.
        output_dir: Directory to save the figure.
    """
    fig, ax = plt.subplots(figsize=(8, 6))

    for result in all_results:
        name = result["metrics"]["model_name"]
        auc = result["metrics"]["roc_auc"]
        fpr, tpr, _ = roc_curve(result["y_true"], result["probabilities"])
        ax.plot(fpr, tpr, label=f"{name} (AUC = {auc:.3f})")

    ax.plot([0, 1], [0, 1], "k--", label="Random (AUC = 0.500)")
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curves: Model Comparison")
    ax.legend(loc="lower right")
    ax.grid(True, alpha=0.3)

    ensure_dir(output_dir)
    fig.savefig(output_dir / "roc_curves.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info(f"Saved ROC curves: {output_dir / 'roc_curves.png'}")


def plot_precision_recall_curves(all_results: list[dict], output_dir: Path) -> None:
    """Plot precision-recall curves for all models.

    Args:
        all_results: List of evaluation result dicts.
        output_dir: Directory to save the figure.
    """
    fig, ax = plt.subplots(figsize=(8, 6))

    for result in all_results:
        name = result["metrics"]["model_name"]
        precision, recall, _ = precision_recall_curve(
            result["y_true"], result["probabilities"]
        )
        ax.plot(recall, precision, label=name)

    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curves: Model Comparison")
    ax.legend(loc="lower left")
    ax.grid(True, alpha=0.3)

    ensure_dir(output_dir)
    fig.savefig(output_dir / "precision_recall_curves.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info(f"Saved PR curves: {output_dir / 'precision_recall_curves.png'}")


def plot_training_history(config: dict, output_dir: Path) -> None:
    """Plot training and validation loss curves for the neural network.

    Args:
        config: Configuration dictionary.
        output_dir: Directory to save the figure.
    """
    history_path = resolve_path(config["model"]["model_dir"]) / "training_history.json"
    if not history_path.exists():
        logger.warning("Training history not found, skipping loss plot.")
        return

    with open(history_path) as f:
        history = json.load(f)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    epochs = range(1, len(history["train_loss"]) + 1)

    # Loss plot
    ax1.plot(epochs, history["train_loss"], label="Training Loss")
    ax1.plot(epochs, history["val_loss"], label="Validation Loss")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss (BCE)")
    ax1.set_title("Training and Validation Loss")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Accuracy plot
    ax2.plot(epochs, history["val_accuracy"], label="Validation Accuracy", color="green")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Accuracy")
    ax2.set_title("Validation Accuracy")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    ensure_dir(output_dir)
    fig.savefig(output_dir / "training_history.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info(f"Saved training history plot: {output_dir / 'training_history.png'}")


def plot_confusion_matrices(all_results: list[dict], output_dir: Path) -> None:
    """Plot confusion matrices for all models as a horizontal strip.

    Args:
        all_results: List of evaluation result dicts.
        output_dir: Directory to save the figure.
    """
    n_models = len(all_results)
    fig, axes = plt.subplots(1, n_models, figsize=(5 * n_models, 4))
    if n_models == 1:
        axes = [axes]

    for ax, result in zip(axes, all_results):
        cm = np.array(result["metrics"]["confusion_matrix"])
        im = ax.imshow(cm, cmap="Blues")
        ax.set_title(result["metrics"]["model_name"])
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_xticks([0, 1])
        ax.set_yticks([0, 1])
        ax.set_xticklabels(["Bad (0)", "Good (1)"])
        ax.set_yticklabels(["Bad (0)", "Good (1)"])

        # Add text annotations
        for i in range(2):
            for j in range(2):
                ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                        color="white" if cm[i, j] > cm.max() / 2 else "black",
                        fontsize=14)

    fig.suptitle("Confusion Matrices", fontsize=14)
    plt.tight_layout()

    ensure_dir(output_dir)
    fig.savefig(output_dir / "confusion_matrices.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info(f"Saved confusion matrices: {output_dir / 'confusion_matrices.png'}")


def save_comparison_table(all_results: list[dict], output_dir: Path) -> pd.DataFrame:
    """Save a model comparison table as CSV.

    Args:
        all_results: List of evaluation result dicts.
        output_dir: Directory to save the table.

    Returns:
        DataFrame with comparison metrics.
    """
    rows = []
    for result in all_results:
        m = result["metrics"]
        rows.append({
            "Model": m["model_name"],
            "ROC-AUC": round(m["roc_auc"], 4),
            "Accuracy": round(m["accuracy"], 4),
            "Precision": round(m["precision"], 4),
            "Recall": round(m["recall"], 4),
            "F1": round(m["f1"], 4),
        })

    comparison_df = pd.DataFrame(rows)
    ensure_dir(output_dir)
    comparison_df.to_csv(output_dir / "model_comparison.csv", index=False)
    logger.info(f"Saved comparison table: {output_dir / 'model_comparison.csv'}")

    # Print table
    logger.info("\nModel Comparison:")
    logger.info(comparison_df.to_string(index=False))

    return comparison_df


def analyze_errors(nn_result: dict, data: dict, config: dict) -> None:
    """Analyze false positives and false negatives from the neural net.

    This provides a "what the model gets wrong" section for the evaluation
    report, examining specific examples of misclassifications.

    Args:
        nn_result: Neural net evaluation result dict.
        data: Dictionary from load_processed_data().
        config: Configuration dictionary.
    """
    y_true = nn_result["y_true"]
    y_pred = nn_result["predictions"]
    y_prob = nn_result["probabilities"]

    # False positives: predicted good (1) but actually bad (0)
    fp_mask = (y_pred == 1) & (y_true == 0)
    # False negatives: predicted bad (0) but actually good (1)
    fn_mask = (y_pred == 0) & (y_true == 1)

    n_fp = fp_mask.sum()
    n_fn = fn_mask.sum()

    logger.info(f"\nError Analysis:")
    logger.info(f"  False Positives (predicted good, actually bad): {n_fp}")
    logger.info(f"  False Negatives (predicted bad, actually good): {n_fn}")

    if n_fp > 0:
        fp_probs = y_prob[fp_mask]
        logger.info(f"  FP probability range: [{fp_probs.min():.3f}, {fp_probs.max():.3f}]")
        logger.info(f"  FP mean probability: {fp_probs.mean():.3f}")

    if n_fn > 0:
        fn_probs = y_prob[fn_mask]
        logger.info(f"  FN probability range: [{fn_probs.min():.3f}, {fn_probs.max():.3f}]")
        logger.info(f"  FN mean probability: {fn_probs.mean():.3f}")

    # Save error analysis
    error_data = {
        "false_positives": int(n_fp),
        "false_negatives": int(n_fn),
        "total_test_samples": int(len(y_true)),
        "fp_mean_probability": float(y_prob[fp_mask].mean()) if n_fp > 0 else None,
        "fn_mean_probability": float(y_prob[fn_mask].mean()) if n_fn > 0 else None,
        "note": (
            "In credit risk, false positives (approving bad credit) are typically "
            "more costly than false negatives (rejecting good credit). The original "
            "German Credit dataset assigns a 5:1 cost ratio."
        ),
    }

    reports_dir = resolve_path(config["evaluation"]["reports_dir"])
    ensure_dir(reports_dir)
    with open(reports_dir / "error_analysis.json", "w") as f:
        json.dump(error_data, f, indent=2)
    logger.info(f"Saved error analysis: {reports_dir / 'error_analysis.json'}")


def run_evaluation(config: dict = None) -> dict:
    """Run the full evaluation pipeline.

    Args:
        config: Configuration dictionary.

    Returns:
        Dictionary with all evaluation results.
    """
    if config is None:
        config = load_config()

    data = load_processed_data(config)
    figures_dir = resolve_path(config["evaluation"]["figures_dir"])
    tables_dir = resolve_path(config["evaluation"]["tables_dir"])

    # Evaluate all models
    all_results = []

    nn_result = evaluate_neural_net(config, data)
    all_results.append(nn_result)

    baseline_results = evaluate_baselines(config, data)
    all_results.extend(baseline_results)

    # Generate visualizations
    plot_roc_curves(all_results, figures_dir)
    plot_precision_recall_curves(all_results, figures_dir)
    plot_training_history(config, figures_dir)
    plot_confusion_matrices(all_results, figures_dir)

    # Save comparison table
    comparison_df = save_comparison_table(all_results, tables_dir)

    # Error analysis for neural net
    analyze_errors(nn_result, data, config)

    logger.info("\nEvaluation complete. Check outputs/figures/ and outputs/tables/.")

    return {
        "neural_net": nn_result,
        "baselines": baseline_results,
        "comparison": comparison_df,
    }


def main():
    """Run evaluation."""
    config = load_config()
    run_evaluation(config)


if __name__ == "__main__":
    main()
