# backend/routers/boards.py
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select, func, col
from database import get_session
from models import Post, User, FileRecord
from deps import get_current_user, require_admin

router = APIRouter()

VALID_BOARDS = ("notice", "qna", "gallery", "video")


class PostCreate(BaseModel):
    title: str
    content: str = ""
    video_url: str | None = None
    is_pinned: bool = False


class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    video_url: str | None = None
    is_pinned: bool | None = None


class PostResponse(BaseModel):
    id: int
    board_type: str
    title: str
    content: str
    author_id: int
    author_name: str = ""
    is_pinned: bool
    view_count: int
    video_url: str | None = None
    created_at: datetime
    updated_at: datetime
    comment_count: int = 0
    files: list = []


class PostListResponse(BaseModel):
    total: int
    page: int
    size: int
    posts: list[PostResponse]


def _validate_board(board_type: str):
    if board_type not in VALID_BOARDS:
        raise HTTPException(status_code=404, detail=f"Invalid board: {board_type}")


@router.get("/{board_type}")
def list_posts(
    board_type: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    offset = (page - 1) * size

    total = session.exec(
        select(func.count(Post.id)).where(Post.board_type == board_type)
    ).one()

    posts = session.exec(
        select(Post, User.username)
        .join(User, col(Post.author_id) == col(User.id))
        .where(Post.board_type == board_type)
        .order_by(col(Post.is_pinned).desc(), col(Post.created_at).desc())
        .offset(offset)
        .limit(size)
    ).all()

    # For gallery board, fetch first image thumbnail per post
    thumbnails = {}
    if board_type == "gallery":
        post_ids = [p.id for p, _ in posts]
        if post_ids:
            files = session.exec(
                select(FileRecord)
                .where(FileRecord.post_id.in_(post_ids), FileRecord.file_type == "image")
                .order_by(FileRecord.id)
            ).all()
            for f in files:
                if f.post_id not in thumbnails:
                    thumbnails[f.post_id] = f.stored_path

    return {
        "items": [
            {
                "id": p.id,
                "title": p.title,
                "author": username,
                "author_id": p.author_id,
                "is_pinned": p.is_pinned,
                "view_count": p.view_count,
                "video_url": p.video_url,
                "created_at": p.created_at.isoformat(),
                **({"thumbnail": thumbnails[p.id]} if p.id in thumbnails else {}),
            }
            for p, username in posts
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/{board_type}/{post_id}")
def get_post(
    board_type: str,
    post_id: int,
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    post = session.exec(
        select(Post).where(Post.id == post_id, Post.board_type == board_type)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.view_count += 1
    session.add(post)
    session.commit()
    session.refresh(post)

    author = session.get(User, post.author_id)

    from models import FileRecord
    files = session.exec(
        select(FileRecord).where(FileRecord.post_id == post.id)
    ).all()

    return {
        "id": post.id,
        "board_type": post.board_type,
        "title": post.title,
        "content": post.content,
        "author": author.username if author else "unknown",
        "author_id": post.author_id,
        "is_pinned": post.is_pinned,
        "view_count": post.view_count,
        "video_url": post.video_url,
        "created_at": post.created_at.isoformat(),
        "updated_at": post.updated_at.isoformat(),
        "files": [
            {
                "id": f.id,
                "original_name": f.original_name,
                "stored_path": f.stored_path,
                "file_type": f.file_type,
                "file_size": f.file_size,
            }
            for f in files
        ],
    }


@router.post("/{board_type}", status_code=201)
def create_post(
    board_type: str,
    body: PostCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)

    if board_type == "notice" and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required for notice board")

    post = Post(
        board_type=board_type,
        title=body.title,
        content=body.content,
        author_id=user.id,
        video_url=body.video_url,
        is_pinned=body.is_pinned if user.role in ("admin", "superadmin") else False,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return {"id": post.id, "title": post.title}


@router.put("/{board_type}/{post_id}")
def update_post(
    board_type: str,
    post_id: int,
    body: PostUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    post = session.exec(
        select(Post).where(Post.id == post_id, Post.board_type == board_type)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.author_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    if body.title is not None:
        post.title = body.title
    if body.content is not None:
        post.content = body.content
    if body.video_url is not None:
        post.video_url = body.video_url
    if body.is_pinned is not None and user.role in ("admin", "superadmin"):
        post.is_pinned = body.is_pinned
    post.updated_at = datetime.now()

    session.add(post)
    session.commit()
    session.refresh(post)
    return {"id": post.id, "title": post.title}


@router.delete("/{board_type}/{post_id}")
def delete_post(
    board_type: str,
    post_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    post = session.exec(
        select(Post).where(Post.id == post_id, Post.board_type == board_type)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.author_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Cascade delete: Post 삭제 시 comments, files 자동 삭제 (모델 Relationship 설정)
    session.delete(post)
    session.commit()
    return {"status": "deleted"}
