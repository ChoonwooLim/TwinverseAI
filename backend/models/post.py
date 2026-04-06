from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


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

    # Cascade delete: 게시글 삭제 시 댓글/파일도 자동 삭제
    comments: List["Comment"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "select"}
    )
    files: List["FileRecord"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "select"}
    )


# Circular import 방지용 forward reference
from models.comment import Comment  # noqa: E402, F401
from models.file import FileRecord  # noqa: E402, F401
