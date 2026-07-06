// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ClawEscrow — USDC settlement rail for Claw Marketplace bookings
///
/// Consumers prepay USDC into escrow. The marketplace backend (SETTLER_ROLE)
/// mirrors the off-chain booking lifecycle on-chain:
///
///   deposit → openBooking (locks rate × maxDuration) → settleBooking / cancelBooking
///           → claim (supplier / treasury) · withdrawUnused (consumer)
///
/// Invariants this contract enforces:
///  * Funds a booking may need are locked at openBooking; withdrawUnused can
///    only touch the unlocked remainder, so a supplier can never go unpaid
///    because the consumer drained escrow mid-booking.
///  * usageSeconds at settlement is bounded by both the booking's
///    maxDurationSecs and wall-clock time since openBooking, so a buggy or
///    compromised settler cannot overbill beyond the locked amount.
///  * cancelBooking settles partial usage instead of forfeiting it.
///  * commissionBps is snapshotted per booking at open, so an admin change
///    never reprices in-flight bookings, and is hard-capped at 20%.
///  * claim and withdrawUnused work even when the contract is paused — pause
///    stops new money coming in, never money going out.
contract ClawEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    /// 1 cent = 10_000 base units of 6-decimal USDC.
    uint256 private constant CENT = 10_000;
    uint16 public constant MAX_COMMISSION_BPS = 2_000; // 20%
    /// Settlement may report usage slightly past wall-clock (clock skew,
    /// batching); anything beyond this is rejected.
    uint256 public constant SETTLE_GRACE_SECS = 5 minutes;

    enum Status {
        Unset, // zero value — "does not exist"
        Open,
        Settled,
        Cancelled
    }

    struct Booking {
        address consumer;
        address supplier;
        uint96 ratePerHourCents;
        uint256 lockedAmount; // USDC base units reserved at open
        uint64 openedAt;
        uint32 maxDurationSecs;
        uint16 commissionBps; // snapshot at open
        Status status;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint16 public commissionBps;

    /// Consumer prepaid balance (free + locked).
    mapping(address => uint256) public escrow;
    /// Portion of a consumer's escrow reserved by open bookings.
    mapping(address => uint256) public lockedOf;
    /// Pull-payment earnings (suppliers and treasury).
    mapping(address => uint256) public claimable;
    mapping(bytes32 => Booking) private _bookings;

    event Deposited(address indexed consumer, uint256 amount);
    event Withdrawn(address indexed consumer, uint256 amount);
    event BookingOpened(
        bytes32 indexed bookingId,
        address indexed consumer,
        address indexed supplier,
        uint96 ratePerHourCents,
        uint32 maxDurationSecs,
        uint256 lockedAmount,
        uint16 commissionBps
    );
    event BookingSettled(
        bytes32 indexed bookingId,
        address indexed consumer,
        address indexed supplier,
        uint256 usageSeconds,
        uint256 cost,
        uint256 commission,
        bool cancelled
    );
    event Claimed(address indexed account, uint256 amount);
    event CommissionUpdated(uint16 bps);
    event TreasuryUpdated(address treasury);

    error ZeroAddress();
    error ZeroAmount();
    error BookingExists(bytes32 bookingId);
    error BookingNotOpen(bytes32 bookingId);
    error InsufficientFreeEscrow(uint256 requested, uint256 free);
    error UsageOutOfBounds(uint256 usageSeconds, uint256 maxAllowed);
    error CommissionTooHigh(uint16 bps);
    error NothingToClaim();

    constructor(IERC20 usdc_, address treasury_, uint16 commissionBps_, address admin, address settler) {
        if (address(usdc_) == address(0) || treasury_ == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }
        if (commissionBps_ > MAX_COMMISSION_BPS) revert CommissionTooHigh(commissionBps_);
        usdc = usdc_;
        treasury = treasury_;
        commissionBps = commissionBps_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (settler != address(0)) _grantRole(SETTLER_ROLE, settler);
    }

    // ---------------------------------------------------------------- views

    function getBooking(bytes32 bookingId) external view returns (Booking memory) {
        return _bookings[bookingId];
    }

    /// Escrow a consumer could withdraw right now.
    function freeEscrowOf(address consumer) public view returns (uint256) {
        return escrow[consumer] - lockedOf[consumer];
    }

    /// USDC a booking would cost for a given usage, using its snapshot rate.
    function quote(uint96 ratePerHourCents, uint256 usageSeconds) public pure returns (uint256) {
        return (uint256(ratePerHourCents) * CENT * usageSeconds) / 3600;
    }

    // ------------------------------------------------------------- consumer

    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        escrow[msg.sender] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// Withdraw escrow not reserved by any open booking.
    /// Deliberately NOT pausable: pause must never trap consumer funds.
    function withdrawUnused(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 free = freeEscrowOf(msg.sender);
        if (amount > free) revert InsufficientFreeEscrow(amount, free);
        escrow[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ------------------------------------------------------------- supplier

    /// Withdraw accumulated earnings (suppliers and treasury alike).
    /// Deliberately NOT pausable.
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    // -------------------------------------------------------------- settler

    /// Mirror pending→active: reserve the worst-case cost from consumer escrow.
    function openBooking(
        bytes32 bookingId,
        address consumer,
        address supplier,
        uint96 ratePerHourCents,
        uint32 maxDurationSecs
    ) external onlyRole(SETTLER_ROLE) whenNotPaused {
        if (consumer == address(0) || supplier == address(0)) revert ZeroAddress();
        if (maxDurationSecs == 0) revert ZeroAmount();
        if (_bookings[bookingId].status != Status.Unset) revert BookingExists(bookingId);

        // Round the lock UP so it always covers the (rounded-down) settle cost.
        uint256 lock = _ceilDiv(uint256(ratePerHourCents) * CENT * maxDurationSecs, 3600);
        uint256 free = freeEscrowOf(consumer);
        if (lock > free) revert InsufficientFreeEscrow(lock, free);

        lockedOf[consumer] += lock;
        _bookings[bookingId] = Booking({
            consumer: consumer,
            supplier: supplier,
            ratePerHourCents: ratePerHourCents,
            lockedAmount: lock,
            openedAt: uint64(block.timestamp),
            maxDurationSecs: maxDurationSecs,
            commissionBps: commissionBps,
            status: Status.Open
        });
        emit BookingOpened(bookingId, consumer, supplier, ratePerHourCents, maxDurationSecs, lock, commissionBps);
    }

    /// Mirror active→completed: charge actual usage, release the lock.
    function settleBooking(bytes32 bookingId, uint256 usageSeconds) external onlyRole(SETTLER_ROLE) {
        _settle(bookingId, usageSeconds, Status.Settled);
    }

    /// Mirror →cancelled: charge whatever usage actually happened (may be 0),
    /// release the rest of the lock.
    function cancelBooking(bytes32 bookingId, uint256 usageSeconds) external onlyRole(SETTLER_ROLE) {
        _settle(bookingId, usageSeconds, Status.Cancelled);
    }

    function _settle(bytes32 bookingId, uint256 usageSeconds, Status finalStatus) private {
        Booking storage b = _bookings[bookingId];
        if (b.status != Status.Open) revert BookingNotOpen(bookingId);

        // Usage can never exceed the booked window nor wall-clock elapsed time.
        uint256 elapsed = block.timestamp - b.openedAt + SETTLE_GRACE_SECS;
        uint256 maxAllowed = b.maxDurationSecs < elapsed ? b.maxDurationSecs : elapsed;
        if (usageSeconds > maxAllowed) revert UsageOutOfBounds(usageSeconds, maxAllowed);

        uint256 cost = quote(b.ratePerHourCents, usageSeconds);
        // usage ≤ maxDuration and the lock rounds up, so cost ≤ lockedAmount;
        // the min() guards the invariant even so.
        if (cost > b.lockedAmount) cost = b.lockedAmount;

        uint256 commission = (cost * b.commissionBps) / 10_000;
        address consumer = b.consumer;

        b.status = finalStatus;
        lockedOf[consumer] -= b.lockedAmount;
        escrow[consumer] -= cost;
        claimable[b.supplier] += cost - commission;
        if (commission > 0) claimable[treasury] += commission;

        emit BookingSettled(
            bookingId, consumer, b.supplier, usageSeconds, cost, commission, finalStatus == Status.Cancelled
        );
    }

    // ---------------------------------------------------------------- admin

    /// Applies to bookings opened after the change; in-flight bookings keep
    /// their snapshot.
    function setCommissionBps(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > MAX_COMMISSION_BPS) revert CommissionTooHigh(bps);
        commissionBps = bps;
        emit CommissionUpdated(bps);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --------------------------------------------------------------- helpers

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
