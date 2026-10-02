// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KaddVenue} from "../src/testnet/KaddVenue.sol";

/// Opens testnet pools for the tokens in seeds.json (written by `node seed-mirrors.mjs`), skipping ones that exist.
///   VENUE=<KaddVenue> forge script script/SeedMirrors.s.sol --rpc-url monad_testnet --broadcast --account <keystore>
contract SeedMirrors is Script {
    function run() external {
        KaddVenue venue = KaddVenue(vm.envAddress("VENUE"));
        string memory json = vm.readFile("seeds.json");
        address[] memory sources = vm.parseJsonAddressArray(json, ".sources");
        string[] memory names = vm.parseJsonStringArray(json, ".names");
        string[] memory symbols = vm.parseJsonStringArray(json, ".symbols");
        string[] memory seeds = vm.parseJsonStringArray(json, ".seeds");
        vm.startBroadcast();
        for (uint256 i; i < sources.length; ++i) {
            if (venue.poolOf(sources[i]) != address(0)) continue;
            address pool = address(venue.createMirror(sources[i], names[i], symbols[i], vm.parseUint(seeds[i])));
            console.log(symbols[i], pool);
        }
        vm.stopBroadcast();
    }
}
