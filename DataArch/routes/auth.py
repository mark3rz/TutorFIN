"""
routes/auth.py — Authentication endpoints for DataArch.AI.

Endpoints:
  POST /auth/register  — Create a new account
  POST /auth/login     — Email + password → JWT
  POST /auth/logout    — Client-side token invalidation hint
  GET  /auth/me        — Current user profile
  PUT  /auth/me        — Update profile
  POST /auth/api-keys  — Create an API key
  DELETE /auth/api-keys/{id} — Revoke an API key
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text

import config
from services.audit import get_client_ip, log_action
from auth import (
    TokenUser,
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
)
from models import UserRole
from pipeline.database import get_engine

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Request / Response Models ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    # When invite_token is provided, role/company_id are taken from the invitation
    # and any values supplied here are ignored.
    invite_token: str | None = None
    role: str = UserRole.COMPANY_VIEWER
    company_id: int | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None


class ApiKeyCreate(BaseModel):
    name: str


# ── Helpers ────────────────────────────────────────────────────────────────

def _user_row_to_dict(row) -> dict:
    """Convert a database row to a user dict (excludes password_hash)."""
    return {
        "id": row.id,
        "email": row.email,
        "full_name": row.full_name,
        "role": row.role,
        "company_id": row.company_id,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


# ── Register ───────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(body: RegisterRequest, request: Request):
    """Create a new user account.

    When OPEN_REGISTRATION=false (production default) an invite_token is required.
    When a valid invite_token is supplied the role and company_id are taken
    from the invitation and cannot be overridden by the request body.
    """
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    email = body.email.lower().strip()
    engine = get_engine()

    # ── Invite-token path ──────────────────────────────────────────────────
    invite_id: int | None = None
    if body.invite_token:
        with engine.connect() as conn:
            invite = conn.execute(
                text("""
                    SELECT id, email, role, company_id, status, expires_at
                    FROM invitations
                    WHERE invite_token = :token
                """),
                {"token": body.invite_token},
            ).fetchone()

        if not invite:
            raise HTTPException(status_code=400, detail="Invalid invitation token.")
        if invite.status != "pending":
            raise HTTPException(status_code=400, detail="This invitation has already been used or revoked.")
        # Check expiry (naive datetime from DB → compare without tz)
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        if invite.expires_at < now_naive:
            raise HTTPException(status_code=400, detail="This invitation link has expired.")
        if invite.email.lower() != email:
            raise HTTPException(
                status_code=400,
                detail="The email address does not match the invitation.",
            )

        # Override role/company from the invite — the inviter controls these
        body.role = invite.role
        body.company_id = invite.company_id
        invite_id = invite.id

    else:
        # No invite token — only allowed when OPEN_REGISTRATION is enabled
        if not config.OPEN_REGISTRATION:
            raise HTTPException(
                status_code=403,
                detail="Registration requires an invitation. Contact your PE administrator.",
            )
        # Validate the role from the request body
        if body.role not in UserRole.ALL:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role '{body.role}'. Allowed: {UserRole.ALL}",
            )

    pw_hash = hash_password(body.password)

    with engine.connect() as conn:
        # Check for existing user
        existing = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": email},
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="A user with this email already exists.")

        result = conn.execute(
            text("""
                INSERT INTO users (email, password_hash, full_name, role, company_id, is_active, created_at, updated_at)
                VALUES (:email, :pw_hash, :full_name, :role, :company_id, true, NOW(), NOW())
                RETURNING id, email, full_name, role, company_id, is_active, created_at
            """),
            {
                "email": email,
                "pw_hash": pw_hash,
                "full_name": body.full_name.strip(),
                "role": body.role,
                "company_id": body.company_id,
            },
        )
        user = result.fetchone()
        conn.commit()

    # Mark the invitation as accepted
    if invite_id is not None:
        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE invitations
                    SET status = 'accepted', accepted_at = NOW()
                    WHERE id = :iid
                """),
                {"iid": invite_id},
            )
            conn.commit()

    jwt_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        company_id=user.company_id,
    )

    log_action(
        user_id=user.id, action="register",
        resource_type="user", resource_id=str(user.id),
        details={
            "email": user.email,
            "role": user.role,
            "via_invite": invite_id is not None,
        },
        ip_address=get_client_ip(request),
    )

    return {
        "user": _user_row_to_dict(user),
        "token": jwt_token,
    }


# ── Login ──────────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: LoginRequest, request: Request):
    """Authenticate with email + password, receive a JWT token."""
    engine = get_engine()

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT id, email, password_hash, full_name, role, company_id, is_active, created_at
                FROM users WHERE email = :email
            """),
            {"email": body.email.lower().strip()},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not row.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    if not verify_password(body.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(
        user_id=row.id,
        email=row.email,
        role=row.role,
        company_id=row.company_id,
    )

    log_action(
        user_id=row.id, action="login",
        resource_type="user", resource_id=str(row.id),
        ip_address=get_client_ip(request),
    )

    return {
        "user": _user_row_to_dict(row),
        "token": token,
    }


# ── Logout ─────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(user: TokenUser = Depends(get_current_user)):
    """Logout hint. JWT is stateless — client should discard the token.

    A future version may maintain a token blacklist if needed.
    """
    return {"message": "Logged out. Please discard your token."}


# ── Profile ────────────────────────────────────────────────────────────────

@router.get("/me")
def get_profile(user: TokenUser = Depends(get_current_user)):
    """Get the current user's profile."""
    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT id, email, full_name, role, company_id, is_active, created_at
                FROM users WHERE id = :uid
            """),
            {"uid": user.id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found.")

    return _user_row_to_dict(row)


@router.put("/me")
def update_profile(body: ProfileUpdate, user: TokenUser = Depends(get_current_user)):
    """Update the current user's profile (name, email)."""
    updates = []
    params: dict = {"uid": user.id}

    if body.full_name is not None:
        updates.append("full_name = :full_name")
        params["full_name"] = body.full_name.strip()

    if body.email is not None:
        updates.append("email = :email")
        params["email"] = body.email.lower().strip()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)

    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(
            text(f"UPDATE users SET {set_clause} WHERE id = :uid"),
            params,
        )
        conn.commit()

        row = conn.execute(
            text("SELECT id, email, full_name, role, company_id, is_active, created_at FROM users WHERE id = :uid"),
            {"uid": user.id},
        ).fetchone()

    return _user_row_to_dict(row)


# ── API Keys ──────────────────────────────────────────────────────────────

@router.post("/api-keys", status_code=201)
def create_api_key(
    body: ApiKeyCreate,
    user: TokenUser = Depends(require_role([UserRole.PE_ADMIN, UserRole.COMPANY_ADMIN])),
):
    """Create a new API key. Returns the raw key once — it cannot be retrieved later."""
    raw_key = f"da_{secrets.token_hex(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                INSERT INTO api_keys (user_id, key_hash, name, is_active, created_at)
                VALUES (:user_id, :key_hash, :name, true, NOW())
                RETURNING id, name, created_at
            """),
            {"user_id": user.id, "key_hash": key_hash, "name": body.name.strip()},
        )
        row = result.fetchone()
        conn.commit()

    return {
        "id": row.id,
        "name": row.name,
        "key": raw_key,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "note": "Save this key now — it will not be shown again.",
    }


@router.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: int,
    user: TokenUser = Depends(require_role([UserRole.PE_ADMIN, UserRole.COMPANY_ADMIN])),
):
    """Revoke (deactivate) an API key."""
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                UPDATE api_keys SET is_active = false
                WHERE id = :kid AND user_id = :uid
                RETURNING id
            """),
            {"kid": key_id, "uid": user.id},
        )
        row = result.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="API key not found or not owned by you.")

    return {"message": f"API key {key_id} revoked."}
