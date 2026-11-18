"""Administrator-only preset media and the hardened public /uploads resolver.

The preset pages are public and the repository is public, so the media files (third-party
footage, a child's face) must only ever leave the server for an administrator token.

HTTP checks use httpx.ASGITransport instead of fastapi.testclient.TestClient: the installed
starlette 0.35 TestClient passes `app=` to httpx.Client, which httpx 0.28 removed.
"""
import asyncio
import os
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import models  # noqa: F401  (registers every table on SQLModel.metadata)
from database import get_session
from models import User
from routers import presets
from services.auth_service import create_access_token, hash_password
from upload_paths import PRIVATE_SEGMENT, resolve_private_media, resolve_public_upload

PRESET = "cine-recast-dragon-rider"
VIDEO_BYTES = b"\x00\x00\x00\x18ftypmp42 fixture video bytes"
POSTER_BYTES = b"\xff\xd8\xff\xe0 fixture poster bytes"
NOTES_BYTES = '[{"title": "메모", "body": "본문"}]'.encode("utf-8")


# ── fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture()
def uploads(tmp_path, monkeypatch):
    root = tmp_path / "uploads"
    media = root / PRIVATE_SEGMENT / "presets" / PRESET
    media.mkdir(parents=True)
    (media / "final.mp4").write_bytes(VIDEO_BYTES)
    (media / "final-poster.jpg").write_bytes(POSTER_BYTES)
    (media / "notes.json").write_bytes(NOTES_BYTES)
    (root / "top.jpg").write_bytes(b"top")
    (root / "nested" / "deeper").mkdir(parents=True)
    (root / "nested" / "deeper" / "file.png").write_bytes(b"nested")
    # A file just outside the uploads folder, the target of every escape attempt.
    (tmp_path / "secret.txt").write_text("outside")
    monkeypatch.setenv("UPLOAD_DIR", str(root))
    return root


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
def app(engine):
    application = FastAPI()
    application.include_router(presets.router, prefix="/api/presets")

    def _session():
        with Session(engine) as s:
            yield s

    application.dependency_overrides[get_session] = _session
    return application


@pytest.fixture()
def tokens(engine):
    """One access token per role, made with the project's own helper."""
    issued = {}
    with Session(engine) as s:
        for role in ("user", "admin", "superadmin"):
            u = User(
                username=f"{role}-fixture",
                email=f"{role}@example.com",
                hashed_password=hash_password("fixture password"),
                role=role,
            )
            s.add(u)
            s.commit()
            s.refresh(u)
            issued[role] = create_access_token({"sub": u.id})
    return issued


def _get(app, url, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    async def go():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.get(url, headers=headers)

    return asyncio.run(go())


def _symlink(link: Path, target: Path, *, directory=False):
    try:
        os.symlink(target, link, target_is_directory=directory)
    except (OSError, NotImplementedError) as exc:
        pytest.skip(f"cannot create symlinks on this platform: {exc}")


# ── resolve_public_upload ─────────────────────────────────────────────────


def test_public_accepts_top_level_and_nested_files(uploads):
    assert resolve_public_upload(uploads, "top.jpg") == (uploads / "top.jpg").resolve()
    nested = resolve_public_upload(uploads, "nested/deeper/file.png")
    assert nested == (uploads / "nested" / "deeper" / "file.png").resolve()


@pytest.mark.parametrize(
    "name",
    [
        "../secret.txt",
        "a/../../secret.txt",
        "nested/../../secret.txt",
        "",
        "nested",
        "nested/deeper",
        "missing.jpg",
        f"{PRIVATE_SEGMENT}/presets/{PRESET}/final.mp4",
        f"x/../{PRIVATE_SEGMENT}/presets/{PRESET}/final.mp4",
        f"_PRIVATE/presets/{PRESET}/final.mp4",
        f"_Private/presets/{PRESET}/final.mp4",
        f"nested\\..\\{PRIVATE_SEGMENT}\\presets\\{PRESET}\\final.mp4",
        "top.jpg\x00.png",
    ],
)
def test_public_refuses_escapes_directories_and_private(uploads, name):
    assert resolve_public_upload(uploads, name) is None


def test_public_refuses_absolute_paths(uploads, tmp_path):
    secret = tmp_path / "secret.txt"
    assert resolve_public_upload(uploads, str(secret)) is None
    assert resolve_public_upload(uploads, str(secret.resolve()).replace("\\", "/")) is None
    assert resolve_public_upload(uploads, "/etc/passwd") is None
    assert resolve_public_upload(uploads, "C:/Windows/win.ini") is None
    assert resolve_public_upload(uploads, "\\\\server\\share\\x.jpg") is None


def test_public_refuses_symlink_to_a_file_outside(uploads, tmp_path):
    _symlink(uploads / "link.txt", tmp_path / "secret.txt")
    assert resolve_public_upload(uploads, "link.txt") is None


def test_public_refuses_symlinked_folder_outside(uploads, tmp_path):
    outside = tmp_path / "outside-dir"
    outside.mkdir()
    (outside / "x.jpg").write_bytes(b"x")
    _symlink(uploads / "linkdir", outside, directory=True)
    assert resolve_public_upload(uploads, "linkdir/x.jpg") is None


def test_public_refuses_symlink_into_private(uploads):
    _symlink(uploads / "alias", uploads / PRIVATE_SEGMENT, directory=True)
    assert resolve_public_upload(uploads, f"alias/presets/{PRESET}/final.mp4") is None


# ── resolve_private_media ─────────────────────────────────────────────────


def test_private_accepts_a_valid_file(uploads):
    expected = (uploads / PRIVATE_SEGMENT / "presets" / PRESET / "final.mp4").resolve()
    assert resolve_private_media(uploads, PRESET, "final.mp4") == expected
    assert resolve_private_media(uploads, PRESET, "notes.json") is not None
    assert resolve_private_media(uploads, PRESET, "final-poster.jpg") is not None


@pytest.mark.parametrize("preset_id", ["../x", "..", "A", "a_b", "", "a" * 81, "a--b", "-a", "a-", "a/b", "a\n"])
def test_private_refuses_bad_preset_ids(uploads, preset_id):
    assert resolve_private_media(uploads, preset_id, "final.mp4") is None


def test_private_accepts_ids_up_to_80_characters(uploads):
    long_id = "a" * 80
    (uploads / PRIVATE_SEGMENT / "presets" / long_id).mkdir()
    (uploads / PRIVATE_SEGMENT / "presets" / long_id / "final.mp4").write_bytes(b"x")
    assert resolve_private_media(uploads, long_id, "final.mp4") is not None


@pytest.mark.parametrize(
    "filename",
    [".hidden.mp4", "a/b.mp4", "a\\b.mp4", "..", "final.exe", "final", "final.mp4.exe", "final.mp4\n", "", "x" * 101 + ".mp4"],
)
def test_private_refuses_bad_file_names(uploads, filename):
    assert resolve_private_media(uploads, PRESET, filename) is None


def test_private_refuses_missing_file_and_missing_folder(uploads, tmp_path):
    assert resolve_private_media(uploads, PRESET, "compare.mp4") is None
    assert resolve_private_media(uploads, "other-preset", "final.mp4") is None
    empty = tmp_path / "empty-uploads"
    empty.mkdir()
    assert resolve_private_media(empty, PRESET, "final.mp4") is None


def test_private_refuses_symlink_leaving_the_presets_folder(uploads, tmp_path):
    _symlink(uploads / PRIVATE_SEGMENT / "presets" / PRESET / "leak.json", tmp_path / "secret.txt")
    assert resolve_private_media(uploads, PRESET, "leak.json") is None


# ── GET /api/presets/media/{preset_id}/{filename} ─────────────────────────

MEDIA_URL = f"/api/presets/media/{PRESET}/final.mp4"


def test_media_without_token_is_refused(app, uploads):
    resp = _get(app, MEDIA_URL)
    assert resp.status_code in (401, 403)
    assert VIDEO_BYTES not in resp.content


def test_media_with_bad_token_is_refused(app, uploads):
    resp = _get(app, MEDIA_URL, token="not-a-real-token")
    assert resp.status_code in (401, 403)
    assert VIDEO_BYTES not in resp.content


def test_media_for_role_user_is_forbidden(app, uploads, tokens):
    resp = _get(app, MEDIA_URL, token=tokens["user"])
    assert resp.status_code == 403
    assert VIDEO_BYTES not in resp.content


def test_non_admin_cannot_probe_which_files_exist(app, uploads, tokens):
    existing = _get(app, MEDIA_URL, token=tokens["user"])
    missing = _get(app, f"/api/presets/media/{PRESET}/nothing.mp4", token=tokens["user"])
    assert existing.status_code == missing.status_code == 403
    assert existing.json() == missing.json()


@pytest.mark.parametrize("role", ["admin", "superadmin"])
def test_media_for_admins_returns_exact_bytes_with_private_headers(app, uploads, tokens, role):
    resp = _get(app, MEDIA_URL, token=tokens[role])
    assert resp.status_code == 200
    assert resp.content == VIDEO_BYTES
    assert resp.headers["content-type"] == "video/mp4"
    assert "no-store" in resp.headers["cache-control"]
    assert "private" in resp.headers["cache-control"]
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["content-disposition"].startswith("inline")


def test_media_serves_poster_and_notes_with_their_types(app, uploads, tokens):
    poster = _get(app, f"/api/presets/media/{PRESET}/final-poster.jpg", token=tokens["admin"])
    assert poster.status_code == 200
    assert poster.content == POSTER_BYTES
    assert poster.headers["content-type"] == "image/jpeg"

    notes = _get(app, f"/api/presets/media/{PRESET}/notes.json", token=tokens["admin"])
    assert notes.status_code == 200
    assert notes.headers["content-type"].startswith("application/json")
    assert notes.json() == [{"title": "메모", "body": "본문"}]


def test_missing_file_and_missing_folder_get_the_same_404(app, uploads, tokens):
    missing_file = _get(app, f"/api/presets/media/{PRESET}/compare.mp4", token=tokens["admin"])
    missing_folder = _get(app, "/api/presets/media/no-such-preset/final.mp4", token=tokens["admin"])
    bad_name = _get(app, f"/api/presets/media/{PRESET}/final.exe", token=tokens["admin"])
    assert missing_file.status_code == missing_folder.status_code == bad_name.status_code == 404
    assert missing_file.json() == missing_folder.json() == bad_name.json()


@pytest.mark.parametrize(
    "path",
    [
        "/api/presets/media/%2e%2e/final.mp4",
        f"/api/presets/media/%2e%2e/{PRESET}/final.mp4",
        f"/api/presets/media/{PRESET}/%2e%2e",
        "/api/presets/media/%2e%2e/%2e%2e/secret.txt",
        f"/api/presets/media/{PRESET}/%2e%2e%2f%2e%2e%2f%2e%2e%2fsecret.txt",
        f"/api/presets/media/{PRESET}/..%5c..%5c..%5csecret.txt",
        "/api/presets/media/%2e%2e%2f%2e%2e%2f%2e%2e/secret.txt",
        f"/api/presets/media/{PRESET.upper()}/final.mp4",
    ],
)
def test_traversal_attempts_never_succeed(app, uploads, tokens, path):
    resp = _get(app, path, token=tokens["admin"])
    assert resp.status_code in (404, 422)
    assert b"outside" not in resp.content
    assert VIDEO_BYTES not in resp.content
