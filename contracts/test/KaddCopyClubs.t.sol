// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddVenue, KaddPool, TestUSDC} from "../src/testnet/KaddVenue.sol";
import {KaddCopyClubs} from "../src/testnet/KaddCopyClubs.sol";

contract KaddCopyClubsTest is Test {
    KaddVenue venue;
    TestUSDC usdc;
    KaddPool pool;
    KaddPool pool2;
    IERC20 chog;
    IERC20 emo;
    KaddCopyClubs clubs;
    address constant CHOG_SRC = address(0xC406);
    address constant EMO_SRC = address(0xE30);
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
        pool2 = venue.createMirror(EMO_SRC, "Emo", "EMO", 50_000_000e18);
        chog = IERC20(pool.baseToken());
        emo = IERC20(pool2.baseToken());
        clubs = new KaddCopyClubs(venue, keeper);
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? alice : bob;
            vm.startPrank(who);
            usdc.faucet();
            usdc.approve(address(clubs), type(uint256).max);
            vm.stopPrank();
        }
    }

    /// 10% of cash per buy, 30% of the day's starting cash per day.
    function _club(bool sells) internal returns (uint256 id) {
        vm.prank(alice);
        id = clubs.create("Chog chasers", leader, 1_000, 3_000, sells);
    }

    function _deposit(address who, uint256 id, uint128 amount) internal returns (uint256) {
        vm.prank(who);
        return clubs.deposit(id, amount);
    }

    function _buy(uint256 id, address src, bytes32 tx_) internal returns (uint256) {
        vm.prank(keeper);
        return clubs.copyBuy(id, src, tx_, 1);
    }

    function test_createStoresRules() public {
        uint256 id = _club(true);
        KaddCopyClubs.Club memory c = clubs.get(id);
        assertEq(c.name, "Chog chasers");
        assertEq(c.creator, alice);
        assertEq(c.leader, leader);
        assertEq(c.perTradeBps, 1_000);
        assertEq(c.dailyCapBps, 3_000);
        assertTrue(c.copySells);
        assertEq(c.since, block.timestamp);
        assertEq(clubs.count(), 1);
        assertTrue(clubs.isFlat(id));
    }

    function test_createRejectsBadRules() public {
        vm.startPrank(alice);
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.create("x", address(0), 1_000, 3_000, true);
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.create("", leader, 1_000, 3_000, true);
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.create("x", leader, 0, 3_000, true);
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.create("x", leader, 3_000, 1_000, true); // cap below per-trade
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.create("x", leader, 1_000, 10_001, true);
        vm.stopPrank();
    }

    function test_shareMath() public {
        uint256 id = _club(true);
        assertEq(_deposit(alice, id, 100e6), 100e6); // first deposit 1:1
        assertEq(_deposit(bob, id, 50e6), 50e6);
        assertEq(clubs.get(id).cash, 150e6);
        assertEq(clubs.get(id).totalShares, 150e6);

        // A round trip that changes cash per share prices the next deposit at the new rate.
        _buy(id, CHOG_SRC, TX1);
        vm.prank(keeper);
        clubs.copySell(id, CHOG_SRC, TX2, 1);
        uint256 cash = clubs.get(id).cash;
        assertTrue(clubs.isFlat(id));
        uint256 shares = _deposit(bob, id, 30e6);
        assertEq(shares, 30e6 * uint256(150e6) / cash);
    }

    function test_depositsOnlyWhileFlat() public {
        uint256 id = _club(true);
        _deposit(alice, id, 100e6);
        _buy(id, CHOG_SRC, TX1);
        assertFalse(clubs.isFlat(id));
        vm.prank(bob);
        vm.expectRevert(KaddCopyClubs.NotFlat.selector);
        clubs.deposit(id, 50e6);

        vm.prank(keeper);
        clubs.copySell(id, CHOG_SRC, TX2, 1);
        _deposit(bob, id, 50e6); // flat again: open
        assertGt(clubs.sharesOf(id, bob), 0);
    }

    function test_redeemInKindWhileHolding() public {
        uint256 id = _club(false);
        _deposit(alice, id, 100e6);
        _deposit(bob, id, 100e6);
        uint256 got = _buy(id, CHOG_SRC, TX1); // 20 tUSDC of CHOG
        uint256 cash = clubs.get(id).cash;
        assertEq(cash, 180e6);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        clubs.redeem(id, 100e6); // half the club
        assertEq(usdc.balanceOf(bob), before + 90e6);
        assertEq(chog.balanceOf(bob), got / 2);
        assertEq(clubs.held(id, address(pool)), got - got / 2);
        assertEq(clubs.sharesOf(id, bob), 0);
        assertFalse(clubs.isFlat(id));

        // The last member takes everything that's left, and the club is flat again.
        vm.prank(alice);
        clubs.redeem(id, 100e6);
        assertEq(chog.balanceOf(alice), got - got / 2);
        assertEq(clubs.get(id).cash, 0);
        assertEq(clubs.get(id).totalShares, 0);
        assertTrue(clubs.isFlat(id));
        assertEq(chog.balanceOf(address(clubs)), 0);
    }

    function test_redeemRejectsMoreThanOwned() public {
        uint256 id = _club(true);
        _deposit(alice, id, 100e6);
        vm.prank(bob);
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.redeem(id, 1);
        vm.prank(alice);
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.redeem(id, 100e6 + 1);
    }

    function test_perTradeIsShareOfCash() public {
        uint256 id = _club(true);
        _deposit(alice, id, 200e6);
        _buy(id, CHOG_SRC, TX1);
        assertEq(clubs.get(id).cash, 180e6); // 10% of 200
        _buy(id, EMO_SRC, TX2);
        assertEq(clubs.get(id).cash, 162e6); // 10% of 180
        assertEq(clubs.poolsOf(id).length, 2);
        assertEq(clubs.get(id).holding, 2);
    }

    function test_dailyCapResetsNextDay() public {
        uint256 id = _club(true);
        _deposit(alice, id, 100e6); // cap: 30 of 100 today
        _buy(id, CHOG_SRC, TX1); // 10
        _buy(id, CHOG_SRC, TX2); // 9
        _buy(id, CHOG_SRC, keccak256("tx2b")); // 8.1 → 27.1 spent
        vm.prank(keeper);
        vm.expectRevert(KaddCopyClubs.OverDailyCap.selector);
        clubs.copyBuy(id, CHOG_SRC, TX3, 1); // 7.29 more would pass 30

        vm.warp(block.timestamp + 1 days);
        _buy(id, CHOG_SRC, TX3);
        assertEq(clubs.get(id).dayBase, 72_900_000); // the new day's base is the cash left
    }

    function test_onlyKeeperCopies() public {
        uint256 id = _club(true);
        _deposit(alice, id, 100e6);
        vm.prank(alice);
        vm.expectRevert(KaddCopyClubs.NotKeeper.selector);
        clubs.copyBuy(id, CHOG_SRC, TX1, 1);
        vm.prank(alice);
        vm.expectRevert(KaddCopyClubs.NotKeeper.selector);
        clubs.copySell(id, CHOG_SRC, TX1, 1);
    }

    function test_eachLeaderTradeOnce() public {
        uint256 id = _club(true);
        _deposit(alice, id, 100e6);
        _buy(id, CHOG_SRC, TX1);
        vm.prank(keeper);
        vm.expectRevert(KaddCopyClubs.AlreadyCopied.selector);
        clubs.copyBuy(id, CHOG_SRC, TX1, 1);
        // The same tx touching another token is a different leader trade.
        _buy(id, EMO_SRC, TX1);
    }

    function test_unknownTokenAndBadClubRevert() public {
        uint256 id = _club(true);
        _deposit(alice, id, 100e6);
        vm.startPrank(keeper);
        vm.expectRevert(KaddCopyClubs.NoPool.selector);
        clubs.copyBuy(id, address(0xdead), TX1, 1);
        vm.expectRevert(); // no such club
        clubs.copyBuy(7, CHOG_SRC, TX1, 1);
        vm.stopPrank();
    }

    function test_copySellRules() public {
        uint256 id = _club(false);
        _deposit(alice, id, 100e6);
        _buy(id, CHOG_SRC, TX1);
        vm.prank(keeper);
        vm.expectRevert(KaddCopyClubs.Invalid.selector);
        clubs.copySell(id, CHOG_SRC, TX2, 1); // club doesn't copy sells

        uint256 id2 = _club(true);
        _deposit(bob, id2, 100e6);
        vm.prank(keeper);
        vm.expectRevert(KaddCopyClubs.NothingToSell.selector);
        clubs.copySell(id2, CHOG_SRC, TX2, 1);
    }

    function test_minOutProtectsBuys() public {
        uint256 id = _club(true);
        _deposit(alice, id, 100e6);
        vm.prank(keeper);
        vm.expectRevert();
        clubs.copyBuy(id, CHOG_SRC, TX1, type(uint256).max);
        assertEq(clubs.get(id).cash, 100e6); // reverted whole
    }

    function test_clubsAreIsolated() public {
        uint256 a = _club(true);
        uint256 b = _club(true);
        _deposit(alice, a, 100e6);
        _deposit(bob, b, 100e6);
        _buy(a, CHOG_SRC, TX1);
        assertEq(clubs.get(b).cash, 100e6);
        assertTrue(clubs.isFlat(b));
        vm.prank(bob);
        clubs.deposit(b, 10e6); // b still open while a holds
    }

    function test_onlyAdminSetsKeeper() public {
        vm.prank(alice);
        vm.expectRevert(KaddCopyClubs.NotAdmin.selector);
        clubs.setKeeper(alice);
        clubs.setKeeper(alice);
        assertEq(clubs.keeper(), alice);
    }

    /// Whatever the keeper does, the club's books always cover what it owes members.
    function testFuzz_booksMatchBalances(uint128 a, uint128 b, uint8 buys, bool sell) public {
        a = uint128(bound(a, 1e6, 400e6));
        b = uint128(bound(b, 1e6, 400e6));
        uint256 id = _club(true);
        _deposit(alice, id, a);
        _deposit(bob, id, b);
        buys = uint8(bound(buys, 0, 3));
        for (uint256 i; i < buys; ++i) {
            vm.prank(keeper);
            try clubs.copyBuy(id, i % 2 == 0 ? CHOG_SRC : EMO_SRC, bytes32(i), 1) {} catch {}
        }
        if (sell && clubs.held(id, address(pool)) > 0) {
            vm.prank(keeper);
            clubs.copySell(id, CHOG_SRC, keccak256("sell"), 1);
        }
        assertEq(usdc.balanceOf(address(clubs)), clubs.get(id).cash);
        assertEq(chog.balanceOf(address(clubs)), clubs.held(id, address(pool)));

        uint256 sa = clubs.sharesOf(id, alice);
        uint256 sb = clubs.sharesOf(id, bob);
        vm.prank(alice);
        clubs.redeem(id, sa);
        vm.prank(bob);
        clubs.redeem(id, sb);
        assertEq(usdc.balanceOf(address(clubs)), 0);
        assertEq(chog.balanceOf(address(clubs)), 0);
        assertEq(emo.balanceOf(address(clubs)), 0);
        assertTrue(clubs.isFlat(id));
    }
}
