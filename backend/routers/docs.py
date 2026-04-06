"""프로젝트 문서 API — PostgreSQL 기반"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models.document import Document

router = APIRouter()

DOC_TITLES = {
    "dev-plan": "개발계획",
    "bugfix-log": "버그수정 로그",
    "upgrade-log": "업그레이드 로그",
    "work-log": "작업일지",
}


@router.get("/list")
def list_docs(session: Session = Depends(get_session)):
    docs = session.exec(select(Document)).all()
    return [
        {"key": d.key, "title": d.title, "exists": True, "updated_at": d.updated_at.isoformat()}
        for d in docs
    ]


@router.get("/{doc_key}")
def get_doc(doc_key: str, session: Session = Depends(get_session)):
    doc = session.exec(select(Document).where(Document.key == doc_key)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"key": doc.key, "title": doc.title, "content": doc.content}
