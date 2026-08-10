"""Public WebSocket protocol models and event builders."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Language = Literal["ko", "ja", "en"]
SourceLanguage = Literal["auto", "ko", "ja", "en"]
SpeakerId = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=128,
        pattern=r"^[^\x00-\x1f\x7f]+$",
    ),
]
MeetingId = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$",
    ),
]


class SessionStart(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    type: Literal["session.start"]
    meeting_id: MeetingId
    speaker_id: SpeakerId
    epoch: int = Field(ge=1, le=2_147_483_647)
    source_language: SourceLanguage
    target_languages: list[Language] = Field(min_length=1, max_length=3)

    @field_validator("target_languages")
    @classmethod
    def targets_must_be_unique(cls, value: list[Language]) -> list[Language]:
        if len(value) != len(set(value)):
            raise ValueError("target_languages must not contain duplicates")
        return value


def base_event(
    start: SessionStart, event_type: str, sequence: int
) -> dict[str, object]:
    return {
        "type": event_type,
        "meeting_id": start.meeting_id,
        "speaker_id": start.speaker_id,
        "epoch": start.epoch,
        "sequence": sequence,
    }
