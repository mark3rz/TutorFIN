"""
Streamlit Transparency Explorer for Credit Risk Classification.

This app is the main interactive interface for the transparency system.
It lets users select a feature and a data row, then walks through the
entire pipeline from raw data to model prediction, showing every
transformation and first-layer contribution along the way.

Sections:
1. Dataset Overview
2. Select Row and Feature
3. Raw to Transformed Trace
4. Neural Net Contribution Snapshot
5. Prediction Summary
6. All-Feature Contributions
7. Model Comparison
8. Interpretability Caveats

Usage:
    streamlit run app/streamlit_app.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import streamlit as st
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Add project root to path so we can import src modules
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from src.config import load_config, resolve_path
from src.data_dictionary import DATA_DICTIONARY, get_column_info
from src.feature_lineage import FeatureLineage
from src.preprocess import load_processed_data
from src.train import load_trained_model
from src.trace_feature import trace_feature
from src.trace_prediction import trace_all_features


# ---- Page Configuration ----
st.set_page_config(
    page_title="Credit Risk Transparency Explorer",
    page_icon="🔍",
    layout="wide",
)


@st.cache_data
def load_raw_data(config):
    """Load and cache the raw dataset."""
    raw_path = resolve_path(config["data"]["raw_path"])
    return pd.read_csv(raw_path)


@st.cache_resource
def load_model_and_data(config):
    """Load and cache the model and processed data."""
    model, checkpoint = load_trained_model(config)
    data = load_processed_data(config)
    lineage_path = resolve_path(config["preprocessing"]["lineage_path"])
    lineage = FeatureLineage.load_json(lineage_path)
    return model, data, lineage


def main():
    config = load_config(str(project_root / "configs" / "config.yaml"))

    # ---- Header ----
    st.title("Credit Risk Transparency Explorer")
    st.markdown(
        "Trace a selected feature from raw data through preprocessing, "
        "into the neural network, and to the final prediction. "
        "This tool demonstrates data lineage, mathematical transformation, "
        "and local model contribution -- not causal interpretation."
    )
    st.divider()

    # Load data
    try:
        raw_df = load_raw_data(config)
        model, data, lineage = load_model_and_data(config)
    except FileNotFoundError as e:
        st.error(
            f"Required files not found: {e}\n\n"
            "Run the pipeline first: `python -m src.run_pipeline`"
        )
        return

    X_test = data["X_test"]
    y_test = data["y_test"]
    test_indices = data["test_indices"]

    # ================================================================
    # SECTION 1: Dataset Overview
    # ================================================================
    with st.expander("1. Dataset Overview", expanded=False):
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Rows", len(raw_df))
            st.metric("Features", len(raw_df.columns) - 1)
        with col2:
            st.metric("Test Set Size", len(X_test))
            st.metric("Transformed Features", X_test.shape[1])
        with col3:
            positive_rate = (y_test == 1).mean()
            st.metric("Test Positive Rate", f"{positive_rate:.1%}")
            st.metric("Dataset", config["data"]["dataset_name"])

        st.markdown("**Sample of Raw Data:**")
        st.dataframe(raw_df.head(5), use_container_width=True)

    # ================================================================
    # SECTION 2: Select Row and Feature
    # ================================================================
    st.header("2. Select Row and Feature")

    col_left, col_right = st.columns(2)

    with col_left:
        # Feature selection
        source_columns = lineage.get_all_source_columns()
        default_feature = config["features"]["default_trace_feature"]
        default_idx = source_columns.index(default_feature) if default_feature in source_columns else 0

        selected_feature = st.selectbox(
            "Feature to trace:",
            source_columns,
            index=default_idx,
            help="Select a raw feature column to trace through the pipeline."
        )

        # Show feature info
        col_info = get_column_info(selected_feature)
        st.markdown(f"**Description:** {col_info['description']}")
        st.markdown(f"**Type:** {col_info['source_type']}")
        if col_info.get("notes"):
            st.info(col_info["notes"])

    with col_right:
        # Row selection
        row_index = st.number_input(
            "Test set row index:",
            min_value=0,
            max_value=len(X_test) - 1,
            value=0,
            help="Select a row from the test set to trace."
        )

        original_row_idx = test_indices[row_index]
        st.markdown(f"**Original dataset row:** {original_row_idx}")

        # Show the raw row
        raw_row = raw_df.iloc[original_row_idx]
        true_label = config["data"]["positive_label"] if y_test[row_index] == 1 else config["data"]["negative_label"]
        st.markdown(f"**True label:** {true_label}")

    st.divider()

    # ================================================================
    # SECTION 3: Raw to Transformed Trace
    # ================================================================
    st.header("3. Raw to Transformed Trace")

    # Run the trace
    trace = trace_feature(
        selected_feature, row_index,
        config=config, model=model, data=data, lineage=lineage,
    )

    # Stage A: Raw Data
    st.subheader("A. Raw Data")
    raw_data = trace["raw_data"]
    col_a1, col_a2 = st.columns(2)
    with col_a1:
        st.markdown(f"**Column:** `{raw_data['column_name']}`")
        st.markdown(f"**Raw Value:** `{raw_data['raw_value']}`")
    with col_a2:
        st.markdown(f"**Data Type:** {raw_data['source_type']}")
        st.markdown(f"**Dataset Row:** {raw_data['original_row_index']}")

    # Stage B: Cleaning
    st.subheader("B. Cleaning / Typing")
    cleaning = trace["cleaning"]
    if cleaning["was_missing"]:
        st.warning("Value was missing in the raw data and was imputed during preprocessing.")
    else:
        st.success("Value was present. No imputation needed.")

    # Stage C: Transformation
    st.subheader("C. Transformation")
    trans = trace["transformation"]
    st.markdown(f"**Transformation:** {trans['transformation_type']}")
    st.markdown(f"**Number of transformed features:** {trans['n_transformed_features']}")

    # Show transformation details in a table
    trans_df = pd.DataFrame({
        "Transformed Name": trans["transformed_feature_names"],
        "Index in Input Matrix": trans["transformed_indices"],
        "Transformed Value": trans["transformed_values"],
    })
    st.dataframe(trans_df, use_container_width=True, hide_index=True)

    # Stage D: Neural Net Input
    st.subheader("D. Neural Network Input")
    model_input = trace["model_input"]
    st.markdown(
        f"The input vector has **{model_input['input_vector_length']}** elements. "
        f"The traced feature occupies position(s) **{model_input['feature_positions']}**."
    )

    # Show a visual snippet of the input vector
    x_full = X_test[row_index]
    feature_indices = set(trans["transformed_indices"])

    # Create a visualization of the input vector highlighting the traced feature
    fig_input, ax_input = plt.subplots(figsize=(12, 1.5))
    colors = ["#3498db" if i in feature_indices else "#bdc3c7" for i in range(len(x_full))]
    ax_input.bar(range(len(x_full)), np.abs(x_full), color=colors, width=1.0, edgecolor="none")
    ax_input.set_xlabel("Feature Index")
    ax_input.set_ylabel("|Value|")
    ax_input.set_title(
        f"Input Vector (blue = {selected_feature}, gray = other features)",
        fontsize=10,
    )
    ax_input.set_xlim(-0.5, len(x_full) - 0.5)
    plt.tight_layout()
    st.pyplot(fig_input)
    plt.close(fig_input)

    st.divider()

    # ================================================================
    # SECTION 4: Neural Net Contribution Snapshot
    # ================================================================
    st.header("4. Neural Net Contribution Snapshot")

    hidden = trace["first_hidden_layer"]
    hidden_size = hidden["hidden_size"]
    contributions = hidden["contributions"]["per_hidden_neuron"]
    pre_relu = hidden["pre_relu_activations"]
    post_relu = hidden["post_relu_activations"]

    st.markdown(
        f"The hidden layer has **{hidden_size}** neurons. Below are the "
        f"contributions of **{selected_feature}** to each hidden neuron."
    )

    # Plot contributions
    fig_contrib, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 4))

    # Left: Feature contributions to hidden neurons
    neuron_indices = list(range(hidden_size))
    colors_contrib = ["#e74c3c" if c < 0 else "#2ecc71" for c in contributions]
    ax1.bar(neuron_indices, contributions, color=colors_contrib)
    ax1.set_xlabel("Hidden Neuron Index")
    ax1.set_ylabel("Contribution (W * x)")
    ax1.set_title(f"Contribution of '{selected_feature}' to Each Hidden Neuron")
    ax1.axhline(y=0, color="black", linewidth=0.5)
    ax1.grid(True, axis="y", alpha=0.3)

    # Right: Pre-ReLU vs Post-ReLU activations
    x_pos = np.arange(hidden_size)
    width = 0.35
    ax2.bar(x_pos - width/2, pre_relu, width, label="Pre-ReLU", alpha=0.7, color="#3498db")
    ax2.bar(x_pos + width/2, post_relu, width, label="Post-ReLU", alpha=0.7, color="#e67e22")
    ax2.set_xlabel("Hidden Neuron Index")
    ax2.set_ylabel("Activation Value")
    ax2.set_title("Hidden Layer Activations (All Features)")
    ax2.legend()
    ax2.grid(True, axis="y", alpha=0.3)

    plt.tight_layout()
    st.pyplot(fig_contrib)
    plt.close(fig_contrib)

    # Show weights table
    with st.expander("View raw weights for this feature"):
        weights = hidden["weights"]["values"]
        weights_df = pd.DataFrame(
            weights,
            columns=trans["transformed_feature_names"],
            index=[f"Neuron {i}" for i in range(hidden_size)],
        )
        st.dataframe(weights_df, use_container_width=True)

    st.info(
        "These contributions show how this feature affects each hidden neuron "
        "**before** the ReLU activation. After ReLU, neurons with negative "
        "pre-activations are zeroed out. The final prediction depends on the "
        "combined effect of all features through both layers, making per-feature "
        "attribution beyond the first layer approximate."
    )

    st.divider()

    # ================================================================
    # SECTION 5: Prediction Summary
    # ================================================================
    st.header("5. Prediction Summary")

    output = trace["output"]

    col_p1, col_p2, col_p3 = st.columns(3)
    with col_p1:
        st.metric("Predicted Probability", f"{output['probability']:.4f}")
    with col_p2:
        st.metric("Predicted Class", output["predicted_label"])
    with col_p3:
        if output["correct"]:
            st.metric("Correct?", "Yes", delta="Match")
        else:
            st.metric("Correct?", "No", delta="Mismatch", delta_color="inverse")

    st.markdown(
        f"**Logit (raw output):** {output['logit']:.4f} "
        f"(sigmoid maps this to probability {output['probability']:.4f})"
    )
    st.markdown(f"**True label:** {output['true_label']}")

    st.divider()

    # ================================================================
    # SECTION 6: All-Feature Contributions
    # ================================================================
    st.header("6. All-Feature Contributions for This Row")

    full_trace = trace_all_features(
        row_index, config=config, model=model, data=data, lineage=lineage,
    )

    summaries = full_trace["feature_summaries"]

    # Bar chart of contributions
    top_n = min(15, len(summaries))
    top_summaries = summaries[:top_n]

    names = [s["source_column"] for s in top_summaries][::-1]
    signed_vals = [s["total_signed_contribution"] for s in top_summaries][::-1]

    fig_all, ax_all = plt.subplots(figsize=(10, max(5, top_n * 0.35)))
    colors_all = ["#e74c3c" if v < 0 else "#2ecc71" for v in signed_vals]
    ax_all.barh(names, signed_vals, color=colors_all)
    ax_all.set_xlabel("Total Signed First-Layer Contribution")
    ax_all.set_title(f"Top {top_n} Feature Contributions (Row {row_index})")
    ax_all.axvline(x=0, color="black", linewidth=0.5)
    ax_all.grid(True, axis="x", alpha=0.3)
    plt.tight_layout()
    st.pyplot(fig_all)
    plt.close(fig_all)

    # Highlight selected feature in the ranking
    for i, s in enumerate(summaries):
        if s["source_column"] == selected_feature:
            st.markdown(
                f"**{selected_feature}** ranks **#{i+1}** out of "
                f"{len(summaries)} features by absolute contribution "
                f"(signed: {s['total_signed_contribution']:.4f}, "
                f"absolute: {s['total_absolute_contribution']:.4f})."
            )
            break

    with st.expander("View full contribution table"):
        contrib_df = pd.DataFrame([
            {
                "Feature": s["source_column"],
                "Type": s["source_type"],
                "Transformed Cols": s["n_transformed_features"],
                "Signed Contribution": round(s["total_signed_contribution"], 4),
                "Absolute Contribution": round(s["total_absolute_contribution"], 4),
            }
            for s in summaries
        ])
        st.dataframe(contrib_df, use_container_width=True, hide_index=True)

    st.divider()

    # ================================================================
    # SECTION 7: Model Comparison
    # ================================================================
    st.header("7. Model Comparison")

    comparison_path = resolve_path(config["evaluation"]["tables_dir"]) / "model_comparison.csv"
    if comparison_path.exists():
        comparison_df = pd.read_csv(comparison_path)
        st.dataframe(comparison_df, use_container_width=True, hide_index=True)

        # Bar chart
        fig_comp, ax_comp = plt.subplots(figsize=(10, 4))
        metrics_to_plot = ["ROC-AUC", "F1", "Precision", "Recall"]
        available = [m for m in metrics_to_plot if m in comparison_df.columns]
        x = np.arange(len(available))
        width = 0.8 / len(comparison_df)

        for i, (_, row) in enumerate(comparison_df.iterrows()):
            values = [row[m] for m in available]
            ax_comp.bar(x + i * width, values, width, label=row["Model"])

        ax_comp.set_xticks(x + width * (len(comparison_df) - 1) / 2)
        ax_comp.set_xticklabels(available)
        ax_comp.set_ylabel("Score")
        ax_comp.set_title("Model Comparison")
        ax_comp.legend()
        ax_comp.set_ylim(0, 1)
        ax_comp.grid(True, axis="y", alpha=0.3)
        plt.tight_layout()
        st.pyplot(fig_comp)
        plt.close(fig_comp)
    else:
        st.info("Model comparison data not found. Run evaluation first.")

    st.divider()

    # ================================================================
    # SECTION 8: Interpretability Caveats
    # ================================================================
    st.header("8. Interpretability Caveats")

    warnings = trace["interpretation_warning"]["warnings"]
    for warning in warnings:
        st.markdown(f"- {warning}")

    st.warning(
        "This tool provides data lineage and first-layer contribution analysis. "
        "It is not a causal explanation, a fairness audit, or a complete account "
        "of how the neural network makes predictions. For production model "
        "governance, additional tools and processes are needed."
    )

    # ---- Footer ----
    st.divider()
    st.caption(
        "Transparent Credit Risk Classification with PyTorch | "
        "Built as a portfolio research project demonstrating neural network transparency."
    )


if __name__ == "__main__":
    main()
