"""
Live interpretation WebSocket proxy.

Browser <-> this backend <-> `live_interpretation` GPU service on twinverse-ai:8201.

The GPU service requires an `Authorization: Bearer <service token>` header that
browsers can't set on a WebSocket. This backend terminates the browser socket,
authenticates the user via first-message JWT, and opens an upstream socket with
the shared service token (kept server-side).

To prevent a client from spoofing meeting membership, the `meeting_id` in the
URL path overrides anything in the client's `session.start` frame, and
`speaker_id` is forced to the authenticated user's id.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from utils.ws_auth import authenticate_ws_first_message

logger = logging.getLogger("twinverse.live_interpretation")

router = APIRouter()


INTERPRETATION_SERVICE_URL = os.getenv(
    "INTERPRETATION_SERVICE_URL", "ws://192.168.219.117:8201/v1/stream"
).strip()
INTERPRETATION_SERVICE_TOKEN = os.getenv("INTERPRETATION_SERVICE_TOKEN", "").strip()


# Mirrors the live_interpretation `meeting_id` validation (README + protocol.py):
# 1-128 chars, [A-Za-z0-9_-], first char alphanumeric.
_MEETING_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")


async def _send_json_safe(ws: WebSocket, payload: dict[str, Any]) -> None:
    try:
        await ws.send_json(payload)
    except Exception:
        pass


async def _close_safe(ws: WebSocket, code: int) -> None:
    try:
        await ws.close(code=code)
    except Exception:
        pass


@router.websocket("/interpretation/{meeting_id}")
async def interpretation_ws(ws: WebSocket, meeting_id: str) -> None:
    """Proxy browser audio stream to the GPU interpretation service.

    Protocol (browser side):
      1. Client connects to `/ws/interpretation/{meeting_id}`.
      2. Client sends first frame `{"op": "auth", "token": "<jwt>"}`.
      3. Server replies `{"op": "ready"}` once the upstream handshake is open.
      4. Client sends the `session.start` JSON frame described in
         `services/live_interpretation/README.md`, then binary PCM frames.
         Server overrides `meeting_id` and `speaker_id` before forwarding.
      5. Caption events (`caption.source.final`, `caption.translation.final`,
         `caption.status`, `caption.error`) flow back to the client verbatim.
    """
    await ws.accept()

    if not _MEETING_ID_RE.match(meeting_id):
        await _send_json_safe(
            ws,
            {
                "type": "caption.error",
                "code": "invalid_meeting_id",
                "message": "meeting_id must be 1-128 chars of [A-Za-z0-9_-], first char alphanumeric",
                "recoverable": False,
            },
        )
        await _close_safe(ws, 4400)
        return

    user = await authenticate_ws_first_message(ws, required_role=None)
    if user is None:
        return

    if not INTERPRETATION_SERVICE_URL or not INTERPRETATION_SERVICE_TOKEN:
        await _send_json_safe(
            ws,
            {
                "type": "caption.error",
                "code": "service_unavailable",
                "message": "interpretation upstream is not configured",
                "recoverable": False,
            },
        )
        await _close_safe(ws, 1011)
        return

    try:
        from websockets.asyncio.client import connect as ws_connect
    except ImportError:
        await _send_json_safe(
            ws,
            {
                "type": "caption.error",
                "code": "missing_dep",
                "message": "websockets>=13 not installed on backend",
                "recoverable": False,
            },
        )
        await _close_safe(ws, 1011)
        return

    try:
        upstream = await ws_connect(
            INTERPRETATION_SERVICE_URL,
            additional_headers={"Authorization": f"Bearer {INTERPRETATION_SERVICE_TOKEN}"},
            max_size=2 * 1024 * 1024,
            ping_interval=20,
            ping_timeout=20,
        )
    except Exception as e:
        logger.exception("interpretation upstream connect failed")
        await _send_json_safe(
            ws,
            {
                "type": "caption.error",
                "code": "upstream_unreachable",
                "message": str(e)[:300],
                "recoverable": False,
            },
        )
        await _close_safe(ws, 1011)
        return

    await _send_json_safe(ws, {"op": "ready", "meeting_id": meeting_id})

    speaker_id = f"user:{user.id}"

    async def pump_client_to_upstream() -> None:
        session_start_seen = False
        try:
            while True:
                msg = await ws.receive()
                if msg.get("type") == "websocket.disconnect":
                    break

                text = msg.get("text")
                data = msg.get("bytes")

                if text is not None:
                    if not session_start_seen:
                        # Override meeting_id/speaker_id to prevent spoofing;
                        # keep every other field so the upstream's schema
                        # validator sees exactly what the client intended.
                        try:
                            parsed = json.loads(text)
                        except json.JSONDecodeError:
                            await upstream.send(text)
                            continue
                        if isinstance(parsed, dict) and parsed.get("type") == "session.start":
                            parsed["meeting_id"] = meeting_id
                            parsed["speaker_id"] = speaker_id
                            session_start_seen = True
                            await upstream.send(json.dumps(parsed, ensure_ascii=False))
                        else:
                            await upstream.send(text)
                    else:
                        await upstream.send(text)
                elif data is not None:
                    await upstream.send(data)
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.exception("interpretation: client->upstream pump failed")
        finally:
            try:
                await upstream.close()
            except Exception:
                pass

    async def pump_upstream_to_client() -> None:
        try:
            async for frame in upstream:
                if isinstance(frame, (bytes, bytearray)):
                    await ws.send_bytes(bytes(frame))
                else:
                    await ws.send_text(frame)
        except Exception:
            logger.exception("interpretation: upstream->client pump failed")
        finally:
            try:
                await ws.close()
            except Exception:
                pass

    await asyncio.gather(
        pump_client_to_upstream(),
        pump_upstream_to_client(),
        return_exceptions=True,
    )
