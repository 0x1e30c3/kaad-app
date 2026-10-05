// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KaddVenue} from "../src/testnet/KaddVenue.sol";
import {KaddCopy} from "../src/testnet/KaddCopy.sol";

/// Deploys KaddCopy (auto copy trading vaults) against the live testnet venue. KEEPER = the address the app's keeper
/// signs with (the gas drip wallet works); the deployer stays admin and can change it later.
///   KEEPER=0x... forge script script/DeployCopy.s.sol --rpc-url monad_testnet --broadcast --account <keystore-name>
contract DeployCopy is Script {
    function run() external returns (KaddCopy copy) {
        require(block.chainid == 10143, "Monad testnet only");
        KaddVenue venue = KaddVenue(vm.envOr("VENUE", address(0xe4c0c88a4b2e5b150D3bB8D3d391E6A87b3d5379)));
        address keeper = vm.envAddress("KEEPER");
        vm.startBroadcast();
        copy = new KaddCopy(venue, keeper);
        vm.stopBroadcast();
        console.log("KaddCopy", address(copy));
    }
}
