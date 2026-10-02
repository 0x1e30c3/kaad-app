// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {KaddPool, KaddVenue} from "./KaddVenue.sol";

/*
 * TESTNET ONLY. Onchain conditional orders against KaddVenue pools: limit buys, take-profit / stop-loss sells and DCA.
 *
 * The owner locks the input up front. Anyone may call `execute` once the strategy's condition holds — the pool's own
 * spot price is the trigger, so there's no oracle — and the output always goes to the owner. Fast blocks are what make
 * this usable: a crossed trigger is filled within a block or two by whoever is watching (the app, or a keeper cron).
 * The owner can cancel at any time and gets the unspent input back.
 */
contract KaddStrategies is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Strategy {
        address owner;
        address pool;
        bool isBuy; // buys spend tUSDC for the base token; sells spend the base token for tUSDC
        bool above; // trigger direction: execute when price >= trigger (true) or <= trigger (false)
        uint128 trigger; // pool.price() units (quote atoms per 1e18 base atoms); 0 = no price condition
        uint128 perExec; // input spent per execution
        uint128 remaining; // input still locked
        uint32 interval; // seconds between executions (DCA); 0 = single shot
        uint64 nextAt; // earliest next execution
    }

    KaddVenue public immutable venue;
    Strategy[] internal _strategies;
    mapping(address => uint256[]) internal _byOwner;

    event Created(uint256 indexed id, address indexed owner, address indexed pool, bool isBuy, uint256 amount);
    event Executed(uint256 indexed id, address indexed executor, uint256 amountIn, uint256 amountOut, uint256 price);
    event Cancelled(uint256 indexed id, uint256 refunded);

    error UnknownPool();
    error InvalidStrategy();
    error NotOwner();
    error NotReady();

    constructor(KaddVenue venue_) {
        venue = venue_;
    }

    /// Locks `amount` of the input token. `perExec` = amount for a single-shot order, or the slice per DCA run.
    function create(address pool, bool isBuy, uint128 amount, uint128 perExec, uint128 trigger, bool above, uint32 interval)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (!venue.core().verifiedSpotOrderBook(pool)) revert UnknownPool();
        if (amount == 0 || perExec == 0 || perExec > amount) revert InvalidStrategy();
        if (trigger == 0 && interval == 0) revert InvalidStrategy(); // would be a plain market order
        if (interval == 0 && perExec != amount) revert InvalidStrategy(); // single shot spends everything at once

        id = _strategies.length;
        _strategies.push(Strategy(msg.sender, pool, isBuy, above, trigger, perExec, amount, interval, uint64(block.timestamp)));
        _byOwner[msg.sender].push(id);
        IERC20(_tokenIn(pool, isBuy)).safeTransferFrom(msg.sender, address(this), amount);
        emit Created(id, msg.sender, pool, isBuy, amount);
    }

    /// Fills one run of a strategy whose condition holds. Callable by anyone; proceeds go to the owner.
    function execute(uint256 id) external nonReentrant returns (uint256 out) {
        Strategy storage s = _strategies[id];
        if (!ready(id)) revert NotReady();
        uint128 amountIn = s.perExec < s.remaining ? s.perExec : s.remaining;
        s.remaining -= amountIn;
        s.nextAt = uint64(block.timestamp) + s.interval;

        KaddPool pool = KaddPool(s.pool);
        IERC20(_tokenIn(s.pool, s.isBuy)).forceApprove(s.pool, amountIn);
        // The trigger is the price protection: it was just checked against this very pool in this transaction.
        out = pool.swapExact(s.isBuy, amountIn, 1, uint64(block.timestamp), s.owner);
        emit Executed(id, msg.sender, amountIn, out, pool.price());
    }

    function cancel(uint256 id) external nonReentrant {
        Strategy storage s = _strategies[id];
        if (msg.sender != s.owner) revert NotOwner();
        uint128 refund = s.remaining;
        s.remaining = 0;
        if (refund > 0) IERC20(_tokenIn(s.pool, s.isBuy)).safeTransfer(s.owner, refund);
        emit Cancelled(id, refund);
    }

    // ---------------------------------------------------------------- views

    /// True when `execute(id)` would go through right now.
    function ready(uint256 id) public view returns (bool) {
        Strategy storage s = _strategies[id];
        if (s.remaining == 0 || block.timestamp < s.nextAt) return false;
        if (s.trigger == 0) return true;
        uint256 p = KaddPool(s.pool).price();
        return s.above ? p >= s.trigger : p <= s.trigger;
    }

    function get(uint256 id) external view returns (Strategy memory) {
        return _strategies[id];
    }

    function count() external view returns (uint256) {
        return _strategies.length;
    }

    function idsOf(address owner) external view returns (uint256[] memory) {
        return _byOwner[owner];
    }

    /// Ready strategy ids in [from, to) — what a keeper polls. Bounded range keeps the call cheap as the list grows.
    function readyIds(uint256 from, uint256 to) external view returns (uint256[] memory ids) {
        if (to > _strategies.length) to = _strategies.length;
        uint256[] memory buf = new uint256[](to > from ? to - from : 0);
        uint256 n;
        for (uint256 i = from; i < to; ++i) {
            if (ready(i)) buf[n++] = i;
        }
        ids = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = buf[i];
        }
    }

    function _tokenIn(address pool, bool isBuy) internal view returns (address) {
        return isBuy ? KaddPool(pool).quoteToken() : KaddPool(pool).baseToken();
    }
}
