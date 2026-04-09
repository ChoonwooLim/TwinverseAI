from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class PS2DedicatedServer(SQLModel, table=True):
    __tablename__ = "ps2dedicatedserver"

    id: Optional[int] = Field(default=None, primary_key=True)
    office_id: str = Field(unique=True, index=True)
    map_path: str
    status: str = Field(default="starting")  # starting | running | stopping | stopped | error
    pid: Optional[int] = None
    port: int = Field(default=7777)  # UE5 default listen port
    player_count: int = Field(default=0)
    max_players: int = Field(default=20)
    last_heartbeat: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    stopped_at: Optional[datetime] = None
    error_message: Optional[str] = None
