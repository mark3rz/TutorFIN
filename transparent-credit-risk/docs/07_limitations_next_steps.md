# Limitations and Next Steps

## Current Limitations

### Dataset

- **Small sample size**: 1,000 rows is small by modern standards. Results may not generalize to larger datasets.
- **No missing values**: The German Credit dataset is clean, so the imputation pipeline is exercised but not stress-tested.
- **Historical data**: The dataset reflects credit practices from 1990s Germany. Feature distributions and relationships may not represent current lending.
- **Governance concerns**: The `personal_status` and `foreign_worker` columns are ethically sensitive. They are flagged but not dropped in v1.

### Model

- **Single hidden layer**: The architecture is chosen for transparency, not for performance. Deeper networks would likely not improve results on this small dataset but could on larger ones.
- **No hyperparameter tuning**: The hidden size, learning rate, and other parameters are set to reasonable defaults. Systematic tuning (grid search, Bayesian optimization) is deferred.
- **No class weighting**: The 70/30 class imbalance is moderate but not addressed through class weights or cost-sensitive learning.

### Transparency

- **First-layer only**: The exact decomposition only works for the first hidden layer. Attribution through deeper layers requires methods like SHAP or integrated gradients.
- **No counterfactual analysis**: The trace shows what happens for a given input, not what would change if a feature were different.
- **No fairness analysis**: The trace is not a fairness audit. Population-level fairness metrics (disparate impact, equalized odds) are not computed.
- **Single-row focus**: Each trace examines one row. Aggregate patterns across many rows are not analyzed.

### Engineering

- **No CI/CD**: No automated testing pipeline beyond local pytest.
- **No containerization**: No Docker setup for reproducible environments.
- **No experiment tracking**: No MLflow, Weights & Biases, or similar integration.

## Next Steps for v2

### Higher Priority

1. **SHAP integration**: Add SHAP values for full-network attribution and compare them to first-layer contributions.
2. **Counterfactual analysis**: For a selected row, show how the prediction changes when the traced feature is perturbed.
3. **Fairness metrics**: Compute disparate impact and equalized odds for `personal_status` and `foreign_worker` subgroups.
4. **Cost-sensitive training**: Use the 5:1 cost matrix from the original dataset to weight the loss function.
5. **Hyperparameter tuning**: Use cross-validation to find better parameters.

### Medium Priority

6. **Larger dataset**: Swap in the Taiwan Credit Card Default dataset (30,000 rows) to test scalability.
7. **Multiple hidden layers**: Add a two-layer variant and compare transparency capabilities.
8. **Experiment tracking**: Integrate MLflow for tracking runs and comparing experiments.
9. **Docker**: Add a Dockerfile for reproducible environment setup.
10. **Notebook tutorials**: Add Jupyter notebooks with step-by-step walkthroughs.

### Lower Priority

11. **Feature engineering**: Explore interaction features or binned numeric features.
12. **Ensemble methods**: Compare the neural net to ensembles of neural nets.
13. **API endpoint**: Wrap the model in a Flask or FastAPI endpoint.
14. **Batch monitoring**: Add monitoring for prediction drift over time.

## What Would Make This Production-Ready

This project is a research and portfolio artifact, not a production system. Bridging the gap would require:

- Regulatory review of features (especially protected classes)
- Adverse action explanation capability (why was an applicant denied?)
- Model validation by independent reviewers
- Monitoring and retraining infrastructure
- Audit trail for all model decisions
- Compliance with applicable regulations (ECOA, FCRA, GDPR, etc.)
- Stress testing across demographic subgroups
- Documentation meeting SR 11-7 or equivalent model risk management standards

These requirements are beyond the scope of v1 but worth naming explicitly to set honest expectations.
