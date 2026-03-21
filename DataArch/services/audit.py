"""
services/audit.py — Audit logging for DataArch.AI.

Logs user actions to the audit_log table for compliance and debugging.
Designed to be non-blocking — failures are logged but never raise.

Usage:
    from services.audit import log_action
    log_action(user_id=1, action="upload", resource_type="document",
               resource_id="invoice.pdf", details={"size": 1024}, ip="127.0.0.1")
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from sqlalchemy import text

log = logging.getLogger(__name__)


def log_action(
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Write an audit log entry. Never raises — errors are logged and swallowed."""
    try:
        from pipeline.database import get_engine

        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO audit_log
                        (user_id, action, resource_type, resource_id, details, ip_address, created_at)
                    VALUES
                        (:user_id, :action, :resource_type, :resource_id,
                         :details::jsonb, :ip_address, NOW())
                """),
                {
                    "user_id": user_id,
                    "action": action,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "details": json.dumps(details) if details else None,
                    "ip_address": ip_address,
                },
            )
            conn.commit()
    except Exception as e:
        log.warning("Audit log write failed: %s (action=%s, user=%s)", e, action, user_id)


def get_client_ip(request) -> str:
    """Extract client IP from a FastAPI Request, respecting X-Forwarded-For."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
