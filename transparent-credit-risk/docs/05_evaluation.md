# Evaluation and Model Comparison

## Metrics

The evaluation uses multiple metrics because no single metric captures all aspects of binary classification performance, especially with class imbalance.

### ROC-AUC (Primary Metric)

Area Under the Receiver Operating Characteristic Curve. Measures the model's ability to rank positive examples higher than negative examples across all possible classification thresholds. A random classifier scores 0.5; a perfect classifier scores 1.0.

ROC-AUC is threshold-independent, which makes it useful for comparing models without committing to a specific decision threshold.

### Accuracy

The fraction of predictions that are correct. With a 70/30 class split, a model that always predicts "good" would achieve 70% accuracy. This makes accuracy a weak metric for this dataset.

### Precision

Of all predictions labeled "good" (positive), what fraction are truly good? High precision means few false positives (fewer bad risks approved).

### Recall

Of all truly good risks, what fraction did the model correctly identify? High recall means few false negatives (fewer good risks rejected).

### F1 Score

The harmonic mean of precision and recall. Useful as a single-number summary that balances both concerns.

### Confusion Matrix

A 2x2 table showing:
- True Positives: correctly predicted good
- True Negatives: correctly predicted bad
- False Positives: predicted good but actually bad (costly in credit risk)
- False Negatives: predicted bad but actually good (lost business)

## Why Accuracy Alone Is Insufficient

With 70% of the dataset being "good" credit risks, a model that always predicts "good" achieves 70% accuracy. This is misleading because the model would approve every applicant, including all bad risks. The precision, recall, and ROC-AUC metrics reveal whether the model actually distinguishes between good and bad risks.

## Credit Risk Tradeoffs

In credit risk, false positives (approving a bad risk) are typically more costly than false negatives (rejecting a good risk). The original German Credit dataset assigns a 5:1 cost ratio. This means:

- Higher precision is more valuable than higher recall in this domain
- A model that is conservative (rejects some good risks) may be preferable to one that is aggressive (approves some bad risks)
- The threshold choice (probability cutoff for "good" vs "bad") should reflect this asymmetry

The current pipeline uses the standard 0.5 threshold. A production system would optimize the threshold based on the cost matrix.

## Error Analysis

The evaluation includes an error analysis that examines:
- How many false positives and false negatives the neural network produces
- The predicted probability distribution for misclassified samples
- Whether misclassifications tend to be high-confidence or borderline

This analysis is saved to `outputs/reports/error_analysis.json`.

## Visualizations

| Figure | Path | Shows |
|--------|------|-------|
| ROC curves | `outputs/figures/roc_curves.png` | ROC curves for all models |
| PR curves | `outputs/figures/precision_recall_curves.png` | Precision-recall tradeoffs |
| Training history | `outputs/figures/training_history.png` | Loss and accuracy over epochs |
| Confusion matrices | `outputs/figures/confusion_matrices.png` | Prediction breakdown per model |

## Is the Neural Net Justified?

This is the central evaluation question. If the neural network does not meaningfully outperform logistic regression on this dataset, the added complexity may not be justified purely on performance grounds.

However, the neural network's purpose in this project is pedagogical and structural: it demonstrates how a non-linear model processes tabular data, and it provides a subject for the transparency framework. Performance parity with simpler models is acceptable given these goals.

The model comparison table (`outputs/tables/model_comparison.csv`) provides the data for this assessment.
