import os
import secrets
import logging
from datetime import datetime, timedelta
import bcrypt
from jose import jwt, JWTError

logger = logging.getLogger("twinverse.auth")

_env_key = os.getenv("SECRET_KEY", "").strip()
if not _env_key:
    SECRET_KEY = secrets.token_urlsafe(64)
    logger.warning("SECRET_KEY not set — generated ephemeral key. Tokens will NOT survive restarts. Set SECRET_KEY in env.")
elif len(_env_key) < 32:
    SECRET_KEY = _env_key
    logger.warning("SECRET_KEY is too short (< 32 chars). Use `python -c \"import secrets; print(secrets.token_urlsafe(64))\"` to generate a strong key.")
else:
    SECRET_KEY = _env_key

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8시간 (24h → 8h 단축)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    # python-jose requires "sub" to be a string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
