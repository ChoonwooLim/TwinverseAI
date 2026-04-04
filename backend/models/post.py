from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    board_type: str = Field(index=True)  # "notice" | "qna" | "gallery" | "video"
    title: str
    content: str = ""  # markdown
    author_id: int = Field(foreign_key="user.id")
    is_pinned: bool = Field(default=False)
    view_count: int = Field(default=0)
    video_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
