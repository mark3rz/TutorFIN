"""
Prediction script for the trained neural network.

Provides functions to generate predictions for individual rows or
batches of data. Used by the trace system and Streamlit app to
show prediction outputs alongside feature contributions.

Usage:
    python -m src.predict
"""

import numpy as np
import pandas as pd
import torch

from src.config import load_config, resolve_path
from src.preprocess import load_processed_data
from src.train import load_trained_model
from src.utils import setup_logging


logger = setup_logging("predict")


def predict_single_row(
    row_index: int,
    model=None,
    data: dict = None,
    config: dict = None,
) -> dict:
    """Generate a prediction for a single test set row.

    Args:
        row_index: Index within the test set (0-based).
        model: Trained CreditRiskNet. If None, loads from disk.
        data: Processed data dict. If None, loads from disk.
        config: Configuration dictionary.

    Returns:
        Dictionary with prediction details:
        - row_index: the index used
        - logit: raw model output (before sigmoid)
        - probability: predicted probability for positive class
        - predicted_class: 0 or 1
        - predicted_label: "good" or "bad"
        - true_class: actual label (0 or 1)
        - true_label: actual label as string
        - correct: whether prediction matches true label
    """
    if config is None:
        config = load_config()
    if model is None:
        model, _ = load_trained_model(config)
    if data is None:
        data = load_processed_data(config)

    X_test = data["X_test"]
    y_test = data["y_test"]

    if row_index < 0 or row_index >= len(X_test):
        raise IndexError(
            f"Row index {row_index} out of range. Test set has {len(X_test)} rows."
        )

    # Get the single row as a tensor
    x = torch.tensor(X_test[row_index], dtype=torch.float32).unsqueeze(0)

    model.eval()
    with torch.no_grad():
        logit = model(x)
        probability = torch.sigmoid(logit).item()

    predicted_class = 1 if probability >= 0.5 else 0
    true_class = int(y_test[row_index])

    positive_label = config["data"]["positive_label"]
    negative_label = config["data"]["negative_label"]

    return {
        "row_index": row_index,
        "logit": logit.item(),
        "probability": round(probability, 6),
        "predicted_class": predicted_class,
        "predicted_label": positive_label if predicted_class == 1 else negative_label,
        "true_class": true_class,
        "true_label": positive_label if true_class == 1 else negative_label,
        "correct": predicted_class == true_class,
    }


def predict_batch(
    model=None,
    data: dict = None,
    config: dict = None,
    dataset_split: str = "test",
) -> pd.DataFrame:
    """Generate predictions for an entire dataset split.

    Args:
        model: Trained CreditRiskNet. If None, loads from disk.
        data: Processed data dict. If None, loads from disk.
        config: Configuration dictionary.
        dataset_split: "test" or "train".

    Returns:
        DataFrame with columns: index, probability, predicted_class, true_class, correct.
    """
    if config is None:
        config = load_config()
    if model is None:
        model, _ = load_trained_model(config)
    if data is None:
        data = load_processed_data(config)

    if dataset_split == "test":
        X = data["X_test"]
        y = data["y_test"]
    else:
        X = data["X_train"]
        y = data["y_train"]

    x_tensor = torch.tensor(X, dtype=torch.float32)

    model.eval()
    with torch.no_grad():
        logits = model(x_tensor)
        probabilities = torch.sigmoid(logits).numpy().flatten()

    predictions = (probabilities >= 0.5).astype(int)

    results = pd.DataFrame({
        "index": range(len(X)),
        "probability": probabilities.round(6),
        "predicted_class": predictions,
        "true_class": y.astype(int),
        "correct": (predictions == y).astype(int),
    })

    return results


def main():
    """Run predictions on the test set and print summary."""
    config = load_config()
    results = predict_batch(config=config, dataset_split="test")

    accuracy = results["correct"].mean()
    logger.info(f"Test set predictions: {len(results)} rows")
    logger.info(f"Accuracy: {accuracy:.4f}")
    logger.info(f"Correct: {results['correct'].sum()}/{len(results)}")

    # Save predictions
    output_path = resolve_path(config["evaluation"]["tables_dir"]) / "test_predictions.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    results.to_csv(output_path, index=False)
    logger.info(f"Saved predictions: {output_path}")


if __name__ == "__main__":
    main()
