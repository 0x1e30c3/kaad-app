// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KaddVenue} from "../src/testnet/KaddVenue.sol";
import {KaddClubFactory} from "../src/KaddClubFactory.sol";
import {IAccountCore} from "../src/interfaces/IKuru.sol";

/// Deploys the testnet venue (tUSDC faucet + mirror pools) and a KaddClubFactory that trades on it.
///   forge script script/DeployVenue.s.sol --rpc-url monad_testnet --broadcast --account <keystore-name>
/// Then seed mirror pools with `node seed-mirrors.mjs` (prints the cast commands).
contract DeployVenue is Script {
    function run() external returns (KaddVenue venue, KaddClubFactory factory) {
        require(block.chainid == 10143, "Monad testnet only");
        vm.startBroadcast();
        venue = new KaddVenue();
        factory = new KaddClubFactory(IAccountCore(address(venue.core())), venue.usdc());
        vm.stopBroadcast();
        console.log("KaddVenue      ", address(venue));
        console.log("KaddCore       ", address(venue.core()));
        console.log("tUSDC          ", address(venue.usdc()));
        console.log("KaddClubFactory", address(factory));
    }
}
