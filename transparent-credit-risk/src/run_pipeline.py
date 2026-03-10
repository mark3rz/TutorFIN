"""
End-to-end pipeline runner.

Executes the full pipeline in order:
1. Download data
2. Validate data
3. Run leakage review
4. Preprocess data
5. Train baselines
6. Train neural network
7. Evaluate all models
8. Run feature trace demo

This script is the single entry point for reproducing the entire project.

Usage:
    python -m src.run_pipeline
"""

from src.config import load_config
from src.utils import setup_logging, set_seed


logger = setup_logging("pipeline")


def run_full_pipeline():
    """Execute the complete pipeline from data download to evaluation."""
    config = load_config()
    set_seed(config["project"]["random_seed"])

    logger.info("=" * 70)
    logger.info("TRANSPARENT CREDIT RISK CLASSIFICATION PIPELINE")
    logger.info("=" * 70)

    # Step 1: Download data
    logger.info("\n[1/8] Downloading data...")
    from src.data_download import main as download_main
    download_main()

    # Step 2: Validate data
    logger.info("\n[2/8] Validating data...")
    from src.data_validation import main as validate_main
    validate_main()

    # Step 3: Leakage review
    logger.info("\n[3/8] Running leakage review...")
    from src.leakage_review import main as leakage_main
    leakage_main()

    # Step 4: Preprocess
    logger.info("\n[4/8] Preprocessing data...")
    from src.preprocess import main as preprocess_main
    preprocess_main()

    # Step 5: Train baselines
    logger.info("\n[5/8] Training baseline models...")
    from src.baselines import main as baselines_main
    baselines_main()

    # Step 6: Train neural network
    logger.info("\n[6/8] Training neural network...")
    from src.train import main as train_main
    train_main()

    # Step 7: Evaluate all models
    logger.info("\n[7/8] Evaluating all models...")
    from src.evaluate import main as evaluate_main
    evaluate_main()

    # Step 8: Run feature trace demo
    logger.info("\n[8/8] Running feature trace demo...")
    from src.trace_feature import trace_feature, print_trace_summary, save_trace
    from src.config import resolve_path

    default_feature = config["features"]["default_trace_feature"]
    trace = trace_feature(default_feature, row_index=0, config=config)
    print_trace_summary(trace)

    traces_dir = resolve_path(config["evaluation"]["traces_dir"])
    save_trace(trace, traces_dir / f"trace_{default_feature}_row0.json")

    logger.info("\n" + "=" * 70)
    logger.info("PIPELINE COMPLETE")
    logger.info("=" * 70)
    logger.info("\nKey outputs:")
    logger.info("  Data:          data/raw/, data/processed/")
    logger.info("  Metadata:      data/metadata/")
    logger.info("  Models:        models/trained/")
    logger.info("  Preprocessor:  models/preprocessors/")
    logger.info("  Figures:       outputs/figures/")
    logger.info("  Tables:        outputs/tables/")
    logger.info("  Traces:        outputs/traces/")
    logger.info("\nNext steps:")
    logger.info("  Run the Streamlit app:  streamlit run app/streamlit_app.py")
    logger.info("  Trace a feature:        python -m src.trace_feature --feature age --row 5")
    logger.info("  Trace a prediction:     python -m src.trace_prediction --row 5")


def main():
    run_full_pipeline()


if __name__ == "__main__":
    main()
