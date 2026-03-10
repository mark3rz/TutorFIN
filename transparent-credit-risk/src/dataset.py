"""
PyTorch Dataset class for the credit risk data.

Wraps preprocessed NumPy arrays into a PyTorch Dataset so they can
be consumed by a DataLoader during training and evaluation.

The dataset is intentionally simple: it stores feature matrices and
target vectors as tensors. No additional transformations happen here
because all preprocessing is handled upstream by the sklearn pipeline.
"""

import numpy as np
import torch
from torch.utils.data import Dataset


class CreditRiskDataset(Dataset):
    """PyTorch Dataset for credit risk classification.

    Each sample is a (features, label) pair where:
    - features: float32 tensor of shape (n_transformed_features,)
    - label: float32 tensor of shape (1,) with value 0.0 or 1.0

    Using float32 for labels (instead of long/int) because we use
    BCEWithLogitsLoss which expects float targets.

    Args:
        X: Feature matrix as a NumPy array of shape (n_samples, n_features).
        y: Target vector as a NumPy array of shape (n_samples,).
    """

    def __init__(self, X: np.ndarray, y: np.ndarray):
        # Convert to float32 tensors
        # float32 is the standard dtype for neural network computation.
        # Using float64 would be wasteful and slower on GPU.
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32).unsqueeze(1)  # Shape: (n, 1)

    def __len__(self) -> int:
        """Return the number of samples in the dataset."""
        return len(self.X)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        """Return a single (features, label) pair.

        Args:
            idx: Sample index.

        Returns:
            Tuple of (feature_tensor, label_tensor).
        """
        return self.X[idx], self.y[idx]
