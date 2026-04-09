"""
PS2 Infrastructure Launcher
============================
Starts Wilbur signaling server and PS2 Spawner API if not running.
Called from main backend to bootstrap PS2 infrastructure on demand.
"""

import os
import subprocess
import time
import logging
import socket

import psutil

logger = logging.getLogger("twinverse.ps2.launcher")

WILBUR_DIR = os.getenv(
    "WILBUR_DIR",
    r"D:\Program Files\UE_5.7\Engine\Plugins\Media\PixelStreaming2\Resources\WebServers\SignallingWebServer",
)
WILBUR_PLAYER_PORT = int(os.getenv("WILBUR_PLAYER_PORT", "8080"))
WILBUR_STREAMER_PORT = int(os.getenv("WILBUR_STREAMER_PORT", "8888"))
PS2_SERVER_PORT = int(os.getenv("PS2_SERVER_PORT", "9000"))
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _is_port_open(port: int, host: str = "127.0.0.1") -> bool:
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except (ConnectionRefusedError, TimeoutError, OSError):
        return False


def _find_process_on_port(port: int) -> bool:
    """Check if any process is listening on the given port."""
    for conn in psutil.net_connections(kind="tcp"):
        if conn.laddr.port == port and conn.status == "LISTEN":
            return True
    return False


def is_wilbur_running() -> bool:
    return _is_port_open(WILBUR_PLAYER_PORT)


def is_ps2_server_running() -> bool:
    return _is_port_open(PS2_SERVER_PORT)


def start_wilbur() -> dict:
    """Start Wilbur signaling server if not running."""
    if is_wilbur_running():
        return {"status": "already_running", "port": WILBUR_PLAYER_PORT}

    node_cmd = [
        "node", "dist/index.js",
        "--serve",
        "--http_root", "www",
        "--streamer_port", str(WILBUR_STREAMER_PORT),
        "--player_port", str(WILBUR_PLAYER_PORT),
        "--console_messages", "verbose",
    ]

    try:
        proc = subprocess.Popen(
            node_cmd,
            cwd=WILBUR_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        logger.info(f"Started Wilbur pid={proc.pid}")

        # Wait for it to come up
        for _ in range(10):
            time.sleep(1)
            if _is_port_open(WILBUR_PLAYER_PORT):
                return {"status": "started", "pid": proc.pid, "port": WILBUR_PLAYER_PORT}

        return {"status": "timeout", "pid": proc.pid, "message": "Wilbur started but port not open yet"}
    except Exception as e:
        logger.error(f"Failed to start Wilbur: {e}")
        return {"status": "error", "message": str(e)}


def start_ps2_server() -> dict:
    """Start PS2 Spawner API server if not running."""
    if is_ps2_server_running():
        return {"status": "already_running", "port": PS2_SERVER_PORT}

    cmd = [
        "uvicorn", "ps2_server:app",
        "--host", "0.0.0.0",
        "--port", str(PS2_SERVER_PORT),
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=BACKEND_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        logger.info(f"Started PS2 Spawner pid={proc.pid}")

        for _ in range(10):
            time.sleep(1)
            if _is_port_open(PS2_SERVER_PORT):
                return {"status": "started", "pid": proc.pid, "port": PS2_SERVER_PORT}

        return {"status": "timeout", "pid": proc.pid, "message": "PS2 server started but port not open yet"}
    except Exception as e:
        logger.error(f"Failed to start PS2 server: {e}")
        return {"status": "error", "message": str(e)}


def start_all() -> dict:
    """Start both Wilbur and PS2 Spawner."""
    wilbur = start_wilbur()
    ps2 = start_ps2_server()
    return {
        "wilbur": wilbur,
        "ps2_server": ps2,
        "ready": wilbur["status"] in ("started", "already_running")
                 and ps2["status"] in ("started", "already_running"),
    }


def get_status() -> dict:
    return {
        "wilbur": is_wilbur_running(),
        "ps2_server": is_ps2_server_running(),
        "wilbur_port": WILBUR_PLAYER_PORT,
        "ps2_server_port": PS2_SERVER_PORT,
    }
