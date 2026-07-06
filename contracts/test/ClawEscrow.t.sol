// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ClawEscrow} from "../src/ClawEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract ClawEscrowTest is Test {
    ClawEscrow escrow;
    MockUSDC usdc;

    address admin = makeAddr("admin");
    address settler = makeAddr("settler");
    address treasury = makeAddr("treasury");
    address consumer = makeAddr("consumer");
    address supplier = makeAddr("supplier");

    bytes32 constant BOOKING = keccak256("booking-1");
    uint16 constant COMMISSION_BPS = 1500; // 15%
    uint96 constant RATE = 300; // $3.00/hr in cents
    uint32 constant FOUR_HOURS = 4 hours;

    // $3/hr * 4h = $12.00 = 12_000_000 base units
    uint256 constant LOCK_4H = 12_000_000;
    // 2h usage = $6.00
    uint256 constant COST_2H = 6_000_000;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new ClawEscrow(IERC20(address(usdc)), treasury, COMMISSION_BPS, admin, settler);

        usdc.mint(consumer, 100_000_000); // $100
        vm.prank(consumer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _deposit(uint256 amount) internal {
        vm.prank(consumer);
        escrow.deposit(amount);
    }

    function _open() internal {
        vm.prank(settler);
        escrow.openBooking(BOOKING, consumer, supplier, RATE, FOUR_HOURS);
    }

    // ------------------------------------------------------ happy path

    function test_happyPath_depositOpenSettleClaimWithdraw() public {
        _deposit(50_000_000); // $50
        _open();

        assertEq(escrow.freeEscrowOf(consumer), 50_000_000 - LOCK_4H);

        skip(2 hours);
        vm.prank(settler);
        escrow.settleBooking(BOOKING, 2 hours);

        // 15% of $6.00 = $0.90
        assertEq(escrow.claimable(supplier), 5_100_000);
        assertEq(escrow.claimable(treasury), 900_000);
        assertEq(escrow.escrow(consumer), 44_000_000);
        assertEq(escrow.lockedOf(consumer), 0);

        vm.prank(supplier);
        escrow.claim();
        assertEq(usdc.balanceOf(supplier), 5_100_000);

        vm.prank(treasury);
        escrow.claim();
        assertEq(usdc.balanceOf(treasury), 900_000);

        vm.prank(consumer);
        escrow.withdrawUnused(44_000_000);
        assertEq(usdc.balanceOf(consumer), 94_000_000);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // ------------------------------------------- the drain exploit is dead

    function test_exploit_withdrawMidBookingCannotStrandSupplier() public {
        _deposit(50_000_000);
        _open();

        // Consumer tries to drain everything mid-booking.
        vm.prank(consumer);
        vm.expectRevert(
            abi.encodeWithSelector(ClawEscrow.InsufficientFreeEscrow.selector, 50_000_000, 50_000_000 - LOCK_4H)
        );
        escrow.withdrawUnused(50_000_000);

        // Free portion is withdrawable; the lock is not.
        vm.prank(consumer);
        escrow.withdrawUnused(50_000_000 - LOCK_4H);

        // Settlement still pays the supplier in full.
        skip(2 hours);
        vm.prank(settler);
        escrow.settleBooking(BOOKING, 2 hours);
        assertEq(escrow.claimable(supplier), COST_2H - 900_000);
    }

    function test_openReverts_whenFreeEscrowBelowLock() public {
        _deposit(LOCK_4H - 1);
        vm.prank(settler);
        vm.expectRevert(
            abi.encodeWithSelector(ClawEscrow.InsufficientFreeEscrow.selector, LOCK_4H, LOCK_4H - 1)
        );
        escrow.openBooking(BOOKING, consumer, supplier, RATE, FOUR_HOURS);
    }

    function test_locksStack_acrossConcurrentBookings() public {
        _deposit(30_000_000);
        _open();
        vm.prank(settler);
        escrow.openBooking(keccak256("booking-2"), consumer, supplier, RATE, FOUR_HOURS);
        assertEq(escrow.lockedOf(consumer), 2 * LOCK_4H);

        vm.prank(settler);
        vm.expectRevert(); // only $6 free < $12 lock
        escrow.openBooking(keccak256("booking-3"), consumer, supplier, RATE, FOUR_HOURS);
    }

    // ------------------------------------------------- usage bounds

    function test_settleReverts_whenUsageExceedsBookedWindow() public {
        _deposit(50_000_000);
        _open();
        skip(10 hours);
        vm.prank(settler);
        vm.expectRevert(
            abi.encodeWithSelector(ClawEscrow.UsageOutOfBounds.selector, uint256(FOUR_HOURS) + 1, uint256(FOUR_HOURS))
        );
        escrow.settleBooking(BOOKING, uint256(FOUR_HOURS) + 1);
    }

    function test_settleReverts_whenUsageExceedsWallClock() public {
        _deposit(50_000_000);
        _open();
        skip(30 minutes);
        // 1h claimed after only 30min elapsed (+5min grace) → revert
        vm.prank(settler);
        vm.expectRevert(
            abi.encodeWithSelector(ClawEscrow.UsageOutOfBounds.selector, uint256(1 hours), uint256(35 minutes))
        );
        escrow.settleBooking(BOOKING, 1 hours);
    }

    function test_settleCost_neverExceedsLock() public {
        _deposit(50_000_000);
        _open();
        skip(4 hours);
        vm.prank(settler);
        escrow.settleBooking(BOOKING, FOUR_HOURS);
        uint256 paid = escrow.claimable(supplier) + escrow.claimable(treasury);
        assertLe(paid, LOCK_4H);
        assertEq(escrow.lockedOf(consumer), 0);
    }

    // ------------------------------------------------ cancel semantics

    function test_cancelWithUsage_chargesPartial() public {
        _deposit(50_000_000);
        _open();
        skip(1 hours);
        vm.prank(settler);
        escrow.cancelBooking(BOOKING, 1 hours);

        uint256 cost = 3_000_000; // $3 for 1h
        assertEq(escrow.claimable(supplier), cost - (cost * COMMISSION_BPS) / 10_000);
        assertEq(escrow.escrow(consumer), 47_000_000);
        assertEq(escrow.lockedOf(consumer), 0);
        assertEq(uint8(escrow.getBooking(BOOKING).status), uint8(ClawEscrow.Status.Cancelled));
    }

    function test_cancelWithZeroUsage_releasesFullLock() public {
        _deposit(50_000_000);
        _open();
        vm.prank(settler);
        escrow.cancelBooking(BOOKING, 0);
        assertEq(escrow.lockedOf(consumer), 0);
        assertEq(escrow.escrow(consumer), 50_000_000);
        assertEq(escrow.claimable(supplier), 0);
    }

    // -------------------------------------------------- state machine

    function test_terminalBookings_cannotTransitionAgain() public {
        _deposit(50_000_000);
        _open();
        skip(1 hours);
        vm.startPrank(settler);
        escrow.settleBooking(BOOKING, 1 hours);
        vm.expectRevert(abi.encodeWithSelector(ClawEscrow.BookingNotOpen.selector, BOOKING));
        escrow.settleBooking(BOOKING, 1 hours);
        vm.expectRevert(abi.encodeWithSelector(ClawEscrow.BookingNotOpen.selector, BOOKING));
        escrow.cancelBooking(BOOKING, 0);
        vm.stopPrank();
    }

    function test_openReverts_onDuplicateBookingId() public {
        _deposit(50_000_000);
        _open();
        vm.prank(settler);
        vm.expectRevert(abi.encodeWithSelector(ClawEscrow.BookingExists.selector, BOOKING));
        escrow.openBooking(BOOKING, consumer, supplier, RATE, FOUR_HOURS);
    }

    function test_settleUnknownBooking_reverts() public {
        vm.prank(settler);
        vm.expectRevert(abi.encodeWithSelector(ClawEscrow.BookingNotOpen.selector, keccak256("nope")));
        escrow.settleBooking(keccak256("nope"), 0);
    }

    // ------------------------------------------------------- roles

    function test_onlySettler_canOpenSettleCancel() public {
        _deposit(50_000_000);
        vm.startPrank(consumer);
        vm.expectRevert();
        escrow.openBooking(BOOKING, consumer, supplier, RATE, FOUR_HOURS);
        vm.stopPrank();

        _open();
        vm.prank(supplier);
        vm.expectRevert();
        escrow.settleBooking(BOOKING, 1 hours);
    }

    function test_commissionSnapshot_ignoresLaterAdminChange() public {
        _deposit(50_000_000);
        _open();
        vm.prank(admin);
        escrow.setCommissionBps(0);

        skip(2 hours);
        vm.prank(settler);
        escrow.settleBooking(BOOKING, 2 hours);
        // still charged at the 15% snapshot
        assertEq(escrow.claimable(treasury), 900_000);
    }

    function test_commissionCap_enforced() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ClawEscrow.CommissionTooHigh.selector, uint16(2001)));
        escrow.setCommissionBps(2001);
    }

    // -------------------------------------------------------- pause

    function test_pause_blocksInflows_neverOutflows() public {
        _deposit(50_000_000);
        _open();
        skip(1 hours);
        vm.prank(settler);
        escrow.settleBooking(BOOKING, 1 hours);

        vm.prank(admin);
        escrow.pause();

        vm.prank(consumer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.deposit(1_000_000);

        vm.prank(settler);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.openBooking(keccak256("b2"), consumer, supplier, RATE, FOUR_HOURS);

        // Money out still works while paused.
        vm.prank(supplier);
        escrow.claim();
        vm.prank(consumer);
        escrow.withdrawUnused(1_000_000);
    }

    // -------------------------------------------------------- fuzz

    function testFuzz_costNeverExceedsLock(uint96 rate, uint32 maxDur, uint256 usage) public {
        rate = uint96(bound(rate, 1, 1_000_000)); // up to $10k/hr
        maxDur = uint32(bound(maxDur, 1, 30 days));
        usage = bound(usage, 0, maxDur);

        uint256 lock = (uint256(rate) * 10_000 * maxDur + 3599) / 3600;
        usdc.mint(consumer, lock);
        _deposit(lock);

        vm.prank(settler);
        escrow.openBooking(BOOKING, consumer, supplier, rate, maxDur);

        skip(maxDur);
        vm.prank(settler);
        escrow.settleBooking(BOOKING, usage);

        assertLe(escrow.claimable(supplier) + escrow.claimable(treasury), lock);
        assertEq(escrow.lockedOf(consumer), 0);
        // Contract always holds enough USDC to honor every liability.
        assertGe(
            usdc.balanceOf(address(escrow)),
            escrow.escrow(consumer) + escrow.claimable(supplier) + escrow.claimable(treasury)
        );
    }
}
