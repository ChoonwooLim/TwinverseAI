"""Dependency interfaces shared by production adapters and test fakes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from .protocol import Language, SourceLanguage


@dataclass(frozen=True, slots=True)
class Transcript:
    text: str
    language: str


class Transcriber(Protocol):
    async def start(self) -> None: ...

    async def close(self) -> None: ...

    async def transcribe(
        self, pcm16: bytes, source_language: SourceLanguage
    ) -> Transcript: ...


class Translator(Protocol):
    async def start(self) -> None: ...

    async def close(self) -> None: ...

    async def translate(
        self, text: str, source_language: Language, target_languages: Sequence[Language]
    ) -> dict[Language, str]: ...


class DependencyError(RuntimeError):
    """A dependency failed without exposing user content or upstream details."""


class DependencyProtocolError(DependencyError):
    """A dependency returned a response outside the required schema."""
