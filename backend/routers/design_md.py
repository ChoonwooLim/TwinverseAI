"""디자인샘플 (voltagent/awesome-design-md) API — admin only."""
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import require_admin
from models.design_md import DesignMd, DesignMdSyncMeta
from services.design_md_sync import sync_from_github, _get_meta

router = APIRouter()
logger = logging.getLogger("design_md_api")


def _serialize_list(d: DesignMd) -> dict:
    return {
        "slug": d.slug,
        "name": d.name,
        "category": d.category,
        "tagline": d.tagline,
        "color_tokens": (d.color_tokens or [])[:5],
        "last_synced_at": d.last_synced_at.isoformat() if d.last_synced_at else None,
    }


def _serialize_detail(d: DesignMd) -> dict:
    return {
        "slug": d.slug,
        "name": d.name,
        "category": d.category,
        "tagline": d.tagline,
        "design_md": d.design_md,
        "getdesign_url": d.getdesign_url,
        "github_url": d.github_url,
        "color_tokens": d.color_tokens or [],
        "font_tokens": d.font_tokens or [],
        "last_synced_at": d.last_synced_at.isoformat() if d.last_synced_at else None,
    }


def _serialize_meta(m: DesignMdSyncMeta) -> dict:
    return {
        "last_sync_started": m.last_sync_started.isoformat() if m.last_sync_started else None,
        "last_sync_finished": m.last_sync_finished.isoformat() if m.last_sync_finished else None,
        "last_sync_status": m.last_sync_status,
        "last_sync_error": m.last_sync_error,
        "samples_count": m.samples_count,
    }


@router.get("")
def list_design_md(
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """전체 디자인 샘플 목록 (슬림 페이로드)."""
    rows = session.exec(select(DesignMd).order_by(DesignMd.name)).all()
    return [_serialize_list(d) for d in rows]


@router.get("/sync/status")
def sync_status(
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """동기화 메타 조회."""
    meta = _get_meta(session)
    return _serialize_meta(meta)


@router.post("/sync")
def trigger_sync(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """수동 sync 트리거. 이미 running 이면 409."""
    meta = _get_meta(session)
    if meta.last_sync_status == "running":
        raise HTTPException(status_code=409, detail="동기화가 이미 진행 중입니다")
    background_tasks.add_task(sync_from_github)
    return {"status": "started"}


@router.get("/{slug}")
def get_design_md(
    slug: str,
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """단일 디자인 샘플 디테일."""
    row = session.get(DesignMd, slug)
    if row is None:
        raise HTTPException(status_code=404, detail="디자인 샘플을 찾을 수 없습니다")
    return _serialize_detail(row)
