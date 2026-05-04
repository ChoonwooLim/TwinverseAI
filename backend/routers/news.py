"""Claude Code 최근정보 API"""
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import require_admin
from models import User
from models.news import ClaudeNews

router = APIRouter()
logger = logging.getLogger("news_api")


def _serialize_list(n: ClaudeNews) -> dict:
    apply_action = None
    if n.apply_action:
        try:
            apply_action = json.loads(n.apply_action)
        except json.JSONDecodeError:
            apply_action = None
    return {
        "id": n.id,
        "title": n.title,
        "category": n.category,
        "summary": n.summary,
        "source_url": n.source_url,
        "discovered_at": n.discovered_at.isoformat(),
        "apply_status": n.apply_status,
        "apply_action": apply_action,
        "applied_at": n.applied_at.isoformat() if n.applied_at else None,
        "requires_approval": n.requires_approval,
    }


@router.get("/list")
def list_news(
    status: str | None = None,
    session: Session = Depends(get_session),
):
    """List news. Optional `status` filter (e.g. ?status=pending)."""
    q = select(ClaudeNews).order_by(ClaudeNews.discovered_at.desc())
    if status:
        q = q.where(ClaudeNews.apply_status == status)
    news = session.exec(q).all()
    return [_serialize_list(n) for n in news]


@router.get("/{news_id}")
def get_news(news_id: int, session: Session = Depends(get_session)):
    n = session.exec(select(ClaudeNews).where(ClaudeNews.id == news_id)).first()
    if not n:
        raise HTTPException(status_code=404, detail="News not found")
    apply_action = None
    if n.apply_action:
        try:
            apply_action = json.loads(n.apply_action)
        except json.JSONDecodeError:
            apply_action = None
    return {
        **_serialize_list(n),
        "content": n.content,
        "apply_action": apply_action,
    }


# ── Admin-only: refresh + scheduler status + apply ─────────────


@router.post("/refresh")
async def refresh_news(
    days: int = 14,
    max_per_source: int = 5,
    admin: User = Depends(require_admin),
):
    """Manually trigger a crawl run. Returns the run report.

    `days` = how far back to look. `max_per_source` caps LLM cost.
    """
    if days <= 0 or days > 90:
        raise HTTPException(status_code=400, detail="days must be 1..90")
    if max_per_source <= 0 or max_per_source > 30:
        raise HTTPException(status_code=400, detail="max_per_source must be 1..30")

    from datetime import timedelta
    from services.news_crawler.runner import run_once

    since = datetime.now(timezone.utc) - timedelta(days=days)
    logger.info("news refresh triggered by admin %s (days=%d, max=%d)", admin.email, days, max_per_source)
    report = await run_once(since=since, max_per_source=max_per_source)
    return report.summary()


@router.get("/scheduler/status")
def get_scheduler_status(_admin: User = Depends(require_admin)):
    """Inspect scheduler state — whether the cron is running and next fire time."""
    from services.news_crawler.scheduler import scheduler_status
    return scheduler_status()


@router.post("/{news_id}/mark-applied")
def mark_applied(
    news_id: int,
    notes: str | None = None,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Flip a row to apply_status='applied' with applied_at=now.

    Called by the news-watch Claude Code skill after it finishes auto-installing
    a skill/plugin or applying a config edit.
    """
    n = session.exec(select(ClaudeNews).where(ClaudeNews.id == news_id)).first()
    if not n:
        raise HTTPException(status_code=404, detail="News not found")
    n.apply_status = "applied"
    n.applied_at = datetime.now(timezone.utc)
    session.add(n)
    session.commit()
    logger.info("news #%d marked applied by admin %s (notes=%r)", news_id, admin.email, notes)
    return _serialize_list(n)


@router.post("/{news_id}/ignore")
def mark_ignored(
    news_id: int,
    _admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Mark a news item as ignored (user said 'no thanks')."""
    n = session.exec(select(ClaudeNews).where(ClaudeNews.id == news_id)).first()
    if not n:
        raise HTTPException(status_code=404, detail="News not found")
    n.apply_status = "ignored"
    session.add(n)
    session.commit()
    return _serialize_list(n)
