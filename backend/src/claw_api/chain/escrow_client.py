"""Thin synchronous web3 client for the ClawEscrow contract.

Kept deliberately dumb: build → sign → send → wait → decode event. All
policy (when to call, how to record) lives in chain/service.py. Callers run
this in a thread (`asyncio.to_thread`) — web3.py HTTP is blocking.
"""

from dataclasses import dataclass
from functools import lru_cache

from web3 import Web3

from claw_api.config import get_settings

ESCROW_ABI = [
    {
        "type": "function",
        "name": "openBooking",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "bookingId", "type": "bytes32"},
            {"name": "consumer", "type": "address"},
            {"name": "supplier", "type": "address"},
            {"name": "ratePerHourCents", "type": "uint96"},
            {"name": "maxDurationSecs", "type": "uint32"},
        ],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "settleBooking",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "bookingId", "type": "bytes32"},
            {"name": "usageSeconds", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "cancelBooking",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "bookingId", "type": "bytes32"},
            {"name": "usageSeconds", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "type": "event",
        "name": "BookingOpened",
        "inputs": [
            {"name": "bookingId", "type": "bytes32", "indexed": True},
            {"name": "consumer", "type": "address", "indexed": True},
            {"name": "supplier", "type": "address", "indexed": True},
            {"name": "ratePerHourCents", "type": "uint96", "indexed": False},
            {"name": "maxDurationSecs", "type": "uint32", "indexed": False},
            {"name": "lockedAmount", "type": "uint256", "indexed": False},
            {"name": "commissionBps", "type": "uint16", "indexed": False},
        ],
        "anonymous": False,
    },
    {
        "type": "event",
        "name": "BookingSettled",
        "inputs": [
            {"name": "bookingId", "type": "bytes32", "indexed": True},
            {"name": "consumer", "type": "address", "indexed": True},
            {"name": "supplier", "type": "address", "indexed": True},
            {"name": "usageSeconds", "type": "uint256", "indexed": False},
            {"name": "cost", "type": "uint256", "indexed": False},
            {"name": "commission", "type": "uint256", "indexed": False},
            {"name": "cancelled", "type": "bool", "indexed": False},
        ],
        "anonymous": False,
    },
]


def booking_id_bytes32(booking_id: str) -> bytes:
    """Canonical Booking.id (uuid string) → on-chain bytes32 key."""
    return Web3.keccak(text=booking_id)


# ClawEscrow custom errors, decoded for humane ledger messages.
_ERROR_SIGS = {
    "InsufficientFreeEscrow(uint256,uint256)": (
        lambda a: f"insufficient free escrow: need {a[0] / 1e6:.2f} USDC, "
        f"only {a[1] / 1e6:.2f} free"
    ),
    "UsageOutOfBounds(uint256,uint256)": (
        lambda a: f"usage {a[0]}s exceeds allowed {a[1]}s"
    ),
    "BookingExists(bytes32)": lambda a: "booking already open on-chain",
    "BookingNotOpen(bytes32)": lambda a: "booking not open on-chain",
    "CommissionTooHigh(uint16)": lambda a: f"commission {a[0]} bps over cap",
    "ZeroAddress()": lambda a: "zero address",
    "ZeroAmount()": lambda a: "zero amount",
    "NothingToClaim()": lambda a: "nothing to claim",
}


def decode_custom_error(data: str) -> str | None:
    """Best-effort decode of a ClawEscrow revert. Returns None if unknown."""
    from eth_abi import decode as abi_decode

    if not isinstance(data, str) or not data.startswith("0x") or len(data) < 10:
        return None
    for sig, render in _ERROR_SIGS.items():
        if Web3.keccak(text=sig)[:4].hex() == data[2:10]:
            types = sig[sig.index("(") + 1 : -1]
            args: tuple = ()
            if types:
                args = abi_decode(types.split(","), bytes.fromhex(data[10:]))
            return render(args)
    return None


@dataclass
class TxResult:
    tx_hash: str
    block_number: int
    # decoded event payload (BookingOpened / BookingSettled), if present
    event: dict | None


class EscrowClient:
    def __init__(self, rpc_url: str, chain_id: int, escrow_address: str, settler_key: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
        self.chain_id = chain_id
        self.account = self.w3.eth.account.from_key(settler_key)
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(escrow_address), abi=ESCROW_ABI
        )

    def _send(self, fn, event) -> TxResult:
        tx = fn.build_transaction(
            {
                "from": self.account.address,
                "nonce": self.w3.eth.get_transaction_count(self.account.address),
                "chainId": self.chain_id,
            }
        )
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        if receipt["status"] != 1:
            raise RuntimeError(f"transaction reverted: {tx_hash.to_0x_hex()}")
        decoded = None
        if event is not None:
            logs = event().process_receipt(receipt)
            if logs:
                decoded = dict(logs[0]["args"])
        return TxResult(
            tx_hash=tx_hash.to_0x_hex(),
            block_number=receipt["blockNumber"],
            event=decoded,
        )

    def open_booking(
        self,
        booking_id: str,
        consumer: str,
        supplier: str,
        rate_per_hour_cents: int,
        max_duration_secs: int,
    ) -> TxResult:
        fn = self.contract.functions.openBooking(
            booking_id_bytes32(booking_id),
            Web3.to_checksum_address(consumer),
            Web3.to_checksum_address(supplier),
            rate_per_hour_cents,
            max_duration_secs,
        )
        return self._send(fn, self.contract.events.BookingOpened)

    def settle_booking(self, booking_id: str, usage_seconds: int) -> TxResult:
        fn = self.contract.functions.settleBooking(
            booking_id_bytes32(booking_id), usage_seconds
        )
        return self._send(fn, self.contract.events.BookingSettled)

    def cancel_booking(self, booking_id: str, usage_seconds: int) -> TxResult:
        fn = self.contract.functions.cancelBooking(
            booking_id_bytes32(booking_id), usage_seconds
        )
        return self._send(fn, self.contract.events.BookingSettled)


@lru_cache
def get_escrow_client() -> EscrowClient:
    s = get_settings()
    return EscrowClient(
        rpc_url=s.chain_rpc_url,
        chain_id=s.chain_id,
        escrow_address=s.chain_escrow_address,
        settler_key=s.chain_settler_key,
    )
