from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.protocol import SessionStart
from app.security import bearer_token_is_valid


def test_service_token_is_hidden_from_repr(settings: Settings) -> None:
    assert settings.service_token not in repr(settings)


def test_missing_token_fails_closed() -> None:
    settings = Settings(service_token="")
    with pytest.raises(ValueError, match="INTERPRETATION_SERVICE_TOKEN"):
        settings.validate()
    assert bearer_token_is_valid("Bearer anything", "") is False


def test_segment_queue_and_transport_frame_limits_are_bounded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "INTERPRETATION_SERVICE_TOKEN",
        "test-token-0123456789-abcdefghijklmnop",
    )
    configured = Settings.from_env()
    assert configured.segment_queue_items == 4
    assert configured.max_frame_bytes == 65_536

    monkeypatch.setenv("INTERPRETATION_SEGMENT_QUEUE_ITEMS", "17")
    with pytest.raises(ValueError, match="INTERPRETATION_SEGMENT_QUEUE_ITEMS"):
        Settings.from_env()

    monkeypatch.setenv("INTERPRETATION_SEGMENT_QUEUE_ITEMS", "4")
    monkeypatch.setenv("INTERPRETATION_MAX_FRAME_BYTES", "65537")
    with pytest.raises(ValueError, match="INTERPRETATION_MAX_FRAME_BYTES"):
        Settings.from_env()


def test_bearer_token_uses_constant_time_comparison(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[bytes, bytes]] = []

    def compare(left: bytes, right: bytes) -> bool:
        calls.append((left, right))
        return True

    monkeypatch.setattr("app.security.hmac.compare_digest", compare)
    token = "expected-token-0123456789-abcdefghijkl"
    assert bearer_token_is_valid(f"Bearer {token}", token) is True
    assert len(calls) == 1
    assert len(calls[0][0]) == len(calls[0][1]) == 32
    assert calls[0][0] == calls[0][1]


def test_session_start_contract_accepts_only_supported_languages() -> None:
    payload = {
        "type": "session.start",
        "meeting_id": "main",
        "speaker_id": "opaque-speaker-7",
        "epoch": 1,
        "source_language": "auto",
        "target_languages": ["ko", "ja", "en"],
    }
    parsed = SessionStart.model_validate_json(json.dumps(payload))
    assert parsed.meeting_id == "main"
    assert parsed.target_languages == ["ko", "ja", "en"]

    payload["target_languages"] = ["ko", "fr"]
    with pytest.raises(ValidationError):
        SessionStart.model_validate_json(json.dumps(payload))


@pytest.mark.parametrize(
    "change",
    [
        {"epoch": 0},
        {"speaker_id": ""},
        {"target_languages": ["ko", "ko"]},
        {"meeting_id": "../private"},
        {"meeting_id": "room\\private"},
        {"unexpected": True},
    ],
)
def test_session_start_rejects_invalid_or_extra_fields(
    change: dict[str, object],
) -> None:
    payload = {
        "type": "session.start",
        "meeting_id": "main",
        "speaker_id": "speaker",
        "epoch": 1,
        "source_language": "ko",
        "target_languages": ["ja"],
    }
    payload.update(change)
    with pytest.raises(ValidationError):
        SessionStart.model_validate_json(json.dumps(payload))
