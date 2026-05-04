"""BaseCrawler ABC. Each source emits a list of `RawItem` for a time window."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.news_crawler.types import RawItem


class BaseCrawler(ABC):
    """Subclasses fetch recent items from a single source.

    Implement `name` (matches RawItem.source) and `fetch_recent`. Persistence
    de-dups by source_url, so crawlers can return overlapping windows safely.
    """

    name: str = ""

    @abstractmethod
    async def fetch_recent(self, since: Optional[datetime] = None) -> list[RawItem]:
        """Return raw items published since `since` (default: 30 days ago).

        Items are NOT de-duped or persisted here — that's the runner's job.
        Implementations should be tolerant to transient network errors and
        return [] rather than raising for "no items found" / minor parse fails.
        """
        ...

    @staticmethod
    def _default_since(days: int = 30) -> datetime:
        return datetime.now(timezone.utc) - timedelta(days=days)
