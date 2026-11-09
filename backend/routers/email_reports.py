"""Email report ingestion and admin read/decision APIs.

Only bounded metadata and summaries are accepted. Message bodies, attachments,
credentials, and arbitrary metadata are intentionally outside the schema.
Decisions saved here record intent only — nothing is executed against the
mailbox from this service.
"""
from __future__ import annotations

import os
import re
import secrets
from hashlib import sha256
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, func, select

from database import get_session
from deps import require_admin
from models import EmailReport, EmailReportDecision, User

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
SENSITIVE_VALUE_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{16,}"),
    re.compile(r"(?i)\b(?:api[_ -]?key|password|passwd|secret|token)\s*[:=]\s*\S{8,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
)

PRIORITY_VALUES = {"urgent", "important", "reference"}
RISK_TAG_VALUES = {"payment", "security", "account", "deletion", "automation"}
DECISION_VALUES = {
    "keep",
    "trash",
    "auto_trash_similar",
    "always_keep_similar",
    "auto_archive",
    "decide_later",
}
# Decisions that represent "reviewed + settled" for digest purposes.
SETTLED_DECISIONS = {"keep", "trash", "auto_trash_similar", "always_keep_similar", "auto_archive"}
AUTOMATION_RISK_TAGS = {"deletion", "automation"}
AUTOMATION_DECISIONS = {"auto_trash_similar", "always_keep_similar", "auto_archive"}
MAX_ITEMS_PER_SECTION = 200
MAX_BULK_DECISIONS = MAX_ITEMS_PER_SECTION * 2
KST = ZoneInfo("Asia/Seoul")


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
    elif isinstance(value, str) and any(pattern.search(value) for pattern in SENSITIVE_VALUE_PATTERNS):
        # Never include the matched value in validation output or application logs.
        raise ValueError("비밀값 또는 인증정보로 보이는 문자열은 저장할 수 없습니다")
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
    # Fields below are optional and backward compatible — older payloads
    # omit them entirely and still validate.
    priority: Annotated[str, Field(default="reference", max_length=16)]
    urgency: Annotated[str, Field(default="", max_length=200)]
    deadline: datetime | None = Field(default=None)
    recommended_action: Annotated[str, Field(default="", max_length=500, alias="recommendedAction")]
    classification_basis: Annotated[str, Field(default="", max_length=500, alias="classificationBasis")]
    risk_tags: Annotated[list[str], Field(default_factory=list, max_length=8, alias="riskTags")]

    @model_validator(mode="after")
    def validate_enums(self) -> "ReportItem":
        if self.priority not in PRIORITY_VALUES:
            raise ValueError(
                f"priority 값은 {sorted(PRIORITY_VALUES)} 중 하나여야 합니다"
            )
        unknown_tags = [t for t in self.risk_tags if t not in RISK_TAG_VALUES]
        if unknown_tags:
            raise ValueError(
                f"허용되지 않은 riskTag: {unknown_tags}. 허용값: {sorted(RISK_TAG_VALUES)}"
            )
        if len(self.risk_tags) != len(set(self.risk_tags)):
            raise ValueError("riskTags에 중복된 값이 있습니다")
        return self


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
    important_items: Annotated[list[ReportItem], Field(alias="importantItems", max_length=MAX_ITEMS_PER_SECTION)]
    action_required_items: Annotated[list[ReportItem], Field(alias="actionRequiredItems", max_length=MAX_ITEMS_PER_SECTION)]
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


class DecisionInput(StrictPayload):
    @model_validator(mode="before")
    @classmethod
    def reject_sensitive_values(cls, value: Any) -> Any:
        return _reject_sensitive_fields(value)

    item_id: Annotated[str, Field(alias="itemId", min_length=1, max_length=120)]
    decision: Annotated[str, Field(min_length=1, max_length=32)]

    @model_validator(mode="after")
    def validate_decision(self) -> "DecisionInput":
        if self.decision not in DECISION_VALUES:
            raise ValueError(
                f"decision 값은 {sorted(DECISION_VALUES)} 중 하나여야 합니다"
            )
        return self


class DecisionBatch(StrictPayload):
    decisions: Annotated[list[DecisionInput], Field(min_length=1, max_length=MAX_BULK_DECISIONS)]

    @model_validator(mode="after")
    def validate_unique_item_ids(self) -> "DecisionBatch":
        seen: set[str] = set()
        duplicates: list[str] = []
        for d in self.decisions:
            if d.item_id in seen:
                duplicates.append(d.item_id)
            seen.add(d.item_id)
        if duplicates:
            raise ValueError(f"itemId 중복: {sorted(set(duplicates))}")
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


def _item_identity(item: dict[str, Any]) -> str:
    return "\x1f".join(
        str(item.get(key) or "").strip()
        for key in ("account", "sender", "subject", "receivedAt")
    )


def _legacy_item_id(item: dict[str, Any], section: str, index: int) -> str:
    """Build a stable, opaque ID for pre-v2 items that did not supply one."""
    identity = _item_identity(item)
    # The same legacy item was often emitted in both old sections. Keep its ID
    # section-independent so the response can suppress that duplicate. The
    # fallback keeps otherwise empty malformed rows distinct and deterministic.
    seed = identity if identity.strip("\x1f") else f"{section}\x1f{index}"
    digest = sha256(seed.encode("utf-8")).hexdigest()[:20]
    return f"legacy-mail-{digest}"


def _normalise_report_items(report: EmailReport) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return decision-safe items while preserving legacy report compatibility.

    Old collectors omitted ``id`` and some collectors accidentally reused an ID
    in both sections. The API adds deterministic IDs at its boundary rather than
    hiding those rows in the UI. No body content participates in the ID.
    """
    seen: dict[str, str] = {}

    def section_items(raw_items: list[dict[str, Any]] | None, section: str) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for index, raw in enumerate(raw_items or []):
            if not isinstance(raw, dict):
                continue
            item = dict(raw)
            identity = _item_identity(item)
            base_id = str(item.get("id") or "").strip() or _legacy_item_id(item, section, index)
            item_id = base_id
            if item_id in seen and seen[item_id] == identity:
                continue
            if item_id in seen:
                suffix = sha256(f"{section}:{index}:{base_id}".encode("utf-8")).hexdigest()[:10]
                item_id = f"{base_id[:108]}-{suffix}"
            seen[item_id] = identity
            item["id"] = item_id
            result.append(item)
        return result

    return (
        section_items(report.important_items, "important"),
        section_items(report.action_required_items, "action"),
    )


def _iter_items(report: EmailReport) -> list[dict[str, Any]]:
    """Return every decision-safe item across both report sections."""
    important, action_required = _normalise_report_items(report)
    return important + action_required


def _item_priority(item: dict[str, Any]) -> str:
    value = str(item.get("priority") or "").strip().lower()
    return value if value in PRIORITY_VALUES else "reference"


def _item_risk_tags(item: dict[str, Any]) -> list[str]:
    raw = item.get("riskTags") or []
    if not isinstance(raw, list):
        return []
    return [t for t in raw if isinstance(t, str) and t in RISK_TAG_VALUES]


def _parse_stored_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    # Legacy payloads allowed offset-less timestamps. Treat them as UTC so a
    # malformed legacy record cannot break an entire report response.
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def _is_today_actionable(item: dict[str, Any]) -> bool:
    """Heuristic: urgent priority OR deadline by today's KST end OR explicit urgency."""
    if _item_priority(item) == "urgent":
        return True
    urgency = str(item.get("urgency") or "")
    if "오늘" in urgency or "today" in urgency.lower():
        return True
    deadline = _parse_stored_datetime(item.get("deadline"))
    if deadline is None:
        return False
    tomorrow = _utc_now().astimezone(KST).date() + timedelta(days=1)
    end_of_today = datetime.combine(tomorrow, datetime.min.time(), tzinfo=KST)
    return deadline.astimezone(KST) < end_of_today


def _deadline_within_days(item: dict[str, Any], days: int) -> bool:
    deadline = _parse_stored_datetime(item.get("deadline"))
    if deadline is None:
        return False
    delta = deadline - _utc_now()
    return delta.total_seconds() <= days * 86400 and delta.total_seconds() >= -86400


def _summary_counts(report: EmailReport, decisions_by_id: dict[str, str] | None = None) -> dict[str, int]:
    """Aggregate decision-supporting counts for the report header.

    Returns the full set of metrics plus three top-level digest buckets that
    match the user-facing "즉시 처리 / 검토 / 자동화 후보" ask:

    - ``immediate``:  urgent priority OR today-actionable AND not yet settled
    - ``review``:    important (non-urgent) priority items that still lack a decision
    - ``automation``: items whose risk tags or recommended action point at an
                     automation rule (auto-archive/auto-trash/always-keep)

    Decisions already saved against an item take it out of ``immediate`` /
    ``review`` so the admin sees what's left to handle at a glance.
    """
    items = _iter_items(report)
    decisions_by_id = decisions_by_id or {}

    today_count = 0
    deadline_soon = 0
    risk_counts = {tag: 0 for tag in RISK_TAG_VALUES}
    immediate = 0
    review = 0
    automation = 0
    settled = 0
    pending_total = 0

    for item in items:
        is_today = _is_today_actionable(item)
        if is_today:
            today_count += 1
        if _deadline_within_days(item, 3):
            deadline_soon += 1
        tags = _item_risk_tags(item)
        for tag in tags:
            risk_counts[tag] += 1

        item_id = str(item.get("id") or "").strip()
        decision = decisions_by_id.get(item_id)
        priority = _item_priority(item)
        recommended = str(item.get("recommendedAction") or item.get("recommended_action") or "").lower()

        has_automation_signal = (
            bool(AUTOMATION_RISK_TAGS.intersection(tags))
            or "자동" in recommended
            or "auto" in recommended
            or decision in AUTOMATION_DECISIONS
        )
        if has_automation_signal:
            automation += 1

        if decision in SETTLED_DECISIONS:
            settled += 1
            continue

        pending_total += 1
        if priority == "urgent" or is_today:
            immediate += 1
        elif priority == "important":
            review += 1

    return {
        "todayActionable": today_count,
        "deadlineSoon": deadline_soon,
        "paymentOrSecurityRisk": risk_counts["payment"] + risk_counts["security"] + risk_counts["account"],
        "deletionSuggested": risk_counts["deletion"],
        "automationSuggested": risk_counts["automation"],
        # Explicit digest buckets the admin UI renders at the top.
        "immediate": immediate,
        "review": review,
        "automation": automation,
        "settled": settled,
        "pendingTotal": pending_total,
    }


def _decisions_by_id(session: Session, report_id: int | None) -> dict[str, str]:
    if report_id is None:
        return {}
    rows = session.exec(
        select(EmailReportDecision.item_id, EmailReportDecision.decision).where(
            EmailReportDecision.report_id == report_id
        )
    ).all()
    return {row[0]: row[1] for row in rows}


def _decisions_for_report(session: Session, report_id: int) -> list[dict[str, Any]]:
    rows = session.exec(
        select(EmailReportDecision)
        .where(EmailReportDecision.report_id == report_id)
        .order_by(col(EmailReportDecision.updated_at).desc(), col(EmailReportDecision.id).asc())
    ).all()
    return [
        {
            "itemId": row.item_id,
            "decision": row.decision,
            "decidedBy": row.decided_by,
            "decidedByUsername": row.decided_by_username,
            "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
        }
        for row in rows
    ]


def _detail(report: EmailReport, session: Session) -> dict[str, Any]:
    decisions = _decisions_for_report(session, report.id) if report.id is not None else []
    decisions_by_id = {row["itemId"]: row["decision"] for row in decisions}
    important_items, action_required_items = _normalise_report_items(report)
    return {
        "id": report.id,
        "reportDate": report.report_date.isoformat(),
        "reportKey": report.report_key,
        "totalCounts": report.total_counts,
        "accountSummaries": report.account_summaries,
        "importantItems": important_items,
        "actionRequiredItems": action_required_items,
        "cleanupResults": report.cleanup_results,
        "metadata": report.report_metadata,
        "createdAt": report.created_at.isoformat(),
        "updatedAt": report.updated_at.isoformat(),
        "summaryCounts": _summary_counts(report, decisions_by_id),
        "decisions": decisions,
        "decisionOptions": sorted(DECISION_VALUES),
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
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="from must be on or before to")
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

    # Prefetch decisions for all paged reports in a single query so the digest
    # badges in the list stay consistent with the detail view.
    report_ids = [r.id for r in reports if r.id is not None]
    decisions_map: dict[int, dict[str, str]] = {rid: {} for rid in report_ids}
    if report_ids:
        rows = session.exec(
            select(
                EmailReportDecision.report_id,
                EmailReportDecision.item_id,
                EmailReportDecision.decision,
            ).where(EmailReportDecision.report_id.in_(report_ids))
        ).all()
        for report_id, item_id, decision in rows:
            decisions_map.setdefault(report_id, {})[item_id] = decision

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
                "summaryCounts": _summary_counts(report, decisions_map.get(report.id, {})),
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
    return _detail(report, session)


def _collect_item_ids(report: EmailReport) -> set[str]:
    ids: set[str] = set()
    for item in _iter_items(report):
        item_id = item.get("id")
        if isinstance(item_id, str) and item_id:
            ids.add(item_id)
    return ids


@admin_router.post("/{report_id}/decisions")
def save_email_report_decisions(
    report_id: int,
    payload: DecisionBatch,
    user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    report = session.get(EmailReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Email report not found")
    known_ids = _collect_item_ids(report)
    unknown = [d.item_id for d in payload.decisions if d.item_id not in known_ids]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "보고서에 존재하지 않는 itemId가 포함되었습니다",
                "unknownItemIds": unknown[:20],
            },
        )

    existing_rows = session.exec(
        select(EmailReportDecision).where(EmailReportDecision.report_id == report_id)
    ).all()
    existing_by_id = {row.item_id: row for row in existing_rows}
    now = _utc_now()
    for incoming in payload.decisions:
        row = existing_by_id.get(incoming.item_id)
        if row is None:
            row = EmailReportDecision(
                report_id=report_id,
                item_id=incoming.item_id,
                decision=incoming.decision,
                decided_by=user.id,
                decided_by_username=user.username,
                created_at=now,
                updated_at=now,
            )
        else:
            row.decision = incoming.decision
            row.decided_by = user.id
            row.decided_by_username = user.username
            row.updated_at = now
        session.add(row)
    session.commit()
    return {
        "ok": True,
        "reportId": report_id,
        "savedCount": len(payload.decisions),
        "decisions": _decisions_for_report(session, report_id),
    }


def _delete_email_report_decision(
    report_id: int,
    item_id: str,
    session: Session,
):
    if len(item_id) > 120 or not item_id:
        raise HTTPException(status_code=400, detail="invalid itemId")
    row = session.exec(
        select(EmailReportDecision).where(
            EmailReportDecision.report_id == report_id,
            EmailReportDecision.item_id == item_id,
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    session.delete(row)
    session.commit()
    return {"ok": True}


@admin_router.delete("/{report_id}/decisions")
def reset_email_report_decision_query(
    report_id: int,
    item_id: str = Query(alias="itemId", min_length=1, max_length=120),
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Delete a decision using a query value, including IDs containing slashes."""
    return _delete_email_report_decision(report_id, item_id, session)


@admin_router.delete("/{report_id}/decisions/{item_id}")
def reset_email_report_decision(
    report_id: int,
    item_id: str,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Backward-compatible path form retained for existing clients."""
    return _delete_email_report_decision(report_id, item_id, session)
