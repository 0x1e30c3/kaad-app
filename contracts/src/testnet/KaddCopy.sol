// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {KaddPool, KaddVenue} from "./KaddVenue.sol";

/*
 * TESTNET ONLY. Auto copy trading: a follower funds a vault with tUSDC and picks a leader (a Monad mainnet wallet).
 * Whenever the leader trades a token Kadd mirrors, the keeper copies it into the follower's vault on the Kadd venue.
 *
 * Trust model: the contract can't see mainnet, so the keeper decides *when* a copy happens. Everything else is
 * enforced here, so a buggy or hostile keeper can't take funds:
 *   - copies only trade the venue's own mirror pool for a token (resolved here, never passed in),
 *   - a buy spends at most `perTrade`, and buys together at most `dailyCap` per UTC day,
 *   - each leader trade (tx hash + token) is copied once,
 *   - output always stays in the follower's vault, and the follower can close at any time to get everything back.
 */
contract KaddCopy is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Follow {
        address owner;
        address leader;
        uint128 perTrade; // tUSDC per copied buy
        uint128 dailyCap; // tUSDC all copied buys may spend per UTC day
        uint128 cash; // tUSDC in the vault
        uint128 spentToday;
        uint64 day; // UTC day `spentToday` belongs to
        uint64 since; // leader trades before this aren't copied (the keeper honours it; recorded for anyone to check)
        bool copySells; // exit the position when the leader sells
        bool active;
    }

    KaddVenue public immutable venue;
    IERC20 public immutable usdc;
    address public immutable admin;
    address public keeper;

    Follow[] internal _follows;
    mapping(address => uint256[]) internal _byOwner;
    /// Mirror tokens a follow holds, per pool.
    mapping(uint256 => mapping(address => uint256)) public held;
    mapping(uint256 => address[]) internal _pools;
    /// keccak(leader tx hash, mainnet token) already copied for a follow.
    mapping(uint256 => mapping(bytes32 => bool)) public copied;

    event Followed(uint256 indexed id, address indexed owner, address indexed leader, uint256 perTrade, uint256 dailyCap, bool copySells, uint256 deposit);
    event Funded(uint256 indexed id, uint256 amount);
    event Copied(uint256 indexed id, bytes32 indexed leaderTx, address indexed pool, bool isBuy, uint256 amountIn, uint256 amountOut);
    event Closed(uint256 indexed id, uint256 cash);
    event KeeperChanged(address keeper);

    error NotOwner();
    error NotKeeper();
    error NotAdmin();
    error Invalid();
    error Inactive();
    error NoPool();
    error AlreadyCopied();
    error OverDailyCap();
    error NothingToSell();

    constructor(KaddVenue venue_, address keeper_) {
        venue = venue_;
        usdc = IERC20(address(venue_.usdc()));
        admin = msg.sender;
        keeper = keeper_;
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    // ---------------------------------------------------------------- follower

    function follow(address leader, uint128 perTrade, uint128 dailyCap, bool copySells, uint128 deposit)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (leader == address(0) || perTrade == 0 || dailyCap < perTrade || deposit == 0) revert Invalid();
        id = _follows.length;
        _follows.push(Follow(msg.sender, leader, perTrade, dailyCap, deposit, 0, _today(), uint64(block.timestamp), copySells, true));
        _byOwner[msg.sender].push(id);
        usdc.safeTransferFrom(msg.sender, address(this), deposit);
        emit Followed(id, msg.sender, leader, perTrade, dailyCap, copySells, deposit);
    }

    function fund(uint256 id, uint128 amount) external nonReentrant {
        Follow storage f = _owned(id);
        if (!f.active) revert Inactive();
        f.cash += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(id, amount);
    }

    /// Stops copying and returns the vault: all tUSDC and every mirror token it holds. Always available.
    function close(uint256 id) external nonReentrant {
        Follow storage f = _owned(id);
        if (!f.active) revert Inactive();
        f.active = false;
        uint256 cash = f.cash;
        f.cash = 0;
        if (cash > 0) usdc.safeTransfer(f.owner, cash);
        address[] storage pools = _pools[id];
        for (uint256 i; i < pools.length; ++i) {
            uint256 amount = held[id][pools[i]];
            if (amount == 0) continue;
            held[id][pools[i]] = 0;
            IERC20(KaddPool(pools[i]).baseToken()).safeTransfer(f.owner, amount);
        }
        emit Closed(id, cash);
    }

    // ---------------------------------------------------------------- keeper

    /// Mirrors a leader buy of mainnet token `source`: spends `perTrade` (or what's left) on its Kadd pool.
    function copyBuy(uint256 id, address source, bytes32 leaderTx, uint256 minOut) external nonReentrant onlyKeeper returns (uint256 out) {
        Follow storage f = _active(id);
        KaddPool pool = _mark(id, source, leaderTx);
        uint64 today = _today();
        if (f.day != today) (f.day, f.spentToday) = (today, 0);
        uint128 amountIn = f.perTrade < f.cash ? f.perTrade : f.cash;
        if (amountIn == 0 || f.spentToday + amountIn > f.dailyCap) revert OverDailyCap();
        f.cash -= amountIn;
        f.spentToday += amountIn;

        usdc.forceApprove(address(pool), amountIn);
        out = pool.swapExact(true, amountIn, minOut, uint64(block.timestamp), address(this));
        if (held[id][address(pool)] == 0 && !_has(id, address(pool))) _pools[id].push(address(pool));
        held[id][address(pool)] += out;
        emit Copied(id, leaderTx, address(pool), true, amountIn, out);
    }

    /// Mirrors a leader sell: exits the follow's whole position in that token (we can't know what share they sold).
    function copySell(uint256 id, address source, bytes32 leaderTx, uint256 minOut) external nonReentrant onlyKeeper returns (uint256 out) {
        Follow storage f = _active(id);
        if (!f.copySells) revert Invalid();
        KaddPool pool = _mark(id, source, leaderTx);
        uint256 amountIn = held[id][address(pool)];
        if (amountIn == 0) revert NothingToSell();
        held[id][address(pool)] = 0;

        IERC20(pool.baseToken()).forceApprove(address(pool), amountIn);
        out = pool.swapExact(false, amountIn, minOut, uint64(block.timestamp), address(this));
        f.cash += uint128(out);
        emit Copied(id, leaderTx, address(pool), false, amountIn, out);
    }

    function setKeeper(address keeper_) external {
        if (msg.sender != admin) revert NotAdmin();
        keeper = keeper_;
        emit KeeperChanged(keeper_);
    }

    // ---------------------------------------------------------------- views

    function get(uint256 id) external view returns (Follow memory) {
        return _follows[id];
    }

    function count() external view returns (uint256) {
        return _follows.length;
    }

    function idsOf(address owner) external view returns (uint256[] memory) {
        return _byOwner[owner];
    }

    function poolsOf(uint256 id) external view returns (address[] memory) {
        return _pools[id];
    }

    // ---------------------------------------------------------------- internal

    function _owned(uint256 id) internal view returns (Follow storage f) {
        f = _follows[id];
        if (msg.sender != f.owner) revert NotOwner();
    }

    function _active(uint256 id) internal view returns (Follow storage f) {
        f = _follows[id];
        if (!f.active) revert Inactive();
    }

    /// Resolves the venue's pool for `source` and records the leader trade as copied.
    function _mark(uint256 id, address source, bytes32 leaderTx) internal returns (KaddPool pool) {
        pool = KaddPool(venue.poolOf(source));
        if (address(pool) == address(0)) revert NoPool();
        bytes32 key = keccak256(abi.encode(leaderTx, source));
        if (copied[id][key]) revert AlreadyCopied();
        copied[id][key] = true;
    }

    function _has(uint256 id, address pool) internal view returns (bool) {
        address[] storage pools = _pools[id];
        for (uint256 i; i < pools.length; ++i) {
            if (pools[i] == pool) return true;
        }
        return false;
    }

    function _today() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }
}
