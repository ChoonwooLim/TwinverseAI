# backend/routers/comments.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, col
from database import get_session
from models import Comment, User
from deps import get_current_user

router = APIRouter()


class CommentCreate(BaseModel):
    content: str


@router.get("/{post_id}")
def list_comments(post_id: int, session: Session = Depends(get_session)):
    results = session.exec(
        select(Comment, User.username)
        .join(User, col(Comment.author_id) == col(User.id))
        .where(Comment.post_id == post_id)
        .order_by(col(Comment.created_at).asc())
    ).all()

    return [
        {
            "id": c.id,
            "content": c.content,
            "author": username,
            "author_id": c.author_id,
            "created_at": c.created_at.isoformat(),
        }
        for c, username in results
    ]


@router.post("/{post_id}", status_code=201)
def create_comment(
    post_id: int,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from models import Post

    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = Comment(
        post_id=post_id,
        author_id=user.id,
        content=body.content,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return {"id": comment.id, "content": comment.content}


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    comment = session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    session.delete(comment)
    session.commit()
    return {"status": "deleted"}
