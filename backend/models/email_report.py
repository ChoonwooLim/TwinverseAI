"""Persisted, metadata-only daily email reports."""
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column, DateTime, JSON, UniqueConstraint
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
