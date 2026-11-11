"""gateway_health() must explain *why* the gateway is down instead of a bare "down".

Context: on 2026-11-10 the OpenClaw gateway died of a JS heap OOM and the admin console only
showed "Gateway down" for ~22h because the CLI's stderr was discarded.
"""
import socket

import pytest

from services import openclaw_cli as cli

DOWN_STDERR = (
    "Error: gateway closed (1006 abnormal closure (no close frame)): no close reason\n"
    "Gateway target: ws://127.0.0.1:18789\n"
    "Source: local loopback\n"
    "Config: /data/.openclaw/openclaw.json\n"
    "Bind: lan\n"
)


def _fake_exec(rc, out="", err=""):
    def _exec(subcommand, timeout=20):
        assert subcommand == "gateway health --json"
        return rc, out, err
    return _exec


def test_down_reports_cli_error_line_and_hint(monkeypatch):
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(1, err=DOWN_STDERR))
    r = cli.gateway_health()
    assert r["ok"] is False
    assert r["status"] == "down"
    assert r["error"] == "gateway closed (1006 abnormal closure (no close frame)): no close reason"
    assert "재시작" in r["hint"]


def test_stopped_container_is_reported(monkeypatch):
    err = "Error response from daemon: container 5e04efccc76b is not running\n"
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(1, err=err))
    r = cli.gateway_health()
    assert r["ok"] is False
    assert "is not running" in r["error"]
    assert "컨테이너" in r["hint"]


def test_falls_back_to_stdout_when_stderr_empty(monkeypatch):
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(1, out="\x1b[31mconnect ECONNREFUSED 127.0.0.1:18789\x1b[0m\n"))
    r = cli.gateway_health()
    assert r["error"] == "connect ECONNREFUSED 127.0.0.1:18789"


def test_token_like_strings_are_redacted(monkeypatch):
    secret = "29604dcbe56e794c6ebbbd296070b27d2e8908170ce5578a7bfd40194028a27f"
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(1, err=f"Error: unauthorized token {secret}\n"))
    r = cli.gateway_health()
    assert secret not in r["error"]
    assert "<redacted>" in r["error"]


def test_file_paths_are_not_redacted(monkeypatch):
    err = "Error: Cannot find module '/usr/local/lib/node_modules/openclaw/dist/subagent-registry'\n"
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(1, err=err))
    r = cli.gateway_health()
    assert "/usr/local/lib/node_modules/openclaw/dist/subagent-registry" in r["error"]


def test_error_is_length_capped(monkeypatch):
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(1, err="Error: " + "x " * 500))
    r = cli.gateway_health()
    assert len(r["error"]) <= 300


def test_ssh_failure_becomes_unreachable_instead_of_500(monkeypatch):
    def _boom(subcommand, timeout=20):
        raise socket.timeout("timed out")
    monkeypatch.setattr(cli, "openclaw_exec", _boom)
    r = cli.gateway_health()
    assert r["ok"] is False
    assert r["status"] == "unreachable"
    assert "timed out" in r["error"]
    assert r["hint"]


def test_healthy_gateway_passes_json_through(monkeypatch):
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(0, out='{"ok": true, "durationMs": 958}'))
    r = cli.gateway_health()
    assert r["ok"] is True
    assert r["durationMs"] == 958
    assert "error" not in r


@pytest.mark.parametrize("rc", [0])
def test_non_json_success_still_ok(monkeypatch, rc):
    monkeypatch.setattr(cli, "openclaw_exec", _fake_exec(rc, out="gateway healthy"))
    r = cli.gateway_health()
    assert r == {"ok": True, "raw": "gateway healthy"}
