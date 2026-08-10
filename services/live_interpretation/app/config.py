"""Environment-backed configuration with fail-closed validation."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from .security import service_token_is_well_formed


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    try:
        value = default if raw is None else int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def _env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw = os.getenv(name)
    try:
        value = default if raw is None else float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().casefold()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be true or false")


def _validate_http_url(name: str, value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"{name} must be an absolute http(s) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(f"{name} must not contain credentials, a query, or a fragment")
    return value.rstrip("/")


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime limits are deliberately bounded even when supplied by environment."""

    service_token: str = field(repr=False)
    whisper_model: str = "large-v3-turbo"
    whisper_device: str = "cuda"
    whisper_compute_type: str = "float16"
    whisper_allow_cpu_fallback: bool = False
    whisper_cpu_compute_type: str = "int8"
    ollama_url: str = "http://192.168.219.117:11434"
    ollama_model: str = "qwen2.5:7b"
    max_sessions: int = 8
    inference_concurrency: int = 1
    session_start_timeout_seconds: float = 5.0
    frame_idle_timeout_seconds: float = 30.0
    max_session_seconds: int = 3_600
    max_start_message_bytes: int = 8_192
    max_frame_bytes: int = 65_536
    audio_queue_frames: int = 64
    transcription_timeout_seconds: float = 45.0
    translation_timeout_seconds: float = 20.0
    max_transcript_chars: int = 4_000
    vad_threshold: int = 450
    vad_frame_ms: int = 20
    vad_start_ms: int = 100
    vad_silence_ms: int = 600
    vad_pre_roll_ms: int = 200
    vad_min_speech_ms: int = 240
    vad_max_utterance_seconds: int = 20

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            service_token=os.getenv("INTERPRETATION_SERVICE_TOKEN", ""),
            whisper_model=os.getenv("WHISPER_MODEL", "large-v3-turbo"),
            whisper_device=os.getenv("WHISPER_DEVICE", "cuda"),
            whisper_compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "float16"),
            whisper_allow_cpu_fallback=_env_bool("WHISPER_ALLOW_CPU_FALLBACK", False),
            whisper_cpu_compute_type=os.getenv("WHISPER_CPU_COMPUTE_TYPE", "int8"),
            ollama_url=_validate_http_url(
                "OLLAMA_URL", os.getenv("OLLAMA_URL", "http://192.168.219.117:11434")
            ),
            ollama_model=os.getenv("OLLAMA_MODEL", "qwen2.5:7b"),
            max_sessions=_env_int("INTERPRETATION_MAX_SESSIONS", 8, 1, 64),
            inference_concurrency=_env_int(
                "INTERPRETATION_INFERENCE_CONCURRENCY", 1, 1, 4
            ),
            session_start_timeout_seconds=_env_float(
                "INTERPRETATION_SESSION_START_TIMEOUT_SECONDS", 5.0, 1.0, 30.0
            ),
            frame_idle_timeout_seconds=_env_float(
                "INTERPRETATION_FRAME_IDLE_TIMEOUT_SECONDS", 30.0, 5.0, 300.0
            ),
            max_session_seconds=_env_int(
                "INTERPRETATION_MAX_SESSION_SECONDS", 3_600, 60, 14_400
            ),
            max_start_message_bytes=_env_int(
                "INTERPRETATION_MAX_START_MESSAGE_BYTES", 8_192, 512, 65_536
            ),
            max_frame_bytes=_env_int(
                "INTERPRETATION_MAX_FRAME_BYTES", 65_536, 640, 262_144
            ),
            audio_queue_frames=_env_int(
                "INTERPRETATION_AUDIO_QUEUE_FRAMES", 64, 4, 512
            ),
            transcription_timeout_seconds=_env_float(
                "INTERPRETATION_TRANSCRIPTION_TIMEOUT_SECONDS", 45.0, 1.0, 180.0
            ),
            translation_timeout_seconds=_env_float(
                "INTERPRETATION_TRANSLATION_TIMEOUT_SECONDS", 20.0, 1.0, 120.0
            ),
            max_transcript_chars=_env_int(
                "INTERPRETATION_MAX_TRANSCRIPT_CHARS", 4_000, 100, 16_000
            ),
            vad_threshold=_env_int("INTERPRETATION_VAD_THRESHOLD", 450, 1, 32_767),
            vad_frame_ms=_env_int("INTERPRETATION_VAD_FRAME_MS", 20, 10, 100),
            vad_start_ms=_env_int("INTERPRETATION_VAD_START_MS", 100, 20, 1_000),
            vad_silence_ms=_env_int("INTERPRETATION_VAD_SILENCE_MS", 600, 100, 3_000),
            vad_pre_roll_ms=_env_int("INTERPRETATION_VAD_PRE_ROLL_MS", 200, 0, 1_000),
            vad_min_speech_ms=_env_int(
                "INTERPRETATION_VAD_MIN_SPEECH_MS", 240, 20, 3_000
            ),
            vad_max_utterance_seconds=_env_int(
                "INTERPRETATION_VAD_MAX_UTTERANCE_SECONDS", 20, 2, 60
            ),
        )

    def validate(self) -> None:
        token = self.service_token
        if not service_token_is_well_formed(token):
            raise ValueError(
                "INTERPRETATION_SERVICE_TOKEN must contain 32-512 URL-safe characters"
            )
        if (
            not self.whisper_model
            or not self.ollama_model
            or not self.whisper_cpu_compute_type
        ):
            raise ValueError("model names must not be empty")
        _validate_http_url("OLLAMA_URL", self.ollama_url)
        if 1_000 % self.vad_frame_ms:
            raise ValueError("INTERPRETATION_VAD_FRAME_MS must divide 1000 evenly")
        if self.vad_start_ms < self.vad_frame_ms:
            raise ValueError("VAD start duration must be at least one analysis frame")
        if self.vad_silence_ms < self.vad_frame_ms:
            raise ValueError("VAD silence duration must be at least one analysis frame")
