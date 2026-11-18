"""Preset media for administrators only.

Files live on the server under UPLOAD_DIR/_private/presets/<preset_id>/ and never in the
repository. The public preset pages are open to everyone, so every file here requires an
administrator token; the public /uploads route refuses the _private folder.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from deps import require_admin
from models import User
from upload_paths import get_uploads_dir, resolve_private_media

router = APIRouter()

# Explicit map instead of mimetypes: the OS registry must not decide what a browser sniffs.
_MEDIA_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".json": "application/json",
}


@router.get("/media/{preset_id}/{filename}")
def get_preset_media(preset_id: str, filename: str, _admin: User = Depends(require_admin)):
    path = resolve_private_media(get_uploads_dir(), preset_id, filename)
    if path is None:
        # Same answer for a bad name, a missing folder and a missing file.
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        path,
        media_type=_MEDIA_TYPES[Path(filename).suffix.lower()],
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            # The name passed the strict pattern in resolve_private_media, so it is safe to quote.
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )
