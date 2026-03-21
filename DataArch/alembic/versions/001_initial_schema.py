"""Initial schema — users, api_keys, ontology, pipeline_jobs, audit_log.

Revision ID: 001
Revises: None
Create Date: 2025-01-01 00:00:00.000000

NOTE: The portfolio_company table already exists in production (created by
pipeline/company.py). We use op.execute with IF NOT EXISTS so this migration
is safe to run against both fresh and existing databases.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── portfolio_company (may already exist) ────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_company (
            id          BIGSERIAL PRIMARY KEY,
            name        VARCHAR(255) NOT NULL UNIQUE,
            slug        VARCHAR(100) NOT NULL UNIQUE,
            sector      VARCHAR(255),
            acquisition_date TIMESTAMP,
            hold_period_years NUMERIC(4, 1),
            fund        VARCHAR(255),
            status      VARCHAR(50) DEFAULT 'active',
            notes       TEXT,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)

    # Create indexes only if they don't exist
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_portfolio_company_slug
            ON portfolio_company (slug)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_portfolio_company_status
            ON portfolio_company (status)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_portfolio_company_fund
            ON portfolio_company (fund)
    """)

    # ── users ────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="company_viewer"),
        sa.Column("company_id", sa.BigInteger, sa.ForeignKey("portfolio_company.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_company_id", "users", ["company_id"])

    # ── api_keys ─────────────────────────────────────────────────────────
    op.create_table(
        "api_keys",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key_hash", sa.String(255), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("last_used_at", sa.DateTime, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])

    # ── ontology_types ───────────────────────────────────────────────────
    op.create_table(
        "ontology_types",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("display_label", sa.String(100), nullable=False),
        sa.Column("display_color", sa.String(10), nullable=False, server_default="#6b6b7a"),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("classification_examples", sa.Text, nullable=True),
        sa.Column("is_entity_table", sa.Boolean, server_default="true", nullable=False),
        sa.Column("is_resolvable", sa.Boolean, server_default="true", nullable=False),
        sa.Column("sort_order", sa.SmallInteger, server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("fund_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_ontology_types_name", "ontology_types", ["name"])
    op.create_index("ix_ontology_types_fund_id", "ontology_types", ["fund_id"])
    op.create_index("ix_ontology_types_is_active", "ontology_types", ["is_active"])

    # ── ontology_type_fk_rules ───────────────────────────────────────────
    op.create_table(
        "ontology_type_fk_rules",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("child_type_id", sa.BigInteger, sa.ForeignKey("ontology_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_type_id", sa.BigInteger, sa.ForeignKey("ontology_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("column_name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("child_type_id", "column_name", name="uq_fk_rules_child_column"),
    )

    # ── ontology_type_attributes ─────────────────────────────────────────
    op.create_table(
        "ontology_type_attributes",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("ontology_type_id", sa.BigInteger, sa.ForeignKey("ontology_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attribute_name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_key_attribute", sa.Boolean, server_default="false", nullable=False),
        sa.Column("sql_type_hint", sa.String(50), nullable=True),
        sa.Column("sort_order", sa.SmallInteger, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("ontology_type_id", "attribute_name", name="uq_type_attributes"),
    )
    op.create_index("ix_ontology_type_attributes_type_id", "ontology_type_attributes", ["ontology_type_id"])

    # ── pipeline_jobs ────────────────────────────────────────────────────
    op.create_table(
        "pipeline_jobs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(36), unique=True, nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("status", sa.String(50), server_default="queued", nullable=False),
        sa.Column("company_id", sa.BigInteger, sa.ForeignKey("portfolio_company.id"), nullable=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("steps_json", JSON, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
    )
    op.create_index("ix_pipeline_jobs_job_id", "pipeline_jobs", ["job_id"])
    op.create_index("ix_pipeline_jobs_status", "pipeline_jobs", ["status"])
    op.create_index("ix_pipeline_jobs_company_id", "pipeline_jobs", ["company_id"])
    op.create_index("ix_pipeline_jobs_created_at", "pipeline_jobs", ["created_at"])

    # ── audit_log ────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("details", JSON, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("pipeline_jobs")
    op.drop_table("ontology_type_attributes")
    op.drop_table("ontology_type_fk_rules")
    op.drop_table("ontology_types")
    op.drop_table("api_keys")
    op.drop_table("users")
    # NOTE: We do NOT drop portfolio_company — it pre-existed this migration.
