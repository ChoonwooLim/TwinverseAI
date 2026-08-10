from __future__ import annotations

import pytest

from app.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        service_token="test-token-0123456789-abcdefghijklmnop",
        max_sessions=2,
        inference_concurrency=1,
        session_start_timeout_seconds=1.0,
        frame_idle_timeout_seconds=5.0,
        max_session_seconds=60,
        max_start_message_bytes=2_048,
        max_frame_bytes=6_400,
        audio_queue_frames=8,
        transcription_timeout_seconds=2.0,
        translation_timeout_seconds=2.0,
        vad_threshold=100,
        vad_frame_ms=20,
        vad_start_ms=20,
        vad_silence_ms=40,
        vad_pre_roll_ms=0,
        vad_min_speech_ms=20,
        vad_max_utterance_seconds=2,
    )
