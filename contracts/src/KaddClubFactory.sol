// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccountCore} from "./interfaces/IKuru.sol";
import {KaddClub} from "./KaddClub.sol";

/// @notice Deploys KaddClubs against one Kuru AccountCore and quote token. The caller becomes captain.
contract KaddClubFactory {
    IAccountCore public immutable core;
    IERC20 public immutable quote;
    address[] public clubs;

    event ClubCreated(address indexed club, address indexed captain, string name);

    constructor(IAccountCore core_, IERC20 quote_) {
        core = core_;
        quote = quote_;
    }

    function createClub(string calldata name, uint16 maxTradeBps, address[] calldata markets, uint256[] calldata dust)
        external
        returns (KaddClub club)
    {
        club = new KaddClub(core, quote, name, msg.sender, maxTradeBps, markets, dust);
        clubs.push(address(club));
        emit ClubCreated(address(club), msg.sender, name);
    }

    function clubCount() external view returns (uint256) {
        return clubs.length;
    }
}
