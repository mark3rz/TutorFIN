# Dataset Selection and Structure

## Chosen Dataset

**German Credit Dataset (credit-g)**
- Source: OpenML, Dataset ID 31
- Original source: UCI Machine Learning Repository (Statlog German Credit Data)
- Rows: 1,000
- Features: 20 (7 numeric, 13 categorical)
- Target: `class` (binary: "good" or "bad" credit risk)

## Why This Dataset

The German Credit dataset was selected for several reasons:

1. **Named features**: Unlike the Australian Credit dataset (which anonymizes all column names), the German Credit dataset has meaningful feature names like `age`, `credit_amount`, and `housing`. This is essential for the transparency demo.

2. **Mixed types**: The dataset includes both numeric features (age, credit amount, duration) and categorical features (housing, employment, purpose). This exercises both scaling and one-hot encoding in the preprocessing pipeline.

3. **Intuitive trace target**: The `age` column is immediately understandable and makes for a compelling transparency walkthrough.

4. **Binary classification**: The good/bad credit risk framing maps directly to the binary classification task.

5. **Well-documented**: Decades of published research use this dataset, providing context for expected performance ranges.

## Alternatives Considered

| Dataset | Rows | Pros | Cons | Decision |
|---------|------|------|------|----------|
| German Credit (OpenML 31) | 1,000 | Named features, age column, mixed types | Small, no missing values | **Selected** |
| Australian Credit (OpenML 29) | 690 | Has missing values | Anonymized columns (A1, A2, ...) | Rejected: no interpretable features |
| Taiwan Credit Card Default | 30,000 | Large, real-world | Less feature diversity, class imbalance | Backup for v2 |

## Feature Summary

### Numeric Features (7)
| Feature | Description | Range |
|---------|-------------|-------|
| duration | Credit duration in months | Positive integers |
| credit_amount | Credit amount (DM) | Positive values |
| installment_commitment | Installment rate (% of income) | 1-4 |
| residence_since | Years at current residence | 1-4 |
| age | Applicant age in years | 19-75 |
| existing_credits | Number of existing credits | 1-4 |
| num_dependents | Number of dependents | 1-2 |

### Categorical Features (13)
| Feature | Categories | Notes |
|---------|-----------|-------|
| checking_status | 4 | Ordinal in nature |
| credit_history | 5 | Key predictor |
| purpose | 11 | High cardinality |
| savings_status | 5 | Ordinal in nature |
| employment | 5 | Ordinal in nature |
| personal_status | 4 | **Governance flag**: encodes gender |
| other_parties | 3 | |
| property_magnitude | 4 | |
| other_payment_plans | 3 | |
| housing | 3 | |
| job | 4 | |
| own_telephone | 2 | |
| foreign_worker | 2 | **Governance flag**: ethically sensitive |

## Target Variable

- Column: `class`
- Values: `good` (700 samples, 70%) and `bad` (300 samples, 30%)
- Encoding: `good` -> 1 (lower risk), `bad` -> 0 (higher risk)
- Class imbalance: Moderate (70/30 split). Not severe enough to require specialized sampling, but enough that accuracy alone is misleading.

## Missing Values

The German Credit dataset has no missing values in the OpenML version. The preprocessing pipeline includes imputation logic anyway, both for correctness if the dataset changes and as a pedagogical demonstration of the pattern.

## Governance Concerns

Two columns are flagged for governance review:

1. **personal_status**: Encodes both gender and marital status in a single field. Using gender as a credit risk feature is legally restricted in many jurisdictions (e.g., ECOA in the United States). This column is kept in the model for demonstration purposes but is explicitly flagged.

2. **foreign_worker**: Immigration or nationality status is a protected class in many legal frameworks. Using it for credit decisions raises significant ethical and legal concerns. Flagged for review.

These columns are not dropped in v1 because the project is educational, not deployed. The leakage review artifact (`data/metadata/leakage_review.csv`) documents the flags.

## Cost Matrix

The original German Credit dataset defines an asymmetric cost matrix:
- Misclassifying a bad risk as good costs 5 units
- Misclassifying a good risk as bad costs 1 unit

This reflects the reality that approving a defaulting borrower is more costly than rejecting a creditworthy one. The current pipeline uses standard metrics rather than cost-sensitive learning, but this cost structure is documented for context.
