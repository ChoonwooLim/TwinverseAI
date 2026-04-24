"""
OpenClaw 풀 콘솔 admin 라우터 (C안).

에이전트 CRUD / 플러그인 on-off + 상세 config / 전역 config / 채팅 WS 릴레이 / 로그 WS.
페어링 UI (`admin_openclaw.py`) 와는 별도 prefix (`/api/admin/openclaw/console`) 로 분리.

권한: admin 이상. WS 엔드포인트는 first-message JWT auth 로 보호.
OpenClaw 토큰은 백엔드만 보유 — 브라우저/WS 클라이언트에는 절대 전달 금지.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shlex
from typing import Any

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import engine, get_session
from deps import require_admin
from models import User, OpenClawConversation, OpenClawMessage
from services import openclaw_cli as cli
from services.openclaw_ssh import CONTAINER, ensure_configured, ssh_run
from utils.ws_auth import authenticate_ws_first_message

logger = logging.getLogger("twinverse.openclaw.console")

router = APIRouter()


OPENCLAW_WS_URL = os.getenv("OPENCLAW_WS_URL", "").strip()
# OPENCLAW_TOKEN 은 env_vars 만이 유일한 진실 원천이다. 과거에 있던 runtime
# override / rotation 경로는 worker 간 state drift 를 만들어 chat WS 가
# token_mismatch 로 거부되는 문제를 일으켰으므로 전부 제거했다.
# 토큰을 바꾸려면 Orbitron 대시보드 env_vars 의 OPENCLAW_TOKEN 을 갱신하고
# 컨테이너를 재배포할 것. 게이트웨이 쪽 gateway.auth.token /
# gateway.remote.token 도 동일 값으로 유지되어야 한다.
OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN", "").strip()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AgentCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    displayName: str = Field(..., min_length=1, max_length=120)
    model: str = Field(..., min_length=1, max_length=120)
    systemPrompt: str | None = Field(None, max_length=32_000)


class AgentPatch(BaseModel):
    displayName: str | None = Field(None, max_length=120)
    theme: str | None = Field(None, max_length=60)
    emoji: str | None = Field(None, max_length=16)
    model: str | None = Field(None, max_length=120)
    systemPrompt: str | None = Field(None, max_length=32_000)


class PluginConfigUpdate(BaseModel):
    config: dict[str, Any]
    dryRun: bool = False


class ConfigBatchUpdate(BaseModel):
    pairs: dict[str, Any]
    dryRun: bool = False


class AgentFileWrite(BaseModel):
    content: str = Field(..., max_length=128_000)


class ConversationCreate(BaseModel):
    agent_id: str = Field(..., min_length=1, max_length=64)
    title: str | None = Field(None, max_length=200)


class ConversationPatch(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


def _conv_to_dict(c: OpenClawConversation) -> dict[str, Any]:
    return {
        "id": c.id,
        "agent_id": c.agent_id,
        "title": c.title,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
    }


def _msg_to_dict(m: OpenClawMessage) -> dict[str, Any]:
    attachments: list[Any] = []
    if m.attachments_json:
        try:
            attachments = json.loads(m.attachments_json) or []
        except Exception:
            attachments = []
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "attachments": attachments,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ---------------------------------------------------------------------------
# status / health
# ---------------------------------------------------------------------------

@router.get("/health")
def health(_: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return cli.gateway_health()


@router.get("/models")
def models_list_endpoint(_: User = Depends(require_admin)) -> dict[str, Any]:
    """List Ollama models available on twinverse-ai (usable as agent backends)."""
    ensure_configured()
    return {"models": cli.models_list()}


def _read_gateway_token_from_container() -> str:
    """Read raw `gateway.auth.token` from the OpenClaw container's openclaw.json.

    Uses SSH + docker exec — config CLI masks the value, so we bypass it.
    """
    ensure_configured()
    cmd = f"docker exec {shlex.quote(CONTAINER)} cat /data/.openclaw/openclaw.json"
    rc, out, err = ssh_run(cmd, timeout=15)
    if rc != 0:
        raise HTTPException(
            status_code=502,
            detail=f"read gateway config failed (rc={rc}): {(err or out).strip()[:300]}",
        )
    try:
        cfg = json.loads(out)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"gateway config JSON parse failed: {e}") from e
    token = (((cfg.get("gateway") or {}).get("auth") or {}).get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=502, detail="gateway.auth.token not found in config")
    return token


@router.get("/gateway/token")
def gateway_token_get(_: User = Depends(require_admin)) -> dict[str, Any]:
    """현재 LAN OpenClaw 게이트웨이 토큰과 백엔드 in-memory `OPENCLAW_TOKEN` 을 함께 반환.

    값이 불일치하면 **Orbitron 대시보드의 env_vars 에서 `OPENCLAW_TOKEN` 을
    게이트웨이 값으로 갱신한 뒤 컨테이너를 재배포**해야 한다. 과거에 있던 자동
    rotation / override 경로는 worker 간 state drift 를 유발해 제거되었다.
    """
    token = _read_gateway_token_from_container()
    backend_synced = (token == OPENCLAW_TOKEN)
    return {
        "token": token,
        "backendSynced": backend_synced,
        "backendTokenPrefix": (
            f"{OPENCLAW_TOKEN[:8]}…{OPENCLAW_TOKEN[-4:]}"
            if OPENCLAW_TOKEN and len(OPENCLAW_TOKEN) > 12
            else "(unset)"
        ),
    }


# ---------------------------------------------------------------------------
# agents
# ---------------------------------------------------------------------------

@router.get("/agents")
def agents_list_endpoint(
    with_role: bool = True,
    _: User = Depends(require_admin),
) -> dict[str, Any]:
    """List agents. `with_role=true` (default) inlines IDENTITY.md role snippet
    via one batched SSH call, eliminating the N+1 per-agent file fetch the
    chat tab used to drive from the browser — that pattern regularly saturated
    the backend thread pool and surfaced as upstream 502s.
    """
    ensure_configured()
    agents = cli.agents_list_with_roles() if with_role else cli.agents_list()
    return {"agents": agents}


@router.post("/agents")
def agents_create_endpoint(body: AgentCreate, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    result = cli.agents_add(body.id, body.displayName, body.model)
    if body.systemPrompt:
        try:
            cli.agents_files_set(body.id, "IDENTITY.md", body.systemPrompt)
        except HTTPException as e:
            logger.warning("agents_files_set failed after create: %s", e.detail)
            result["identityWarning"] = str(e.detail)[:300]
    return result


@router.delete("/agents/{agent_id}")
def agents_delete_endpoint(agent_id: str, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return cli.agents_delete(agent_id)


@router.patch("/agents/{agent_id}")
def agents_patch_endpoint(agent_id: str, body: AgentPatch, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    results: dict[str, Any] = {}
    if body.displayName is not None or body.theme is not None or body.emoji is not None:
        results["identity"] = cli.agents_set_identity(
            agent_id,
            display_name=body.displayName,
            theme=body.theme,
            emoji=body.emoji,
        )
    if body.model is not None:
        try:
            results["model"] = cli.agents_update_rpc(agent_id, {"model": body.model})
        except HTTPException as e:
            results["modelError"] = str(e.detail)[:300]
    if body.systemPrompt is not None:
        results["systemPrompt"] = cli.agents_files_set(agent_id, "IDENTITY.md", body.systemPrompt)
    return {"ok": True, "results": results}


@router.get("/agents/{agent_id}/files")
def agent_files_list_endpoint(agent_id: str, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"files": cli.agents_files_list(agent_id)}


@router.get("/agents/{agent_id}/files/{file_name}")
def agent_file_get_endpoint(agent_id: str, file_name: str, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"name": file_name, "content": cli.agents_files_get(agent_id, file_name)}


@router.get("/agents/{agent_id}/workspace-image")
def agent_workspace_image_endpoint(
    agent_id: str,
    path: str = Query(..., min_length=1, max_length=512),
    _: User = Depends(require_admin),
) -> Response:
    ensure_configured()
    data, media_type, filename = cli.agents_workspace_image_get(agent_id, path)
    safe_name = filename.replace('"', "")
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Cache-Control": "private, max-age=60",
            "Content-Disposition": f'inline; filename="{safe_name}"',
        },
    )


@router.put("/agents/{agent_id}/files/{file_name}")
def agent_file_put_endpoint(agent_id: str, file_name: str, body: AgentFileWrite, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return cli.agents_files_set(agent_id, file_name, body.content)


# ---------------------------------------------------------------------------
# plugins
# ---------------------------------------------------------------------------

@router.get("/plugins")
def plugins_list_endpoint(_: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"plugins": cli.plugins_list()}


@router.get("/plugins/{plugin_id}")
def plugin_inspect_endpoint(plugin_id: str, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"plugin": cli.plugin_inspect(plugin_id)}


@router.post("/plugins/{plugin_id}/enable")
def plugin_enable_endpoint(plugin_id: str, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return cli.plugin_enable(plugin_id)


@router.post("/plugins/{plugin_id}/disable")
def plugin_disable_endpoint(plugin_id: str, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return cli.plugin_disable(plugin_id)


@router.get("/plugins/{plugin_id}/config")
def plugin_config_get_endpoint(plugin_id: str, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"config": cli.plugin_config_get(plugin_id)}


@router.put("/plugins/{plugin_id}/config")
def plugin_config_put_endpoint(plugin_id: str, body: PluginConfigUpdate, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    if body.dryRun:
        return cli.config_set_batch({f"plugins.entries.{plugin_id}.config": body.config}, dry_run=True)
    return cli.plugin_config_set(plugin_id, body.config)


# ---------------------------------------------------------------------------
# config (global)
# ---------------------------------------------------------------------------

@router.get("/config")
def config_get_endpoint(key: str = "", _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"key": key, "value": cli.config_get(key, mask=True)}


@router.get("/config/schema")
def config_schema_endpoint(_: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"schema": cli.config_schema()}


@router.put("/config")
def config_put_endpoint(body: ConfigBatchUpdate, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return cli.config_set_batch(body.pairs, dry_run=body.dryRun)


@router.get("/config/audit")
def config_audit_endpoint(lines: int = 50, _: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"entries": cli.config_audit_tail(lines)}


# ---------------------------------------------------------------------------
# gateway RPC passthrough (admin only, narrow surface)
# ---------------------------------------------------------------------------

class RpcCall(BaseModel):
    method: str = Field(..., max_length=120)
    params: dict[str, Any] = Field(default_factory=dict)


RPC_ALLOWLIST = {
    "agents.list", "agents.update",
    "sessions.list", "sessions.get", "sessions.create", "sessions.delete",
    "sessions.send", "sessions.abort", "sessions.reset", "sessions.compact",
    "sessions.usage", "sessions.usage.logs", "sessions.usage.timeseries",
    "sessions.preview", "chat.history",
    "agent.identity.get", "doctor.memory.status", "channels.status",
    "health", "secrets.resolve",  # resolve uses aliases, not raw tokens
}


@router.post("/rpc")
def rpc_call_endpoint(body: RpcCall, _: User = Depends(require_admin)) -> Any:
    ensure_configured()
    if body.method not in RPC_ALLOWLIST:
        raise HTTPException(status_code=403, detail=f"RPC method not allowed: {body.method}")
    return {"result": cli.gateway_call(body.method, body.params)}


# ---------------------------------------------------------------------------
# WebSocket: chat relay (browser <-> backend <-> OpenClaw gateway)
# ---------------------------------------------------------------------------

SENSITIVE_RESPONSE_FIELDS = ("token", "accessToken", "refreshToken", "apiKey", "password", "secret")


def _strip_sensitive(obj: Any) -> Any:
    """Remove secret-looking keys from gateway responses before relaying to browser."""
    if isinstance(obj, dict):
        cleaned: dict[str, Any] = {}
        for k, v in obj.items():
            if isinstance(k, str) and any(s.lower() in k.lower() for s in SENSITIVE_RESPONSE_FIELDS):
                continue
            cleaned[k] = _strip_sensitive(v)
        return cleaned
    if isinstance(obj, list):
        return [_strip_sensitive(x) for x in obj]
    return obj


# ---------------------------------------------------------------------------
# Conversations (persistent chat history)
# ---------------------------------------------------------------------------

@router.get("/conversations")
def conversations_list(
    agent_id: str | None = None,
    user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    q = select(OpenClawConversation).where(OpenClawConversation.user_id == user.id)
    if agent_id:
        q = q.where(OpenClawConversation.agent_id == agent_id)
    rows = session.exec(q).all()
    rows.sort(key=lambda c: c.last_message_at or c.created_at, reverse=True)
    return {"conversations": [_conv_to_dict(c) for c in rows]}


@router.post("/conversations")
def conversations_create(
    body: ConversationCreate,
    user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    now = datetime.now()
    conv = OpenClawConversation(
        user_id=user.id,
        agent_id=body.agent_id,
        title=(body.title or "새 대화").strip() or "새 대화",
        created_at=now,
        updated_at=now,
    )
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return _conv_to_dict(conv)


@router.get("/conversations/{conv_id}")
def conversations_get(
    conv_id: int,
    user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    conv = session.get(OpenClawConversation, conv_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="conversation not found")
    msgs = session.exec(
        select(OpenClawMessage)
        .where(OpenClawMessage.conversation_id == conv_id)
        .order_by(OpenClawMessage.id)
    ).all()
    return {"conversation": _conv_to_dict(conv), "messages": [_msg_to_dict(m) for m in msgs]}


@router.patch("/conversations/{conv_id}")
def conversations_patch(
    conv_id: int,
    body: ConversationPatch,
    user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    conv = session.get(OpenClawConversation, conv_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="conversation not found")
    conv.title = body.title.strip() or conv.title
    conv.updated_at = datetime.now()
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return _conv_to_dict(conv)


@router.delete("/conversations/{conv_id}")
def conversations_delete(
    conv_id: int,
    user: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    conv = session.get(OpenClawConversation, conv_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="conversation not found")
    # delete messages first (no cascade configured)
    msgs = session.exec(
        select(OpenClawMessage).where(OpenClawMessage.conversation_id == conv_id)
    ).all()
    for m in msgs:
        session.delete(m)
    session.delete(conv)
    session.commit()
    return {"ok": True}


@router.websocket("/chat")
async def chat_ws(ws: WebSocket) -> None:
    """Browser <-> backend <-> OpenClaw gateway relay.

    OpenClaw gateway protocol (from dist/protocol-*.js):
      - Request frame:  {type:"req", id, method, params?}
      - Response frame: {type:"res", id, result? | error?}
      - Event frame:    {type:"event", event, payload?, seq?}
      - First message MUST be a `connect` request with client info + auth.token.
        Authorization HTTP header is NOT read by the gateway.

    Browser side speaks simple JSON-RPC ({id, method, params}) and expects
    server notifications as {method, params}. We translate in both directions.
    """
    await ws.accept()
    print("[chat_ws] STAGE accepted", flush=True)

    user = await authenticate_ws_first_message(ws, required_role="admin")
    if user is None:
        print("[chat_ws] STAGE auth_failed", flush=True)
        return
    print(f"[chat_ws] STAGE authed user={user.username}", flush=True)

    if not OPENCLAW_WS_URL or not OPENCLAW_TOKEN:
        print(f"[chat_ws] STAGE not_configured url={bool(OPENCLAW_WS_URL)} tok={bool(OPENCLAW_TOKEN)}", flush=True)
        await ws.send_json({"op": "error", "code": "not_configured", "message": "OPENCLAW_WS_URL/TOKEN not set"})
        await ws.close(code=1011)
        return
    print(f"[chat_ws] STAGE config_ok url={OPENCLAW_WS_URL} tok_len={len(OPENCLAW_TOKEN)}", flush=True)

    try:
        import websockets
        from websockets.asyncio.client import connect as ws_connect
    except ImportError:
        print("[chat_ws] STAGE missing_dep websockets", flush=True)
        await ws.send_json({"op": "error", "code": "missing_dep", "message": "websockets>=13 not installed"})
        await ws.close(code=1011)
        return
    print("[chat_ws] STAGE importing_ws_connect_ok", flush=True)

    try:
        print(f"[chat_ws] STAGE connecting url={OPENCLAW_WS_URL}", flush=True)
        gw = await ws_connect(
            OPENCLAW_WS_URL,
            # 16MB — fits ~12MB of base64 (≈9MB raw image) for llava vision attachments.
            max_size=16 * 1024 * 1024,
            ping_interval=20,
            ping_timeout=20,
        )
        print("[chat_ws] STAGE gateway_connected", flush=True)
    except Exception as e:
        print(f"[chat_ws] STAGE connect_failed err={e!r}", flush=True)
        logger.exception("openclaw gateway connect failed")
        await ws.send_json({"op": "error", "code": "gateway_unreachable", "message": str(e)[:300]})
        await ws.close(code=1011)
        return

    # --- gateway handshake: connect request + hello-ok ---
    connect_req = {
        "type": "req",
        "id": "tv-connect",
        "method": "connect",
        "params": {
            "minProtocol": 3,
            "maxProtocol": 3,
            # Identify as TUI (terminal operator UI) so gateway's
            # controlUi.dangerouslyDisableDeviceAuth=true applies —
            # otherwise requested scopes are wiped for non-paired clients.
            "client": {
                "id": "openclaw-tui",
                "displayName": "TwinverseAI admin console",
                "version": "1.0.0",
                "platform": "linux",
                "mode": "ui",
            },
            "caps": [],
            "auth": {"token": OPENCLAW_TOKEN},
            "role": "operator",
            "scopes": [
                "operator.admin",
                "operator.write",
                "operator.read",
                "operator.approvals",
                "operator.pairing",
                "operator.talk.secrets",
            ],
        },
    }

    try:
        print("[chat_ws] STAGE sending_connect_req", flush=True)
        await gw.send(json.dumps(connect_req))
        print("[chat_ws] STAGE connect_req_sent, awaiting hello-ok", flush=True)
        handshake_ok = False
        async with asyncio.timeout(15):
            async for raw in gw:
                text = raw if isinstance(raw, str) else raw.decode("utf-8", errors="replace")
                print(f"[chat_ws] STAGE gw_frame len={len(text)} head={text[:200]!r}", flush=True)
                try:
                    frame = json.loads(text)
                except json.JSONDecodeError:
                    continue
                if frame.get("type") == "res" and frame.get("id") == "tv-connect":
                    if frame.get("error"):
                        err = frame["error"]
                        msg = err.get("message") if isinstance(err, dict) else str(err)
                        print(f"[chat_ws] STAGE handshake_rejected err={err!r}", flush=True)
                        await ws.send_json({"op": "error", "code": "gateway_handshake_failed",
                                            "message": (msg or "connect rejected")[:300]})
                        await gw.close()
                        await ws.close(code=1008)
                        return
                    handshake_ok = True
                    print("[chat_ws] STAGE handshake_ok", flush=True)
                    break
        if not handshake_ok:
            raise RuntimeError("no hello-ok received before timeout")
    except Exception as e:
        print(f"[chat_ws] STAGE handshake_failed err={e!r}", flush=True)
        logger.exception("openclaw gateway handshake failed")
        try:
            await ws.send_json({"op": "error", "code": "gateway_handshake_failed", "message": str(e)[:300]})
        except Exception:
            pass
        try: await gw.close()
        except Exception: pass
        await ws.close(code=1011)
        return

    print(f"[chat_ws] STAGE sending_ready user={user.username}", flush=True)
    await ws.send_json({"op": "ready", "user": user.username})
    print("[chat_ws] STAGE ready_sent, entering relay", flush=True)

    # sessionKey → conversation_id for this WS connection only.
    # Frontend attaches `tvConversationId` to `sessions.send` params; we peel
    # it off (gateway doesn't know the field), persist the user message, and
    # remember the mapping so gateway-side `session.message` assistant events
    # can be attributed to the same DB conversation.
    session_to_conv: dict[str, int] = {}
    # pending user message capture by rpc id so we can record what was sent
    # even before the gateway ack (useful for debugging; assistant save is
    # event-driven regardless).
    pending_user_by_id: dict[str, int] = {}
    # Gateway sometimes emits BOTH `session.message` and `chat`+state:"final"
    # for the same assistant reply. Track the message ids we've already
    # forwarded to the browser so we don't render duplicates.
    seen_message_ids: set[str] = set()

    def _save_message(conv_id: int, role: str, content: str,
                      attachments: list[dict[str, Any]] | None = None) -> None:
        try:
            with Session(engine) as db:
                conv = db.get(OpenClawConversation, conv_id)
                if not conv or conv.user_id != user.id:
                    return
                now = datetime.now()
                m = OpenClawMessage(
                    conversation_id=conv_id,
                    role=role,
                    content=content or "",
                    attachments_json=json.dumps(attachments, ensure_ascii=False) if attachments else None,
                    created_at=now,
                )
                db.add(m)
                conv.updated_at = now
                conv.last_message_at = now
                # auto-title from first user message
                if role == "user" and (not conv.title or conv.title == "새 대화"):
                    snippet = (content or "").strip().splitlines()[0] if content else ""
                    if snippet:
                        conv.title = snippet[:40]
                db.add(conv)
                db.commit()
        except Exception:
            logger.exception("chat_ws: failed to persist message conv=%s role=%s", conv_id, role)

    def _attachment_summary(raw: list[Any] | None) -> list[dict[str, Any]] | None:
        if not raw or not isinstance(raw, list):
            return None
        out: list[dict[str, Any]] = []
        for a in raw:
            if not isinstance(a, dict):
                continue
            out.append({
                "type": a.get("type") or a.get("kind"),
                "mimeType": a.get("mimeType"),
                "fileName": a.get("fileName"),
                # deliberately drop `content` (base64) — keep file-ref metadata only.
            })
        return out or None

    async def pump_client_to_gw() -> None:
        """Browser JSON-RPC {id, method, params} -> Gateway {type:"req", ...}."""
        try:
            while True:
                raw = await ws.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(msg, dict):
                    continue
                # ignore legacy auth frames from older frontends
                if msg.get("op") == "auth":
                    continue
                method = msg.get("method")
                mid = msg.get("id")
                if not method or not mid:
                    continue
                params = msg.get("params") or {}

                # --- Persistence hook: intercept `sessions.send` ---
                if method == "sessions.send" and isinstance(params, dict):
                    conv_id_raw = params.pop("tvConversationId", None)
                    # If frontend sent a history-replay prefix, it also sends
                    # the raw user text separately so DB stores clean content.
                    raw_user_text = params.pop("tvRawUserText", None)
                    try:
                        conv_id = int(conv_id_raw) if conv_id_raw is not None else None
                    except (TypeError, ValueError):
                        conv_id = None
                    session_key = params.get("key") or params.get("sessionKey")
                    if conv_id and session_key:
                        session_to_conv[str(session_key)] = conv_id
                        user_text = raw_user_text if isinstance(raw_user_text, str) else (
                            params.get("message") or params.get("text") or ""
                        )
                        attachments = _attachment_summary(params.get("attachments"))
                        if isinstance(user_text, str):
                            _save_message(conv_id, "user", user_text, attachments)
                            pending_user_by_id[str(mid)] = conv_id

                frame = {"type": "req", "id": str(mid), "method": method,
                         "params": params}
                await gw.send(json.dumps(frame, ensure_ascii=False))
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.exception("chat_ws: client->gw pump failed")
        finally:
            try: await gw.close()
            except Exception: pass

    async def pump_gw_to_client() -> None:
        """Gateway {type:"res"|"event"} -> Browser {id,result/error} or {method, params}."""
        try:
            async for raw in gw:
                text = raw if isinstance(raw, str) else raw.decode("utf-8", errors="replace")
                try:
                    frame = json.loads(text)
                except json.JSONDecodeError:
                    continue
                if not isinstance(frame, dict):
                    continue
                ftype = frame.get("type")
                if ftype == "res":
                    # Gateway frame shape: {type:"res", id, ok, payload, error}
                    # Translate to JSON-RPC: {id, result, error}
                    out: dict[str, Any] = {"id": frame.get("id")}
                    err = frame.get("error")
                    if err:
                        out["error"] = _strip_sensitive(err)
                    elif frame.get("ok") is not False:
                        out["result"] = _strip_sensitive(frame.get("payload"))
                    await ws.send_text(json.dumps(out, ensure_ascii=False))
                elif ftype == "event":
                    event = frame.get("event")
                    payload = frame.get("payload") or {}
                    # Newer gateway builds emit the assistant's final message as
                    # `chat` with state:"final"; older builds emit
                    # `session.message`. Some builds emit BOTH for the same
                    # message, so we dedup by message id + persist + alias once.
                    is_chat_final = (
                        event == "chat"
                        and isinstance(payload, dict)
                        and payload.get("state") == "final"
                        and isinstance(payload.get("message"), dict)
                    )
                    is_assistant_final = False
                    dedup_key: str | None = None
                    if (event == "session.message" or is_chat_final) and isinstance(payload, dict):
                        m = payload.get("message") or {}
                        if isinstance(m, dict) and m.get("role") == "assistant":
                            is_assistant_final = True
                            mid = m.get("id") or m.get("messageId")
                            if mid is not None:
                                dedup_key = f"id:{mid}"
                            else:
                                # fallback: sessionKey + content hash
                                skey = payload.get("sessionKey") or payload.get("key") or ""
                                c = m.get("content")
                                if isinstance(c, list):
                                    c_text = "".join(
                                        (x if isinstance(x, str) else (x.get("text") or ""))
                                        for x in c
                                    )
                                elif isinstance(c, str):
                                    c_text = c
                                else:
                                    c_text = ""
                                if c_text:
                                    dedup_key = f"ck:{skey}:{hash(c_text)}"

                    # Dedup: skip the frame entirely if we've already forwarded
                    # this assistant message under either event name.
                    if is_assistant_final and dedup_key and dedup_key in seen_message_ids:
                        continue
                    if is_assistant_final and dedup_key:
                        seen_message_ids.add(dedup_key)

                    # --- Persistence hook: assistant reply events ---
                    if is_assistant_final:
                        skey = payload.get("sessionKey") or payload.get("key")
                        conv_id = session_to_conv.get(str(skey)) if skey else None
                        m = payload.get("message") or {}
                        if conv_id:
                            content = m.get("content")
                            if isinstance(content, list):
                                text_out = "\n".join(
                                    (c if isinstance(c, str) else (c.get("text") or ""))
                                    for c in content
                                ).strip()
                            elif isinstance(content, str):
                                text_out = content
                            else:
                                text_out = ""
                            if text_out:
                                _save_message(conv_id, "assistant", text_out)
                    cleaned_payload = _strip_sensitive(payload)
                    # Always forward under `session.message` for the frontend
                    # (legacy listener). Chat/final and session.message are
                    # interchangeable for the UI at this point.
                    forward_event = "session.message" if is_chat_final else event
                    out = {"method": forward_event, "params": cleaned_payload}
                    await ws.send_text(json.dumps(out, ensure_ascii=False))
                else:
                    # unknown frame type — forward as-is for debugging
                    await ws.send_text(json.dumps(_strip_sensitive(frame), ensure_ascii=False))
        except Exception:
            logger.exception("chat_ws: gw->client pump failed")
        finally:
            try: await ws.close()
            except Exception: pass

    await asyncio.gather(pump_client_to_gw(), pump_gw_to_client())


# ---------------------------------------------------------------------------
# WebSocket: log streaming (SSH-tailed `docker logs -f`)
# ---------------------------------------------------------------------------

@router.websocket("/logs")
async def logs_ws(ws: WebSocket) -> None:
    await ws.accept()
    user = await authenticate_ws_first_message(ws, required_role="admin")
    if user is None:
        return

    ensure_configured()

    try:
        import paramiko
    except ImportError:
        await ws.send_json({"op": "error", "code": "missing_dep", "message": "paramiko not installed"})
        await ws.close(code=1011)
        return

    from services.openclaw_ssh import SSH_HOST, SSH_USER, SSH_PASSWORD, _load_pkey

    pkey = _load_pkey()
    use_key = pkey is not None

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    transport = None
    chan = None
    try:
        client.connect(
            hostname=SSH_HOST,
            username=SSH_USER,
            pkey=pkey,
            password=None if use_key else SSH_PASSWORD,
            look_for_keys=False,
            allow_agent=False,
            timeout=10,
        )
        transport = client.get_transport()
        chan = transport.open_session()
        chan.get_pty()
        chan.exec_command(f"docker logs -f --tail 200 {shlex.quote(CONTAINER)}")

        await ws.send_json({"op": "log.ready"})

        stop = asyncio.Event()

        async def watch_client_disconnect() -> None:
            try:
                while not stop.is_set():
                    await ws.receive_text()
            except WebSocketDisconnect:
                stop.set()
            except Exception:
                stop.set()

        async def pump_logs() -> None:
            loop = asyncio.get_running_loop()
            buf = b""
            while not stop.is_set():
                if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
                    break
                if chan.recv_ready():
                    chunk = await loop.run_in_executor(None, chan.recv, 8192)
                    if not chunk:
                        break
                    buf += chunk
                    while b"\n" in buf:
                        line, buf = buf.split(b"\n", 1)
                        await ws.send_json({"op": "log.line", "stream": "stdout", "line": line.decode("utf-8", errors="replace")})
                elif chan.recv_stderr_ready():
                    chunk = await loop.run_in_executor(None, chan.recv_stderr, 8192)
                    if not chunk:
                        break
                    for line in chunk.decode("utf-8", errors="replace").splitlines():
                        await ws.send_json({"op": "log.line", "stream": "stderr", "line": line})
                else:
                    await asyncio.sleep(0.2)

        await asyncio.gather(watch_client_disconnect(), pump_logs())
    except Exception as e:
        logger.exception("logs_ws failed")
        try:
            await ws.send_json({"op": "error", "code": "log_stream_failed", "message": str(e)[:300]})
        except Exception:
            pass
    finally:
        try:
            if chan:
                chan.close()
        except Exception:
            pass
        try:
            client.close()
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass
