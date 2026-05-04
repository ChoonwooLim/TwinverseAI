"""APScheduler integration for the news crawler.

Started/stopped from main.py lifespan. Default: daily at 09:00 KST.
Override via env:
- NEWS_CRAWL_CRON: cron expression (default "0 9 * * *" = 09:00 daily)
- NEWS_CRAWL_TZ:   IANA timezone name (default "Asia/Seoul")
- NEWS_CRAWL_ENABLED: "0" disables scheduling (manual trigger still works)

Set NEWS_CRAWL_RUN_ON_STARTUP=1 to also run once immediately on startup
(useful for first-deploy bootstrap, off by default).
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from services.news_crawler.runner import run_once

logger = logging.getLogger("news_crawler.scheduler")

_scheduler: Optional[AsyncIOScheduler] = None


def _parse_cron(expr: str) -> CronTrigger:
    """Accept a 5-field cron expression (`m h dom mon dow`) and build a trigger."""
    parts = expr.strip().split()
    if len(parts) != 5:
        raise ValueError(f"NEWS_CRAWL_CRON must have 5 fields, got {len(parts)}: {expr!r}")
    minute, hour, day, month, day_of_week = parts
    return CronTrigger(
        minute=minute,
        hour=hour,
        day=day,
        month=month,
        day_of_week=day_of_week,
        timezone=os.getenv("NEWS_CRAWL_TZ", "Asia/Seoul"),
    )


async def _scheduled_run() -> None:
    """Job body — wrap run_once with logging so failures are visible in logs."""
    try:
        report = await run_once()
        logger.info("news crawl OK: %s", report.summary())
    except Exception:
        logger.exception("news crawl failed")


def start_scheduler() -> Optional[AsyncIOScheduler]:
    """Idempotent. Returns the scheduler (or None if disabled)."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    if os.getenv("NEWS_CRAWL_ENABLED", "1") == "0":
        logger.info("news scheduler disabled via NEWS_CRAWL_ENABLED=0")
        return None

    cron_expr = os.getenv("NEWS_CRAWL_CRON", "0 9 * * *")
    try:
        trigger = _parse_cron(cron_expr)
    except ValueError as e:
        logger.error("invalid NEWS_CRAWL_CRON, scheduler not started: %s", e)
        return None

    sched = AsyncIOScheduler()
    sched.add_job(
        _scheduled_run,
        trigger=trigger,
        id="news-crawl",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    sched.start()
    _scheduler = sched
    logger.info(
        "news scheduler started: cron=%r tz=%s",
        cron_expr,
        os.getenv("NEWS_CRAWL_TZ", "Asia/Seoul"),
    )

    if os.getenv("NEWS_CRAWL_RUN_ON_STARTUP", "0") == "1":
        # Schedule a one-shot now (pulls into the same loop, doesn't block startup)
        sched.add_job(_scheduled_run, id="news-crawl-bootstrap", replace_existing=True)
        logger.info("news scheduler: queued one-shot bootstrap run")

    return sched


def stop_scheduler() -> None:
    """Idempotent."""
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
    except Exception:
        logger.exception("scheduler shutdown raised")
    _scheduler = None
    logger.info("news scheduler stopped")


def scheduler_status() -> dict:
    """For health/admin endpoints."""
    if _scheduler is None:
        return {"running": False, "jobs": []}
    jobs = []
    for j in _scheduler.get_jobs():
        next_run = j.next_run_time.isoformat() if j.next_run_time else None
        jobs.append({"id": j.id, "next_run": next_run})
    return {"running": True, "jobs": jobs}
