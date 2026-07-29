"""OpenClaw `sessions.json` 인덱스에서 텔레그램 그룹 세션만 골라낸다.

세션 파일 본문에서 토픽을 긁어내는 것보다 이쪽이 견고하다. OpenClaw 가 세션키와
`deliveryContext` 에 채널·계정·토픽을 이미 구조화해 두기 때문이다.

    agent:<agentId>:telegram:group:<chatId>:topic:<topicId>
    deliveryContext = {"channel":"telegram","to":"telegram:<chatId>","accountId":...,"threadId":10}

이 모듈만 `sessions.json` 스키마에 종속된다. OpenClaw 버전이 올라 형식이 바뀌면 여기만 고친다.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

# 컨테이너의 /data 는 호스트의 /srv/openclaw/data 바인드 마운트다.
CONTAINER_DATA = "/data/"
HOST_DATA = "/srv/openclaw/data/"


@dataclass(frozen=True)
class TelegramSession:
    agent: str        # "myjini" | "main"
    path: str         # 호스트 기준 세션 .jsonl 경로
    chat_id: str
    topic_id: str


def to_host_path(container_path: str) -> str:
    """컨테이너 경로를 호스트 경로로 옮긴다. 이미 호스트 경로면 그대로 둔다."""
    if container_path.startswith(CONTAINER_DATA):
        return HOST_DATA + container_path[len(CONTAINER_DATA):]
    return container_path


def _topic_of(entry: dict) -> str | None:
    ctx = entry.get("deliveryContext") or {}
    thread = ctx.get("threadId")
    return str(thread) if thread not in (None, "") else None


def _chat_of(entry: dict) -> str | None:
    ctx = entry.get("deliveryContext") or {}
    to = ctx.get("to") or ""
    # "telegram:-1004482716134"
    return to.split(":", 1)[1] if ":" in to else None


def read_index(sessions_root: Path, agent: str) -> dict:
    """<sessions_root>/<agent>/sessions/sessions.json 을 읽는다. 없으면 빈 dict."""
    p = sessions_root / agent / "sessions" / "sessions.json"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def telegram_sessions(sessions_root: Path, agents: list[str]) -> list[TelegramSession]:
    """등록된 에이전트들의 텔레그램 그룹 세션 목록. 파일이 아직 없는 세션도 포함한다.

    OpenClaw 는 세션을 인덱스에 먼저 올리고 `.jsonl` 은 나중에 flush 하므로,
    호출자가 파일 부재를 정상 상태로 다뤄야 한다.
    """
    found: list[TelegramSession] = []
    for agent in agents:
        for key, entry in read_index(sessions_root, agent).items():
            if not isinstance(entry, dict):
                continue
            ctx = entry.get("deliveryContext") or {}
            if ctx.get("channel") != "telegram":
                continue
            topic = _topic_of(entry)
            chat = _chat_of(entry)
            raw = entry.get("sessionFile")
            if not (topic and chat and raw):
                continue  # DM 이나 토픽 없는 세션은 프로젝트에 매핑할 수 없다
            found.append(
                TelegramSession(agent=agent, path=to_host_path(raw), chat_id=chat, topic_id=topic)
            )
    return found
