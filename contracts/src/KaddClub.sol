// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAccountCore, IOrderBook, SwapResult} from "./interfaces/IKuru.sol";

/// @title KaddClub — a friends' trading pool on Kuru.
/// @notice Members pool USDC into one Kuru account owned by this contract. A captain trades it on a fixed
/// set of markets; members can always exit with their pro-rata share of every asset (in-kind).
///
/// Design choices that keep it oracle-free:
/// - Deposits are only accepted while the club is flat: the base the club itself bought (tracked internally,
///   so outside donations can't flip it) is at or below each market's dust bound. The club's value is then
///   its USDC balance. No price feed, nothing to manipulate.
/// - Redemptions pay out each token pro-rata, so they never need a price either.
/// - A token whose withdrawal fails (paused token, Kuru withdrawal limit) doesn't block the others: that part
///   is recorded as owed to the member and can be claimed later. Owed amounts are excluded from everyone's share.
///
/// Trust assumptions: the captain is trusted to trade in good faith. The contract bounds each buy to
/// `maxTradeBps` of the club's USDC (per trade, not cumulative), requires a non-zero `minAmountOut`, and limits
/// trading to markets whitelisted at creation, but a captain could still trade at bad prices within those bounds.
/// The captain can never move funds out of the club; only members can, and only their own share.
///
/// Rounding note: deposits mint against `VIRTUAL_SHARES` to make donation-inflation unprofitable; redemptions pay
/// a plain pro-rata share so the last member out receives everything left.
contract KaddClub is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant VIRTUAL_SHARES = 1e6;
    uint16 public constant MAX_BPS = 10_000;

    IAccountCore public immutable core;
    IERC20 public immutable quote;
    uint16 public immutable maxTradeBps;

    string public name;
    address public captain;
    /// Kuru root account id of this contract; 0 until the first deposit registers it.
    uint40 public accountId;

    address[] internal _markets;
    mapping(address market => bool) public isMarket;
    mapping(address market => uint256) public dustOf;
    /// Base the club acquired through its own trades (net of sells and redemptions). Drives `isFlat`.
    mapping(address market => uint256) public heldOf;

    uint256 public totalShares;
    mapping(address member => uint256) public sharesOf;

    /// Payouts that could not be withdrawn at redeem time, claimable via `claim`.
    mapping(address member => mapping(address token => uint256)) public owedOf;
    mapping(address token => uint256) public totalOwed;

    event Deposited(address indexed member, uint256 amount, uint256 shares);
    event Redeemed(address indexed member, uint256 shares);
    event Payout(address indexed member, address indexed token, uint256 amount);
    event PayoutDeferred(address indexed member, address indexed token, uint256 amount);
    event Traded(address indexed market, bool isBuy, uint256 amountInUsed, uint256 amountOut);
    event CaptainChanged(address indexed previous, address indexed next);

    error NotCaptain();
    error NotFlat();
    error ZeroAmount();
    error ZeroShares();
    error InsufficientShares();
    error MarketNotAllowed();
    error TradeTooLarge(uint256 amountIn, uint256 cap);
    error NoAccount();
    error InvalidConfig();

    modifier onlyCaptain() {
        if (msg.sender != captain) revert NotCaptain();
        _;
    }

    constructor(
        IAccountCore core_,
        IERC20 quote_,
        string memory name_,
        address captain_,
        uint16 maxTradeBps_,
        address[] memory markets_,
        uint256[] memory dust_
    ) {
        if (captain_ == address(0) || maxTradeBps_ == 0 || maxTradeBps_ > MAX_BPS) revert InvalidConfig();
        if (markets_.length == 0 || markets_.length != dust_.length) revert InvalidConfig();

        for (uint256 i; i < markets_.length; ++i) {
            IOrderBook m = IOrderBook(markets_[i]);
            address base = m.baseToken();
            if (
                isMarket[address(m)] || !core_.verifiedSpotOrderBook(address(m))
                    || m.accountCore() != address(core_) || m.quoteToken() != address(quote_)
            ) revert InvalidConfig();
            // One market per base token, so pro-rata payouts never pay the same token twice.
            for (uint256 j; j < i; ++j) {
                if (IOrderBook(markets_[j]).baseToken() == base) revert InvalidConfig();
            }
            isMarket[address(m)] = true;
            dustOf[address(m)] = dust_[i];
            _markets.push(address(m));
        }

        core = core_;
        quote = quote_;
        name = name_;
        captain = captain_;
        maxTradeBps = maxTradeBps_;
    }

    // ---------------------------------------------------------------- members

    /// @notice Add USDC to the club. Only possible while the club is flat.
    function deposit(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();
        if (!isFlat()) revert NotFlat();

        shares = previewDeposit(amount);
        if (shares == 0) revert ZeroShares();

        quote.safeTransferFrom(msg.sender, address(this), amount);
        quote.forceApprove(address(core), amount);
        core.deposit(address(this), address(quote), amount);
        if (accountId == 0) accountId = core.rootAccountIdOf(address(this));

        totalShares += shares;
        sharesOf[msg.sender] += shares;
        emit Deposited(msg.sender, amount, shares);
    }

    /// @notice Burn shares and receive the same fraction of every asset the club holds. Always available.
    /// A token that can't be withdrawn right now is recorded in `owedOf` instead of blocking the rest.
    function redeem(uint256 shares) external nonReentrant {
        if (shares == 0) revert ZeroAmount();
        if (shares > sharesOf[msg.sender]) revert InsufficientShares();

        uint256 supply = totalShares;
        sharesOf[msg.sender] -= shares;
        totalShares = supply - shares;

        _payout(address(quote), shares, supply);
        for (uint256 i; i < _markets.length; ++i) {
            address m = _markets[i];
            heldOf[m] -= heldOf[m] * shares / supply;
            _payout(IOrderBook(m).baseToken(), shares, supply);
        }
        emit Redeemed(msg.sender, shares);
    }

    /// @notice Withdraw a payout that was deferred during `redeem`.
    function claim(address token) external nonReentrant {
        uint256 amount = owedOf[msg.sender][token];
        if (amount == 0) revert ZeroAmount();
        owedOf[msg.sender][token] = 0;
        totalOwed[token] -= amount;
        core.withdraw(accountId, token, amount, msg.sender);
        emit Payout(msg.sender, token, amount);
    }

    // ---------------------------------------------------------------- captain

    /// @notice Exact-input market swap on a whitelisted Kuru market.
    /// Buys spend USDC and are capped at `maxTradeBps` of the club's USDC; sells reduce exposure and are uncapped.
    function trade(address market, bool isBuy, uint128 amountIn, uint128 minAmountOut, uint64 deadline)
        external
        nonReentrant
        onlyCaptain
        returns (SwapResult memory result)
    {
        if (!isMarket[market]) revert MarketNotAllowed();
        if (amountIn == 0 || minAmountOut == 0) revert ZeroAmount();
        if (accountId == 0) revert NoAccount();
        if (isBuy) {
            uint256 cap = quoteBalance() * maxTradeBps / MAX_BPS;
            if (amountIn > cap) revert TradeTooLarge(amountIn, cap);
        }
        result = IOrderBook(market).swap(accountId, isBuy, amountIn, minAmountOut, deadline);
        if (isBuy) {
            heldOf[market] += result.amountOut;
        } else {
            uint256 h = heldOf[market];
            heldOf[market] = result.amountInUsed >= h ? 0 : h - result.amountInUsed;
        }
        emit Traded(market, isBuy, result.amountInUsed, result.amountOut);
    }

    function setCaptain(address next) external onlyCaptain {
        if (next == address(0)) revert InvalidConfig();
        emit CaptainChanged(captain, next);
        captain = next;
    }

    // ---------------------------------------------------------------- views

    function markets() external view returns (address[] memory) {
        return _markets;
    }

    /// Club USDC inside Kuru that belongs to current shareholders (excludes deferred payouts).
    function quoteBalance() public view returns (uint256) {
        return _balance(address(quote));
    }

    /// Base held for a market that belongs to current shareholders (includes donations, excludes deferred payouts).
    function baseBalance(address market) public view returns (uint256) {
        return _balance(IOrderBook(market).baseToken());
    }

    /// True when the base the club bought for every market is at or below its dust bound.
    function isFlat() public view returns (bool) {
        for (uint256 i; i < _markets.length; ++i) {
            if (heldOf[_markets[i]] > dustOf[_markets[i]]) return false;
        }
        return true;
    }

    /// Shares minted for `amount` USDC at the current (flat) club value.
    function previewDeposit(uint256 amount) public view returns (uint256) {
        return amount * (totalShares + VIRTUAL_SHARES) / (quoteBalance() + 1);
    }

    // ---------------------------------------------------------------- internal

    function _balance(address token) internal view returns (uint256) {
        if (accountId == 0) return 0;
        uint256 bal = core.getBalance(accountId, token) + core.getSpotReservedBalance(accountId, token);
        uint256 owed = totalOwed[token];
        return bal > owed ? bal - owed : 0;
    }

    function _payout(address token, uint256 shares, uint256 supply) internal {
        // Only free balance can be withdrawn; the club never leaves resting orders, so this is everything.
        uint256 free = core.getBalance(accountId, token);
        uint256 owed = totalOwed[token];
        uint256 amount = (free > owed ? free - owed : 0) * shares / supply;
        if (amount == 0) return;
        try core.withdraw(accountId, token, amount, msg.sender) {
            emit Payout(msg.sender, token, amount);
        } catch {
            owedOf[msg.sender][token] += amount;
            totalOwed[token] += amount;
            emit PayoutDeferred(msg.sender, token, amount);
        }
    }
}
