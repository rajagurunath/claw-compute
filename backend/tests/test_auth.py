import pytest


@pytest.mark.asyncio
async def test_request_magic_link_creates_token(client, db_session):
    response = await client.post(
        "/v1/auth/magic-link",
        json={"email": "alice@example.com"},
    )
    assert response.status_code == 202

    from sqlalchemy import select

    from claw_api.models.magic_links import MagicLinkToken
    rows = (await db_session.execute(select(MagicLinkToken))).scalars().all()
    assert len(rows) == 1
    assert rows[0].used_at is None


@pytest.mark.asyncio
async def test_verify_magic_link_returns_jwt(client, db_session, monkeypatch):
    captured = {}

    async def fake_send(email: str, token: str) -> None:
        captured["email"] = email
        captured["token"] = token

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake_send)

    await client.post("/v1/auth/magic-link", json={"email": "bob@example.com"})
    token = captured["token"]

    response = await client.post("/v1/auth/verify", json={"token": token})
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_verify_invalid_token_rejected(client):
    response = await client.post("/v1/auth/verify", json={"token": "not-a-real-token"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(client, monkeypatch):
    captured = {}

    async def fake_send(email: str, token: str) -> None:
        captured["token"] = token

    from claw_api.auth import magic_link
    monkeypatch.setattr(magic_link, "deliver_magic_link", fake_send)

    await client.post("/v1/auth/magic-link", json={"email": "carol@example.com"})
    verify = await client.post("/v1/auth/verify", json={"token": captured["token"]})
    jwt_token = verify.json()["access_token"]

    response = await client.get("/v1/me", headers={"Authorization": f"Bearer {jwt_token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "carol@example.com"
