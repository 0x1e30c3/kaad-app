// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddVenue, KaddPool, KaddCore, TestUSDC} from "../src/testnet/KaddVenue.sol";
import {KaddClubFactory} from "../src/KaddClubFactory.sol";
import {KaddClub} from "../src/KaddClub.sol";
import {IAccountCore} from "../src/interfaces/IKuru.sol";

contract KaddVenueTest is Test {
    KaddVenue venue;
    TestUSDC usdc;
    KaddPool pool;
    IERC20 chog;
    address constant SOURCE = address(0xC406);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.warp(1_800_000_000);
        venue = new KaddVenue();
        usdc = venue.usdc();
        // 50k tUSDC vs 20M CHOG → $0.0025 per CHOG
        pool = venue.createMirror(SOURCE, "Chog", "CHOG", 20_000_000e18);
        chog = IERC20(pool.baseToken());
    }

    function _claim(address who) internal {
        vm.prank(who);
        usdc.faucet();
    }

    // ---------------------------------------------------------------- faucet

    function test_faucetOncePerCooldown() public {
        _claim(alice);
        assertEq(usdc.balanceOf(alice), 1_000e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TestUSDC.TooSoon.selector, block.timestamp + 1 hours));
        usdc.faucet();
        vm.warp(block.timestamp + 1 hours);
        _claim(alice);
        assertEq(usdc.balanceOf(alice), 2_000e6);
    }

    function test_onlyVenueMints() public {
        vm.expectRevert(TestUSDC.NotMinter.selector);
        usdc.mint(alice, 1);
    }

    // ---------------------------------------------------------------- mirrors

    function test_mirrorSeedsPoolAtGivenPrice() public view {
        assertEq(venue.poolOf(SOURCE), address(pool));
        assertEq(pool.reserveQuote(), 50_000e6);
        assertEq(pool.reserveBase(), 20_000_000e18);
        assertEq(pool.price(), 2_500); // 0.0025 USDC (2500 atoms) per 1e18 CHOG atoms
        assertEq(pool.quoteToken(), address(usdc));
        assertEq(pool.accountCore(), address(venue.core()));
        assertTrue(venue.core().verifiedSpotOrderBook(address(pool)));
        assertEq(chog.totalSupply(), 20_000_000e18);
        assertEq(venue.allPools().length, 1);
    }

    function test_mirrorOncePerSource() public {
        vm.expectRevert(abi.encodeWithSelector(KaddVenue.AlreadyMirrored.selector, address(pool)));
        venue.createMirror(SOURCE, "Chog", "CHOG", 1e18);
    }

    function test_mirrorRejectsBadSeed() public {
        vm.expectRevert(KaddVenue.InvalidSeed.selector);
        venue.createMirror(address(0xBEEF), "X", "X", 0);
        vm.expectRevert(KaddVenue.InvalidSeed.selector);
        venue.createMirror(address(0), "X", "X", 1e18);
    }

    // ---------------------------------------------------------------- wallet swaps

    function test_walletBuyThenSell() public {
        _claim(alice);
        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        uint256 expected = pool.quote(true, 100e6);
        uint256 got = pool.swapExact(true, 100e6, expected, uint64(block.timestamp), alice);
        assertEq(got, expected);
        assertEq(chog.balanceOf(alice), got);
        assertEq(usdc.balanceOf(alice), 900e6);
        // ~ 100 / 0.0025 = 40k CHOG, minus 0.3% fee and a little price impact
        assertGt(got, 39_700e18);
        assertLt(got, 39_900e18);

        chog.approve(address(pool), type(uint256).max);
        uint256 back = pool.swapExact(false, got, 1, uint64(block.timestamp), alice);
        vm.stopPrank();
        // round trip loses the two fees, nothing else
        assertGt(back, 99.3e6);
        assertLt(back, 100e6);
        assertEq(usdc.balanceOf(alice), 900e6 + back);
    }

    function test_invariantNeverDecreases() public {
        uint256 k0 = pool.reserveBase() * pool.reserveQuote();
        _claim(alice);
        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        pool.swapExact(true, 999e6, 1, uint64(block.timestamp), alice);
        vm.stopPrank();
        assertGe(pool.reserveBase() * pool.reserveQuote(), k0);
        assertEq(chog.balanceOf(address(pool)), pool.reserveBase());
        assertEq(usdc.balanceOf(address(pool)), pool.reserveQuote());
    }

    function test_slippageAndDeadline() public {
        _claim(alice);
        vm.startPrank(alice);
        usdc.approve(address(pool), type(uint256).max);
        uint256 out = pool.quote(true, 10e6);
        vm.expectRevert(abi.encodeWithSelector(KaddPool.Slippage.selector, out, out + 1));
        pool.swapExact(true, 10e6, out + 1, uint64(block.timestamp), alice);
        vm.expectRevert(KaddPool.Expired.selector);
        pool.swapExact(true, 10e6, 1, uint64(block.timestamp - 1), alice);
        vm.expectRevert(KaddPool.ZeroAmount.selector);
        pool.swapExact(true, 0, 0, uint64(block.timestamp), alice);
        vm.stopPrank();
    }

    function testFuzz_buyNeverDrainsPool(uint256 amountIn) public {
        amountIn = bound(amountIn, 1e6, 1e15); // up to 1B tUSDC
        uint256 out = pool.quote(true, amountIn);
        assertLt(out, pool.reserveBase());
    }

    // ---------------------------------------------------------------- core

    function test_coreSwapOnlyByAccountOwner() public {
        KaddCore core = venue.core();
        _claim(alice);
        vm.startPrank(alice);
        usdc.approve(address(core), type(uint256).max);
        core.deposit(alice, address(usdc), 500e6);
        uint40 id = core.rootAccountIdOf(alice);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(KaddPool.NotAuthorized.selector);
        pool.swap(id, true, 100e6, 1, uint64(block.timestamp));

        vm.prank(alice);
        pool.swap(id, true, 100e6, 1, uint64(block.timestamp));
        assertEq(core.getBalance(id, address(usdc)), 400e6);
        assertGt(core.getBalance(id, address(chog)), 0);
        assertEq(chog.balanceOf(address(core)), core.getBalance(id, address(chog)));

        vm.prank(bob);
        vm.expectRevert(KaddCore.NotOwner.selector);
        core.withdraw(id, address(usdc), 1, bob);
    }

    function test_onlyVerifiedMarketsSettle() public {
        KaddCore core = venue.core();
        vm.expectRevert(KaddCore.UnverifiedMarket.selector);
        core.settle(1, address(usdc), 0, address(chog), 1);
        vm.expectRevert(KaddCore.NotVenue.selector);
        core.verify(address(this));
    }

    // ---------------------------------------------------------------- KaddClub on the venue, end to end

    function test_clubDepositTradeRedeem() public {
        KaddClubFactory factory = new KaddClubFactory(IAccountCore(address(venue.core())), usdc);
        address[] memory markets = new address[](1);
        markets[0] = address(pool);
        uint256[] memory dust = new uint256[](1);
        dust[0] = 1e18;

        vm.prank(alice);
        KaddClub club = factory.createClub("Campus Fund", 2_500, markets, dust);

        for (uint256 i; i < 2; ++i) {
            address m = i == 0 ? alice : bob;
            _claim(m);
            vm.startPrank(m);
            usdc.approve(address(club), type(uint256).max);
            club.deposit(1_000e6);
            vm.stopPrank();
        }
        assertEq(club.quoteBalance(), 2_000e6);

        // Captain buys within the 25% cap; above it reverts.
        vm.startPrank(alice);
        vm.expectRevert();
        club.trade(address(pool), true, 501e6, 1, uint64(block.timestamp));
        club.trade(address(pool), true, 500e6, 1, uint64(block.timestamp));
        vm.stopPrank();
        uint256 held = club.baseBalance(address(pool));
        assertGt(held, 0);
        assertFalse(club.isFlat());

        // Bob exits with half of everything, in kind, without the captain.
        uint256 shares = club.sharesOf(bob);
        vm.prank(bob);
        club.redeem(shares);
        assertApproxEqAbs(usdc.balanceOf(bob), 750e6, 1);
        assertApproxEqAbs(chog.balanceOf(bob), held / 2, 1);
    }
}
