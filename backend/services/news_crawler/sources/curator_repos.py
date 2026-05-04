"""Crawler for hand-picked curator repos.

We follow a small set of high-signal authors who publish skills/plugins/guidelines
for Claude Code. For each, fetch the latest commit and surface it if it landed
since `since`. Each commit URL is unique → natural de-dup.

Default list — extend via env CURATOR_REPOS (comma-separated owner/name):
- forrestchang/andrej-karpathy-skills (4 principles + plugins)
- obra/superpowers (process skills)

LLM analyzer decides if the commit is install-worthy or info_only.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

from services.news_crawler.sources.base import BaseCrawler
from services.news_crawler.types import RawItem

logger = logging.getLogger("news_crawler.sources.curator_repos")

GH_API_BASE = "https://api.github.com"
HTTP_TIMEOUT = 15.0
COMMITS_PER_REPO = 5  # surface up to this many recent commits per repo

DEFAULT_REPOS = (
    "forrestchang/andrej-karpathy-skills",
    "obra/superpowers",
)


def _configured_repos() -> tuple[str, ...]:
    raw = os.getenv("CURATOR_REPOS", "").strip()
    if not raw:
        return DEFAULT_REPOS
    return tuple(r.strip() for r in raw.split(",") if r.strip())


class CuratorReposCrawler(BaseCrawler):
    name = "curator_repos"

    async def fetch_recent(self, since: Optional[datetime] = None) -> list[RawItem]:
        since = since or self._default_since(30)
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

        repos = _configured_repos()
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "twinverseai-news-watch/1.0",
        }
        token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        all_items: list[RawItem] = []
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers=headers) as client:
            for repo in repos:
                items = await self._fetch_repo_commits(client, repo, since)
                all_items.extend(items)

        all_items.sort(key=lambda x: x.discovered_at, reverse=True)
        logger.info("curator_repos: %d commit(s) across %d repo(s)", len(all_items), len(repos))
        return all_items

    async def _fetch_repo_commits(
        self,
        client: httpx.AsyncClient,
        repo: str,
        since: datetime,
    ) -> list[RawItem]:
        """Fetch up to COMMITS_PER_REPO commits since `since` from one repo."""
        try:
            url = f"{GH_API_BASE}/repos/{repo}/commits"
            params = {
                "since": since.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "per_page": COMMITS_PER_REPO,
            }
            resp = await client.get(url, params=params)
            if resp.status_code == 404:
                logger.warning("curator repo not found: %s", repo)
                return []
            resp.raise_for_status()
            commits = resp.json()
        except httpx.HTTPError as e:
            logger.warning("commits fetch failed for %s: %s", repo, e)
            return []

        if not isinstance(commits, list):
            return []

        items: list[RawItem] = []
        for c in commits:
            if not isinstance(c, dict):
                continue
            sha = c.get("sha", "")
            html_url = c.get("html_url", "")
            commit_obj = c.get("commit") or {}
            message = commit_obj.get("message", "").strip()
            committer = (commit_obj.get("committer") or {}).get("date", "")
            if not (sha and html_url and message):
                continue
            try:
                committed_at = datetime.fromisoformat(committer.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                committed_at = datetime.now(timezone.utc)

            # Truncate body — first line is the title-ish, take whole message up to ~2000 chars
            body = f"Repo: {repo}\nCommit: {sha[:8]}\n\n{message[:2000]}"

            # Title: first line of commit message (up to 80 chars)
            first_line = message.splitlines()[0] if message else "(empty commit message)"

            items.append(RawItem(
                source=self.name,
                source_url=html_url,
                title_raw=f"{repo}: {first_line[:80]}",
                content_raw=body,
                discovered_at=committed_at,
                metadata={
                    "repo": repo,
                    "sha": sha,
                    "owner": repo.split("/")[0] if "/" in repo else "",
                    "name": repo.split("/")[1] if "/" in repo else repo,
                },
            ))

        return items
