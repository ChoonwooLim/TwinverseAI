"""
OpenClaw Gateway WebSocket RPC client (async, full Python port).

Ports `C:\\WORK\\TwinverseAI\\deskrpg-master\\src\\lib\\openclaw-gateway.js` (Node)
to async Python so the backend can:
  1. Stream chat.send via OpenClaw (NPC agent — Task 0.5.12 Step 3)
  2. Use frontier models (gpt-5.5 / claude-opus-4-6) as fallback for
     news-watch LLM analysis (Phase 2 of the news automation work).

Protocol summary (v3):
  - WebSocket connect with Origin: http://localhost:18789
  - Server sends event 'connect.challenge' with {nonce, ts}
  - Client signs payload "v2|deviceId|cli|cli|operator|operator.read,...|ts|token|nonce"
    with Ed25519 device key, then sends connect req with full device auth
  - Server keepalive: 'tick' event every ~30s; client closes if 60s without tick
  - chat.send is event-driven (request acks immediately, deltas via 'agent' event,
    final via 'chat' event with state='final'), so a sync RPC wrapper alone
    won't work — we route by sessionKey
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

import websockets
from websockets.asyncio.client import connect as ws_connect
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

logger = logging.getLogger("openclaw.gateway")

PROTOCOL_MIN = 1
PROTOCOL_MAX = 3
MODERN_PROTOCOL = 3
MODERN_CLIENT_ID = "cli"
MODERN_CLIENT_MODE = "cli"
MODERN_ROLE = "operator"
MODERN_SCOPES = ["operator.read", "operator.write", "operator.admin"]
DEVICE_DIR_DEFAULT = Path.home() / ".openclaw-devices"
RPC_TIMEOUT_SEC = 30
CHAT_TIMEOUT_SEC = 180
TICK_GRACE_MULT = 2  # close if no tick for N * tickIntervalMs


def _b64url(data: bytes) -> str:
    """base64url without padding, matches Node's base64Url helper."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _normalize_identity_key(url: str) -> str:
    """Match Node's normalizeIdentityKey: protocol+host+pathname (trailing slashes stripped)."""
    m = re.match(r"^([a-z]+:)//([^/]+)(/.*)?$", url)
    if not m:
        return url
    proto, host, path = m.group(1), m.group(2), m.group(3) or ""
    path = path.rstrip("/")
    return f"{proto}//{host}{path}"


class OpenClawGatewayError(Exception):
    def __init__(
        self,
        message: str,
        *,
        error_code: str = "gateway_error",
        details: Any = None,
        request_id: Optional[str] = None,
        pairing_required: bool = False,
    ):
        super().__init__(message)
        self.error_code = error_code
        self.details = details
        self.request_id = request_id
        self.pairing_required = pairing_required


@dataclass
class _DeviceIdentity:
    id: str  # sha256 hex of raw public key
    public_key_b64u: str  # raw 32-byte ed25519 pub, base64url
    private_pem: str
    created_at: str

    @property
    def signing_key(self) -> Ed25519PrivateKey:
        key = serialization.load_pem_private_key(self.private_pem.encode(), password=None)
        if not isinstance(key, Ed25519PrivateKey):
            raise OpenClawGatewayError("device identity is not Ed25519")
        return key


def _generate_device_identity() -> _DeviceIdentity:
    sk = Ed25519PrivateKey.generate()
    pk = sk.public_key()
    raw_pub = pk.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    pem = sk.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    from datetime import datetime, timezone
    return _DeviceIdentity(
        id=hashlib.sha256(raw_pub).hexdigest(),
        public_key_b64u=_b64url(raw_pub),
        private_pem=pem,
        created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )


def _load_or_create_device_identity(identity_key: str, device_dir: Path) -> _DeviceIdentity:
    """Load Ed25519 identity for this gateway URL, or generate + persist."""
    device_dir.mkdir(parents=True, exist_ok=True)
    norm = _normalize_identity_key(identity_key)
    digest = hashlib.sha256(norm.encode("utf-8")).hexdigest()
    path = device_dir / f"{digest}.json"
    if path.exists():
        try:
            data = json.loads(path.read_text("utf-8"))
            if all(k in data for k in ("id", "publicKey", "privateKeyPem")):
                return _DeviceIdentity(
                    id=data["id"],
                    public_key_b64u=data["publicKey"],
                    private_pem=data["privateKeyPem"],
                    created_at=data.get("createdAt", ""),
                )
        except (json.JSONDecodeError, KeyError, OSError):
            pass  # fall through to regenerate
    identity = _generate_device_identity()
    path.write_text(
        json.dumps(
            {
                "id": identity.id,
                "publicKey": identity.public_key_b64u,
                "privateKeyPem": identity.private_pem,
                "createdAt": identity.created_at,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return identity


def _build_modern_device_auth(
    challenge: dict,
    token: str,
    identity: _DeviceIdentity,
) -> dict:
    nonce = challenge.get("nonce", "")
    signed_at = challenge.get("ts", 0)
    payload = "|".join([
        "v2",
        identity.id,
        MODERN_CLIENT_ID,
        MODERN_CLIENT_MODE,
        MODERN_ROLE,
        ",".join(MODERN_SCOPES),
        str(signed_at),
        token,
        str(nonce),
    ])
    sig = identity.signing_key.sign(payload.encode("utf-8"))
    return {
        "id": identity.id,
        "publicKey": identity.public_key_b64u,
        "signature": _b64url(sig),
        "signedAt": signed_at,
        "nonce": nonce,
    }


@dataclass
class _ChatStream:
    request_id: str
    on_delta: Optional[Callable[[str], Awaitable[None]]]
    future: asyncio.Future
    full_text: str = ""


@dataclass
class _PendingRpc:
    future: asyncio.Future
    method: str


class OpenClawGateway:
    """Async OpenClaw gateway client. Use as `async with` or call connect/disconnect."""

    def __init__(
        self,
        url: str,
        token: str,
        *,
        device_dir: Optional[Path] = None,
        rpc_timeout: float = RPC_TIMEOUT_SEC,
        chat_timeout: float = CHAT_TIMEOUT_SEC,
    ):
        self._url = self._normalize_ws_url(url)
        self._token = token
        self._device_dir = device_dir or Path(os.getenv("OPENCLAW_DEVICE_DIR") or DEVICE_DIR_DEFAULT)
        self._rpc_timeout = rpc_timeout
        self._chat_timeout = chat_timeout
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._reader_task: Optional[asyncio.Task] = None
        self._tick_task: Optional[asyncio.Task] = None
        self._connect_request_id: Optional[str] = None
        self._connect_future: Optional[asyncio.Future] = None
        self._connect_challenge: Optional[dict] = None
        self._connect_sent = False
        self._tick_interval_ms = 30000
        self._last_tick_ts: float = 0
        self._pending: dict[str, _PendingRpc] = {}
        self._chat_streams: dict[str, _ChatStream] = {}
        self._closed = False
        self._loop = None
        self._identity: Optional[_DeviceIdentity] = None

    # ── Public API ──────────────────────────────────────────────

    async def connect(self) -> None:
        """Open WebSocket, perform Ed25519 handshake, start reader+tick tasks."""
        if self._ws is not None:
            return
        self._loop = asyncio.get_running_loop()
        self._connect_future = self._loop.create_future()
        self._connect_challenge = None
        self._connect_sent = False
        self._closed = False

        # websockets 13.x: use asyncio.client.connect (top-level is legacy + uses extra_headers)
        try:
            self._ws = await ws_connect(
                self._url,
                additional_headers={"Origin": "http://localhost:18789"},
                max_size=8 * 1024 * 1024,  # 8 MB — chat responses can be large
                ping_interval=None,  # OpenClaw uses its own 'tick' keepalive
            )
        except Exception as e:
            raise OpenClawGatewayError(
                f"WebSocket connect failed: {e}",
                error_code="websocket_connect_failed",
            ) from e

        self._reader_task = asyncio.create_task(self._reader_loop(), name="openclaw-reader")
        # Wait briefly for the server to push connect.challenge, then send connect.
        # Node uses a 750ms timer; we just wait for the challenge event or timeout.
        try:
            await asyncio.wait_for(self._connect_future, timeout=15.0)
        except asyncio.TimeoutError as e:
            await self.disconnect()
            raise OpenClawGatewayError("connect handshake timeout", error_code="connect_timeout") from e

    async def disconnect(self) -> None:
        self._closed = True
        if self._tick_task:
            self._tick_task.cancel()
            self._tick_task = None
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except (asyncio.CancelledError, Exception):
                pass
            self._reader_task = None
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        # Reject pending
        for rpc in list(self._pending.values()):
            if not rpc.future.done():
                rpc.future.set_exception(OpenClawGatewayError("gateway disconnected"))
        self._pending.clear()
        for stream in list(self._chat_streams.values()):
            if not stream.future.done():
                stream.future.set_exception(OpenClawGatewayError("gateway disconnected"))
        self._chat_streams.clear()

    def is_connected(self) -> bool:
        return self._ws is not None and not self._closed

    async def __aenter__(self) -> "OpenClawGateway":
        await self.connect()
        return self

    async def __aexit__(self, *_) -> None:
        await self.disconnect()

    # ── Sync RPC ────────────────────────────────────────────────

    async def rpc(self, method: str, params: Optional[dict] = None) -> dict:
        if not self.is_connected():
            raise OpenClawGatewayError("not connected")
        req_id = str(uuid.uuid4())
        future: asyncio.Future = self._loop.create_future()
        self._pending[req_id] = _PendingRpc(future=future, method=method)
        await self._send({"type": "req", "id": req_id, "method": method, "params": params or {}})
        try:
            return await asyncio.wait_for(future, timeout=self._rpc_timeout)
        except asyncio.TimeoutError as e:
            self._pending.pop(req_id, None)
            raise OpenClawGatewayError(f"RPC timeout: {method}", error_code="rpc_timeout") from e

    async def agents_list(self) -> list[dict]:
        res = await self.rpc("agents.list", {})
        return res.get("agents", []) or []

    # ── Chat (streaming) ────────────────────────────────────────

    async def chat_send(
        self,
        agent_id: str,
        session_key: str,
        message: str,
        on_delta: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> str:
        """Send a chat message and await the final response.

        on_delta(text) is called for each streamed delta if provided.
        Returns the final assistant text.
        """
        if not self.is_connected():
            raise OpenClawGatewayError("not connected")
        full_session_key = (
            session_key if session_key.startswith("agent:") else f"agent:{agent_id}:{session_key}"
        )
        req_id = str(uuid.uuid4())
        future: asyncio.Future = self._loop.create_future()
        self._chat_streams[full_session_key] = _ChatStream(
            request_id=req_id, on_delta=on_delta, future=future
        )
        await self._send({
            "type": "req",
            "id": req_id,
            "method": "chat.send",
            "params": {
                "sessionKey": full_session_key,
                "message": message,
                "idempotencyKey": str(uuid.uuid4()),
            },
        })
        try:
            return await asyncio.wait_for(future, timeout=self._chat_timeout)
        except asyncio.TimeoutError as e:
            self._chat_streams.pop(full_session_key, None)
            raise OpenClawGatewayError("chat timeout", error_code="chat_timeout") from e

    async def chat_abort(self, agent_id: str, session_key: str) -> dict:
        full_session_key = (
            session_key if session_key.startswith("agent:") else f"agent:{agent_id}:{session_key}"
        )
        return await self.rpc("chat.abort", {"sessionKey": full_session_key})

    # ── Internals ───────────────────────────────────────────────

    @staticmethod
    def _normalize_ws_url(url: str) -> str:
        if url.startswith("https://"):
            return "wss://" + url[len("https://"):]
        if url.startswith("http://"):
            return "ws://" + url[len("http://"):]
        if not url.startswith(("ws://", "wss://")):
            return "ws://" + url
        return url

    async def _send(self, frame: dict) -> None:
        if self._ws is None:
            raise OpenClawGatewayError("websocket closed")
        await self._ws.send(json.dumps(frame))

    async def _reader_loop(self) -> None:
        try:
            async for raw in self._ws:  # type: ignore[union-attr]
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    logger.warning("ignored non-JSON frame from gateway")
                    continue
                await self._handle_frame(parsed)
        except websockets.ConnectionClosed:
            logger.info("gateway websocket closed")
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("reader loop error")
        finally:
            # Signal connect_future if we never finished handshake
            if self._connect_future and not self._connect_future.done():
                self._connect_future.set_exception(
                    OpenClawGatewayError("connection closed before handshake")
                )

    async def _handle_frame(self, frame: dict) -> None:
        ftype = frame.get("type")
        if ftype == "event":
            await self._handle_event(frame)
        elif ftype == "res":
            await self._handle_response(frame)

    async def _handle_event(self, frame: dict) -> None:
        event = frame.get("event")
        payload = frame.get("payload") or {}

        if event == "connect.challenge":
            self._connect_challenge = payload
            await self._send_connect()
            return

        if event == "tick":
            self._last_tick_ts = self._loop.time()
            return

        if event == "agent":
            session_key = payload.get("sessionKey")
            stream = self._chat_streams.get(session_key) if session_key else None
            if (
                stream is not None
                and payload.get("stream") == "assistant"
                and isinstance(payload.get("data"), dict)
                and isinstance(payload["data"].get("delta"), str)
            ):
                delta = payload["data"]["delta"]
                stream.full_text += delta
                if stream.on_delta:
                    try:
                        await stream.on_delta(delta)
                    except Exception:
                        logger.exception("on_delta handler raised")
            return

        if event == "chat":
            session_key = payload.get("sessionKey")
            stream = self._chat_streams.get(session_key) if session_key else None
            if stream is None:
                return
            state = payload.get("state")
            if state == "final":
                final_text = stream.full_text
                if not final_text and isinstance(payload.get("message"), dict):
                    for c in payload["message"].get("content") or []:
                        if isinstance(c, dict) and c.get("type") == "text":
                            final_text += c.get("text", "")
                self._chat_streams.pop(session_key, None)
                if not stream.future.done():
                    stream.future.set_result(final_text)
            elif state == "error":
                self._chat_streams.pop(session_key, None)
                if not stream.future.done():
                    stream.future.set_exception(
                        OpenClawGatewayError(
                            payload.get("error") or payload.get("errorMessage") or "chat error",
                            error_code="chat_error",
                        )
                    )

    async def _handle_response(self, frame: dict) -> None:
        rid = frame.get("id")
        ok = bool(frame.get("ok"))

        # Connect response
        if rid == self._connect_request_id:
            self._connect_request_id = None
            if ok:
                policy = (frame.get("payload") or {}).get("policy") or {}
                self._tick_interval_ms = int(policy.get("tickIntervalMs") or 30000)
                self._last_tick_ts = self._loop.time()
                self._tick_task = asyncio.create_task(self._tick_watch(), name="openclaw-tick")
                if self._connect_future and not self._connect_future.done():
                    self._connect_future.set_result(None)
            else:
                err = frame.get("error") or {}
                msg = err.get("message") if isinstance(err, dict) else str(err) or "connect failed"
                code = err.get("code") if isinstance(err, dict) else "connect_failed"
                if self._connect_future and not self._connect_future.done():
                    self._connect_future.set_exception(
                        OpenClawGatewayError(msg, error_code=code or "connect_failed")
                    )
            return

        # RPC response
        rpc = self._pending.pop(rid, None) if rid else None
        if rpc is None:
            return
        if ok:
            if not rpc.future.done():
                rpc.future.set_result(frame.get("payload") or {})
        else:
            err = frame.get("error") or {}
            msg = err.get("message") if isinstance(err, dict) else str(err) or "rpc error"
            code = err.get("code") if isinstance(err, dict) else "rpc_error"
            if not rpc.future.done():
                rpc.future.set_exception(
                    OpenClawGatewayError(msg, error_code=code or "rpc_error")
                )

    async def _send_connect(self) -> None:
        if self._connect_sent:
            return
        self._connect_sent = True
        req_id = str(uuid.uuid4())
        self._connect_request_id = req_id

        if self._connect_challenge:
            if self._identity is None:
                self._identity = _load_or_create_device_identity(self._url, self._device_dir)
            device_auth = _build_modern_device_auth(
                self._connect_challenge, self._token, self._identity
            )
            params: dict[str, Any] = {
                "minProtocol": MODERN_PROTOCOL,
                "maxProtocol": MODERN_PROTOCOL,
                "client": {
                    "id": MODERN_CLIENT_ID,
                    "version": "1.0.0",
                    "platform": "python",
                    "mode": MODERN_CLIENT_MODE,
                },
                "role": MODERN_ROLE,
                "scopes": MODERN_SCOPES,
                "device": device_auth,
            }
            if self._token:
                params["auth"] = {"token": self._token}
        else:
            params = {
                "minProtocol": PROTOCOL_MIN,
                "maxProtocol": PROTOCOL_MAX,
                "client": {
                    "id": "openclaw-control-ui",
                    "version": "1.0.0",
                    "platform": "python",
                    "mode": "ui",
                },
                "caps": ["tool-events"],
                "scopes": ["operator.admin"],
            }
            if self._token:
                params["auth"] = {"token": self._token}

        await self._send({"type": "req", "id": req_id, "method": "connect", "params": params})

    async def _tick_watch(self) -> None:
        try:
            while not self._closed:
                await asyncio.sleep(max(self._tick_interval_ms / 1000.0, 1.0))
                if not self._last_tick_ts:
                    continue
                grace = (self._tick_interval_ms / 1000.0) * TICK_GRACE_MULT
                if self._loop.time() - self._last_tick_ts > grace:
                    logger.warning("openclaw tick timeout, closing")
                    if self._ws is not None:
                        try:
                            await self._ws.close(code=4000, reason="tick timeout")
                        except Exception:
                            pass
                    return
        except asyncio.CancelledError:
            raise


# ── Standalone test (`python -m services.openclaw_gateway`) ────

async def _test_main() -> int:
    """Connect, list agents, optionally chat. Use OPENCLAW_WS_URL/OPENCLAW_TOKEN env."""
    import argparse

    parser = argparse.ArgumentParser(description="OpenClaw gateway smoke test")
    parser.add_argument("--url", default=os.getenv("OPENCLAW_WS_URL", "ws://192.168.219.117:18789"))
    parser.add_argument("--token", default=os.getenv("OPENCLAW_TOKEN", ""))
    parser.add_argument("--device-dir", default=os.getenv("OPENCLAW_DEVICE_DIR"))
    parser.add_argument("--chat-agent", help="agent id for an optional chat round-trip")
    parser.add_argument("--chat-message", default="ping. Reply with one word.")
    args = parser.parse_args()

    if not args.token:
        print("ERR: OPENCLAW_TOKEN env var is required", flush=True)
        return 2

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    print(f"connecting to {args.url} ...", flush=True)
    device_dir = Path(args.device_dir) if args.device_dir else None
    async with OpenClawGateway(args.url, args.token, device_dir=device_dir) as gw:
        print("connected. listing agents ...", flush=True)
        agents = await gw.agents_list()
        print(f"agents: {len(agents)}")
        for a in agents[:5]:
            print(f"  - {a.get('id', '?')}  model={a.get('model', '?')}  name={a.get('identityName', a.get('name', ''))}")

        if args.chat_agent:
            print(f"chat.send to {args.chat_agent} ...", flush=True)
            session = f"smoke-{uuid.uuid4().hex[:8]}"

            async def on_delta(text: str) -> None:
                print(text, end="", flush=True)

            try:
                final = await gw.chat_send(args.chat_agent, session, args.chat_message, on_delta=on_delta)
                print(f"\n--- final ({len(final)} chars) ---")
                print(final[:200])
            except OpenClawGatewayError as e:
                print(f"\nchat failed: {e}")
                return 3

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_test_main()))
