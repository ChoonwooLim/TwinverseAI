import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session
from database import get_session
from models import FileRecord, User
from deps import get_current_user

router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi"}


def _get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    return "other"


@router.post("/upload")
async def upload_file(
    post_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    file_type = _get_file_type(file.filename or "unknown")
    max_size = MAX_VIDEO_SIZE if file_type == "video" else MAX_IMAGE_SIZE

    content = await file.read()
    if len(content) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Max {limit_mb}MB")

    ext = Path(file.filename or "file").suffix
    stored_name = f"{uuid.uuid4()}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path = UPLOAD_DIR / stored_name

    with open(stored_path, "wb") as f:
        f.write(content)

    record = FileRecord(
        post_id=post_id,
        original_name=file.filename or "unknown",
        stored_path=f"/uploads/{stored_name}",
        file_type=file_type,
        file_size=len(content),
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "original_name": record.original_name,
        "stored_path": record.stored_path,
        "file_type": record.file_type,
        "file_size": record.file_size,
    }
