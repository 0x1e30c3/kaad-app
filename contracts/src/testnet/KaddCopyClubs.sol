// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {KaddPool, KaddVenue} from "./KaddVenue.sol";

/*
 * TESTNET ONLY. Copy clubs: friends pool tUSDC into one vault that auto-copies a leader (a Monad mainnet wallet).
 * KaddCopy's rules, shared by many members:
 *   - Rules (leader, per-trade and daily limits as a share of the club's cash, copy sells) are fixed at creation.
 *   - Deposits are only accepted while the club is flat (holds no tokens), priced at cash per share. Positions are
 *     never valued at a pool price, so nobody can join or dilute others at a manipulated price.
 *   - Redeem is in kind and always available: pro-rata cash plus pro-rata of every token held.
 *   - The keeper decides *when* to copy; the contract decides what's allowed: only the venue's pool for the token,
 *     at most `perTradeBps` of cash per buy and `dailyCapBps` of the day's starting cash per UTC day, each leader trade
 *     once, output stays in the club.
 */
contract KaddCopyClubs is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 10_000;

    struct Club {
        string name;
        address creator;
        address leader;
        uint16 perTradeBps; // share of current cash a copied buy spends
        uint16 dailyCapBps; // share of the day's starting cash all copied buys may spend per UTC day
        bool copySells; // exit the position when the leader sells
        uint32 holding; // pools with a nonzero position; 0 = flat, deposits open
        uint64 day; // UTC day `spentToday` and `dayBase` belong to
        uint64 since; // leader trades before this aren't copied (the keeper honours it)
        uint128 cash; // tUSDC in the club
        uint128 totalShares;
        uint128 spentToday;
        uint128 dayBase; // cash when the day's first copied buy happened
    }

    KaddVenue public immutable venue;
    IERC20 public immutable usdc;
    address public immutable admin;
    address public keeper;

    Club[] internal _clubs;
    mapping(uint256 => mapping(address => uint256)) public sharesOf;
    /// Mirror tokens a club holds, per pool.
    mapping(uint256 => mapping(address => uint256)) public held;
    mapping(uint256 => address[]) internal _pools;
    /// keccak(leader tx hash, mainnet token) already copied for a club.
    mapping(uint256 => mapping(bytes32 => bool)) public copied;

    event ClubCreated(uint256 indexed id, address indexed creator, address indexed leader, string name, uint256 perTradeBps, uint256 dailyCapBps, bool copySells);
    event Deposited(uint256 indexed id, address indexed member, uint256 amount, uint256 shares);
    event Redeemed(uint256 indexed id, address indexed member, uint256 shares, uint256 cash);
    event Copied(uint256 indexed id, bytes32 indexed leaderTx, address indexed pool, bool isBuy, uint256 amountIn, uint256 amountOut);
    event KeeperChanged(address keeper);

    error NotKeeper();
    error NotAdmin();
    error Invalid();
    error NotFlat();
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

    // ---------------------------------------------------------------- members

    function create(string calldata name, address leader, uint16 perTradeBps, uint16 dailyCapBps, bool copySells)
        external
        returns (uint256 id)
    {
        if (leader == address(0) || bytes(name).length == 0 || bytes(name).length > 48) revert Invalid();
        if (perTradeBps == 0 || dailyCapBps < perTradeBps || dailyCapBps > BPS) revert Invalid();
        id = _clubs.length;
        Club storage c = _clubs.push();
        (c.name, c.creator, c.leader) = (name, msg.sender, leader);
        (c.perTradeBps, c.dailyCapBps, c.copySells) = (perTradeBps, dailyCapBps, copySells);
        (c.day, c.since) = (_today(), uint64(block.timestamp));
        emit ClubCreated(id, msg.sender, leader, name, perTradeBps, dailyCapBps, copySells);
    }

    /// Joins (or adds to) a club while it's flat, at cash per share; the first deposit mints 1:1.
    function deposit(uint256 id, uint128 amount) external nonReentrant returns (uint256 shares) {
        Club storage c = _clubs[id];
        if (amount == 0) revert Invalid();
        if (c.holding != 0) revert NotFlat();
        if (c.totalShares == 0) shares = amount;
        else if (c.cash == 0) revert Invalid(); // shares outstanding but nothing behind them
        else shares = uint256(amount) * c.totalShares / c.cash;
        if (shares == 0) revert Invalid();
        c.cash += amount;
        c.totalShares += uint128(shares);
        sharesOf[id][msg.sender] += shares;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(id, msg.sender, amount, shares);
    }

    /// Exits `shares` in kind: pro-rata cash and pro-rata of every token the club holds. Always available.
    function redeem(uint256 id, uint256 shares) external nonReentrant returns (uint256 cash) {
        Club storage c = _clubs[id];
        if (shares == 0 || shares > sharesOf[id][msg.sender]) revert Invalid();
        uint256 total = c.totalShares;
        sharesOf[id][msg.sender] -= shares;
        c.totalShares = uint128(total - shares);

        cash = uint256(c.cash) * shares / total;
        c.cash -= uint128(cash);
        if (cash > 0) usdc.safeTransfer(msg.sender, cash);
        address[] storage pools = _pools[id];
        for (uint256 i; i < pools.length; ++i) {
            uint256 h = held[id][pools[i]];
            if (h == 0) continue;
            uint256 out = h * shares / total;
            if (out == 0) continue;
            held[id][pools[i]] = h - out;
            if (h == out) c.holding -= 1;
            IERC20(KaddPool(pools[i]).baseToken()).safeTransfer(msg.sender, out);
        }
        emit Redeemed(id, msg.sender, shares, cash);
    }

    // ---------------------------------------------------------------- keeper

    /// Mirrors a leader buy of mainnet token `source`: spends `perTradeBps` of the club's cash on its Kadd pool.
    function copyBuy(uint256 id, address source, bytes32 leaderTx, uint256 minOut) external nonReentrant onlyKeeper returns (uint256 out) {
        Club storage c = _clubs[id];
        KaddPool pool = _mark(id, source, leaderTx);
        uint64 today = _today();
        if (c.day != today || c.dayBase == 0) (c.day, c.spentToday, c.dayBase) = (today, 0, c.cash);
        uint128 amountIn = uint128(uint256(c.cash) * c.perTradeBps / BPS);
        if (amountIn == 0 || uint256(c.spentToday) + amountIn > uint256(c.dayBase) * c.dailyCapBps / BPS) revert OverDailyCap();
        c.cash -= amountIn;
        c.spentToday += amountIn;

        usdc.forceApprove(address(pool), amountIn);
        out = pool.swapExact(true, amountIn, minOut, uint64(block.timestamp), address(this));
        if (held[id][address(pool)] == 0) {
            c.holding += 1;
            if (!_has(id, address(pool))) _pools[id].push(address(pool));
        }
        held[id][address(pool)] += out;
        emit Copied(id, leaderTx, address(pool), true, amountIn, out);
    }

    /// Mirrors a leader sell: exits the club's whole position in that token.
    function copySell(uint256 id, address source, bytes32 leaderTx, uint256 minOut) external nonReentrant onlyKeeper returns (uint256 out) {
        Club storage c = _clubs[id];
        if (!c.copySells) revert Invalid();
        KaddPool pool = _mark(id, source, leaderTx);
        uint256 amountIn = held[id][address(pool)];
        if (amountIn == 0) revert NothingToSell();
        held[id][address(pool)] = 0;
        c.holding -= 1;

        IERC20(pool.baseToken()).forceApprove(address(pool), amountIn);
        out = pool.swapExact(false, amountIn, minOut, uint64(block.timestamp), address(this));
        c.cash += uint128(out);
        emit Copied(id, leaderTx, address(pool), false, amountIn, out);
    }

    function setKeeper(address keeper_) external {
        if (msg.sender != admin) revert NotAdmin();
        keeper = keeper_;
        emit KeeperChanged(keeper_);
    }

    // ---------------------------------------------------------------- views

    function get(uint256 id) external view returns (Club memory) {
        return _clubs[id];
    }

    function count() external view returns (uint256) {
        return _clubs.length;
    }

    function poolsOf(uint256 id) external view returns (address[] memory) {
        return _pools[id];
    }

    function isFlat(uint256 id) external view returns (bool) {
        return _clubs[id].holding == 0;
    }

    // ---------------------------------------------------------------- internal

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
