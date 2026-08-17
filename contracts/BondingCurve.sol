// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PumpRobinToken.sol";
import "./PumpRobinHook.sol";
import "./interfaces/IWETH.sol";
import "./libraries/LiquidityAmounts.sol";
import "./libraries/SqrtPriceMath.sol";
import {
    BalanceDelta,
    BalanceDeltaLibrary,
    Currency,
    IHooks,
    IPoolManager,
    IUnlockCallback,
    LPFeeLibrary,
    ModifyLiquidityParams,
    PoolId,
    PoolIdLibrary,
    PoolKey
} from "./v4/V4Types.sol";

/**
 * @title BondingCurve
 * @notice Virtual x*y=k curve that sells 830M of the 1B supply, then migrates
 *         the remaining 170M plus the full raise into a Uniswap v4 pool whose
 *         hook enforces the 2% fee on every swap, from any router or aggregator.
 * @dev Curve constants are matched exactly to the reference Robinhood Chain
 *      launchpad so a PumpRobin launch opens at the same price, market cap and
 *      liquidity depth. Verified on-chain: with these reserves the curve sells
 *      precisely 830,000,000 tokens by the 5 ETH graduation threshold.
 */
contract BondingCurve is ReentrancyGuard, IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address public constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Reference-matched curve constants (see contract docs).
    uint256 public constant INITIAL_VIRTUAL_ETH = 1_287_878_787_878_787_878;
    uint256 public constant INITIAL_VIRTUAL_TOKENS =
        1_043_787_878_787_878_787_878_787_879;
    uint256 public constant DEFAULT_GRADUATION_THRESHOLD = 5 ether;

    /**
     * @notice Raise required before migrating, snapshotted at launch.
     * @dev Fixed for the life of the coin — the factory owner can change what
     *      future launches use, never what an existing one promised. Only the
     *      default 5 ETH gives the reference 830M/170M split; a lower threshold
     *      graduates earlier with more supply left for the pool, which is what
     *      makes an end-to-end mainnet rehearsal affordable.
     */
    uint256 public immutable graduationThreshold;

    uint256 public constant FEE_BPS = 200;
    uint256 public constant CREATOR_FEE_BPS = 100;
    uint256 public constant ANTI_SNIPE_BPS = 9_900;

    /// @notice ~$30 at $2.5k ETH — platform fees auto-forward past this.
    uint256 public constant PLATFORM_FLUSH_WEI = 0.012 ether;

    /// @dev Full range for tickSpacing 60, matching the hook's LP lock check.
    int24 public constant TICK_LOWER = -887_220;
    int24 public constant TICK_UPPER = 887_220;
    uint160 internal constant SQRT_RATIO_AT_MIN_TICK = 4295343490;
    uint160 internal constant SQRT_RATIO_AT_MAX_TICK =
        1461373636630004318706518188784493106690254656249;

    PumpRobinToken public immutable token;
    PumpRobinHook public immutable hook;
    address public immutable creator;
    address public immutable factory;
    address public immutable platformFeeRecipient;

    /// @notice Where the creator's 1% lands — the creator, or a fee-share splitter.
    address public creatorFeeRecipient;

    PoolKey public poolKey;

    uint256 public virtualEthReserves;
    uint256 public virtualTokenReserves;
    uint256 public realEthReserves;
    uint256 public realTokenReserves;

    uint256 public pendingCreatorFees;
    uint256 public pendingPlatformFees;
    uint256 public totalCreatorFeesEarned;

    bool public graduated;
    uint128 public poolLiquidity;

    event Trade(
        address indexed trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );
    event Graduated(
        bytes32 indexed poolId,
        uint256 ethLiquidity,
        uint256 tokenLiquidity,
        uint128 liquidity
    );
    event FeesAccumulated(
        address indexed creator,
        uint256 creatorFee,
        address indexed platform,
        uint256 platformFee
    );
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event PlatformFeesFlushed(address indexed platform, uint256 amount);

    constructor(
        address token_,
        address creator_,
        address factory_,
        address platformFeeRecipient_,
        address hook_,
        uint256 graduationThreshold_
    ) {
        require(token_ != address(0) && creator_ != address(0), "Bad token/creator");
        require(platformFeeRecipient_ != address(0), "Fee recipient required");
        require(hook_ != address(0), "Hook required");
        require(graduationThreshold_ > 0, "Bad threshold");
        graduationThreshold = graduationThreshold_;
        token = PumpRobinToken(token_);
        hook = PumpRobinHook(payable(hook_));
        creator = creator_;
        creatorFeeRecipient = creator_;
        factory = factory_;
        platformFeeRecipient = platformFeeRecipient_;

        virtualEthReserves = INITIAL_VIRTUAL_ETH;
        virtualTokenReserves = INITIAL_VIRTUAL_TOKENS;
        realTokenReserves = TOTAL_SUPPLY;

        (address c0, address c1) = token_ < WETH ? (token_, WETH) : (WETH, token_);
        poolKey = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(hook_)
        });
    }

    function poolId() public view returns (PoolId) {
        return poolKey.toId();
    }

    function getPrice() public view returns (uint256) {
        if (virtualTokenReserves == 0) return 0;
        return (virtualEthReserves * 1e18) / virtualTokenReserves;
    }

    /// @notice 0–99 while bonding, 100 once migrated.
    function getProgress() public view returns (uint256) {
        if (graduated) return 100;
        uint256 pct = (realEthReserves * 100) / graduationThreshold;
        return pct > 99 ? 99 : pct;
    }

    function currentFeeBps() public view returns (uint256) {
        return token.isAntiSnipeActive() ? ANTI_SNIPE_BPS : FEE_BPS;
    }

    // ---------------------------------------------------------------- trading

    function buy(uint256 minTokens) external payable nonReentrant {
        _buy(msg.sender, minTokens);
    }

    function buyFor(address recipient, uint256 minTokens)
        external
        payable
        nonReentrant
    {
        require(recipient != address(0), "Bad recipient");
        _buy(recipient, minTokens);
    }

    function sell(uint256 tokenAmount, uint256 minEth) external nonReentrant {
        require(!graduated, "Graduated - trade on Uniswap");
        require(tokenAmount > 0, "No tokens");

        uint256 ethReturn = _calculateSellReturn(tokenAmount);
        // Sells are never anti-sniped — the 99% window only penalises buyers.
        uint256 fee = (ethReturn * FEE_BPS) / 10_000;
        uint256 ethAfterFee = ethReturn - fee;
        require(ethAfterFee >= minEth, "Slippage exceeded");

        IERC20(address(token)).transferFrom(msg.sender, address(this), tokenAmount);

        virtualEthReserves -= ethReturn;
        virtualTokenReserves += tokenAmount;
        realEthReserves -= ethReturn;
        realTokenReserves += tokenAmount;

        (bool sent, ) = msg.sender.call{value: ethAfterFee}("");
        require(sent, "ETH transfer failed");

        if (fee > 0) _accumulateFee(fee, false);

        emit Trade(msg.sender, false, ethAfterFee, tokenAmount, getPrice());
    }

    function _buy(address recipient, uint256 minTokens) internal {
        require(!graduated, "Graduated - trade on Uniswap");
        require(msg.value > 0, "No ETH sent");

        bool antiSnipe = token.isAntiSnipeActive();
        uint256 feeBps = antiSnipe ? ANTI_SNIPE_BPS : FEE_BPS;

        // Fill only up to the graduation threshold and hand back the rest, so
        // the curve always sells exactly 830M and the pool always receives the
        // full 170M. Without this cap the crossing buy eats into LP supply.
        uint256 room = graduationThreshold - realEthReserves;
        uint256 spend = msg.value;
        bool willGraduate = spend - (spend * feeBps) / 10_000 >= room;
        if (willGraduate) spend = (room * 10_000) / (10_000 - feeBps);

        uint256 fee = (spend * feeBps) / 10_000;
        uint256 ethAfterFee = spend - fee;

        uint256 tokenAmount = _calculateBuyReturn(ethAfterFee);
        require(tokenAmount >= minTokens, "Slippage exceeded");
        require(tokenAmount <= realTokenReserves, "Insufficient tokens");

        virtualEthReserves += ethAfterFee;
        virtualTokenReserves -= tokenAmount;
        realEthReserves += ethAfterFee;
        realTokenReserves -= tokenAmount;

        IERC20(address(token)).transfer(recipient, tokenAmount);

        if (fee > 0) _accumulateFee(fee, antiSnipe);

        emit Trade(recipient, true, spend, tokenAmount, getPrice());

        uint256 refund = msg.value - spend;
        if (refund > 0) {
            (bool sent, ) = recipient.call{value: refund}("");
            require(sent, "Refund failed");
        }

        if (willGraduate) _migrateToV4();
    }

    function _calculateBuyReturn(uint256 ethAmount) internal view returns (uint256) {
        uint256 k = virtualEthReserves * virtualTokenReserves;
        uint256 newEthReserves = virtualEthReserves + ethAmount;
        return virtualTokenReserves - (k / newEthReserves);
    }

    function _calculateSellReturn(uint256 tokenAmount) internal view returns (uint256) {
        uint256 k = virtualEthReserves * virtualTokenReserves;
        uint256 newTokenReserves = virtualTokenReserves + tokenAmount;
        return virtualEthReserves - (k / newTokenReserves);
    }

    function quoteBuy(uint256 ethIn) external view returns (uint256 tokensOut) {
        uint256 fee = (ethIn * currentFeeBps()) / 10_000;
        return _calculateBuyReturn(ethIn - fee);
    }

    function quoteSell(uint256 tokenAmount) external view returns (uint256 ethOut) {
        uint256 ethReturn = _calculateSellReturn(tokenAmount);
        return ethReturn - (ethReturn * FEE_BPS) / 10_000;
    }

    // -------------------------------------------------------------------- fees

    /// @dev Anti-snipe fees go entirely to the platform; normal fees split 1%/1%.
    function _accumulateFee(uint256 fee, bool antiSnipe) internal {
        uint256 creatorFee;
        uint256 platformFee;
        if (antiSnipe) {
            platformFee = fee;
        } else {
            creatorFee = (fee * CREATOR_FEE_BPS) / FEE_BPS;
            platformFee = fee - creatorFee;
        }
        if (creatorFee > 0) {
            pendingCreatorFees += creatorFee;
            totalCreatorFeesEarned += creatorFee;
        }
        pendingPlatformFees += platformFee;
        emit FeesAccumulated(creator, creatorFee, platformFeeRecipient, platformFee);
        _maybeFlushPlatform();
    }

    /// @dev Creator fees accrue until claimed; platform fees auto-forward at ~$30.
    function _maybeFlushPlatform() internal {
        uint256 amt = pendingPlatformFees;
        if (amt < PLATFORM_FLUSH_WEI) return;
        pendingPlatformFees = 0;
        (bool ok, ) = platformFeeRecipient.call{value: amt}("");
        if (!ok) {
            pendingPlatformFees = amt; // keep pending, never block the trade
            return;
        }
        emit PlatformFeesFlushed(platformFeeRecipient, amt);
    }

    /// @notice Factory-only, once: point the creator share at a fee splitter.
    function setCreatorFeeRecipient(address recipient) external {
        require(msg.sender == factory, "Only factory");
        require(creatorFeeRecipient == creator && recipient != address(0), "Already set");
        creatorFeeRecipient = recipient;
    }

    function claimCreatorFees() external nonReentrant {
        address to = creatorFeeRecipient;
        require(msg.sender == to, "Not creator");
        uint256 amt = pendingCreatorFees;
        require(amt > 0, "Nothing to claim");
        pendingCreatorFees = 0;
        (bool ok, ) = to.call{value: amt}("");
        require(ok, "Creator payout failed");
        emit CreatorFeesClaimed(to, amt);
    }

    /// @notice Permissionless — forwards platform fees once ~$30 has accrued.
    function flushPlatformFees() external nonReentrant {
        _maybeFlushPlatform();
    }

    function getPendingFees()
        external
        view
        returns (
            uint256 creatorEth,
            uint256 platformEth,
            uint256 creatorLifetimeEth,
            uint256 platformFlushThreshold
        )
    {
        return (
            pendingCreatorFees,
            pendingPlatformFees,
            totalCreatorFeesEarned,
            PLATFORM_FLUSH_WEI
        );
    }

    // --------------------------------------------------------------- migration

    /**
     * @dev Moves the untouched 170M tokens plus the full raise into the v4 pool.
     *      Liquidity is minted to this contract and can never be withdrawn —
     *      the hook reverts on beforeRemoveLiquidity.
     */
    function _migrateToV4() internal {
        require(!graduated, "Graduated");
        graduated = true;

        uint256 tokenLiq = IERC20(address(token)).balanceOf(address(this));
        uint256 ethLiq = address(this).balance - pendingCreatorFees - pendingPlatformFees;
        require(tokenLiq > 0 && ethLiq > 0, "No liquidity");

        realEthReserves = 0;
        realTokenReserves = 0;

        IWETH(WETH).deposit{value: ethLiq}();

        address tokenAddr = address(token);
        (uint256 amount0, uint256 amount1) = tokenAddr < WETH
            ? (tokenLiq, ethLiq)
            : (ethLiq, tokenLiq);

        uint160 sqrtPriceX96 = SqrtPriceMath.encodeSqrtRatioX96(amount1, amount0);
        IPoolManager(POOL_MANAGER).initialize(poolKey, sqrtPriceX96);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            SQRT_RATIO_AT_MIN_TICK,
            SQRT_RATIO_AT_MAX_TICK,
            amount0,
            amount1
        );
        require(liquidity > 0, "No liquidity minted");
        poolLiquidity = liquidity;

        IPoolManager(POOL_MANAGER).unlock(abi.encode(liquidity));

        emit Graduated(PoolId.unwrap(poolId()), ethLiq, tokenLiq, liquidity);
    }

    function unlockCallback(bytes calldata data)
        external
        override
        returns (bytes memory)
    {
        require(msg.sender == POOL_MANAGER, "Only PoolManager");
        uint128 liquidity = abi.decode(data, (uint128));

        (BalanceDelta callerDelta, ) = IPoolManager(POOL_MANAGER).modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(0)
            }),
            ""
        );

        // v4 reverts unless every delta nets to zero, so pay exactly what is
        // owed rather than dumping the whole balance in.
        _resolve(poolKey.currency0, BalanceDeltaLibrary.amount0(callerDelta));
        _resolve(poolKey.currency1, BalanceDeltaLibrary.amount1(callerDelta));
        return "";
    }

    /// @dev Negative delta = we owe the pool; positive = the pool owes us.
    function _resolve(Currency currency, int128 delta) internal {
        if (delta == 0) return;
        if (delta < 0) {
            uint256 owed = uint256(uint128(-delta));
            IPoolManager(POOL_MANAGER).sync(currency);
            IERC20(Currency.unwrap(currency)).transfer(POOL_MANAGER, owed);
            IPoolManager(POOL_MANAGER).settle();
        } else {
            IPoolManager(POOL_MANAGER).take(
                currency,
                address(this),
                uint256(uint128(delta))
            );
        }
    }

    receive() external payable {}
}
