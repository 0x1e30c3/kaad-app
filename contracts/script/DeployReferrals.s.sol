// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KaddReferrals} from "../src/testnet/KaddReferrals.sol";

/// Deploys KaddReferrals (onchain invite attribution).
///   forge script script/DeployReferrals.s.sol --rpc-url monad_testnet --broadcast --account <keystore-name>
contract DeployReferrals is Script {
    function run() external returns (KaddReferrals refs) {
        require(block.chainid == 10143, "Monad testnet only");
        vm.startBroadcast();
        refs = new KaddReferrals();
        vm.stopBroadcast();
        console.log("KaddReferrals", address(refs));
    }
}
