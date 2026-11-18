"""Where uploads live and which files under that directory may be served.

Pure functions with no FastAPI imports, so the path rules can be unit-tested directly.

Layout:
    <uploads>/...                                  public, served by GET /uploads/{path}
    <uploads>/_private/presets/<preset_id>/<file>  administrators only, served by
                                                   GET /api/presets/media/{preset_id}/{file}
"""
import os
import re
from pathlib import Path, PurePosixPath, PureWindowsPath

PRIVATE_SEGMENT = "_private"

_PRESET_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_PRESET_ID_MAX_LEN = 80
_MEDIA_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
MEDIA_SUFFIXES = (".mp4", ".webm", ".jpg", ".jpeg", ".png", ".webp", ".json")


def get_uploads_dir() -> Path:
    """업로드 디렉토리 결정: UPLOAD_DIR (Docker) > 프로젝트루트/uploads (로컬)"""
    env_val = os.getenv("UPLOAD_DIR", "").strip()
    if env_val:
        d = Path(env_val)
    else:
        d = Path(__file__).resolve().parent.parent / "uploads"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _resolve_inside(root: Path, candidate: Path) -> Path | None:
    """Resolve `candidate` (following symlinks) and return it only if it is an existing
    regular file inside the resolved `root`."""
    try:
        root_resolved = root.resolve(strict=True)
        resolved = candidate.resolve(strict=True)
    except (OSError, RuntimeError, ValueError):
        # Missing file, symlink loop, NUL byte or another name the OS refuses.
        return None
    if not resolved.is_relative_to(root_resolved) or resolved == root_resolved:
        return None
    if not resolved.is_file():
        return None
    return resolved


def _is_private(parts) -> bool:
    return any(part.lower() == PRIVATE_SEGMENT for part in parts)


def resolve_public_upload(uploads_dir: Path, filename: str) -> Path | None:
    """Map a public /uploads/{filename} request to a file, or None when it must not be served.

    Refused: empty or absolute names, anything that resolves outside `uploads_dir` (via `..`
    or a symlink), directories, missing files, and anything under a `_private` segment
    (case-insensitive, checked on the request and on the resolved path).
    """
    if not isinstance(filename, str) or not filename or "\x00" in filename:
        return None
    if PurePosixPath(filename).is_absolute() or PureWindowsPath(filename).anchor:
        return None
    requested_parts = re.split(r"[\\/]", filename)
    if _is_private(requested_parts):
        return None

    resolved = _resolve_inside(uploads_dir, uploads_dir / filename)
    if resolved is None:
        return None
    # A symlink or an OS name alias (trailing dot, short name) could still land in _private.
    if _is_private(resolved.relative_to(uploads_dir.resolve()).parts):
        return None
    return resolved


def resolve_private_media(uploads_dir: Path, preset_id: str, filename: str) -> Path | None:
    """Map an administrator media request to uploads_dir/_private/presets/<preset_id>/<filename>,
    or None when the names are invalid or the file does not exist there."""
    if not isinstance(preset_id, str) or not isinstance(filename, str):
        return None
    if len(preset_id) > _PRESET_ID_MAX_LEN or not _PRESET_ID_RE.fullmatch(preset_id):
        return None
    if not _MEDIA_NAME_RE.fullmatch(filename) or not filename.lower().endswith(MEDIA_SUFFIXES):
        return None

    presets_root = uploads_dir / PRIVATE_SEGMENT / "presets"
    return _resolve_inside(presets_root, presets_root / preset_id / filename)
