"""
llm.py — Thin wrapper around the Anthropic Claude API.

All parsers call extract() with their raw text.
Swap the model or provider here without touching parsers.
"""

import os
import json
import anthropic
from dotenv import load_dotenv

load_dotenv()

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key."
            )
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


EXTRACTION_PROMPT = """You are a data extraction engine for DataArch.AI.
Given raw text from a business document, extract structured information.

Return ONLY valid JSON with this exact shape:
{{
  "summary": "<one paragraph describing what this document is>",
  "entities": [
    {{
      "entity_type": "<invoice|contract|vendor|employee|customer|product|financial_record|other>",
      "name": "<primary name or identifier, or null>",
      "attributes": {{ "<key>": "<value>" }},
      "confidence": <0.0-1.0>
    }}
  ],
  "data_fields": {{
    "<field_name>": "<extracted value>"
  }}
}}

Rules:
- Extract every meaningful business entity and data point.
- For data_fields, include things like dates, amounts, IDs, names, statuses.
- confidence reflects how certain you are about each entity.
- Return only JSON — no explanation, no markdown.

Document text:
{text}
"""


def extract(raw_text: str, max_tokens: int = 2048) -> dict:
    """
    Send raw document text to Claude and return structured extraction.
    Returns a dict matching the JSON schema above, or raises on failure.
    """
    client = _get_client()

    # Truncate very long documents to avoid token limits in demo
    truncated = raw_text[:12000] if len(raw_text) > 12000 else raw_text

    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=max_tokens,
        messages=[
            {
                "role": "user",
                "content": EXTRACTION_PROMPT.format(text=truncated),
            }
        ],
    )

    response_text = message.content[0].text.strip()

    # Strip markdown fences if Claude wraps the JSON
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    return json.loads(response_text)
