# Modeling Choices

## Architecture

The neural network is a single-hidden-layer feedforward network:

```
Input (N features) -> Linear(N, 32) -> ReLU -> Dropout(0.2) -> Linear(32, 1) -> Logit
```

### Why One Hidden Layer

A single hidden layer is sufficient for this dataset and is essential for the transparency framework. With one hidden layer, we can exactly decompose the pre-ReLU activation of each hidden neuron into per-feature contributions:

```
z_h = sum_i(W[h,i] * x[i]) + b[h]
```

Each term `W[h,i] * x[i]` is the exact contribution of input feature `i` to hidden neuron `h`. This decomposition is only possible before the ReLU non-linearity. After ReLU and through the second layer, per-feature attribution becomes approximate.

Adding more hidden layers would improve the model's capacity to learn non-linear patterns but would make this exact decomposition impossible at every layer except the first.

### Why 32 Hidden Neurons

The hidden size of 32 is a pragmatic choice:
- Large enough to capture non-linear patterns in 20 features
- Small enough to remain inspectable (32 contribution values per feature)
- Consistent with common practice for small tabular datasets

### Why ReLU

ReLU (Rectified Linear Unit) is the activation function: `ReLU(x) = max(0, x)`.

- It introduces non-linearity, without which the network would collapse to a linear model
- It is simple and well-understood
- Its behavior is easy to reason about: positive inputs pass through, negative inputs are zeroed

### Why Dropout

Dropout randomly zeroes hidden activations during training with probability 0.2. This prevents the network from over-relying on specific neurons and improves generalization, which matters on a 1,000-row dataset.

### Why BCEWithLogitsLoss

Binary cross-entropy with logits combines the sigmoid activation and loss computation in a single step. This is more numerically stable than applying sigmoid separately and then computing BCE loss.

## Training Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Optimizer | Adam | Adaptive learning rates, good default for most problems |
| Learning rate | 0.001 | Standard starting point for Adam |
| Weight decay | 0.0001 | Light L2 regularization to prevent large weights |
| Batch size | 64 | Reasonable for 800 training samples |
| Max epochs | 100 | Upper bound, early stopping will likely trigger first |
| Early stopping patience | 15 | Stop if validation loss does not improve for 15 epochs |

## Training Loop

The training loop is written explicitly (not using a high-level training framework) to make each step visible:

1. **Forward pass**: Input features pass through the network to produce logits
2. **Loss computation**: BCEWithLogitsLoss compares logits to true labels
3. **Backward pass**: PyTorch's autograd computes gradients of the loss with respect to every parameter
4. **Parameter update**: Adam adjusts each parameter to reduce the loss
5. **Validation**: After each epoch, evaluate on the validation set without gradient computation
6. **Early stopping**: Track the best validation loss and stop if it does not improve

## Baseline Models

Two baseline models provide context for the neural network's performance:

### Logistic Regression

The simplest meaningful baseline. Logistic regression is a linear model, so its coefficients are directly interpretable. If the neural network cannot outperform logistic regression, the added non-linearity is not contributing value.

### XGBoost

XGBoost is a gradient boosting method that typically achieves strong results on tabular data. It serves as an upper-bound baseline. Many practitioners have found that for tabular datasets, gradient boosting methods outperform neural networks unless the dataset is very large.

If XGBoost is not installable, a random forest is used as a fallback. Both are tree-based ensembles with similar strengths on tabular data.

## Model Artifacts

| Artifact | Path | Contents |
|----------|------|----------|
| Neural net checkpoint | `models/trained/credit_net.pt` | State dict, architecture params |
| Training history | `models/trained/training_history.json` | Per-epoch loss and accuracy |
| Logistic regression | `models/trained/logistic_regression.joblib` | Fitted sklearn model |
| XGBoost | `models/trained/xgboost.joblib` | Fitted XGBClassifier |

## Honest Assessment

For a dataset of 1,000 rows with 20 features, a single-hidden-layer neural network is unlikely to significantly outperform logistic regression or XGBoost. The neural network's value in this project is not raw predictive power. Its value is that it serves as the subject for the transparency framework: a model simple enough to inspect but complex enough to be genuinely non-linear.
