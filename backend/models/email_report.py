"""Persisted email report metadata, admin triage decisions, and their
mailbox-execution lifecycle.

The ingested report stores summaries and judgement metadata only — never
message bodies, attachments, or credentials. Admin decisions record intent
(keep / trash / auto rule / defer) and also carry the execution lifecycle
that an external trusted worker consumes through the worker API. This app
itself never touches the mailbox or holds mailbox credentials; it only
publishes a bounded work queue.
"""
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EmailReport(SQLModel, table=True):
    __tablename__ = "email_reports"
    __table_args__ = (
        UniqueConstraint("report_date", "report_key", name="uq_email_reports_date_key"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    report_date: date = Field(index=True)
    report_key: str = Field(index=True, max_length=80)
    total_counts: dict[str, int] = Field(sa_column=Column(JSON, nullable=False))
    account_summaries: list[dict[str, Any]] = Field(sa_column=Column(JSON, nullable=False))
    important_items: list[dict[str, Any]] = Field(sa_column=Column(JSON, nullable=False))
    action_required_items: list[dict[str, Any]] = Field(sa_column=Column(JSON, nullable=False))
    cleanup_results: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    report_metadata: dict[str, Any] = Field(sa_column=Column("metadata", JSON, nullable=False))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
        index=True,
    )


class EmailReportDecision(SQLModel, table=True):
    __tablename__ = "email_report_decisions"
    __table_args__ = (
        UniqueConstraint("report_id", "item_id", name="uq_email_report_decisions_report_item"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    report_id: int = Field(
        sa_column=Column(ForeignKey("email_reports.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    item_id: str = Field(max_length=120)
    decision: str = Field(max_length=32)
    decided_by: Optional[int] = Field(
        default=None,
        sa_column=Column(ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    decided_by_username: str = Field(default="", max_length=120)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
        index=True,
    )

    # Mailbox execution lifecycle. The mailbox operation runs on an external
    # trusted worker (OpenClaw) that claims pending rows through the worker
    # API. `action` is the concrete mailbox op the worker should perform; the
    # worker is authoritative on exactly how that maps to IMAP/Gmail calls.
    action: str = Field(default="noop", max_length=16)
    status: str = Field(default="pending", max_length=16, index=True)
    attempts: int = Field(default=0)
    lease_token: Optional[str] = Field(default=None, max_length=64, index=True)
    lease_expires_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
    )
    error_code: Optional[str] = Field(default=None, max_length=64)
    error_message: Optional[str] = Field(default=None, max_length=1000)
    executed_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
    )
    last_attempt_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
    )
