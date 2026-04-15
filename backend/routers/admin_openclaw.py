"""
OpenClaw device pairing admin proxy.

OpenClaw 의 디바이스 승인은 WS RPC 가 아니라 CLI(`openclaw devices`)로만 가능하다
(CLI 가 /data/.openclaw state 를 직접 조작). 따라서 본 라우터는 `.env` 의
OPENCLAW_SSH_* 설정으로 twinverse-ai 에 SSH 접속 → `docker exec <container>
openclaw devices list/approve` 를 실행하고, 텍스트 출력을 파싱한다.

보안:
- admin 이상만 호출 가능 (CLAUDE.md 의 역할 모델 준수).
- SSH 자격증명은 백엔드만 알고 있고, 프론트엔드/클라이언트에는 노출하지 않는다.
"""

from __future__ import annotations

import os
import re
import shlex
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import require_admin
from models import User

router = APIRouter()


SSH_HOST = os.getenv("OPENCLAW_SSH_HOST", "").strip()
SSH_USER = os.getenv("OPENCLAW_SSH_USER", "").strip()
SSH_PASSWORD = os.getenv("OPENCLAW_SSH_PASSWORD", "").strip() or None
CONTAINER = os.getenv("OPENCLAW_CONTAINER", "openclaw").strip() or "openclaw"

_REQUEST_ID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


class ApproveResponse(BaseModel):
    ok: bool
    message: str


def _ensure_configured() -> None:
    if not SSH_HOST or not SSH_USER:
        raise HTTPException(
            status_code=503,
            detail="OpenClaw SSH not configured (set OPENCLAW_SSH_HOST/USER in .env)",
        )


def _ssh_run(command: str, timeout: int = 20) -> tuple[int, str, str]:
    """Run a shell command on twinverse-ai via paramiko."""
    import paramiko

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=SSH_HOST,
            username=SSH_USER,
            password=SSH_PASSWORD,
            look_for_keys=SSH_PASSWORD is None,
            allow_agent=SSH_PASSWORD is None,
            timeout=timeout,
        )
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        rc = stdout.channel.recv_exit_status()
        return rc, stdout.read().decode("utf-8", errors="replace"), stderr.read().decode("utf-8", errors="replace")
    finally:
        client.close()


def _devices_list_raw() -> str:
    rc, out, err = _ssh_run(f"docker exec {shlex.quote(CONTAINER)} openclaw devices list")
    if rc != 0:
        raise HTTPException(
            status_code=502,
            detail=f"openclaw devices list failed (rc={rc}): {err or out}",
        )
    return out


def _parse_table_rows(block: str) -> list[list[str]]:
    """Parse a CLI ASCII table (`┌─┐│├┤└┘`) into rows of cell strings.

    CLI wraps long cells across multiple lines inside the same row. We
    fold continuation lines by joining them with a space per cell.
    """
    rows: list[list[str]] = []
    current: list[str] | None = None
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("┌") or stripped.startswith("├") or stripped.startswith("└"):
            # separator — commit current row
            if current is not None:
                rows.append([c.strip() for c in current])
                current = None
            continue
        if not stripped.startswith("│"):
            continue
        cells = [c for c in stripped.strip("│").split("│")]
        if current is None:
            current = cells
        else:
            # continuation: concat cell-wise
            if len(cells) == len(current):
                current = [
                    (a + " " + b.strip()).strip() if b.strip() else a
                    for a, b in zip(current, cells)
                ]
    if current is not None:
        rows.append([c.strip() for c in current])
    return rows


def _split_sections(raw: str) -> dict[str, str]:
    """Split `openclaw devices list` output into Pending / Paired sections."""
    sections: dict[str, str] = {}
    current_name: str | None = None
    buf: list[str] = []
    for line in raw.splitlines():
        m = re.match(r"^(Pending|Paired)\b", line.strip())
        if m:
            if current_name:
                sections[current_name] = "\n".join(buf)
            current_name = m.group(1)
            buf = []
            continue
        buf.append(line)
    if current_name:
        sections[current_name] = "\n".join(buf)
    return sections


def _parse_pending(raw: str) -> list[dict[str, Any]]:
    sections = _split_sections(raw)
    block = sections.get("Pending", "")
    if not block.strip():
        return []
    rows = _parse_table_rows(block)
    if not rows:
        return []
    # first row = header
    header = [h.lower() for h in rows[0]]
    out: list[dict[str, Any]] = []
    for row in rows[1:]:
        if len(row) != len(header):
            continue
        entry = dict(zip(header, row))
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
    sections = _split_sections(raw)
    block = sections.get("Paired", "")
    if not block.strip():
        return []
    rows = _parse_table_rows(block)
    if not rows:
        return []
    header = [h.lower() for h in rows[0]]
    out: list[dict[str, Any]] = []
    for row in rows[1:]:
        if len(row) != len(header):
            continue
        entry = dict(zip(header, row))
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
    _ensure_configured()
    raw = _devices_list_raw()
    return {
        "pending": _parse_pending(raw),
        "paired": _parse_paired(raw),
    }


@router.post("/approve/{request_id}", response_model=ApproveResponse)
def approve_device(request_id: str, _: User = Depends(require_admin)) -> ApproveResponse:
    _ensure_configured()
    if not _REQUEST_ID_RE.match(request_id):
        raise HTTPException(status_code=400, detail="invalid requestId format")
    cmd = f"docker exec {shlex.quote(CONTAINER)} openclaw devices approve {shlex.quote(request_id)}"
    rc, out, err = _ssh_run(cmd, timeout=30)
    if rc != 0:
        raise HTTPException(status_code=502, detail=(err or out).strip() or f"approve failed (rc={rc})")
    return ApproveResponse(ok=True, message=out.strip() or "approved")
