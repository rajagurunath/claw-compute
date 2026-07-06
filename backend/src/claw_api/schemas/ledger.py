from datetime import datetime
from typing import Literal

from pydantic import BaseModel

SettlementKind = Literal["open", "settle", "cancel"]
SettlementStatus = Literal["confirmed", "failed"]


class LedgerEntry(BaseModel):
    id: str
    booking_id: str
    kind: SettlementKind
    status: SettlementStatus
    tx_hash: str | None
    block_number: int | None
    consumer_wallet: str | None
    supplier_wallet: str | None
    supplier_name: str | None
    offering_title: str | None
    rate_per_hour_cents: int | None
    usage_seconds: int | None
    amount_usdc: int | None  # 6-decimal base units
    commission_usdc: int | None
    error: str | None
    created_at: datetime


class ChainInfo(BaseModel):
    enabled: bool
    chain_name: str
    chain_id: int
    explorer_url: str
    escrow_address: str
    usdc_address: str
    commission_bps: int


class LedgerStats(BaseModel):
    settled_volume_usdc: int  # sum of confirmed settle+cancel costs
    commission_usdc: int
    locked_volume_usdc: int  # confirmed opens minus closed bookings' locks
    settlements: int  # confirmed settle+cancel count
    open_bookings: int  # confirmed opens without a confirmed close


class LedgerOut(BaseModel):
    chain: ChainInfo
    stats: LedgerStats
    items: list[LedgerEntry]
    total: int
