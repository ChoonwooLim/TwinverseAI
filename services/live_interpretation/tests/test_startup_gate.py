from __future__ import annotations

import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Iterator

import pytest

from app import wait_ready
from app.wait_ready import probe_ready, wait_until_ready

SERVICE_ROOT = Path(__file__).resolve().parents[1]


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


def test_gate_succeeds_once_service_becomes_ready() -> None:
    clock = FakeClock()
    answers = iter([False, False, True])
    assert wait_until_ready(
        "http://unused",
        60,
        probe=lambda _url: next(answers),
        clock=clock,
        sleep=clock.sleep,
        poll_interval=2.0,
    )
    assert clock.now == 4.0


def test_gate_fails_when_startup_never_becomes_ready() -> None:
    clock = FakeClock()
    probes: list[float] = []

    def never_ready(_url: str) -> bool:
        probes.append(clock.now)
        return False

    assert not wait_until_ready(
        "http://unused",
        10,
        probe=never_ready,
        clock=clock,
        sleep=clock.sleep,
        poll_interval=2.0,
    )
    assert probes[-1] >= 10


@pytest.fixture
def http_server() -> Iterator[tuple[str, list[int]]]:
    status = [200]

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            self.send_response(status[0])
            self.end_headers()
            self.wfile.write(b"{}")

        def log_message(self, *_args: object) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/ready", status
    finally:
        server.shutdown()
        server.server_close()


def test_probe_accepts_only_http_200(http_server: tuple[str, list[int]]) -> None:
    url, status = http_server
    assert probe_ready(url)
    status[0] = 503
    assert not probe_ready(url)


def test_probe_treats_closed_port_as_not_ready() -> None:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    assert not probe_ready(f"http://127.0.0.1:{port}/ready")


def test_main_exits_nonzero_when_not_ready(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("INTERPRETATION_STARTUP_TIMEOUT_SECONDS", raising=False)
    monkeypatch.setattr(wait_ready, "wait_until_ready", lambda _url, _timeout: False)
    assert wait_ready.main() == 1
    assert "not ready within 540s" in capsys.readouterr().err


def test_unit_gates_start_on_readiness_and_deploy_keeps_diagnostics() -> None:
    unit = (SERVICE_ROOT / "systemd" / "live-interpretation.service").read_text(
        encoding="utf-8"
    )
    deploy = (SERVICE_ROOT / "scripts" / "deploy.sh").read_text(encoding="utf-8")

    assert "ExecStartPost=/srv/live-interpretation/venv/bin/python -m app.wait_ready" in unit
    assert "Restart=on-failure" in unit
    assert "TimeoutStartSec=600" in unit
    assert 'sudo systemctl restart --no-block "$UNIT_FILE"' in deploy
