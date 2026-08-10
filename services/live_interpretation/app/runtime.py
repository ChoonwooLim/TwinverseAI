"""Shared dependency lifecycle, admission control, and inference limits."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine, Sequence
from typing import Any, TypeVar

from .config import Settings
from .interfaces import DependencyError, Transcript, Transcriber, Translator
from .protocol import Language, SourceLanguage

logger = logging.getLogger(__name__)
T = TypeVar("T")


class Runtime:
    def __init__(
        self, settings: Settings, transcriber: Transcriber, translator: Translator
    ) -> None:
        self.settings = settings
        self.transcriber = transcriber
        self.translator = translator
        self.state = "starting"
        self._active_sessions = 0
        self._session_lock = asyncio.Lock()
        self._inference_semaphore = asyncio.Semaphore(settings.inference_concurrency)
        self._detached_tasks: set[asyncio.Task[Any]] = set()

    @property
    def ready(self) -> bool:
        return self.state == "ready"

    @property
    def active_sessions(self) -> int:
        return self._active_sessions

    async def start(self) -> None:
        try:
            self.settings.validate()
            await self.transcriber.start()
            await self.translator.start()
        except Exception as exc:
            self.state = "unavailable"
            logger.error("interpretation runtime unavailable (%s)", type(exc).__name__)
            await self._close_dependencies()
            return
        self.state = "ready"
        logger.info("interpretation runtime ready")

    async def close(self) -> None:
        self.state = "stopping"
        if self._detached_tasks:
            done, pending = await asyncio.wait(self._detached_tasks, timeout=10.0)
            for task in done:
                self._consume_task(task)
            for task in pending:
                task.cancel()
        await self._close_dependencies()
        self.state = "stopped"

    async def _close_dependencies(self) -> None:
        for dependency in (self.translator, self.transcriber):
            try:
                await dependency.close()
            except Exception as exc:
                logger.warning("dependency shutdown failed (%s)", type(exc).__name__)

    async def acquire_session(self) -> bool:
        async with self._session_lock:
            if not self.ready or self._active_sessions >= self.settings.max_sessions:
                return False
            self._active_sessions += 1
            return True

    async def release_session(self) -> None:
        async with self._session_lock:
            self._active_sessions = max(0, self._active_sessions - 1)

    async def transcribe(
        self, pcm16: bytes, source_language: SourceLanguage
    ) -> Transcript:
        async def operation() -> Transcript:
            async with self._inference_semaphore:
                return await self.transcriber.transcribe(pcm16, source_language)

        return await self._with_timeout_preserving_worker(
            operation(),
            self.settings.transcription_timeout_seconds,
            "transcription timed out",
        )

    async def translate(
        self, text: str, source_language: Language, target_languages: Sequence[Language]
    ) -> dict[Language, str]:
        try:
            return await asyncio.wait_for(
                self.translator.translate(text, source_language, target_languages),
                timeout=self.settings.translation_timeout_seconds,
            )
        except TimeoutError:
            raise DependencyError("translation timed out") from None

    async def _with_timeout_preserving_worker(
        self, operation: Coroutine[Any, Any, T], timeout: float, timeout_message: str
    ) -> T:
        """Keep a timed-out GPU thread behind the semaphore until it really exits."""

        task = asyncio.create_task(operation)
        try:
            return await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
        except TimeoutError:
            self._track_detached(task)
            raise DependencyError(timeout_message) from None
        except asyncio.CancelledError:
            self._track_detached(task)
            raise

    def _track_detached(self, task: asyncio.Task[Any]) -> None:
        self._detached_tasks.add(task)
        task.add_done_callback(self._detached_tasks.discard)
        task.add_done_callback(self._consume_task)

    @staticmethod
    def _consume_task(task: asyncio.Task[Any]) -> None:
        if not task.cancelled():
            try:
                task.exception()
            except (asyncio.CancelledError, Exception):
                pass
