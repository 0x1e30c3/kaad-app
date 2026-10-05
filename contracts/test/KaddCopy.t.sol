// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddVenue, KaddPool, TestUSDC} from "../src/testnet/KaddVenue.sol";
import {KaddCopy} from "../src/testnet/KaddCopy.sol";

contract KaddCopyTest is Test {
    KaddVenue venue;
    TestUSDC usdc;
    KaddPool pool;
    IERC20 chog;
    KaddCopy copy;
    address constant CHOG_SRC = address(0xC406);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");
    address leader = makeAddr("leader");
    bytes32 constant TX1 = keccak256("tx1");
    bytes32 constant TX2 = keccak256("tx2");
    bytes32 constant TX3 = keccak256("tx3");

    function setUp() public {
        vm.warp(1_800_000_000);
        venue = new KaddVenue();
        usdc = venue.usdc();
        pool = venue.createMirror(CHOG_SRC, "Chog", "CHOG", 20_000_000e18);
        chog = IERC20(pool.baseToken());
        copy = new KaddCopy(venue, keeper);
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? alice : bob;
            vm.startPrank(who);
            usdc.faucet();
            usdc.approve(address(copy), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _follow(uint128 perTrade, uint128 cap, bool sells, uint128 deposit) internal returns (uint256 id) {
        vm.prank(alice);
        id = copy.follow(leader, perTrade, cap, sells, deposit);
    }

    function test_followLocksDeposit() public {
        uint256 before = usdc.balanceOf(alice);
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        assertEq(usdc.balanceOf(alice), before - 100e6);
        KaddCopy.Follow memory f = copy.get(id);
        assertEq(f.owner, alice);
        assertEq(f.leader, leader);
        assertEq(f.cash, 100e6);
        assertEq(f.since, block.timestamp);
        assertTrue(f.active);
        assertEq(copy.idsOf(alice).length, 1);
    }

    function test_followRejectsBadRules() public {
        vm.startPrank(alice);
        vm.expectRevert(KaddCopy.Invalid.selector);
        copy.follow(address(0), 10e6, 50e6, true, 100e6);
        vm.expectRevert(KaddCopy.Invalid.selector);
        copy.follow(leader, 0, 50e6, true, 100e6);
        vm.expectRevert(KaddCopy.Invalid.selector);
        copy.follow(leader, 10e6, 5e6, true, 100e6); // cap below per-trade
        vm.expectRevert(KaddCopy.Invalid.selector);
        copy.follow(leader, 10e6, 50e6, true, 0);
        vm.stopPrank();
    }

    function test_copyBuyAndSellRoundTrip() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.prank(keeper);
        uint256 got = copy.copyBuy(id, CHOG_SRC, TX1, 1);
        assertGt(got, 0);
        assertEq(copy.held(id, address(pool)), got);
        assertEq(chog.balanceOf(address(copy)), got);
        assertEq(copy.get(id).cash, 90e6);
        assertEq(copy.poolsOf(id).length, 1);

        vm.prank(keeper);
        uint256 back = copy.copySell(id, CHOG_SRC, TX2, 1);
        assertEq(copy.held(id, address(pool)), 0);
        assertApproxEqRel(back, 10e6, 0.01e18); // round trip loses only the two 0.3% fees
        assertEq(copy.get(id).cash, 90e6 + back);
    }

    function test_onlyKeeperCopies() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.expectRevert(KaddCopy.NotKeeper.selector);
        vm.prank(alice);
        copy.copyBuy(id, CHOG_SRC, TX1, 1);
    }

    function test_eachLeaderTradeCopiedOnce() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.startPrank(keeper);
        copy.copyBuy(id, CHOG_SRC, TX1, 1);
        vm.expectRevert(KaddCopy.AlreadyCopied.selector);
        copy.copyBuy(id, CHOG_SRC, TX1, 1);
        vm.stopPrank();
    }

    function test_dailyCapResetsNextDay() public {
        uint256 id = _follow(20e6, 40e6, true, 200e6);
        vm.startPrank(keeper);
        copy.copyBuy(id, CHOG_SRC, TX1, 1);
        copy.copyBuy(id, CHOG_SRC, TX2, 1);
        vm.expectRevert(KaddCopy.OverDailyCap.selector);
        copy.copyBuy(id, CHOG_SRC, TX3, 1);
        vm.warp(block.timestamp + 1 days);
        copy.copyBuy(id, CHOG_SRC, TX3, 1);
        vm.stopPrank();
        assertEq(copy.get(id).cash, 140e6);
    }

    function test_lastBuySpendsWhatIsLeft() public {
        uint256 id = _follow(30e6, 100e6, true, 50e6);
        vm.startPrank(keeper);
        copy.copyBuy(id, CHOG_SRC, TX1, 1);
        copy.copyBuy(id, CHOG_SRC, TX2, 1); // only 20 left
        assertEq(copy.get(id).cash, 0);
        vm.expectRevert(KaddCopy.OverDailyCap.selector); // nothing left to spend
        copy.copyBuy(id, CHOG_SRC, TX3, 1);
        vm.stopPrank();
    }

    function test_onlyMirroredTokens() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.expectRevert(KaddCopy.NoPool.selector);
        vm.prank(keeper);
        copy.copyBuy(id, address(0xBEEF), TX1, 1);
    }

    function test_keeperSlippageGuard() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.expectRevert(abi.encodeWithSelector(KaddPool.Slippage.selector, pool.quote(true, 10e6), type(uint256).max));
        vm.prank(keeper);
        copy.copyBuy(id, CHOG_SRC, TX1, type(uint256).max);
    }

    function test_sellsOnlyWhenOptedIn() public {
        uint256 id = _follow(10e6, 50e6, false, 100e6);
        vm.startPrank(keeper);
        copy.copyBuy(id, CHOG_SRC, TX1, 1);
        vm.expectRevert(KaddCopy.Invalid.selector);
        copy.copySell(id, CHOG_SRC, TX2, 1);
        vm.stopPrank();
    }

    function test_sellWithoutPositionReverts() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.expectRevert(KaddCopy.NothingToSell.selector);
        vm.prank(keeper);
        copy.copySell(id, CHOG_SRC, TX1, 1);
    }

    function test_closeReturnsEverythingAndStopsCopying() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.prank(keeper);
        uint256 got = copy.copyBuy(id, CHOG_SRC, TX1, 1);
        uint256 usdcBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        copy.close(id);
        assertEq(usdc.balanceOf(alice), usdcBefore + 90e6);
        assertEq(chog.balanceOf(alice), got);
        assertEq(chog.balanceOf(address(copy)), 0);
        assertEq(usdc.balanceOf(address(copy)), 0);

        vm.expectRevert(KaddCopy.Inactive.selector);
        vm.prank(keeper);
        copy.copyBuy(id, CHOG_SRC, TX2, 1);
        vm.expectRevert(KaddCopy.Inactive.selector);
        vm.prank(alice);
        copy.close(id);
    }

    function test_onlyOwnerManagesFollow() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.startPrank(bob);
        vm.expectRevert(KaddCopy.NotOwner.selector);
        copy.close(id);
        vm.expectRevert(KaddCopy.NotOwner.selector);
        copy.fund(id, 10e6);
        vm.stopPrank();
    }

    function test_fundAddsCash() public {
        uint256 id = _follow(10e6, 50e6, true, 100e6);
        vm.prank(alice);
        copy.fund(id, 25e6);
        assertEq(copy.get(id).cash, 125e6);
    }

    function test_vaultsAreSeparate() public {
        uint256 a = _follow(10e6, 50e6, true, 100e6);
        vm.prank(bob);
        uint256 b = copy.follow(leader, 10e6, 50e6, true, 100e6);
        vm.startPrank(keeper);
        copy.copyBuy(a, CHOG_SRC, TX1, 1);
        copy.copyBuy(b, CHOG_SRC, TX1, 1); // same leader trade, different vault: allowed once each
        copy.copySell(a, CHOG_SRC, TX2, 1);
        vm.stopPrank();
        assertEq(copy.held(a, address(pool)), 0);
        assertGt(copy.held(b, address(pool)), 0);
    }

    function test_adminSetsKeeper() public {
        vm.expectRevert(KaddCopy.NotAdmin.selector);
        vm.prank(alice);
        copy.setKeeper(alice);
        copy.setKeeper(bob);
        assertEq(copy.keeper(), bob);
    }
}
