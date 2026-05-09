import pytest


async def _login(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake(_e, t):
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_role_consumer_only(client, monkeypatch):
    token = await _login(client, monkeypatch, "consumer-only@example.com")
    r = await client.get("/v1/me/role", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == {"is_supplier": False, "is_consumer": True}


@pytest.mark.asyncio
async def test_role_supplier_after_become(client, monkeypatch):
    token = await _login(client, monkeypatch, "role-sup@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": "S", "payout_email": "s@s.com"},
        headers=auth,
    )
    r = await client.get("/v1/me/role", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"is_supplier": True, "is_consumer": True}


@pytest.mark.asyncio
async def test_role_requires_auth(client):
    r = await client.get("/v1/me/role")
    assert r.status_code == 401
