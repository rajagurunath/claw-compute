"""Thin synchronous web3 client for the ClawEscrow contract.

Kept deliberately dumb: build → sign → send → wait → decode event. All
policy (when to call, how to record) lives in chain/service.py. Callers run
this in a thread (`asyncio.to_thread`) — web3.py HTTP is blocking.
"""

import base64
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from web3 import Web3

from claw_api.config import get_settings

ESCROW_ABI = [
    {
        "type": "function",
        "name": "deposit",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "amount", "type": "uint256"}],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "withdrawUnused",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "amount", "type": "uint256"}],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "freeEscrowOf",
        "stateMutability": "view",
        "inputs": [{"name": "consumer", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "event",
        "name": "Deposited",
        "inputs": [
            {"name": "consumer", "type": "address", "indexed": True},
            {"name": "amount", "type": "uint256", "indexed": False},
        ],
        "anonymous": False,
    },
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


# Minimal ERC-20 surface: the consumer must approve the escrow to pull USDC
# before deposit(). balanceOf/allowance are read-only helpers.
ERC20_ABI = [
    {
        "type": "function",
        "name": "approve",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "type": "function",
        "name": "allowance",
        "stateMutability": "view",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "balanceOf",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
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
    def __init__(
        self,
        rpc_url: str,
        chain_id: int,
        escrow_address: str,
        settler_key: str,
        usdc_address: str = "",
    ):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
        self.chain_id = chain_id
        self.account = self.w3.eth.account.from_key(settler_key)
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(escrow_address), abi=ESCROW_ABI
        )
        self.usdc = (
            self.w3.eth.contract(
                address=Web3.to_checksum_address(usdc_address), abi=ERC20_ABI
            )
            if usdc_address
            else None
        )

    def consumer_address(self) -> str:
        """The escrow-holding address this signer deposits from. In private-key
        mode the settler and the consumer are the same account."""
        return self.account.address

    def free_escrow_of(self, consumer: str) -> int:
        return int(
            self.contract.functions.freeEscrowOf(
                Web3.to_checksum_address(consumer)
            ).call()
        )

    def deposit(self, amount: int) -> TxResult:
        """Approve + deposit `amount` (6-dec USDC base units) into escrow."""
        if self.usdc is None:
            raise RuntimeError("USDC address not configured; cannot deposit")
        approve = self.usdc.functions.approve(self.contract.address, amount)
        self._send(approve, None)
        fn = self.contract.functions.deposit(amount)
        return self._send(fn, self.contract.events.Deposited)

    def withdraw_unused(self, amount: int) -> TxResult:
        """Reclaim escrow not reserved by an open booking (consumer refund)."""
        return self._send(self.contract.functions.withdrawUnused(amount), None)

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


class CircleEscrowClient:
    """ClawEscrow signer backed by a Circle developer-controlled wallet."""

    def __init__(
        self,
        rpc_url: str,
        escrow_address: str,
        api_base: str,
        api_key: str,
        entity_secret: str,
        wallet_id: str,
        usdc_address: str = "",
    ):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(escrow_address), abi=ESCROW_ABI
        )
        self.usdc_address = (
            Web3.to_checksum_address(usdc_address) if usdc_address else ""
        )
        self.api_base = api_base.rstrip("/")
        self.entity_secret = entity_secret
        self.wallet_id = wallet_id
        self.http = httpx.Client(
            timeout=30,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )
        self._public_key = None
        self._address: str | None = None

    def consumer_address(self) -> str:
        """This developer-controlled wallet's on-chain address — the custodial
        escrow holder. Fetched once from Circle and cached."""
        if self._address is None:
            r = self.http.get(f"{self.api_base}/wallets/{self.wallet_id}")
            r.raise_for_status()
            self._address = Web3.to_checksum_address(
                r.json()["data"]["wallet"]["address"]
            )
        return self._address

    def free_escrow_of(self, consumer: str) -> int:
        return int(
            self.contract.functions.freeEscrowOf(
                Web3.to_checksum_address(consumer)
            ).call()
        )

    def deposit(self, amount: int) -> TxResult:
        """Approve the escrow to pull USDC, then deposit into escrow — two
        Circle contract executions signed by the developer-controlled wallet."""
        if not self.usdc_address:
            raise RuntimeError("USDC address not configured; cannot deposit")
        self._execute_at(
            self.usdc_address,
            "approve(address,uint256)",
            [self.contract.address, str(amount)],
            None,
        )
        return self._execute_at(
            self.contract.address,
            "deposit(uint256)",
            [str(amount)],
            self.contract.events.Deposited,
        )

    def withdraw_unused(self, amount: int) -> TxResult:
        """Reclaim escrow not reserved by an open booking (consumer refund)."""
        return self._execute_at(
            self.contract.address, "withdrawUnused(uint256)", [str(amount)], None
        )

    def _entity_secret_ciphertext(self) -> str:
        if self._public_key is None:
            response = self.http.get(f"{self.api_base}/config/entity/publicKey")
            response.raise_for_status()
            pem = response.json()["data"]["publicKey"]
            self._public_key = serialization.load_pem_public_key(pem.encode())
        ciphertext = self._public_key.encrypt(
            bytes.fromhex(self.entity_secret),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        return base64.b64encode(ciphertext).decode()

    def _execute(self, signature: str, parameters: list[str], event) -> TxResult:
        return self._execute_at(self.contract.address, signature, parameters, event)

    def _execute_at(
        self, contract_address: str, signature: str, parameters: list[str], event
    ) -> TxResult:
        body = {
            "idempotencyKey": str(uuid.uuid4()),
            "walletId": self.wallet_id,
            "contractAddress": contract_address,
            "abiFunctionSignature": signature,
            "abiParameters": parameters,
            "feeLevel": "MEDIUM",
            "entitySecretCiphertext": self._entity_secret_ciphertext(),
        }
        response = self.http.post(
            f"{self.api_base}/developer/transactions/contractExecution", json=body
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"Circle contract execution failed: {response.status_code} {response.text}"
            )
        transaction_id = response.json()["data"]["id"]
        deadline = time.monotonic() + 120
        transaction = None
        while time.monotonic() < deadline:
            poll = self.http.get(f"{self.api_base}/transactions/{transaction_id}")
            poll.raise_for_status()
            transaction = poll.json()["data"]["transaction"]
            state = transaction.get("state")
            if state in {"COMPLETE", "CONFIRMED"}:
                break
            if state in {"FAILED", "CANCELLED", "DENIED"}:
                raise RuntimeError(f"Circle transaction {transaction_id} ended in {state}")
            time.sleep(2)
        else:
            raise TimeoutError(f"Circle transaction {transaction_id} did not confirm")
        tx_hash = transaction.get("txHash")
        if not tx_hash:
            raise RuntimeError(f"Circle transaction {transaction_id} has no txHash")
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        if receipt["status"] != 1:
            raise RuntimeError(f"transaction reverted: {tx_hash}")
        decoded = None
        if event is not None:
            logs = event().process_receipt(receipt)
            if logs:
                decoded = dict(logs[0]["args"])
        return TxResult(tx_hash=tx_hash, block_number=receipt["blockNumber"], event=decoded)

    def open_booking(
        self,
        booking_id: str,
        consumer: str,
        supplier: str,
        rate_per_hour_cents: int,
        max_duration_secs: int,
    ) -> TxResult:
        return self._execute(
            "openBooking(bytes32,address,address,uint96,uint32)",
            [
                Web3.to_hex(booking_id_bytes32(booking_id)),
                Web3.to_checksum_address(consumer),
                Web3.to_checksum_address(supplier),
                str(rate_per_hour_cents),
                str(max_duration_secs),
            ],
            self.contract.events.BookingOpened,
        )

    def settle_booking(self, booking_id: str, usage_seconds: int) -> TxResult:
        return self._execute(
            "settleBooking(bytes32,uint256)",
            [Web3.to_hex(booking_id_bytes32(booking_id)), str(usage_seconds)],
            self.contract.events.BookingSettled,
        )

    def cancel_booking(self, booking_id: str, usage_seconds: int) -> TxResult:
        return self._execute(
            "cancelBooking(bytes32,uint256)",
            [Web3.to_hex(booking_id_bytes32(booking_id)), str(usage_seconds)],
            self.contract.events.BookingSettled,
        )


@lru_cache
def get_escrow_client() -> EscrowClient | CircleEscrowClient:
    s = get_settings()
    if s.chain_signer_mode == "circle":
        return CircleEscrowClient(
            rpc_url=s.chain_rpc_url,
            escrow_address=s.chain_escrow_address,
            api_base=s.circle_api_base,
            api_key=s.circle_api_key,
            entity_secret=s.circle_entity_secret,
            wallet_id=s.circle_wallet_id,
            usdc_address=s.chain_usdc_address,
        )
    return EscrowClient(
        rpc_url=s.chain_rpc_url,
        chain_id=s.chain_id,
        escrow_address=s.chain_escrow_address,
        settler_key=s.chain_settler_key,
        usdc_address=s.chain_usdc_address,
    )
