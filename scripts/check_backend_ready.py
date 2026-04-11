"""Pre-flight readiness check for TwinverseAI backend (GPU server).

Fails loud BEFORE uvicorn starts, so silent crashes (like the 2026-04-10
cp949/.env UnicodeDecodeError incident) never make it to the tunnel as
mystery 502s that look like CORS errors in the browser.

Two modes:
  1. Default (no args): pre-flight import test
     - Reads backend/.env as UTF-8 and rejects non-ASCII comments proactively
     - Imports backend.main to surface any startup-time errors
     - Exits 0 on success, non-zero with a clear message on failure

  2. --health <url> <timeout>: post-launch health poll
     - Polls <url> until HTTP 200 or timeout seconds elapse
     - Used after `start uvicorn` to confirm the server is actually serving

Usage (from scripts/start_gpu_server.bat):
    python check_backend_ready.py                          # pre-flight
    python check_backend_ready.py --health http://localhost:8000/health 30
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
ENV_FILE = BACKEND_DIR / ".env"


def _fail(msg: str, code: int = 1) -> None:
    print(f"[PREFLIGHT FAIL] {msg}", file=sys.stderr)
    sys.exit(code)


def _ok(msg: str) -> None:
    print(f"[PREFLIGHT OK]   {msg}")


def check_env_file() -> None:
    """Read .env as UTF-8 and refuse non-ASCII (Korean comments etc.).

    The 2026-04-10 incident: a Korean comment in .env caused starlette/slowapi
    to crash with UnicodeDecodeError on cp949 Windows. We treat non-ASCII in
    .env as a hard failure so it can never sneak back in.
    """
    if not ENV_FILE.exists():
        _ok(f".env not present at {ENV_FILE} (using Dockerfile ENV or defaults)")
        return

    try:
        raw = ENV_FILE.read_bytes()
    except OSError as e:
        _fail(f"Cannot read {ENV_FILE}: {e}")

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        _fail(
            f"{ENV_FILE} is not valid UTF-8: {e}. "
            "Re-save as UTF-8 (no BOM) with ASCII-only comments."
        )

    for lineno, line in enumerate(text.splitlines(), start=1):
        if any(ord(c) > 127 for c in line):
            _fail(
                f"{ENV_FILE}:{lineno} contains non-ASCII characters. "
                "Per CLAUDE.md .env rules, comments and values must be ASCII only. "
                f"Offending line: {line.strip()}"
            )

    _ok(f".env is UTF-8 + ASCII-only ({len(text.splitlines())} lines)")


def check_backend_imports() -> None:
    """Import backend.main — surfaces any crash-on-import errors upfront."""
    # Make backend importable as top-level package
    sys.path.insert(0, str(BACKEND_DIR))
    # Force UTF-8 mode for any file reads done during import
    os.environ.setdefault("PYTHONUTF8", "1")

    try:
        import importlib
        importlib.import_module("main")
    except Exception as e:  # noqa: BLE001 — we want to catch ANY startup error
        _fail(
            f"backend.main failed to import: {type(e).__name__}: {e}. "
            "Fix this before launching uvicorn — a silent startup crash would "
            "manifest as a browser CORS error on the tunnel."
        )

    _ok("backend.main imports cleanly")


def poll_health(url: str, timeout_seconds: int) -> None:
    """Poll <url> until HTTP 200 or timeout. Used post-launch."""
    try:
        import urllib.request
        import urllib.error
    except ImportError:
        _fail("urllib not available")

    deadline = time.monotonic() + timeout_seconds
    last_err = None
    attempts = 0

    while time.monotonic() < deadline:
        attempts += 1
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if 200 <= resp.status < 300:
                    _ok(f"{url} responded HTTP {resp.status} after {attempts} attempt(s)")
                    return
                last_err = f"HTTP {resp.status}"
        except urllib.error.URLError as e:
            last_err = str(e.reason) if hasattr(e, "reason") else str(e)
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {e}"
        time.sleep(1)

    _fail(
        f"{url} not healthy after {timeout_seconds}s ({attempts} attempts). "
        f"Last error: {last_err}. "
        "Backend likely crashed silently — check the 'TwinverseAI Backend' console window."
    )


def main() -> None:
    argv = sys.argv[1:]
    if argv and argv[0] == "--health":
        if len(argv) < 3:
            _fail("Usage: check_backend_ready.py --health <url> <timeout_seconds>")
        url = argv[1]
        try:
            timeout = int(argv[2])
        except ValueError:
            _fail("timeout_seconds must be an integer")
        poll_health(url, timeout)
        return

    # Default: pre-flight
    check_env_file()
    check_backend_imports()
    _ok("all pre-flight checks passed")


if __name__ == "__main__":
    main()
