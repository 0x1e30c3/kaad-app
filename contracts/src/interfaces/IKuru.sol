// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal Kuru Spot V2 surface used by KaddClub.
/// Signatures taken from @toxicflow-labs/ts-sdk 0.3.0 ABIs (contracts rev cdac5ae1).

struct SwapResult {
    uint128 amountInUsed;
    uint128 amountOut;
}

interface IAccountCore {
    function deposit(address rootOwner, address token, uint256 amount) external payable;
    function withdraw(uint40 rootAccountId, address token, uint256 amount, address recipient) external;
    function rootAccountIdOf(address owner) external view returns (uint40);
    function getBalance(uint40 accountId, address token) external view returns (uint256);
    function getSpotReservedBalance(uint40 accountId, address token) external view returns (uint256);
    function verifiedSpotOrderBook(address market) external view returns (bool);
}

interface IOrderBook {
    function swap(uint40 userId, bool isBuy, uint128 amountIn, uint128 minAmountOut, uint64 deadline)
        external
        returns (SwapResult memory);
    function baseToken() external view returns (address);
    function quoteToken() external view returns (address);
    function accountCore() external view returns (address);
}
