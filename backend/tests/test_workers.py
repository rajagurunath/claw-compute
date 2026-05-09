import pytest


async def _make_supplier(client, monkeypatch, email: str) -> str:
    captured = {}

    async def fake(e: str, t: str) -> None:
        captured["t"] = t

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake)
    await client.post("/v1/auth/magic-link", json={"email": email})
    r = await client.post("/v1/auth/verify", json={"token": captured["t"]})
    user_token = r.json()["access_token"]
    auth = {"Authorization": f"Bearer {user_token}"}
    await client.post(
        "/v1/suppliers",
        json={"display_name": email, "payout_email": email},
        headers=auth,
    )
    return user_token


@pytest.mark.asyncio
async def test_supplier_issues_provisioning_token(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w1@example.com")
    r = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "mac-studio-1"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert "provisioning_token" in body
    assert body["worker"]["status"] == "pending"


@pytest.mark.asyncio
async def test_worker_register_then_heartbeat(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w2@example.com")
    issued = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "mac-studio-2"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    prov = issued.json()["provisioning_token"]

    reg = await client.post(
        "/v1/workers/register",
        json={
            "provisioning_token": prov,
            "machine_info": {"chip": "Apple M3 Max", "ram_gb": 64},
        },
    )
    assert reg.status_code == 200
    worker_token = reg.json()["worker_token"]

    hb = await client.post(
        "/v1/workers/heartbeat",
        json={"cpu_pct": 12.5, "mem_pct": 40.0, "free_ram_gb": 30.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert hb.status_code == 204


@pytest.mark.asyncio
async def test_provisioning_token_single_use(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w3@example.com")
    issued = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "mac-studio-3"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    prov = issued.json()["provisioning_token"]
    body = {"provisioning_token": prov, "machine_info": {}}
    r1 = await client.post("/v1/workers/register", json=body)
    assert r1.status_code == 200
    r2 = await client.post("/v1/workers/register", json=body)
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_supplier_lists_workers(client, monkeypatch):
    user_token = await _make_supplier(client, monkeypatch, "w4@example.com")
    auth = {"Authorization": f"Bearer {user_token}"}
    await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "a"}, headers=auth
    )
    await client.post(
        "/v1/workers/provisioning-tokens", json={"name": "b"}, headers=auth
    )
    r = await client.get("/v1/suppliers/me/workers", headers=auth)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 2


@pytest.mark.asyncio
async def test_heartbeat_persists_row(client, monkeypatch, db_session):
    user_token = await _make_supplier(client, monkeypatch, "w5@example.com")
    issued = await client.post(
        "/v1/workers/provisioning-tokens",
        json={"name": "n"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    prov = issued.json()["provisioning_token"]
    reg = await client.post(
        "/v1/workers/register",
        json={"provisioning_token": prov, "machine_info": {}},
    )
    worker_token = reg.json()["worker_token"]
    await client.post(
        "/v1/workers/heartbeat",
        json={"cpu_pct": 1.0, "mem_pct": 2.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    from sqlalchemy import select

    from claw_api.models.heartbeats import Heartbeat
    rows = (await db_session.execute(select(Heartbeat))).scalars().all()
    assert len(rows) == 1
    assert rows[0].cpu_pct == 1.0
