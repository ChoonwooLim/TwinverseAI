"""
OpenClaw SSH 공통 레이어.

OpenClaw 컨테이너는 twinverse-ai(192.168.219.117)에 있고, CLI(`openclaw ...`)로만
조작 가능한 기능이 많다. 따라서 TwinverseAI 백엔드는 paramiko SSH -> docker exec로
CLI를 호출하고 stdout을 파싱한다.

설계 원칙:
- SSH 자격증명은 백엔드만 보유. 프론트엔드/WS 클라이언트 미노출.
- 모든 command 인자는 shlex.quote로 이스케이프 (command injection 방어).
- 한 SSH 연결당 한 명령 — 영속 세션은 유지하지 않음 (paramiko 재사용보다 안전).
"""

from __future__ import annotations

import base64
import io
import os
import re
import shlex
from typing import Any

from fastapi import HTTPException


SSH_HOST = os.getenv("OPENCLAW_SSH_HOST", "").strip()
SSH_USER = os.getenv("OPENCLAW_SSH_USER", "").strip()
SSH_PASSWORD = os.getenv("OPENCLAW_SSH_PASSWORD", "").strip() or None
SSH_KEY_B64 = os.getenv("OPENCLAW_SSH_KEY_B64", "").strip() or None
SSH_KEY_PATH = os.getenv("OPENCLAW_SSH_KEY_PATH", "").strip() or None
CONTAINER = os.getenv("OPENCLAW_CONTAINER", "openclaw").strip() or "openclaw"


def ensure_configured() -> None:
    if not SSH_HOST or not SSH_USER:
        raise HTTPException(
            status_code=503,
            detail="OpenClaw SSH not configured (set OPENCLAW_SSH_HOST/USER in .env)",
        )


def _load_pkey():
    """Load a paramiko PKey from OPENCLAW_SSH_KEY_B64 or OPENCLAW_SSH_KEY_PATH (tries ed25519 then rsa)."""
    import paramiko

    if SSH_KEY_B64:
        try:
            pem = base64.b64decode(SSH_KEY_B64).decode("utf-8")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OPENCLAW_SSH_KEY_B64 decode failed: {e}") from e
        buf = io.StringIO(pem)
        for cls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
            try:
                buf.seek(0)
                return cls.from_private_key(buf)
            except paramiko.ssh_exception.SSHException:
                continue
        raise HTTPException(status_code=500, detail="OPENCLAW_SSH_KEY_B64: unsupported key format")

    if SSH_KEY_PATH and os.path.exists(SSH_KEY_PATH):
        for cls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
            try:
                return cls.from_private_key_file(SSH_KEY_PATH)
            except paramiko.ssh_exception.SSHException:
                continue
        raise HTTPException(status_code=500, detail=f"OPENCLAW_SSH_KEY_PATH: unsupported key format ({SSH_KEY_PATH})")

    return None


def ssh_run(command: str, timeout: int = 20) -> tuple[int, str, str]:
    """Run a shell command on twinverse-ai via paramiko. Returns (rc, stdout, stderr)."""
    import paramiko

    pkey = _load_pkey()
    use_key = pkey is not None

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=SSH_HOST,
            username=SSH_USER,
            pkey=pkey,
            password=None if use_key else SSH_PASSWORD,
            look_for_keys=False,
            allow_agent=False,
            timeout=timeout,
        )
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        rc = stdout.channel.recv_exit_status()
        return (
            rc,
            stdout.read().decode("utf-8", errors="replace"),
            stderr.read().decode("utf-8", errors="replace"),
        )
    finally:
        client.close()


def openclaw_exec(subcommand: str, timeout: int = 20) -> tuple[int, str, str]:
    """Run `docker exec <container> openclaw <subcommand>`."""
    cmd = f"docker exec {shlex.quote(CONTAINER)} openclaw {subcommand}"
    return ssh_run(cmd, timeout=timeout)


def openclaw_run_checked(subcommand: str, timeout: int = 20) -> str:
    """Run openclaw subcommand, raise HTTPException on failure. Return stdout."""
    ensure_configured()
    rc, out, err = openclaw_exec(subcommand, timeout=timeout)
    if rc != 0:
        raise HTTPException(
            status_code=502,
            detail=f"openclaw {subcommand.split()[0]} failed (rc={rc}): {(err or out).strip()[:500]}",
        )
    return out


def parse_table_rows(block: str) -> list[list[str]]:
    """Parse a CLI ASCII table (box-drawing) into rows of cells.

    CLI wraps long cells across multiple lines inside the same row. We fold
    continuation lines by joining with a space per cell.
    """
    rows: list[list[str]] = []
    current: list[str] | None = None
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("\u250c") or stripped.startswith("\u251c") or stripped.startswith("\u2514"):
            if current is not None:
                rows.append([c.strip() for c in current])
                current = None
            continue
        if not stripped.startswith("\u2502"):
            continue
        cells = [c for c in stripped.strip("\u2502").split("\u2502")]
        if current is None:
            current = cells
        else:
            if len(cells) == len(current):
                current = [
                    (a + " " + b.strip()).strip() if b.strip() else a
                    for a, b in zip(current, cells)
                ]
    if current is not None:
        rows.append([c.strip() for c in current])
    return rows


def split_sections(raw: str, section_names: list[str]) -> dict[str, str]:
    """Split CLI output into named sections (first word on a line matches)."""
    sections: dict[str, str] = {}
    current_name: str | None = None
    buf: list[str] = []
    name_set = set(section_names)
    for line in raw.splitlines():
        head = line.strip().split()
        if head and head[0] in name_set:
            if current_name:
                sections[current_name] = "\n".join(buf)
            current_name = head[0]
            buf = []
            continue
        buf.append(line)
    if current_name:
        sections[current_name] = "\n".join(buf)
    return sections


def rows_to_dicts(rows: list[list[str]], header_map: dict[str, str] | None = None) -> list[dict[str, Any]]:
    """Convert parsed rows (first = header) to dict list.

    header_map lets callers remap noisy header names ({"request id": "requestId"} etc.)
    """
    if not rows:
        return []
    header = [h.lower() for h in rows[0]]
    if header_map:
        header = [header_map.get(h, h) for h in header]
    out: list[dict[str, Any]] = []
    for row in rows[1:]:
        if len(row) != len(header):
            continue
        out.append(dict(zip(header, row)))
    return out


REQUEST_ID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")
AGENT_ID_RE = re.compile(r"^[a-z0-9][a-z0-9\-]{0,62}$")
PLUGIN_ID_RE = re.compile(r"^[a-z0-9][a-z0-9\-._]{0,62}$")
CONFIG_KEY_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9\-._]{0,255}$")
