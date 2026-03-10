"""
PyTorch neural network model for binary credit risk classification.

Architecture: a single-hidden-layer feedforward network.

    Input (n_features) -> Linear -> ReLU -> Dropout -> Linear -> Output (1)

Why this architecture:
- One hidden layer is sufficient for tabular data of this complexity.
- ReLU activation introduces non-linearity without vanishing gradient issues.
- Dropout provides regularization to reduce overfitting on a small dataset.
- A single output neuron with BCEWithLogitsLoss handles binary classification
  efficiently (the sigmoid is built into the loss function for numerical stability).

This model is designed to be inspectable. With one hidden layer, we can
directly examine the weights connecting each input feature to each hidden
neuron, which is the foundation of the transparency trace system.

Deeper networks would distribute information across many layers, making
per-feature attribution much harder to interpret. The single-layer design
is a deliberate pedagogical and interpretability choice.
"""

import torch
import torch.nn as nn


class CreditRiskNet(nn.Module):
    """Single-hidden-layer neural network for binary credit risk classification.

    Architecture:
        input (n_features) -> fc1 (hidden_size) -> ReLU -> dropout -> fc2 (1) -> output

    The output is a raw logit (not passed through sigmoid). During training,
    we use BCEWithLogitsLoss which applies sigmoid internally for numerical
    stability. During inference, we apply sigmoid manually to get probabilities.

    Args:
        input_size: Number of input features (equals the number of transformed
            features from preprocessing).
        hidden_size: Number of neurons in the hidden layer. Default: 32.
        dropout_rate: Dropout probability. Set to 0.0 to disable. Default: 0.2.
    """

    def __init__(self, input_size: int, hidden_size: int = 32, dropout_rate: float = 0.2):
        super().__init__()

        # First linear layer: maps input features to hidden representation.
        # Each weight in this layer connects one input feature to one hidden neuron.
        # These weights are what we inspect in the transparency trace.
        self.fc1 = nn.Linear(input_size, hidden_size)

        # ReLU activation: introduces non-linearity.
        # Without this, the entire network would collapse to a linear model.
        # ReLU(x) = max(0, x) -- simple, effective, and easy to reason about.
        self.relu = nn.ReLU()

        # Dropout: randomly zeros some hidden activations during training.
        # This prevents the network from relying too heavily on any single
        # hidden neuron, which improves generalization.
        self.dropout = nn.Dropout(p=dropout_rate)

        # Second linear layer: maps hidden representation to a single output.
        # The output is a logit (log-odds) for the positive class.
        self.fc2 = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass: transform input features into a prediction logit.

        The data flows through the network as follows:
        1. x enters as a batch of feature vectors: shape (batch_size, input_size)
        2. fc1 applies a linear transformation: x @ W1.T + b1 -> (batch_size, hidden_size)
        3. ReLU zeros out negative values: max(0, hidden) -> (batch_size, hidden_size)
        4. Dropout randomly zeros some values during training
        5. fc2 maps to a single output: hidden @ W2.T + b2 -> (batch_size, 1)

        The output is NOT passed through sigmoid here. The loss function
        (BCEWithLogitsLoss) handles that internally.

        Args:
            x: Input tensor of shape (batch_size, input_size).

        Returns:
            Logit tensor of shape (batch_size, 1).
        """
        # Step 1: Linear transformation from input to hidden layer
        hidden = self.fc1(x)

        # Step 2: Apply non-linear activation
        hidden = self.relu(hidden)

        # Step 3: Apply dropout (only active during training, not during eval)
        hidden = self.dropout(hidden)

        # Step 4: Linear transformation from hidden to output
        output = self.fc2(hidden)

        return output

    def get_first_layer_weights(self) -> torch.Tensor:
        """Return the weight matrix of the first linear layer.

        Shape: (hidden_size, input_size)
        Entry [h, i] is the weight connecting input feature i to hidden neuron h.

        This is used by the transparency trace to show how much each input
        feature contributes to each hidden neuron's pre-activation value.

        Returns:
            Weight tensor of shape (hidden_size, input_size).
        """
        return self.fc1.weight.data.clone()

    def get_first_layer_bias(self) -> torch.Tensor:
        """Return the bias vector of the first linear layer.

        Shape: (hidden_size,)

        Returns:
            Bias tensor of shape (hidden_size,).
        """
        return self.fc1.bias.data.clone()

    def compute_hidden_contributions(self, x: torch.Tensor) -> dict:
        """Compute the contribution of each input feature to each hidden neuron.

        For a single input vector x, the pre-activation of hidden neuron h is:
            z_h = sum_i(W[h,i] * x[i]) + b[h]

        The "contribution" of input feature i to hidden neuron h is:
            c[h,i] = W[h,i] * x[i]

        This is an exact decomposition of the pre-activation (before ReLU).
        After ReLU, the decomposition becomes approximate because ReLU is
        non-linear. We report contributions as the pre-ReLU linear terms.

        Important: This is a local, linear decomposition at the first layer
        only. It does NOT tell us the full causal effect of a feature on the
        final prediction, because the second layer and ReLU interact in
        non-linear ways. The transparency trace makes this limitation explicit.

        Args:
            x: Single input tensor of shape (input_size,) or (1, input_size).

        Returns:
            Dictionary with:
            - "contributions": tensor of shape (hidden_size, input_size)
            - "pre_relu": tensor of shape (hidden_size,) -- z_h values
            - "post_relu": tensor of shape (hidden_size,) -- after ReLU
            - "bias": tensor of shape (hidden_size,)
        """
        if x.dim() == 1:
            x = x.unsqueeze(0)

        weights = self.fc1.weight.data  # (hidden_size, input_size)
        bias = self.fc1.bias.data       # (hidden_size,)

        # Contribution of each feature to each hidden neuron
        # contributions[h, i] = W[h, i] * x[0, i]
        contributions = weights * x  # Broadcasting: (hidden_size, input_size)

        # Pre-activation values: z_h = sum_i contributions[h,i] + bias[h]
        pre_relu = contributions.sum(dim=1) + bias  # (hidden_size,)

        # Post-activation values (after ReLU)
        post_relu = torch.relu(pre_relu)  # (hidden_size,)

        return {
            "contributions": contributions,
            "pre_relu": pre_relu,
            "post_relu": post_relu,
            "bias": bias,
        }

    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Get predicted probability for the positive class.

        Applies sigmoid to the raw logit output.

        Args:
            x: Input tensor.

        Returns:
            Probability tensor of shape (batch_size, 1).
        """
        self.eval()
        with torch.no_grad():
            logit = self.forward(x)
            prob = torch.sigmoid(logit)
        return prob
