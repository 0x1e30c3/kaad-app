// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {KaddReferrals} from "../src/testnet/KaddReferrals.sol";

contract KaddReferralsTest is Test {
    KaddReferrals refs = new KaddReferrals();
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function test_registersOnce() public {
        vm.expectEmit(address(refs));
        emit KaddReferrals.Referred(bob, alice);
        vm.prank(bob);
        refs.register(alice);
        assertEq(refs.referrerOf(bob), alice);

        vm.prank(bob);
        vm.expectRevert(KaddReferrals.Invalid.selector);
        refs.register(makeAddr("carol"));
    }

    function test_rejectsSelfAndZero() public {
        vm.startPrank(bob);
        vm.expectRevert(KaddReferrals.Invalid.selector);
        refs.register(bob);
        vm.expectRevert(KaddReferrals.Invalid.selector);
        refs.register(address(0));
        vm.stopPrank();
    }
}
