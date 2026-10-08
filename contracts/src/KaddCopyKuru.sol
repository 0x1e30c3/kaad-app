// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/*
 * MAINNET auto copy trading through Kuru Flow. NOT DEPLOYED: it holds real funds, so deploying it (and who holds the
 * admin key) is the team's decision.
 *
 * A follower funds a vault with MON and picks a leader. When the leader trades, the keeper asks the Kuru Flow API for
 * a route with the vault as `userAddress` and passes the calldata here. The vault calls only the allow-listed router.
 * The router pays msg.sender (fork-tested), and the balance checks below are what bind the output to this vault.
 *
 * Trust model: the keeper picks *when* and *the route*. The contract bounds what a bad route can do:
 *   - a buy sends at most `perTrade` MON, and buys together at most `dailyCap` per UTC day,
 *   - a buy must raise the vault's own balance of the token by at least `minOut`, so a route that sends the output
 *     anywhere else reverts; a sell must raise the vault's MON by at least `minOut`,
 *   - a sell approves exactly the position to the router and resets the approval after,
 *   - each leader trade (tx hash + token) is copied once,
 *   - the admin can pause new copies; the owner can always close and get every MON and token back, paused or not.
 * `minOut` is keeper-supplied (from the quote), so a hostile keeper could still trade badly within the limits: users
 * should keep limits small.
 */
contract KaddCopyKuru is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Follow {
        address owner;
        address leader;
        uint128 perTrade; // MON (wei) per copied buy
        uint128 dailyCap; // MON all copied buys may spend per UTC day
        uint128 cash; // MON in the vault
        uint128 spentToday;
        uint64 day;
        uint64 since; // leader trades before this aren't copied (the keeper honours it)
        bool copySells;
        bool active;
    }

    address public immutable admin;
    address public keeper;
    address public router;
    bool public paused;

    Follow[] internal _follows;
    mapping(address => uint256[]) internal _byOwner;
    mapping(uint256 => mapping(address => uint256)) public held;
    mapping(uint256 => address[]) internal _tokens;
    mapping(uint256 => mapping(bytes32 => bool)) public copied;

    event Followed(uint256 indexed id, address indexed owner, address indexed leader, uint256 perTrade, uint256 dailyCap, bool copySells, uint256 deposit);
    event Funded(uint256 indexed id, uint256 amount);
    event Copied(uint256 indexed id, bytes32 indexed leaderTx, address indexed token, bool isBuy, uint256 amountIn, uint256 amountOut);
    event Closed(uint256 indexed id, uint256 cash);
    event KeeperChanged(address keeper);
    event RouterChanged(address router);
    event Paused(bool paused);

    error NotOwner();
    error NotKeeper();
    error NotAdmin();
    error Invalid();
    error Inactive();
    error IsPaused();
    error AlreadyCopied();
    error OverDailyCap();
    error NothingToSell();
    error RouteFailed(bytes reason);
    error Underdelivered(uint256 got, uint256 minOut);

    constructor(address keeper_, address router_) {
        admin = msg.sender;
        keeper = keeper_;
        router = router_;
    }

    /// The router may refund unspent MON or pay out sells in native MON.
    receive() external payable {}

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        if (paused) revert IsPaused();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ---------------------------------------------------------------- follower

    function follow(address leader, uint128 perTrade, uint128 dailyCap, bool copySells) external payable nonReentrant returns (uint256 id) {
        if (leader == address(0) || perTrade == 0 || dailyCap < perTrade || msg.value == 0 || msg.value > type(uint128).max) revert Invalid();
        id = _follows.length;
        _follows.push(Follow(msg.sender, leader, perTrade, dailyCap, uint128(msg.value), 0, _today(), uint64(block.timestamp), copySells, true));
        _byOwner[msg.sender].push(id);
        emit Followed(id, msg.sender, leader, perTrade, dailyCap, copySells, msg.value);
    }

    function fund(uint256 id) external payable nonReentrant {
        Follow storage f = _owned(id);
        if (!f.active || msg.value == 0) revert Invalid();
        f.cash += uint128(msg.value);
        emit Funded(id, msg.value);
    }

    /// Stops copying and returns the vault: all MON and every token it holds. Always available, even when paused.
    function close(uint256 id) external nonReentrant {
        Follow storage f = _owned(id);
        if (!f.active) revert Inactive();
        f.active = false;
        uint256 cash = f.cash;
        f.cash = 0;
        address[] storage tokens = _tokens[id];
        for (uint256 i; i < tokens.length; ++i) {
            uint256 amount = held[id][tokens[i]];
            if (amount == 0) continue;
            held[id][tokens[i]] = 0;
            IERC20(tokens[i]).safeTransfer(f.owner, amount);
        }
        if (cash > 0) {
            (bool ok,) = f.owner.call{value: cash}("");
            if (!ok) revert Invalid();
        }
        emit Closed(id, cash);
    }

    // ---------------------------------------------------------------- keeper

    /// Mirrors a leader buy of `token`: sends at most `perTrade` MON through the router with Kuru Flow `data`.
    function copyBuy(uint256 id, address token, bytes32 leaderTx, uint256 minOut, bytes calldata data)
        external
        nonReentrant
        onlyKeeper
        returns (uint256 got)
    {
        Follow storage f = _active(id);
        _mark(id, token, leaderTx);
        uint64 today = _today();
        if (f.day != today) (f.day, f.spentToday) = (today, 0);
        uint128 amountIn = f.perTrade < f.cash ? f.perTrade : f.cash;
        if (amountIn == 0 || f.spentToday + amountIn > f.dailyCap) revert OverDailyCap();

        uint256 monBefore = address(this).balance;
        uint256 tokBefore = IERC20(token).balanceOf(address(this));
        _route(amountIn, data);
        got = IERC20(token).balanceOf(address(this)) - tokBefore;
        if (got == 0 || got < minOut) revert Underdelivered(got, minOut);
        uint256 spent = monBefore - address(this).balance; // what the route really took (it may refund some)
        if (spent > amountIn) revert Invalid();

        f.cash -= uint128(spent);
        f.spentToday += uint128(spent);
        if (held[id][token] == 0 && !_has(id, token)) _tokens[id].push(token);
        held[id][token] += got;
        emit Copied(id, leaderTx, token, true, spent, got);
    }

    /// Mirrors a leader sell: routes the vault's whole position in `token` back to MON.
    function copySell(uint256 id, address token, bytes32 leaderTx, uint256 minOut, bytes calldata data)
        external
        nonReentrant
        onlyKeeper
        returns (uint256 got)
    {
        Follow storage f = _active(id);
        if (!f.copySells) revert Invalid();
        _mark(id, token, leaderTx);
        uint256 amountIn = held[id][token];
        if (amountIn == 0) revert NothingToSell();

        uint256 monBefore = address(this).balance;
        uint256 tokBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).forceApprove(router, amountIn);
        _route(0, data);
        IERC20(token).forceApprove(router, 0);
        got = address(this).balance - monBefore;
        if (got == 0 || got < minOut) revert Underdelivered(got, minOut);
        uint256 sold = tokBefore - IERC20(token).balanceOf(address(this)); // ≤ amountIn: the approval caps it

        held[id][token] = amountIn - sold;
        f.cash += uint128(got);
        emit Copied(id, leaderTx, token, false, sold, got);
    }

    // ---------------------------------------------------------------- admin

    function setKeeper(address keeper_) external onlyAdmin {
        keeper = keeper_;
        emit KeeperChanged(keeper_);
    }

    function setRouter(address router_) external onlyAdmin {
        if (router_ == address(0)) revert Invalid();
        router = router_;
        emit RouterChanged(router_);
    }

    function pause(bool paused_) external onlyAdmin {
        paused = paused_;
        emit Paused(paused_);
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

    function tokensOf(uint256 id) external view returns (address[] memory) {
        return _tokens[id];
    }

    // ---------------------------------------------------------------- internal

    function _route(uint256 value, bytes calldata data) internal {
        (bool ok, bytes memory reason) = router.call{value: value}(data);
        if (!ok) revert RouteFailed(reason);
    }

    function _owned(uint256 id) internal view returns (Follow storage f) {
        f = _follows[id];
        if (msg.sender != f.owner) revert NotOwner();
    }

    function _active(uint256 id) internal view returns (Follow storage f) {
        f = _follows[id];
        if (!f.active) revert Inactive();
    }

    function _mark(uint256 id, address token, bytes32 leaderTx) internal {
        if (token == address(0)) revert Invalid();
        bytes32 key = keccak256(abi.encode(leaderTx, token));
        if (copied[id][key]) revert AlreadyCopied();
        copied[id][key] = true;
    }

    function _has(uint256 id, address token) internal view returns (bool) {
        address[] storage tokens = _tokens[id];
        for (uint256 i; i < tokens.length; ++i) {
            if (tokens[i] == token) return true;
        }
        return false;
    }

    function _today() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }
}
