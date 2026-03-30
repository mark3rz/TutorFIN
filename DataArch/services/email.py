"""
services/email.py — Transactional email for DataArch.AI.

Supports two modes:
  - Resend API (recommended): set RESEND_API_KEY in environment
  - Dev/log mode (default):   logs the invite link to stdout when no key is set

Usage:
  from services.email import send_invite_email
  ok = send_invite_email(to_email, invite_token, invited_by_name, company_name)

To use Resend (https://resend.com — free tier, no SMTP config needed):
  1. Sign up and verify your sending domain
  2. Set RESEND_API_KEY=re_xxx in your .env
  3. Set FROM_EMAIL=noreply@yourdomain.com
  4. Set APP_URL=https://yourdomain.com

For self-hosted / SMTP deployments set SMTP_HOST, SMTP_PORT, SMTP_USER,
SMTP_PASSWORD and the SMTP path will be used automatically.
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import config

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

SMTP_HOST: str = os.getenv("SMTP_HOST", "")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")


# ── Public API ───────────────────────────────────────────────────────────────

def send_invite_email(
    to_email: str,
    invite_token: str,
    invited_by_name: str,
    company_name: Optional[str] = None,
) -> bool:
    """Send an invitation email.

    Returns True on success, False on failure.
    In dev mode (no keys set) logs the invite link and returns True.
    """
    accept_url = f"{config.APP_URL}/invite/{invite_token}"

    # Dev mode: print the link rather than actually sending
    if not config.RESEND_API_KEY and not SMTP_HOST:
        logger.info(
            "[email:dev] Invite link for %s → %s",
            to_email,
            accept_url,
        )
        print(f"\n📧 [DEV] Invite email for {to_email}:\n   {accept_url}\n")
        return True

    subject = f"You're invited to DataArch.AI"
    html = _render_html(accept_url, invited_by_name, company_name, to_email)
    text = _render_text(accept_url, invited_by_name, company_name)

    if config.RESEND_API_KEY:
        return _send_via_resend(to_email, subject, html)

    if SMTP_HOST:
        return _send_via_smtp(to_email, subject, html, text)

    return False


# ── Email Templates ──────────────────────────────────────────────────────────

def _render_html(
    accept_url: str,
    invited_by: str,
    company_name: Optional[str],
    to_email: str,
) -> str:
    company_line = (
        f"<p>You've been invited to manage data for <strong>{company_name}</strong>.</p>"
        if company_name
        else "<p>You've been invited to access the DataArch.AI platform.</p>"
    )
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; margin: 0; padding: 32px; }}
    .card {{ background: #fff; border-radius: 8px; padding: 40px; max-width: 480px; margin: 0 auto; box-shadow: 0 1px 4px rgba(0,0,0,.08); }}
    h1 {{ font-size: 22px; color: #1a1a2e; margin: 0 0 16px; }}
    p {{ color: #4a4a6a; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }}
    .btn {{ display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }}
    .footer {{ color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }}
    .url {{ word-break: break-all; color: #6b7280; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>You're invited to DataArch.AI</h1>
    {company_line}
    <p><strong>{invited_by}</strong> has invited you to join. Click the button below to create your account.</p>
    <a class="btn" href="{accept_url}">Accept Invitation</a>
    <p>This link expires in {config.INVITE_EXPIRY_DAYS} days.</p>
    <div class="footer">
      <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
      <p class="url">Or copy this link: {accept_url}</p>
    </div>
  </div>
</body>
</html>"""


def _render_text(
    accept_url: str,
    invited_by: str,
    company_name: Optional[str],
) -> str:
    company_line = (
        f"You've been invited to manage data for {company_name}."
        if company_name
        else "You've been invited to access the DataArch.AI platform."
    )
    return f"""You're invited to DataArch.AI

{company_line}
{invited_by} has invited you to join.

Accept your invitation here:
{accept_url}

This link expires in {config.INVITE_EXPIRY_DAYS} days.

If you weren't expecting this, ignore this email.
"""


# ── Transport: Resend ────────────────────────────────────────────────────────

def _send_via_resend(to_email: str, subject: str, html: str) -> bool:
    try:
        import httpx  # already in requirements.txt
    except ImportError:
        logger.error("httpx is required for Resend email sending.")
        return False

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {config.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": config.FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
            timeout=10.0,
        )
        if response.status_code in (200, 201):
            logger.info("[email:resend] sent to %s", to_email)
            return True
        else:
            logger.warning(
                "[email:resend] failed for %s: %s %s",
                to_email,
                response.status_code,
                response.text,
            )
            return False
    except Exception as e:
        logger.error("[email:resend] exception for %s: %s", to_email, e)
        return False


# ── Transport: SMTP ──────────────────────────────────────────────────────────

def _send_via_smtp(to_email: str, subject: str, html: str, text: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config.FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(config.FROM_EMAIL, [to_email], msg.as_string())

        logger.info("[email:smtp] sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("[email:smtp] exception for %s: %s", to_email, e)
        return False
