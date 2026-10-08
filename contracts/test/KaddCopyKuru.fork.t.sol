// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddCopyKuru} from "../src/KaddCopyKuru.sol";

/// Copies a buy and a sell through the real Kuru Flow router on a Monad mainnet fork, with calldata from the Kuru
/// Flow API quoted for the vault's address. Quotes go stale within minutes, so fetch them right before running:
///   eval "$(node script/kuru-quotes.mjs)" && forge test --match-contract KaddCopyKuruFork --fork-url https://rpc.monad.xyz
contract KaddCopyKuruForkTest is Test {
    address constant VAULT = 0x00000000000000000000000000000000004adD01; // must match script/kuru-quotes.mjs
    KaddCopyKuru vault = KaddCopyKuru(payable(VAULT));
    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");
    address leader = makeAddr("leader");
    IERC20 token;

    function setUp() public {
        if (block.chainid != 143 || vm.envOr("KURU_BUY_DATA", bytes("")).length == 0) vm.skip(true);
        token = IERC20(vm.envAddress("KURU_TOKEN"));
        deployCodeTo("KaddCopyKuru.sol:KaddCopyKuru", abi.encode(keeper, vm.envAddress("KURU_ROUTER")), VAULT);
        vm.deal(alice, 10 ether);
    }

    function test_copiesThroughRealKuruRoute() public {
        uint128 perTrade = uint128(vm.envUint("KURU_BUY_AMOUNT"));
        assertEq(vm.envUint("KURU_BUY_VALUE"), perTrade); // the route spends exactly one copied buy
        vm.prank(alice);
        uint256 id = vault.follow{value: 2 ether}(leader, perTrade, 1 ether, true);

        vm.prank(keeper);
        uint256 got = vault.copyBuy(id, address(token), keccak256("leader buy"), vm.envUint("KURU_BUY_MINOUT"), vm.envBytes("KURU_BUY_DATA"));
        assertGe(got, vm.envUint("KURU_BUY_MINOUT"));
        assertEq(vault.held(id, address(token)), got);
        assertEq(token.balanceOf(VAULT), got);
        assertEq(vault.get(id).cash, 2 ether - perTrade);

        // The sell route was quoted for the buy's guaranteed minimum; anything above that stays in the vault.
        assertEq(vm.envAddress("KURU_SELL_ROUTER"), vault.router());
        uint256 cashBefore = vault.get(id).cash;
        vm.prank(keeper);
        uint256 mon = vault.copySell(id, address(token), keccak256("leader sell"), vm.envUint("KURU_SELL_MINOUT"), vm.envBytes("KURU_SELL_DATA"));
        assertGe(mon, vm.envUint("KURU_SELL_MINOUT"));
        assertEq(vault.get(id).cash, cashBefore + mon);
        assertEq(vault.held(id, address(token)), got - vm.envUint("KURU_SELL_AMOUNT"));
        assertEq(token.allowance(VAULT, vault.router()), 0);
        assertEq(address(vault).balance, vault.get(id).cash);

        // Closing returns everything.
        vm.prank(alice);
        vault.close(id);
        assertEq(address(vault).balance, 0);
        assertEq(token.balanceOf(VAULT), 0);
    }

    function test_routeOutputGoesToTheCaller() public {
        // Kuru Flow pays msg.sender, not the quoted userAddress: the same calldata works from a vault at another
        // address. So the vault's own balance check (not the quote) is what keeps the output in the vault.
        KaddCopyKuru other = new KaddCopyKuru(keeper, vm.envAddress("KURU_ROUTER"));
        vm.prank(alice);
        uint256 id = other.follow{value: 2 ether}(leader, uint128(vm.envUint("KURU_BUY_AMOUNT")), 1 ether, true);
        vm.prank(keeper);
        uint256 got = other.copyBuy(id, address(token), keccak256("leader buy"), 1, vm.envBytes("KURU_BUY_DATA"));
        assertEq(token.balanceOf(address(other)), got);
        assertEq(token.balanceOf(VAULT), 0);
    }
}
