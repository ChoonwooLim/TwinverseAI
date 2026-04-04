from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class FileRecord(SQLModel, table=True):
    __tablename__ = "file"

    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="post.id", index=True)
    original_name: str
    stored_path: str
    file_type: str  # "image" | "video" | "other"
    file_size: int
    uploaded_at: datetime = Field(default_factory=datetime.now)
