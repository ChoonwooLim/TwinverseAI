from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class PS2Session(SQLModel, table=True):
    __tablename__ = "ps2session"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(unique=True, index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    streamer_id: str = Field(unique=True)
    status: str = Field(default="starting")  # starting | running | stopping | stopped | error
    pid: Optional[int] = None
    player_url: str = ""
    last_heartbeat: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    stopped_at: Optional[datetime] = None
    error_message: Optional[str] = None
