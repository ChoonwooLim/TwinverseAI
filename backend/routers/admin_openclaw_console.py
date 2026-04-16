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

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from deps import require_admin
from models import User
from services import openclaw_cli as cli
from services.openclaw_ssh import CONTAINER, ensure_configured, ssh_run
from utils.ws_auth import authenticate_ws_first_message

logger = logging.getLogger("twinverse.openclaw.console")

router = APIRouter()


OPENCLAW_WS_URL = os.getenv("OPENCLAW_WS_URL", "").strip()
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


# ---------------------------------------------------------------------------
# status / health
# ---------------------------------------------------------------------------

@router.get("/health")
def health(_: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return cli.gateway_health()


# ---------------------------------------------------------------------------
# agents
# ---------------------------------------------------------------------------

@router.get("/agents")
def agents_list_endpoint(_: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    return {"agents": cli.agents_list()}


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


@router.websocket("/chat")
async def chat_ws(ws: WebSocket) -> None:
    """Browser <-> backend <-> OpenClaw gateway JSON-RPC relay.

    Flow:
      1. accept + first-message JWT auth (admin role)
      2. open outbound WS to OPENCLAW_WS_URL (token attached server-side)
      3. forward client -> gateway messages as-is
      4. forward gateway -> client messages with secret fields stripped
    """
    await ws.accept()

    user = await authenticate_ws_first_message(ws, required_role="admin")
    if user is None:
        return

    if not OPENCLAW_WS_URL or not OPENCLAW_TOKEN:
        await ws.send_json({"op": "error", "code": "not_configured", "message": "OPENCLAW_WS_URL/TOKEN not set"})
        await ws.close(code=1011)
        return

    try:
        import websockets
    except ImportError:
        await ws.send_json({"op": "error", "code": "missing_dep", "message": "websockets library not installed"})
        await ws.close(code=1011)
        return

    try:
        gw = await websockets.connect(
            OPENCLAW_WS_URL,
            additional_headers={"Authorization": f"Bearer {OPENCLAW_TOKEN}"},
            max_size=8 * 1024 * 1024,
            ping_interval=20,
            ping_timeout=20,
        )
    except Exception as e:
        logger.exception("openclaw gateway connect failed")
        await ws.send_json({"op": "error", "code": "gateway_unreachable", "message": str(e)[:300]})
        await ws.close(code=1011)
        return

    await ws.send_json({"op": "ready", "user": user.username})

    async def pump_client_to_gw() -> None:
        try:
            while True:
                raw = await ws.receive_text()
                await gw.send(raw)
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.exception("chat_ws: client->gw pump failed")
        finally:
            try:
                await gw.close()
            except Exception:
                pass

    async def pump_gw_to_client() -> None:
        try:
            async for msg in gw:
                text = msg if isinstance(msg, str) else msg.decode("utf-8", errors="replace")
                try:
                    parsed = json.loads(text)
                    sanitized = _strip_sensitive(parsed)
                    await ws.send_text(json.dumps(sanitized, ensure_ascii=False))
                except json.JSONDecodeError:
                    await ws.send_text(text)
        except Exception:
            logger.exception("chat_ws: gw->client pump failed")
        finally:
            try:
                await ws.close()
            except Exception:
                pass

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

    from services.openclaw_ssh import SSH_HOST, SSH_USER, SSH_PASSWORD

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    transport = None
    chan = None
    try:
        client.connect(
            hostname=SSH_HOST,
            username=SSH_USER,
            password=SSH_PASSWORD,
            look_for_keys=SSH_PASSWORD is None,
            allow_agent=SSH_PASSWORD is None,
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
