"""DB persistence + de-dup for the news crawler.

Maps `NewsAnalysis` (LLM output) onto `models.news.ClaudeNews` rows. De-dup by
`source_url` — if the same URL was already inserted in a prior run, skip.

apply_status policy:
- requires_approval=True (edit_claude_md/edit_settings) → 'needs_approval'
- apply_action.type == 'info_only' → 'info_only'
- otherwise (install_skill/install_plugin) → 'pending' (the news-watch skill
  picks this up and auto-applies, then flips to 'applied')
- LLM-decided is_relevant=False → 'ignored'
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from sqlmodel import Session, select

from models.news import ClaudeNews
from services.news_crawler.types import NewsAnalysis, RawItem

logger = logging.getLogger("news_crawler.persistence")


@dataclass
class PersistResult:
    inserted: int = 0
    skipped_duplicate: int = 0
    skipped_irrelevant: int = 0
    errors: int = 0


def _initial_apply_status(analysis: NewsAnalysis) -> str:
    if not analysis.is_relevant:
        return "ignored"
    if analysis.requires_approval:
        return "needs_approval"
    if analysis.apply_action.get("type") == "info_only":
        return "info_only"
    return "pending"


def existing_source_urls(session: Session) -> set[str]:
    """Load all source_urls already in claudenews. Used by runner to skip re-analyzing."""
    rows = session.exec(select(ClaudeNews.source_url)).all()
    return {url for url in rows if url}


def persist_analysis(
    session: Session,
    item: RawItem,
    analysis: NewsAnalysis,
) -> ClaudeNews | None:
    """Insert one analyzed item. Returns the row or None if duplicate.

    Caller is responsible for the surrounding transaction (commit/rollback).
    """
    if not item.source_url:
        logger.warning("skip: empty source_url [%s]", item.title_raw[:60])
        return None

    # Per-row dedup check (caller may also batch-prefetch via existing_source_urls)
    existing = session.exec(
        select(ClaudeNews).where(ClaudeNews.source_url == item.source_url)
    ).first()
    if existing is not None:
        return None

    row = ClaudeNews(
        title=analysis.title_ko or item.title_raw[:200],
        category=analysis.category,
        summary=analysis.summary_ko,
        content=analysis.content_md,
        source_url=item.source_url,
        discovered_at=item.discovered_at,
        apply_status=_initial_apply_status(analysis),
        apply_action=json.dumps(analysis.apply_action, ensure_ascii=False),
        applied_at=None,
        requires_approval=analysis.requires_approval,
    )
    session.add(row)
    return row


def persist_batch(
    session: Session,
    pairs: list[tuple[RawItem, NewsAnalysis]],
) -> PersistResult:
    """Batch insert with prefetch dedup. Commits at the end."""
    result = PersistResult()
    seen = existing_source_urls(session)

    for item, analysis in pairs:
        if not item.source_url:
            result.errors += 1
            continue
        if item.source_url in seen:
            result.skipped_duplicate += 1
            continue
        if not analysis.is_relevant:
            # Still insert with 'ignored' status so we don't re-analyze the same
            # URL on the next crawl pass — this is the "negative cache".
            row = persist_analysis(session, item, analysis)
            if row is not None:
                seen.add(item.source_url)
                result.skipped_irrelevant += 1
            else:
                result.errors += 1
            continue
        row = persist_analysis(session, item, analysis)
        if row is None:
            result.skipped_duplicate += 1
        else:
            seen.add(item.source_url)
            result.inserted += 1

    try:
        session.commit()
    except Exception:
        session.rollback()
        logger.exception("persist_batch commit failed; rolled back")
        # all the inserted rows are gone now; treat counts as errors
        result.errors += result.inserted + result.skipped_irrelevant
        result.inserted = 0
        result.skipped_irrelevant = 0

    logger.info(
        "persist_batch: inserted=%d duplicates=%d ignored=%d errors=%d",
        result.inserted, result.skipped_duplicate, result.skipped_irrelevant, result.errors,
    )
    return result
