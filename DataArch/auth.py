"""
auth.py — Authentication & authorization for DataArch.AI.

Provides:
  - Password hashing (bcrypt via passlib)
  - JWT token creation and validation (python-jose)
  - FastAPI dependencies for route protection

Usage in routes:
    from auth import get_current_user, require_role

    @router.get("/admin/only")
    def admin_only(user = Depends(require_role([UserRole.PE_ADMIN]))):
        ...
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text

import config
from models import UserRole

# ── Password hashing ───────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plaintext password."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a hash."""
    return pwd_context.verify(plain, hashed)


# ── JWT Tokens ─────────────────────────────────────────────────────────────

def create_access_token(
    user_id: int,
    email: str,
    role: str,
    company_id: Optional[int] = None,
    expires_hours: Optional[int] = None,
) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        hours=expires_hours or config.JWT_EXPIRY_HOURS
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "company_id": company_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Returns payload dict."""
    try:
        payload = jwt.decode(
            token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Token user model (lightweight, no DB lookup on every request) ──────────

class TokenUser:
    """Lightweight user representation from a decoded JWT.

    For most requests, we trust the token claims.  Full DB lookups
    happen only when we need mutable data (profile update, etc.).
    """

    def __init__(self, payload: dict):
        self.id: int = int(payload["sub"])
        self.email: str = payload["email"]
        self.role: str = payload["role"]
        self.company_id: Optional[int] = payload.get("company_id")

    @property
    def is_pe_admin(self) -> bool:
        return self.role == UserRole.PE_ADMIN

    @property
    def is_company_admin(self) -> bool:
        return self.role == UserRole.COMPANY_ADMIN

    def can_access_company(self, company_id: int) -> bool:
        """Check if user can access a given company's data."""
        if self.is_pe_admin:
            return True
        return self.company_id == company_id


# ── FastAPI Dependencies ───────────────────────────────────────────────────

def _extract_token(request: Request) -> str:
    """Extract JWT from Authorization header or da_token cookie."""
    # 1. Try Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]

    # 2. Try cookie
    token = request.cookies.get("da_token")
    if token:
        return token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Provide a Bearer token or da_token cookie.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(request: Request) -> TokenUser:
    """FastAPI dependency: extract and validate JWT, return TokenUser."""
    token = _extract_token(request)
    payload = decode_token(token)
    return TokenUser(payload)


def get_optional_user(request: Request) -> Optional[TokenUser]:
    """Like get_current_user but returns None instead of raising 401.

    Used during the auth transition period so existing endpoints
    keep working without a token.
    """
    try:
        return get_current_user(request)
    except HTTPException:
        return None


def require_role(allowed_roles: list[str]):
    """Dependency factory: require the user to have one of the given roles.

    Usage:
        @router.get("/admin")
        def admin_endpoint(user = Depends(require_role(["pe_admin"]))):
            ...
    """

    def dependency(user: TokenUser = Depends(get_current_user)) -> TokenUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {allowed_roles}",
            )
        return user

    return dependency


def require_company_access(company_id: int, user: TokenUser = Depends(get_current_user)) -> TokenUser:
    """Dependency: verify user can access the given company."""
    if not user.can_access_company(company_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have access to company {company_id}.",
        )
    return user
