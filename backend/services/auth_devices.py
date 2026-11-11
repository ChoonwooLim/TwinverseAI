"""Remembered-device tokens ("이 기기에서 로그인 유지").

Flow:
- login(remember=True) -> issue_device_token() -> raw token in an HttpOnly
  cookie scoped to /api/auth, SHA-256 hash in ``auth_devices``.
- POST /api/auth/refresh -> resolve_device() -> new 8h access token, and the
  device's expiry slides forward (REMEMBER_DAYS of inactivity ends it).
- POST /api/auth/logout -> revoke_device().

The cookie name deliberately avoids the substring "token": DeskRPG's proxy
once matched cookies with an unanchored ``token=`` regex (2026-08-26).
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Request, Response
from sqlmodel import Session, delete, or_, select

from models.auth_device import AuthDevice

REMEMBER_COOKIE = "tv_device"
REMEMBER_COOKIE_PATH = "/api/auth"


def _remember_days() -> int:
    try:
        days = int(os.getenv("AUTH_REMEMBER_DAYS", "30"))
    except ValueError:
        days = 30
    return min(max(days, 1), 365)


REMEMBER_DAYS = _remember_days()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    # SQLite drops tzinfo on read; Postgres keeps it. Normalise before comparing.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def hash_device_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _client_meta(request: Request) -> tuple[str, str]:
    ua = (request.headers.get("user-agent") or "")[:255]
    forwarded = (request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = forwarded or (request.client.host if request.client else "")
    return ua, ip[:64]


def issue_device_token(session: Session, user_id: int, request: Request) -> str:
    """Create a remembered device for ``user_id`` and return the raw token."""
    now = _now()
    # Housekeeping: drop this user's dead devices so the table stays small.
    session.exec(
        delete(AuthDevice).where(
            AuthDevice.user_id == user_id,
            or_(AuthDevice.revoked_at.is_not(None), AuthDevice.expires_at <= now),
        )
    )
    raw = secrets.token_urlsafe(48)
    ua, ip = _client_meta(request)
    session.add(
        AuthDevice(
            user_id=user_id,
            token_hash=hash_device_token(raw),
            user_agent=ua,
            ip_address=ip,
            created_at=now,
            last_used_at=now,
            expires_at=now + timedelta(days=REMEMBER_DAYS),
        )
    )
    session.commit()
    return raw


def resolve_device(session: Session, raw: str | None) -> AuthDevice | None:
    """Return the live device for ``raw`` (not revoked, not expired) or None."""
    if not raw:
        return None
    device = session.exec(
        select(AuthDevice).where(AuthDevice.token_hash == hash_device_token(raw))
    ).first()
    if not device or device.revoked_at is not None:
        return None
    if _as_utc(device.expires_at) <= _now():
        return None
    return device


def touch_device(session: Session, device: AuthDevice) -> None:
    """Slide the device's expiry forward after a successful refresh."""
    now = _now()
    device.last_used_at = now
    device.expires_at = now + timedelta(days=REMEMBER_DAYS)
    session.add(device)
    session.commit()


def revoke_device(session: Session, raw: str | None) -> None:
    device = resolve_device(session, raw)
    if not device:
        return
    device.revoked_at = _now()
    session.add(device)
    session.commit()


def set_remember_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        REMEMBER_COOKIE,
        raw,
        max_age=REMEMBER_DAYS * 24 * 60 * 60,
        path=REMEMBER_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="lax",
    )


def clear_remember_cookie(response: Response) -> None:
    response.delete_cookie(
        REMEMBER_COOKIE,
        path=REMEMBER_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="lax",
    )
