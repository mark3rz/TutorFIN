# Preprocessing and Feature Lineage

## Pipeline Overview

The preprocessing pipeline transforms raw data into a numeric feature matrix suitable for the neural network. Every transformation is tracked in a feature lineage system so that any transformed feature can be mapped back to its raw source column.

## Steps

### 1. Target Encoding

The target column `class` is encoded as:
- `good` -> 1 (positive class, lower risk)
- `bad` -> 0 (negative class, higher risk)

### 2. Train/Test Split

The data is split into training (80%) and test (20%) sets using stratified sampling to preserve the class balance. The random seed is fixed for reproducibility.

The test set is held out completely until evaluation. No preprocessing parameters are fit on test data.

### 3. Column Type Identification

Columns are classified as numeric or categorical based on the data dictionary (`src/data_dictionary.py`). This avoids relying on pandas dtype inference, which can misclassify integer-coded categorical features.

### 4. Preprocessing Transformers

A `ColumnTransformer` applies separate pipelines to numeric and categorical columns:

**Numeric pipeline:**
1. `SimpleImputer(strategy="median")` -- fills missing values with the training set median
2. `StandardScaler()` -- scales to mean=0, standard deviation=1 using training set statistics

**Categorical pipeline:**
1. `SimpleImputer(strategy="most_frequent")` -- fills missing values with the most common category
2. `OneHotEncoder(handle_unknown="infrequent_if_exist", sparse_output=False)` -- creates binary indicator columns for each category

The `ColumnTransformer` processes numeric columns first, then categorical columns. This ordering is preserved in the feature lineage.

### 5. Fit on Training Data Only

The preprocessor is fit exclusively on training data. Test data is transformed using the statistics learned from training. This prevents data leakage through preprocessing.

## Feature Lineage

The feature lineage system records the mapping from every raw column to every transformed feature. Each record contains:

| Field | Description |
|-------|-------------|
| source_column | Original raw column name |
| source_type | "numeric" or "categorical" |
| transformation_type | Description of the transformation |
| transformed_feature_name | Name after transformation |
| transformed_index | Position in the final feature matrix |
| notes | Additional context |

### Numeric Example

The raw column `age` produces one transformed feature:
- Source: `age` (numeric)
- Transformation: impute median + standard scaling
- Transformed name: `age`
- Transformed index: depends on column ordering (documented in lineage)
- Transformed value: `(raw_value - train_mean) / train_std`

### Categorical Example

The raw column `housing` with values `{rent, own, for free}` produces three one-hot features:
- `housing_rent` (index N): 1 if housing == "rent", else 0
- `housing_own` (index N+1): 1 if housing == "own", else 0
- `housing_for free` (index N+2): 1 if housing == "for free", else 0

## Saved Artifacts

The preprocessing step saves several artifacts:

| Artifact | Path | Purpose |
|----------|------|---------|
| Preprocessor | `models/preprocessors/preprocessor.joblib` | Fitted sklearn transformer |
| Feature lineage (JSON) | `data/metadata/feature_lineage.json` | Programmatic lineage access |
| Feature lineage (CSV) | `data/metadata/transformed_feature_map.csv` | Human-readable lineage |
| Processed train data | `data/processed/train_data.npz` | Transformed features + labels |
| Processed test data | `data/processed/test_data.npz` | Transformed features + labels |
| Column info | `data/metadata/column_info.json` | Column type lists |
| Dropped columns | `data/metadata/dropped_columns.csv` | Record of excluded columns |

## Why This Matters for Transparency

The feature lineage is the backbone of the trace system. When a user asks "what happened to `age` for row 5?", the system:

1. Looks up `age` in the lineage to find it maps to transformed index 2 (for example)
2. Reads the raw value from the original dataset
3. Retrieves the transformed value from position 2 in the processed data
4. Uses index 2 to extract the corresponding first-layer weights from the neural network

Without explicit lineage tracking, this mapping would be lost after preprocessing.
