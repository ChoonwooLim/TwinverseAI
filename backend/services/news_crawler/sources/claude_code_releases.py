"""Claude Code releases crawler (anthropics/claude-code GitHub releases).

Most reliable signal of new Claude Code features/modes/skills/plugins.
GitHub returns deterministic JSON; no scraping fragility.

Auth:
- Optional GITHUB_TOKEN env raises rate limit from 60/hr (anonymous) to 5000/hr.
  Daily cron only needs ~5 requests so anonymous works.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

from services.news_crawler.sources.base import BaseCrawler
from services.news_crawler.types import RawItem

logger = logging.getLogger("news_crawler.sources.claude_code_releases")

GH_API = "https://api.github.com/repos/anthropics/claude-code/releases"
HTTP_TIMEOUT = 15.0
PER_PAGE = 30  # plenty for a 30-day window


class ClaudeCodeReleasesCrawler(BaseCrawler):
    name = "claude_code_releases"

    async def fetch_recent(self, since: Optional[datetime] = None) -> list[RawItem]:
        since = since or self._default_since(30)
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "twinverseai-news-watch/1.0",
        }
        token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers=headers) as client:
                resp = await client.get(GH_API, params={"per_page": PER_PAGE})
            if resp.status_code == 404:
                logger.warning("claude-code releases endpoint 404; repo may have no releases")
                return []
            resp.raise_for_status()
            releases = resp.json()
        except httpx.HTTPError as e:
            logger.warning("claude-code releases fetch failed: %s", e)
            return []

        if not isinstance(releases, list):
            logger.warning("unexpected releases shape: %s", type(releases).__name__)
            return []

        items: list[RawItem] = []
        for rel in releases:
            if not isinstance(rel, dict):
                continue
            if rel.get("draft"):
                continue
            published_at_raw = rel.get("published_at") or rel.get("created_at")
            if not published_at_raw:
                continue
            try:
                published_at = datetime.fromisoformat(published_at_raw.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                continue
            if published_at < since:
                continue

            tag = rel.get("tag_name") or ""
            release_name = rel.get("name") or tag
            body = rel.get("body") or ""
            url = rel.get("html_url") or ""
            if not url:
                continue

            items.append(RawItem(
                source=self.name,
                source_url=url,
                title_raw=f"Claude Code {release_name}".strip(),
                content_raw=body,
                discovered_at=published_at,
                metadata={
                    "tag": tag,
                    "prerelease": bool(rel.get("prerelease")),
                    "github_id": rel.get("id"),
                },
            ))

        # Newest first
        items.sort(key=lambda x: x.discovered_at, reverse=True)
        logger.info("claude_code_releases: %d item(s) since %s", len(items), since.isoformat())
        return items
