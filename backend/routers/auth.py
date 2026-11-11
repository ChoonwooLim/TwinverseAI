from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import User
from services.auth_service import hash_password, verify_password, create_access_token
from services.auth_devices import (
    REMEMBER_COOKIE,
    clear_remember_cookie,
    issue_device_token,
    resolve_device,
    revoke_device,
    set_remember_cookie,
    touch_device,
)
from deps import get_current_user
from services.audit_log import log_auth
from rate_limit import limiter

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str
    # "이 기기에서 로그인 유지" — on by default so a signed-in PC stays signed in.
    remember: bool = True


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    remember: bool = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token({"sub": user.id, "role": user.role}),
        user={"id": user.id, "username": user.username, "role": user.role},
    )


def _remember(session: Session, user: User, request: Request, response: Response, remember: bool) -> None:
    if remember:
        set_remember_cookie(response, issue_device_token(session, user.id, request))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, response: Response, body: LoginRequest, session: Session = Depends(get_session)):
    client_ip = request.client.host if request.client else "unknown"
    user = session.exec(select(User).where(User.username == body.username)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        log_auth("login", body.username, client_ip, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    log_auth("login", user.username, client_ip, success=True)
    _remember(session, user, request, response, body.remember)
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh(request: Request, response: Response, session: Session = Depends(get_session)):
    """Mint a fresh access token for a remembered device (HttpOnly cookie)."""
    device = resolve_device(session, request.cookies.get(REMEMBER_COOKIE))
    user = session.get(User, device.user_id) if device else None
    if not device or not user or not user.is_active:
        rejected = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Device session expired"},
        )
        clear_remember_cookie(rejected)
        return rejected
    touch_device(session, device)
    # Re-issue the same cookie so the browser-side expiry slides too.
    set_remember_cookie(response, request.cookies[REMEMBER_COOKIE])
    return _token_response(user)


@router.post("/logout")
def logout(request: Request, response: Response, session: Session = Depends(get_session)):
    """Forget this device. Works without a valid access token."""
    revoke_device(session, request.cookies.get(REMEMBER_COOKIE))
    clear_remember_cookie(response)
    return {"ok": True}


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/minute")
def register(request: Request, response: Response, body: RegisterRequest, session: Session = Depends(get_session)):
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
    _remember(session, user, request, response, body.remember)
    return _token_response(user)


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role}
