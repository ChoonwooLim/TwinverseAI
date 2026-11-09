"""SPA routing and a persistent, bounded archive of content-hashed build assets."""
from dataclasses import dataclass
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
import time
from typing import Optional


NO_STORE = "no-store, no-cache, must-revalidate, max-age=0"
IMMUTABLE = "public, max-age=31536000, immutable"
RETENTION_SECONDS = 30 * 86400
_HASHED_ASSET = re.compile(
    r"^[^.][^/\\]*-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|eot|"
    r"png|jpe?g|gif|svg|webp|avif|ico|mp4|webm|mp3|ogg|wav|wasm)$"
)


@dataclass(frozen=True)
class StaticResult:
    path: Optional[Path]
    cache_control: str = NO_STORE


def _safe_path(root: Path, relative: str) -> Optional[Path]:
    """Reject traversal, hidden paths, Windows aliases and escaping symlinks."""
    if "\\" in relative or ":" in relative or "\x00" in relative:
        return None
    parts = relative.split("/")
    if relative.startswith("/") or any(part.startswith(".") for part in parts):
        return None
    if root.is_symlink():
        return None
    candidate = root.joinpath(*parts)
    try:
        candidate.resolve().relative_to(root.resolve())
    except (ValueError, OSError, RuntimeError):
        return None
    if candidate.is_symlink():
        return None
    return candidate


class FrontendStatic:
    def __init__(self, static_dir: Path, archive_dir: Path):
        self.static_dir = Path(static_dir).absolute()
        self.archive_dir = Path(archive_dir).absolute()

    def resolve(self, full_path: str) -> StaticResult:
        candidate = _safe_path(self.static_dir, full_path)
        if candidate is None:
            return StaticResult(None)
        parts = PurePosixPath(full_path).parts
        if parts and parts[0] in {"api", "uploads"}:
            return StaticResult(None)
        is_asset = bool(parts and parts[0] == "assets")
        is_hashed = is_asset and bool(_HASHED_ASSET.fullmatch(candidate.name))
        if candidate.is_file():
            return StaticResult(candidate, IMMUTABLE if is_hashed else NO_STORE)
        if is_hashed:
            relative = PurePosixPath(*parts[1:]).as_posix()
            archived = _safe_path(self.archive_dir, relative)
            if archived is not None and archived.is_file():
                if archived.stat().st_mtime >= time.time() - RETENTION_SECONDS:
                    return StaticResult(archived, IMMUTABLE)
        # A missing script/image/API must never receive index.html with HTTP 200.
        if is_asset or candidate.suffix:
            return StaticResult(None)
        index = _safe_path(self.static_dir, "index.html")
        return StaticResult(index if index is not None and index.is_file() else None)

    def archive_current_assets(self) -> None:
        """Save only build assets; never copy HTML, source maps or user uploads.

        Archive layout: UPLOAD_DIR/.frontend-assets/<path relative to assets/>.
        mtime records the last deployment containing a file, not its build time.
        Expired files are denied on reads and pruned on the next startup.
        """
        if self.archive_dir.is_symlink():
            raise ValueError("Frontend asset archive must not be a symlink")
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        assets = self.static_dir / "assets"
        if assets.is_dir() and not assets.is_symlink():
            for source in assets.rglob("*"):
                if not _HASHED_ASSET.fullmatch(source.name):
                    continue
                relative = source.relative_to(assets).as_posix()
                safe_source = _safe_path(assets, relative)
                target = _safe_path(self.archive_dir, relative)
                if safe_source is None or not safe_source.is_file() or target is None:
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                # Atomic replacement avoids partial chunks during rolling starts.
                with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".asset-", delete=False) as handle:
                    temporary = Path(handle.name)
                try:
                    shutil.copyfile(safe_source, temporary)
                    os.replace(temporary, target)
                finally:
                    temporary.unlink(missing_ok=True)
        cutoff = time.time() - RETENTION_SECONDS
        for entry in self.archive_dir.rglob("*"):
            if not _HASHED_ASSET.fullmatch(entry.name):
                continue
            safe_entry = _safe_path(self.archive_dir, entry.relative_to(self.archive_dir).as_posix())
            if safe_entry is not None and safe_entry.is_file() and safe_entry.stat().st_mtime < cutoff:
                safe_entry.unlink()
