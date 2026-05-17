"""DesignMd: voltagent/awesome-design-md 의 캐시된 디자인 샘플.
DesignMdSyncMeta: sync 작업 메타 정보 (싱글톤 행, id=1)."""
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, JSON


class DesignMd(SQLModel, table=True):
    __tablename__ = "design_md"

    slug: str = Field(primary_key=True)                      # "claude", "airbnb"
    name: str
    category: str = Field(default="", index=True)            # "AI & LLM Platforms"
    tagline: str = Field(default="")
    design_md: str                                            # DESIGN.md 원문
    getdesign_url: str                                        # https://getdesign.md/<slug>/design-md
    github_url: str                                           # GitHub blob URL
    color_tokens: Optional[list] = Field(default=None, sa_column=Column(JSON))
    font_tokens: Optional[list] = Field(default=None, sa_column=Column(JSON))
    last_synced_at: datetime = Field(default_factory=datetime.now)


class DesignMdSyncMeta(SQLModel, table=True):
    __tablename__ = "design_md_sync_meta"

    id: int = Field(default=1, primary_key=True)
    last_sync_started: Optional[datetime] = None
    last_sync_finished: Optional[datetime] = None
    last_sync_status: str = Field(default="never")           # never | running | ok | failed
    last_sync_error: Optional[str] = None
    samples_count: int = Field(default=0)
