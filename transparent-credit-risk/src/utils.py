"""
Shared utility functions for the transparent credit risk pipeline.

Provides logging setup, seed management, and common helpers used
across multiple pipeline stages.
"""

import logging
import random
import sys
from pathlib import Path

import numpy as np
import torch


def setup_logging(name: str = "credit_risk", level: int = logging.INFO) -> logging.Logger:
    """Create a configured logger with console output.

    Args:
        name: Logger name (typically the module name).
        level: Logging level (default: INFO).

    Returns:
        Configured Logger instance.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid duplicate handlers if called multiple times
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(
            "%(asctime)s | %(name)s | %(levelname)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


def set_seed(seed: int = 42) -> None:
    """Set random seeds for reproducibility across Python, NumPy, and PyTorch.

    This does not guarantee perfect reproducibility across different hardware
    or PyTorch versions, but it makes results consistent on the same setup.

    Args:
        seed: Integer seed value.
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    # Use deterministic algorithms where possible
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def get_device() -> torch.device:
    """Return the best available device (CUDA GPU if available, else CPU).

    Returns:
        torch.device for tensor operations.
    """
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")


def save_dataframe_artifact(df, path: str | Path, description: str = "") -> None:
    """Save a pandas DataFrame as a CSV artifact with logging.

    Args:
        df: DataFrame to save.
        path: Output file path.
        description: Human-readable description for the log message.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    logger = setup_logging("utils")
    logger.info(f"Saved {description}: {path} ({len(df)} rows)")
