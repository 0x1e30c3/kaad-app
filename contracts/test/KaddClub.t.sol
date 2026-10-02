// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddClub} from "../src/KaddClub.sol";
import {KaddClubFactory} from "../src/KaddClubFactory.sol";
import {IAccountCore} from "../src/interfaces/IKuru.sol";
import {MockAccountCore, MockERC20, MockOrderBook} from "./mocks/MockKuru.sol";

contract KaddClubTest is Test {
    MockAccountCore core;
    MockERC20 usdc; // 6 decimals
    MockERC20 weth; // 18 decimals
    MockOrderBook book; // WETH/USDC @ 2000 USDC
    KaddClubFactory factory;
    KaddClub club;

    address captain = makeAddr("captain");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address mallory = makeAddr("mallory");

    uint256 constant PRICE = 2000e6; // quote atoms per 1 WETH
    uint256 constant DUST = 1e12; // 0.000001 WETH

    function setUp() public {
        core = new MockAccountCore();
        usdc = new MockERC20("USDC", 6);
        weth = new MockERC20("WETH", 18);
        book = new MockOrderBook(core, address(weth), address(usdc), PRICE);
        core.verify(address(book));
        // Pre-fund core so swap outputs can later be withdrawn.
        usdc.mint(address(core), 1e15);
        weth.mint(address(core), 1e30);

        factory = new KaddClubFactory(IAccountCore(address(core)), IERC20(address(usdc)));
        club = _createClub(captain, 2_500);

        for (uint256 i; i < 3; ++i) {
            address u = [alice, bob, mallory][i];
            usdc.mint(u, 1_000_000e6);
            vm.prank(u);
            usdc.approve(address(club), type(uint256).max);
        }
    }

    function _createClub(address cap, uint16 bps) internal returns (KaddClub) {
        address[] memory markets = new address[](1);
        markets[0] = address(book);
        uint256[] memory dust = new uint256[](1);
        dust[0] = DUST;
        vm.prank(cap);
        return factory.createClub("Anak Kampus", bps, markets, dust);
    }

    function _deposit(address who, uint256 amount) internal returns (uint256) {
        vm.prank(who);
        return club.deposit(amount);
    }

    function _buy(uint128 amountIn) internal {
        vm.prank(captain);
        club.trade(address(book), true, amountIn, 1, uint64(block.timestamp + 60));
    }

    // ------------------------------------------------------------- setup / config

    function test_FactoryMakesCallerCaptain() public view {
        assertEq(club.captain(), captain);
        assertEq(factory.clubCount(), 1);
        assertEq(club.markets()[0], address(book));
    }

    function test_RejectsUnverifiedMarket() public {
        MockOrderBook rogue = new MockOrderBook(core, address(weth), address(usdc), PRICE);
        address[] memory m = new address[](1);
        m[0] = address(rogue);
        uint256[] memory d = new uint256[](1);
        vm.expectRevert(KaddClub.InvalidConfig.selector);
        factory.createClub("x", 1000, m, d);
    }

    function test_RejectsWrongQuoteToken() public {
        MockOrderBook other = new MockOrderBook(core, address(weth), address(weth), PRICE);
        core.verify(address(other));
        address[] memory m = new address[](1);
        m[0] = address(other);
        uint256[] memory d = new uint256[](1);
        vm.expectRevert(KaddClub.InvalidConfig.selector);
        factory.createClub("x", 1000, m, d);
    }

    function test_RejectsDuplicateBaseToken() public {
        MockOrderBook twin = new MockOrderBook(core, address(weth), address(usdc), PRICE);
        core.verify(address(twin));
        address[] memory m = new address[](2);
        (m[0], m[1]) = (address(book), address(twin));
        uint256[] memory d = new uint256[](2);
        vm.expectRevert(KaddClub.InvalidConfig.selector);
        factory.createClub("x", 1000, m, d);
    }

    function test_RejectsBadTradeCap() public {
        address[] memory m = new address[](1);
        m[0] = address(book);
        uint256[] memory d = new uint256[](1);
        vm.expectRevert(KaddClub.InvalidConfig.selector);
        factory.createClub("x", 0, m, d);
        vm.expectRevert(KaddClub.InvalidConfig.selector);
        factory.createClub("x", 10_001, m, d);
    }

    // ------------------------------------------------------------- deposits

    function test_DepositFundsKuruAccountOwnedByClub() public {
        _deposit(alice, 100e6);
        uint40 id = club.accountId();
        assertGt(id, 0);
        assertEq(core.ownerOf(id), address(club));
        assertEq(core.getBalance(id, address(usdc)), 100e6);
        assertEq(club.quoteBalance(), 100e6);
        assertEq(usdc.balanceOf(address(club)), 0, "nothing left on the contract itself");
    }

    function test_SharesProportionalWhileFlat() public {
        uint256 a = _deposit(alice, 100e6);
        uint256 b = _deposit(bob, 300e6);
        assertApproxEqRel(b, a * 3, 1e12);
    }

    function test_DepositBlockedWhileHoldingPosition() public {
        _deposit(alice, 1_000e6);
        _buy(200e6);
        assertFalse(club.isFlat());
        vm.expectRevert(KaddClub.NotFlat.selector);
        _deposit(bob, 100e6);
    }

    function test_DepositReopensAfterClosingPosition() public {
        _deposit(alice, 1_000e6);
        _buy(200e6);
        uint128 pos = uint128(club.baseBalance(address(book)));
        vm.prank(captain);
        club.trade(address(book), false, pos, 1, uint64(block.timestamp + 60));
        assertTrue(club.isFlat());
        _deposit(bob, 100e6);
    }

    function test_DonationAttackIsUnprofitable() public {
        // Mallory deposits 1 atom, then donates straight into the club's Kuru account to inflate share price.
        _deposit(mallory, 1);
        vm.startPrank(mallory);
        usdc.approve(address(core), type(uint256).max);
        core.deposit(address(club), address(usdc), 10_000e6);
        vm.stopPrank();

        uint256 aliceShares = _deposit(alice, 1_000e6);
        assertGt(aliceShares, 0, "victim still gets shares");

        uint256 before = usdc.balanceOf(mallory);
        uint256 malloryShares = club.sharesOf(mallory); // read before prank: a view call would consume it
        vm.prank(mallory);
        club.redeem(malloryShares);
        uint256 got = usdc.balanceOf(mallory) - before;
        assertLt(got, 10_000e6 + 1, "attacker cannot recover more than donated");
    }

    // ------------------------------------------------------------- trading

    function test_OnlyCaptainTrades() public {
        _deposit(alice, 1_000e6);
        vm.prank(alice);
        vm.expectRevert(KaddClub.NotCaptain.selector);
        club.trade(address(book), true, 10e6, 1, uint64(block.timestamp + 60));
    }

    function test_BuyCappedByMaxTradeBps() public {
        _deposit(alice, 1_000e6); // cap = 25% = 250 USDC
        vm.prank(captain);
        vm.expectRevert(abi.encodeWithSelector(KaddClub.TradeTooLarge.selector, 251e6, 250e6));
        club.trade(address(book), true, 251e6, 1, uint64(block.timestamp + 60));
        _buy(250e6);
        assertEq(club.baseBalance(address(book)), 0.125e18);
    }

    function test_RequiresMinOutAndAllowedMarket() public {
        _deposit(alice, 1_000e6);
        vm.startPrank(captain);
        vm.expectRevert(KaddClub.ZeroAmount.selector);
        club.trade(address(book), true, 10e6, 0, uint64(block.timestamp + 60));
        vm.expectRevert(KaddClub.MarketNotAllowed.selector);
        club.trade(address(0xBEEF), true, 10e6, 1, uint64(block.timestamp + 60));
        vm.stopPrank();
    }

    function test_TradeBeforeAnyDepositReverts() public {
        vm.prank(captain);
        vm.expectRevert(KaddClub.NoAccount.selector);
        club.trade(address(book), true, 1, 1, uint64(block.timestamp + 60));
    }

    function test_SlippageGuardPassesThrough() public {
        _deposit(alice, 1_000e6);
        vm.prank(captain);
        vm.expectRevert("slippage");
        club.trade(address(book), true, 100e6, 1e18, uint64(block.timestamp + 60));
    }

    // ------------------------------------------------------------- redemptions

    function test_RedeemPaysProRataInKind() public {
        _deposit(alice, 600e6);
        _deposit(bob, 400e6);
        _buy(200e6); // club: 800 USDC + 0.1 WETH

        uint256 aliceShares = club.sharesOf(alice);
        vm.prank(alice);
        club.redeem(aliceShares);

        assertApproxEqAbs(usdc.balanceOf(alice), 1_000_000e6 - 600e6 + 480e6, 1);
        assertApproxEqAbs(weth.balanceOf(alice), 0.06e18, 1);
        assertEq(club.sharesOf(alice), 0);
    }

    function test_MembersCanExitEvenIfCaptainIsGone() public {
        _deposit(alice, 500e6);
        _buy(100e6);
        vm.prank(captain);
        club.setCaptain(makeAddr("burned"));
        uint256 s = club.sharesOf(alice);
        vm.prank(alice);
        club.redeem(s);
        assertEq(club.totalShares(), 0);
        assertEq(club.quoteBalance(), 0);
        assertEq(club.baseBalance(address(book)), 0);
    }

    function test_CannotRedeemOthersShares() public {
        _deposit(alice, 500e6);
        vm.prank(mallory);
        vm.expectRevert(KaddClub.InsufficientShares.selector);
        club.redeem(1);
    }

    function test_CaptainHasNoWithdrawPath() public {
        _deposit(alice, 500e6);
        uint256 before = usdc.balanceOf(captain);
        // The only fund-moving calls are deposit/redeem (member-scoped) and trade (stays inside Kuru).
        _buy(125e6);
        vm.prank(captain);
        vm.expectRevert(KaddClub.InsufficientShares.selector);
        club.redeem(1);
        assertEq(usdc.balanceOf(captain), before);
    }

    function test_SetCaptainOnlyByCaptain() public {
        vm.prank(alice);
        vm.expectRevert(KaddClub.NotCaptain.selector);
        club.setCaptain(alice);
        vm.prank(captain);
        club.setCaptain(bob);
        assertEq(club.captain(), bob);
    }

    // ------------------------------------------------------------- griefing

    function test_DonatedBaseDoesNotBlockDeposits() public {
        _deposit(alice, 500e6);
        // Mallory pushes WETH straight into the club's Kuru account to make it look "not flat".
        weth.mint(mallory, 1e18);
        vm.startPrank(mallory);
        weth.approve(address(core), type(uint256).max);
        core.deposit(address(club), address(weth), 1e18);
        vm.stopPrank();

        assertTrue(club.isFlat(), "donations are not club exposure");
        _deposit(bob, 500e6);

        // The donation is still shared pro-rata on exit.
        uint256 s = club.sharesOf(bob);
        vm.prank(bob);
        club.redeem(s);
        assertApproxEqAbs(weth.balanceOf(bob), 0.5e18, 1e6);
    }

    function test_HeldExposureShrinksOnRedeem() public {
        _deposit(alice, 1_000e6);
        _buy(200e6);
        assertFalse(club.isFlat());
        uint256 s = club.sharesOf(alice);
        vm.prank(alice);
        club.redeem(s);
        assertEq(club.heldOf(address(book)), 0);
        assertTrue(club.isFlat());
    }

    function test_FailingTokenIsDeferredNotBlocking() public {
        _deposit(alice, 600e6);
        _deposit(bob, 400e6);
        _buy(200e6); // 800 USDC + 0.1 WETH
        core.pauseWithdraw(address(weth), true);

        uint256 sa = club.sharesOf(alice);
        vm.prank(alice);
        club.redeem(sa);
        assertApproxEqAbs(usdc.balanceOf(alice), 1_000_000e6 - 600e6 + 480e6, 1, "USDC still paid");
        assertEq(weth.balanceOf(alice), 0);
        uint256 owed = club.owedOf(alice, address(weth));
        assertApproxEqAbs(owed, 0.06e18, 1);

        // Bob's exit can't take Alice's deferred WETH.
        uint256 sb = club.sharesOf(bob);
        core.pauseWithdraw(address(weth), false);
        vm.prank(bob);
        club.redeem(sb);
        assertApproxEqAbs(weth.balanceOf(bob), 0.04e18, 1);

        vm.prank(alice);
        club.claim(address(weth));
        assertEq(weth.balanceOf(alice), owed);
        assertEq(club.totalOwed(address(weth)), 0);
    }

    function test_ClaimRevertsWhileStillPausedAndKeepsDebt() public {
        _deposit(alice, 1_000e6);
        _buy(100e6);
        core.pauseWithdraw(address(weth), true);
        uint256 s = club.sharesOf(alice);
        vm.prank(alice);
        club.redeem(s);
        uint256 owed = club.owedOf(alice, address(weth));
        vm.prank(alice);
        vm.expectRevert("withdraw paused");
        club.claim(address(weth));
        assertEq(club.owedOf(alice, address(weth)), owed, "debt kept after failed claim");
    }

    function test_OwedExcludedFromNewDepositPricing() public {
        _deposit(alice, 1_000e6);
        core.pauseWithdraw(address(usdc), true);
        uint256 s = club.sharesOf(alice);
        vm.prank(alice);
        club.redeem(s); // all USDC deferred
        core.pauseWithdraw(address(usdc), false);
        assertEq(club.quoteBalance(), 0, "deferred USDC is not club value");
        uint256 shares = _deposit(bob, 100e6);
        vm.prank(bob);
        club.redeem(shares);
        assertApproxEqAbs(usdc.balanceOf(bob), 1_000_000e6, 1, "bob gets exactly his own USDC back");
    }

    // ------------------------------------------------------------- fuzz

    /// Deposit then immediately redeem never returns more than was put in (rounding favours the club).
    function testFuzz_RoundTripNeverProfits(uint96 seed, uint96 amount) public {
        seed = uint96(bound(seed, 1, 100_000e6));
        amount = uint96(bound(amount, 1, 100_000e6));
        _deposit(alice, seed);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        try club.deposit(amount) returns (uint256 shares) {
            vm.prank(bob);
            club.redeem(shares);
            assertLe(usdc.balanceOf(bob), before);
        } catch (bytes memory err) {
            assertEq(bytes4(err), KaddClub.ZeroShares.selector);
        }
    }

    /// Total payouts across all members never exceed what the club holds.
    function testFuzz_FullExitDrainsExactly(uint96 a, uint96 b, uint96 buy) public {
        a = uint96(bound(a, 1e6, 100_000e6));
        b = uint96(bound(b, 1e6, 100_000e6));
        _deposit(alice, a);
        _deposit(bob, b);
        uint256 cap = club.quoteBalance() * club.maxTradeBps() / 10_000;
        buy = uint96(bound(buy, 1, cap));
        _buy(buy);

        uint256 q = club.quoteBalance();
        uint256 w = club.baseBalance(address(book));
        uint256 sa = club.sharesOf(alice);
        uint256 sb = club.sharesOf(bob);
        vm.prank(alice);
        club.redeem(sa);
        vm.prank(bob);
        club.redeem(sb);

        uint256 paidQ = usdc.balanceOf(alice) + usdc.balanceOf(bob) - (2_000_000e6 - a - b);
        uint256 paidW = weth.balanceOf(alice) + weth.balanceOf(bob);
        assertEq(paidQ, q, "last redeemer takes the remainder");
        assertEq(paidW, w);
    }
}
