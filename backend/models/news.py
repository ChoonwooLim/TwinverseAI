from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class ClaudeNews(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    category: str = Field(default="general")  # skill, mode, plugin, feature, update
    summary: str = Field(default="")
    content: str = Field(default="")  # markdown
    source_url: str = Field(default="", index=True)
    discovered_at: datetime = Field(default_factory=datetime.now)

    # Apply tracking — added 2026-05-05 (news-watch automation)
    # apply_status: pending | applied | info_only | needs_approval | approved | ignored | failed
    apply_status: str = Field(default="pending", index=True)
    # JSON describing the action: {"type": "install_skill"|"install_plugin"|"edit_claude_md"|"edit_settings"|"info_only", ...}
    apply_action: Optional[str] = Field(default=None)
    applied_at: Optional[datetime] = Field(default=None)
    requires_approval: bool = Field(default=False)
