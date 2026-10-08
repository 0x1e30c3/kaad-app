// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddCopyKuru} from "../src/KaddCopyKuru.sol";
import {MockERC20} from "./mocks/MockKuru.sol";

/// Stands in for the Kuru Flow router: fixed price, output to whoever the calldata names (like a real route can).
contract MockRouter {
    uint256 public constant RATE = 1000; // tokens per MON

    /// Buys `token` with msg.value; sends `out` (0 = fair) to `to`, refunds `refund` MON to the caller.
    function buy(MockERC20 token, address to, uint256 out, uint256 refund) external payable {
        token.mint(to, out == 0 ? (msg.value - refund) * RATE : out);
        if (refund > 0) payable(msg.sender).transfer(refund);
    }

    /// Sells `amount` of the caller's `token` for MON paid to `to` (`monOut` 0 = fair).
    function sell(IERC20 token, uint256 amount, address to, uint256 monOut) external {
        token.transferFrom(msg.sender, address(this), amount);
        payable(to).transfer(monOut == 0 ? amount / RATE : monOut);
    }

    /// Tries to take more of the caller's tokens than the sell approved.
    function greedy(IERC20 token, uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
    }

    receive() external payable {}
}

contract KaddCopyKuruTest is Test {
    KaddCopyKuru vault;
    MockRouter router;
    MockERC20 chog;
    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");
    address leader = makeAddr("leader");
    address thief = makeAddr("thief");
    bytes32 constant TX1 = keccak256("tx1");
    bytes32 constant TX2 = keccak256("tx2");

    function setUp() public {
        vm.warp(1_800_000_000);
        router = new MockRouter();
        vm.deal(address(router), 1_000 ether);
        chog = new MockERC20("CHOG", 18);
        vault = new KaddCopyKuru(keeper, address(router));
        vm.deal(alice, 100 ether);
    }

    function _follow(uint128 perTrade, uint128 cap, bool sells, uint256 deposit) internal returns (uint256 id) {
        vm.prank(alice);
        id = vault.follow{value: deposit}(leader, perTrade, cap, sells);
    }

    function _buyData(address to, uint256 out, uint256 refund) internal view returns (bytes memory) {
        return abi.encodeCall(MockRouter.buy, (chog, to, out, refund));
    }

    function _buy(uint256 id, bytes32 tx_) internal returns (uint256) {
        vm.prank(keeper);
        return vault.copyBuy(id, address(chog), tx_, 1, _buyData(address(vault), 0, 0));
    }

    function test_followLocksMon() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        assertEq(address(vault).balance, 10 ether);
        KaddCopyKuru.Follow memory f = vault.get(id);
        assertEq(f.cash, 10 ether);
        assertEq(f.owner, alice);
        assertTrue(f.active);
        assertEq(vault.idsOf(alice).length, 1);
    }

    function test_followRejectsBadRules() public {
        vm.startPrank(alice);
        vm.expectRevert(KaddCopyKuru.Invalid.selector);
        vault.follow{value: 1 ether}(address(0), 1 ether, 3 ether, true);
        vm.expectRevert(KaddCopyKuru.Invalid.selector);
        vault.follow{value: 1 ether}(leader, 0, 3 ether, true);
        vm.expectRevert(KaddCopyKuru.Invalid.selector);
        vault.follow{value: 1 ether}(leader, 2 ether, 1 ether, true);
        vm.expectRevert(KaddCopyKuru.Invalid.selector);
        vault.follow(leader, 1 ether, 3 ether, true);
        vm.stopPrank();
    }

    function test_buyThenSellRoundTrip() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        uint256 got = _buy(id, TX1);
        assertEq(got, 1000 ether);
        assertEq(vault.held(id, address(chog)), got);
        assertEq(vault.get(id).cash, 9 ether);
        assertEq(vault.tokensOf(id).length, 1);

        vm.prank(keeper);
        uint256 mon = vault.copySell(id, address(chog), TX2, 1, abi.encodeCall(MockRouter.sell, (chog, got, address(vault), 0)));
        assertEq(mon, 1 ether);
        assertEq(vault.held(id, address(chog)), 0);
        assertEq(vault.get(id).cash, 10 ether);
        assertEq(chog.allowance(address(vault), address(router)), 0); // approval reset
    }

    function test_buyOutputSentElsewhereReverts() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(KaddCopyKuru.Underdelivered.selector, 0, 1));
        vault.copyBuy(id, address(chog), TX1, 1, _buyData(thief, 0, 0));
        assertEq(address(vault).balance, 10 ether);
    }

    function test_buyUnderdeliveryReverts() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(KaddCopyKuru.Underdelivered.selector, 5 ether, 900 ether));
        vault.copyBuy(id, address(chog), TX1, 900 ether, _buyData(address(vault), 5 ether, 0));
    }

    function test_buyRefundIsCredited() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        vm.prank(keeper);
        vault.copyBuy(id, address(chog), TX1, 1, _buyData(address(vault), 0, 0.4 ether));
        assertEq(vault.get(id).cash, 9.4 ether); // only what the route kept
        assertEq(vault.get(id).spentToday, 0.6 ether);
    }

    function test_sellMonSentElsewhereReverts() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        uint256 got = _buy(id, TX1);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(KaddCopyKuru.Underdelivered.selector, 0, 1));
        vault.copySell(id, address(chog), TX2, 1, abi.encodeCall(MockRouter.sell, (chog, got, thief, 0)));
    }

    function test_sellCannotTakeMoreThanThePosition() public {
        uint256 a = _follow(1 ether, 3 ether, true, 10 ether);
        uint256 b = _follow(1 ether, 3 ether, true, 10 ether);
        _buy(a, TX1);
        uint256 gotB = _buy(b, TX1);
        // The router tries to pull both vaults' tokens while selling only a's.
        vm.prank(keeper);
        vm.expectRevert();
        vault.copySell(a, address(chog), TX2, 1, abi.encodeCall(MockRouter.greedy, (chog, 2 * gotB)));
        assertEq(chog.balanceOf(address(vault)), 2 * gotB);
    }

    function test_dailyCap() public {
        uint256 id = _follow(1 ether, 2 ether, true, 10 ether);
        _buy(id, TX1);
        _buy(id, TX2);
        vm.prank(keeper);
        vm.expectRevert(KaddCopyKuru.OverDailyCap.selector);
        vault.copyBuy(id, address(chog), keccak256("tx3"), 1, _buyData(address(vault), 0, 0));
        vm.warp(block.timestamp + 1 days);
        _buy(id, keccak256("tx3"));
    }

    function test_eachLeaderTradeOnce() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        _buy(id, TX1);
        vm.prank(keeper);
        vm.expectRevert(KaddCopyKuru.AlreadyCopied.selector);
        vault.copyBuy(id, address(chog), TX1, 1, _buyData(address(vault), 0, 0));
    }

    function test_onlyKeeper() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        vm.prank(alice);
        vm.expectRevert(KaddCopyKuru.NotKeeper.selector);
        vault.copyBuy(id, address(chog), TX1, 1, _buyData(address(vault), 0, 0));
    }

    function test_pauseStopsCopiesButNotClose() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        uint256 got = _buy(id, TX1);
        vault.pause(true);
        vm.prank(keeper);
        vm.expectRevert(KaddCopyKuru.IsPaused.selector);
        vault.copyBuy(id, address(chog), TX2, 1, _buyData(address(vault), 0, 0));

        uint256 before = alice.balance;
        vm.prank(alice);
        vault.close(id);
        assertEq(alice.balance, before + 9 ether);
        assertEq(chog.balanceOf(alice), got);
        assertFalse(vault.get(id).active);
        assertEq(address(vault).balance, 0);
    }

    function test_onlyOwnerCloses() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        vm.prank(thief);
        vm.expectRevert(KaddCopyKuru.NotOwner.selector);
        vault.close(id);
    }

    function test_adminOnly() public {
        vm.startPrank(thief);
        vm.expectRevert(KaddCopyKuru.NotAdmin.selector);
        vault.setRouter(thief);
        vm.expectRevert(KaddCopyKuru.NotAdmin.selector);
        vault.setKeeper(thief);
        vm.expectRevert(KaddCopyKuru.NotAdmin.selector);
        vault.pause(true);
        vm.stopPrank();
    }

    function test_failedRouteReverts() public {
        uint256 id = _follow(1 ether, 3 ether, true, 10 ether);
        vm.prank(keeper);
        vm.expectRevert();
        vault.copyBuy(id, address(chog), TX1, 1, hex"deadbeef");
        assertEq(vault.get(id).cash, 10 ether);
    }
}
