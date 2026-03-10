"""
Training script for the credit risk neural network.

Implements a manual PyTorch training loop with:
- Train/validation split from the training data
- BCEWithLogitsLoss for binary classification
- Adam optimizer with weight decay (L2 regularization)
- Early stopping based on validation loss
- Best model checkpointing
- Training history logging

The training loop is intentionally explicit rather than wrapped in a
high-level framework. This makes it easier to understand what happens
at each step and to inspect intermediate states for the transparency demo.

Usage:
    python -m src.train
"""

import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from src.config import load_config, resolve_path, ensure_dir
from src.dataset import CreditRiskDataset
from src.model import CreditRiskNet
from src.preprocess import load_processed_data
from src.utils import setup_logging, set_seed, get_device


logger = setup_logging("train")


def train_model(config: dict = None) -> dict:
    """Train the credit risk neural network.

    This function:
    1. Loads preprocessed data
    2. Creates train/validation datasets
    3. Builds the model
    4. Runs the training loop with early stopping
    5. Saves the best model and training history

    Args:
        config: Configuration dictionary. If None, loads from default.

    Returns:
        Dictionary with trained model, training history, and metadata.
    """
    if config is None:
        config = load_config()

    seed = config["project"]["random_seed"]
    set_seed(seed)
    device = get_device()
    logger.info(f"Training on device: {device}")

    # ---- Load preprocessed data ----
    data = load_processed_data(config)
    X_train = data["X_train"]
    y_train = data["y_train"]

    # ---- Create train/validation split ----
    # We split the training set further to get a validation set for
    # monitoring overfitting and early stopping. The test set is held
    # out entirely until evaluation.
    full_dataset = CreditRiskDataset(X_train, y_train)
    val_fraction = config["data"]["validation_size"]
    val_size = int(len(full_dataset) * val_fraction)
    train_size = len(full_dataset) - val_size

    train_dataset, val_dataset = random_split(
        full_dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(seed),
    )

    logger.info(f"Training samples: {train_size}, Validation samples: {val_size}")

    # ---- Create data loaders ----
    # DataLoaders handle batching and shuffling.
    # Training data is shuffled each epoch; validation data is not.
    batch_size = config["model"]["batch_size"]
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    # ---- Build model ----
    model_config = config["model"]
    input_size = X_train.shape[1]  # Number of transformed features
    model = CreditRiskNet(
        input_size=input_size,
        hidden_size=model_config["hidden_size"],
        dropout_rate=model_config["dropout_rate"],
    )
    model = model.to(device)
    logger.info(f"Model architecture:\n{model}")
    logger.info(f"Input size: {input_size}, Hidden size: {model_config['hidden_size']}")

    # Count parameters
    n_params = sum(p.numel() for p in model.parameters())
    logger.info(f"Total trainable parameters: {n_params}")

    # ---- Loss function ----
    # BCEWithLogitsLoss combines a sigmoid layer and binary cross-entropy loss
    # in one class. This is more numerically stable than applying sigmoid
    # separately and then using BCELoss.
    #
    # Binary cross-entropy measures how well the predicted probability
    # distribution matches the true label distribution. For a single sample:
    #   loss = -[y * log(sigmoid(logit)) + (1-y) * log(1 - sigmoid(logit))]
    criterion = nn.BCEWithLogitsLoss()

    # ---- Optimizer ----
    # Adam is an adaptive learning rate optimizer that maintains per-parameter
    # learning rates. It works well for most problems without careful tuning.
    # weight_decay adds L2 regularization to prevent large weights.
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=model_config["learning_rate"],
        weight_decay=model_config["weight_decay"],
    )

    # ---- Training loop ----
    num_epochs = model_config["num_epochs"]
    patience = model_config["patience"]
    best_val_loss = float("inf")
    epochs_without_improvement = 0
    history = {"train_loss": [], "val_loss": [], "val_accuracy": []}

    logger.info(f"Starting training for up to {num_epochs} epochs (patience: {patience})")
    logger.info("-" * 60)

    for epoch in range(num_epochs):
        # --- Training phase ---
        # model.train() enables dropout and batch normalization training behavior.
        model.train()
        train_loss_sum = 0.0
        train_batches = 0

        for batch_X, batch_y in train_loader:
            # Move data to the compute device (CPU or GPU)
            batch_X = batch_X.to(device)
            batch_y = batch_y.to(device)

            # Forward pass: compute predicted logits
            logits = model(batch_X)

            # Compute loss: how far are predictions from true labels?
            loss = criterion(logits, batch_y)

            # Backward pass: compute gradients of loss with respect to all parameters.
            # This is the core of backpropagation. PyTorch's autograd system
            # automatically computes d(loss)/d(parameter) for every parameter.
            optimizer.zero_grad()  # Clear gradients from previous step
            loss.backward()       # Compute gradients

            # Update parameters: the optimizer adjusts each parameter by a small
            # amount in the direction that reduces the loss.
            # For Adam: param -= lr * adapted_gradient
            optimizer.step()

            train_loss_sum += loss.item()
            train_batches += 1

        avg_train_loss = train_loss_sum / train_batches

        # --- Validation phase ---
        # model.eval() disables dropout and uses batch norm running statistics.
        # torch.no_grad() tells PyTorch not to track gradients, saving memory.
        model.eval()
        val_loss_sum = 0.0
        val_batches = 0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X = batch_X.to(device)
                batch_y = batch_y.to(device)

                logits = model(batch_X)
                loss = criterion(logits, batch_y)

                val_loss_sum += loss.item()
                val_batches += 1

                # Compute accuracy: convert logits to predictions
                predictions = (torch.sigmoid(logits) >= 0.5).float()
                val_correct += (predictions == batch_y).sum().item()
                val_total += batch_y.size(0)

        avg_val_loss = val_loss_sum / val_batches
        val_accuracy = val_correct / val_total

        # Record history
        history["train_loss"].append(avg_train_loss)
        history["val_loss"].append(avg_val_loss)
        history["val_accuracy"].append(val_accuracy)

        # Print progress every 10 epochs or at start/end
        if epoch % 10 == 0 or epoch == num_epochs - 1:
            logger.info(
                f"Epoch {epoch+1:3d}/{num_epochs} | "
                f"Train Loss: {avg_train_loss:.4f} | "
                f"Val Loss: {avg_val_loss:.4f} | "
                f"Val Acc: {val_accuracy:.4f}"
            )

        # --- Early stopping ---
        # If validation loss improves, save the model and reset patience.
        # If it does not improve for 'patience' epochs, stop training.
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            epochs_without_improvement = 0
            # Save best model state
            best_model_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= patience:
                logger.info(
                    f"Early stopping at epoch {epoch+1}. "
                    f"No improvement for {patience} epochs."
                )
                break

    logger.info("-" * 60)
    logger.info(f"Training complete. Best validation loss: {best_val_loss:.4f}")

    # Load the best model state
    model.load_state_dict(best_model_state)
    model = model.to(device)

    # Save model and history
    _save_training_artifacts(model, history, input_size, config)

    return {
        "model": model,
        "history": history,
        "input_size": input_size,
        "best_val_loss": best_val_loss,
        "device": device,
    }


def _save_training_artifacts(
    model: CreditRiskNet,
    history: dict,
    input_size: int,
    config: dict,
) -> None:
    """Save the trained model and training history.

    Saves:
    - Model state dict (PyTorch checkpoint)
    - Model metadata (architecture details)
    - Training history (losses and metrics per epoch)
    """
    model_config = config["model"]
    model_dir = resolve_path(model_config["model_dir"])
    ensure_dir(model_dir)

    # Save model checkpoint
    # We save a dictionary with both the state_dict and the architecture
    # parameters so we can reconstruct the model later.
    checkpoint = {
        "model_state_dict": model.state_dict(),
        "input_size": input_size,
        "hidden_size": model_config["hidden_size"],
        "dropout_rate": model_config["dropout_rate"],
    }
    model_path = model_dir / model_config["model_filename"]
    torch.save(checkpoint, model_path)
    logger.info(f"Saved model checkpoint: {model_path}")

    # Save training history
    history_path = model_dir / "training_history.json"
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    logger.info(f"Saved training history: {history_path}")


def load_trained_model(config: dict = None) -> tuple[CreditRiskNet, dict]:
    """Load a previously trained model from disk.

    Args:
        config: Configuration dictionary. If None, loads from default.

    Returns:
        Tuple of (model, checkpoint_dict).
    """
    if config is None:
        config = load_config()

    model_dir = resolve_path(config["model"]["model_dir"])
    model_path = model_dir / config["model"]["model_filename"]

    if not model_path.exists():
        raise FileNotFoundError(
            f"Trained model not found: {model_path}. Run 'python -m src.train' first."
        )

    checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)

    model = CreditRiskNet(
        input_size=checkpoint["input_size"],
        hidden_size=checkpoint["hidden_size"],
        dropout_rate=checkpoint["dropout_rate"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    logger.info(f"Loaded model from {model_path}")
    return model, checkpoint


def main():
    """Train the neural network model."""
    config = load_config()
    train_model(config)


if __name__ == "__main__":
    main()
