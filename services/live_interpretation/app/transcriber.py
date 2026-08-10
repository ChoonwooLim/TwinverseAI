"""faster-whisper production transcriber."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .config import Settings
from .interfaces import DependencyError, Transcript
from .protocol import SourceLanguage

logger = logging.getLogger(__name__)


class FasterWhisperTranscriber:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model: Any | None = None

    async def start(self) -> None:
        if self._model is not None:
            return
        try:
            self._model = await asyncio.to_thread(self._load_model)
        except Exception:
            raise DependencyError("transcriber initialization failed") from None

    def _load_model(self) -> Any:
        from faster_whisper import WhisperModel

        try:
            model = WhisperModel(
                self._settings.whisper_model,
                device=self._settings.whisper_device,
                compute_type=self._settings.whisper_compute_type,
            )
            self._warm_up(model)
            return model
        except Exception:
            if (
                self._settings.whisper_device != "cuda"
                or not self._settings.whisper_allow_cpu_fallback
            ):
                raise

        logger.warning(
            "CUDA Whisper unavailable; using explicitly enabled CPU fallback"
        )
        model = WhisperModel(
            self._settings.whisper_model,
            device="cpu",
            compute_type=self._settings.whisper_cpu_compute_type,
        )
        self._warm_up(model)
        return model

    @staticmethod
    def _warm_up(model: Any) -> None:
        """Run synthetic silence so missing CUDA runtime libraries fail readiness."""

        import numpy as np

        synthetic_silence = np.zeros(1_600, dtype=np.float32)
        segments, _ = model.transcribe(
            synthetic_silence,
            language="en",
            beam_size=1,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=False,
            word_timestamps=False,
        )
        for _ in segments:
            pass

    async def close(self) -> None:
        self._model = None

    async def transcribe(
        self, pcm16: bytes, source_language: SourceLanguage
    ) -> Transcript:
        if self._model is None:
            raise DependencyError("transcriber is unavailable")
        try:
            return await asyncio.to_thread(
                self._transcribe_sync, pcm16, source_language
            )
        except DependencyError:
            raise
        except Exception:
            raise DependencyError("transcription failed") from None

    def _transcribe_sync(
        self, pcm16: bytes, source_language: SourceLanguage
    ) -> Transcript:
        import numpy as np

        audio = np.frombuffer(pcm16, dtype="<i2").astype(np.float32) / 32_768.0
        requested_language = None if source_language == "auto" else source_language
        segments, info = self._model.transcribe(
            audio,
            language=requested_language,
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=False,
            word_timestamps=False,
        )
        text = "".join(segment.text for segment in segments).strip()
        detected = requested_language or str(info.language).lower()
        return Transcript(text=text, language=detected)
