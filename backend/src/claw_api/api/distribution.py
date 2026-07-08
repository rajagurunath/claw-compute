"""Worker distribution — serve the installer script and release tarballs.

Mounted at the app root (not under /v1) because `worker/install.sh` expects
`${API_URL}/install.sh` and pulls tarballs from `${API_URL}/releases/...`.
In dev these come from the locally-built worker (see scripts/package-worker.sh);
in prod `releases_dir` points at signed/notarized artifacts.
"""

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from claw_api.config import get_settings

router = APIRouter(tags=["distribution"])

# Only the exact artifact shape the installer requests. Forbids path separators
# and traversal by construction (no `/`, no `..`).
_RELEASE_RE = re.compile(r"^claw-worker-[\w.\-]+-aarch64-apple-darwin\.tar\.gz$")


@router.get("/install.sh")
async def install_script() -> PlainTextResponse:
    settings = get_settings()
    path = Path(settings.worker_install_script)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="installer not available")
    return PlainTextResponse(path.read_text(), media_type="text/x-shellscript")


@router.get("/releases/{filename}")
async def release(filename: str) -> FileResponse:
    if not _RELEASE_RE.match(filename):
        raise HTTPException(status_code=400, detail="invalid release name")

    settings = get_settings()
    releases_dir = Path(settings.releases_dir).resolve()
    target = (releases_dir / filename).resolve()

    # Belt-and-suspenders containment check against traversal.
    if releases_dir not in target.parents:
        raise HTTPException(status_code=400, detail="invalid release path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="release not found")

    return FileResponse(target, media_type="application/gzip", filename=filename)
