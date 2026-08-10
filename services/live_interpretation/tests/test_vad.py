from __future__ import annotations

from array import array

from app.vad import EnergyVad


def _pcm(value: int, milliseconds: int) -> bytes:
    return array("h", [value] * (16_000 * milliseconds // 1_000)).tobytes()


def test_energy_vad_splits_speech_after_silence() -> None:
    vad = EnergyVad(
        threshold=500,
        frame_ms=20,
        start_ms=40,
        silence_ms=60,
        pre_roll_ms=20,
        min_speech_ms=80,
        max_utterance_seconds=2,
    )
    signals = vad.feed(_pcm(0, 40) + _pcm(2_000, 100) + _pcm(0, 80))

    assert [signal.kind for signal in signals] == ["speech_started", "utterance"]
    segment = signals[-1].segment
    assert segment is not None
    assert segment.pcm16
    assert segment.started_at_ms < segment.ended_at_ms
    assert segment.ended_at_ms <= 220


def test_energy_vad_drops_short_noise_burst() -> None:
    vad = EnergyVad(
        threshold=500,
        frame_ms=20,
        start_ms=20,
        silence_ms=40,
        pre_roll_ms=0,
        min_speech_ms=100,
        max_utterance_seconds=2,
    )
    signals = vad.feed(_pcm(2_000, 20) + _pcm(0, 60))
    assert [signal.kind for signal in signals] == ["speech_started"]


def test_energy_vad_buffers_only_complete_pcm_analysis_frames() -> None:
    vad = EnergyVad(
        threshold=500,
        frame_ms=20,
        start_ms=20,
        silence_ms=40,
        pre_roll_ms=0,
        min_speech_ms=20,
        max_utterance_seconds=2,
    )
    speech = _pcm(2_000, 20)
    assert vad.feed(speech[:100]) == []
    assert [signal.kind for signal in vad.feed(speech[100:])] == ["speech_started"]
