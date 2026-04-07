"""
services/logging_config.py — Structured JSON logging for DataArch.AI.

Configures Python's root logger with:
  - JSON formatting in production (DATAARCH_ENV=prod/staging)
  - Human-readable console format in development (DATAARCH_ENV=dev)
  - Automatic injection of correlation_id, job_id, user_id, company_id via contextvars

Usage:
    1. Call setup_logging() at app startup (in api.py lifespan)
    2. Use set_log_context() in middleware to inject request context
    3. Use set_job_context() in pipeline_runner to inject job_id
    4. All existing loggers (logging.getLogger(__name__)) automatically inherit the config
"""

import logging
import sys
from contextvars import ContextVar
from typing import Optional

from pythonjsonlogger import jsonlogger

import config

# ── Context Variables ──────────────────────────────────────────────────────
# These are automatically propagated through async call chains and threads
# spawned from the current context.

correlation_id_var: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)
job_id_var: ContextVar[Optional[str]] = ContextVar("job_id", default=None)
user_id_var: ContextVar[Optional[int]] = ContextVar("user_id", default=None)
company_id_var: ContextVar[Optional[int]] = ContextVar("company_id", default=None)


# ── Custom JSON Formatter ──────────────────────────────────────────────────

class ContextJsonFormatter(jsonlogger.JsonFormatter):
    """
    JSON formatter that automatically injects context vars into every log record.

    Output fields:
      - timestamp (ISO 8601)
      - level (INFO, WARNING, ERROR, etc.)
      - logger (logger name, e.g. pipeline.pipeline_runner)
      - message
      - correlation_id (from request context, if available)
      - job_id (from pipeline context, if available)
      - user_id (from auth context, if available)
      - company_id (from auth context, if available)
    """

    def add_fields(self, log_record, record, message_dict):
        """Add timestamp, level, logger name, and context vars to each log record."""
        super().add_fields(log_record, record, message_dict)

        # Standard fields
        log_record["timestamp"] = self.formatTime(record, self.datefmt)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["message"] = record.getMessage()

        # Context vars (only include if set)
        correlation_id = correlation_id_var.get()
        if correlation_id:
            log_record["correlation_id"] = correlation_id

        job_id = job_id_var.get()
        if job_id:
            log_record["job_id"] = job_id

        user_id = user_id_var.get()
        if user_id:
            log_record["user_id"] = user_id

        company_id = company_id_var.get()
        if company_id:
            log_record["company_id"] = company_id


# ── Setup Function ─────────────────────────────────────────────────────────

def setup_logging():
    """
    Configure Python's root logger based on DATAARCH_ENV.

    - In dev mode: human-readable console format
    - In prod/staging: JSON-formatted log lines

    Call this once at app startup (in api.py lifespan).
    """
    env = config.DATAARCH_ENV.lower()

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove existing handlers (avoid duplicate logs if setup_logging is called twice)
    root_logger.handlers.clear()

    # Create handler writing to stderr (Docker best practice)
    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(logging.INFO)

    if env in ("prod", "staging"):
        # Production: JSON format
        formatter = ContextJsonFormatter(
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    else:
        # Development: human-readable format
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)


# ── Context Management ─────────────────────────────────────────────────────

def set_log_context(
    correlation_id: Optional[str] = None,
    user_id: Optional[int] = None,
    company_id: Optional[int] = None,
):
    """
    Set request-scoped logging context.

    Called by middleware to inject correlation_id, user_id, company_id
    for the duration of a request.
    """
    if correlation_id is not None:
        correlation_id_var.set(correlation_id)
    if user_id is not None:
        user_id_var.set(user_id)
    if company_id is not None:
        company_id_var.set(company_id)


def set_job_context(job_id: str):
    """
    Set pipeline job_id context.

    Called by pipeline_runner to inject job_id for all logs
    in the pipeline execution.
    """
    job_id_var.set(job_id)


def get_log_context() -> dict:
    """
    Get current logging context as a dict.

    Useful for debugging or logging the context explicitly.
    """
    return {
        "correlation_id": correlation_id_var.get(),
        "job_id": job_id_var.get(),
        "user_id": user_id_var.get(),
        "company_id": company_id_var.get(),
    }
