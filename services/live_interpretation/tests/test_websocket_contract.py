from __future__ import annotations

import logging
from array import array
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.interfaces import DependencyError
from app.main import create_app
from tests.fakes import FakeTranscriber, FakeTranslator


def _start_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "type": "session.start",
        "meeting_id": "main",
        "speaker_id": "opaque-speaker",
        "epoch": 3,
        "source_language": "auto",
        "target_languages": ["ko", "ja", "en"],
    }
    payload.update(overrides)
    return payload


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _pcm(value: int, milliseconds: int = 20) -> bytes:
    return array("h", [value] * (16_000 * milliseconds // 1_000)).tobytes()


def test_health_and_readiness(settings) -> None:  # type: ignore[no-untyped-def]
    transcriber = FakeTranscriber()
    translator = FakeTranslator()
    app = create_app(settings=settings, transcriber=transcriber, translator=translator)

    with TestClient(app) as client:
        health = client.get("/health")
        ready = client.get("/ready")

    assert health.status_code == 200
    assert health.json() == {"status": "ok", "service": "live-interpretation"}
    assert health.headers["cache-control"] == "no-store"
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready", "active_sessions": 0}
    assert transcriber.closed and translator.closed


def test_websocket_rejects_missing_or_wrong_bearer_token(settings) -> None:  # type: ignore[no-untyped-def]
    app = create_app(
        settings=settings,
        transcriber=FakeTranscriber(),
        translator=FakeTranslator(),
    )
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as missing:
            with client.websocket_connect("/v1/stream"):
                pass
        with pytest.raises(WebSocketDisconnect) as wrong:
            with client.websocket_connect("/v1/stream", headers=_headers("x" * 40)):
                pass

    assert missing.value.code == 4401
    assert wrong.value.code == 4401


def test_first_message_must_match_session_start_contract(settings) -> None:  # type: ignore[no-untyped-def]
    app = create_app(
        settings=settings,
        transcriber=FakeTranscriber(),
        translator=FakeTranslator(),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/stream", headers=_headers(settings.service_token)
        ) as websocket:
            websocket.send_json(_start_payload(epoch=0))
            event = websocket.receive_json()

    assert event == {
        "type": "caption.error",
        "code": "invalid_session_start",
        "message": "session.start does not match the contract",
        "recoverable": False,
    }


def test_oversized_audio_frame_is_rejected(settings) -> None:  # type: ignore[no-untyped-def]
    limited = replace(settings, max_frame_bytes=640)
    app = create_app(
        settings=limited,
        transcriber=FakeTranscriber(),
        translator=FakeTranslator(),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/stream", headers=_headers(limited.service_token)
        ) as websocket:
            websocket.send_json(_start_payload())
            ready = websocket.receive_json()
            assert ready["status"] == "active"
            assert ready["phase"] == "ready"
            websocket.send_bytes(b"\0" * 642)
            event = websocket.receive_json()

    assert event["type"] == "caption.error"
    assert event["code"] == "audio_frame_too_large"
    assert event["recoverable"] is False


def test_stream_emits_final_source_and_all_translations_without_logging_content(
    settings,
    caplog: pytest.LogCaptureFixture,  # type: ignore[no-untyped-def]
) -> None:
    transcriber = FakeTranscriber(text="sensitive transcript", language="ko")
    translator = FakeTranslator()
    app = create_app(settings=settings, transcriber=transcriber, translator=translator)
    caplog.set_level(logging.DEBUG)

    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/stream", headers=_headers(settings.service_token)
        ) as websocket:
            start = _start_payload()
            websocket.send_json(start)
            events = [websocket.receive_json()]
            websocket.send_bytes(_pcm(2_000))
            websocket.send_bytes(_pcm(0))
            websocket.send_bytes(_pcm(0))
            while True:
                event = websocket.receive_json()
                events.append(event)
                if (
                    event["type"] == "caption.status"
                    and event["status"] == "active"
                    and event["phase"] == "ready"
                    and len(events) > 1
                ):
                    break

    source_events = [
        event for event in events if event["type"] == "caption.source.final"
    ]
    aggregate_events = [
        event for event in events if event["type"] == "caption.translation.final"
    ]
    assert [event["type"] for event in events] == [
        "caption.status",
        "caption.status",
        "caption.status",
        "caption.source.final",
        "caption.status",
        "caption.translation.final",
        "caption.status",
    ]
    assert len(source_events) == 1
    assert source_events[0]["text"] == "sensitive transcript"
    assert source_events[0]["source_language"] == "ko"
    assert len(aggregate_events) == 1
    assert aggregate_events[0] == {
        "type": "caption.translation.final",
        "meeting_id": start["meeting_id"],
        "speaker_id": "opaque-speaker",
        "epoch": 3,
        "sequence": 6,
        "segment_id": "3:1",
        "source_language": "ko",
        "source_text": "sensitive transcript",
        "translations": {
            "ko": "sensitive transcript",
            "ja": "ja:sensitive transcript",
            "en": "en:sensitive transcript",
        },
        "started_at_ms": 0,
        "ended_at_ms": 60,
    }
    assert all(event["meeting_id"] == start["meeting_id"] for event in events)
    assert [event["sequence"] for event in events] == list(range(1, len(events) + 1))
    assert all(
        "state" not in event for event in events if event["type"] == "caption.status"
    )
    assert all(
        event["status"] in {"active", "degraded"}
        for event in events
        if event["type"] == "caption.status"
    )
    assert translator.calls == [("sensitive transcript", "ko", ("ja", "en"))]
    assert transcriber.received_lengths
    assert "sensitive transcript" not in caplog.text


def test_dependency_start_failure_keeps_health_live_but_readiness_closed(
    settings,
) -> None:  # type: ignore[no-untyped-def]
    class BrokenTranscriber(FakeTranscriber):
        async def start(self) -> None:
            raise RuntimeError("must not be exposed")

    app = create_app(
        settings=settings,
        transcriber=BrokenTranscriber(),
        translator=FakeTranslator(),
    )
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}


def test_segment_dependency_failure_uses_namespaced_error_and_degraded_status(
    settings,
) -> None:  # type: ignore[no-untyped-def]
    class BrokenTranscriber(FakeTranscriber):
        async def transcribe(self, pcm16, source_language):  # type: ignore[no-untyped-def]
            raise DependencyError("private upstream detail")

    app = create_app(
        settings=settings,
        transcriber=BrokenTranscriber(),
        translator=FakeTranslator(),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/stream", headers=_headers(settings.service_token)
        ) as websocket:
            websocket.send_json(_start_payload(meeting_id="main"))
            assert websocket.receive_json()["type"] == "caption.status"
            websocket.send_bytes(_pcm(2_000))
            websocket.send_bytes(_pcm(0))
            websocket.send_bytes(_pcm(0))
            events = [websocket.receive_json() for _ in range(4)]

    assert [event["type"] for event in events] == [
        "caption.status",
        "caption.status",
        "caption.error",
        "caption.status",
    ]
    assert events[2]["code"] == "transcription_failed"
    assert events[2]["message"] == "Transcription failed"
    assert "private upstream detail" not in str(events)
    assert events[3]["status"] == "degraded"
    assert events[3]["phase"] == "ready"
    assert events[3]["component"] == "transcription"
