"""systemd ExecStartPost readiness gate.

uvicorn binds port 8201 only after model load and warm-up finish, and that work
runs in a worker thread that a native CUDA hang cannot be cancelled from. With
Type=simple, a hung startup otherwise stays "running" forever and
Restart=on-failure never fires. Exiting non-zero here fails the start job, so
systemd stops the hung process and restarts it.
"""

from __future__ import annotations

import http.client
import sys
import time
import urllib.request
from typing import Callable

from .config import _env_int

READY_URL = "http://127.0.0.1:8201/ready"
POLL_INTERVAL_SECONDS = 2.0
PROBE_TIMEOUT_SECONDS = 3.0


def probe_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=PROBE_TIMEOUT_SECONDS) as response:
            return response.status == 200
    except (OSError, http.client.HTTPException):
        return False


def wait_until_ready(
    url: str,
    timeout_seconds: float,
    *,
    probe: Callable[[str], bool] = probe_ready,
    poll_interval: float = POLL_INTERVAL_SECONDS,
    clock: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
) -> bool:
    deadline = clock() + timeout_seconds
    while True:
        if probe(url):
            return True
        if clock() >= deadline:
            return False
        sleep(poll_interval)


def main() -> int:
    # Keep below the unit's TimeoutStartSec=600 so this gate, not systemd's
    # start timeout, reports the failure.
    timeout = _env_int("INTERPRETATION_STARTUP_TIMEOUT_SECONDS", 540, 30, 3600)
    if wait_until_ready(READY_URL, timeout):
        print("live-interpretation ready")
        return 0
    print(
        f"live-interpretation not ready within {timeout}s; failing start so systemd restarts it",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
