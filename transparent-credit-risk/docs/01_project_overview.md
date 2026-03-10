# Project Overview

## Research Question

How do we make a tabular neural network transparent enough to inspect, from raw input data to final prediction?

## Motivation

Most machine learning projects treat the model as a black box. Data goes in, predictions come out, and the pipeline between those two points is opaque. This project takes the opposite approach: it builds a binary classification neural network for credit risk and makes every step visible.

The goal is not to achieve state-of-the-art performance. The goal is to demonstrate that a tabular neural network can be made inspectable -- that a user can point to a specific feature like `age`, select a specific data row, and trace that feature's journey from its raw value through preprocessing, into the input tensor, through the first hidden layer, and out to the final prediction.

## What This Project Is

- A teaching tool for understanding how tabular neural networks process data
- A transparency framework that tracks data lineage and first-layer contributions
- A portfolio-grade research project with clean structure and honest documentation
- A reusable pipeline that could be adapted to other binary classification problems

## What This Project Is Not

- A production credit scoring system
- A fairness audit
- A complete mechanistic interpretation of a neural network
- A substitute for SHAP, LIME, or other established attribution methods

## Scope

This is a v1 project. It deliberately uses a single hidden layer, a well-known benchmark dataset, and straightforward preprocessing. These choices make the transparency framework possible: with one hidden layer, we can exactly decompose how each input feature contributes to each hidden neuron. With deeper architectures, this decomposition becomes approximate at best.

## Key Design Decisions

1. **One hidden layer** -- enables exact first-layer contribution decomposition
2. **German Credit dataset** -- has named features (including `age`), is publicly available, and is a realistic binary classification task
3. **sklearn preprocessing** -- provides named feature tracking through ColumnTransformer
4. **Manual PyTorch training loop** -- makes every optimization step visible
5. **Explicit interpretation warnings** -- the system never overclaims what the trace reveals

## Pipeline Steps

1. Download data from OpenML
2. Validate the raw dataset
3. Review features for leakage and governance concerns
4. Preprocess (impute, scale, encode) with lineage tracking
5. Train baseline models (logistic regression, XGBoost)
6. Train the PyTorch neural network with early stopping
7. Evaluate all models on held-out test data
8. Trace selected features through the pipeline
9. Explore results in the Streamlit app
