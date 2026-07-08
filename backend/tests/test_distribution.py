"""Worker distribution routes: installer script + release tarballs.

These endpoints don't touch the DB, so we drive the ASGI app directly rather
than using the db-backed `client` fixture.
"""

import io
import tarfile

import pytest
from httpx import ASGITransport, AsyncClient

from claw_api.config import get_settings
from claw_api.main import create_app

VALID_NAME = "claw-worker-latest-aarch64-apple-darwin.tar.gz"


@pytest.fixture
async def dist_client(tmp_path, monkeypatch):
    """App wired to a temp releases dir + a stub install script."""
    settings = get_settings()

    script = tmp_path / "install.sh"
    script.write_text("#!/usr/bin/env bash\necho claw-worker installer\n")

    releases = tmp_path / "dist"
    releases.mkdir()
    tarball = releases / VALID_NAME
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        data = b"fake-binary"
        info = tarfile.TarInfo(name="claw-worker")
        info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
    tarball.write_bytes(buf.getvalue())

    monkeypatch.setattr(settings, "worker_install_script", str(script))
    monkeypatch.setattr(settings, "releases_dir", str(releases))

    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_install_script_served(dist_client):
    resp = await dist_client.get("/install.sh")
    assert resp.status_code == 200
    assert "claw-worker" in resp.text
    assert resp.headers["content-type"].startswith("text/x-shellscript")


async def test_install_script_missing_is_404(dist_client, monkeypatch):
    monkeypatch.setattr(
        get_settings(), "worker_install_script", "/nonexistent/install.sh"
    )
    resp = await dist_client.get("/install.sh")
    assert resp.status_code == 404


async def test_release_tarball_served(dist_client):
    resp = await dist_client.get(f"/releases/{VALID_NAME}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/gzip"
    # Body is a real gzip tarball.
    with tarfile.open(fileobj=io.BytesIO(resp.content), mode="r:gz") as tf:
        assert "claw-worker" in tf.getnames()


async def test_release_missing_is_404(dist_client):
    resp = await dist_client.get(
        "/releases/claw-worker-9.9.9-aarch64-apple-darwin.tar.gz"
    )
    assert resp.status_code == 404


@pytest.mark.parametrize(
    "bad",
    [
        "claw-worker-latest-x86_64-apple-darwin.tar.gz",  # wrong arch
        "evil.sh",
        "claw-worker-latest-aarch64-apple-darwin.zip",
        "claw-worker--aarch64-apple-darwin.tar.gz",  # empty version segment
    ],
)
async def test_release_bad_name_rejected(dist_client, bad):
    resp = await dist_client.get(f"/releases/{bad}")
    assert resp.status_code in (400, 404)
