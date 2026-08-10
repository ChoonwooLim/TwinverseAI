"""Authenticated bounded WebSocket audio session pipeline."""

from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from typing import cast

from pydantic import ValidationError
from starlette.websockets import WebSocket, WebSocketDisconnect

from .interfaces import DependencyError, DependencyProtocolError
from .protocol import Language, SessionStart, base_event
from .runtime import Runtime
from .security import bearer_token_is_valid
from .vad import EnergyVad, VadSegment

logger = logging.getLogger(__name__)
_LANGUAGES = {"ko", "ja", "en"}


class EventSender:
    def __init__(self, websocket: WebSocket, start: SessionStart) -> None:
        self._websocket = websocket
        self._start = start
        self._sequence = 0
        self._lock = asyncio.Lock()

    async def send(self, event_type: str, **payload: object) -> None:
        async with self._lock:
            self._sequence += 1
            event = base_event(self._start, event_type, self._sequence)
            event.update(payload)
            await self._websocket.send_json(event)

    async def status(self, status: str, **payload: object) -> None:
        await self.send("caption.status", status=status, **payload)

    async def error(self, code: str, message: str, *, recoverable: bool) -> None:
        await self.send(
            "caption.error", code=code, message=message, recoverable=recoverable
        )


async def _pre_session_error(websocket: WebSocket, code: str, message: str) -> None:
    await websocket.send_json(
        {
            "type": "caption.error",
            "code": code,
            "message": message,
            "recoverable": False,
        }
    )


async def _safe_close(websocket: WebSocket, code: int, reason: str) -> None:
    with suppress(RuntimeError, WebSocketDisconnect):
        await websocket.close(code=code, reason=reason)


async def handle_stream(websocket: WebSocket, runtime: Runtime) -> None:
    settings = runtime.settings
    if not bearer_token_is_valid(
        websocket.headers.get("authorization"), settings.service_token
    ):
        await _safe_close(websocket, 4401, "Unauthorized")
        return

    await websocket.accept()
    if not runtime.ready:
        await _pre_session_error(
            websocket, "service_unavailable", "Service is not ready"
        )
        await _safe_close(websocket, 1013, "Service unavailable")
        return
    if not await runtime.acquire_session():
        await _pre_session_error(websocket, "overloaded", "Session capacity reached")
        await _safe_close(websocket, 1013, "Try again later")
        return

    processor: asyncio.Task[None] | None = None
    try:
        start = await _receive_session_start(websocket, runtime)
        if start is None:
            return

        sender = EventSender(websocket, start)
        queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=settings.audio_queue_frames)
        await sender.status("active", phase="ready")
        processor = asyncio.create_task(
            _process_audio(queue, sender, start, runtime, websocket),
            name="interpretation-audio-processor",
        )
        await _receive_audio(websocket, queue, sender, runtime)
    finally:
        if processor is not None:
            processor.cancel()
            with suppress(asyncio.CancelledError, WebSocketDisconnect):
                await processor
        await runtime.release_session()


async def _receive_session_start(
    websocket: WebSocket, runtime: Runtime
) -> SessionStart | None:
    settings = runtime.settings
    try:
        message = await asyncio.wait_for(
            websocket.receive(), timeout=settings.session_start_timeout_seconds
        )
    except TimeoutError:
        await _pre_session_error(
            websocket, "session_start_timeout", "session.start required"
        )
        await _safe_close(websocket, 4408, "session.start timeout")
        return None

    if message.get("type") == "websocket.disconnect":
        return None
    text = message.get("text")
    if not isinstance(text, str):
        await _pre_session_error(
            websocket, "invalid_session_start", "First message must be JSON"
        )
        await _safe_close(websocket, 4400, "Invalid session.start")
        return None
    if len(text.encode("utf-8")) > settings.max_start_message_bytes:
        await _pre_session_error(
            websocket, "session_start_too_large", "session.start is too large"
        )
        await _safe_close(websocket, 1009, "session.start too large")
        return None

    try:
        return SessionStart.model_validate_json(text)
    except ValidationError:
        await _pre_session_error(
            websocket,
            "invalid_session_start",
            "session.start does not match the contract",
        )
        await _safe_close(websocket, 4400, "Invalid session.start")
        return None


async def _receive_audio(
    websocket: WebSocket,
    queue: asyncio.Queue[bytes],
    sender: EventSender,
    runtime: Runtime,
) -> None:
    settings = runtime.settings
    loop = asyncio.get_running_loop()
    deadline = loop.time() + settings.max_session_seconds

    while True:
        remaining = deadline - loop.time()
        if remaining <= 0:
            await sender.error(
                "session_time_limit",
                "Maximum session duration reached",
                recoverable=False,
            )
            await _safe_close(websocket, 1000, "Session duration reached")
            return
        timeout = min(settings.frame_idle_timeout_seconds, remaining)
        try:
            message = await asyncio.wait_for(websocket.receive(), timeout=timeout)
        except TimeoutError:
            if loop.time() >= deadline:
                await sender.error(
                    "session_time_limit",
                    "Maximum session duration reached",
                    recoverable=False,
                )
                await _safe_close(websocket, 1000, "Session duration reached")
            else:
                await sender.error(
                    "audio_idle_timeout", "Audio stream timed out", recoverable=True
                )
                await _safe_close(websocket, 1000, "Audio idle timeout")
            return

        if message.get("type") == "websocket.disconnect":
            return
        frame = message.get("bytes")
        if not isinstance(frame, bytes):
            await sender.error(
                "binary_audio_required",
                "Only binary PCM audio is allowed",
                recoverable=False,
            )
            await _safe_close(websocket, 4400, "Binary audio required")
            return
        if not frame or len(frame) % 2:
            await sender.error(
                "invalid_audio_frame",
                "PCM16 frame must be non-empty and aligned",
                recoverable=False,
            )
            await _safe_close(websocket, 4400, "Invalid audio frame")
            return
        if len(frame) > settings.max_frame_bytes:
            await sender.error(
                "audio_frame_too_large",
                "Audio frame exceeds the limit",
                recoverable=False,
            )
            await _safe_close(websocket, 1009, "Audio frame too large")
            return
        try:
            queue.put_nowait(frame)
        except asyncio.QueueFull:
            await sender.error(
                "audio_backpressure", "Audio queue capacity reached", recoverable=True
            )
            await _safe_close(websocket, 1013, "Audio backpressure")
            return


async def _process_audio(
    queue: asyncio.Queue[bytes],
    sender: EventSender,
    start: SessionStart,
    runtime: Runtime,
    websocket: WebSocket,
) -> None:
    settings = runtime.settings
    vad = EnergyVad(
        threshold=settings.vad_threshold,
        frame_ms=settings.vad_frame_ms,
        start_ms=settings.vad_start_ms,
        silence_ms=settings.vad_silence_ms,
        pre_roll_ms=settings.vad_pre_roll_ms,
        min_speech_ms=settings.vad_min_speech_ms,
        max_utterance_seconds=settings.vad_max_utterance_seconds,
    )
    segment_number = 0
    try:
        while True:
            frame = await queue.get()
            signals = vad.feed(frame)
            del frame
            for signal in signals:
                if signal.kind == "speech_started":
                    await sender.status("active", phase="speech")
                    continue
                if signal.segment is not None:
                    segment_number += 1
                    await _process_segment(
                        signal.segment, segment_number, sender, start, runtime
                    )
    except asyncio.CancelledError:
        raise
    except WebSocketDisconnect:
        return
    except Exception as exc:
        logger.error("audio processor failed (%s)", type(exc).__name__)
        with suppress(RuntimeError, WebSocketDisconnect):
            await sender.error(
                "internal_error", "Audio processing failed", recoverable=False
            )
        await _safe_close(websocket, 1011, "Audio processing failed")


async def _process_segment(
    segment: VadSegment,
    segment_number: int,
    sender: EventSender,
    start: SessionStart,
    runtime: Runtime,
) -> None:
    segment_id = f"{start.epoch}:{segment_number}"
    await sender.status("active", phase="transcription", segment_id=segment_id)
    try:
        transcript = await runtime.transcribe(segment.pcm16, start.source_language)
    except DependencyError:
        await sender.error(
            "transcription_failed", "Transcription failed", recoverable=True
        )
        await sender.status("degraded", phase="ready", component="transcription")
        return

    text = transcript.text.strip()
    if not text:
        await sender.status("active", phase="ready")
        return
    if len(text) > runtime.settings.max_transcript_chars:
        await sender.error(
            "transcript_too_large", "Transcript exceeds the limit", recoverable=True
        )
        await sender.status("active", phase="ready")
        return

    language_value = (
        transcript.language.lower()
        if start.source_language == "auto"
        else start.source_language
    )
    if language_value not in _LANGUAGES:
        await sender.error(
            "unsupported_source_language",
            "Detected source language is not supported",
            recoverable=True,
        )
        await sender.status("active", phase="ready")
        return
    source_language = cast(Language, language_value)

    await sender.send(
        "caption.source.final",
        segment_id=segment_id,
        source_language=source_language,
        text=text,
        started_at_ms=segment.started_at_ms,
        ended_at_ms=segment.ended_at_ms,
    )

    identity = {
        target: text for target in start.target_languages if target == source_language
    }
    translated_targets = [
        target for target in start.target_languages if target != source_language
    ]
    translations: dict[Language, str] = dict(identity)
    if translated_targets:
        await sender.status("active", phase="translation", segment_id=segment_id)
        try:
            translated = await runtime.translate(
                text, source_language, translated_targets
            )
            if set(translated) != set(translated_targets):
                raise DependencyProtocolError("translation languages do not match")
            translations.update(translated)
        except (DependencyError, DependencyProtocolError):
            await sender.error(
                "translation_failed", "Translation failed", recoverable=True
            )
            await sender.status("degraded", phase="ready", component="translation")
            return

    finalized_translations: dict[Language, str] = {}
    for target in start.target_languages:
        translated_text = translations.get(target)
        if not isinstance(translated_text, str) or not translated_text.strip():
            await sender.error(
                "translation_failed", "Translation failed", recoverable=True
            )
            await sender.status("degraded", phase="ready", component="translation")
            return
        finalized_translations[target] = translated_text.strip()

    await sender.send(
        "caption.translation.final",
        segment_id=segment_id,
        source_language=source_language,
        source_text=text,
        translations=finalized_translations,
        started_at_ms=segment.started_at_ms,
        ended_at_ms=segment.ended_at_ms,
    )
    await sender.status("active", phase="ready")
