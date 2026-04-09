"""
PS2 Dedicated Server Manager.

Manages UE5 Dedicated Server instances for multiplayer office rooms.
Architecture:
  - 1 Dedicated Server per office (game logic, CPU only, no GPU)
  - N PS2 Client instances per office (GPU rendering + Pixel Streaming)
  - Each client connects to the Dedicated Server for shared game state
"""

import os
import logging
import subprocess
import uuid
from datetime import datetime, timedelta

import psutil
from sqlmodel import Session, select

from models.ps2_dedicated_server import PS2DedicatedServer
from models.ps2_session import PS2Session

logger = logging.getLogger("twinverse.ps2.dedicated")

# ── Config ──
_PACKAGED_EXE = os.getenv("UE_PACKAGED_PATH", r"C:\WORK\TwinverseDesk\Package\Windows\TwinverseDesk.exe")
_PACKAGED_SERVER_EXE = os.getenv("UE_SERVER_PATH", r"C:\WORK\TwinverseDesk\Package\WindowsServer\TwinverseDeskServer.exe")
DEDICATED_BASE_PORT = int(os.getenv("PS2_DEDICATED_BASE_PORT", "7777"))
MAX_DEDICATED_SERVERS = int(os.getenv("PS2_MAX_DEDICATED", "5"))
OFFICE_MAP = os.getenv("PS2_OFFICE_MAP", "/Game/Maps/Office/OfficeMain")
HEARTBEAT_TIMEOUT = int(os.getenv("PS2_DEDICATED_HEARTBEAT_TIMEOUT", "120"))


def _is_process_alive(pid: int) -> bool:
    try:
        return psutil.pid_exists(pid) and psutil.Process(pid).is_running()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return False


def _kill_process(pid: int):
    try:
        proc = psutil.Process(pid)
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except psutil.TimeoutExpired:
            proc.kill()
        logger.info(f"Killed dedicated server pid={pid}")
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass


def _active_filter():
    return PS2DedicatedServer.status.in_(["starting", "running"])


def _allocate_port(db: Session) -> int:
    """Find next available port starting from DEDICATED_BASE_PORT."""
    active = db.exec(select(PS2DedicatedServer).where(_active_filter())).all()
    used_ports = {s.port for s in active}
    for offset in range(MAX_DEDICATED_SERVERS):
        candidate = DEDICATED_BASE_PORT + offset
        if candidate not in used_ports:
            return candidate
    raise RuntimeError(f"No available ports (all {MAX_DEDICATED_SERVERS} slots in use)")


def get_or_create_dedicated_server(office_id: str, db: Session, map_path: str | None = None) -> PS2DedicatedServer:
    """Get existing dedicated server for this office, or spawn a new one."""
    effective_map = map_path or OFFICE_MAP

    # Check for existing active server for this office
    existing = db.exec(
        select(PS2DedicatedServer).where(
            PS2DedicatedServer.office_id == office_id,
            _active_filter()
        )
    ).first()

    if existing:
        if existing.pid and _is_process_alive(existing.pid):
            return existing
        # Process died — clean up
        existing.status = "stopped"
        existing.stopped_at = datetime.now()
        existing.error_message = "Process died, restarting"
        db.add(existing)
        db.commit()

    # Check capacity
    active_count = len(db.exec(select(PS2DedicatedServer).where(_active_filter())).all())
    if active_count >= MAX_DEDICATED_SERVERS:
        raise RuntimeError(f"Max dedicated servers reached ({MAX_DEDICATED_SERVERS})")

    # Allocate port and spawn
    port = _allocate_port(db)
    server_exe = _PACKAGED_SERVER_EXE if os.path.isfile(_PACKAGED_SERVER_EXE) else None
    if not server_exe:
        raise RuntimeError(f"Dedicated server executable not found at: {_PACKAGED_SERVER_EXE}")

    cmd = [
        server_exe,
        effective_map,
        f"-port={port}",
        f"-OfficeId={office_id}",
        "-Unattended", "-NoPause", "-log",
    ]

    cwd = os.path.dirname(server_exe)
    popen_kwargs = dict(cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        proc = subprocess.Popen(cmd, **popen_kwargs)
    except Exception as e:
        raise RuntimeError(f"Failed to spawn dedicated server: {e}")

    now = datetime.now()
    record = PS2DedicatedServer(
        office_id=office_id,
        map_path=effective_map,
        status="starting",
        pid=proc.pid,
        port=port,
        last_heartbeat=now,
        created_at=now,
        updated_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info(f"Spawned dedicated server: office={office_id}, port={port}, pid={proc.pid}")
    return record


def spawn_office_client(user_id: int, office_id: str, db: Session, map_path: str | None = None) -> PS2Session:
    """
    Spawn a PS2 Client that connects to the office's Dedicated Server.
    This is the new multiplayer flow:
      1. Ensure Dedicated Server is running for this office
      2. Spawn a PS2 Client instance that connects to that server
      3. Return the PS2Session with streaming URL
    """
    from services.ps2_service import (
        WILBUR_PLAYER_URL, WILBUR_PLAYER_EXTERNAL_URL, WILBUR_SIGNALING_URL,
        MAX_INSTANCES, _use_packaged, _PACKAGED_EXE, _EDITOR_EXE, UE_PROJECT,
        cleanup_stale_sessions, get_active_count
    )

    effective_map = map_path or OFFICE_MAP

    # 1. Ensure dedicated server is running
    dedicated = get_or_create_dedicated_server(office_id, db, effective_map)

    # 2. Check if user already has a client for this office
    existing = db.exec(
        select(PS2Session).where(
            PS2Session.user_id == user_id,
            PS2Session.status.in_(["starting", "running"]),
            PS2Session.map_path == effective_map,
        )
    ).first()
    if existing and existing.pid and _is_process_alive(existing.pid):
        return existing

    # Clean up dead sessions
    cleanup_stale_sessions(db)

    # Check client capacity
    active_count = get_active_count(db)
    if active_count >= MAX_INSTANCES:
        raise RuntimeError(f"Max PS2 client instances reached ({MAX_INSTANCES})")

    # 3. Spawn PS2 Client connected to the Dedicated Server
    session_id = f"office_{uuid.uuid4().hex[:12]}"
    base_url = WILBUR_PLAYER_EXTERNAL_URL or WILBUR_PLAYER_URL
    player_url = f"{base_url}?StreamerId={session_id}"

    # Server address for client to connect to Dedicated Server
    server_addr = f"127.0.0.1:{dedicated.port}"

    ps2_args = [
        server_addr,  # Connect to dedicated server
        f"-PixelStreamingConnectionURL={WILBUR_SIGNALING_URL}",
        f"-PixelStreamingID={session_id}",
        "-RenderOffScreen",
        "-ResX=1280", "-ResY=720", "-ForceRes",
        "-AudioMixer", "-Unattended", "-NoPause", "-log",
    ]

    if _use_packaged():
        cmd = [_PACKAGED_EXE, *ps2_args]
        cwd = os.path.dirname(_PACKAGED_EXE)
    else:
        cmd = [_EDITOR_EXE, UE_PROJECT, *ps2_args]
        cwd = None

    popen_kwargs = dict(cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        proc = subprocess.Popen(cmd, **popen_kwargs)
    except Exception as e:
        raise RuntimeError(f"Failed to spawn PS2 client: {e}")

    now = datetime.now()
    record = PS2Session(
        session_id=session_id,
        user_id=user_id,
        streamer_id=session_id,
        status="starting",
        pid=proc.pid,
        map_path=effective_map,
        player_url=player_url,
        last_heartbeat=now,
        created_at=now,
        updated_at=now,
    )
    db.add(record)

    # Update dedicated server player count
    dedicated.player_count += 1
    dedicated.updated_at = now
    db.add(dedicated)

    db.commit()
    db.refresh(record)

    logger.info(f"Spawned office client: session={session_id}, office={office_id}, port={dedicated.port}")
    return record


def terminate_dedicated_server(office_id: str, db: Session):
    """Terminate a dedicated server and all its connected clients."""
    server = db.exec(
        select(PS2DedicatedServer).where(
            PS2DedicatedServer.office_id == office_id,
            _active_filter()
        )
    ).first()
    if not server:
        return

    # Kill the server process
    if server.pid:
        _kill_process(server.pid)

    now = datetime.now()
    server.status = "stopped"
    server.stopped_at = now
    server.updated_at = now
    db.add(server)
    db.commit()

    logger.info(f"Terminated dedicated server: office={office_id}")


def check_auto_shutdown(office_id: str, db: Session):
    """Auto-shutdown dedicated server when no players are connected."""
    server = db.exec(
        select(PS2DedicatedServer).where(
            PS2DedicatedServer.office_id == office_id,
            _active_filter()
        )
    ).first()
    if not server:
        return

    # Count active client sessions for this map
    active_clients = db.exec(
        select(PS2Session).where(
            PS2Session.map_path == server.map_path,
            PS2Session.status.in_(["starting", "running"]),
        )
    ).all()

    if len(active_clients) == 0:
        logger.info(f"No active clients for office={office_id}, auto-shutting down")
        terminate_dedicated_server(office_id, db)


def list_dedicated_servers(db: Session, active_only: bool = True):
    """List all dedicated servers."""
    query = select(PS2DedicatedServer)
    if active_only:
        query = query.where(_active_filter())
    return db.exec(query.order_by(PS2DedicatedServer.created_at.desc())).all()
