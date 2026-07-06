// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ClawEscrow} from "../src/ClawEscrow.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Deploys ClawEscrow.
///
/// Env:
///   USDC_ADDRESS    — ERC-20 USDC. On Arc testnet:
///                     0x3600000000000000000000000000000000000000
///                     Leave unset on anvil to deploy a MockUSDC.
///   TREASURY        — commission recipient (defaults to deployer)
///   SETTLER         — claw_api service signer (defaults to deployer)
///   COMMISSION_BPS  — default 1500 (15%)
///
/// Local:  forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
///           --private-key <anvil key> --broadcast
/// Arc:    forge script script/Deploy.s.sol --rpc-url arc_testnet \
///           --account claw-deployer --broadcast   (encrypted keystore; never
///           pass --private-key outside local testing)
contract Deploy is Script {
    function run() external {
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0));
        uint16 commissionBps = uint16(vm.envOr("COMMISSION_BPS", uint256(1500)));

        vm.startBroadcast();
        address deployer = msg.sender;
        address treasury = vm.envOr("TREASURY", deployer);
        address settler = vm.envOr("SETTLER", deployer);

        if (usdcAddr == address(0)) {
            MockUSDC mock = new MockUSDC();
            usdcAddr = address(mock);
            console.log("MockUSDC deployed:", usdcAddr);
        }

        ClawEscrow escrow = new ClawEscrow(IERC20(usdcAddr), treasury, commissionBps, deployer, settler);
        vm.stopBroadcast();

        console.log("ClawEscrow deployed:", address(escrow));
        console.log("  usdc:      ", usdcAddr);
        console.log("  treasury:  ", treasury);
        console.log("  settler:   ", settler);
        console.log("  commission:", commissionBps, "bps");
    }
}
