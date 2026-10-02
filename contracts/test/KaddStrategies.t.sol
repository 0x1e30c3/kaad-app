// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddVenue, KaddPool, TestUSDC} from "../src/testnet/KaddVenue.sol";
import {KaddStrategies} from "../src/testnet/KaddStrategies.sol";

contract KaddStrategiesTest is Test {
    KaddVenue venue;
    TestUSDC usdc;
    KaddPool pool;
    IERC20 chog;
    KaddStrategies strat;
    address alice = makeAddr("alice");
    address whale = makeAddr("whale");
    address keeper = makeAddr("keeper");

    function setUp() public {
        vm.warp(1_800_000_000);
        venue = new KaddVenue();
        usdc = venue.usdc();
        pool = venue.createMirror(address(0xC406), "Chog", "CHOG", 20_000_000e18); // $0.0025
        chog = IERC20(pool.baseToken());
        strat = new KaddStrategies(venue);
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? alice : whale;
            vm.startPrank(who);
            usdc.faucet();
            usdc.approve(address(strat), type(uint256).max);
            usdc.approve(address(pool), type(uint256).max);
            chog.approve(address(strat), type(uint256).max);
            chog.approve(address(pool), type(uint256).max);
            vm.stopPrank();
        }
    }

    /// Moves the pool price hard: pump buys 20k tUSDC of CHOG (~2x), dump sells 5M CHOG (~-36%).
    function _whale(bool pump) internal {
        if (pump) {
            deal(address(usdc), whale, 20_000e6);
            vm.prank(whale);
            pool.swapExact(true, 20_000e6, 1, uint64(block.timestamp), whale);
        } else {
            deal(address(chog), whale, 5_000_000e18);
            vm.prank(whale);
            pool.swapExact(false, 5_000_000e18, 1, uint64(block.timestamp), whale);
        }
    }

    function test_limitBuyFillsOnlyBelowTrigger() public {
        vm.prank(alice);
        uint256 id = strat.create(address(pool), true, 100e6, 100e6, 2_400, false, 0); // buy when <= $0.0024
        assertFalse(strat.ready(id));
        vm.expectRevert(KaddStrategies.NotReady.selector);
        strat.execute(id);

        _whale(false); // dump → price falls below the trigger
        assertLe(pool.price(), 2_400);
        assertTrue(strat.ready(id));

        vm.prank(keeper); // anyone can fill it; proceeds go to the owner
        uint256 out = strat.execute(id);
        assertEq(chog.balanceOf(alice), out);
        assertEq(chog.balanceOf(keeper), 0);
        assertFalse(strat.ready(id));
        assertEq(strat.get(id).remaining, 0);
    }

    function test_takeProfitSellsAboveTrigger() public {
        vm.prank(alice);
        uint256 bought = pool.swapExact(true, 200e6, 1, uint64(block.timestamp), alice);
        vm.prank(alice);
        uint256 id = strat.create(address(pool), false, uint128(bought), uint128(bought), 3_000, true, 0); // sell >= $0.003
        assertEq(chog.balanceOf(alice), 0); // locked
        assertFalse(strat.ready(id));

        _whale(true); // pump
        assertGe(pool.price(), 3_000);
        uint256 before = usdc.balanceOf(alice);
        strat.execute(id);
        assertGt(usdc.balanceOf(alice) - before, 200e6); // sold for more than it cost
    }

    function test_stopLossSellsBelowTrigger() public {
        vm.prank(alice);
        uint256 bought = pool.swapExact(true, 200e6, 1, uint64(block.timestamp), alice);
        vm.prank(alice);
        uint256 id = strat.create(address(pool), false, uint128(bought), uint128(bought), 2_300, false, 0);
        assertFalse(strat.ready(id));
        _whale(false);
        assertTrue(strat.ready(id));
        strat.execute(id);
        assertGt(usdc.balanceOf(alice), 800e6 - 1); // got tUSDC back (at a loss)
    }

    function test_dcaRunsEveryIntervalUntilSpent() public {
        vm.prank(alice);
        uint256 id = strat.create(address(pool), true, 30e6, 10e6, 0, false, 1 hours);
        strat.execute(id); // first run right away
        vm.expectRevert(KaddStrategies.NotReady.selector);
        strat.execute(id);
        vm.warp(block.timestamp + 1 hours);
        strat.execute(id);
        vm.warp(block.timestamp + 1 hours);
        strat.execute(id);
        assertEq(strat.get(id).remaining, 0);
        assertFalse(strat.ready(id));
        assertEq(usdc.balanceOf(alice), 970e6);
        assertGt(chog.balanceOf(alice), 0);
    }

    function test_dcaWithPriceCapWaitsForPrice() public {
        vm.prank(alice);
        uint256 id = strat.create(address(pool), true, 20e6, 10e6, 2_400, false, 1 hours); // only while <= cap
        assertFalse(strat.ready(id));
        _whale(false);
        assertTrue(strat.ready(id));
        strat.execute(id);
    }

    function test_cancelRefundsRemaining() public {
        vm.prank(alice);
        uint256 id = strat.create(address(pool), true, 30e6, 10e6, 0, false, 1 hours);
        strat.execute(id);
        vm.prank(keeper);
        vm.expectRevert(KaddStrategies.NotOwner.selector);
        strat.cancel(id);
        vm.prank(alice);
        strat.cancel(id);
        assertEq(usdc.balanceOf(alice), 990e6);
        assertFalse(strat.ready(id));
    }

    function test_validation() public {
        vm.startPrank(alice);
        vm.expectRevert(KaddStrategies.UnknownPool.selector);
        strat.create(address(0xBEEF), true, 1e6, 1e6, 1, false, 0);
        vm.expectRevert(KaddStrategies.InvalidStrategy.selector);
        strat.create(address(pool), true, 1e6, 1e6, 0, false, 0); // no condition = market order
        vm.expectRevert(KaddStrategies.InvalidStrategy.selector);
        strat.create(address(pool), true, 2e6, 1e6, 100, false, 0); // single shot must spend all
        vm.expectRevert(KaddStrategies.InvalidStrategy.selector);
        strat.create(address(pool), true, 1e6, 2e6, 0, false, 60); // slice bigger than total
        vm.stopPrank();
    }

    function test_listsForOwnerAndKeeper() public {
        vm.startPrank(alice);
        strat.create(address(pool), true, 10e6, 10e6, 1, false, 0); // not ready (price above 1)
        strat.create(address(pool), true, 10e6, 5e6, 0, false, 60); // ready (DCA)
        vm.stopPrank();
        assertEq(strat.idsOf(alice).length, 2);
        uint256[] memory r = strat.readyIds(0, 100);
        assertEq(r.length, 1);
        assertEq(r[0], 1);
    }
}
