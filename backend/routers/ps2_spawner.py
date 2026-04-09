from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session
from database import get_session
from models import User
from deps import get_current_user, get_optional_user, require_admin
from rate_limit import limiter
from services import ps2_service
from services import ps2_launcher

router = APIRouter()


# ── Response Models ──

class SpawnRequest(BaseModel):
    map: Optional[str] = None


class SpawnResponse(BaseModel):
    session_id: str
    streamer_id: str
    player_url: str
    status: str


class SessionStatusResponse(BaseModel):
    session_id: str
    streamer_id: str
    status: str
    player_url: str
    created_at: datetime
    last_heartbeat: Optional[datetime]
    stopped_at: Optional[datetime]
    error_message: Optional[str]


class SpawnerHealthResponse(BaseModel):
    available: bool
    active_instances: int
    max_instances: int


# ── Endpoints ──

@router.post("/spawn", response_model=SpawnResponse)
@limiter.limit("3/minute")
def spawn_instance(
    request: Request,
    body: SpawnRequest = SpawnRequest(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Spawn a new UE5 instance for the current user. Idempotent."""
    try:
        record = ps2_service.spawn_session(user.id, db, map_path=body.map)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return SpawnResponse(
        session_id=record.session_id,
        streamer_id=record.streamer_id,
        player_url=record.player_url,
        status=record.status,
    )


@router.get("/status/{session_id}", response_model=SessionStatusResponse)
@limiter.limit("30/minute")
def get_status(
    session_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Get session status. Also triggers stale session cleanup."""
    record = ps2_service.check_session_status(session_id, db)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    if record.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return SessionStatusResponse(
        session_id=record.session_id,
        streamer_id=record.streamer_id,
        status=record.status,
        player_url=record.player_url,
        created_at=record.created_at,
        last_heartbeat=record.last_heartbeat,
        stopped_at=record.stopped_at,
        error_message=record.error_message,
    )


@router.post("/heartbeat/{session_id}")
@limiter.limit("60/minute")
def send_heartbeat(
    session_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Keep session alive. Frontend should call every 30 seconds."""
    record = ps2_service.heartbeat(session_id, user.id, db)
    if not record:
        raise HTTPException(status_code=404, detail="Active session not found")
    return {"ok": True, "status": record.status}


@router.post("/terminate/{session_id}")
@limiter.limit("5/minute")
def terminate_instance(
    session_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Terminate user's own session."""
    record = ps2_service.terminate_session(session_id, user.id, db)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True, "session_id": session_id, "status": record.status}


@router.get("/sessions")
@limiter.limit("10/minute")
def list_my_sessions(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """List current user's active sessions."""
    sessions = ps2_service.list_sessions(user.id, db, active_only=True)
    return [
        SessionStatusResponse(
            session_id=s.session_id,
            streamer_id=s.streamer_id,
            status=s.status,
            player_url=s.player_url,
            created_at=s.created_at,
            last_heartbeat=s.last_heartbeat,
            stopped_at=s.stopped_at,
            error_message=s.error_message,
        )
        for s in sessions
    ]


@router.get("/health", response_model=SpawnerHealthResponse)
@limiter.limit("10/minute")
def spawner_health(
    request: Request,
    db: Session = Depends(get_session),
):
    """Public health check — shows instance availability."""
    active = ps2_service.get_active_count(db)
    return SpawnerHealthResponse(
        available=active < ps2_service.MAX_INSTANCES,
        active_instances=active,
        max_instances=ps2_service.MAX_INSTANCES,
    )


# ── Admin Endpoints ──

@router.get("/admin/sessions")
@limiter.limit("10/minute")
def admin_list_sessions(
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    """List all active sessions (admin only)."""
    sessions = ps2_service.list_sessions(None, db, active_only=True)
    return [
        {
            "session_id": s.session_id,
            "user_id": s.user_id,
            "status": s.status,
            "pid": s.pid,
            "player_url": s.player_url,
            "created_at": s.created_at,
            "last_heartbeat": s.last_heartbeat,
        }
        for s in sessions
    ]


@router.post("/admin/terminate/{session_id}")
@limiter.limit("10/minute")
def admin_terminate(
    session_id: str,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_session),
):
    """Force terminate any session (admin only)."""
    record = ps2_service.terminate_session(session_id, admin.id, db, is_admin=True)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True, "session_id": session_id, "status": record.status}


# ── Server Launcher Endpoints ──

@router.get("/server/status")
def server_status(request: Request):
    """Check if Wilbur and PS2 Spawner are running."""
    return ps2_launcher.get_status()


@router.post("/server/start")
@limiter.limit("3/minute")
def start_servers(
    request: Request,
    user: User = Depends(get_current_user),
):
    """Start Wilbur + PS2 Spawner if not running. Requires login."""
    return ps2_launcher.start_all()
