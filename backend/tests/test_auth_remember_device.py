"""'이 기기에서 로그인 유지' — refresh 쿠키 기반 자동 로그인 회귀 테스트.

접속 토큰(JWT)은 8시간 그대로 두고, 로그인한 기기에 HttpOnly 쿠키로
장기 기기 토큰을 발급해 만료 시 조용히 재발급하는 흐름을 검증한다.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import models  # noqa: F401  (registers every table on SQLModel.metadata)
from database import get_session
from models import User
from models.auth_device import AuthDevice
from rate_limit import limiter
from routers import auth
from services.auth_devices import REMEMBER_COOKIE, REMEMBER_COOKIE_PATH, hash_device_token
from services.auth_service import decode_access_token, hash_password

PASSWORD = "correct horse battery staple"


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture()
def client(engine):
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router, prefix="/api/auth")

    def _session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _session
    limiter.enabled = False
    # Secure 쿠키는 https 에서만 왕복하므로 실제 운영과 같은 https 로 테스트.
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    limiter.enabled = True


@pytest.fixture()
def user(engine):
    with Session(engine) as s:
        u = User(username="steven", email="s@example.com", hashed_password=hash_password(PASSWORD), role="admin")
        s.add(u)
        s.commit()
        s.refresh(u)
        return u.id


def _login(client, **extra):
    return client.post("/api/auth/login", json={"username": "steven", "password": PASSWORD, **extra})


def _devices(engine):
    with Session(engine) as s:
        return s.exec(select(AuthDevice)).all()


def _set_cookie_header(resp) -> str:
    headers = [v for k, v in resp.headers.multi_items() if k.lower() == "set-cookie"]
    matching = [h for h in headers if h.startswith(f"{REMEMBER_COOKIE}=")]
    assert matching, f"no {REMEMBER_COOKIE} cookie in {headers}"
    return matching[-1]


def test_login_remembers_device_with_hardened_cookie(client, engine, user):
    resp = _login(client, remember=True)
    assert resp.status_code == 200

    header = _set_cookie_header(resp)
    lowered = header.lower()
    assert "httponly" in lowered
    assert "secure" in lowered
    assert "samesite=lax" in lowered
    assert f"path={REMEMBER_COOKIE_PATH}".lower() in lowered
    assert "max-age=" in lowered

    raw = client.cookies.get(REMEMBER_COOKIE)
    devices = _devices(engine)
    assert len(devices) == 1
    # 원문 토큰은 DB에 남기지 않는다 — 해시만 저장.
    assert devices[0].token_hash == hash_device_token(raw)
    assert devices[0].token_hash != raw
    assert devices[0].user_id == user


def test_login_remembers_device_by_default(client, engine, user):
    resp = _login(client)
    assert resp.status_code == 200
    assert client.cookies.get(REMEMBER_COOKIE)
    assert len(_devices(engine)) == 1


def test_login_without_remember_issues_no_device(client, engine, user):
    resp = _login(client, remember=False)
    assert resp.status_code == 200
    assert client.cookies.get(REMEMBER_COOKIE) is None
    assert _devices(engine) == []


def test_refresh_issues_new_access_token_and_slides_expiry(client, engine, user):
    _login(client)
    before = _devices(engine)[0].expires_at

    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 200
    data = resp.json()
    payload = decode_access_token(data["access_token"])
    assert payload and payload["sub"] == str(user)
    assert data["user"] == {"id": user, "username": "steven", "role": "admin"}
    # 쿠키 만료도 함께 연장 (브라우저 측 슬라이딩)
    _set_cookie_header(resp)

    after = _devices(engine)[0].expires_at
    assert after >= before


def test_refresh_reflects_current_role(client, engine, user):
    _login(client)
    with Session(engine) as s:
        u = s.get(User, user)
        u.role = "user"
        s.add(u)
        s.commit()

    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "user"
    assert decode_access_token(resp.json()["access_token"])["role"] == "user"


def test_refresh_without_cookie_is_rejected(client, user):
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401


def test_refresh_with_unknown_cookie_is_rejected(client, user):
    client.cookies.set(REMEMBER_COOKIE, "forged-value", domain="testserver", path=REMEMBER_COOKIE_PATH)
    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401


def test_refresh_with_expired_device_is_rejected_and_cookie_cleared(client, engine, user):
    _login(client)
    with Session(engine) as s:
        d = s.exec(select(AuthDevice)).one()
        d.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        s.add(d)
        s.commit()

    resp = client.post("/api/auth/refresh")
    assert resp.status_code == 401
    header = _set_cookie_header(resp).lower()
    assert "max-age=0" in header or "expires=thu, 01 jan 1970" in header


def test_refresh_for_deactivated_user_is_rejected(client, engine, user):
    _login(client)
    with Session(engine) as s:
        u = s.get(User, user)
        u.is_active = False
        s.add(u)
        s.commit()

    assert client.post("/api/auth/refresh").status_code == 401


def test_logout_revokes_device(client, engine, user):
    _login(client)
    raw = client.cookies.get(REMEMBER_COOKIE)

    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert _devices(engine)[0].revoked_at is not None

    # 쿠키를 훔쳐 다시 보내도 폐기된 기기는 재발급 불가
    client.cookies.set(REMEMBER_COOKIE, raw, domain="testserver", path=REMEMBER_COOKIE_PATH)
    assert client.post("/api/auth/refresh").status_code == 401


def test_logout_without_cookie_is_harmless(client, user):
    assert client.post("/api/auth/logout").status_code == 200


def test_new_login_prunes_dead_devices_of_same_user(client, engine, user):
    _login(client)
    client.post("/api/auth/logout")
    client.cookies.clear()
    _login(client)

    devices = _devices(engine)
    assert len(devices) == 1
    assert devices[0].revoked_at is None
