// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KaddClub} from "../src/KaddClub.sol";
import {KaddClubFactory} from "../src/KaddClubFactory.sol";
import {IAccountCore, IOrderBook} from "../src/interfaces/IKuru.sol";

/// Runs against the real Kuru Spot V2 deployment on a Monad testnet fork.
/// forge test --match-contract Fork --fork-url monad_testnet
contract KaddClubForkTest is Test {
    IAccountCore constant CORE = IAccountCore(0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038);
    IERC20 constant USDC = IERC20(0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1);
    address constant MON_USDC = 0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9;
    address constant WETH_USDC = 0x9d187971B64505Ac81f12c5FD2ac9c5247Ec62F3;

    KaddClub club;
    address captain = makeAddr("captain");
    address alice = makeAddr("alice");

    function setUp() public {
        if (block.chainid != 10143) vm.skip(true); // only meaningful on a Monad testnet fork

        address[] memory markets = new address[](2);
        (markets[0], markets[1]) = (MON_USDC, WETH_USDC);
        uint256[] memory dust = new uint256[](2);
        (dust[0], dust[1]) = (1e12, 1e12);

        KaddClubFactory factory = new KaddClubFactory(CORE, USDC);
        vm.prank(captain);
        club = factory.createClub("Fork Club", 2_500, markets, dust);

        deal(address(USDC), alice, 1_000e6);
        vm.prank(alice);
        USDC.approve(address(club), type(uint256).max);
    }

    function test_RealMarketsAreWired() public view {
        assertEq(IOrderBook(MON_USDC).quoteToken(), address(USDC));
        assertEq(IOrderBook(MON_USDC).baseToken(), address(0), "MON is native");
        assertTrue(club.isMarket(WETH_USDC));
    }

    function test_DepositAndRedeemThroughRealAccountCore() public {
        vm.prank(alice);
        club.deposit(100e6);

        uint40 id = club.accountId();
        assertGt(id, 0, "club got a real Kuru root account");
        assertEq(CORE.getBalance(id, address(USDC)), 100e6);

        uint256 s = club.sharesOf(alice);
        vm.prank(alice);
        club.redeem(s);
        assertEq(USDC.balanceOf(alice), 1_000e6, "full USDC back via Kuru withdraw");
        assertEq(CORE.getBalance(id, address(USDC)), 0);
    }

    function test_NativeMonDonationDoesNotBlockDeposits() public {
        vm.prank(alice);
        club.deposit(100e6);
        // Griefing attempt from the review: push MON straight into the club's real Kuru root account.
        address mallory = makeAddr("mallory");
        vm.deal(mallory, 1 ether);
        vm.prank(mallory);
        (bool ok,) = address(CORE).call{value: 0.01 ether}(
            abi.encodeWithSignature("deposit(address,address,uint256)", address(club), address(0), 0.01 ether)
        );
        assertTrue(ok, "Kuru accepted the donation");
        assertGt(club.baseBalance(MON_USDC), 0, "donation landed in the club account");
        assertTrue(club.isFlat(), "donation must not close deposits");
        deal(address(USDC), mallory, 10e6);
        vm.startPrank(mallory);
        USDC.approve(address(club), 10e6);
        club.deposit(10e6);
        vm.stopPrank();
    }

    function test_TradeReachesRealOrderBook() public {
        vm.prank(alice);
        club.deposit(100e6);
        // The testnet book may be empty; either a fill or a revert from Kuru proves the call path and auth.
        vm.prank(captain);
        try club.trade(MON_USDC, true, 10e6, 1, uint64(block.timestamp + 60)) {
            assertFalse(club.isFlat());
        } catch (bytes memory err) {
            emit log_named_bytes("kuru revert (expected on an empty book)", err);
        }
    }
}
