// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SwapResult} from "../../src/interfaces/IKuru.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, uint8 d) ERC20(n, n) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Mimics the parts of Kuru AccountCore the club relies on: root registration on deposit by owner address,
/// per-id balances, owner-only withdraw, and settlement moved by verified books.
contract MockAccountCore {
    uint40 public nextId = 1;
    mapping(address => uint40) public rootAccountIdOf;
    mapping(uint40 => address) public ownerOf;
    mapping(uint40 => mapping(address => uint256)) public getBalance;
    mapping(address => bool) public verifiedSpotOrderBook;
    mapping(address => bool) public withdrawPaused;

    function verify(address book) external {
        verifiedSpotOrderBook[book] = true;
    }

    function pauseWithdraw(address token, bool paused) external {
        withdrawPaused[token] = paused;
    }

    function deposit(address rootOwner, address token, uint256 amount) external payable {
        uint40 id = rootAccountIdOf[rootOwner];
        if (id == 0) {
            id = nextId++;
            rootAccountIdOf[rootOwner] = id;
            ownerOf[id] = rootOwner;
        }
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        getBalance[id][token] += amount;
    }

    function withdraw(uint40 id, address token, uint256 amount, address recipient) external {
        require(msg.sender == ownerOf[id], "not owner");
        require(!withdrawPaused[token], "withdraw paused");
        getBalance[id][token] -= amount;
        IERC20(token).transfer(recipient, amount);
    }

    function getSpotReservedBalance(uint40, address) external pure returns (uint256) {
        return 0;
    }

    function settle(uint40 id, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut) external {
        require(verifiedSpotOrderBook[msg.sender], "unverified book");
        getBalance[id][tokenIn] -= amountIn;
        getBalance[id][tokenOut] += amountOut;
    }
}

/// Fixed-price book: `price` = quote atoms per 1e18 base atoms. Liquidity is assumed infinite and pre-funded
/// into the core by the test.
contract MockOrderBook {
    MockAccountCore public immutable core;
    address public immutable baseToken;
    address public immutable quoteToken;
    uint256 public price;
    uint256 public lastDeadline;

    constructor(MockAccountCore core_, address base, address quote, uint256 price_) {
        core = core_;
        baseToken = base;
        quoteToken = quote;
        price = price_;
    }

    function accountCore() external view returns (address) {
        return address(core);
    }

    function setPrice(uint256 p) external {
        price = p;
    }

    function swap(uint40 userId, bool isBuy, uint128 amountIn, uint128 minAmountOut, uint64 deadline)
        external
        returns (SwapResult memory r)
    {
        require(msg.sender == core.ownerOf(userId), "not authorized");
        require(deadline >= block.timestamp, "expired");
        lastDeadline = deadline;
        uint256 out = isBuy ? uint256(amountIn) * 1e18 / price : uint256(amountIn) * price / 1e18;
        require(out >= minAmountOut, "slippage");
        core.settle(userId, isBuy ? quoteToken : baseToken, amountIn, isBuy ? baseToken : quoteToken, out);
        r = SwapResult(amountIn, uint128(out));
    }
}
