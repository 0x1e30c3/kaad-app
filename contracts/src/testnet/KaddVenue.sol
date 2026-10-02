// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SwapResult} from "../interfaces/IKuru.sol";

/*
 * TESTNET ONLY. A stand-in for Kuru on Monad testnet, where Kuru's books are empty and its tokens are admin-mint
 * only. It exposes the same AccountCore / OrderBook surface KaddClub uses, so clubs run unchanged, but each market is
 * a constant-product pool against free test dollars (tUSDC). Anyone can open a "mirror" pool for a mainnet token at
 * its current price, seeded with freshly minted test liquidity. Nothing here has value; don't deploy it on mainnet.
 */

/// Free test dollars. Anyone can claim `FAUCET` every `COOLDOWN`; the venue mints pool seeds.
contract TestUSDC is ERC20 {
    uint256 public constant FAUCET = 1_000e6;
    uint256 public constant COOLDOWN = 1 hours;
    address public immutable minter;
    mapping(address => uint256) public lastClaim;

    error TooSoon(uint256 nextAt);
    error NotMinter();

    constructor(address minter_) ERC20("Kadd Test USD", "tUSDC") {
        minter = minter_;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        uint256 last = lastClaim[msg.sender];
        if (last != 0 && block.timestamp < last + COOLDOWN) revert TooSoon(last + COOLDOWN);
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }
}

/// Testnet copy of a mainnet token. The whole supply is minted once, into its pool.
contract MirrorToken is ERC20 {
    address public immutable source; // the mainnet token this mirrors

    constructor(string memory name_, string memory symbol_, address source_, uint256 supply) ERC20(name_, symbol_) {
        source = source_;
        _mint(msg.sender, supply);
    }
}

/// Kuru AccountCore look-alike: per-account balances keyed by a root id, owner-only withdrawals, and settlement
/// that only verified markets may move.
contract KaddCore {
    using SafeERC20 for IERC20;

    address public immutable venue;
    uint40 public nextId = 1;
    mapping(address => uint40) public rootAccountIdOf;
    mapping(uint40 => address) public ownerOf;
    mapping(uint40 => mapping(address => uint256)) public getBalance;
    mapping(address => bool) public verifiedSpotOrderBook;

    error NotVenue();
    error NotOwner();
    error UnverifiedMarket();
    error NativeNotSupported();

    constructor() {
        venue = msg.sender;
    }

    function verify(address market) external {
        if (msg.sender != venue) revert NotVenue();
        verifiedSpotOrderBook[market] = true;
    }

    /// Credits `amount` of `token` (pulled from the caller) to `rootOwner`'s account, creating it on first use.
    function deposit(address rootOwner, address token, uint256 amount) external payable {
        if (msg.value != 0) revert NativeNotSupported();
        uint40 id = rootAccountIdOf[rootOwner];
        if (id == 0) {
            id = nextId++;
            rootAccountIdOf[rootOwner] = id;
            ownerOf[id] = rootOwner;
        }
        getBalance[id][token] += amount;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint40 id, address token, uint256 amount, address recipient) external {
        if (msg.sender != ownerOf[id]) revert NotOwner();
        getBalance[id][token] -= amount; // reverts on insufficient balance
        IERC20(token).safeTransfer(recipient, amount);
    }

    /// Nothing ever rests on a pool, so no balance is ever reserved.
    function getSpotReservedBalance(uint40, address) external pure returns (uint256) {
        return 0;
    }

    /// Called by a verified market after it sent `amountOut` of `tokenOut` here: books the trade and hands the
    /// market the account's `amountIn` of `tokenIn`.
    function settle(uint40 id, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut) external {
        if (!verifiedSpotOrderBook[msg.sender]) revert UnverifiedMarket();
        getBalance[id][tokenIn] -= amountIn;
        getBalance[id][tokenOut] += amountOut;
        IERC20(tokenIn).safeTransfer(msg.sender, amountIn);
    }
}

/// Constant-product pool (x·y=k, 0.3% fee) with Kuru's OrderBook swap signature for core accounts, plus a plain
/// wallet swap.
contract KaddPool {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BPS = 30;
    KaddCore public immutable core;
    address public immutable baseToken;
    address public immutable quoteToken;
    uint256 public reserveBase;
    uint256 public reserveQuote;

    event Swap(address indexed trader, bool isBuy, uint256 amountIn, uint256 amountOut);

    error NotAuthorized();
    error Expired();
    error ZeroAmount();
    error Slippage(uint256 amountOut, uint256 minAmountOut);

    constructor(KaddCore core_, address base, address quote_) {
        core = core_;
        baseToken = base;
        quoteToken = quote_;
    }

    function accountCore() external view returns (address) {
        return address(core);
    }

    /// Output for an exact input. Buys spend quote for base; sells spend base for quote.
    function quote(bool isBuy, uint256 amountIn) public view returns (uint256) {
        (uint256 rIn, uint256 rOut) = isBuy ? (reserveQuote, reserveBase) : (reserveBase, reserveQuote);
        uint256 inWithFee = amountIn * (10_000 - FEE_BPS);
        return inWithFee * rOut / (rIn * 10_000 + inWithFee);
    }

    /// Spot price: quote atoms per 1e18 base atoms.
    function price() external view returns (uint256) {
        return reserveBase == 0 ? 0 : reserveQuote * 1e18 / reserveBase;
    }

    /// Reserves follow balances (like Uniswap's sync); the venue calls this after seeding.
    function sync() external {
        reserveBase = IERC20(baseToken).balanceOf(address(this));
        reserveQuote = IERC20(quoteToken).balanceOf(address(this));
    }

    /// Kuru-style swap for a core account; only the account's owner may trade it (that's how clubs trade).
    function swap(uint40 userId, bool isBuy, uint128 amountIn, uint128 minAmountOut, uint64 deadline)
        external
        returns (SwapResult memory)
    {
        if (msg.sender != core.ownerOf(userId)) revert NotAuthorized();
        uint256 out = _swap(isBuy, amountIn, minAmountOut, deadline);
        (address tokenIn, address tokenOut) = isBuy ? (quoteToken, baseToken) : (baseToken, quoteToken);
        IERC20(tokenOut).safeTransfer(address(core), out);
        core.settle(userId, tokenIn, amountIn, tokenOut, out);
        return SwapResult(amountIn, uint128(out));
    }

    /// Wallet swap: pulls `amountIn` from the caller and sends the output to `to`.
    function swapExact(bool isBuy, uint256 amountIn, uint256 minAmountOut, uint64 deadline, address to)
        external
        returns (uint256 out)
    {
        out = _swap(isBuy, amountIn, minAmountOut, deadline);
        (address tokenIn, address tokenOut) = isBuy ? (quoteToken, baseToken) : (baseToken, quoteToken);
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, out);
    }

    function _swap(bool isBuy, uint256 amountIn, uint256 minAmountOut, uint64 deadline) internal returns (uint256 out) {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();
        out = quote(isBuy, amountIn);
        if (out == 0 || out < minAmountOut) revert Slippage(out, minAmountOut);
        if (isBuy) {
            reserveQuote += amountIn;
            reserveBase -= out;
        } else {
            reserveBase += amountIn;
            reserveQuote -= out;
        }
        emit Swap(msg.sender, isBuy, amountIn, out);
    }
}

/// Registry + factory: owns the core and tUSDC, and opens one mirror pool per mainnet token.
contract KaddVenue {
    /// Test dollars seeded into every new pool; the caller picks the base side, which sets the opening price.
    uint256 public constant SEED_QUOTE = 50_000e6;

    KaddCore public immutable core;
    TestUSDC public immutable usdc;
    mapping(address => address) public poolOf; // mainnet token => pool
    address[] public pools;

    event MirrorCreated(address indexed source, address indexed pool, address token, string symbol);

    error AlreadyMirrored(address pool);
    error InvalidSeed();

    constructor() {
        core = new KaddCore();
        usdc = new TestUSDC(address(this));
    }

    /// Opens a testnet pool for `source` with `baseSeed` mirror tokens against `SEED_QUOTE` tUSDC, so the opening
    /// price is SEED_QUOTE / baseSeed. The app passes the mainnet price; on testnet a wrong price harms no one.
    function createMirror(address source, string calldata name, string calldata symbol, uint256 baseSeed)
        external
        returns (KaddPool pool)
    {
        if (poolOf[source] != address(0)) revert AlreadyMirrored(poolOf[source]);
        if (source == address(0) || baseSeed == 0 || baseSeed > type(uint128).max) revert InvalidSeed();
        MirrorToken token = new MirrorToken(string.concat(name, " (Kadd testnet)"), symbol, source, baseSeed);
        pool = new KaddPool(core, address(token), address(usdc));
        token.transfer(address(pool), baseSeed);
        usdc.mint(address(pool), SEED_QUOTE);
        pool.sync();
        core.verify(address(pool));
        poolOf[source] = address(pool);
        pools.push(address(pool));
        emit MirrorCreated(source, address(pool), address(token), symbol);
    }

    function allPools() external view returns (address[] memory) {
        return pools;
    }
}
