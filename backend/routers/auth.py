from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import User
from services.auth_service import hash_password, verify_password, create_access_token
from deps import get_current_user
from services.audit_log import log_auth
from rate_limit import limiter

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, session: Session = Depends(get_session)):
    client_ip = request.client.host if request.client else "unknown"
    user = session.exec(select(User).where(User.username == body.username)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        log_auth("login", body.username, client_ip, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    log_auth("login", user.username, client_ip, success=True)
    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role},
    )


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, session: Session = Depends(get_session)):
    client_ip = request.client.host if request.client else "unknown"
    existing = session.exec(
        select(User).where((User.username == body.username) | (User.email == body.email))
    ).first()
    if existing:
        log_auth("register", body.username, client_ip, success=False, detail="duplicate")
        raise HTTPException(status_code=400, detail="Username or email already exists")
    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    log_auth("register", user.username, client_ip, success=True)
    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role},
    )


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role}
