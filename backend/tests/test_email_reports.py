from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, func, select

from models.email_report import EmailReport
from routers.email_reports import (
    EmailReportIngest,
    ingest_email_report,
    require_ingest_token,
)


def payload():
    return {
        "reportDate": "2026-11-09",
        "reportKey": "gmail-daily",
        "totalCounts": {"total": 21, "important": 3, "actionRequired": 1, "cleaned": 8},
        "accountSummaries": [
            {
                "account": "owner@example.com",
                "total": 21,
                "important": 3,
                "actionRequired": 1,
                "note": "받은편지함 4건, 미열람 2건",
            }
        ],
        "importantItems": [],
        "actionRequiredItems": [
            {
                "id": "42",
                "subject": "확인할 메일",
                "sender": "알림 <notice@example.com>",
                "account": "owner@example.com",
                "reason": "확인이 필요함",
            }
        ],
        "cleanupResults": {"archived": 3, "deleted": 5, "skipped": 0, "notes": "자동 정리"},
        "metadata": {
            "source": "openclaw-email-review",
            "accountCount": 1,
            "generatedAt": "2026-11-09T09:00:00+09:00",
        },
    }


def test_ingest_schema_rejects_bodies_secrets_and_unknown_fields():
    with_body = payload()
    with_body["actionRequiredItems"][0]["fullBody"] = "full message body"
    try:
        EmailReportIngest.model_validate(with_body)
        assert False, "body field must be rejected"
    except ValidationError as error:
        assert "금지된 필드" in str(error)

    with_secret = payload()
    with_secret["metadata"]["apiKey"] = "should-never-arrive"
    try:
        EmailReportIngest.model_validate(with_secret)
        assert False, "secret field must be rejected"
    except ValidationError as error:
        assert "금지된 필드" in str(error)


def test_ingest_token_is_required_and_constant_time_checked(monkeypatch):
    token = "unit-test-token-123456"
    monkeypatch.setenv("EMAIL_REPORT_INGEST_TOKEN", token)
    require_ingest_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))

    try:
        require_ingest_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong-token-value"))
        assert False, "wrong token must be rejected"
    except HTTPException as error:
        assert error.status_code == 401


def test_ingestion_is_idempotent_by_report_date_and_key():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine, tables=[EmailReport.__table__])

    first = EmailReportIngest.model_validate(payload())
    updated_data = payload()
    updated_data["totalCounts"]["cleaned"] = 10
    second = EmailReportIngest.model_validate(updated_data)

    with Session(engine) as session:
        first_result = ingest_email_report(first, None, session)
        second_result = ingest_email_report(second, None, session)
        count = session.exec(select(func.count(EmailReport.id))).one()
        stored = session.exec(select(EmailReport)).one()

    assert first_result["created"] is True
    assert second_result["created"] is False
    assert first_result["id"] == second_result["id"]
    assert count == 1
    assert stored.total_counts["cleaned"] == 10
