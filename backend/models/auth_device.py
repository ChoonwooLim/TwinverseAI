"""Remembered devices — long-lived "keep me signed in" credentials.

A row is created when a user signs in with "이 기기에서 로그인 유지" on. The
browser holds the raw token in an HttpOnly cookie; only its SHA-256 hash is
stored here, so a database leak cannot be replayed as a login.

Access tokens (JWT, 8h) are unchanged. This table only lets a remembered
device mint a fresh access token after the old one expires.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuthDevice(SQLModel, table=True):
    __tablename__ = "auth_devices"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    token_hash: str = Field(sa_column=Column(String(64), nullable=False, unique=True))
    user_agent: str = Field(default="", max_length=255)
    ip_address: str = Field(default="", max_length=64)
    created_at: datetime = Field(default_factory=utc_now, sa_type=DateTime(timezone=True))
    last_used_at: datetime = Field(default_factory=utc_now, sa_type=DateTime(timezone=True))
    expires_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    revoked_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))
