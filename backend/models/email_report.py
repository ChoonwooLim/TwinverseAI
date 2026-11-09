"""Persisted, metadata-only daily email reports and admin triage decisions.

Only summaries and judgement metadata are stored — never message bodies,
attachments, or credentials. Decisions record what an admin *wants* to do
with a given item; execution against the mailbox is intentionally out of
scope.
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
