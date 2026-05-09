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


async def _booked_active(client, monkeypatch, sup_email: str, buyer_email: str):
    """Returns (consumer_token, worker_token, booking_id, supplier_user_token)
    after creating a supplier+offering+worker, having a consumer book it, and
    having the supplier transition the booking to active."""
    sup_token = await _login(client, monkeypatch, sup_email)
    sup_auth = {"Authorization": f"Bearer {sup_token}"}
    await client.post(
        "/v1/suppliers", json={"display_name": sup_email, "payout_email": sup_email},
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
    worker_token = reg.json()["worker_token"]
    worker_id = reg.json()["worker"]["id"]

    consumer_token = await _login(client, monkeypatch, buyer_email)
    booking = await client.post(
        "/v1/bookings",
        json={"offering_id": off.json()["id"], "worker_id": worker_id},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    bid = booking.json()["id"]
    await client.post(
        f"/v1/bookings/{bid}/transition",
        json={"to": "active"},
        headers=sup_auth,
    )
    return consumer_token, worker_token, bid


@pytest.mark.asyncio
async def test_consumer_sends_message(client, monkeypatch):
    consumer_token, _, bid = await _booked_active(
        client, monkeypatch, "msg-sup1@ex.com", "msg-buy1@ex.com"
    )
    r = await client.post(
        f"/v1/bookings/{bid}/messages",
        json={"content": "hello agent"},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert r.status_code == 201
    assert r.json()["role"] == "user"
    assert r.json()["content"] == "hello agent"


@pytest.mark.asyncio
async def test_send_message_requires_active_booking(client, monkeypatch):
    sup_token = await _login(client, monkeypatch, "msg-sup2@ex.com")
    sup_auth = {"Authorization": f"Bearer {sup_token}"}
    await client.post(
        "/v1/suppliers", json={"display_name": "S", "payout_email": "s@s.com"},
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
    consumer_token = await _login(client, monkeypatch, "msg-buy2@ex.com")
    booking = await client.post(
        "/v1/bookings",
        json={"offering_id": off.json()["id"], "worker_id": reg.json()["worker"]["id"]},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    bid = booking.json()["id"]
    # booking is still pending
    r = await client.post(
        f"/v1/bookings/{bid}/messages",
        json={"content": "hi"},
        headers={"Authorization": f"Bearer {consumer_token}"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_list_messages_returns_transcript(client, monkeypatch):
    consumer_token, worker_token, bid = await _booked_active(
        client, monkeypatch, "msg-sup3@ex.com", "msg-buy3@ex.com"
    )
    consumer_auth = {"Authorization": f"Bearer {consumer_token}"}
    worker_auth = {"Authorization": f"Bearer {worker_token}"}
    await client.post(
        f"/v1/bookings/{bid}/messages",
        json={"content": "hello"},
        headers=consumer_auth,
    )
    # Worker posts assistant reply via internal endpoint
    await client.post(
        f"/v1/bookings/{bid}/messages/internal",
        json={"content": "hi back"},
        headers=worker_auth,
    )
    r = await client.get(f"/v1/bookings/{bid}/messages", headers=consumer_auth)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    assert items[0]["role"] == "user"
    assert items[1]["role"] == "assistant"
    assert items[1]["content"] == "hi back"


@pytest.mark.asyncio
async def test_internal_endpoint_rejects_other_workers(client, monkeypatch):
    _, worker_token_a, bid = await _booked_active(
        client, monkeypatch, "msg-sup4@ex.com", "msg-buy4@ex.com"
    )
    # Make a second supplier+worker; their token shouldn't be able to post
    # to booking belonging to supplier A.
    _, worker_token_b, _ = await _booked_active(
        client, monkeypatch, "msg-sup5@ex.com", "msg-buy5@ex.com"
    )
    r = await client.post(
        f"/v1/bookings/{bid}/messages/internal",
        json={"content": "spoof"},
        headers={"Authorization": f"Bearer {worker_token_b}"},
    )
    assert r.status_code == 404
    # And worker A succeeds
    r = await client.post(
        f"/v1/bookings/{bid}/messages/internal",
        json={"content": "legit"},
        headers={"Authorization": f"Bearer {worker_token_a}"},
    )
    assert r.status_code == 201
