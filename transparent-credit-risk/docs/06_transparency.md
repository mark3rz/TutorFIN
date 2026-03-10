# Transparency Framework

## Overview

The transparency framework is the signature feature of this project. It lets a user select a raw feature (like `age`) and a specific data row, then traces that feature's path through every pipeline stage to the final prediction.

The framework carefully distinguishes three levels of transparency:

1. **Data lineage** -- exact and verifiable
2. **First-layer contribution** -- exact linear decomposition
3. **Full network attribution** -- approximate and conceptual only

## Trace Stages

### A. Raw Data

Shows the original value of the selected feature for the selected row, along with the column description and data type from the data dictionary.

This is a simple lookup. It establishes the starting point.

### B. Cleaning / Typing

Reports whether the value was missing, whether any type coercion was applied, and what imputation (if any) occurred.

For the German Credit dataset, missing values are rare, so this stage often reports "no imputation needed." The pipeline handles it correctly regardless.

### C. Transformation

Shows the mathematical transformation applied:

- **Numeric features**: Standardized using `(value - mean) / std` where mean and std are computed from the training set. Reports the transformed value.
- **Categorical features**: One-hot encoded. Reports which binary indicator column(s) were created and their values (0 or 1).

This stage also reports:
- The transformed feature name(s)
- The transformed feature index (position in the model input vector)
- The transformation formula or encoding outcome

### D. Neural Network Input

Shows where the transformed feature sits in the full input vector. The input vector contains all features from all columns. The lineage system identifies exactly which positions belong to the selected feature.

A visualization highlights the traced feature's position(s) within the full input vector.

### E. First Hidden Layer

This is where the trace transitions from exact data lineage to model-level analysis.

For each hidden neuron `h`, the contribution of the selected feature is:

```
contribution[h] = sum over i in feature_indices: W[h, i] * x[i]
```

Where:
- `W[h, i]` is the weight connecting transformed feature index `i` to hidden neuron `h`
- `x[i]` is the transformed feature value at index `i`
- For numeric features, there is one index; for categorical features, there are multiple (one per category)

This decomposition is **exact**: the pre-ReLU activation of each hidden neuron is exactly the sum of per-feature contributions plus the bias term.

After ReLU, the decomposition becomes **approximate**:
- Neurons with negative pre-activation are zeroed out
- The contribution of a feature to a zeroed neuron is effectively discarded
- We cannot simply add up contributions across neurons to get a total effect

### F. Output

Shows the final prediction:
- Raw logit (model output before sigmoid)
- Predicted probability (after sigmoid)
- Predicted class (using 0.5 threshold)
- True class (ground truth)
- Whether the prediction was correct

### G. Interpretation Caveats

Every trace includes explicit warnings about what the trace does and does not show.

## What the Trace Does Show

1. **Exact data lineage**: The raw value was X, it was transformed to Y, it sits at position Z in the input vector. This is verifiable.

2. **Exact first-layer decomposition**: The feature contributes C units to hidden neuron H before ReLU. This is a mathematical fact derived from the weight matrix and input values.

3. **Local analysis**: The trace shows what happens for this specific input row. A different row with different feature values would produce different contributions.

## What the Trace Does Not Show

1. **Causal attribution**: The trace does not tell us what would happen if `age` were different. That would require counterfactual analysis (perturbing the input and re-running the model).

2. **Full network attribution**: After ReLU and through the second layer, per-feature effects interact non-linearly. The total effect of `age` on the final prediction cannot be decomposed into a simple sum. Methods like SHAP or integrated gradients provide principled (but still approximate) answers to this question.

3. **Feature importance across the dataset**: The trace is for one row. Feature importance across the entire dataset requires aggregating many traces or using global explanation methods.

4. **Fairness**: A small first-layer contribution does not mean the model is fair with respect to that feature. Fairness testing requires population-level analysis with appropriate fairness metrics.

## Design Principles

1. **Be exact where possible**: Data lineage and first-layer decomposition are exact. We present them as such.

2. **Be honest where approximation begins**: After ReLU and the second layer, attribution is approximate. We say so explicitly.

3. **Do not overclaim**: The trace is not a causal explanation. It is not a fairness audit. It is not a complete account of the model's decision process. We make these limitations clear.

4. **Make it interactive**: The Streamlit app lets users explore different features and rows, building intuition through exploration.

## Relationship to Established Methods

| Method | What It Provides | Relationship to This Trace |
|--------|-----------------|---------------------------|
| SHAP | Game-theoretic feature attribution | More principled full-network attribution but computationally expensive |
| LIME | Local linear approximation | Similar in spirit (local explanation) but uses perturbation rather than weights |
| Integrated Gradients | Path-based gradient attribution | Principled attribution for differentiable models |
| This trace | Exact lineage + first-layer decomposition | Simpler, more transparent, but limited to first layer |

The trace system is not a replacement for these methods. It is a complement: it provides exact transparency at stages (data lineage, first-layer weights) that these methods typically skip or abstract away.
