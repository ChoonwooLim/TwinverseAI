"""OpenClaw 세션 `.jsonl` 증분 파싱.

사용자 메시지에는 본문 앞에 여러 개의 "(untrusted ...)" 메타데이터 블록이 붙는다
(실측 3종: `Conversation info`, `Sender`, `Chat history since last reply`).
사람이 읽을 본문은 그 블록들을 모두 걷어낸 뒤 남는 꼬리다.

이 모듈만 OpenClaw 의 세션 레코드 스키마에 종속된다. 버전이 올라 형식이 바뀌면 여기만 고친다.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone

# "<라벨> (untrusted ...):\n```json\n ... ```" 형태의 블록 하나.
UNTRUSTED_BLOCK = re.compile(
    r"[^\n]*\(untrusted[^)]*\)\s*:\s*```json\s*.*?```\s*",
    re.DOTALL,
)


@dataclass(frozen=True)
class Record:
    ts: datetime      # tz-aware UTC
    role: str         # "user" | "assistant"
    text: str


def strip_untrusted_blocks(text: str) -> str:
    """앞머리의 메타데이터 블록을 전부 걷어내고 실제 본문만 남긴다."""
    return UNTRUSTED_BLOCK.sub("", text or "").strip()


def message_text(rec: dict) -> str:
    """message.content 의 텍스트 조각을 이어 붙인다."""
    content = (rec.get("message") or {}).get("content")
    if isinstance(content, str):
        return content.strip()
    parts = [
        c["text"]
        for c in (content or [])
        if isinstance(c, dict) and c.get("type") == "text" and c.get("text")
    ]
    return "\n".join(parts).strip()


def parse_ts(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)


def read_new(path: str, offset: int) -> tuple[list[Record], int]:
    """offset 이후로 새로 들어온 **완결된 줄만** 파싱한다.

    반환: (레코드 목록, 새 offset)

    마지막 줄이 아직 쓰이는 중이면 소비하지 않는다. 파일이 없으면 빈 결과를 돌려준다 —
    OpenClaw 가 세션을 인덱스에 먼저 올리고 `.jsonl` 은 나중에 flush 하기 때문에
    "아직 없음" 은 오류가 아니라 정상 상태다.
    """
    try:
        with open(path, "rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            start = 0 if offset > size else offset  # 잘렸거나 교체됨 → 처음부터
            fh.seek(start)
            raw = fh.read()
    except FileNotFoundError:
        return [], offset

    cut = raw.rfind(b"\n")
    if cut == -1:
        return [], start
    complete = raw[: cut + 1]
    new_offset = start + len(complete)

    out: list[Record] = []
    for line in complete.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue  # 깨진 줄 하나가 세션 전체를 막지 않게 한다
        if rec.get("type") != "message":
            continue
        role = (rec.get("message") or {}).get("role")
        if role not in ("user", "assistant"):
            continue
        text = message_text(rec)
        if role == "user":
            text = strip_untrusted_blocks(text)
        if not text:
            continue
        try:
            ts = parse_ts(rec["timestamp"])
        except (KeyError, ValueError, TypeError):
            continue
        out.append(Record(ts=ts, role=role, text=text))
    return out, new_offset
