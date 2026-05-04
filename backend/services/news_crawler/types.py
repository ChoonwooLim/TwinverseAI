"""Shared dataclasses for the news crawler pipeline.

Crawler sources emit `RawItem`. LLM analyzer turns those into `NewsAnalysis`,
which the persistence layer maps onto `models.news.ClaudeNews` rows.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


CATEGORY_VALUES = ("skill", "mode", "plugin", "feature", "update", "general")
APPLY_ACTION_TYPES = (
    "info_only",
    "install_skill",
    "install_plugin",
    "edit_claude_md",
    "edit_settings",
)


@dataclass
class RawItem:
    """Output of a crawler source — raw text + provenance, pre-LLM."""

    source: str  # e.g. "claude_code_releases"
    source_url: str  # canonical URL (de-dup key)
    title_raw: str  # original title
    content_raw: str  # raw markdown/text body
    discovered_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class NewsAnalysis:
    """Output of the LLM analyzer — what gets persisted to ClaudeNews."""

    is_relevant: bool
    category: str  # one of CATEGORY_VALUES
    title_ko: str
    summary_ko: str
    content_md: str  # Korean markdown body
    apply_action: dict[str, Any]  # {"type": "...", ...}
    requires_approval: bool
    confidence: float  # 0..1, set by the LLM
    llm_engine: str  # e.g. "ollama:qwen2.5:7b" or "openclaw:openai-codex/gpt-5.5"
    raw_response: Optional[str] = None  # for debugging
