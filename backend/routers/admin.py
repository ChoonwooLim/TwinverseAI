from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from database import get_session
from models import User
from deps import require_admin

router = APIRouter()


@router.get("/dashboard")
def admin_dashboard(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    total_users = session.exec(select(func.count(User.id))).one()
    active_users = session.exec(select(func.count(User.id)).where(User.is_active == True)).one()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "admin": admin.username,
    }


@router.get("/users")
def list_users(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [
        {"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_active": u.is_active}
        for u in users
    ]
