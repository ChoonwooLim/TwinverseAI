from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class OpenClawConversation(SQLModel, table=True):
    __tablename__ = "openclawconversation"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    agent_id: str = Field(index=True)
    title: str = Field(default="새 대화")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    last_message_at: Optional[datetime] = None


class OpenClawMessage(SQLModel, table=True):
    __tablename__ = "openclawmessage"

    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="openclawconversation.id", index=True)
    role: str = Field(index=True)  # user | assistant | system
    content: str = Field(default="")
    attachments_json: Optional[str] = None  # JSON array: [{kind, mimeType, fileName, size}]
    created_at: datetime = Field(default_factory=datetime.now)
