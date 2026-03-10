# Transparent Credit Risk Classification with PyTorch

**Tracing a Tabular Neural Net from Raw Feature to Prediction**

A portfolio-grade research project that builds a binary credit risk classifier using PyTorch and makes the entire pipeline transparent. The signature feature is a trace system that follows a selected field (like `age`) from raw data through preprocessing, scaling, model input, first-layer weights, hidden-layer contributions, and final prediction output.

## Research Question

How do we make a tabular neural network transparent enough to inspect, from raw input data to final prediction?

## Why This Matters

Most ML pipelines are opaque. Data goes in, predictions come out, and the steps between are buried in library abstractions. This project takes the opposite approach: every transformation is tracked, every weight is accessible, and the system explicitly distinguishes exact computation from approximate attribution.

This is not about achieving state-of-the-art performance. It is about building a model you can actually understand.

## Dataset

**German Credit Dataset** (OpenML ID 31)
- 1,000 samples, 20 features (7 numeric, 13 categorical)
- Binary target: good (lower risk) vs. bad (higher risk)
- Key feature for demo: `age` (applicant age in years)

## Models

| Model | Purpose |
|-------|---------|
| **Neural Network** (PyTorch) | Single hidden layer (32 neurons), ReLU, dropout. Subject of the transparency trace. |
| **Logistic Regression** | Linear baseline. Interpretable by design. |
| **XGBoost** | Strong tabular baseline. Upper bound on expected performance. |

## Transparency Framework

The trace system follows a selected feature through seven stages:

| Stage | What It Shows | Exactness |
|-------|--------------|-----------|
| A. Raw Data | Original value from the dataset | Exact |
| B. Cleaning | Missing value status, imputation | Exact |
| C. Transformation | Scaling formula or encoding outcome | Exact |
| D. Model Input | Position in the input tensor | Exact |
| E. First Hidden Layer | Weights and per-neuron contributions | Exact (pre-ReLU) |
| F. Output | Predicted probability and class | Exact |
| G. Caveats | What this trace does and does not show | N/A |

The system is honest about its limits: first-layer decomposition is exact, but attribution through deeper layers is approximate. It says so explicitly.

## Repository Structure

```
transparent-credit-risk/
  README.md
  requirements.txt
  .gitignore
  configs/
    config.yaml                 # All pipeline settings
  data/
    raw/                        # Downloaded dataset
    processed/                  # Transformed features
    metadata/                   # Lineage, column info, checksums
  docs/
    01_project_overview.md
    02_dataset.md
    03_preprocessing.md
    04_modeling.md
    05_evaluation.md
    06_transparency.md
    07_limitations_next_steps.md
  app/
    streamlit_app.py            # Interactive transparency explorer
  src/
    config.py                   # Configuration loader
    utils.py                    # Logging, seeds, device selection
    data_download.py            # Fetch dataset from OpenML
    data_validation.py          # Sanity checks on raw data
    data_dictionary.py          # Column descriptions and types
    leakage_review.py           # Leakage and governance flags
    feature_lineage.py          # Raw-to-transformed feature mapping
    preprocess.py               # Preprocessing pipeline
    dataset.py                  # PyTorch Dataset class
    model.py                    # Neural network definition
    train.py                    # Training loop with early stopping
    baselines.py                # Logistic regression, XGBoost
    evaluate.py                 # Metrics, curves, model comparison
    predict.py                  # Single-row and batch prediction
    trace_feature.py            # Single-feature pipeline trace
    trace_prediction.py         # All-feature contribution summary
    run_pipeline.py             # End-to-end pipeline runner
  tests/
    test_preprocess.py
    test_feature_lineage.py
  models/
    trained/                    # Saved model checkpoints
    preprocessors/              # Fitted sklearn transformers
  outputs/
    figures/                    # ROC curves, training history, etc.
    tables/                     # Model comparison CSV
    traces/                     # Feature trace JSON files
    reports/                    # Error analysis
```

## Quick Start

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd transparent-credit-risk

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Run the Full Pipeline

```bash
python -m src.run_pipeline
```

This downloads the data, preprocesses it, trains all models, evaluates them, and runs a demo feature trace. Takes about 1-2 minutes.

### Run Individual Steps

```bash
# Download data
python -m src.data_download

# Validate data
python -m src.data_validation

# Run leakage review
python -m src.leakage_review

# Preprocess
python -m src.preprocess

# Train baselines
python -m src.baselines

# Train neural network
python -m src.train

# Evaluate all models
python -m src.evaluate

# Trace a feature
python -m src.trace_feature --feature age --row 0

# Trace all features for a prediction
python -m src.trace_prediction --row 0
```

### Launch the Streamlit App

```bash
streamlit run app/streamlit_app.py
```

### Run Tests

```bash
pytest tests/ -v
```

## Key Results

Results are generated by the pipeline and saved to `outputs/`. The model comparison table shows metrics for all models side by side. Training curves and ROC plots are saved as figures.

The neural network is unlikely to significantly outperform logistic regression or XGBoost on this small dataset. That is expected and documented honestly. The value is in the transparency framework, not raw performance.

## Transparency Feature

The Streamlit app is the main interface for exploring the trace system. It lets you:

- Select any raw feature (default: `age`)
- Select any test set row
- Walk through every pipeline stage visually
- See first-layer weights and contributions as charts
- View the final prediction with all caveats
- Compare all features' contributions for a single prediction
- Review model comparison metrics

*Screenshot placeholder: Run the app locally to explore the interface.*

## Limitations

- **Small dataset**: 1,000 rows limits generalization
- **First-layer attribution only**: Beyond the first hidden layer, attribution is approximate
- **No causal claims**: The trace shows correlation through the network, not causation
- **No fairness audit**: Governance-sensitive columns are flagged but not rigorously tested
- **Not production-ready**: This is a research and portfolio project

See `docs/07_limitations_next_steps.md` for a full discussion and planned improvements.

## Future Improvements

- SHAP integration for full-network attribution
- Counterfactual analysis (what if age were different?)
- Fairness metrics for protected subgroups
- Cost-sensitive training with the 5:1 cost matrix
- Larger dataset support (Taiwan Credit Card Default, 30K rows)

## License

This project is provided as-is for educational and portfolio purposes.
