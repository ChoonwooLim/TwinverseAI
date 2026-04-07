"""Claude Code 최근정보 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models.news import ClaudeNews

router = APIRouter()


@router.get("/list")
def list_news(session: Session = Depends(get_session)):
    news = session.exec(
        select(ClaudeNews).order_by(ClaudeNews.discovered_at.desc())
    ).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "category": n.category,
            "summary": n.summary,
            "source_url": n.source_url,
            "discovered_at": n.discovered_at.isoformat(),
        }
        for n in news
    ]


@router.get("/{news_id}")
def get_news(news_id: int, session: Session = Depends(get_session)):
    news = session.exec(
        select(ClaudeNews).where(ClaudeNews.id == news_id)
    ).first()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    return {
        "id": news.id,
        "title": news.title,
        "category": news.category,
        "summary": news.summary,
        "content": news.content,
        "source_url": news.source_url,
        "discovered_at": news.discovered_at.isoformat(),
    }
