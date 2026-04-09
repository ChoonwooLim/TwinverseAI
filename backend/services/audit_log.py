"""보안 감사 로깅 — 인증/관리자 이벤트를 구조화된 로그로 기록."""
import logging
from datetime import datetime

logger = logging.getLogger("twinverse.audit")
logger.setLevel(logging.INFO)

# 콘솔 핸들러 (Docker에서 stdout으로 수집)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "[%(asctime)s] AUDIT %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(handler)


def log_auth(event: str, username: str, ip: str, success: bool, detail: str = ""):
    """인증 이벤트 로깅 (login, register, token_refresh)."""
    status = "OK" if success else "FAIL"
    logger.info(f"event={event} user={username} ip={ip} status={status} detail={detail}")


def log_admin(event: str, admin_username: str, target: str = "", detail: str = ""):
    """관리자 작업 로깅 (role_change, user_delete, etc.)."""
    logger.info(f"event={event} admin={admin_username} target={target} detail={detail}")
