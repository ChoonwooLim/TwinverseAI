from __future__ import annotations

import asyncio

import pytest

from app.interfaces import Transcript
from app.runtime import Runtime
from tests.fakes import FakeTranscriber, FakeTranslator


class _CountingTranslator(FakeTranslator):
    def __init__(self, delay_seconds: float = 0.05) -> None:
        super().__init__()
        self.delay_seconds = delay_seconds
        self.active = 0
        self.max_active = 0

    async def translate(self, text, source_language, target_languages):  # type: ignore[no-untyped-def]
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            await asyncio.sleep(self.delay_seconds)
            return {target: f"{target}:{text}" for target in target_languages}
        finally:
            self.active -= 1


@pytest.mark.asyncio
async def test_ollama_calls_are_bounded_by_gpu_inference_semaphore(settings) -> None:  # type: ignore[no-untyped-def]
    translator = _CountingTranslator()
    runtime = Runtime(settings, FakeTranscriber(), translator)

    results = await asyncio.gather(
        runtime.translate("one", "ko", ["ja"]),
        runtime.translate("two", "ko", ["ja"]),
        runtime.translate("three", "ko", ["ja"]),
    )

    assert results == [
        {"ja": "ja:one"},
        {"ja": "ja:two"},
        {"ja": "ja:three"},
    ]
    assert translator.max_active == settings.inference_concurrency == 1


@pytest.mark.asyncio
async def test_cancelled_whisper_keeps_gpu_slot_until_native_work_finishes(
    settings,
) -> None:  # type: ignore[no-untyped-def]
    entered = asyncio.Event()
    release = asyncio.Event()

    class SlowTranscriber(FakeTranscriber):
        async def transcribe(self, pcm16, source_language):  # type: ignore[no-untyped-def]
            entered.set()
            await release.wait()
            return Transcript("late result", "ko")

    translator = _CountingTranslator(delay_seconds=0)
    runtime = Runtime(settings, SlowTranscriber(), translator)
    transcription = asyncio.create_task(runtime.transcribe(b"\0\0" * 320, "ko"))
    await entered.wait()

    transcription.cancel()
    with pytest.raises(asyncio.CancelledError):
        await transcription

    translation = asyncio.create_task(runtime.translate("next", "ko", ["ja"]))
    await asyncio.sleep(0)
    assert translator.active == 0

    release.set()
    assert await translation == {"ja": "ja:next"}
    await runtime.close()
