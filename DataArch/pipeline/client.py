"""
pipeline/client.py — Shared Anthropic client factory for DataArch.AI.

Single source of truth for creating the Anthropic client. All pipeline
modules that need Claude should import get_anthropic_client() from here
instead of constructing their own client instances.

Two clients are provided:
  - get_anthropic_client()       → anthropic.Anthropic (sync, for pipeline threads)
  - get_anthropic_async_client() → anthropic.AsyncAnthropic (async, for FastAPI routes)

Usage (sync):
    from pipeline.client import get_anthropic_client
    client = get_anthropic_client()

Usage (async):
    from pipeline.client import get_anthropic_async_client
    client = get_anthropic_async_client()
    response = await client.messages.create(...)
"""

import anthropic
import config

_client: anthropic.Anthropic | None = None
_async_client: anthropic.AsyncAnthropic | None = None


def _check_api_key() -> str:
    """Validate and return the API key, raising EnvironmentError if missing."""
    if not config.ANTHROPIC_API_KEY:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key."
        )
    return config.ANTHROPIC_API_KEY


def get_anthropic_client() -> anthropic.Anthropic:
    """
    Return a shared synchronous Anthropic client, creating it on first call.

    Used by:
      - pipeline/llm.py          (entity extraction in pipeline threads)
      - pipeline/ai_analyst.py   (NL-to-SQL, wrapped in run_in_executor by routes)
      - pipeline/ontology/mapper.py

    Raises:
        EnvironmentError: if ANTHROPIC_API_KEY is not set.
    """
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=_check_api_key())
    return _client


def get_anthropic_async_client() -> anthropic.AsyncAnthropic:
    """
    Return a shared async Anthropic client, creating it on first call.

    Used by FastAPI async route handlers that call Claude directly
    (rather than delegating to a pipeline thread).

    Raises:
        EnvironmentError: if ANTHROPIC_API_KEY is not set.
    """
    global _async_client
    if _async_client is None:
        _async_client = anthropic.AsyncAnthropic(api_key=_check_api_key())
    return _async_client
