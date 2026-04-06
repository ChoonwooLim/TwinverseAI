from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)  # "dev-plan", "bugfix-log", etc.
    title: str = Field(default="")
    content: str = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.now)
