"""
NPC Agent (Tier 2) — OpenClaw gateway WebSocket RPC proxy.

Tier 1 (Ollama, stateless chat) 는 `npc.py` 에 있고, 여기는 **에이전트 NPC** 용이다.
DeskRPG (tvdesk.twinverse.org) 에서 검증된 OpenClaw 방식을 계승:

- 각 NPC 는 OpenClaw gateway 의 persistent agent session 을 가진다.
- 클라이언트(UE5 컨테이너)가 이 백엔드의 WS `/api/npc/agent/stream` 에 붙으면,
  우리는 OpenClaw gateway (ws://host:18789) 로 한 hop 더 릴레이하면서
  `chat.send` 델타 스트림을 그대로 흘려보낸다.
- 비용/보안상 `OPENCLAW_TOKEN` 은 백엔드만 알고, UE5 컨테이너에는 노출하지 않는다.

현재 이 파일은 **스텁(skeleton)** 이다. 스펙 부록 C + 계획 Task 0.5.12 참조.
실제 RPC 포맷은 `C:\\WORK\\TwinverseAI\\deskrpg-master\\src\\lib\\openclaw-gateway.js` 가 SSOT.
"""

import os
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("twinverse.npc.agent")

router = APIRouter()

OPENCLAW_WS_URL = os.getenv(
    "OPENCLAW_WS_URL",
    "ws://192.168.219.117:18789",
)
OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN", "")
OPENCLAW_MODEL = os.getenv("OPENCLAW_MODEL", "ollama/qwen2.5:7b")

# Production deployments:
#   Office (this backend) -> LAN twinverse-ai (Ollama)
#   DeskRPG (tvdesk.twinverse.org) -> Hostinger VPS (ChatGPT Codex)
# The two instances are independent; do not cross-wire tokens.


class OpenClawNotConfigured(RuntimeError):
    pass


def _require_config() -> tuple[str, str]:
    if not OPENCLAW_WS_URL or not OPENCLAW_TOKEN:
        raise OpenClawNotConfigured(
            "OPENCLAW_WS_URL / OPENCLAW_TOKEN not set (see ai-shared-registry §3.5)"
        )
    return OPENCLAW_WS_URL, OPENCLAW_TOKEN


@router.websocket("/agent/stream")
async def npc_agent_stream(ws: WebSocket) -> None:
    """UE5 컨테이너 → 백엔드 → OpenClaw gateway relay.

    현재는 skeleton — 실제 gateway 연결은 Task 0.5.12 Step 3 에서 구현.
    클라이언트 프로토콜 (잠정):
      → {"op": "chat.send", "agentId": "...", "sessionKey": "...", "message": "..."}
      ← {"op": "chat.delta", "sessionKey": "...", "delta": "..."}
      ← {"op": "chat.done",  "sessionKey": "...", "final": "..."}
      ← {"op": "error", "code": "...", "message": "..."}
    """
    await ws.accept()
    try:
        _require_config()
    except OpenClawNotConfigured as e:
        await ws.send_json({"op": "error", "code": "not_configured", "message": str(e)})
        await ws.close(code=1011)
        return

    await ws.send_json({
        "op": "error",
        "code": "not_implemented",
        "message": "npc_agent stream is a stub. Implement in plan Task 0.5.12 Step 3.",
    })

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"op": "error", "code": "bad_json"})
                continue

            op = msg.get("op")
            if op == "chat.send":
                await _handle_chat_send_stub(ws, msg)
            elif op == "chat.abort":
                await ws.send_json({"op": "error", "code": "not_implemented", "message": "chat.abort stub"})
            else:
                await ws.send_json({"op": "error", "code": "unknown_op", "message": f"unknown op: {op}"})
    except WebSocketDisconnect:
        logger.info("npc_agent client disconnected")


async def _handle_chat_send_stub(ws: WebSocket, msg: dict[str, Any]) -> None:
    """실제 구현 전까지는 placeholder echo."""
    session_key = msg.get("sessionKey", "stub")
    text = f"[stub] would relay '{msg.get('message', '')}' to OpenClaw ({OPENCLAW_MODEL})"
    await ws.send_json({"op": "chat.delta", "sessionKey": session_key, "delta": text})
    await ws.send_json({"op": "chat.done", "sessionKey": session_key, "final": text})


# ---------------------------------------------------------------------------
# 구현 참고 (Task 0.5.12 Step 3 에서 채울 것):
#
#   import websockets
#   async with websockets.connect(OPENCLAW_WS_URL) as gw:
#       # 1) pairing / hello handshake (deskrpg-master/src/lib/openclaw-gateway.js 참조)
#       # 2) chat.send RPC 포워딩
#       # 3) delta 수신 → ws.send_json(op=chat.delta, delta=...)
#       # 4) 완료 이벤트 → chat.done
#
# 보안:
#   - OPENCLAW_TOKEN 은 UE5 컨테이너로 절대 흘러가지 않게 할 것
#   - 클라이언트가 임의 agentId 를 주장하지 못하도록 슬롯 manifest 의 npc 목록과 교차 검증
# ---------------------------------------------------------------------------
