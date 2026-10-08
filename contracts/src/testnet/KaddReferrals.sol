// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * TESTNET ONLY. Invite attribution, onchain so traction numbers can be checked by anyone: a new account records who
 * invited it, once. Nothing is paid; it's a public log the app (and judges) can count, joined with real trades.
 */
contract KaddReferrals {
    mapping(address => address) public referrerOf;

    event Referred(address indexed user, address indexed referrer);

    error Invalid();

    function register(address referrer) external {
        if (referrer == address(0) || referrer == msg.sender || referrerOf[msg.sender] != address(0)) revert Invalid();
        referrerOf[msg.sender] = referrer;
        emit Referred(msg.sender, referrer);
    }
}
