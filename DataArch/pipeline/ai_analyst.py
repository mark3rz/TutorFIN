"""
pipeline/ai_analyst.py — Natural language SQL analytics agent for DataArch.AI.

Takes a business question in plain English, uses Claude to generate a SQL query
based on the current database schema, executes it read-only against PostgreSQL,
and returns both the answer and the SQL for transparency.

Phase 3, Step 3.3

Features:
  - Schema-aware SQL generation via Claude tool_use
  - Read-only execution with safety guardrails
  - Natural language answer synthesis from query results
  - Query explanation for transparency
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import anthropic
from pydantic import BaseModel, Field, ValidationError

import config
from pipeline.llm import _get_client, _call_with_retry, MODEL
from pipeline.database import execute_readonly_query, load_schema_from_file

logger = logging.getLogger(__name__)


# ── Tool definition for SQL generation ──────────────────────────────────────

SQL_GENERATION_TOOL = {
    "name": "generate_sql_query",
    "description": (
        "Generate a PostgreSQL SQL query to answer a business question. "
        "The query will be executed read-only against the database."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": (
                    "A valid PostgreSQL SELECT query that answers the user's question. "
                    "Use only tables and columns from the provided schema. "
                    "Remember to quote reserved words like \"transaction\" with double quotes. "
                    "Use LIMIT to keep results manageable."
                ),
            },
            "explanation": {
                "type": "string",
                "description": "Brief explanation of what the query does and why.",
            },
        },
        "required": ["sql", "explanation"],
    },
}


# ── Pydantic models ─────────────────────────────────────────────────────────

class SQLGenerationResult(BaseModel):
    """Validated result from the SQL generation tool."""
    sql: str
    explanation: str = ""


class AnalyticsResponse(BaseModel):
    """Full response from the analytics agent."""
    question: str
    sql: str
    explanation: str
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    row_count: int = 0
    answer: str = ""
    error: str | None = None


# ── Schema formatting ──────────────────────────────────────────────────────

def _format_schema_for_prompt(schema: dict) -> str:
    """
    Format the schema.json into a concise text representation
    that fits efficiently in the Claude prompt.
    """
    lines = ["Database Schema:"]

    for table in schema.get("tables", []):
        tname = table["table_name"]
        cols = []
        for col in table["columns"]:
            col_desc = f"{col['name']} {col['type']}"
            if col.get("primary_key"):
                col_desc += " PK"
            if col.get("unique"):
                col_desc += " UNIQUE"
            if not col.get("nullable", True):
                col_desc += " NOT NULL"
            cols.append(col_desc)

        fks = []
        for fk in table.get("foreign_keys", []):
            fks.append(f"FK: {fk['column']} → {fk['references_table']}.{fk['references_column']}")

        lines.append(f"\nTable: {tname} ({table.get('record_count', '?')} records)")
        lines.append(f"  Columns: {', '.join(cols)}")
        if fks:
            lines.append(f"  {'; '.join(fks)}")

    return "\n".join(lines)


# ── SQL generation ──────────────────────────────────────────────────────────

ANALYST_SYSTEM_PROMPT = """You are a SQL analytics expert for DataArch.AI, a Private Equity data platform.
You write PostgreSQL queries to answer business questions about PE portfolio companies.

IMPORTANT SQL RULES:
- Only generate SELECT queries (never INSERT, UPDATE, DELETE, DROP, etc.)
- Always use double quotes around reserved words used as table names: "transaction", "type", "user", "order"
- Use LIMIT to keep results manageable (default LIMIT 50)
- Use meaningful column aliases for readability
- Join tables using canonical_name foreign keys when needed
- Use aggregate functions (COUNT, SUM, AVG, etc.) for summary questions
- Format currency values with ROUND() for readability

Use the generate_sql_query tool to return your query."""


def generate_sql(
    question: str,
    schema: dict | None = None,
) -> SQLGenerationResult:
    """
    Use Claude to generate a SQL query for a business question.

    Args:
        question: Natural language business question
        schema: Database schema dict (loads from file if None)

    Returns:
        SQLGenerationResult with sql and explanation
    """
    if schema is None:
        schema = load_schema_from_file()

    client = _get_client()
    schema_text = _format_schema_for_prompt(schema)

    user_message = (
        f"{schema_text}\n\n"
        f"Question: {question}\n\n"
        f"Generate a PostgreSQL query to answer this question."
    )

    def _make_call():
        return client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=ANALYST_SYSTEM_PROMPT,
            tools=[SQL_GENERATION_TOOL],
            tool_choice={"type": "tool", "name": "generate_sql_query"},
            messages=[{"role": "user", "content": user_message}],
        )

    message = _call_with_retry(_make_call)

    # Parse tool_use response
    for block in message.content:
        if block.type == "tool_use" and block.name == "generate_sql_query":
            try:
                return SQLGenerationResult(**block.input)
            except ValidationError as e:
                logger.warning(f"SQL generation validation failed: {e}")
                return SQLGenerationResult(
                    sql=block.input.get("sql", ""),
                    explanation=block.input.get("explanation", ""),
                )

    # Fallback: try text parsing
    for block in message.content:
        if hasattr(block, "text"):
            text = block.text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1])
            try:
                data = json.loads(text)
                return SQLGenerationResult(**data)
            except (json.JSONDecodeError, ValidationError):
                # If it looks like raw SQL, use it directly
                if text.upper().startswith("SELECT") or text.upper().startswith("WITH"):
                    return SQLGenerationResult(sql=text, explanation="")

    raise ValueError("Could not generate SQL from the question.")


# ── Answer synthesis ────────────────────────────────────────────────────────

ANSWER_TOOL = {
    "name": "provide_answer",
    "description": "Provide a natural language answer to the user's question based on the query results.",
    "input_schema": {
        "type": "object",
        "properties": {
            "answer": {
                "type": "string",
                "description": "A clear, concise natural language answer to the user's question based on the data.",
            },
        },
        "required": ["answer"],
    },
}


def _synthesize_answer(
    question: str,
    sql: str,
    columns: list[str],
    rows: list[dict],
    row_count: int,
) -> str:
    """
    Use Claude to synthesize a natural language answer from query results.
    """
    client = _get_client()

    # Truncate results for the prompt (keep first 20 rows)
    display_rows = rows[:20]
    results_text = json.dumps(display_rows, indent=2, default=str)

    user_message = (
        f"Question: {question}\n\n"
        f"SQL query used: {sql}\n\n"
        f"Results ({row_count} rows, showing first {len(display_rows)}):\n"
        f"Columns: {columns}\n"
        f"{results_text}\n\n"
        f"Please provide a clear, concise answer to the question based on these results."
    )

    def _make_call():
        return client.messages.create(
            model=MODEL,
            max_tokens=512,
            system="You are a data analyst providing clear answers to business questions. Be concise and specific. Use the provide_answer tool.",
            tools=[ANSWER_TOOL],
            tool_choice={"type": "tool", "name": "provide_answer"},
            messages=[{"role": "user", "content": user_message}],
        )

    try:
        message = _call_with_retry(_make_call)

        for block in message.content:
            if block.type == "tool_use" and block.name == "provide_answer":
                return block.input.get("answer", "")

        # Fallback to text
        for block in message.content:
            if hasattr(block, "text"):
                return block.text.strip()

    except Exception as e:
        logger.warning(f"Answer synthesis failed: {e}")

    # Fallback: generate a simple answer
    if row_count == 0:
        return "No data found matching your question."
    elif row_count == 1:
        return f"Found 1 result: {json.dumps(rows[0], default=str)}"
    else:
        return f"Found {row_count} results. See the data table below for details."


# ── Main entry point ───────────────────────────────────────────────────────

def ask(
    question: str,
    schema: dict | None = None,
    max_rows: int = 100,
) -> dict:
    """
    Answer a business question using natural language SQL analytics.

    Process:
      1. Generate SQL from the question using Claude
      2. Execute the query read-only against PostgreSQL
      3. Synthesize a natural language answer from the results

    Args:
        question: Natural language business question
        schema: Database schema (loads from file if None)
        max_rows: Maximum rows to return

    Returns:
        AnalyticsResponse as a dict with question, sql, answer, data, etc.
    """
    response = AnalyticsResponse(question=question, sql="", explanation="")

    # 1. Generate SQL
    try:
        sql_result = generate_sql(question, schema)
        response.sql = sql_result.sql
        response.explanation = sql_result.explanation
    except Exception as e:
        response.error = f"SQL generation failed: {e}"
        return response.model_dump()

    # 2. Execute query
    try:
        query_result = execute_readonly_query(response.sql, max_rows=max_rows)
        response.columns = query_result["columns"]
        response.rows = query_result["rows"]
        response.row_count = query_result["row_count"]
    except ValueError as e:
        response.error = f"Query blocked (safety): {e}"
        return response.model_dump()
    except Exception as e:
        response.error = f"Query execution failed: {e}"
        return response.model_dump()

    # 3. Synthesize answer
    try:
        response.answer = _synthesize_answer(
            question,
            response.sql,
            response.columns,
            response.rows,
            response.row_count,
        )
    except Exception as e:
        response.answer = f"Found {response.row_count} results (answer synthesis failed: {e})"

    return response.model_dump()
