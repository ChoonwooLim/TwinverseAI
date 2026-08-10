# Twinverse Live Interpretation

GPU-hosted, final-result simultaneous interpretation for authenticated meeting
audio. The service receives PCM over one bounded WebSocket, splits utterances with
energy VAD, transcribes with `faster-whisper`, and translates with the local Ollama
`qwen2.5:7b` model.

The service is deployed independently on `twinverse-ai` and listens on **8201**.
It does not modify or share the web application's process lifecycle.

## Security and privacy boundary

- `Authorization: Bearer ...` is mandatory and compared with
  `hmac.compare_digest`. An empty server token fails closed.
- The token is supplied only through the root-owned
  `/etc/live-interpretation.env`; this repository contains no token value.
- PCM and transcripts exist only in bounded process memory while a segment is
  processed. There is no database, upload path, transcript file, or raw-content
  log statement.
- Uvicorn access logging is disabled by the systemd unit.
- Frame size, frame queue, session count, session duration, idle duration,
  transcript size, utterance duration, and model-call duration are bounded.
- One process and one GPU inference slot are the default. A timed-out native
  inference keeps its slot until its worker really exits, avoiding overlapping
  CUDA work after cancellation.
- `/health` is liveness only. `/ready` returns 200 only after the Whisper model
  completes a synthetic-silence inference warm-up and the configured Ollama model
  is available. Missing cuDNN therefore fails readiness before real audio arrives.

The consumer is responsible for its own transcript retention policy. Receiving a
`caption.source.final` or `caption.translation.final` event does not authorize
persistence.

## WebSocket contract

Endpoint: `WS /v1/stream`

Header:

```text
Authorization: Bearer $INTERPRETATION_SERVICE_TOKEN
```

The first client frame must be a JSON text frame:

```json
{
  "type": "session.start",
  "meeting_id": "main",
  "speaker_id": "opaque-participant-id",
  "epoch": 1,
  "source_language": "auto",
  "target_languages": ["ko", "ja", "en"]
}
```

Rules:

- `meeting_id`: bounded opaque room key, 1-128 characters. The accepted alphabet
  is `A-Z a-z 0-9 _ -`, the first character must be alphanumeric, and path/control
  characters are rejected. Legacy room key `main` is valid.
- `speaker_id`: opaque printable identifier, 1-128 characters. It is not assumed
  to be a database ID or UUID.
- `epoch`: integer `>= 1`; consumers use a new epoch after reconnect/restart and
  discard events from older epochs.
- `source_language`: `auto`, `ko`, `ja`, or `en`.
- `target_languages`: a non-empty unique subset of `ko`, `ja`, and `en`.
- Extra fields are rejected.

Every subsequent client frame must be binary, little-endian PCM16, 16,000 Hz,
mono. Frames of 20-100 ms are recommended. Empty, odd-byte, text, and oversized
frames are rejected.

### Server events

All post-start events contain `meeting_id`, `speaker_id`, `epoch`, and a monotonic
per-connection `sequence`.

Status:

```json
{
  "type": "caption.status",
  "meeting_id": "main",
  "speaker_id": "opaque-participant-id",
  "epoch": 1,
  "sequence": 1,
  "status": "active",
  "phase": "ready"
}
```

`status` is `active` or `degraded`. `phase` is `ready`, `speech`, `transcription`,
or `translation`; segment phases also include `segment_id`. A recoverable model
failure emits `degraded` with `component` (`transcription` or `translation`).

Final source transcript:

```json
{
  "type": "caption.source.final",
  "meeting_id": "main",
  "speaker_id": "opaque-participant-id",
  "epoch": 1,
  "sequence": 4,
  "segment_id": "1:1",
  "source_language": "ko",
  "text": "회의를 시작하겠습니다.",
  "started_at_ms": 200,
  "ended_at_ms": 1840
}
```

Final translation aggregate (one event containing every requested target,
including an identity target):

```json
{
  "type": "caption.translation.final",
  "meeting_id": "main",
  "speaker_id": "opaque-participant-id",
  "epoch": 1,
  "sequence": 6,
  "segment_id": "1:1",
  "source_language": "ko",
  "source_text": "회의를 시작하겠습니다.",
  "translations": {
    "ko": "회의를 시작하겠습니다.",
    "ja": "会議を始めます。",
    "en": "We will begin the meeting."
  },
  "started_at_ms": 200,
  "ended_at_ms": 1840
}
```

Error:

```json
{
  "type": "caption.error",
  "meeting_id": "main",
  "speaker_id": "opaque-participant-id",
  "epoch": 1,
  "sequence": 7,
  "code": "translation_failed",
  "message": "Translation failed",
  "recoverable": true
}
```

Before a valid `session.start`, an error event has no meeting fields or sequence.
Stable error codes include:

| Code | Meaning |
|---|---|
| `service_unavailable` | Models/configuration are not ready |
| `overloaded` | Concurrent-session capacity reached |
| `invalid_session_start` | First JSON frame failed schema validation |
| `session_start_timeout` | First JSON frame did not arrive in time |
| `binary_audio_required` | A text frame followed session start |
| `invalid_audio_frame` | PCM frame was empty or not 16-bit aligned |
| `audio_frame_too_large` | Frame exceeded the byte limit |
| `audio_backpressure` | Bounded frame queue filled |
| `audio_idle_timeout` | No audio arrived within the idle limit |
| `session_time_limit` | Connection reached its wall-clock limit |
| `transcription_failed` | Whisper failed or timed out for one segment |
| `unsupported_source_language` | Auto-detection was outside ko/ja/en |
| `translation_failed` | Ollama failed, timed out, or returned invalid JSON |

WebSocket close codes: 4401 unauthorized, 4400 invalid contract, 4408 start
timeout, 1009 oversized input, 1013 unavailable/backpressure, and 1011 internal
failure.

## Configuration

Required:

| Variable | Purpose |
|---|---|
| `INTERPRETATION_SERVICE_TOKEN` | 32-512 URL-safe characters (`A-Z a-z 0-9 - . _ ~`); shared securely with the calling backend |

Model defaults:

| Variable | Default |
|---|---|
| `WHISPER_MODEL` | `large-v3-turbo` |
| `WHISPER_DEVICE` | `cuda` |
| `WHISPER_COMPUTE_TYPE` | `float16` |
| `WHISPER_ALLOW_CPU_FALLBACK` | `false` |
| `WHISPER_CPU_COMPUTE_TYPE` | `int8` |
| `OLLAMA_URL` | `http://192.168.219.117:11434` |
| `OLLAMA_MODEL` | `qwen2.5:7b` |

Operational limits can be tuned with `INTERPRETATION_MAX_SESSIONS`,
`INTERPRETATION_INFERENCE_CONCURRENCY`,
`INTERPRETATION_SESSION_START_TIMEOUT_SECONDS`,
`INTERPRETATION_FRAME_IDLE_TIMEOUT_SECONDS`,
`INTERPRETATION_MAX_SESSION_SECONDS`,
`INTERPRETATION_MAX_START_MESSAGE_BYTES`, `INTERPRETATION_MAX_FRAME_BYTES`,
`INTERPRETATION_AUDIO_QUEUE_FRAMES`,
`INTERPRETATION_TRANSCRIPTION_TIMEOUT_SECONDS`,
`INTERPRETATION_TRANSLATION_TIMEOUT_SECONDS`,
`INTERPRETATION_MAX_TRANSCRIPT_CHARS`, and the `INTERPRETATION_VAD_*` variables
defined in `app/config.py`. Configuration values are range checked.

Do not put the service token in Git, a systemd unit, shell history, deployment
arguments, or this README. On `twinverse-ai`, create it interactively:

```bash
sudo install -o root -g root -m 0600 /dev/null /etc/live-interpretation.env
sudoedit /etc/live-interpretation.env
```

Add the required variable name and a cryptographically random URL-safe value, plus
any model overrides. The deployment script verifies ownership, mode, presence,
alphabet, and token length without printing the value.

## Local tests

The production model packages are lazy-loaded; contract tests use injected fake
transcriber/translator implementations and need no GPU or Ollama process.

```bash
cd services/live_interpretation
python -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

On Windows, use `.venv\Scripts\python` for the final two commands.

## GPU host prerequisites

- Ubuntu 24.04, Python 3.12, and a compatible NVIDIA driver. The requirements
  install CUDA 12 cuBLAS and cuDNN 9 wheels into the private venv; `launch.sh`
  resolves their `nvidia/*/lib` directories into `LD_LIBRARY_PATH` before
  CTranslate2 starts. Host `ldconfig` does not need a global cuDNN entry.
- Ollama reachable at `OLLAMA_URL` with `qwen2.5:7b` already pulled.
- Enough Hugging Face cache space for `large-v3-turbo`.
- The `live-interpretation` system user must be in the host's `video`/`render`
  groups when those groups exist. `scripts/deploy.sh` handles this idempotently.

Do not start more than one uvicorn worker: each worker loads its own Whisper model
and bypasses the shared GPU inference semaphore.

GPU initialization fails closed by default. If an operator explicitly accepts
slower Threadripper CPU service during a CUDA outage, set
`WHISPER_ALLOW_CPU_FALLBACK=true`; the fallback uses `int8` by default and emits
only a mode warning, never the failed exception or transcript. Remove the override
after GPU recovery.

## Deploy and operate

After the external environment file exists:

```bash
bash services/live_interpretation/scripts/deploy.sh
```

`DEPLOY_HOST` may select another SSH alias or `user@host`; its default is
`twinverse-ai`. The script runs local tests, stages via rsync, creates the system
user, installs dependencies, installs the hardened unit, restarts it, and waits
for readiness. It never copies or generates a secret.

Operational checks:

```bash
curl http://127.0.0.1:8201/health
curl --fail http://127.0.0.1:8201/ready
sudo systemctl status live-interpretation
sudo journalctl -u live-interpretation -n 100 --no-pager
```

The health endpoints intentionally return no model path, upstream URL, token, raw
audio, or transcript data.
