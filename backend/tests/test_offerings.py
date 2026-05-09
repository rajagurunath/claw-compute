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


async def _make_supplier(client, monkeypatch, email: str) -> str:
    token = await _login(client, monkeypatch, email)
    auth = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": email, "payout_email": email},
        headers=auth,
    )
    return token


@pytest.mark.asyncio
async def test_create_offering_requires_supplier(client, monkeypatch):
    token = await _login(client, monkeypatch, "consumer@example.com")
    r = await client.post(
        "/v1/offerings",
        json={
            "title": "GPU rental",
            "description": "M3 Max idle compute",
            "price_per_hour_cents": 200,
            "capability_tags": ["macos", "apple-silicon"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_supplier_creates_and_browses_offering(client, monkeypatch):
    token = await _make_supplier(client, monkeypatch, "off1@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    create = await client.post(
        "/v1/offerings",
        json={
            "title": "GPU rental",
            "description": "M3 Max idle compute",
            "price_per_hour_cents": 200,
            "capability_tags": ["macos"],
        },
        headers=auth,
    )
    assert create.status_code == 201
    oid = create.json()["id"]

    browse = await client.get("/v1/offerings")
    assert browse.status_code == 200
    items = browse.json()["items"]
    assert any(i["id"] == oid for i in items)


@pytest.mark.asyncio
async def test_offering_visibility_filters_drafts(client, monkeypatch):
    token = await _make_supplier(client, monkeypatch, "off2@example.com")
    auth = {"Authorization": f"Bearer {token}"}
    r = await client.post(
        "/v1/offerings",
        json={
            "title": "Draft",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
            "status": "draft",
        },
        headers=auth,
    )
    assert r.status_code == 201
    browse = await client.get("/v1/offerings")
    assert all(i["title"] != "Draft" for i in browse.json()["items"])


@pytest.mark.asyncio
async def test_only_owner_can_update_offering(client, monkeypatch):
    owner_token = await _make_supplier(client, monkeypatch, "owner@example.com")
    other_token = await _make_supplier(client, monkeypatch, "other@example.com")
    create = await client.post(
        "/v1/offerings",
        json={
            "title": "T",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    oid = create.json()["id"]
    r = await client.patch(
        f"/v1/offerings/{oid}",
        json={"title": "Hijacked"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert r.status_code == 404
