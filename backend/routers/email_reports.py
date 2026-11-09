"""Email report ingestion and admin read APIs.

Only bounded metadata and summaries are accepted. Message bodies, attachments,
credentials, and arbitrary metadata are intentionally outside the schema.
"""
from __future__ import annotations

import os
import re
import secrets
from datetime import date, datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, func, select

from database import get_session
from deps import require_admin
from models import EmailReport, User

admin_router = APIRouter()
ingest_router = APIRouter()
ingest_security = HTTPBearer(auto_error=False)

PROHIBITED_KEYS = {
    "apikey", "attachment", "attachments", "authorization", "body", "bodyhtml",
    "bodytext", "content", "cookie", "credential", "credentials", "fullbody",
    "fullcontent", "fulltext", "html", "messagebody", "messagecontent", "messagehtml",
    "messagetext", "password", "passwd", "raw", "rawbody", "rawcontent", "secret",
    "text", "token",
}
PROHIBITED_KEY_PREFIXES = ("attachment", "body", "fullbody", "messagebody", "rawbody")
PROHIBITED_KEY_SUFFIXES = (
    "accesskey", "apikey", "authorization", "cookie", "credential", "credentials",
    "password", "passwd", "privatekey", "secret", "token",
)
KEY_NORMALIZER = re.compile(r"[^a-z0-9]")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _reject_sensitive_fields(value: Any) -> Any:
    if isinstance(value, dict):
        for key, nested in value.items():
            normalized = KEY_NORMALIZER.sub("", str(key).lower())
            if (
                normalized in PROHIBITED_KEYS
                or normalized.startswith(PROHIBITED_KEY_PREFIXES)
                or normalized.endswith(PROHIBITED_KEY_SUFFIXES)
            ):
                raise ValueError(f"금지된 필드입니다: {key}")
            _reject_sensitive_fields(nested)
    elif isinstance(value, list):
        for nested in value:
            _reject_sensitive_fields(nested)
    return value


class StrictPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, str_strip_whitespace=True)


NonNegativeInt = Annotated[int, Field(strict=True, ge=0, le=2_000_000_000)]
ShortText = Annotated[str, Field(min_length=1, max_length=500)]


class TotalCounts(StrictPayload):
    total: NonNegativeInt
    important: NonNegativeInt
    action_required: NonNegativeInt = Field(alias="actionRequired")
    cleaned: NonNegativeInt


class AccountSummary(StrictPayload):
    account: Annotated[str, Field(min_length=3, max_length=320, pattern=r"^[^\s@]+@[^\s@]+$")]
    total: NonNegativeInt
    important: NonNegativeInt
    action_required: NonNegativeInt = Field(alias="actionRequired")
    note: Annotated[str, Field(default="", max_length=1000)]


class ReportItem(StrictPayload):
    id: Annotated[str, Field(default="", max_length=120)]
    subject: ShortText
    sender: Annotated[str, Field(default="", max_length=500)]
    account: Annotated[str, Field(default="", max_length=320)]
    received_at: datetime | None = Field(default=None, alias="receivedAt")
    reason: Annotated[str, Field(default="", max_length=1000)]
    summary: Annotated[str, Field(default="", max_length=1000)]


class CleanupResults(StrictPayload):
    archived: NonNegativeInt
    deleted: NonNegativeInt
    skipped: NonNegativeInt
    notes: Annotated[str, Field(default="", max_length=1000)]


class ReportMetadata(StrictPayload):
    source: Annotated[str, Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9._-]+$")]
    account_count: Annotated[int, Field(alias="accountCount", strict=True, ge=0, le=1000)]
    generated_at: datetime = Field(alias="generatedAt")


class EmailReportIngest(StrictPayload):
    report_date: date = Field(alias="reportDate")
    report_key: Annotated[str, Field(alias="reportKey", min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9._-]*$")]
    total_counts: TotalCounts = Field(alias="totalCounts")
    account_summaries: Annotated[list[AccountSummary], Field(alias="accountSummaries", max_length=100)]
    important_items: Annotated[list[ReportItem], Field(alias="importantItems", max_length=100)]
    action_required_items: Annotated[list[ReportItem], Field(alias="actionRequiredItems", max_length=100)]
    cleanup_results: CleanupResults = Field(alias="cleanupResults")
    metadata: ReportMetadata

    @model_validator(mode="before")
    @classmethod
    def reject_sensitive_fields(cls, value: Any) -> Any:
        return _reject_sensitive_fields(value)

    @model_validator(mode="after")
    def validate_aggregates(self) -> "EmailReportIngest":
        if self.metadata.account_count != len(self.account_summaries):
            raise ValueError("metadata.accountCount가 accountSummaries 항목 수와 일치하지 않습니다")
        if self.total_counts.action_required != len(self.action_required_items):
            raise ValueError("totalCounts.actionRequired가 actionRequiredItems 항목 수와 일치하지 않습니다")
        return self


def require_ingest_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(ingest_security),
) -> None:
    expected = os.getenv("EMAIL_REPORT_INGEST_TOKEN", "")
    if len(expected) < 16:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email report ingestion is not configured",
        )
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not secrets.compare_digest(credentials.credentials, expected)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ingestion token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _json(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json", by_alias=True)


def _detail(report: EmailReport) -> dict[str, Any]:
    return {
        "id": report.id,
        "reportDate": report.report_date.isoformat(),
        "reportKey": report.report_key,
        "totalCounts": report.total_counts,
        "accountSummaries": report.account_summaries,
        "importantItems": report.important_items,
        "actionRequiredItems": report.action_required_items,
        "cleanupResults": report.cleanup_results,
        "metadata": report.report_metadata,
        "createdAt": report.created_at.isoformat(),
        "updatedAt": report.updated_at.isoformat(),
    }


@ingest_router.post("/ingest")
def ingest_email_report(
    payload: EmailReportIngest,
    _: None = Depends(require_ingest_token),
    session: Session = Depends(get_session),
):
    report = session.exec(
        select(EmailReport).where(
            EmailReport.report_date == payload.report_date,
            EmailReport.report_key == payload.report_key,
        )
    ).first()
    created = report is None
    if report is None:
        report = EmailReport(report_date=payload.report_date, report_key=payload.report_key)

    report.total_counts = _json(payload.total_counts)
    report.account_summaries = [_json(item) for item in payload.account_summaries]
    report.important_items = [_json(item) for item in payload.important_items]
    report.action_required_items = [_json(item) for item in payload.action_required_items]
    report.cleanup_results = _json(payload.cleanup_results)
    report.report_metadata = _json(payload.metadata)
    report.updated_at = _utc_now()
    session.add(report)
    try:
        session.commit()
    except IntegrityError:
        # A concurrent first upload may win the unique (date, key) insert.
        session.rollback()
        report = session.exec(
            select(EmailReport).where(
                EmailReport.report_date == payload.report_date,
                EmailReport.report_key == payload.report_key,
            )
        ).first()
        if report is None:
            raise
        report.total_counts = _json(payload.total_counts)
        report.account_summaries = [_json(item) for item in payload.account_summaries]
        report.important_items = [_json(item) for item in payload.important_items]
        report.action_required_items = [_json(item) for item in payload.action_required_items]
        report.cleanup_results = _json(payload.cleanup_results)
        report.report_metadata = _json(payload.metadata)
        report.updated_at = _utc_now()
        session.add(report)
        session.commit()
        created = False
    session.refresh(report)
    return {"ok": True, "created": created, "id": report.id, "reportDate": report.report_date, "reportKey": report.report_key}


@admin_router.get("")
def list_email_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    report_key: str | None = Query(default=None, alias="reportKey", max_length=80),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    filters = []
    if report_key:
        filters.append(EmailReport.report_key == report_key)
    if date_from:
        filters.append(EmailReport.report_date >= date_from)
    if date_to:
        filters.append(EmailReport.report_date <= date_to)

    count_stmt = select(func.count(EmailReport.id))
    list_stmt = select(EmailReport)
    if filters:
        count_stmt = count_stmt.where(*filters)
        list_stmt = list_stmt.where(*filters)
    total = session.exec(count_stmt).one()
    reports = session.exec(
        list_stmt.order_by(col(EmailReport.report_date).desc(), col(EmailReport.updated_at).desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return {
        "items": [
            {
                "id": report.id,
                "reportDate": report.report_date.isoformat(),
                "reportKey": report.report_key,
                "totalCounts": report.total_counts,
                "accountCount": len(report.account_summaries),
                "source": report.report_metadata.get("source", ""),
                "generatedAt": report.report_metadata.get("generatedAt"),
                "updatedAt": report.updated_at.isoformat(),
            }
            for report in reports
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@admin_router.get("/{report_id}")
def get_email_report(
    report_id: int,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    report = session.get(EmailReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Email report not found")
    return _detail(report)
