"""
PS2 Spawner — Standalone GPU Server
====================================
이 PC(GPU 서버)에서 독립 실행되는 PS2 Spawner API.
Orbitron의 TwinverseAI 웹앱과 분리되어 동작합니다.

Usage:
  cd backend
  uvicorn ps2_server:app --host 0.0.0.0 --port 9000 --reload

Architecture:
  Browser → Orbitron (web app) → This PC:9000 (PS2 API)
  Browser → This PC:8080 (Wilbur/WebRTC)
"""

import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from sqlmodel import Session, SQLModel, create_engine, select

from models.ps2_session import PS2Session
from services import ps2_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ps2_server")

# ── Database ──
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/twinverseai")
engine = create_engine(DATABASE_URL)


def get_db():
    with Session(engine) as session:
        yield session


# ── Auth: API Key based (simple, for server-to-server) ──
PS2_API_KEY = os.getenv("PS2_API_KEY", "ps2-dev-key-change-me")


def verify_api_key(request: Request):
    """Verify API key from header or query param."""
    key = request.headers.get("X-PS2-API-Key") or request.query_params.get("api_key")
    if key != PS2_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ── Response Models ──

class SpawnRequest(BaseModel):
    user_id: int


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


class HealthResponse(BaseModel):
    available: bool
    active_instances: int
    max_instances: int
    gpu_server: str


# ── Lifespan ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    # Clean up orphaned sessions
    with Session(engine) as db:
        ps2_service.cleanup_orphaned_sessions(db)
    logger.info(f"PS2 Spawner ready — max {ps2_service.MAX_INSTANCES} instances")
    yield


# ── App ──

app = FastAPI(title="PS2 Spawner (GPU Server)", lifespan=lifespan)

# CORS: allow Orbitron + local dev
_allowed_origins = [
    "http://localhost:5173",
    "http://localhost:8000",
]
_frontend_url = os.getenv("FRONTEND_URL", "").strip()
if _frontend_url:
    _allowed_origins.append(_frontend_url)
_orbitron_url = os.getenv("ORBITRON_URL", "").strip()
if _orbitron_url:
    _allowed_origins.append(_orbitron_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-PS2-API-Key"],
)


# ── Endpoints ──

@app.post("/api/ps2/spawn", response_model=SpawnResponse)
def spawn_instance(
    body: SpawnRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(verify_api_key),
):
    try:
        record = ps2_service.spawn_session(body.user_id, db)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return SpawnResponse(
        session_id=record.session_id,
        streamer_id=record.streamer_id,
        player_url=record.player_url,
        status=record.status,
    )


@app.get("/api/ps2/status/{session_id}", response_model=SessionStatusResponse)
def get_status(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(verify_api_key),
):
    record = ps2_service.check_session_status(session_id, db)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
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


@app.post("/api/ps2/heartbeat/{session_id}")
def send_heartbeat(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(verify_api_key),
):
    # Heartbeat doesn't check user ownership (called from frontend directly)
    record = db.exec(
        select(PS2Session).where(
            PS2Session.session_id == session_id,
            PS2Session.status.in_(["starting", "running"]),
        )
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Active session not found")
    record.last_heartbeat = datetime.now()
    record.updated_at = datetime.now()
    db.add(record)
    db.commit()
    return {"ok": True, "status": record.status}


@app.post("/api/ps2/terminate/{session_id}")
def terminate_instance(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(verify_api_key),
):
    record = ps2_service.terminate_session(session_id, 0, db, is_admin=True)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True, "session_id": session_id, "status": record.status}


@app.get("/api/ps2/sessions")
def list_sessions(
    user_id: Optional[int] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    _: None = Depends(verify_api_key),
):
    sessions = ps2_service.list_sessions(user_id, db, active_only=True)
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


@app.get("/api/ps2/health", response_model=HealthResponse)
def spawner_health(db: Session = Depends(get_db)):
    """Public health check — no API key required."""
    import socket
    active = ps2_service.get_active_count(db)
    return HealthResponse(
        available=active < ps2_service.MAX_INSTANCES,
        active_instances=active,
        max_instances=ps2_service.MAX_INSTANCES,
        gpu_server=socket.gethostname(),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ps2_server:app", host="0.0.0.0", port=9000, reload=True)
