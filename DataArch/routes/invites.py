"""
routes/invites.py — Invite flow for DataArch.AI.

PE admins invite portfolio company users via email. Invitees accept the
invitation through a token link that pre-validates their access level.

Endpoints:
  POST   /invites              — PE admin creates an invitation, triggers email
  GET    /invites              — PE admin lists all invitations (filterable)
  DELETE /invites/{id}         — PE admin revokes a pending invitation
  GET    /invites/accept/{token} — Public: validate a token, return invite details
  POST   /invites/accept/{token} — Public: (deprecated, use POST /auth/register)

The acceptance flow:
  1. Invitee visits the invite link: /#/invite/{token}
  2. Frontend calls GET /invites/accept/{token} to validate and prefill email
  3. Invitee fills in name + password and submits POST /auth/register with invite_token
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

import config
from auth import TokenUser, get_current_user, require_role
from models import UserRole
from pipeline.database import get_engine
from services.audit import get_client_ip, log_action
from services.email import send_invite_email

router = APIRouter(prefix="/invites", tags=["invites"])


# ── Request / Response models ────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    role: str = UserRole.COMPANY_VIEWER
    company_id: Optional[int] = None


class InviteResponse(BaseModel):
    id: int
    email: str
    role: str
    company_id: Optional[int]
    invite_token: Optional[str]   # only present on creation
    status: str
    expires_at: str
    created_at: str
    company_name: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _row_to_dict(row, include_token: bool = False) -> dict:
    d = {
        "id": row.id,
        "email": row.email,
        "role": row.role,
        "company_id": row.company_id,
        "status": row.status,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "accepted_at": row.accepted_at.isoformat() if row.accepted_at else None,
    }
    if include_token:
        d["invite_token"] = row.invite_token
    return d


def _is_expired(expires_at: datetime) -> bool:
    """Return True if the invitation has passed its expiry time."""
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        # Assume UTC if no tz info (common for naive DB datetimes)
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return now > expires_at


# ── POST /invites ─────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_invite(
    body: InviteRequest,
    request: Request,
    user: TokenUser = Depends(require_role([UserRole.PE_ADMIN])),
):
    """Create an invitation and send an email to the invitee.

    Only PE admins can invite users. The invitation expires after
    INVITE_EXPIRY_DAYS days (default: 7).
    """
    email = body.email.lower().strip()

    if body.role not in UserRole.ALL:
        raise HTTPException(400, f"Invalid role '{body.role}'. Allowed: {UserRole.ALL}")

    engine = get_engine()

    with engine.connect() as conn:
        # Reject if a user with this email already exists
        existing_user = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": email},
        ).fetchone()
        if existing_user:
            raise HTTPException(409, f"A user with email '{email}' already exists.")

        # Reject if there is already a pending, non-expired invite for this email
        existing_invite = conn.execute(
            text("""
                SELECT id FROM invitations
                WHERE email = :email AND status = 'pending' AND expires_at > NOW()
            """),
            {"email": email},
        ).fetchone()
        if existing_invite:
            raise HTTPException(
                409,
                f"A pending invitation for '{email}' already exists. Revoke it first to re-invite.",
            )

        # Validate company_id if provided
        company_name: Optional[str] = None
        if body.company_id is not None:
            company_row = conn.execute(
                text("SELECT name FROM portfolio_company WHERE id = :cid"),
                {"cid": body.company_id},
            ).fetchone()
            if not company_row:
                raise HTTPException(404, f"Company {body.company_id} not found.")
            company_name = company_row.name

        # Generate a cryptographically random token (48 bytes → 64-char URL-safe string)
        token = secrets.token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(days=config.INVITE_EXPIRY_DAYS)

        result = conn.execute(
            text("""
                INSERT INTO invitations
                    (email, role, company_id, invite_token, invited_by, status, expires_at, created_at)
                VALUES
                    (:email, :role, :company_id, :token, :invited_by, 'pending', :expires_at, NOW())
                RETURNING id, email, role, company_id, invite_token, invited_by, status, expires_at, created_at, accepted_at
            """),
            {
                "email": email,
                "role": body.role,
                "company_id": body.company_id,
                "token": token,
                "invited_by": user.id,
                "expires_at": expires_at,
            },
        )
        invite = result.fetchone()
        conn.commit()

    # Fetch inviter name for the email
    with engine.connect() as conn:
        inviter_row = conn.execute(
            text("SELECT full_name FROM users WHERE id = :uid"),
            {"uid": user.id},
        ).fetchone()
    inviter_name = inviter_row.full_name if inviter_row else user.email

    # Send the invitation email (non-blocking; log on failure but don't fail the request)
    email_sent = send_invite_email(
        to_email=email,
        invite_token=token,
        invited_by_name=inviter_name,
        company_name=company_name,
    )

    log_action(
        user_id=user.id,
        action="invite_create",
        resource_type="invitation",
        resource_id=str(invite.id),
        details={
            "email": email,
            "role": body.role,
            "company_id": body.company_id,
            "email_sent": email_sent,
        },
        ip_address=get_client_ip(request),
    )

    response = _row_to_dict(invite, include_token=True)
    if company_name:
        response["company_name"] = company_name
    if not email_sent:
        response["warning"] = "Invitation created but email delivery failed. Share the invite link manually."

    return JSONResponse(content=response, status_code=201)


# ── GET /invites ──────────────────────────────────────────────────────────────

@router.get("")
def list_invites(
    status: Optional[str] = None,
    company_id: Optional[int] = None,
    offset: int = 0,
    limit: int = 50,
    user: TokenUser = Depends(require_role([UserRole.PE_ADMIN])),
):
    """List invitations. PE admin only.

    Query params:
      status     — filter by status (pending | accepted | expired | revoked)
      company_id — filter by company
      offset/limit — pagination
    """
    engine = get_engine()
    filters = []
    params: dict = {"offset": offset, "limit": limit}

    if status:
        filters.append("i.status = :status")
        params["status"] = status

    if company_id is not None:
        filters.append("i.company_id = :company_id")
        params["company_id"] = company_id

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    with engine.connect() as conn:
        total_row = conn.execute(
            text(f"SELECT COUNT(*) FROM invitations i {where_clause}"),
            params,
        ).fetchone()
        total = total_row[0] if total_row else 0

        rows = conn.execute(
            text(f"""
                SELECT
                    i.id, i.email, i.role, i.company_id, i.status,
                    i.expires_at, i.created_at, i.accepted_at,
                    pc.name AS company_name,
                    u.full_name AS invited_by_name
                FROM invitations i
                LEFT JOIN portfolio_company pc ON pc.id = i.company_id
                LEFT JOIN users u ON u.id = i.invited_by
                {where_clause}
                ORDER BY i.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            params,
        ).fetchall()

    invites = []
    for row in rows:
        d = {
            "id": row.id,
            "email": row.email,
            "role": row.role,
            "company_id": row.company_id,
            "company_name": row.company_name,
            "invited_by_name": row.invited_by_name,
            "status": row.status,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "accepted_at": row.accepted_at.isoformat() if row.accepted_at else None,
        }
        invites.append(d)

    return JSONResponse(content={
        "total": total,
        "offset": offset,
        "limit": limit,
        "invitations": invites,
    })


# ── DELETE /invites/{id} ──────────────────────────────────────────────────────

@router.delete("/{invite_id}")
def revoke_invite(
    invite_id: int,
    request: Request,
    user: TokenUser = Depends(require_role([UserRole.PE_ADMIN])),
):
    """Revoke a pending invitation. PE admin only."""
    engine = get_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                UPDATE invitations SET status = 'revoked'
                WHERE id = :iid AND status = 'pending'
                RETURNING id, email
            """),
            {"iid": invite_id},
        )
        row = result.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(404, "Invitation not found or is not in pending status.")

    log_action(
        user_id=user.id,
        action="invite_revoke",
        resource_type="invitation",
        resource_id=str(invite_id),
        details={"email": row.email},
        ip_address=get_client_ip(request),
    )

    return {"message": f"Invitation {invite_id} for '{row.email}' revoked."}


# ── GET /invites/accept/{token} ───────────────────────────────────────────────

@router.get("/accept/{token}")
def validate_invite_token(token: str):
    """Validate an invite token and return invite details for the acceptance form.

    Public endpoint — no auth required. Used by the frontend to prefill the
    registration form before the user creates their account.

    Returns 200 with invite details if valid, or 4xx with a descriptive error.
    """
    engine = get_engine()

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT
                    i.id, i.email, i.role, i.company_id, i.status, i.expires_at,
                    pc.name AS company_name
                FROM invitations i
                LEFT JOIN portfolio_company pc ON pc.id = i.company_id
                WHERE i.invite_token = :token
            """),
            {"token": token},
        ).fetchone()

    if not row:
        raise HTTPException(404, "Invalid or expired invitation link.")

    if row.status == "accepted":
        raise HTTPException(410, "This invitation has already been accepted.")

    if row.status == "revoked":
        raise HTTPException(410, "This invitation has been revoked.")

    if row.status == "expired" or _is_expired(row.expires_at):
        raise HTTPException(410, "This invitation link has expired. Ask your PE admin to re-send it.")

    return {
        "valid": True,
        "email": row.email,
        "role": row.role,
        "company_id": row.company_id,
        "company_name": row.company_name,
        "expires_at": row.expires_at.isoformat(),
    }
