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
import re
import shlex
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
    ssh_run,
)


def _require(pattern, value: str, field: str) -> None:
    if not pattern.match(value):
        raise HTTPException(status_code=400, detail=f"invalid {field}: {value!r}")


# ---------------------------------------------------------------------------
# agents
# ---------------------------------------------------------------------------

def agents_list() -> list[dict[str, Any]]:
    """Return paired + discovered agents via `openclaw agents list --json`."""
    raw = openclaw_run_checked("agents list --json")
    try:
        data = json.loads(raw.strip() or "[]")
    except json.JSONDecodeError:
        return []
    items = data if isinstance(data, list) else []
    out: list[dict[str, Any]] = []
    for a in items:
        if not isinstance(a, dict):
            continue
        model = a.get("model")
        if isinstance(model, dict):
            model = model.get("primary") or model.get("id") or ""
        out.append({
            "id": a.get("id", ""),
            "displayName": a.get("identityName") or a.get("name", ""),
            "model": model or "",
            "theme": a.get("identityTheme", ""),
            "emoji": a.get("identityEmoji", ""),
            "avatar": a.get("identityAvatar", ""),
            "workspace": a.get("workspace", ""),
            "isDefault": bool(a.get("isDefault", False)),
        })
    return [a for a in out if a["id"]]


_IDENTITY_SEP = "@@@TV_IDENTITY_SEP@@@"

_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
# Templates/placeholder lines to filter when they leak into the snippet.
_TEMPLATE_MARKERS = (
    "Fill this in",
    "Make it yours",
    "(pick something",
    "Who Am I?",
    "This isn't just metadata",
    "start of figuring out who you are",
    "Save this file at the workspace root",
    "metadata. It's the start",
)


def _strip_boilerplate_blocks(md: str) -> str:
    """Drop language-directive preambles and YAML frontmatter from IDENTITY.md.

    Every agent's IDENTITY.md is seeded with a korean-only-directive preamble
    ending at a standalone `---` horizontal rule, sometimes followed by a
    YAML frontmatter block. Strip both so the description snippet starts at
    the agent's actual self-introduction.
    """
    lines = md.splitlines()

    def drop_block_ending_at_hr(start: int) -> int:
        for j in range(start, len(lines)):
            if lines[j].strip() == "---":
                return j + 1
        return start

    i = 0
    # Skip leading korean-only-directive block (opens with HTML comment or
    # a Korean "언어 절대 규칙" heading and ends at the first standalone `---`).
    opening = "\n".join(lines[:6]).lower()
    if "korean-only-directive" in opening or "언어 절대 규칙" in opening:
        i = drop_block_ending_at_hr(0)
        # there can be two consecutive `---` separators between the directive
        # block and the frontmatter — skip blank lines and another rule if so.
        while i < len(lines) and not lines[i].strip():
            i += 1

    # Skip YAML frontmatter (`---\n ... \n---`) if present.
    if i < len(lines) and lines[i].strip() == "---":
        i = drop_block_ending_at_hr(i + 1)

    return "\n".join(lines[i:])


_FIELD_RE = re.compile(r"^\s*[-*+]?\s*\*?\*?(?P<label>[A-Za-z가-힣]+)\s*\*?\*?\s*:\s*(?P<value>.+?)\s*$")


def _extract_role_section(body: str) -> str:
    """Extract the first paragraph under a `## 역할` / `## Role` heading."""
    lines = body.splitlines()
    i = 0
    while i < len(lines):
        s = lines[i].strip().lower()
        if s.startswith("##") and ("역할" in s or "role" in s):
            i += 1
            buf: list[str] = []
            while i < len(lines):
                line = lines[i].strip()
                if not line:
                    if buf:
                        break
                    i += 1
                    continue
                if line.startswith("#") or line == "---" or line.startswith(("- ", "* ", "+ ")):
                    break
                buf.append(line)
                i += 1
            text = " ".join(buf).replace("**", "").replace("__", "").strip()
            if text:
                return text
            return ""
        i += 1
    return ""


def _extract_field_value(body: str, labels: tuple[str, ...]) -> str:
    """Grab the value of a `**Label:** value` line for any label in `labels`."""
    wanted = {label.lower() for label in labels}
    for raw in body.splitlines():
        m = _FIELD_RE.match(raw)
        if not m:
            continue
        label = m.group("label").lower()
        if label in wanted:
            value = m.group("value").replace("**", "").replace("__", "").strip()
            value = value.strip("_*").strip()
            if value and not (value.startswith("(") and value.endswith(")")):
                return value
    return ""


def _extract_role_from_identity(md: str) -> str:
    """Pick a clean human-readable description from IDENTITY.md.

    Priority:
    1. First paragraph under a `## 역할` / `## Role` heading.
    2. Value of the `**Role:**` / `**역할:**` field.
    3. Value of the `**Creature:**` field.
    4. First 1-2 meaningful lines (legacy fallback).
    """
    if not md:
        return ""
    body = _HTML_COMMENT_RE.sub("", md)
    body = _strip_boilerplate_blocks(body)

    text = _extract_role_section(body)
    if text:
        return text[:160]

    text = _extract_field_value(body, ("Role", "역할"))
    if text:
        return text[:160]

    text = _extract_field_value(body, ("Creature",))
    if text:
        return text[:160]

    out: list[str] = []
    in_fence = False
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if line == "---":
            break
        if line.startswith("#"):
            continue
        if any(m in line for m in _TEMPLATE_MARKERS):
            continue
        if line.startswith(("- ", "* ", "+ ")):
            line = line[2:]
        line = line.replace("**", "").replace("__", "")
        line = line.strip("_*").strip()
        if not line or (line.startswith("(") and line.endswith(")")):
            continue
        if line.endswith(":") and len(line) <= 24:
            continue
        out.append(line)
        if len(out) >= 2:
            break
    return " ".join(out)[:160]


def agents_list_with_roles() -> list[dict[str, Any]]:
    """Agents + inline role (first lines of IDENTITY.md), in ONE extra SSH call.

    Replaces the N+1 fetch pattern (agents list + per-agent IDENTITY.md) that
    forced the browser to open N SSH sessions through the backend's thread
    pool. With 15+ agents this regularly saturated the Render thread pool
    and produced transient 502s upstream.
    """
    agents = agents_list()
    if not agents:
        return agents
    parts: list[str] = []
    for a in agents:
        workspace = a.get("workspace") or f"/data/.openclaw/workspace-{a['id']}"
        escaped = shlex.quote(f"{workspace}/IDENTITY.md")
        parts.append(
            f"printf '\\n{_IDENTITY_SEP}%s{_IDENTITY_SEP}\\n' {shlex.quote(a['id'])}; "
            f"head -c 4096 {escaped} 2>/dev/null || true"
        )
    script = "; ".join(parts)
    cmd = f"docker exec {shlex.quote(CONTAINER)} sh -c {shlex.quote(script)}"
    rc, out, _ = ssh_run(cmd, timeout=20)
    if rc != 0 or not out:
        return agents  # best-effort: return without roles rather than fail
    # Output shape: [leading junk] SEP <id> SEP <content> SEP <id> SEP <content> ...
    # Splitting on SEP yields: [junk, id1, content1, id2, content2, ...]
    # Walk in pairs starting at index 1.
    tokens = out.split(_IDENTITY_SEP)
    roles: dict[str, str] = {}
    for i in range(1, len(tokens) - 1, 2):
        agent_id = tokens[i].strip()
        body = tokens[i + 1]
        if agent_id:
            roles[agent_id] = body
    for a in agents:
        a["role"] = _extract_role_from_identity(roles.get(a["id"], ""))
    return agents


def agents_add(agent_id: str, display_name: str, model: str) -> dict[str, Any]:
    """Create a new agent via CLI (no plugin slot side-effects).

    CLI signature: `openclaw agents add [name] --model <id> --workspace <dir> --non-interactive`.
    The positional `name` becomes the agent id. Display name is then set via
    set-identity (caller should follow up with agents_set_identity for non-slug names).
    """
    _require(AGENT_ID_RE, agent_id, "agentId")
    if len(display_name) > 120:
        raise HTTPException(status_code=400, detail="displayName too long")
    if len(model) > 120:
        raise HTTPException(status_code=400, detail="model too long")
    workspace = f"/data/.openclaw/workspace-{agent_id}"
    cmd = (
        f"agents add {shlex.quote(agent_id)} "
        f"--model {shlex.quote(model)} "
        f"--workspace {shlex.quote(workspace)} "
        f"--non-interactive --json"
    )
    out = openclaw_run_checked(cmd, timeout=30)
    _fix_agent_dir_ownership(agent_id)
    if display_name and display_name != agent_id:
        try:
            agents_set_identity(agent_id, display_name=display_name)
        except HTTPException:
            pass
    return {"ok": True, "message": out.strip()[:1000]}


def _fix_agent_dir_ownership(agent_id: str) -> None:
    """Chown newly-created agent+workspace dirs to node:node.

    Container entrypoint runs as root, so `openclaw agents add` creates dirs
    with root ownership. But the gateway process runs as node (runuser -u node)
    and can't acquire /data/.openclaw/agents/<id>/sessions/sessions.json.lock,
    which makes sessions.create fail with EACCES on first chat.
    """
    paths = f"/data/.openclaw/agents/{agent_id} /data/.openclaw/workspace-{agent_id}"
    inner = f"chown -R node:node {paths} 2>/dev/null || true"
    cmd = f"docker exec {shlex.quote(CONTAINER)} sh -c {shlex.quote(inner)}"
    try:
        ssh_run(cmd, timeout=10)
    except Exception:
        pass  # best-effort; surfaces later as EACCES if it fails


def agents_delete(agent_id: str) -> dict[str, Any]:
    _require(AGENT_ID_RE, agent_id, "agentId")
    out = openclaw_run_checked(f"agents delete {shlex.quote(agent_id)} --force", timeout=30)
    return {"ok": True, "message": out.strip()[:1000]}


def agents_set_identity(agent_id: str, *, display_name: str | None = None, theme: str | None = None, emoji: str | None = None) -> dict[str, Any]:
    """Update lightweight identity fields (name / theme / emoji) via CLI.

    CLI: `openclaw agents set-identity --agent <id> [--name ...] [--theme ...] [--emoji ...]`
    """
    _require(AGENT_ID_RE, agent_id, "agentId")
    flags: list[str] = [f"--agent {shlex.quote(agent_id)}"]
    if display_name is not None:
        flags.append(f"--name {shlex.quote(display_name)}")
    if theme is not None:
        flags.append(f"--theme {shlex.quote(theme)}")
    if emoji is not None:
        flags.append(f"--emoji {shlex.quote(emoji)}")
    if len(flags) == 1:
        return {"ok": True, "message": "nothing to update"}
    out = openclaw_run_checked(f"agents set-identity {' '.join(flags)}", timeout=20)
    return {"ok": True, "message": out.strip()[:1000]}


def agents_update_rpc(agent_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """Update agent meta (currently: model) via targeted `config set`.

    Avoids the destructive `agents.update` RPC — that path serializes the
    gateway's in-memory agents list back to openclaw.json, which (at least
    in 2026.4.12) drops any agents the current process hasn't hydrated,
    permanently truncating the config. Targeted `config set agents.list[N].x`
    rewrites only the requested leaf and preserves siblings.
    """
    _require(AGENT_ID_RE, agent_id, "agentId")
    model = patch.get("model")
    if not model:
        return {"ok": True, "skipped": "no supported fields in patch"}
    if len(model) > 120:
        raise HTTPException(status_code=400, detail="model too long")

    # Look up the agent's index in agents.list (CLI preserves on-disk order).
    agents = agents_list()
    idx = next((i for i, a in enumerate(agents) if a["id"] == agent_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail=f"agent not found: {agent_id}")

    path = f"agents.list[{idx}].model"
    # `config set <path> <value>` expects JSON-encoded value (strict-json).
    value_json = json.dumps(model, ensure_ascii=False)
    cmd = f"config set {shlex.quote(path)} {shlex.quote(value_json)} --strict-json"
    out = openclaw_run_checked(cmd, timeout=20)
    # config set runs as root via docker exec; fix ownership so gateway's
    # file watcher (runs as node) can re-arm on inotify.
    _chown_config_to_node()
    return {"ok": True, "path": path, "model": model, "message": out.strip()[:500]}


def _chown_config_to_node() -> None:
    """Chown /data/.openclaw/openclaw.json* back to node:node after a root-exec config write.

    Without this, the next inotify watch attempt from the gateway (which runs as
    `node` via runuser) fails with EACCES and hot-reload stops working until the
    next gateway restart.
    """
    inner = "chown node:node /data/.openclaw/openclaw.json /data/.openclaw/openclaw.json.bak* 2>/dev/null || true"
    cmd = f"docker exec {shlex.quote(CONTAINER)} sh -c {shlex.quote(inner)}"
    try:
        ssh_run(cmd, timeout=10)
    except Exception:
        pass  # best-effort


def _agent_workspace(agent_id: str) -> str:
    """Return the on-disk workspace path for an agent, looked up from `agents list --json`."""
    for a in agents_list():
        if a["id"] == agent_id:
            return a.get("workspace") or f"/data/.openclaw/workspace-{agent_id}"
    return f"/data/.openclaw/workspace-{agent_id}"


def agents_files_get(agent_id: str, file_name: str) -> str:
    """Read a per-agent file. RPC first, fall back to direct docker exec cat."""
    _require(AGENT_ID_RE, agent_id, "agentId")
    if not file_name or "/" in file_name or file_name.startswith("."):
        raise HTTPException(status_code=400, detail="invalid file name")
    try:
        result = gateway_call("agents.files.get", {"agentId": agent_id, "name": file_name})
        if isinstance(result, dict) and "content" in result:
            return result.get("content", "")
    except HTTPException:
        pass
    workspace = _agent_workspace(agent_id)
    path = f"{workspace}/{file_name}"
    cmd = f"docker exec {shlex.quote(CONTAINER)} sh -c {shlex.quote(f'cat {shlex.quote(path)} 2>/dev/null || true')}"
    rc, out, _ = ssh_run(cmd, timeout=15)
    return out if rc == 0 else ""


def agents_files_list(agent_id: str) -> list[str]:
    _require(AGENT_ID_RE, agent_id, "agentId")
    try:
        result = gateway_call("agents.files.list", {"agentId": agent_id})
        if isinstance(result, dict) and "files" in result:
            return list(result["files"])
        if isinstance(result, list):
            return result
    except HTTPException:
        pass
    workspace = _agent_workspace(agent_id)
    cmd = (
        f"docker exec {shlex.quote(CONTAINER)} sh -c "
        f"{shlex.quote(f'ls -1 {shlex.quote(workspace)} 2>/dev/null | head -50')}"
    )
    rc, out, _ = ssh_run(cmd, timeout=15)
    if rc != 0:
        return []
    return [line.strip() for line in out.splitlines() if line.strip() and not line.startswith(".")]


def agents_files_set(agent_id: str, file_name: str, content: str) -> dict[str, Any]:
    _require(AGENT_ID_RE, agent_id, "agentId")
    if not file_name or "/" in file_name or file_name.startswith("."):
        raise HTTPException(status_code=400, detail="invalid file name")
    try:
        return gateway_call("agents.files.set", {
            "agentId": agent_id,
            "name": file_name,
            "content": content,
        })
    except HTTPException:
        pass
    workspace = _agent_workspace(agent_id)
    remote_tmp = f"/tmp/agent-file-{uuid.uuid4().hex}"
    heredoc = f"cat > {shlex.quote(remote_tmp)} <<'__TVAI_AGENT_FILE_EOF__'\n{content}\n__TVAI_AGENT_FILE_EOF__"
    rc, _, err = ssh_run(heredoc, timeout=20)
    if rc != 0:
        raise HTTPException(status_code=502, detail=f"stage file failed: {err.strip()[:200]}")
    try:
        target = f"{workspace}/{file_name}"
        rc, _, err = ssh_run(
            f"docker exec {shlex.quote(CONTAINER)} mkdir -p {shlex.quote(workspace)} && "
            f"docker cp {shlex.quote(remote_tmp)} {shlex.quote(CONTAINER)}:{shlex.quote(target)}",
            timeout=20,
        )
        if rc != 0:
            raise HTTPException(status_code=502, detail=f"docker cp failed: {err.strip()[:200]}")
        return {"ok": True, "path": target}
    finally:
        ssh_run(f"rm -f {shlex.quote(remote_tmp)}", timeout=10)


# ---------------------------------------------------------------------------
# plugins
# ---------------------------------------------------------------------------

def plugins_list() -> list[dict[str, Any]]:
    """List plugins via `openclaw plugins list --json`.

    Returns list of {id, name, enabled, version, source, status, description, origin}.
    """
    raw = openclaw_run_checked("plugins list --json")
    try:
        data = json.loads(raw.strip() or "{}")
    except json.JSONDecodeError:
        return []
    plugins = data.get("plugins", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    out: list[dict[str, Any]] = []
    for p in plugins:
        if not isinstance(p, dict):
            continue
        out.append({
            "id": p.get("id", ""),
            "name": p.get("name", ""),
            "enabled": bool(p.get("enabled", False)),
            "version": p.get("version", ""),
            "source": p.get("source", ""),
            "status": p.get("status", ""),
            "description": p.get("description", ""),
            "origin": p.get("origin", ""),
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
    """Read a config value at `key`. CLI requires a dot path — empty key returns {}.

    For tree-level inspection use schema() or pass a concrete prefix like `plugins.entries`.
    """
    if not key:
        return {}
    _require(CONFIG_KEY_RE, key, "key")
    cmd = f"config get {shlex.quote(key)} --json"
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


def config_set_single(path: str, value: Any) -> dict[str, Any]:
    """Write one config path via `config set <path> <json>` (single-path mode).

    Use when batch-file is unreliable. Runs `_chown_config_to_node()` after so
    the gateway's inotify watcher (runs as `node`) can re-arm.
    """
    ensure_configured()
    _require(CONFIG_KEY_RE, path, "config key")
    value_json = json.dumps(value, ensure_ascii=False)
    cmd = f"config set {shlex.quote(path)} {shlex.quote(value_json)} --strict-json"
    out = openclaw_run_checked(cmd, timeout=20)
    _chown_config_to_node()
    return {"ok": True, "path": path, "output": out.strip()[:500]}


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


def models_list() -> list[dict[str, Any]]:
    """List all models selectable as an agent backend.

    Two sources:
      1. Ollama (host `twinverse-ai:11434` REST API) — id = `ollama/<name>`.
      2. OpenClaw `models.providers` config — every provider (anthropic,
         openai-codex, etc.) contributes its `models[]` array with id =
         `<provider>/<modelId>`.
    """
    ensure_configured()
    models: list[dict[str, Any]] = []

    # --- Ollama models -------------------------------------------------------
    rc, out, _ = ssh_run("curl -s --max-time 5 http://localhost:11434/api/tags", timeout=10)
    if rc == 0:
        try:
            data = json.loads(out.strip() or "{}")
        except json.JSONDecodeError:
            data = {}
        TOOL_FAMILIES = {"qwen", "qwen2", "qwen2.5", "qwen3", "mistral", "llama3", "command-r"}
        for m in data.get("models", []):
            name = m.get("name") or m.get("model") or ""
            if not name:
                continue
            details = m.get("details") or {}
            family = details.get("family", "")
            families = details.get("families", []) or []
            supports_tools = family in TOOL_FAMILIES or any(f in TOOL_FAMILIES for f in families)
            models.append({
                "id": f"ollama/{name}",
                "name": name,
                "provider": "ollama",
                "size": m.get("size", 0),
                "family": family,
                "parameterSize": details.get("parameter_size", ""),
                "quantization": details.get("quantization_level", ""),
                "supportsTools": supports_tools,
            })

    # --- Provider models (anthropic, openai-codex, …) -----------------------
    try:
        providers = config_get("models.providers", mask=True) or {}
    except Exception:
        providers = {}
    if isinstance(providers, dict):
        for provider_name, provider_cfg in providers.items():
            if not isinstance(provider_cfg, dict):
                continue
            for entry in provider_cfg.get("models") or []:
                if not isinstance(entry, dict):
                    continue
                model_id = entry.get("id") or entry.get("name")
                if not model_id:
                    continue
                models.append({
                    "id": f"{provider_name}/{model_id}",
                    "name": model_id,
                    "provider": provider_name,
                    "api": entry.get("api"),
                    "cloud": True,
                    "supportsTools": True,  # cloud providers generally support tools
                })

    # cloud models bubble after Ollama tool-capable, before non-tool Ollama
    models.sort(key=lambda x: (not x.get("supportsTools"), x.get("provider") != "ollama", x["id"]))
    return models


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
