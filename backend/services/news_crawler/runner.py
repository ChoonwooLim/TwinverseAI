"""Runner — orchestrates crawl → analyze → persist for all sources.

Called by:
- APScheduler cron (Phase 4) on a schedule
- POST /api/news/refresh manual trigger endpoint (Phase 4, admin-only)
- CLI smoke (`python -m services.news_crawler.runner`)

CLI smoke loads .env at module-import time so OPENCLAW_*/OLLAMA_URL are available
to llm.py call-time env reads. Production (uvicorn) loads .env in main.py before
this module is imported, so the call-time fallback is never exercised there.
"""
from __future__ import annotations

import asyncio
import logging
import os

# Load .env when this module is run as a script. Safe in production: uvicorn
# already loaded .env earlier via main.py, and load_dotenv won't overwrite
# already-set env vars.
if os.getenv("NEWS_CRAWLER_AUTOLOAD_DOTENV", "1") != "0":
    try:
        from dotenv import load_dotenv
        load_dotenv(encoding="utf-8")
    except ImportError:
        pass
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session

import database
from services.news_crawler.llm import analyze_item
from services.news_crawler.persistence import existing_source_urls, persist_batch, PersistResult
from services.news_crawler.sources import (
    BaseCrawler,
    ClaudeCodeReleasesCrawler,
    CuratorReposCrawler,
    PluginMarketplaceCrawler,
    SkillMarketplaceCrawler,
)
from services.news_crawler.types import NewsAnalysis, RawItem

logger = logging.getLogger("news_crawler.runner")


def default_sources() -> list[BaseCrawler]:
    """Currently enabled sources. Add to this list to extend coverage."""
    return [
        ClaudeCodeReleasesCrawler(),
        PluginMarketplaceCrawler(),
        SkillMarketplaceCrawler(),
        CuratorReposCrawler(),
    ]


@dataclass
class SourceReport:
    name: str
    fetched: int = 0
    new: int = 0           # raw items not yet in DB
    analyzed: int = 0      # successfully turned into NewsAnalysis
    failed_analyze: int = 0
    error: Optional[str] = None  # if fetch_recent itself raised


@dataclass
class RunReport:
    started_at: datetime
    finished_at: Optional[datetime] = None
    sources: list[SourceReport] = field(default_factory=list)
    persist: Optional[PersistResult] = None

    def summary(self) -> dict:
        total_inserted = self.persist.inserted if self.persist else 0
        total_dups = self.persist.skipped_duplicate if self.persist else 0
        return {
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "sources": [
                {
                    "name": s.name,
                    "fetched": s.fetched,
                    "new": s.new,
                    "analyzed": s.analyzed,
                    "failed_analyze": s.failed_analyze,
                    "error": s.error,
                }
                for s in self.sources
            ],
            "inserted": total_inserted,
            "duplicates": total_dups,
            "ignored": self.persist.skipped_irrelevant if self.persist else 0,
            "errors": self.persist.errors if self.persist else 0,
        }


async def run_once(
    *,
    sources: Optional[list[BaseCrawler]] = None,
    since: Optional[datetime] = None,
    max_per_source: Optional[int] = None,
    session: Optional[Session] = None,
) -> RunReport:
    """Run all sources once, persist new analyzed items in a single batch.

    Args:
        sources: defaults to `default_sources()`.
        since: time window for `fetch_recent`. Defaults to 30 days ago.
        max_per_source: cap items per source (useful for first-run smoke).
        session: optional caller-managed session. Otherwise a new one is opened.
    """
    crawlers = sources if sources is not None else default_sources()
    since = since or (datetime.now(timezone.utc) - timedelta(days=30))
    report = RunReport(started_at=datetime.now(timezone.utc))

    own_session = session is None
    sess = session if session is not None else Session(database.engine)

    try:
        seen = existing_source_urls(sess)
        logger.info("run_once: %d crawler(s), since=%s, %d seen URLs", len(crawlers), since, len(seen))

        pairs: list[tuple[RawItem, NewsAnalysis]] = []

        for crawler in crawlers:
            sr = SourceReport(name=crawler.name)
            report.sources.append(sr)
            try:
                items = await crawler.fetch_recent(since=since)
            except Exception as e:
                logger.exception("crawler %s fetch_recent raised", crawler.name)
                sr.error = f"{type(e).__name__}: {e}"
                continue
            sr.fetched = len(items)

            # Filter to only new (unseen URLs)
            new_items = [it for it in items if it.source_url and it.source_url not in seen]
            if max_per_source is not None:
                new_items = new_items[:max_per_source]
            sr.new = len(new_items)

            for item in new_items:
                try:
                    analysis = await analyze_item(item)
                except Exception:
                    logger.exception("analyze_item raised for %s", item.source_url)
                    sr.failed_analyze += 1
                    continue
                if analysis is None:
                    sr.failed_analyze += 1
                    continue
                pairs.append((item, analysis))
                sr.analyzed += 1
                # Mark seen so within-run duplicates don't double-process
                seen.add(item.source_url)

        # Persist all pairs in one batch (single commit)
        report.persist = persist_batch(sess, pairs)
    finally:
        if own_session:
            sess.close()
        report.finished_at = datetime.now(timezone.utc)

    return report


# ── CLI smoke ──────────────────────────────────────────────────


async def _smoke() -> int:
    import argparse
    import json as _json

    parser = argparse.ArgumentParser(description="Run news crawler once")
    parser.add_argument("--days", type=int, default=14, help="Days of history to fetch (default 14)")
    parser.add_argument("--max", type=int, default=2, help="Max items per source to analyze (default 2 for smoke)")
    parser.add_argument("--no-persist", action="store_true", help="Print analysis but skip DB write")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if args.no_persist:
        # Run crawl + analyze without DB write
        crawler = ClaudeCodeReleasesCrawler()
        items = await crawler.fetch_recent(since=datetime.now(timezone.utc) - timedelta(days=args.days))
        items = items[:args.max]
        print(f"\nfetched {len(items)} item(s); analyzing without persist...\n")
        for item in items:
            analysis = await analyze_item(item)
            if analysis is None:
                print(f"FAIL: {item.source_url}")
                continue
            print(f"-- {item.discovered_at.date()} {item.title_raw}")
            print(f"   engine={analysis.llm_engine} cat={analysis.category} conf={analysis.confidence:.2f}")
            print(f"   action={analysis.apply_action.get('type')} approve={analysis.requires_approval}")
            print(f"   title_ko: {analysis.title_ko}")
        return 0

    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    report = await run_once(since=since, max_per_source=args.max)
    print(_json.dumps(report.summary(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_smoke()))
