"""Admin OpenClaw chat - conversation (trash) deletion regression tests.

In-memory SQLite and a fake gateway only: no real conversation, SSH host or
OpenClaw gateway is touched. Handlers are called directly (no HTTP client) so
the tests do not depend on the installed starlette/httpx pairing.
"""
import asyncio
import json

import pytest
from fastapi import HTTPException, WebSocketDisconnect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import models  # noqa: F401  (registers every table on SQLModel.metadata)
from models import OpenClawConversation, OpenClawMessage, User
from routers import admin_openclaw_console as console


@pytest.fixture()
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture()
def users(engine):
    with Session(engine, expire_on_commit=False) as s:
        owner = User(username="owner", email="o@example.com", hashed_password="x", role="admin")
        other = User(username="other", email="x@example.com", hashed_password="x", role="admin")
        s.add(owner)
        s.add(other)
        s.commit()
        return owner, other


def _conversation(engine, user, messages=2, agent_id="main"):
    with Session(engine) as s:
        conv = OpenClawConversation(user_id=user.id, agent_id=agent_id, title="t")
        s.add(conv)
        s.commit()
        s.refresh(conv)
        for i in range(messages):
            s.add(OpenClawMessage(conversation_id=conv.id, role="user", content=f"m{i}"))
        s.commit()
        return conv.id


def _delete(engine, user, conv_id, session_cls=Session):
    with session_cls(engine) as s:
        return console.conversations_delete(conv_id, user=user, session=s)


def _listed_ids(engine, user):
    with Session(engine) as s:
        listed = console.conversations_list(agent_id="main", user=user, session=s)
    return [c["id"] for c in listed["conversations"]]


def test_delete_removes_conversation_and_messages_and_stays_gone(engine, users):
    owner = users[0]
    keep = _conversation(engine, owner)
    gone = _conversation(engine, owner, messages=3)

    assert _delete(engine, owner, gone) == {"ok": True}

    # "refresh": the list and the detail endpoint both agree it is gone
    assert _listed_ids(engine, owner) == [keep]
    with Session(engine) as s:
        with pytest.raises(HTTPException) as exc:
            console.conversations_get(gone, user=owner, session=s)
        assert exc.value.status_code == 404
        left = s.exec(select(OpenClawMessage)).all()
        assert {m.conversation_id for m in left} == {keep}
        assert len(left) == 2


def test_second_delete_is_a_clean_404(engine, users):
    owner = users[0]
    conv = _conversation(engine, owner)
    _delete(engine, owner, conv)
    with pytest.raises(HTTPException) as exc:
        _delete(engine, owner, conv)
    assert exc.value.status_code == 404
    assert isinstance(exc.value.detail, str)


def test_cannot_delete_another_admins_conversation(engine, users):
    owner, other = users
    theirs = _conversation(engine, other)
    with pytest.raises(HTTPException) as exc:
        _delete(engine, owner, theirs)
    assert exc.value.status_code == 404
    with Session(engine) as s:
        assert s.get(OpenClawConversation, theirs) is not None
        assert len(s.exec(select(OpenClawMessage)).all()) == 2


def _racing_session(failures):
    """Session whose first N commits fail the way Postgres does when the relay
    inserts a reply between our message delete and the conversation delete."""

    class RacingSession(Session):
        remaining = failures

        def commit(self):
            if RacingSession.remaining > 0:
                RacingSession.remaining -= 1
                raise IntegrityError("DELETE", {}, Exception("fk_violation"))
            super().commit()

    return RacingSession


def test_delete_retries_when_a_reply_is_saved_concurrently(engine, users):
    owner = users[0]
    conv = _conversation(engine, owner)
    assert _delete(engine, owner, conv, _racing_session(1)) == {"ok": True}
    with Session(engine) as s:
        assert s.get(OpenClawConversation, conv) is None
        assert s.exec(select(OpenClawMessage)).all() == []


def test_delete_that_keeps_racing_reports_a_readable_conflict(engine, users):
    owner = users[0]
    conv = _conversation(engine, owner)
    with pytest.raises(HTTPException) as exc:
        _delete(engine, owner, conv, _racing_session(2))
    assert exc.value.status_code == 409
    assert "다시 삭제" in exc.value.detail
    with Session(engine) as s:  # rolled back intact, not half-deleted
        assert s.get(OpenClawConversation, conv) is not None
        assert len(s.exec(select(OpenClawMessage)).all()) == 2


# --- gateway `sessions.delete` guard (pure helpers) -------------------------

def test_created_session_key_reads_both_response_shapes():
    assert console._created_session_key({"key": "agent:a:dashboard:1"}) == "agent:a:dashboard:1"
    assert console._created_session_key({"sessionKey": "agent:a:dashboard:2"}) == "agent:a:dashboard:2"
    assert console._created_session_key({"key": ""}) is None
    assert console._created_session_key(None) is None


def test_session_delete_only_for_keys_created_on_this_connection():
    owned = {"agent:a:dashboard:1"}
    guard = console._owned_session_delete_params
    assert guard({"key": "agent:a:dashboard:1"}, owned) == {"key": "agent:a:dashboard:1"}
    # extra params are dropped (gateway schema is additionalProperties:false)
    assert guard({"key": "agent:a:dashboard:1", "deleteTranscript": False, "x": 1}, owned) == {"key": "agent:a:dashboard:1"}
    # the main session, other clients' sessions and malformed params are refused
    assert guard({"key": "agent:main:main"}, owned) is None
    assert guard({"key": "agent:a:dashboard:other"}, owned) is None
    assert guard({"sessionKey": "agent:a:dashboard:1"}, owned) is None
    assert guard({"key": ["agent:a:dashboard:1"]}, owned) is None
    assert guard(None, owned) is None


# --- chat relay end to end against a fake gateway and a fake browser --------

class _FakeGateway:
    """Stands in for the OpenClaw gateway socket; records every frame sent."""

    def __init__(self):
        self.sent: list[dict] = []
        self._inbox: asyncio.Queue = asyncio.Queue()
        self._n = 0

    async def send(self, raw):
        frame = json.loads(raw)
        self.sent.append(frame)
        method = frame["method"]
        if method == "connect":
            payload = {"type": "hello-ok"}
        elif method == "sessions.create":
            self._n += 1
            payload = {"key": f"agent:{frame['params']['agentId']}:dashboard:{self._n}"}
        elif method == "sessions.delete":
            payload = {"ok": True, "key": frame["params"]["key"], "deleted": True}
        elif method == "sessions.resolve":
            # answers before a slower create that shares its rpc id
            payload = {"key": frame["params"]["key"]}
        else:
            return
        await self._inbox.put({"type": "res", "id": frame["id"], "ok": True, "payload": payload})

    def __aiter__(self):
        return self

    async def __anext__(self):
        item = await self._inbox.get()
        if item is None:
            raise StopAsyncIteration
        return json.dumps(item)

    async def close(self):
        await self._inbox.put(None)


class _FakeBrowser:
    """Stands in for the browser side of the FastAPI WebSocket."""

    def __init__(self):
        self.to_server: asyncio.Queue = asyncio.Queue()
        self.from_server: asyncio.Queue = asyncio.Queue()

    async def accept(self):
        pass

    async def close(self, code=1000):
        pass

    async def send_json(self, data):
        await self.from_server.put(data)

    async def send_text(self, text):
        await self.from_server.put(json.loads(text))

    async def receive_text(self):
        item = await self.to_server.get()
        if item is None:
            raise WebSocketDisconnect()
        return json.dumps(item)

    async def call(self, frame):
        await self.to_server.put(frame)
        return await asyncio.wait_for(self.from_server.get(), timeout=5)


def test_relay_refuses_foreign_session_delete_and_forwards_owned_one(monkeypatch, engine, users):
    ws_client = pytest.importorskip("websockets.asyncio.client")
    gateway = _FakeGateway()

    async def _connect(*_args, **_kwargs):
        return gateway

    async def _auth(_ws, required_role="admin"):
        return users[0]

    monkeypatch.setattr(ws_client, "connect", _connect)
    monkeypatch.setattr(console, "authenticate_ws_first_message", _auth)
    monkeypatch.setattr(console, "OPENCLAW_WS_URL", "ws://fake-gateway.invalid")
    monkeypatch.setattr(console, "OPENCLAW_TOKEN", "test-token")
    monkeypatch.setattr(console, "engine", engine)

    async def scenario():
        browser = _FakeBrowser()
        relay = asyncio.create_task(console.chat_ws(browser))
        ready = await asyncio.wait_for(browser.from_server.get(), timeout=5)
        assert ready["op"] == "ready"

        # a session this connection never created never reaches the gateway
        refused = await browser.call({"id": "1", "method": "sessions.delete", "params": {"key": "agent:main:main"}})
        assert refused["id"] == "1" and refused["error"]["code"] == "FORBIDDEN"

        created = await browser.call({"id": "2", "method": "sessions.create", "params": {"agentId": "a"}})
        key = created["result"]["key"]

        done = await browser.call({"id": "3", "method": "sessions.delete",
                                   "params": {"key": key, "deleteTranscript": False}})
        assert done["id"] == "3" and done["result"]["deleted"] is True

        # ownership ends with the delete
        again = await browser.call({"id": "4", "method": "sessions.delete", "params": {"key": key}})
        assert again["error"]["code"] == "FORBIDDEN"

        # reusing the id of a request still in flight is refused, so another
        # request's response can never be mistaken for a create result
        await browser.to_server.put({"id": "5", "method": "sessions.slow", "params": {}})
        dup = await browser.call({"id": "5", "method": "sessions.create", "params": {"agentId": "a"}})
        assert dup["id"] == "5" and dup["error"]["code"] == "DUPLICATE_ID"
        await browser.to_server.put({"id": "6", "method": "sessions.slow", "params": {}})
        dup = await browser.call({"id": "6", "method": "sessions.resolve", "params": {"key": "agent:main:main"}})
        assert dup["error"]["code"] == "DUPLICATE_ID"
        stolen = await browser.call({"id": "7", "method": "sessions.delete", "params": {"key": "agent:main:main"}})
        assert stolen["error"]["code"] == "FORBIDDEN"

        await browser.to_server.put(None)  # browser disconnects
        await asyncio.wait_for(relay, timeout=5)
        return key

    key = asyncio.run(scenario())
    deletes = [f for f in gateway.sent if f["method"] == "sessions.delete"]
    assert deletes == [{"type": "req", "id": "3", "method": "sessions.delete", "params": {"key": key}}]
