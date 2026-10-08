// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KaddVenue} from "../src/testnet/KaddVenue.sol";
import {KaddCopyClubs} from "../src/testnet/KaddCopyClubs.sol";

/// Deploys KaddCopyClubs (pooled auto copy) against the live testnet venue. KEEPER = the address the app's keeper
/// signs with (the gas drip wallet works); the deployer stays admin and can change it later.
///   KEEPER=0x... forge script script/DeployCopyClubs.s.sol --rpc-url monad_testnet --broadcast --account <keystore-name>
contract DeployCopyClubs is Script {
    function run() external returns (KaddCopyClubs clubs) {
        require(block.chainid == 10143, "Monad testnet only");
        KaddVenue venue = KaddVenue(vm.envOr("VENUE", address(0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379)));
        address keeper = vm.envAddress("KEEPER");
        vm.startBroadcast();
        clubs = new KaddCopyClubs(venue, keeper);
        vm.stopBroadcast();
        console.log("KaddCopyClubs", address(clubs));
    }
}
