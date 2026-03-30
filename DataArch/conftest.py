"""
conftest.py — Shared pytest fixtures for DataArch.AI tests.

Provides auth_headers fixtures that generate valid JWT tokens so that
protected API endpoints can be called in tests without a real database user.
"""
import pytest
from auth import create_access_token


@pytest.fixture
def auth_headers():
    """Authorization headers for a pe_admin test user (full access)."""
    token = create_access_token(
        user_id=1,
        email="test-admin@dataarch.ai",
        role="pe_admin",
        company_id=None,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def company_user_headers():
    """Authorization headers for a company_admin test user scoped to company 1."""
    token = create_access_token(
        user_id=2,
        email="test-company@dataarch.ai",
        role="company_admin",
        company_id=1,
    )
    return {"Authorization": f"Bearer {token}"}
