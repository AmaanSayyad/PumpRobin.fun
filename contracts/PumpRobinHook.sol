// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    BalanceDelta,
    BalanceDeltaLibrary,
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary,
    Currency,
    CurrencyLibrary,
    IHooks,
    IPoolManager,
    LPFeeLibrary,
    ModifyLiquidityParams,
    PoolId,
    PoolIdLibrary,
    PoolKey,
    SwapParams,
    TickMath
} from "./v4/V4Types.sol";
import {PumpRobinToken} from "./PumpRobinToken.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/**
 * @title PumpRobinHook
 * @notice Uniswap v4 hook: 2% WETH fee on every swap (1% creator / 1% platform),
 *         optional 99% anti-snipe on buys for 15 minutes, LP locked forever.
 * @dev Deploy via CREATE2 so `uint160(address) & 0x3FFF == 0x2ECC`.
 */
contract PumpRobinHook is Ownable {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    uint256 internal constant FEE_BPS = 200;
    uint256 internal constant ANTI_SNIPE_BPS = 9_900;
    uint256 internal constant BPS_DENOM = 10_000;
    uint256 public constant PLATFORM_FLUSH_WEI = 0.012 ether;
    int24 internal constant TICK_SPACING = 60;
    int24 internal constant MIN_TICK = -887220;
    int24 internal constant MAX_TICK = 887220;

    IPoolManager public immutable poolManager;
    address public immutable WETH;
    address public immutable platformFeeRecipient;
    address public factory;

    struct PoolConfig {
        address bondingCurve;
        address creator;
        address token;
        uint128 pendingCreator;
        uint128 pendingPlatform;
        bool minted;
    }

    mapping(PoolId => PoolConfig) public pools;
    mapping(address => PoolId) public poolIdForToken;

    event FactorySet(address indexed factory);
    event PoolRegistered(PoolId indexed poolId, address indexed token, address indexed creator);
    event PoolMinted(PoolId indexed poolId, address currency0, address currency1);
    event HookFeeTaken(PoolId indexed poolId, uint256 amount, bool antiSnipe);
    event CreatorFeesClaimed(address indexed creator, address indexed token, uint256 amount);
    event PlatformFeesFlushed(address indexed platform, address indexed token, uint256 amount);

    constructor(
        IPoolManager poolManager_,
        address weth_,
        address platformFeeRecipient_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(address(poolManager_) != address(0) && weth_ != address(0), "Bad infra");
        require(platformFeeRecipient_ != address(0), "Bad platform");
        poolManager = poolManager_;
        WETH = weth_;
        platformFeeRecipient = platformFeeRecipient_;
    }

    receive() external payable {}

    function setFactory(address factory_) external onlyOwner {
        require(factory_ != address(0), "Bad factory");
        factory = factory_;
        emit FactorySet(factory_);
    }

    function register(PoolId poolId, address bondingCurve, address token, address creator) external {
        require(msg.sender == factory, "Only factory");
        require(bondingCurve != address(0) && token != address(0) && creator != address(0), "Bad args");
        PoolConfig storage config = pools[poolId];
        require(config.bondingCurve == address(0), "Registered");
        config.bondingCurve = bondingCurve;
        config.creator = creator;
        config.token = token;
        poolIdForToken[token] = poolId;
        emit PoolRegistered(poolId, token, creator);
    }

    function pendingCreatorFees(address token) external view returns (uint256) {
        return pools[poolIdForToken[token]].pendingCreator;
    }

    function pendingPlatformFees(address token) external view returns (uint256) {
        return pools[poolIdForToken[token]].pendingPlatform;
    }

    function claimCreatorFees(address token) external {
        PoolId poolId = poolIdForToken[token];
        PoolConfig storage config = pools[poolId];
        require(msg.sender == config.creator, "Not creator");
        uint256 amt = config.pendingCreator;
        require(amt > 0, "Nothing to claim");
        config.pendingCreator = 0;
        _payEth(config.creator, amt);
        emit CreatorFeesClaimed(config.creator, token, amt);
    }

    function flushPlatformFees(address token) public {
        PoolId poolId = poolIdForToken[token];
        PoolConfig storage config = pools[poolId];
        uint256 amt = config.pendingPlatform;
        require(amt >= PLATFORM_FLUSH_WEI, "Below $30");
        config.pendingPlatform = 0;
        _payEth(platformFeeRecipient, amt);
        emit PlatformFeesFlushed(platformFeeRecipient, token, amt);
    }

    /// @notice Permissionless: send platform WETH to the collector once ~$30 has accrued.
    function sweep(address token) external {
        if (pools[poolIdForToken[token]].pendingPlatform >= PLATFORM_FLUSH_WEI) {
            flushPlatformFees(token);
        }
    }

    function beforeInitialize(address sender, PoolKey calldata key, uint160) external view returns (bytes4) {
        require(key.tickSpacing == TICK_SPACING, "Tick spacing");
        require(sender == pools[key.toId()].bondingCurve, "Init");
        return this.beforeInitialize.selector;
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) external view returns (bytes4) {
        if (params.tickLower != MIN_TICK || params.tickUpper != MAX_TICK) revert("LP locked");
        if (pools[key.toId()].minted) revert("LP locked");
        return this.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external returns (bytes4, BalanceDelta) {
        PoolId poolId = key.toId();
        pools[poolId].minted = true;
        emit PoolMinted(poolId, Currency.unwrap(key.currency0), Currency.unwrap(key.currency1));
        return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        revert("LP locked");
    }

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) external returns (bytes4, BeforeSwapDelta, uint24) {
        require(msg.sender == address(poolManager), "PM");
        PoolConfig storage config = pools[key.toId()];
        if (sender == config.bondingCurve) {
            return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, LPFeeLibrary.OVERRIDE_FEE_FLAG);
        }

        bool exactIn = params.amountSpecified < 0;
        Currency specified = exactIn
            ? (params.zeroForOne ? key.currency0 : key.currency1)
            : (params.zeroForOne ? key.currency1 : key.currency0);

        if (Currency.unwrap(specified) == WETH) {
            if (!exactIn) revert("No exact-out WETH");
            uint256 feeBps = _buyFeeBps(config.token);
            uint256 base = uint256(-params.amountSpecified);
            uint256 fee = Math.mulDiv(base, feeBps, BPS_DENOM);
            if (fee == 0) {
                return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, LPFeeLibrary.OVERRIDE_FEE_FLAG);
            }
            poolManager.take(specified, address(this), fee);
            _accountFee(config, fee, feeBps == ANTI_SNIPE_BPS);
            emit HookFeeTaken(key.toId(), fee, feeBps == ANTI_SNIPE_BPS);
            return (
                this.beforeSwap.selector,
                BeforeSwapDeltaLibrary.toBeforeSwapDelta(SafeCast.toInt128(int256(fee)), 0),
                LPFeeLibrary.OVERRIDE_FEE_FLAG
            );
        }

        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external returns (bytes4, int128) {
        require(msg.sender == address(poolManager), "PM");
        PoolConfig storage config = pools[key.toId()];
        if (sender == config.bondingCurve) {
            return (this.afterSwap.selector, 0);
        }

        bool exactIn = params.amountSpecified < 0;
        Currency unspecified = exactIn
            ? (params.zeroForOne ? key.currency1 : key.currency0)
            : (params.zeroForOne ? key.currency0 : key.currency1);

        if (Currency.unwrap(unspecified) != WETH) {
            return (this.afterSwap.selector, 0);
        }

        int128 wethAmount = Currency.unwrap(key.currency0) == WETH ? delta.amount0() : delta.amount1();
        if (wethAmount == 0) return (this.afterSwap.selector, 0);

        uint256 base = uint256(int256(wethAmount > 0 ? wethAmount : -wethAmount));
        uint256 fee = Math.mulDiv(base, FEE_BPS, BPS_DENOM);
        if (fee == 0) return (this.afterSwap.selector, 0);

        poolManager.take(unspecified, address(this), fee);
        _accountFee(config, fee, false);
        emit HookFeeTaken(key.toId(), fee, false);
        return (this.afterSwap.selector, SafeCast.toInt128(int256(fee)));
    }

    function _buyFeeBps(address token) internal view returns (uint256) {
        if (token == address(0)) return FEE_BPS;
        try PumpRobinToken(token).isAntiSnipeActive() returns (bool active) {
            return active ? ANTI_SNIPE_BPS : FEE_BPS;
        } catch {
            return FEE_BPS;
        }
    }

    function _accountFee(PoolConfig storage config, uint256 fee, bool antiSnipe) internal {
        if (antiSnipe) {
            config.pendingPlatform += SafeCast.toUint128(fee);
        } else {
            uint256 creatorShare = fee / 2;
            uint256 platformShare = fee - creatorShare;
            config.pendingCreator += SafeCast.toUint128(creatorShare);
            config.pendingPlatform += SafeCast.toUint128(platformShare);
        }
    }

    function _payEth(address to, uint256 wethAmt) internal {
        IWETH(WETH).withdraw(wethAmt);
        (bool ok, ) = to.call{value: wethAmt}("");
        require(ok, "ETH send");
    }
}
