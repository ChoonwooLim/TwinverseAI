"""Bounded in-memory energy VAD for PCM16/16 kHz/mono audio."""

from __future__ import annotations

import math
import sys
from array import array
from collections import deque
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class VadSegment:
    pcm16: bytes
    started_at_ms: int
    ended_at_ms: int


@dataclass(frozen=True, slots=True)
class VadSignal:
    kind: Literal["speech_started", "utterance"]
    segment: VadSegment | None = None


class EnergyVad:
    """Split a byte stream into utterances using fixed-size RMS analysis frames.

    The implementation holds at most one configured utterance plus a short pre-roll
    in memory. It never writes audio to disk and does not retain completed segments.
    """

    sample_rate = 16_000
    sample_width = 2

    def __init__(
        self,
        *,
        threshold: int,
        frame_ms: int,
        start_ms: int,
        silence_ms: int,
        pre_roll_ms: int,
        min_speech_ms: int,
        max_utterance_seconds: int,
    ) -> None:
        self.threshold = threshold
        self.frame_ms = frame_ms
        self._frame_bytes = self.sample_rate * self.sample_width * frame_ms // 1_000
        self._start_frames = max(1, math.ceil(start_ms / frame_ms))
        self._silence_frames = max(1, math.ceil(silence_ms / frame_ms))
        self._pre_roll_frames = max(0, math.ceil(pre_roll_ms / frame_ms))
        self._min_active_frames = max(1, math.ceil(min_speech_ms / frame_ms))
        self._max_frames = max(1, max_utterance_seconds * 1_000 // frame_ms)

        self._carry = bytearray()
        self._pre_roll: deque[bytes] = deque(maxlen=self._pre_roll_frames or 1)
        self._current: list[bytes] = []
        self._speaking = False
        self._active_run = 0
        self._silence_run = 0
        self._active_frames = 0
        self._frame_index = 0
        self._segment_start_frame = 0

    @staticmethod
    def rms(pcm16: bytes) -> float:
        samples = array("h")
        samples.frombytes(pcm16)
        if sys.byteorder != "little":
            samples.byteswap()
        if not samples:
            return 0.0
        return math.sqrt(sum(sample * sample for sample in samples) / len(samples))

    def feed(self, pcm16: bytes) -> list[VadSignal]:
        self._carry.extend(pcm16)
        signals: list[VadSignal] = []
        while len(self._carry) >= self._frame_bytes:
            frame = bytes(self._carry[: self._frame_bytes])
            del self._carry[: self._frame_bytes]
            signals.extend(self._process_frame(frame))
        return signals

    def flush(self) -> list[VadSignal]:
        """Finalize an active utterance; an incomplete analysis frame is discarded."""

        self._carry.clear()
        if not self._speaking:
            return []
        segment = self._finalize(self._frame_index)
        return [VadSignal("utterance", segment)] if segment else []

    def _process_frame(self, frame: bytes) -> list[VadSignal]:
        active = self.rms(frame) >= self.threshold
        signals: list[VadSignal] = []

        if not self._speaking:
            if self._pre_roll_frames:
                self._pre_roll.append(frame)
            self._active_run = self._active_run + 1 if active else 0
            if self._active_run >= self._start_frames:
                self._speaking = True
                self._current = (
                    list(self._pre_roll) if self._pre_roll_frames else [frame]
                )
                self._segment_start_frame = self._frame_index - len(self._current) + 1
                self._active_frames = self._active_run
                self._silence_run = 0
                self._pre_roll.clear()
                signals.append(VadSignal("speech_started"))
        else:
            self._current.append(frame)
            if active:
                self._active_frames += 1
                self._silence_run = 0
            else:
                self._silence_run += 1

            if (
                self._silence_run >= self._silence_frames
                or len(self._current) >= self._max_frames
            ):
                segment = self._finalize(self._frame_index + 1)
                if segment:
                    signals.append(VadSignal("utterance", segment))

        self._frame_index += 1
        return signals

    def _finalize(self, end_frame: int) -> VadSegment | None:
        audio = b"".join(self._current)
        enough_speech = self._active_frames >= self._min_active_frames
        start_frame = self._segment_start_frame

        self._current = []
        self._speaking = False
        self._active_run = 0
        self._silence_run = 0
        self._active_frames = 0
        self._pre_roll.clear()

        if not enough_speech:
            return None
        return VadSegment(
            pcm16=audio,
            started_at_ms=start_frame * self.frame_ms,
            ended_at_ms=end_frame * self.frame_ms,
        )
