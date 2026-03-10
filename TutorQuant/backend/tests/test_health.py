"""Smoke test for the /health endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_health_returns_200(client: AsyncClient) -> None:
    """The health-check endpoint should return HTTP 200 with status 'ok'."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok"}
