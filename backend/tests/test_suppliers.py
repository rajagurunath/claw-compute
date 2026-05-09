import pytest


async def _login(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake_send(e: str, t: str) -> None:
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake_send)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_become_supplier(client, monkeypatch):
    token = await _login(client, monkeypatch, "sup@example.com")
    r = await client.post(
        "/v1/suppliers",
        json={"display_name": "Acme GPUs", "payout_email": "pay@acme.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["display_name"] == "Acme GPUs"


@pytest.mark.asyncio
async def test_supplier_me_requires_auth(client):
    r = await client.get("/v1/suppliers/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_supplier_me_returns_profile(client, monkeypatch):
    token = await _login(client, monkeypatch, "sup2@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": "Bravo", "payout_email": "p@b.com"},
        headers=auth,
    )
    r = await client.get("/v1/suppliers/me", headers=auth)
    assert r.status_code == 200
    assert r.json()["display_name"] == "Bravo"


@pytest.mark.asyncio
async def test_cannot_double_register_supplier(client, monkeypatch):
    token = await _login(client, monkeypatch, "sup3@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    body = {"display_name": "X", "payout_email": "x@x.com"}
    r1 = await client.post("/v1/suppliers", json=body, headers=auth)
    assert r1.status_code == 201
    r2 = await client.post("/v1/suppliers", json=body, headers=auth)
    assert r2.status_code == 409
