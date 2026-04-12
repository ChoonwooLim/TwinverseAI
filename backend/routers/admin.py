# backend/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func, col
from database import get_session
from models import User, Post, Comment
from deps import require_admin
from services.audit_log import log_admin

router = APIRouter()


# --- Stats ---

@router.get("/stats")
def admin_stats(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    total_users = session.exec(select(func.count(User.id))).one()
    active_users = session.exec(
        select(func.count(User.id)).where(User.is_active == True)
    ).one()
    total_posts = session.exec(select(func.count(Post.id))).one()
    total_comments = session.exec(select(func.count(Comment.id))).one()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_posts": total_posts,
        "total_comments": total_comments,
        "admin": admin.username,
    }


# Keep legacy endpoint for backward compat
@router.get("/dashboard")
def admin_dashboard(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    return admin_stats(admin, session)


# --- User Management ---

@router.get("/users")
def list_users(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    users = session.exec(select(User).order_by(col(User.id))).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


class RoleUpdate(BaseModel):
    role: str  # "user" | "admin" | "superadmin"


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: RoleUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    if body.role not in ("user", "admin", "superadmin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role == "superadmin" and admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="Only superadmin can assign superadmin role")
    old_role = user.role
    user.role = body.role
    session.add(user)
    session.commit()
    log_admin("role_change", admin.username, target=user.username, detail=f"{old_role}->{body.role}")
    return {"id": user.id, "role": user.role}


class ActiveUpdate(BaseModel):
    is_active: bool


@router.put("/users/{user_id}/active")
def update_user_active(
    user_id: int,
    body: ActiveUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Lockout guards (2026-04-12): admin 계정이 is_active=False 로 깨져
    # 로그인은 되는데 /me 가 401 을 뱉는 사건 재발 방지.
    if body.is_active is False:
        # 1) 자기 자신 비활성화 금지 — 즉시 락아웃됨
        if user.id == admin.id:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        # 2) 마지막 활성 superadmin 비활성화 금지 — 시스템에서 모든 superadmin 접근 상실
        if user.role == "superadmin" and user.is_active:
            active_superadmins = session.exec(
                select(func.count(User.id)).where(
                    User.role == "superadmin", User.is_active == True
                )
            ).one()
            if active_superadmins <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deactivate the last active superadmin",
                )

    user.is_active = body.is_active
    session.add(user)
    session.commit()
    log_admin("active_change", admin.username, target=user.username, detail=f"is_active={body.is_active}")
    return {"id": user.id, "is_active": user.is_active}


# --- Board Management (all posts across boards) ---

@router.get("/posts")
def list_all_posts(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    offset = (page - 1) * size
    total = session.exec(select(func.count(Post.id))).one()
    posts = session.exec(
        select(Post, User.username)
        .join(User, col(Post.author_id) == col(User.id))
        .order_by(col(Post.created_at).desc())
        .offset(offset)
        .limit(size)
    ).all()
    return {
        "items": [
            {
                "id": p.id,
                "board_type": p.board_type,
                "title": p.title,
                "author": username,
                "view_count": p.view_count,
                "created_at": p.created_at.isoformat(),
            }
            for p, username in posts
        ],
        "total": total,
        "page": page,
        "size": size,
    }
