"""
OpenClaw 고수준 CLI/RPC 래퍼.

재시작 회피 설계:
- 에이전트 생성: `openclaw agents add` CLI 사용 (plugin slot 추가 없음).
  RPC `agents.create` 는 호출하지 않음 (plugin slot 추가 시 SIGUSR1 전역 재시작 유발).
- 에이전트 갱신: `gateway call agents.update` (plugin slot 변경 없이 메타만 갱신).
- 플러그인 on/off: `plugins enable/disable` (SIGUSR1 내부 reload, 토큰 보존).
- 플러그인/전역 config: `config set --batch-file --dry-run` 선행 검증 후 실제 적용.
- `docker restart` 는 절대 호출 금지 (entrypoint 가 openclaw.json 재생성하여 토큰 로테이트).
"""

from __future__ import annotations

import json
import shlex
import tempfile
import uuid
from typing import Any

from fastapi import HTTPException

from .openclaw_ssh import (
    AGENT_ID_RE,
    CONFIG_KEY_RE,
    CONTAINER,
    PLUGIN_ID_RE,
    ensure_configured,
    openclaw_exec,
    openclaw_run_checked,
    parse_table_rows,
    rows_to_dicts,
    ssh_run,
)


def _require(pattern, value: str, field: str) -> None:
    if not pattern.match(value):
        raise HTTPException(status_code=400, detail=f"invalid {field}: {value!r}")


# ---------------------------------------------------------------------------
# agents
# ---------------------------------------------------------------------------

def agents_list() -> list[dict[str, Any]]:
    """Return paired + discovered agents.

    CLI: `openclaw agents list` (box-drawing table).
    """
    raw = openclaw_run_checked("agents list")
    rows = parse_table_rows(raw)
    dicts = rows_to_dicts(rows)
    out: list[dict[str, Any]] = []
    for entry in dicts:
        out.append({
            "id": entry.get("id") or entry.get("agent") or "",
            "displayName": entry.get("name") or entry.get("display name") or entry.get("display") or "",
            "model": entry.get("model") or "",
            "theme": entry.get("theme") or "",
            "emoji": entry.get("emoji") or "",
            "avatar": entry.get("avatar") or "",
            "raw": entry,
        })
    return [a for a in out if a["id"]]


def agents_add(agent_id: str, display_name: str, model: str) -> dict[str, Any]:
    """Create a new agent via CLI (no plugin slot side-effects)."""
    _require(AGENT_ID_RE, agent_id, "agentId")
    if len(display_name) > 120:
        raise HTTPException(status_code=400, detail="displayName too long")
    if len(model) > 120:
        raise HTTPException(status_code=400, detail="model too long")
    cmd = (
        f"agents add --id {shlex.quote(agent_id)} "
        f"--name {shlex.quote(display_name)} "
        f"--model {shlex.quote(model)}"
    )
    out = openclaw_run_checked(cmd, timeout=30)
    return {"ok": True, "message": out.strip()[:1000]}


def agents_delete(agent_id: str) -> dict[str, Any]:
    _require(AGENT_ID_RE, agent_id, "agentId")
    out = openclaw_run_checked(f"agents delete {shlex.quote(agent_id)} --yes", timeout=30)
    return {"ok": True, "message": out.strip()[:1000]}


def agents_set_identity(agent_id: str, *, display_name: str | None = None, theme: str | None = None, emoji: str | None = None) -> dict[str, Any]:
    """Update lightweight identity fields (name / theme / emoji) via CLI."""
    _require(AGENT_ID_RE, agent_id, "agentId")
    flags: list[str] = []
    if display_name is not None:
        flags.append(f"--name {shlex.quote(display_name)}")
    if theme is not None:
        flags.append(f"--theme {shlex.quote(theme)}")
    if emoji is not None:
        flags.append(f"--emoji {shlex.quote(emoji)}")
    if not flags:
        return {"ok": True, "message": "nothing to update"}
    out = openclaw_run_checked(f"agents set-identity {shlex.quote(agent_id)} {' '.join(flags)}", timeout=20)
    return {"ok": True, "message": out.strip()[:1000]}


def agents_update_rpc(agent_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """Update agent via RPC `agents.update` (model/files without plugin slot changes)."""
    _require(AGENT_ID_RE, agent_id, "agentId")
    params = {"id": agent_id, **patch}
    return gateway_call("agents.update", params)


def agents_files_get(agent_id: str, file_name: str) -> str:
    """Read a per-agent file (IDENTITY.md/BOOTSTRAP.md/etc) via RPC `agents.files.get`."""
    _require(AGENT_ID_RE, agent_id, "agentId")
    if not file_name or "/" in file_name or file_name.startswith("."):
        raise HTTPException(status_code=400, detail="invalid file name")
    result = gateway_call("agents.files.get", {"agentId": agent_id, "name": file_name})
    return result.get("content", "") if isinstance(result, dict) else ""


def agents_files_list(agent_id: str) -> list[str]:
    _require(AGENT_ID_RE, agent_id, "agentId")
    result = gateway_call("agents.files.list", {"agentId": agent_id})
    if isinstance(result, dict) and "files" in result:
        return list(result["files"])
    return result if isinstance(result, list) else []


def agents_files_set(agent_id: str, file_name: str, content: str) -> dict[str, Any]:
    _require(AGENT_ID_RE, agent_id, "agentId")
    if not file_name or "/" in file_name or file_name.startswith("."):
        raise HTTPException(status_code=400, detail="invalid file name")
    return gateway_call("agents.files.set", {
        "agentId": agent_id,
        "name": file_name,
        "content": content,
    })


# ---------------------------------------------------------------------------
# plugins
# ---------------------------------------------------------------------------

def plugins_list() -> list[dict[str, Any]]:
    raw = openclaw_run_checked("plugins list")
    rows = parse_table_rows(raw)
    dicts = rows_to_dicts(rows)
    out: list[dict[str, Any]] = []
    for entry in dicts:
        pid = entry.get("plugin") or entry.get("id") or entry.get("name") or ""
        enabled_raw = (entry.get("enabled") or entry.get("status") or "").lower()
        out.append({
            "id": pid,
            "enabled": enabled_raw in ("yes", "true", "on", "enabled", "\u2713", "*"),
            "version": entry.get("version", ""),
            "source": entry.get("source", ""),
            "raw": entry,
        })
    return [p for p in out if p["id"]]


def plugin_enable(plugin_id: str) -> dict[str, Any]:
    _require(PLUGIN_ID_RE, plugin_id, "pluginId")
    out = openclaw_run_checked(f"plugins enable {shlex.quote(plugin_id)}", timeout=30)
    return {"ok": True, "message": out.strip()[:1000]}


def plugin_disable(plugin_id: str) -> dict[str, Any]:
    _require(PLUGIN_ID_RE, plugin_id, "pluginId")
    out = openclaw_run_checked(f"plugins disable {shlex.quote(plugin_id)}", timeout=30)
    return {"ok": True, "message": out.strip()[:1000]}


def plugin_inspect(plugin_id: str) -> dict[str, Any]:
    _require(PLUGIN_ID_RE, plugin_id, "pluginId")
    out = openclaw_run_checked(f"plugins inspect {shlex.quote(plugin_id)} --json", timeout=20)
    try:
        return json.loads(out.strip() or "{}")
    except json.JSONDecodeError:
        return {"raw": out}


# ---------------------------------------------------------------------------
# config (global + per-plugin)
# ---------------------------------------------------------------------------

def _mask_secrets(tree: Any) -> Any:
    """Recursively mask keys that look like secrets."""
    SENSITIVE = ("token", "apikey", "api_key", "password", "secret", "credential")
    if isinstance(tree, dict):
        out: dict[str, Any] = {}
        for k, v in tree.items():
            if isinstance(k, str) and any(s in k.lower() for s in SENSITIVE) and isinstance(v, str) and len(v) > 3:
                out[k] = f"***{v[-4:]}"
            else:
                out[k] = _mask_secrets(v)
        return out
    if isinstance(tree, list):
        return [_mask_secrets(x) for x in tree]
    return tree


def config_get(key: str = "", *, mask: bool = True) -> Any:
    """Read config value(s). Empty key returns full tree."""
    if key:
        _require(CONFIG_KEY_RE, key, "key")
        cmd = f"config get {shlex.quote(key)} --json"
    else:
        cmd = "config get --json"
    raw = openclaw_run_checked(cmd, timeout=20)
    try:
        data = json.loads(raw.strip() or "null")
    except json.JSONDecodeError:
        data = {"raw": raw}
    return _mask_secrets(data) if mask else data


def config_schema() -> dict[str, Any]:
    raw = openclaw_run_checked("config schema --json", timeout=20)
    try:
        return json.loads(raw.strip() or "{}")
    except json.JSONDecodeError:
        return {"raw": raw}


def config_set_batch(pairs: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Apply multiple config changes atomically via `config set --batch-file`.

    pairs: {"plugins.entries.tavily.config.webSearch.apiKey": "sk-..."}
    """
    ensure_configured()
    if not pairs:
        return {"ok": True, "applied": 0, "dryRun": dry_run}
    for k in pairs.keys():
        _require(CONFIG_KEY_RE, k, "config key")
    payload = "\n".join(f"{k}={json.dumps(v, ensure_ascii=False)}" for k, v in pairs.items())
    remote_tmp = f"/tmp/openclaw-batch-{uuid.uuid4().hex}.env"
    write_cmd = f"cat > {shlex.quote(remote_tmp)} <<'__TVAI_EOF__'\n{payload}\n__TVAI_EOF__"
    rc, _, err = ssh_run(write_cmd, timeout=20)
    if rc != 0:
        raise HTTPException(status_code=502, detail=f"failed to stage batch file: {err.strip()[:300]}")
    try:
        copy_cmd = f"docker cp {shlex.quote(remote_tmp)} {shlex.quote(CONTAINER)}:/tmp/openclaw-batch.env"
        rc, _, err = ssh_run(copy_cmd, timeout=20)
        if rc != 0:
            raise HTTPException(status_code=502, detail=f"docker cp failed: {err.strip()[:300]}")
        apply_cmd = "config set --batch-file /tmp/openclaw-batch.env --strict-json"
        if dry_run:
            apply_cmd += " --dry-run"
        rc, out, err = openclaw_exec(apply_cmd, timeout=30)
        if rc != 0:
            raise HTTPException(
                status_code=400 if dry_run else 502,
                detail=f"config set {'dry-run' if dry_run else 'apply'} failed: {(err or out).strip()[:600]}",
            )
        return {"ok": True, "applied": len(pairs), "dryRun": dry_run, "output": out.strip()[:1500]}
    finally:
        ssh_run(f"rm -f {shlex.quote(remote_tmp)}", timeout=10)


def config_set_with_validation(pairs: dict[str, Any]) -> dict[str, Any]:
    """Dry-run first, then apply. Fail fast on validation error."""
    config_set_batch(pairs, dry_run=True)
    return config_set_batch(pairs, dry_run=False)


# ---------------------------------------------------------------------------
# plugin config helpers (wrap global config paths)
# ---------------------------------------------------------------------------

def plugin_config_get(plugin_id: str) -> dict[str, Any]:
    _require(PLUGIN_ID_RE, plugin_id, "pluginId")
    return config_get(f"plugins.entries.{plugin_id}", mask=True)


def plugin_config_set(plugin_id: str, config: dict[str, Any]) -> dict[str, Any]:
    _require(PLUGIN_ID_RE, plugin_id, "pluginId")
    pairs = {f"plugins.entries.{plugin_id}.config": config}
    return config_set_with_validation(pairs)


def plugin_set_enabled(plugin_id: str, enabled: bool) -> dict[str, Any]:
    _require(PLUGIN_ID_RE, plugin_id, "pluginId")
    pairs = {f"plugins.entries.{plugin_id}.enabled": enabled}
    return config_set_with_validation(pairs)


# ---------------------------------------------------------------------------
# gateway RPC (direct call via CLI)
# ---------------------------------------------------------------------------

def gateway_call(method: str, params: dict[str, Any] | None = None, *, timeout: int = 30) -> Any:
    """Invoke an OpenClaw gateway RPC method via `openclaw gateway call ... --json`."""
    if not method or not all(c.isalnum() or c in "._" for c in method):
        raise HTTPException(status_code=400, detail=f"invalid method: {method!r}")
    params_json = json.dumps(params or {}, ensure_ascii=False)
    cmd = f"gateway call {shlex.quote(method)} --params {shlex.quote(params_json)} --json"
    raw = openclaw_run_checked(cmd, timeout=timeout)
    try:
        return json.loads(raw.strip() or "null")
    except json.JSONDecodeError:
        return {"raw": raw}


def gateway_health() -> dict[str, Any]:
    rc, out, _ = openclaw_exec("gateway health --json", timeout=8)
    if rc != 0:
        return {"ok": False, "status": "down"}
    try:
        data = json.loads(out.strip() or "{}")
        data["ok"] = True
        return data
    except json.JSONDecodeError:
        return {"ok": True, "raw": out.strip()}


# ---------------------------------------------------------------------------
# audit log
# ---------------------------------------------------------------------------

def config_audit_tail(lines: int = 50) -> list[dict[str, Any]]:
    """Read the last N entries from /data/.openclaw/logs/config-audit.jsonl."""
    if lines <= 0 or lines > 500:
        raise HTTPException(status_code=400, detail="lines must be 1..500")
    cmd = (
        f"docker exec {shlex.quote(CONTAINER)} "
        f"sh -c {shlex.quote(f'tail -n {lines} /data/.openclaw/logs/config-audit.jsonl 2>/dev/null || true')}"
    )
    rc, out, _ = ssh_run(cmd, timeout=15)
    if rc != 0 or not out.strip():
        return []
    entries: list[dict[str, Any]] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            entries.append({"raw": line})
    return entries
