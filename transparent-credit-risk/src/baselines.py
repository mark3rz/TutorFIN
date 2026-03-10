"""
Baseline model training for comparison against the neural network.

Trains logistic regression and XGBoost (or random forest as fallback)
on the same preprocessed data. These baselines serve two purposes:
1. Context for neural net performance (is the added complexity justified?)
2. Interpretability comparison (simpler models are more transparent)

Usage:
    python -m src.baselines
"""

import joblib

from src.config import load_config, resolve_path, ensure_dir
from src.preprocess import load_processed_data
from src.utils import setup_logging, set_seed


logger = setup_logging("baselines")


def train_logistic_regression(X_train, y_train, config: dict) -> object:
    """Train a logistic regression model.

    Logistic regression is the natural baseline for binary classification.
    It is a linear model, so its coefficients directly show the direction
    and magnitude of each feature's effect on the prediction. This makes
    it a useful interpretability reference.

    Args:
        X_train: Training feature matrix.
        y_train: Training labels.
        config: Configuration dictionary.

    Returns:
        Fitted LogisticRegression model.
    """
    from sklearn.linear_model import LogisticRegression

    logger.info("Training Logistic Regression...")

    model = LogisticRegression(
        max_iter=1000,
        random_state=config["project"]["random_seed"],
        solver="lbfgs",
    )
    model.fit(X_train, y_train)

    train_acc = model.score(X_train, y_train)
    logger.info(f"Logistic Regression training accuracy: {train_acc:.4f}")

    return model


def train_xgboost(X_train, y_train, config: dict) -> object:
    """Train an XGBoost classifier.

    XGBoost is a gradient boosting method that typically achieves strong
    performance on tabular data. It serves as an upper-bound baseline.
    If the neural net cannot match XGBoost, the added complexity may
    not be justified for this dataset.

    Args:
        X_train: Training feature matrix.
        y_train: Training labels.
        config: Configuration dictionary.

    Returns:
        Fitted XGBClassifier model, or None if XGBoost is not available.
    """
    try:
        from xgboost import XGBClassifier
    except ImportError:
        logger.warning(
            "XGBoost not installed. Install with: pip install xgboost\n"
            "Falling back to Random Forest."
        )
        return None

    logger.info("Training XGBoost...")

    model = XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=config["project"]["random_seed"],
        eval_metric="logloss",
        use_label_encoder=False,
    )
    model.fit(X_train, y_train)

    train_acc = model.score(X_train, y_train)
    logger.info(f"XGBoost training accuracy: {train_acc:.4f}")

    return model


def train_random_forest(X_train, y_train, config: dict) -> object:
    """Train a random forest classifier as XGBoost fallback.

    Args:
        X_train: Training feature matrix.
        y_train: Training labels.
        config: Configuration dictionary.

    Returns:
        Fitted RandomForestClassifier model.
    """
    from sklearn.ensemble import RandomForestClassifier

    logger.info("Training Random Forest (fallback for XGBoost)...")

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=config["project"]["random_seed"],
    )
    model.fit(X_train, y_train)

    train_acc = model.score(X_train, y_train)
    logger.info(f"Random Forest training accuracy: {train_acc:.4f}")

    return model


def train_baselines(config: dict = None) -> dict:
    """Train all baseline models and save them.

    Args:
        config: Configuration dictionary.

    Returns:
        Dictionary of model name to fitted model.
    """
    if config is None:
        config = load_config()

    set_seed(config["project"]["random_seed"])

    data = load_processed_data(config)
    X_train = data["X_train"]
    y_train = data["y_train"]

    model_dir = resolve_path(config["baselines"]["models_dir"])
    ensure_dir(model_dir)

    models = {}

    # Logistic Regression
    if config["baselines"]["run_logistic_regression"]:
        lr_model = train_logistic_regression(X_train, y_train, config)
        lr_path = model_dir / "logistic_regression.joblib"
        joblib.dump(lr_model, lr_path)
        logger.info(f"Saved logistic regression: {lr_path}")
        models["logistic_regression"] = lr_model

    # XGBoost (with random forest fallback)
    if config["baselines"]["run_xgboost"]:
        xgb_model = train_xgboost(X_train, y_train, config)
        if xgb_model is not None:
            xgb_path = model_dir / "xgboost.joblib"
            joblib.dump(xgb_model, xgb_path)
            logger.info(f"Saved XGBoost: {xgb_path}")
            models["xgboost"] = xgb_model
        else:
            rf_model = train_random_forest(X_train, y_train, config)
            rf_path = model_dir / "random_forest.joblib"
            joblib.dump(rf_model, rf_path)
            logger.info(f"Saved Random Forest: {rf_path}")
            models["random_forest"] = rf_model

    logger.info(f"Trained {len(models)} baseline model(s): {list(models.keys())}")
    return models


def main():
    """Train baseline models."""
    config = load_config()
    train_baselines(config)


if __name__ == "__main__":
    main()
