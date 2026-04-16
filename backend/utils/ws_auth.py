"""
WebSocket 첫 메시지 JWT 인증 유틸.

FastAPI 의 HTTPBearer 의존성은 WS 에서 작동하지 않는다 (브라우저가
Sec-WebSocket-Protocol 또는 query param 외엔 헤더 삽입 불가). 따라서
accept() 직후 첫 JSON 메시지 `{op: "auth", token: "Bearer <jwt>"}` 를
수신해 관리자 권한을 확인하는 패턴을 사용한다.

실패 시 close(code=4401 or 4403) 로 닫고 None 반환.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import WebSocket
from sqlmodel import Session, select

from database import engine
from models import User
from services.auth_service import decode_access_token

logger = logging.getLogger("twinverse.ws_auth")


AUTH_TIMEOUT_SEC = 10


async def authenticate_ws_first_message(ws: WebSocket, required_role: str | None = "admin") -> User | None:
    """Authenticate the client via the first JSON message.

    Expected payload: {"op": "auth", "token": "<jwt>"} or {"op":"auth","token":"Bearer <jwt>"}

    Returns the authenticated User on success. On failure sends an error frame,
    closes the socket with code 4401 (missing/invalid) or 4403 (role), returns None.
    Caller should `return` immediately when None is returned.
    """
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_SEC)
    except asyncio.TimeoutError:
        await _close(ws, 4401, "auth timeout")
        return None
    except Exception:
        await _close(ws, 4401, "auth receive failed")
        return None

    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        await _close(ws, 4401, "first message must be JSON {op:auth, token}")
        return None

    if not isinstance(msg, dict) or msg.get("op") != "auth":
        await _close(ws, 4401, "first op must be 'auth'")
        return None

    token = msg.get("token") or ""
    if isinstance(token, str) and token.lower().startswith("bearer "):
        token = token[7:].strip()
    if not token:
        await _close(ws, 4401, "missing token")
        return None

    payload = decode_access_token(token)
    if not payload:
        await _close(ws, 4401, "invalid token")
        return None

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        await _close(ws, 4401, "invalid subject")
        return None

    with Session(engine) as session:
        user = session.exec(select(User).where(User.id == user_id)).first()
    if not user or not user.is_active:
        await _close(ws, 4401, "user not found or inactive")
        return None

    if required_role == "admin" and user.role not in ("admin", "superadmin"):
        await _close(ws, 4403, "admin role required")
        return None
    if required_role == "superadmin" and user.role != "superadmin":
        await _close(ws, 4403, "superadmin role required")
        return None

    return user


async def _close(ws: WebSocket, code: int, reason: str) -> None:
    try:
        await ws.send_json({"op": "auth.error", "code": code, "message": reason})
    except Exception:
        pass
    try:
        await ws.close(code=code)
    except Exception:
        pass
