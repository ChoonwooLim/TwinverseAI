"""voltagent/awesome-design-md 의 디자인 샘플을 GitHub 에서 페치해 DB 에 캐시.

흐름:
1. README.md → 카테고리 + tagline 맵 (slug -> {category, tagline})
2. git tree → design-md/<slug>/DESIGN.md 경로 목록
3. raw.githubusercontent.com 에서 각 DESIGN.md 병렬 페치 (동시 10)
4. parse_color_tokens, parse_font_tokens 로 토큰 추출
5. session.merge 로 upsert. 사라진 slug 는 삭제.
6. design_md_sync_meta 갱신.
"""
import asyncio
import logging
import re
from datetime import datetime
from typing import Optional

import httpx
from sqlmodel import Session, select

from database import engine
from models.design_md import DesignMd, DesignMdSyncMeta
from services.design_md_tokens import parse_color_tokens, parse_font_tokens

logger = logging.getLogger("design_md_sync")

GITHUB_OWNER = "VoltAgent"
GITHUB_REPO = "awesome-design-md"
GITHUB_BRANCH = "main"
README_RAW = f"https://raw.githubusercontent.com/{GITHUB_OWNER}/{GITHUB_REPO}/{GITHUB_BRANCH}/README.md"
TREE_API = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/git/trees/{GITHUB_BRANCH}?recursive=1"

_CATEGORY_HEADER_RE = re.compile(r"^###\s+(.+)$", re.MULTILINE)
_LINK_LINE_RE = re.compile(r"^\s*-\s*\[\*\*(.+?)\*\*\]\((https://getdesign\.md/([^/]+)/design-md)\)\s*-\s*(.+)$", re.MULTILINE)


def _parse_readme(text: str) -> dict[str, dict]:
    """README.md 의 '### Category' 헤더와 그 아래 링크 라인을 파싱.

    반환: {slug: {"name": str, "category": str, "tagline": str, "getdesign_url": str}}
    """
    result: dict[str, dict] = {}
    sections = re.split(_CATEGORY_HEADER_RE, text)
    for i in range(1, len(sections), 2):
        category = sections[i].strip()
        body = sections[i + 1] if i + 1 < len(sections) else ""
        for m in _LINK_LINE_RE.finditer(body):
            name, getdesign_url, slug, tagline = m.group(1), m.group(2), m.group(3), m.group(4).strip()
            result[slug] = {
                "name": name,
                "category": category,
                "tagline": tagline,
                "getdesign_url": getdesign_url,
            }
    return result


async def _fetch_design_md(client: httpx.AsyncClient, slug: str) -> Optional[str]:
    """단일 brand 의 DESIGN.md raw 내용 페치. 실패 시 None."""
    url = f"https://raw.githubusercontent.com/{GITHUB_OWNER}/{GITHUB_REPO}/{GITHUB_BRANCH}/design-md/{slug}/DESIGN.md"
    try:
        r = await client.get(url, timeout=15)
        r.raise_for_status()
        return r.text
    except Exception as e:
        logger.warning(f"[design_md_sync] fetch failed for {slug}: {e}")
        return None


async def _fetch_all_design_md(slugs: list[str]) -> dict[str, str]:
    """모든 slug 의 DESIGN.md 를 동시 10개씩 페치."""
    limits = httpx.Limits(max_connections=10)
    async with httpx.AsyncClient(limits=limits) as client:
        coros = [_fetch_design_md(client, slug) for slug in slugs]
        results = await asyncio.gather(*coros)
    return {slug: text for slug, text in zip(slugs, results) if text is not None}


def _get_meta(session: Session) -> DesignMdSyncMeta:
    meta = session.get(DesignMdSyncMeta, 1)
    if meta is None:
        meta = DesignMdSyncMeta(id=1)
        session.add(meta)
        session.commit()
        session.refresh(meta)
    return meta


async def sync_from_github() -> dict:
    """전체 sync 흐름. 결과 dict 반환 (status, count, error)."""
    started_at = datetime.now()
    with Session(engine) as session:
        meta = _get_meta(session)
        if meta.last_sync_status == "running":
            return {"status": "already_running"}
        meta.last_sync_started = started_at
        meta.last_sync_status = "running"
        meta.last_sync_error = None
        session.add(meta)
        session.commit()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            readme_resp, tree_resp = await asyncio.gather(
                client.get(README_RAW),
                client.get(TREE_API),
            )
            readme_resp.raise_for_status()
            tree_resp.raise_for_status()

        readme_map = _parse_readme(readme_resp.text)
        tree = tree_resp.json().get("tree", [])
        slugs_from_tree = []
        for entry in tree:
            path = entry.get("path", "")
            m = re.match(r"^design-md/([^/]+)/DESIGN\.md$", path)
            if m and entry.get("type") == "blob":
                slugs_from_tree.append(m.group(1))

        # Guard: if GitHub tree API response shape changes and we extract 0 slugs,
        # do NOT proceed (would wipe entire DB via "delete missing" logic).
        if not slugs_from_tree:
            raise RuntimeError("tree API returned 0 DESIGN.md paths — schema may have changed")

        md_map = await _fetch_all_design_md(slugs_from_tree)

        with Session(engine) as session:
            seen_slugs = set()
            for slug, md_text in md_map.items():
                meta_entry = readme_map.get(slug, {})
                row = session.get(DesignMd, slug) or DesignMd(slug=slug, name=slug, design_md="", getdesign_url="", github_url="")
                row.name = meta_entry.get("name") or slug
                row.category = meta_entry.get("category") or "Other"
                row.tagline = meta_entry.get("tagline") or ""
                row.design_md = md_text
                row.getdesign_url = meta_entry.get("getdesign_url") or f"https://getdesign.md/{slug}/design-md"
                row.github_url = f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/blob/{GITHUB_BRANCH}/design-md/{slug}/DESIGN.md"
                row.color_tokens = parse_color_tokens(md_text)
                row.font_tokens = parse_font_tokens(md_text)
                row.last_synced_at = datetime.now()
                session.add(row)
                seen_slugs.add(slug)

            # Delete rows that disappeared upstream (per tree, not per successful fetch).
            # This protects against transient fetch failures causing row churn.
            tree_slug_set = set(slugs_from_tree)
            existing = session.exec(select(DesignMd)).all()
            for row in existing:
                if row.slug not in tree_slug_set:
                    session.delete(row)

            session.commit()

            meta = _get_meta(session)
            meta.last_sync_finished = datetime.now()
            meta.last_sync_status = "ok"
            meta.last_sync_error = None
            meta.samples_count = len(seen_slugs)
            session.add(meta)
            session.commit()

        logger.info(f"[design_md_sync] OK: {len(seen_slugs)} samples")
        return {"status": "ok", "count": len(seen_slugs)}

    except Exception as e:
        logger.exception(f"[design_md_sync] FAILED: {e}")
        with Session(engine) as session:
            meta = _get_meta(session)
            meta.last_sync_finished = datetime.now()
            meta.last_sync_status = "failed"
            meta.last_sync_error = str(e)[:500]
            session.add(meta)
            session.commit()
        return {"status": "failed", "error": str(e)}
