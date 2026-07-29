#!/usr/bin/env python3
"""OpenClaw 텔레그램 세션을 Lucifer/<프로젝트>/chat/YYYY-MM-DD.md 로 미러링한다.

LLM 에게 "로그를 남겨줘" 라고 지시하지 않는다 — 잊으면 조용히 유실되기 때문이다.
대신 OpenClaw 가 이미 남기는 세션 파일을 증분으로 읽어 옮긴다.

라우팅은 `sessions.json` 인덱스의 토픽 ID 를 `_registry.json` 으로 역참조해 정한다.
"""
from __future__ import annotations

import json
import sys
import traceback
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import session_index as si
import session_parse as sp

KST = timezone(timedelta(hours=9))

LUCIFER = Path("/media/stevenlim/TwinverseFolder/Lucifer")
SESSIONS_ROOT = Path("/srv/openclaw/data/.openclaw/agents")
STATE_PATH = LUCIFER / ".mirror-state.json"
ERROR_LOG = LUCIFER / "_common" / "_mirror-errors.log"

AGENT_LABELS = {"myjini": "지니 🧞", "main": "로이 🦊"}
USER_LABEL = "감독님"


@dataclass(frozen=True)
class Msg:
    ts: datetime
    agent: str
    role: str
    text: str
    topic_id: str


def log_error(what: str, exc: BaseException) -> None:
    """실패를 눈에 보이게 남긴다. 기록 유실을 조용히 넘기지 않는 것이 목적이다."""
    try:
        ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(KST).isoformat(timespec="seconds")
        with ERROR_LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"[{stamp}] {what}: {exc.__class__.__name__}: {exc}\n")
            fh.write(traceback.format_exc())
            fh.write("\n")
    except OSError:
        print(f"error log unavailable: {what}: {exc}", file=sys.stderr)


def load_registry() -> dict:
    return json.loads((LUCIFER / "_registry.json").read_text(encoding="utf-8"))


def resolve_project(topic_id: str | None, registry: dict) -> str | None:
    """토픽 ID 를 등록된 프로젝트 폴더명으로 역참조한다. 미등록이면 None."""
    if not topic_id:
        return None
    for entry in (registry.get("projects") or {}).values():
        if str(entry.get("topicId") or "") == str(topic_id):
            return entry.get("folder")
    return None


def load_state() -> tuple[dict, bool]:
    """(상태, 처음부터인가) 를 돌려준다.

    두 번째 값이 True 면 상태가 없거나 깨진 것이다. 이때 전체 이력을 그대로 append 하면
    모든 날짜 파일이 중복되므로, 호출자는 **당일 분만 재생성**해야 한다.
    """
    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if isinstance(state, dict) and isinstance(state.get("files"), dict):
            return state, False
    except (OSError, json.JSONDecodeError):
        pass
    return {"version": 1, "files": {}}, True


def save_state(state: dict) -> None:
    tmp = STATE_PATH.with_name(STATE_PATH.name + ".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(STATE_PATH)


def day_key(m: Msg) -> str:
    """메시지가 속한 KST 날짜. 파일명이자 버킷 키."""
    return m.ts.astimezone(KST).strftime("%Y-%m-%d")


def filter_today(msgs: list[Msg], now: datetime) -> list[Msg]:
    today = now.astimezone(KST).strftime("%Y-%m-%d")
    return [m for m in msgs if day_key(m) == today]


def render(msgs: list[Msg]) -> str:
    """시간순으로 정렬된 메시지를 마크다운 블록으로 만든다. 시각은 KST."""
    out: list[str] = []
    for m in msgs:
        local = m.ts.astimezone(KST)
        who = USER_LABEL if m.role == "user" else AGENT_LABELS.get(m.agent, m.agent)
        out.append(f"### {local:%H:%M} {who}\n\n{m.text}\n")
    return "\n".join(out)


def write_day(folder: str, day: str, body: str, *, overwrite: bool) -> None:
    path = LUCIFER / folder / "chat" / f"{day}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    if overwrite or not path.exists():
        path.write_text(f"# {day}\n\n", encoding="utf-8")
    with path.open("a", encoding="utf-8") as fh:
        fh.write(body + "\n")


def collect(sessions: list[si.TelegramSession], files: dict) -> list[Msg]:
    """각 세션의 새 줄만 읽어 Msg 목록으로 만든다. 상태(files)를 제자리에서 갱신한다."""
    msgs: list[Msg] = []
    for s in sessions:
        entry = files.get(s.path) or {}
        try:
            records, offset = sp.read_new(s.path, int(entry.get("offset") or 0))
        except OSError as exc:
            log_error(f"세션 읽기 실패 {s.path}", exc)
            continue
        files[s.path] = {"offset": offset, "topicId": s.topic_id, "agent": s.agent}
        msgs.extend(
            Msg(ts=r.ts, agent=s.agent, role=r.role, text=r.text, topic_id=s.topic_id)
            for r in records
        )
    return msgs


def main() -> int:
    try:
        registry = load_registry()
    except (OSError, json.JSONDecodeError) as exc:
        log_error("레지스트리 읽기 실패", exc)
        return 1

    state, fresh = load_state()
    files = state["files"]

    sessions = si.telegram_sessions(SESSIONS_ROOT, list(AGENT_LABELS))
    collected = collect(sessions, files)

    # 두 에이전트의 새 메시지를 한 번에 모아 시간순으로 병합한다.
    collected.sort(key=lambda m: m.ts)

    # 상태를 잃었으면 전 기간을 다시 읽은 것이라 그대로 append 하면 중복된다.
    if fresh:
        collected = filter_today(collected, datetime.now(timezone.utc))

    buckets: dict[tuple[str, str], list[Msg]] = {}
    skipped_topics: set[str] = set()
    for m in collected:
        folder = resolve_project(m.topic_id, registry)
        if not folder:
            skipped_topics.add(m.topic_id)
            continue  # 등록 안 된 토픽은 미러링 대상이 아니다
        buckets.setdefault((folder, day_key(m)), []).append(m)

    written = 0
    for (folder, day), msgs in sorted(buckets.items()):
        try:
            write_day(folder, day, render(msgs), overwrite=fresh)
            written += len(msgs)
        except OSError as exc:
            log_error(f"쓰기 실패 {folder}/chat/{day}.md", exc)

    try:
        save_state(state)
    except OSError as exc:
        log_error("상태 저장 실패", exc)
        return 1

    note = f" (미등록 토픽 건너뜀: {sorted(skipped_topics)})" if skipped_topics else ""
    print(f"mirrored {written} message(s) into {len(buckets)} file(s){note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
