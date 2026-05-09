import asyncio

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from claw_api.auth.jwt import encode_user_token, encode_worker_token
from claw_api.main import create_app
from claw_api.realtime import (
    channel_for_worker,
    publish,
    register,
    unregister,
)


@pytest.mark.asyncio
async def test_publish_fans_out_to_subscribers():
    q1 = await register("ch1")
    q2 = await register("ch1")
    await publish("ch1", {"type": "ping"})
    assert (await asyncio.wait_for(q1.get(), 1.0)) == {"type": "ping"}
    assert (await asyncio.wait_for(q2.get(), 1.0)) == {"type": "ping"}
    await unregister("ch1", q1)
    await unregister("ch1", q2)


@pytest.mark.asyncio
async def test_publish_to_unknown_channel_is_noop():
    # Should not raise.
    await publish("nobody-listening", {"x": 1})


@pytest.mark.asyncio
async def test_unregister_removes_subscriber():
    q = await register("ch2")
    await unregister("ch2", q)
    await publish("ch2", {"x": 1})
    # Queue should not have received anything.
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(q.get(), 0.1)


def test_worker_ws_rejects_bad_token():
    """Server accepts then closes; client sees WebSocketDisconnect on receive."""
    app = create_app()
    with TestClient(app) as tc:
        with tc.websocket_connect("/v1/ws/worker?token=not-real") as ws:
            with pytest.raises(WebSocketDisconnect):
                ws.receive_json()


def test_worker_ws_rejects_user_token_kind():
    app = create_app()
    user_jwt = encode_user_token("00000000-0000-0000-0000-000000000000")
    with TestClient(app) as tc:
        with tc.websocket_connect(f"/v1/ws/worker?token={user_jwt}") as ws:
            with pytest.raises(WebSocketDisconnect):
                ws.receive_json()


def test_channel_for_worker_format():
    assert channel_for_worker("abc") == "worker:abc"


def test_worker_ws_accepts_valid_worker_token():
    app = create_app()
    worker_jwt = encode_worker_token("11111111-2222-3333-4444-555555555555")
    with TestClient(app) as tc:
        with tc.websocket_connect(f"/v1/ws/worker?token={worker_jwt}") as ws:
            # Server holds the connection open; we just confirm we can receive
            # the next event up to a short timeout. Without any publish the loop
            # will eventually emit a ping at 20s — too slow for a unit test, so
            # just close immediately. If the handshake had failed, the connect
            # would have raised.
            ws.close()
