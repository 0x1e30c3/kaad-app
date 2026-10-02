// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddClubFactory} from "../src/KaddClubFactory.sol";
import {IAccountCore} from "../src/interfaces/IKuru.sol";

/// Deploys the KaddClubFactory against Kuru Spot V2 on Monad testnet.
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --account <keystore-name>
/// Use a Foundry keystore (`cast wallet import`) rather than a raw private key on the command line.
contract Deploy is Script {
    function run() external returns (KaddClubFactory factory) {
        require(block.chainid == 10143, "Monad testnet only");
        // Read from .env (Foundry loads it automatically); defaults are Kuru Spot V2 on Monad testnet.
        address ACCOUNT_CORE = vm.envOr("ACCOUNT_CORE", 0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038);
        address USDC = vm.envOr("USDC", 0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1);
        vm.startBroadcast();
        factory = new KaddClubFactory(IAccountCore(ACCOUNT_CORE), IERC20(USDC));
        vm.stopBroadcast();
        console.log("KaddClubFactory", address(factory));
    }
}
