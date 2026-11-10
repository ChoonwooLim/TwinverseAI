from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, func, select

from models.email_report import EmailReport, EmailReportDecision
from routers.email_reports import (
    DECISION_VALUES,
    DECISION_TO_ACTION,
    MAX_EXECUTION_ATTEMPTS,
    AcknowledgeRequest,
    ClaimRequest,
    DecisionBatch,
    EmailReportIngest,
    _summary_counts,
    acknowledge_execution,
    claim_execution_batch,
    get_email_report,
    ingest_email_report,
    list_email_reports,
    require_ingest_token,
    require_worker_token,
    reset_email_report_decision,
    reset_email_report_decision_query,
    save_email_report_decisions,
)


class _FakeUser:
    """Minimal stand-in for models.User so we don't require a DB row."""

    def __init__(self, id: int = 1, username: str = "admin", role: str = "admin"):
        self.id = id
        self.username = username
        self.role = role


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


def payload_v2():
    """Payload exercising the new per-item fields (priority, risk tags, deadline, etc.)."""
    deadline = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat()
    data = {
        "reportDate": "2026-11-09",
        "reportKey": "gmail-daily",
        "totalCounts": {"total": 10, "important": 2, "actionRequired": 2, "cleaned": 1},
        "accountSummaries": [
            {
                "account": "owner@example.com",
                "total": 10,
                "important": 2,
                "actionRequired": 2,
                "note": "",
            }
        ],
        "importantItems": [
            {
                "id": "i1",
                "subject": "결제 승인 요청",
                "sender": "billing@stripe.example",
                "account": "owner@example.com",
                "receivedAt": "2026-11-09T07:00:00+09:00",
                "reason": "미결제 송장",
                "summary": "미결제 송장 1건",
                "priority": "urgent",
                "urgency": "오늘 안 처리 필요",
                "deadline": deadline,
                "recommendedAction": "결제 승인 또는 거부",
                "classificationBasis": "제목 키워드 + 발신자 도메인",
                "riskTags": ["payment", "security"],
                "sourceThreadId": "1847352912345678901",
            },
            {
                "id": "i2",
                "subject": "뉴스레터 확인",
                "sender": "newsletter@example.com",
                "account": "owner@example.com",
                "priority": "reference",
                "riskTags": ["deletion"],
            },
        ],
        "actionRequiredItems": [
            {
                "id": "a1",
                "subject": "서브스크립션 갱신",
                "sender": "billing@example.com",
                "account": "owner@example.com",
                "priority": "important",
                "riskTags": ["automation"],
            },
            {
                "id": "a2",
                "subject": "계정 보안 알림",
                "sender": "security@example.com",
                "account": "owner@example.com",
                "priority": "urgent",
                "riskTags": ["account"],
            },
        ],
        "cleanupResults": {"archived": 0, "deleted": 0, "skipped": 0, "notes": ""},
        "metadata": {
            "source": "openclaw-email-review",
            "accountCount": 1,
            "generatedAt": "2026-11-09T09:00:00+09:00",
        },
    }
    return data


def _memory_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(
        engine, tables=[EmailReport.__table__, EmailReportDecision.__table__]
    )
    return engine


def test_ingest_schema_rejects_bodies_secrets_and_unknown_fields():
    with_body = payload()
    with_body["actionRequiredItems"][0]["fullBody"] = "full message body"
    with pytest.raises(ValidationError, match="금지된 필드"):
        EmailReportIngest.model_validate(with_body)

    with_secret = payload()
    with_secret["metadata"]["apiKey"] = "should-never-arrive"
    with pytest.raises(ValidationError, match="금지된 필드"):
        EmailReportIngest.model_validate(with_secret)

    secret_in_summary = payload()
    secret_in_summary["actionRequiredItems"][0]["summary"] = (
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"
    )
    with pytest.raises(ValidationError, match="비밀값 또는 인증정보") as info:
        EmailReportIngest.model_validate(secret_in_summary)
    assert "abcdefghijklmnopqrstuvwxyz123456" not in str(info.value)


def test_ingest_token_is_required_and_constant_time_checked(monkeypatch):
    token = "unit-test-token-123456"
    monkeypatch.setenv("EMAIL_REPORT_INGEST_TOKEN", token)
    require_ingest_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))

    with pytest.raises(HTTPException) as info:
        require_ingest_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong-token-value"))
    assert info.value.status_code == 401


def test_ingestion_is_idempotent_by_report_date_and_key():
    engine = _memory_engine()

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


def test_ingestion_keeps_same_key_reports_for_different_dates_independent():
    engine = _memory_engine()
    first_data = payload()
    next_day_data = payload()
    next_day_data["reportDate"] = "2026-11-10"
    next_day_data["totalCounts"]["cleaned"] = 7

    with Session(engine) as session:
        first_result = ingest_email_report(EmailReportIngest.model_validate(first_data), None, session)
        next_result = ingest_email_report(EmailReportIngest.model_validate(next_day_data), None, session)
        reports = session.exec(
            select(EmailReport).order_by(EmailReport.report_date)
        ).all()

    assert first_result["created"] is True
    assert next_result["created"] is True
    assert first_result["id"] != next_result["id"]
    assert [str(report.report_date) for report in reports] == ["2026-11-09", "2026-11-10"]
    assert [report.total_counts["cleaned"] for report in reports] == [first_data["totalCounts"]["cleaned"], 7]


# ---------- new: backward-compat & schema extensions ----------


def test_legacy_payload_without_new_fields_still_validates_with_defaults():
    model = EmailReportIngest.model_validate(payload())
    item = model.action_required_items[0]
    assert item.priority == "reference"
    assert item.risk_tags == []
    assert item.deadline is None
    assert item.recommended_action == ""
    assert item.classification_basis == ""
    assert item.urgency == ""


def test_schema_rejects_unknown_priority_and_risk_tags():
    bad_priority = payload_v2()
    bad_priority["importantItems"][0]["priority"] = "critical"
    with pytest.raises(ValidationError, match="priority"):
        EmailReportIngest.model_validate(bad_priority)

    bad_tags = payload_v2()
    bad_tags["importantItems"][0]["riskTags"] = ["phishing"]
    with pytest.raises(ValidationError, match="riskTag"):
        EmailReportIngest.model_validate(bad_tags)

    dup_tags = payload_v2()
    dup_tags["importantItems"][0]["riskTags"] = ["payment", "payment"]
    with pytest.raises(ValidationError, match="중복"):
        EmailReportIngest.model_validate(dup_tags)


def test_source_thread_id_accepts_only_bounded_decimal_gmail_ids():
    valid = EmailReportIngest.model_validate(payload_v2())
    assert valid.important_items[0].source_thread_id == "1847352912345678901"

    non_decimal = payload_v2()
    non_decimal["importantItems"][0]["sourceThreadId"] = "https://evil.example/mail"
    with pytest.raises(ValidationError, match="sourceThreadId"):
        EmailReportIngest.model_validate(non_decimal)

    too_long = payload_v2()
    too_long["importantItems"][0]["sourceThreadId"] = "1" * 21
    with pytest.raises(ValidationError, match="sourceThreadId"):
        EmailReportIngest.model_validate(too_long)


def test_schema_rejects_arbitrary_source_url_fields():
    with_source_url = payload_v2()
    with_source_url["importantItems"][0]["sourceUrl"] = "https://evil.example/mail"

    with pytest.raises(ValidationError, match="sourceUrl"):
        EmailReportIngest.model_validate(with_source_url)


def test_schema_enforces_item_count_limit_for_action_required():
    big = payload()
    big["totalCounts"]["actionRequired"] = 201
    big["actionRequiredItems"] = [
        {"id": f"n{i}", "subject": f"메일 {i}"} for i in range(201)
    ]
    with pytest.raises(ValidationError):
        EmailReportIngest.model_validate(big)


# ---------- new: summary count heuristics ----------


def test_summary_counts_aggregate_urgency_deadlines_and_risk_tags():
    engine = _memory_engine()
    model = EmailReportIngest.model_validate(payload_v2())

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        counts = _summary_counts(report)

    # urgent priority OR deadline <= 1 day AND urgency contains '오늘'
    assert counts["todayActionable"] >= 2  # i1 (urgent+deadline+오늘) and a2 (urgent)
    assert counts["deadlineSoon"] == 1
    # payment, security, account tags across i1 + a2 → 3
    assert counts["paymentOrSecurityRisk"] == 3
    assert counts["deletionSuggested"] == 1
    assert counts["automationSuggested"] == 1


# ---------- new: decisions API ----------


def test_decision_schema_rejects_unknown_value_and_duplicates():
    with pytest.raises(ValidationError, match="decision"):
        DecisionBatch.model_validate({"decisions": [{"itemId": "x", "decision": "nuke"}]})

    with pytest.raises(ValidationError, match="itemId 중복"):
        DecisionBatch.model_validate({
            "decisions": [
                {"itemId": "x", "decision": "keep"},
                {"itemId": "x", "decision": "trash"},
            ]
        })

    with pytest.raises(ValidationError):
        DecisionBatch.model_validate({"decisions": []})


def test_decision_schema_rejects_free_form_note_to_avoid_sensitive_content():
    with pytest.raises(ValidationError):
        DecisionBatch.model_validate({
            "decisions": [{"itemId": "x", "decision": "keep", "note": "메일 원문을 붙이지 않음"}]
        })


def test_decision_values_snapshot_match_contract():
    required = {
        "keep",
        "trash",
        "auto_trash_similar",
        "always_keep_similar",
        "decide_later",
    }
    assert required.issubset(DECISION_VALUES)
    # Any additional decisions are acceptable as long as the required five
    # (per spec) are present. Catching a drop or typo matters more than
    # locking the exact size of the set.


def test_save_decisions_persists_upserts_and_rejects_unknown_item_ids():
    engine = _memory_engine()
    model = EmailReportIngest.model_validate(payload_v2())
    user = _FakeUser(id=7, username="opsadmin")

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        report_id = report.id

        batch = DecisionBatch.model_validate({
            "decisions": [
                {"itemId": "i1", "decision": "keep"},
                {"itemId": "a2", "decision": "auto_trash_similar"},
            ]
        })
        result = save_email_report_decisions(report_id, batch, user, session)
        assert result["savedCount"] == 2
        assert {d["itemId"] for d in result["decisions"]} == {"i1", "a2"}

        # Upsert: same itemId, new decision + attribution carries latest user
        other_user = _FakeUser(id=8, username="reviewer")
        update_batch = DecisionBatch.model_validate({
            "decisions": [{"itemId": "i1", "decision": "trash"}]
        })
        save_email_report_decisions(report_id, update_batch, other_user, session)
        row = session.exec(
            select(EmailReportDecision).where(EmailReportDecision.item_id == "i1")
        ).one()
        assert row.decision == "trash"
        assert row.decided_by == 8
        assert row.decided_by_username == "reviewer"

        # Unknown item IDs are rejected before anything new is written
        with pytest.raises(HTTPException) as info:
            save_email_report_decisions(
                report_id,
                DecisionBatch.model_validate(
                    {"decisions": [{"itemId": "ghost", "decision": "keep"}]}
                ),
                user,
                session,
            )
        assert info.value.status_code == 400
        assert "ghost" in info.value.detail.get("unknownItemIds", [])
        count_after = session.exec(select(func.count(EmailReportDecision.id))).one()
        assert count_after == 2  # i1 (upserted) + a2


def test_save_decisions_404_for_missing_report():
    engine = _memory_engine()
    user = _FakeUser()
    with Session(engine) as session:
        with pytest.raises(HTTPException) as info:
            save_email_report_decisions(
                9999,
                DecisionBatch.model_validate(
                    {"decisions": [{"itemId": "x", "decision": "keep"}]}
                ),
                user,
                session,
            )
    assert info.value.status_code == 404


def test_reset_decision_removes_row_and_404s_when_absent():
    engine = _memory_engine()
    model = EmailReportIngest.model_validate(payload_v2())
    user = _FakeUser()

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        save_email_report_decisions(
            report.id,
            DecisionBatch.model_validate(
                {"decisions": [{"itemId": "i1", "decision": "keep"}]}
            ),
            user,
            session,
        )
        assert reset_email_report_decision(report.id, "i1", user, session) == {"ok": True}
        remaining = session.exec(select(func.count(EmailReportDecision.id))).one()
        assert remaining == 0

        with pytest.raises(HTTPException) as info:
            reset_email_report_decision(report.id, "i1", user, session)
        assert info.value.status_code == 404


def test_query_reset_supports_item_ids_containing_slashes():
    engine = _memory_engine()
    data = payload()
    data["actionRequiredItems"][0]["id"] = "folder/message/42"
    model = EmailReportIngest.model_validate(data)

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        save_email_report_decisions(
            report.id,
            DecisionBatch.model_validate(
                {"decisions": [{"itemId": "folder/message/42", "decision": "keep"}]}
            ),
            _FakeUser(),
            session,
        )
        result = reset_email_report_decision_query(
            report.id, "folder/message/42", _FakeUser(), session
        )
        remaining = session.exec(select(func.count(EmailReportDecision.id))).one()

    assert result == {"ok": True}
    assert remaining == 0


def test_detail_endpoint_embeds_decisions_and_summary_counts():
    engine = _memory_engine()
    model = EmailReportIngest.model_validate(payload_v2())
    user = _FakeUser()

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        save_email_report_decisions(
            report.id,
            DecisionBatch.model_validate(
                {"decisions": [{"itemId": "i2", "decision": "trash"}]}
            ),
            user,
            session,
        )
        detail = get_email_report(report.id, user, session)

    assert detail["summaryCounts"]["todayActionable"] >= 2
    assert detail["decisions"][0]["itemId"] == "i2"
    assert detail["decisions"][0]["decision"] == "trash"
    assert detail["decisions"][0]["decidedByUsername"] == user.username
    assert detail["importantItems"][0]["sourceThreadId"] == "1847352912345678901"


def test_list_endpoint_exposes_summary_counts():
    engine = _memory_engine()
    model = EmailReportIngest.model_validate(payload_v2())
    with Session(engine) as session:
        ingest_email_report(model, None, session)
        page = list_email_reports(
            page=1,
            size=20,
            report_key=None,
            date_from=None,
            date_to=None,
            _=_FakeUser(),
            session=session,
        )
    assert page["total"] == 1
    assert "summaryCounts" in page["items"][0]
    assert page["items"][0]["summaryCounts"]["paymentOrSecurityRisk"] == 3


def test_list_endpoint_rejects_reversed_date_range():
    engine = _memory_engine()
    with Session(engine) as session, pytest.raises(HTTPException) as info:
        list_email_reports(
            page=1,
            size=20,
            report_key=None,
            date_from=datetime(2026, 11, 10).date(),
            date_to=datetime(2026, 11, 9).date(),
            _=_FakeUser(),
            session=session,
        )
    assert info.value.status_code == 400


def test_naive_legacy_deadline_is_treated_as_utc_without_crashing():
    engine = _memory_engine()
    legacy = payload_v2()
    legacy["importantItems"][0]["deadline"] = (
        datetime.now(timezone.utc) + timedelta(hours=2)
    ).replace(tzinfo=None).isoformat()
    model = EmailReportIngest.model_validate(legacy)

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        counts = _summary_counts(report)

    assert counts["deadlineSoon"] == 1


def test_legacy_items_without_ids_remain_visible_and_decidable():
    """Pre-v2 rows must not disappear merely because the collector omitted id."""
    engine = _memory_engine()
    legacy = payload()
    legacy["actionRequiredItems"][0].pop("id")
    model = EmailReportIngest.model_validate(legacy)
    user = _FakeUser()

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        first_detail = get_email_report(report.id, user, session)
        legacy_id = first_detail["actionRequiredItems"][0]["id"]
        second_detail = get_email_report(report.id, user, session)

        assert legacy_id.startswith("legacy-mail-")
        assert second_detail["actionRequiredItems"][0]["id"] == legacy_id

        result = save_email_report_decisions(
            report.id,
            DecisionBatch.model_validate(
                {"decisions": [{"itemId": legacy_id, "decision": "decide_later"}]}
            ),
            user,
            session,
        )

    assert result["savedCount"] == 1
    assert result["decisions"][0]["itemId"] == legacy_id


def test_duplicate_item_ids_are_exposed_as_unique_decision_targets():
    engine = _memory_engine()
    duplicate = payload_v2()
    duplicate["actionRequiredItems"][0]["id"] = "i1"
    model = EmailReportIngest.model_validate(duplicate)

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        detail = get_email_report(report.id, _FakeUser(), session)

    ids = [item["id"] for item in detail["importantItems"] + detail["actionRequiredItems"]]
    assert len(ids) == len(set(ids))
    assert ids.count("i1") == 1


def test_exact_duplicate_legacy_item_is_rendered_once_across_sections():
    engine = _memory_engine()
    duplicate = payload()
    shared = {
        "subject": "중복 알림",
        "sender": "alerts@example.com",
        "account": "owner@example.com",
        "receivedAt": "2026-11-09T09:00:00+09:00",
        "reason": "동일 항목",
        "summary": "동일한 메일",
    }
    duplicate["importantItems"] = [dict(shared)]
    duplicate["actionRequiredItems"] = [dict(shared)]
    duplicate["totalCounts"]["actionRequired"] = 1
    model = EmailReportIngest.model_validate(duplicate)

    with Session(engine) as session:
        ingest_email_report(model, None, session)
        report = session.exec(select(EmailReport)).one()
        detail = get_email_report(report.id, _FakeUser(), session)

    rendered = detail["importantItems"] + detail["actionRequiredItems"]
    assert len(rendered) == 1
    assert rendered[0]["id"].startswith("legacy-mail-")


# ---------- new: execution queue lifecycle ----------


def _save(session, report_id, decisions, user=None):
    return save_email_report_decisions(
        report_id,
        DecisionBatch.model_validate({"decisions": decisions}),
        user or _FakeUser(),
        session,
    )


def _seeded_report(session):
    ingest_email_report(EmailReportIngest.model_validate(payload_v2()), None, session)
    return session.exec(select(EmailReport)).one()


def test_saving_decision_queues_action_for_worker_and_defers_decide_later():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [
            {"itemId": "i1", "decision": "keep"},
            {"itemId": "i2", "decision": "trash"},
            {"itemId": "a1", "decision": "decide_later"},
            {"itemId": "a2", "decision": "auto_archive"},
        ])

        rows = {r.item_id: r for r in session.exec(select(EmailReportDecision)).all()}

    assert rows["i1"].action == "archive" and rows["i1"].status == "pending"
    assert rows["i2"].action == "trash" and rows["i2"].status == "pending"
    assert rows["a1"].action == "noop" and rows["a1"].status == "not_applicable"
    assert rows["a2"].action == "archive" and rows["a2"].status == "pending"
    # decide_later must never show up in the pending queue.
    assert rows["a1"].attempts == 0


def test_changing_a_decision_resets_execution_lifecycle_to_pending():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [{"itemId": "i1", "decision": "trash"}])
        row = session.exec(
            select(EmailReportDecision).where(EmailReportDecision.item_id == "i1")
        ).one()
        # Mark it as executed so we can observe the reset.
        row.status = "succeeded"
        row.executed_at = datetime.now(timezone.utc)
        row.attempts = 3
        row.error_code = None
        session.add(row)
        session.commit()

        _save(session, report.id, [{"itemId": "i1", "decision": "keep"}])
        row = session.exec(
            select(EmailReportDecision).where(EmailReportDecision.item_id == "i1")
        ).one()

    assert row.action == "archive"
    assert row.status == "pending"
    assert row.attempts == 0
    assert row.executed_at is None
    assert row.lease_token is None


def test_decision_to_action_contract_is_exhaustive():
    missing = DECISION_VALUES - set(DECISION_TO_ACTION.keys())
    assert not missing, f"DECISION_TO_ACTION missing entries for {sorted(missing)}"
    assert set(DECISION_TO_ACTION.values()) <= {"archive", "trash", "noop"}


def test_worker_token_fallback_to_ingest_token(monkeypatch):
    monkeypatch.delenv("EMAIL_REPORT_EXECUTION_TOKEN", raising=False)
    monkeypatch.setenv("EMAIL_REPORT_INGEST_TOKEN", "ingest-shared-token-1234567")
    require_worker_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="ingest-shared-token-1234567"))

    with pytest.raises(HTTPException) as info:
        require_worker_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong"))
    assert info.value.status_code == 401


def test_worker_token_prefers_execution_specific_secret(monkeypatch):
    monkeypatch.setenv("EMAIL_REPORT_EXECUTION_TOKEN", "worker-only-token-123456")
    monkeypatch.setenv("EMAIL_REPORT_INGEST_TOKEN", "ingest-separate-token-xx")
    require_worker_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="worker-only-token-123456"))
    with pytest.raises(HTTPException):
        require_worker_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="ingest-separate-token-xx"))


def test_claim_returns_bounded_metadata_and_marks_processing():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [
            {"itemId": "i1", "decision": "keep"},
            {"itemId": "i2", "decision": "trash"},
            {"itemId": "a1", "decision": "decide_later"},
        ])
        result = claim_execution_batch(
            ClaimRequest.model_validate({"limit": 10, "leaseSeconds": 60}),
            None,
            session,
        )

    # decide_later must not be handed to the worker.
    assert {item["itemId"] for item in result["items"]} == {"i1", "i2"}
    for item in result["items"]:
        assert item["leaseToken"] and len(item["leaseToken"]) >= 20
        assert item["action"] in {"archive", "trash"}
        assert item["attempts"] == 1
        payload_keys = set(item["message"].keys())
        # Only locator metadata — no body, summary, risk tags, reasoning, etc.
        assert payload_keys == {"account", "sender", "subject", "receivedAt", "sourceThreadId"}


def test_ack_succeeded_is_idempotent_and_terminal():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [{"itemId": "i2", "decision": "trash"}])
        claim = claim_execution_batch(
            ClaimRequest.model_validate({"limit": 1, "leaseSeconds": 60}),
            None,
            session,
        )
        item = claim["items"][0]
        ack1 = acknowledge_execution(
            AcknowledgeRequest.model_validate({
                "decisionId": item["decisionId"],
                "leaseToken": item["leaseToken"],
                "status": "succeeded",
            }),
            None,
            session,
        )
        # Replay with same lease token must still return 200/succeeded.
        ack2 = acknowledge_execution(
            AcknowledgeRequest.model_validate({
                "decisionId": item["decisionId"],
                "leaseToken": item["leaseToken"],
                "status": "succeeded",
            }),
            None,
            session,
        )
        # Different lease token after success must be rejected.
        with pytest.raises(HTTPException) as info:
            acknowledge_execution(
                AcknowledgeRequest.model_validate({
                    "decisionId": item["decisionId"],
                    "leaseToken": "A" * 32,
                    "status": "succeeded",
                }),
                None,
                session,
            )

    assert ack1["status"] == "succeeded" and ack2["status"] == "succeeded"
    assert info.value.status_code == 409


def test_ack_with_stale_lease_is_rejected_after_expired_lease_reclaim():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [{"itemId": "i2", "decision": "trash"}])

        first = claim_execution_batch(
            ClaimRequest.model_validate({"limit": 1, "leaseSeconds": 10}),
            None,
            session,
        )
        first_item = first["items"][0]

        # Force the lease to be expired.
        row = session.get(EmailReportDecision, first_item["decisionId"])
        row.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.add(row)
        session.commit()

        second = claim_execution_batch(
            ClaimRequest.model_validate({"limit": 1, "leaseSeconds": 60}),
            None,
            session,
        )
        second_item = second["items"][0]
        assert second_item["decisionId"] == first_item["decisionId"]
        assert second_item["leaseToken"] != first_item["leaseToken"]
        assert second_item["attempts"] == 2

        with pytest.raises(HTTPException) as info:
            acknowledge_execution(
                AcknowledgeRequest.model_validate({
                    "decisionId": first_item["decisionId"],
                    "leaseToken": first_item["leaseToken"],
                    "status": "succeeded",
                }),
                None,
                session,
            )
    assert info.value.status_code == 409


def test_ack_failure_requeues_until_max_attempts_then_terminates():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [{"itemId": "i2", "decision": "trash"}])

        for attempt in range(1, MAX_EXECUTION_ATTEMPTS + 1):
            claim = claim_execution_batch(
                ClaimRequest.model_validate({"limit": 1, "leaseSeconds": 60}),
                None,
                session,
            )
            assert len(claim["items"]) == 1, f"attempt {attempt} did not re-queue"
            item = claim["items"][0]
            assert item["attempts"] == attempt
            ack = acknowledge_execution(
                AcknowledgeRequest.model_validate({
                    "decisionId": item["decisionId"],
                    "leaseToken": item["leaseToken"],
                    "status": "failed",
                    "errorCode": "imap_timeout",
                    "errorMessage": "timed out",
                }),
                None,
                session,
            )
            if attempt < MAX_EXECUTION_ATTEMPTS:
                assert ack["status"] == "pending"
            else:
                assert ack["status"] == "failed"

        # Next claim must return nothing: the row is terminal.
        tail = claim_execution_batch(
            ClaimRequest.model_validate({"limit": 1, "leaseSeconds": 60}),
            None,
            session,
        )
    assert tail["items"] == []


def test_detail_endpoint_exposes_execution_fields():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [
            {"itemId": "i1", "decision": "keep"},
            {"itemId": "a1", "decision": "decide_later"},
        ])
        detail = get_email_report(report.id, _FakeUser(), session)

    rows_by_item = {row["itemId"]: row for row in detail["decisions"]}
    assert rows_by_item["i1"]["status"] == "pending"
    assert rows_by_item["i1"]["action"] == "archive"
    assert rows_by_item["a1"]["status"] == "not_applicable"
    assert detail["executionCounts"]["pending"] == 1
    assert detail["executionCounts"]["not_applicable"] == 1
    assert detail["executionCounts"]["succeeded"] == 0


def test_resetting_a_decision_removes_it_from_the_queue():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [{"itemId": "i2", "decision": "trash"}])
        reset_email_report_decision(report.id, "i2", _FakeUser(), session)

        remaining = claim_execution_batch(
            ClaimRequest.model_validate({"limit": 10, "leaseSeconds": 60}),
            None,
            session,
        )
    assert remaining["items"] == []


def test_ack_schema_rejects_unknown_status_and_short_token():
    with pytest.raises(ValidationError):
        AcknowledgeRequest.model_validate({
            "decisionId": 1,
            "leaseToken": "A" * 32,
            "status": "weird",
        })
    with pytest.raises(ValidationError):
        AcknowledgeRequest.model_validate({
            "decisionId": 1,
            "leaseToken": "short",
            "status": "succeeded",
        })
    with pytest.raises(ValidationError):
        AcknowledgeRequest.model_validate({
            "decisionId": 1,
            "leaseToken": "A" * 32,
            "status": "failed",
            "errorMessage": "x" * 5000,
        })


def test_claim_response_omits_summary_reason_and_risk_tags():
    engine = _memory_engine()
    with Session(engine) as session:
        report = _seeded_report(session)
        _save(session, report.id, [{"itemId": "i1", "decision": "keep"}])
        result = claim_execution_batch(
            ClaimRequest.model_validate({"limit": 1, "leaseSeconds": 60}),
            None,
            session,
        )
    item = result["items"][0]["message"]
    for forbidden in ("summary", "reason", "riskTags", "classificationBasis", "recommendedAction"):
        assert forbidden not in item
