// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KaddVenue} from "../src/testnet/KaddVenue.sol";
import {KaddStrategies} from "../src/testnet/KaddStrategies.sol";

/// Deploys KaddStrategies (limit / take-profit / stop-loss / DCA) against the live testnet venue.
///   forge script script/DeployStrategies.s.sol --rpc-url monad_testnet --broadcast --account <keystore-name>
contract DeployStrategies is Script {
    function run() external returns (KaddStrategies strategies) {
        require(block.chainid == 10143, "Monad testnet only");
        KaddVenue venue = KaddVenue(vm.envOr("VENUE", address(0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379)));
        vm.startBroadcast();
        strategies = new KaddStrategies(venue);
        vm.stopBroadcast();
        console.log("KaddStrategies", address(strategies));
    }
}
