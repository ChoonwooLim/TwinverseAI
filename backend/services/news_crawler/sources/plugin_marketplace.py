"""Crawler for Claude Code plugin/skill marketplace via GitHub topic search.

Two GitHub topics are heavily used by the Claude Code ecosystem:
- `claude-code-plugin` — bundled plugins (formal marketplace install)
- `claude-code-skill` — single-skill repos (CLAUDE.md drop-ins)

Each repo is one RawItem. Body = description + README excerpt. The LLM
analyzer decides relevance and apply_action (install_plugin / install_skill).

This crawler is INTENTIONALLY conservative: limit to top-N by stars to avoid
analyzing the entire long-tail (2000+ repos for plugin topic). Stars > pushed
recency for picking which to surface — popular = vetted by community.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

from services.news_crawler.sources.base import BaseCrawler
from services.news_crawler.types import RawItem

logger = logging.getLogger("news_crawler.sources.plugin_marketplace")

GH_SEARCH = "https://api.github.com/search/repositories"
HTTP_TIMEOUT = 20.0
TOP_N_PER_TOPIC = 10  # cap LLM analysis cost


class _GithubTopicCrawlerBase(BaseCrawler):
    """Shared base for plugin_marketplace + skill_marketplace.

    Subclass sets `name`, `topic`, `category_hint`.
    """

    topic: str = ""
    category_hint: str = ""  # used in title to nudge LLM categorization

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

        # Search query: topic + recently active
        since_date = since.strftime("%Y-%m-%d")
        query = f"topic:{self.topic} pushed:>={since_date}"
        params = {
            "q": query,
            "sort": "stars",
            "order": "desc",
            "per_page": TOP_N_PER_TOPIC,
        }

        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers=headers) as client:
                resp = await client.get(GH_SEARCH, params=params)
            if resp.status_code == 422:
                logger.warning("github search 422 (likely rate-limited or bad query): %s", query)
                return []
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            logger.warning("github search failed for topic=%s: %s", self.topic, e)
            return []

        repos = data.get("items") or []
        logger.info(
            "%s: %d repo(s) (top %d by stars, since %s, total_count=%d)",
            self.name, len(repos), TOP_N_PER_TOPIC, since_date, data.get("total_count", 0),
        )

        items: list[RawItem] = []
        for repo in repos:
            if not isinstance(repo, dict):
                continue
            full_name = repo.get("full_name", "")
            html_url = repo.get("html_url", "")
            if not (full_name and html_url):
                continue
            description = (repo.get("description") or "").strip()
            stars = repo.get("stargazers_count", 0)
            pushed_at_raw = repo.get("pushed_at") or repo.get("updated_at")
            try:
                pushed_at = datetime.fromisoformat((pushed_at_raw or "").replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pushed_at = datetime.now(timezone.utc)

            body = (
                f"GitHub topic: {self.topic}\n"
                f"Repo: {full_name}\n"
                f"Stars: {stars}\n"
                f"Description: {description}\n"
                f"URL: {html_url}\n"
            )

            items.append(RawItem(
                source=self.name,
                source_url=html_url,
                title_raw=f"{full_name} ({self.category_hint})",
                content_raw=body,
                discovered_at=pushed_at,
                metadata={
                    "topic": self.topic,
                    "stars": stars,
                    "owner": (repo.get("owner") or {}).get("login", ""),
                    "name": repo.get("name", ""),
                    "default_branch": repo.get("default_branch", "main"),
                },
            ))

        return items


class PluginMarketplaceCrawler(_GithubTopicCrawlerBase):
    name = "plugin_marketplace"
    topic = "claude-code-plugin"
    category_hint = "Claude Code plugin"


class SkillMarketplaceCrawler(_GithubTopicCrawlerBase):
    name = "skill_marketplace"
    topic = "claude-code-skill"
    category_hint = "Claude Code skill"
