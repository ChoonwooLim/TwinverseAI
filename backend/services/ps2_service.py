import os
import logging
import subprocess
import uuid
from datetime import datetime, timedelta

import psutil
from sqlmodel import Session, select

from models.ps2_session import PS2Session

logger = logging.getLogger("twinverse.ps2")

# ── Config (env overridable) ──
# Packaged build takes priority over editor
_PACKAGED_EXE = os.getenv("UE_PACKAGED_PATH", r"C:\WORK\TwinverseDesk\Package\Windows\TwinverseDesk.exe")
_EDITOR_EXE = os.getenv("UE_EDITOR_PATH", r"D:\Program Files\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe")
def _use_packaged():
    return os.path.isfile(_PACKAGED_EXE)
UE_PROJECT = os.getenv("UE_PROJECT_PATH", r"C:\WORK\TwinverseDesk\TwinverseDesk.uproject")
UE_MAP = os.getenv("UE_MAP", "/Game/PCG/PCG_Study_Modern")
WILBUR_PLAYER_URL = os.getenv("WILBUR_PLAYER_URL", "http://localhost:8080")
WILBUR_PLAYER_EXTERNAL_URL = os.getenv("WILBUR_PLAYER_EXTERNAL_URL", "")  # e.g. https://ps2.twinverse.org
WILBUR_SIGNALING_URL = os.getenv("WILBUR_SIGNALING_URL", "ws://127.0.0.1:8888")
MAX_INSTANCES = int(os.getenv("PS2_MAX_INSTANCES", "3"))
HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("PS2_HEARTBEAT_TIMEOUT", "90"))


def _active_filter():
    return PS2Session.status.in_(["starting", "running"])


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
        logger.info(f"Killed UE5 process pid={pid}")
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass


def cleanup_stale_sessions(db: Session):
    """Terminate sessions with dead processes or expired heartbeats."""
    now = datetime.now()
    cutoff = now - timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS)

    active = db.exec(select(PS2Session).where(_active_filter())).all()
    for s in active:
        dead_process = s.pid and not _is_process_alive(s.pid)
        heartbeat_expired = s.last_heartbeat and s.last_heartbeat < cutoff

        if dead_process or heartbeat_expired:
            reason = "dead process" if dead_process else "heartbeat timeout"
            logger.warning(f"Cleaning stale session {s.session_id}: {reason}")
            if s.pid and not dead_process:
                _kill_process(s.pid)
            s.status = "stopped"
            s.stopped_at = now
            s.updated_at = now
            s.error_message = f"Auto-terminated: {reason}"
            db.add(s)

    db.commit()


def cleanup_orphaned_sessions(db: Session):
    """Mark all active sessions as stopped on server startup."""
    active = db.exec(select(PS2Session).where(_active_filter())).all()
    now = datetime.now()
    for s in active:
        if s.pid:
            _kill_process(s.pid)
        s.status = "stopped"
        s.stopped_at = now
        s.updated_at = now
        s.error_message = "Server restarted"
        db.add(s)
    if active:
        db.commit()
        logger.info(f"Cleaned {len(active)} orphaned sessions on startup")


def get_active_count(db: Session) -> int:
    return len(db.exec(select(PS2Session).where(_active_filter())).all())


def spawn_session(user_id: int, db: Session, map_path: str | None = None) -> PS2Session:
    """Spawn a new UE5 instance for the user. Idempotent — returns existing if active."""
    effective_map = map_path or UE_MAP

    # Return existing active session for this user (or terminate if map changed)
    existing = db.exec(
        select(PS2Session).where(PS2Session.user_id == user_id, _active_filter())
    ).first()
    if existing:
        if existing.pid and _is_process_alive(existing.pid):
            # Same map → reuse session
            if existing.map_path == effective_map:
                return existing
            # Different map → terminate old session first
            _kill_process(existing.pid)
            existing.status = "stopped"
            existing.stopped_at = datetime.now()
            existing.error_message = "Map changed, restarting"
            db.add(existing)
            db.commit()
        else:
            # Process died, clean it up
            existing.status = "stopped"
            existing.stopped_at = datetime.now()
            existing.error_message = "Process died unexpectedly"
            db.add(existing)
            db.commit()

    # Clean stale sessions before checking capacity
    cleanup_stale_sessions(db)

    # Check capacity
    active_count = get_active_count(db)
    if active_count >= MAX_INSTANCES:
        raise RuntimeError(
            f"Maximum instances reached ({MAX_INSTANCES}). Try again later."
        )

    # Generate unique session/streamer ID
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    base_url = WILBUR_PLAYER_EXTERNAL_URL or WILBUR_PLAYER_URL
    player_url = f"{base_url}?StreamerId={session_id}"

    # Build UE5 command — packaged build or editor
    # UE5.7 PS2 command line args: PixelStreamingConnectionURL (was SignallingURL), PixelStreamingID (was PixelStreaming2.ID)
    ps2_args = [
        f"-PixelStreamingConnectionURL={WILBUR_SIGNALING_URL}",
        f"-PixelStreamingID={session_id}",
        f"-MapOverride={effective_map}",
        "-RenderOffScreen",
        "-ResX=1280", "-ResY=720", "-ForceRes",
        "-AudioMixer", "-Unattended", "-NoPause", "-log",
    ]
    if _use_packaged():
        cmd = [_PACKAGED_EXE, *ps2_args]
    else:
        cmd = [_EDITOR_EXE, UE_PROJECT, effective_map, "-game", *ps2_args]

    ue_path = _PACKAGED_EXE if _use_packaged() else _EDITOR_EXE
    logger.info(f"Spawning UE5 ({'packaged' if _use_packaged() else 'editor'}): session={session_id}, user={user_id}, map={effective_map}")

    # Packaged build must run from its own directory (relative pak paths)
    cwd = os.path.dirname(_PACKAGED_EXE) if _use_packaged() else None

    popen_kwargs = dict(cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        proc = subprocess.Popen(cmd, **popen_kwargs)
    except FileNotFoundError:
        raise RuntimeError(f"UE5 not found at: {ue_path}")
    except Exception as e:
        raise RuntimeError(f"Failed to spawn UE5: {e}")

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
    db.commit()
    db.refresh(record)

    logger.info(f"Spawned UE5 pid={proc.pid}, session={session_id}")
    return record


def check_session_status(session_id: str, db: Session) -> PS2Session | None:
    """Check and update session status based on process health."""
    record = db.exec(
        select(PS2Session).where(PS2Session.session_id == session_id)
    ).first()
    if not record:
        return None

    if record.status in ("stopped", "error"):
        return record

    # Check if process is alive
    if record.pid and not _is_process_alive(record.pid):
        record.status = "error"
        record.error_message = "UE5 process terminated unexpectedly"
        record.stopped_at = datetime.now()
        record.updated_at = datetime.now()
        db.add(record)
        db.commit()
        return record

    # If starting and process alive, mark as running after a grace period
    if record.status == "starting" and record.pid and _is_process_alive(record.pid):
        elapsed = (datetime.now() - record.created_at).total_seconds()
        if elapsed > 10:
            record.status = "running"
            record.updated_at = datetime.now()
            db.add(record)
            db.commit()

    return record


def heartbeat(session_id: str, user_id: int, db: Session) -> PS2Session | None:
    """Update heartbeat timestamp. Called periodically by the frontend."""
    record = db.exec(
        select(PS2Session).where(
            PS2Session.session_id == session_id,
            PS2Session.user_id == user_id,
            _active_filter(),
        )
    ).first()
    if not record:
        return None

    record.last_heartbeat = datetime.now()
    record.updated_at = datetime.now()
    db.add(record)
    db.commit()
    return record


def terminate_session(session_id: str, user_id: int, db: Session, is_admin: bool = False) -> PS2Session | None:
    """Terminate a session. User can only terminate their own unless admin."""
    query = select(PS2Session).where(PS2Session.session_id == session_id)
    if not is_admin:
        query = query.where(PS2Session.user_id == user_id)

    record = db.exec(query).first()
    if not record:
        return None

    if record.status in ("stopped", "error"):
        return record

    if record.pid:
        _kill_process(record.pid)

    record.status = "stopped"
    record.stopped_at = datetime.now()
    record.updated_at = datetime.now()
    db.add(record)
    db.commit()

    logger.info(f"Terminated session={session_id}, pid={record.pid}, by user={user_id}")
    return record


def list_sessions(user_id: int | None, db: Session, active_only: bool = True):
    """List sessions. If user_id is None, return all (admin)."""
    query = select(PS2Session)
    if user_id is not None:
        query = query.where(PS2Session.user_id == user_id)
    if active_only:
        query = query.where(_active_filter())
    return db.exec(query.order_by(PS2Session.created_at.desc())).all()
