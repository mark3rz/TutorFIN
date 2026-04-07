"""Add invitations table for PE admin → user invite flow.

Revision ID: 002
Revises: 001
Create Date: 2026-03-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS invitations (
            id           BIGSERIAL PRIMARY KEY,
            email        VARCHAR(255) NOT NULL,
            role         VARCHAR(50)  NOT NULL DEFAULT 'company_viewer',
            company_id   BIGINT       REFERENCES portfolio_company(id) ON DELETE SET NULL,
            invite_token VARCHAR(64)  NOT NULL UNIQUE,
            invited_by   BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
            expires_at   TIMESTAMP    NOT NULL,
            accepted_at  TIMESTAMP,
            created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_invitations_email      ON invitations (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invitations_token      ON invitations (invite_token)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invitations_status     ON invitations (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invitations_company_id ON invitations (company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invitations_invited_by ON invitations (invited_by)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS invitations CASCADE")
