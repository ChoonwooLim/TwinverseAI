from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class ClaudeNews(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    category: str = Field(default="general")  # skill, mode, plugin, feature, update
    summary: str = Field(default="")
    content: str = Field(default="")  # markdown
    source_url: str = Field(default="")
    discovered_at: datetime = Field(default_factory=datetime.now)
