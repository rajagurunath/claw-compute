import pytest


async def _login(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake(e: str, t: str) -> None:
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    return r.json()["access_token"]


async def _supplier_with_offering_and_worker(client, monkeypatch, email: str):
    user_token = await _login(client, monkeypatch, email)
    auth = {"Authorization": f"Bearer {user_token}"}
    await client.post(
        "/v1/suppliers", json={"display_name": email, "payout_email": email}, headers=auth
    )
    off = await client.post(
        "/v1/offerings",
        json={
            "title": "T",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
        },
        headers=auth,
    )
    prov = await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "w"}, headers=auth
    )
    reg = await client.post(
        "/v1/workers/register",
        json={"provisioning_token": prov.json()["provisioning_token"], "machine_info": {}},
    )
    return off.json()["id"], reg.json()["worker"]["id"]


@pytest.mark.asyncio
async def test_consumer_creates_booking(client, monkeypatch):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, "sup@example.com"
    )
    consumer_token = await _login(client, monkeypatch, "buyer@example.com")
    r = await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_consumer_lists_their_bookings(client, monkeypatch):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, "sup2@example.com"
    )
    consumer_token = await _login(client, monkeypatch, "buyer2@example.com")
    auth = {"Authorization": f"Bearer {consumer_token}"}
    await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers=auth,
    )
    r = await client.get("/v1/bookings/me", headers=auth)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1


@pytest.mark.asyncio
async def test_supplier_can_activate_their_booking(client, monkeypatch):
    sup_token = await _login(client, monkeypatch, "sup3@example.com")
    sup_auth = {"Authorization": f"Bearer {sup_token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": "S", "payout_email": "s@s.com"},
        headers=sup_auth,
    )
    off = await client.post(
        "/v1/offerings",
        json={
            "title": "T",
            "description": "x",
            "price_per_hour_cents": 100,
            "capability_tags": [],
        },
        headers=sup_auth,
    )
    prov = await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "w"}, headers=sup_auth
    )
    reg = await client.post(
        "/v1/workers/register",
        json={"provisioning_token": prov.json()["provisioning_token"], "machine_info": {}},
    )

    consumer_token = await _login(client, monkeypatch, "buyer3@example.com")
    booking = await client.post(
        "/v1/bookings",
        json={"offering_id": off.json()["id"], "worker_id": reg.json()["worker"]["id"]},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    bid = booking.json()["id"]

    activate = await client.post(
        f"/v1/bookings/{bid}/transition",
        json={"to": "active"},
        headers=sup_auth,
    )
    assert activate.status_code == 200
    assert activate.json()["status"] == "active"


@pytest.mark.asyncio
async def test_invalid_transition_rejected(client, monkeypatch):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, "sup4@example.com"
    )
    consumer_token = await _login(client, monkeypatch, "buyer4@example.com")
    booking = await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    bid = booking.json()["id"]
    r = await client.post(
        f"/v1/bookings/{bid}/transition",
        json={"to": "completed"},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert r.status_code == 400
