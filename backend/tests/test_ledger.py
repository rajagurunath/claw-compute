"""Public ledger + chain settlement wiring.

The chain itself is faked at the EscrowClient boundary; what's under test is
the policy: when settlement applies, what lands in settlement_txs, and that
the ledger is readable by anyone with no auth.
"""

import pytest

from claw_api.chain import escrow_client as ec_module
from claw_api.chain.escrow_client import TxResult
from claw_api.config import get_settings
from tests.test_bookings import _login, _supplier_with_offering_and_worker

CONSUMER_WALLET = "0x" + "a1" * 20
SUPPLIER_WALLET = "0x" + "b2" * 20


class FakeEscrowClient:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.calls: list[tuple] = []

    def open_booking(self, booking_id, consumer, supplier, rate, max_secs):
        self.calls.append(("open", booking_id))
        if self.fail:
            raise RuntimeError("insufficient free escrow")
        lock = rate * 10_000 * max_secs // 3600
        return TxResult(
            tx_hash="0x" + "11" * 32,
            block_number=1,
            event={"lockedAmount": lock, "commissionBps": 1500},
        )

    def settle_booking(self, booking_id, usage_seconds):
        self.calls.append(("settle", booking_id, usage_seconds))
        cost = 100 * 10_000 * usage_seconds // 3600
        return TxResult(
            tx_hash="0x" + "22" * 32,
            block_number=2,
            event={"cost": cost, "commission": cost * 1500 // 10_000},
        )

    def cancel_booking(self, booking_id, usage_seconds):
        self.calls.append(("cancel", booking_id, usage_seconds))
        return TxResult(
            tx_hash="0x" + "33" * 32,
            block_number=3,
            event={"cost": 0, "commission": 0},
        )


@pytest.fixture
def chain(monkeypatch):
    """Enable chain settlement against a fake client."""
    s = get_settings()
    monkeypatch.setattr(s, "chain_enabled", True)
    monkeypatch.setattr(s, "chain_escrow_address", "0x" + "cc" * 20)
    monkeypatch.setattr(s, "chain_settler_key", "0x" + "dd" * 32)
    fake = FakeEscrowClient()
    monkeypatch.setattr(ec_module, "get_escrow_client", lambda: fake)
    return fake


async def _booking_with_wallets(client, monkeypatch, tag: str):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, f"sup-{tag}@example.com"
    )
    sup_token = await _login(client, monkeypatch, f"sup-{tag}@example.com")
    sup_auth = {"Authorization": f"Bearer {sup_token}"}
    r = await client.patch(
        "/v1/suppliers/me", json={"payout_wallet": SUPPLIER_WALLET}, headers=sup_auth
    )
    assert r.status_code == 200

    consumer_token = await _login(client, monkeypatch, f"buyer-{tag}@example.com")
    auth = {"Authorization": f"Bearer {consumer_token}"}
    r = await client.put(
        "/v1/me/wallet", json={"wallet_address": CONSUMER_WALLET}, headers=auth
    )
    assert r.status_code == 200
    assert r.json()["wallet_address"] == CONSUMER_WALLET

    r = await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers=auth,
    )
    return r.json()["id"], auth


@pytest.mark.asyncio
async def test_ledger_is_public_and_starts_empty(client):
    r = await client.get("/v1/ledger")  # no auth header on purpose
    assert r.status_code == 200
    body = r.json()
    assert body["items"] == []
    assert body["chain"]["chain_id"] == 5042002
    assert body["stats"]["settled_volume_usdc"] == 0


@pytest.mark.asyncio
async def test_full_lifecycle_lands_on_ledger(client, monkeypatch, chain):
    booking_id, auth = await _booking_with_wallets(client, monkeypatch, "l1")

    r = await client.post(
        f"/v1/bookings/{booking_id}/transition", json={"to": "active"}, headers=auth
    )
    assert r.status_code == 200
    r = await client.post(
        f"/v1/bookings/{booking_id}/transition", json={"to": "completed"}, headers=auth
    )
    assert r.status_code == 200
    assert [c[0] for c in chain.calls] == ["open", "settle"]

    body = (await client.get("/v1/ledger")).json()
    kinds = {(e["kind"], e["status"]) for e in body["items"]}
    assert kinds == {("open", "confirmed"), ("settle", "confirmed")}
    open_entry = next(e for e in body["items"] if e["kind"] == "open")
    assert open_entry["tx_hash"] == "0x" + "11" * 32
    assert open_entry["consumer_wallet"] == CONSUMER_WALLET
    assert open_entry["supplier_wallet"] == SUPPLIER_WALLET
    assert open_entry["amount_usdc"] > 0
    assert body["stats"]["settlements"] == 1
    assert body["stats"]["open_bookings"] == 0


@pytest.mark.asyncio
async def test_cancel_records_partial_settlement(client, monkeypatch, chain):
    booking_id, auth = await _booking_with_wallets(client, monkeypatch, "l2")
    await client.post(
        f"/v1/bookings/{booking_id}/transition", json={"to": "active"}, headers=auth
    )
    r = await client.post(
        f"/v1/bookings/{booking_id}/transition", json={"to": "cancelled"}, headers=auth
    )
    assert r.status_code == 200
    assert chain.calls[-1][0] == "cancel"


@pytest.mark.asyncio
async def test_failed_lock_blocks_activation(client, monkeypatch, chain):
    chain.fail = True
    booking_id, auth = await _booking_with_wallets(client, monkeypatch, "l3")
    r = await client.post(
        f"/v1/bookings/{booking_id}/transition", json={"to": "active"}, headers=auth
    )
    assert r.status_code == 402
    # booking never went active
    r = await client.get(f"/v1/bookings/{booking_id}", headers=auth)
    assert r.json()["status"] == "pending"
    # the failure is on the public record
    body = (await client.get("/v1/ledger")).json()
    assert body["items"][0]["kind"] == "open"
    assert body["items"][0]["status"] == "failed"
    assert "insufficient" in body["items"][0]["error"]


@pytest.mark.asyncio
async def test_no_wallets_means_offchain_flow_unchanged(client, monkeypatch, chain):
    offering_id, worker_id = await _supplier_with_offering_and_worker(
        client, monkeypatch, "sup-l4@example.com"
    )
    consumer_token = await _login(client, monkeypatch, "buyer-l4@example.com")
    auth = {"Authorization": f"Bearer {consumer_token}"}
    r = await client.post(
        "/v1/bookings",
        json={"offering_id": offering_id, "worker_id": worker_id},
        headers=auth,
    )
    booking_id = r.json()["id"]
    r = await client.post(
        f"/v1/bookings/{booking_id}/transition", json={"to": "active"}, headers=auth
    )
    assert r.status_code == 200
    assert chain.calls == []
    assert (await client.get("/v1/ledger")).json()["items"] == []
