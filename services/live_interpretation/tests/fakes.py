from __future__ import annotations

from collections.abc import Sequence

from app.interfaces import Transcript
from app.protocol import Language, SourceLanguage


class FakeTranscriber:
    def __init__(
        self, *, text: str = "sensitive transcript", language: str = "ko"
    ) -> None:
        self.text = text
        self.language = language
        self.started = False
        self.closed = False
        self.received_lengths: list[int] = []

    async def start(self) -> None:
        self.started = True

    async def close(self) -> None:
        self.closed = True

    async def transcribe(
        self, pcm16: bytes, source_language: SourceLanguage
    ) -> Transcript:
        self.received_lengths.append(len(pcm16))
        return Transcript(self.text, self.language)


class FakeTranslator:
    def __init__(self) -> None:
        self.started = False
        self.closed = False
        self.calls: list[tuple[str, str, tuple[str, ...]]] = []

    async def start(self) -> None:
        self.started = True

    async def close(self) -> None:
        self.closed = True

    async def translate(
        self, text: str, source_language: Language, target_languages: Sequence[Language]
    ) -> dict[Language, str]:
        self.calls.append((text, source_language, tuple(target_languages)))
        return {target: f"{target}:{text}" for target in target_languages}
