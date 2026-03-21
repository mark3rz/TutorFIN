"""
models.py — SQLAlchemy ORM models for DataArch.AI.

These models serve as the schema source of truth for Alembic migrations.
Existing pipeline code still uses raw SQL queries; these models are for
migration management and new auth/ontology features.
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ── User Roles ────────────────────────────────────────────────────────────────

class UserRole:
    PE_ADMIN = "pe_admin"
    COMPANY_ADMIN = "company_admin"
    COMPANY_VIEWER = "company_viewer"

    ALL = [PE_ADMIN, COMPANY_ADMIN, COMPANY_VIEWER]


# ── Users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.COMPANY_VIEWER)
    company_id = Column(BigInteger, ForeignKey("portfolio_company.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_company_id", "company_id"),
    )


# ── API Keys ──────────────────────────────────────────────────────────────────

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="api_keys")

    __table_args__ = (
        Index("ix_api_keys_user_id", "user_id"),
    )


# ── Ontology Types ────────────────────────────────────────────────────────────

class OntologyTypeModel(Base):
    """Database-backed ontology type definitions.

    Replaces the hardcoded OntologyType enum in pipeline/ontology/schema.py.
    """
    __tablename__ = "ontology_types"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_label = Column(String(100), nullable=False)
    display_color = Column(String(10), nullable=False, default="#6b6b7a")
    icon = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    # Classification prompt: examples of raw names that map to this type
    classification_examples = Column(Text, nullable=True)
    # Whether this type gets a PostgreSQL entity table
    is_entity_table = Column(Boolean, default=True, nullable=False)
    # Whether entity resolution / deduplication applies
    is_resolvable = Column(Boolean, default=True, nullable=False)
    sort_order = Column(SmallInteger, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    # Per-fund scoping (nullable = global/shared)
    fund_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    fk_rules_as_child = relationship(
        "OntologyTypeFkRule",
        foreign_keys="OntologyTypeFkRule.child_type_id",
        back_populates="child_type",
        cascade="all, delete-orphan",
    )
    fk_rules_as_parent = relationship(
        "OntologyTypeFkRule",
        foreign_keys="OntologyTypeFkRule.parent_type_id",
        back_populates="parent_type",
    )
    attributes = relationship(
        "OntologyTypeAttribute",
        back_populates="ontology_type",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_ontology_types_fund_id", "fund_id"),
        Index("ix_ontology_types_is_active", "is_active"),
    )


# ── Ontology FK Rules ─────────────────────────────────────────────────────────

class OntologyTypeFkRule(Base):
    """Foreign key relationships between ontology types.

    Replaces the hardcoded FK_RULES dict in pipeline/schema_generator.py.
    """
    __tablename__ = "ontology_type_fk_rules"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    child_type_id = Column(
        BigInteger,
        ForeignKey("ontology_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_type_id = Column(
        BigInteger,
        ForeignKey("ontology_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    column_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    child_type = relationship("OntologyTypeModel", foreign_keys=[child_type_id], back_populates="fk_rules_as_child")
    parent_type = relationship("OntologyTypeModel", foreign_keys=[parent_type_id], back_populates="fk_rules_as_parent")

    __table_args__ = (
        UniqueConstraint("child_type_id", "column_name", name="uq_fk_rules_child_column"),
    )


# ── Ontology Type Attributes ─────────────────────────────────────────────────

class OntologyTypeAttribute(Base):
    """Expected attributes per ontology type.

    Used for schema generation hints and classifier prompts.
    """
    __tablename__ = "ontology_type_attributes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    ontology_type_id = Column(
        BigInteger,
        ForeignKey("ontology_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    attribute_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_key_attribute = Column(Boolean, default=False, nullable=False)
    sql_type_hint = Column(String(50), nullable=True)
    sort_order = Column(SmallInteger, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ontology_type = relationship("OntologyTypeModel", back_populates="attributes")

    __table_args__ = (
        UniqueConstraint("ontology_type_id", "attribute_name", name="uq_type_attributes"),
        Index("ix_ontology_type_attributes_type_id", "ontology_type_id"),
    )


# ── Pipeline Jobs ─────────────────────────────────────────────────────────────

class PipelineJobModel(Base):
    """Persistent pipeline job state.

    Replaces the in-memory _jobs dict in pipeline/pipeline_runner.py.
    (Full migration to this model happens in v0.8.1 with Celery.)
    """
    __tablename__ = "pipeline_jobs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    job_id = Column(String(36), unique=True, nullable=False, index=True)
    filename = Column(String(500), nullable=False)
    status = Column(String(50), default="queued", nullable=False)
    company_id = Column(BigInteger, ForeignKey("portfolio_company.id"), nullable=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    steps_json = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_pipeline_jobs_status", "status"),
        Index("ix_pipeline_jobs_company_id", "company_id"),
        Index("ix_pipeline_jobs_created_at", "created_at"),
    )


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("ix_audit_log_user_id", "user_id"),
        Index("ix_audit_log_action", "action"),
    )


# ── Portfolio Company (mirror of existing table for Alembic awareness) ────────
# NOTE: This table already exists in production, created by pipeline/company.py.
# We define it here so Alembic can track it, but the initial migration will NOT
# create it — we use `CREATE TABLE IF NOT EXISTS` semantics.

class PortfolioCompanyModel(Base):
    __tablename__ = "portfolio_company"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    sector = Column(String(255), nullable=True)
    acquisition_date = Column(DateTime, nullable=True)
    hold_period_years = Column(Numeric(4, 1), nullable=True)
    fund = Column(String(255), nullable=True)
    status = Column(String(50), default="active")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_portfolio_company_status", "status"),
        Index("ix_portfolio_company_fund", "fund"),
    )
