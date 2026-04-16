"""
OpenClaw device pairing admin proxy.

OpenClaw 의 디바이스 승인은 WS RPC 가 아니라 CLI(`openclaw devices`)로만 가능하다
(CLI 가 /data/.openclaw state 를 직접 조작). 이 라우터는 공통 SSH 레이어
(services/openclaw_ssh.py) 를 통해 twinverse-ai 컨테이너에서 CLI 를 실행한다.

OpenClaw 풀 콘솔(에이전트 / 플러그인 / 설정 / 채팅 / 로그)은 별도 라우터
`admin_openclaw_console.py` 에 있다.
"""

from __future__ import annotations

import shlex
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import require_admin
from models import User
from services.openclaw_ssh import (
    REQUEST_ID_RE,
    ensure_configured,
    openclaw_run_checked,
    parse_table_rows,
    rows_to_dicts,
    split_sections,
)

router = APIRouter()


class ApproveResponse(BaseModel):
    ok: bool
    message: str


def _devices_list_raw() -> str:
    return openclaw_run_checked("devices list")


def _parse_pending(raw: str) -> list[dict[str, Any]]:
    sections = split_sections(raw, ["Pending", "Paired"])
    block = sections.get("Pending", "")
    if not block.strip():
        return []
    rows = parse_table_rows(block)
    dicts = rows_to_dicts(rows)
    out: list[dict[str, Any]] = []
    for entry in dicts:
        out.append({
            "requestId": entry.get("request", ""),
            "deviceId": entry.get("device", ""),
            "role": entry.get("role", ""),
            "scopes": entry.get("scopes", ""),
            "ip": entry.get("ip", ""),
            "age": entry.get("age", ""),
            "flags": entry.get("flags", ""),
        })
    return out


def _parse_paired(raw: str) -> list[dict[str, Any]]:
    sections = split_sections(raw, ["Pending", "Paired"])
    block = sections.get("Paired", "")
    if not block.strip():
        return []
    rows = parse_table_rows(block)
    dicts = rows_to_dicts(rows)
    out: list[dict[str, Any]] = []
    for entry in dicts:
        out.append({
            "deviceId": entry.get("device", ""),
            "roles": entry.get("roles", ""),
            "scopes": entry.get("scopes", ""),
            "tokens": entry.get("tokens", ""),
            "ip": entry.get("ip", ""),
        })
    return out


@router.get("/pending")
def list_pending(_: User = Depends(require_admin)) -> dict[str, Any]:
    ensure_configured()
    raw = _devices_list_raw()
    return {
        "pending": _parse_pending(raw),
        "paired": _parse_paired(raw),
    }


@router.post("/approve/{request_id}", response_model=ApproveResponse)
def approve_device(request_id: str, _: User = Depends(require_admin)) -> ApproveResponse:
    ensure_configured()
    if not REQUEST_ID_RE.match(request_id):
        raise HTTPException(status_code=400, detail="invalid requestId format")
    out = openclaw_run_checked(f"devices approve {shlex.quote(request_id)}", timeout=30)
    return ApproveResponse(ok=True, message=out.strip() or "approved")
