// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PumpRobinToken.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IUniswapV3.sol";
import "./libraries/SqrtPriceMath.sol";

/**
 * @title BondingCurve
 * @notice pump.fun-style bonding curve until graduation, then Uniswap V3.
 * @dev Trades on the constant-product curve until `GRADUATION_THRESHOLD` ETH
 *      is raised. Each buy/sell pays 1% to the token creator + 1% to the
 *      platform (accumulated; auto-paid or claimable at ~$10 threshold).
 *      After graduation, a 2% token transfer fee applies on every DEX trade
 *      (GMGN, Axiom, Uniswap, etc.) — not only via PumpRobin UI.
 */
contract BondingCurve is ReentrancyGuard {
    /// @dev Robinhood Chain Uniswap V3 + WETH (canonical deployments)
    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address public constant UNISWAP_V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address public constant POSITION_MANAGER = 0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address public constant SWAP_ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    uint24 public constant POOL_FEE = 10_000; // 1%
    /// @notice Minimum total seed for instant Uniswap launch (~$5 at $2.5k ETH)
    uint256 public constant MIN_INSTANT_SEED = 0.002 ether;
    /// @notice Target starting FDV — smaller seeds use fewer tokens in LP
    uint256 public constant TARGET_START_FDV_ETH = 2 ether;
    /// @notice Dynamic LP supply bounds (bps of 1B total supply)
    uint256 public constant MIN_LP_SUPPLY_BPS = 5; // 0.05%
    uint256 public constant MAX_LP_SUPPLY_BPS = 10_000; // 100% — needed for ~30% creator buy
    /// @notice ETH split for instant launch: LP vs creator buy
    uint256 public constant INSTANT_LP_ETH_BPS = 7_000; // 70% LP / 30% buy
    int24 public constant TICK_LOWER = -887_200;
    int24 public constant TICK_UPPER = 887_200;
    /// @notice LP NFT recipient — permanent lock (indexers can verify owner)
    address public constant LP_LOCK_RECIPIENT =
        0x000000000000000000000000000000000000dEaD;

    PumpRobinToken public immutable token;
    address public immutable creator;
    address public immutable factory;
    address public immutable platformFeeRecipient;

    uint256 public virtualEthReserves;
    uint256 public virtualTokenReserves;
    uint256 public realEthReserves;
    uint256 public realTokenReserves;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant GRADUATION_THRESHOLD = 8 ether;
    uint256 public constant CREATOR_FEE_BPS = 100;
    uint256 public constant PLATFORM_FEE_BPS = 100;
    uint256 public constant FEE_BPS = CREATOR_FEE_BPS + PLATFORM_FEE_BPS;
    /// @notice ~$10 at $2.5k ETH — auto-distribute / manual claim threshold
    uint256 public constant FEE_CLAIM_THRESHOLD = 0.004 ether;

    uint256 public pendingCreatorFees;
    uint256 public pendingPlatformFees;
    uint256 public pendingCreatorTokenFees;
    uint256 public pendingPlatformTokenFees;

    bool public graduated;
    address public uniswapPool;
    uint256 public lpTokenId;

    event Trade(
        address indexed trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );
    event Graduated(
        address indexed pool,
        uint256 ethLiquidity,
        uint256 tokenLiquidity,
        uint256 lpTokenId,
        address lpLockedTo
    );
    event FeesAccumulated(
        address indexed creator,
        uint256 creatorFee,
        address indexed platform,
        uint256 platformFee
    );
    event FeesDistributed(
        address indexed creator,
        uint256 creatorFee,
        address indexed platform,
        uint256 platformFee
    );
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event TokenFeesAccumulated(
        address indexed creator,
        uint256 creatorTokens,
        address indexed platform,
        uint256 platformTokens
    );
    event InstantSeeded(
        address indexed pool,
        uint256 lpEth,
        uint256 buyEth,
        uint256 lpSupplyBps,
        uint256 tokensInLp,
        uint256 estimatedFdvEth
    );

    constructor(
        address token_,
        address creator_,
        address factory_,
        address platformFeeRecipient_,
        uint256 initialVirtualEth,
        uint256 initialVirtualTokens
    ) {
        require(platformFeeRecipient_ != address(0), "Fee recipient required");
        token = PumpRobinToken(token_);
        creator = creator_;
        factory = factory_;
        platformFeeRecipient = platformFeeRecipient_;
        virtualEthReserves = initialVirtualEth;
        virtualTokenReserves = initialVirtualTokens;
        realTokenReserves = TOTAL_SUPPLY;

        IERC20(token_).approve(factory_, type(uint256).max);
    }

    function getPrice() public view returns (uint256) {
        if (virtualTokenReserves == 0) return 0;
        return (virtualEthReserves * 1e18) / virtualTokenReserves;
    }

    function getProgress() public view returns (uint256) {
        if (graduated) return 100;
        return (realEthReserves * 100) / GRADUATION_THRESHOLD;
    }

    function buy(uint256 minTokens) external payable nonReentrant {
        _buy(msg.sender, minTokens);
    }

    function buyFor(address recipient, uint256 minTokens) external payable nonReentrant {
        require(recipient != address(0), "Bad recipient");
        _buy(recipient, minTokens);
    }

    /**
     * @notice Factory-only: skip bonding curve and seed Uniswap immediately.
     * @dev LP token % scales with seed size so FDV stays ~TARGET_START_FDV_ETH+.
     *      Small seeds (e.g. $5) put fewer tokens in the pool — each buy stays expensive.
     */
    function seedInstantUniswap(address recipient, uint256 minTokensOut)
        external
        payable
        nonReentrant
    {
        require(msg.sender == factory, "Only factory");
        require(!graduated, "Graduated");
        require(recipient != address(0), "Bad recipient");
        require(msg.value >= MIN_INSTANT_SEED, "Need instant seed");

        uint256 lpEth = (msg.value * INSTANT_LP_ETH_BPS) / 10_000;
        uint256 buyEth = msg.value - lpEth;

        uint256 lpSupplyBps = _lpSupplyBpsForLpEth(lpEth);
        uint256 tokenForLp = (TOTAL_SUPPLY * lpSupplyBps) / 10_000;

        uint256 balance = IERC20(address(token)).balanceOf(address(this));
        require(tokenForLp > 0 && tokenForLp <= balance, "Bad lp tokens");
        uint256 excess = balance - tokenForLp;
        if (excess > 0) {
            IERC20(address(token)).transfer(LP_LOCK_RECIPIENT, excess);
        }

        _graduateWithEth(lpEth);

        uint256 estimatedFdv = (lpEth * 10_000) / lpSupplyBps;
        emit InstantSeeded(
            uniswapPool,
            lpEth,
            buyEth,
            lpSupplyBps,
            tokenForLp,
            estimatedFdv
        );

        if (buyEth > 0) {
            uint256 tokensOut = _swapEthForTokens(recipient, buyEth, minTokensOut);
            uint256 price = tokensOut > 0 ? (buyEth * 1e18) / tokensOut : getPrice();
            emit Trade(recipient, true, buyEth, tokensOut, price);
        }
    }

    /// @notice Buy on Uniswap — 2% token transfer fee applies automatically
    function buyOnUniswap(uint256 minTokensOut) external payable nonReentrant {
        require(graduated && uniswapPool != address(0), "No pool");
        require(msg.value > 0, "No ETH");

        uint256 tokensOut = _swapEthForTokens(msg.sender, msg.value, minTokensOut);
        uint256 price = tokensOut > 0 ? (msg.value * 1e18) / tokensOut : getPrice();
        emit Trade(msg.sender, true, msg.value, tokensOut, price);
    }

    /// @notice Sell on Uniswap — 2% token transfer fee applies automatically
    function sellOnUniswap(uint256 tokenAmount, uint256 minEthOut)
        external
        nonReentrant
    {
        require(graduated && uniswapPool != address(0), "No pool");
        require(tokenAmount > 0, "No tokens");

        IERC20(address(token)).transferFrom(msg.sender, address(this), tokenAmount);
        IERC20(address(token)).approve(SWAP_ROUTER, tokenAmount);

        uint256 wethOut = ISwapRouter02(SWAP_ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: address(token),
                tokenOut: WETH,
                fee: POOL_FEE,
                recipient: address(this),
                amountIn: tokenAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        IWETH(WETH).withdraw(wethOut);
        require(wethOut >= minEthOut, "Slippage exceeded");

        (bool sent, ) = msg.sender.call{value: wethOut}("");
        require(sent, "ETH transfer failed");

        uint256 price = tokenAmount > 0 ? (wethOut * 1e18) / tokenAmount : getPrice();
        emit Trade(msg.sender, false, wethOut, tokenAmount, price);
    }

    function getPendingFees()
        external
        view
        returns (
            uint256 creatorEth,
            uint256 platformEth,
            uint256 creatorTokens,
            uint256 platformTokens,
            uint256 claimThreshold
        )
    {
        return (
            pendingCreatorFees,
            pendingPlatformFees,
            pendingCreatorTokenFees,
            pendingPlatformTokenFees,
            FEE_CLAIM_THRESHOLD
        );
    }

    function claimCreatorFees() external nonReentrant {
        require(msg.sender == creator, "Not creator");
        uint256 ethOut = pendingCreatorFees;
        uint256 tokens = pendingCreatorTokenFees;
        uint256 tokenEthVal = _tokenFeesEthValue(tokens);
        require(ethOut + tokenEthVal >= FEE_CLAIM_THRESHOLD, "Below threshold");

        pendingCreatorFees = 0;
        pendingCreatorTokenFees = 0;

        if (tokens > 0) {
            ethOut += _swapTokensForEth(tokens);
        }
        require(ethOut > 0, "Nothing to claim");
        (bool ok, ) = creator.call{value: ethOut}("");
        require(ok, "Creator payout failed");
        emit CreatorFeesClaimed(creator, ethOut);
    }

    function claimPlatformFees() external nonReentrant {
        require(msg.sender == platformFeeRecipient, "Not platform");
        uint256 ethOut = pendingPlatformFees;
        uint256 tokens = pendingPlatformTokenFees;
        uint256 tokenEthVal = _tokenFeesEthValue(tokens);
        require(ethOut + tokenEthVal >= FEE_CLAIM_THRESHOLD, "Below threshold");

        pendingPlatformFees = 0;
        pendingPlatformTokenFees = 0;

        if (tokens > 0) {
            ethOut += _swapTokensForEth(tokens);
        }
        require(ethOut > 0, "Nothing to claim");
        (bool ok, ) = platformFeeRecipient.call{value: ethOut}("");
        require(ok, "Platform payout failed");
        emit FeesDistributed(creator, 0, platformFeeRecipient, ethOut);
    }

    /// @notice Preview instant-launch economics for a seed amount (excl. creation fee)
    function previewInstantLaunch(uint256 seedEth)
        external
        pure
        returns (
            uint256 lpEth,
            uint256 buyEth,
            uint256 lpSupplyBps,
            uint256 estimatedFdvEth
        )
    {
        lpEth = (seedEth * INSTANT_LP_ETH_BPS) / 10_000;
        buyEth = seedEth - lpEth;
        lpSupplyBps = _lpSupplyBpsForLpEth(lpEth);
        estimatedFdvEth = (lpEth * 10_000) / lpSupplyBps;
    }

    function _lpSupplyBpsForLpEth(uint256 lpEth) internal pure returns (uint256) {
        if (lpEth == 0) return MIN_LP_SUPPLY_BPS;
        uint256 bps = (lpEth * 10_000) / TARGET_START_FDV_ETH;
        if (bps < MIN_LP_SUPPLY_BPS) return MIN_LP_SUPPLY_BPS;
        if (bps > MAX_LP_SUPPLY_BPS) return MAX_LP_SUPPLY_BPS;
        return bps;
    }

    function sell(uint256 tokenAmount, uint256 minEth) external nonReentrant {
        require(!graduated, "Graduated - trade on Uniswap");
        require(tokenAmount > 0, "No tokens");

        uint256 ethReturn = _calculateSellReturn(tokenAmount);
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

        if (fee > 0) {
            _accumulateFee(fee);
        }

        emit Trade(msg.sender, false, ethAfterFee, tokenAmount, getPrice());
    }

    function _buy(address recipient, uint256 minTokens) internal {
        require(!graduated, "Graduated - trade on Uniswap");
        require(msg.value > 0, "No ETH sent");

        uint256 fee = (msg.value * FEE_BPS) / 10_000;
        uint256 ethAfterFee = msg.value - fee;

        uint256 tokenAmount = _calculateBuyReturn(ethAfterFee);
        require(tokenAmount >= minTokens, "Slippage exceeded");
        require(tokenAmount <= realTokenReserves, "Insufficient tokens");

        virtualEthReserves += ethAfterFee;
        virtualTokenReserves -= tokenAmount;
        realEthReserves += ethAfterFee;
        realTokenReserves -= tokenAmount;

        IERC20(address(token)).transfer(recipient, tokenAmount);

        if (fee > 0) {
            _accumulateFee(fee);
        }

        emit Trade(recipient, true, msg.value, tokenAmount, getPrice());

        if (realEthReserves >= GRADUATION_THRESHOLD) {
            _graduateWithEth(address(this).balance);
        }
    }

    function _calculateBuyReturn(uint256 ethAmount) internal view returns (uint256) {
        uint256 k = virtualEthReserves * virtualTokenReserves;
        uint256 newEthReserves = virtualEthReserves + ethAmount;
        uint256 newTokenReserves = k / newEthReserves;
        return virtualTokenReserves - newTokenReserves;
    }

    function _calculateSellReturn(uint256 tokenAmount) internal view returns (uint256) {
        uint256 k = virtualEthReserves * virtualTokenReserves;
        uint256 newTokenReserves = virtualTokenReserves + tokenAmount;
        uint256 newEthReserves = k / newTokenReserves;
        return virtualEthReserves - newEthReserves;
    }

    function _accumulateFee(uint256 fee) internal {
        uint256 creatorFee = (fee * CREATOR_FEE_BPS) / FEE_BPS;
        uint256 platformFee = fee - creatorFee;
        pendingCreatorFees += creatorFee;
        pendingPlatformFees += platformFee;
        emit FeesAccumulated(creator, creatorFee, platformFeeRecipient, platformFee);
        _maybeAutoDistribute();
    }

    function _maybeAutoDistribute() internal {
        if (pendingCreatorFees >= FEE_CLAIM_THRESHOLD) {
            uint256 amt = pendingCreatorFees;
            pendingCreatorFees = 0;
            (bool c, ) = creator.call{value: amt}("");
            require(c, "Creator payout failed");
            emit CreatorFeesClaimed(creator, amt);
        }
        if (pendingPlatformFees >= FEE_CLAIM_THRESHOLD) {
            uint256 amt = pendingPlatformFees;
            pendingPlatformFees = 0;
            (bool p, ) = platformFeeRecipient.call{value: amt}("");
            require(p, "Platform payout failed");
            emit FeesDistributed(creator, 0, platformFeeRecipient, amt);
        }
    }

    function _graduateWithEth(uint256 ethLiq) internal {
        require(!graduated, "Graduated");
        require(ethLiq > 0, "No liquidity");
        require(address(this).balance >= ethLiq, "Insufficient ETH");

        graduated = true;

        uint256 tokenLiq = IERC20(address(token)).balanceOf(address(this));
        require(tokenLiq > 0, "No liquidity");

        IWETH(WETH).deposit{value: ethLiq}();

        address tokenAddr = address(token);
        (address token0, address token1, uint256 amount0, uint256 amount1) = tokenAddr < WETH
            ? (tokenAddr, WETH, tokenLiq, ethLiq)
            : (WETH, tokenAddr, ethLiq, tokenLiq);

        uint160 sqrtPriceX96 = SqrtPriceMath.encodeSqrtRatioX96(amount1, amount0);

        INonfungiblePositionManager npm = INonfungiblePositionManager(POSITION_MANAGER);
        address pool = npm.createAndInitializePoolIfNecessary(token0, token1, POOL_FEE, sqrtPriceX96);

        IERC20(token0).approve(POSITION_MANAGER, amount0);
        IERC20(token1).approve(POSITION_MANAGER, amount1);

        (uint256 tokenId, , uint256 used0, uint256 used1) = npm.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: LP_LOCK_RECIPIENT,
                deadline: block.timestamp
            })
        );

        _sweepDust(token0, amount0 - used0);
        _sweepDust(token1, amount1 - used1);

        realEthReserves = 0;
        realTokenReserves = 0;
        uniswapPool = pool;
        lpTokenId = tokenId;

        emit Graduated(pool, ethLiq, tokenLiq, tokenId, LP_LOCK_RECIPIENT);
    }

    function _swapEthForTokens(
        address recipient,
        uint256 ethIn,
        uint256 minTokensOut
    ) internal returns (uint256 tokensOut) {
        require(graduated && uniswapPool != address(0), "No pool");
        require(address(this).balance >= ethIn, "Insufficient ETH");

        IWETH(WETH).deposit{value: ethIn}();
        IERC20(WETH).approve(SWAP_ROUTER, ethIn);

        tokensOut = ISwapRouter02(SWAP_ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: address(token),
                fee: POOL_FEE,
                recipient: recipient,
                amountIn: ethIn,
                amountOutMinimum: minTokensOut,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _sweepDust(address asset, uint256 amount) internal {
        if (amount == 0) return;
        if (asset == WETH) {
            IWETH(WETH).withdraw(amount);
            _accumulateFee(amount);
        } else {
            IERC20(asset).transfer(LP_LOCK_RECIPIENT, amount);
        }
    }

    function _tokenFeesEthValue(uint256 tokenAmt) internal view returns (uint256) {
        if (tokenAmt == 0) return 0;
        uint256 price = getPrice();
        if (price == 0) return 0;
        return (tokenAmt * price) / 1e18;
    }

    function _swapTokensForEth(uint256 tokenAmount) internal returns (uint256 ethOut) {
        require(tokenAmount > 0, "No tokens");
        IERC20(address(token)).approve(SWAP_ROUTER, tokenAmount);
        ethOut = ISwapRouter02(SWAP_ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: address(token),
                tokenOut: WETH,
                fee: POOL_FEE,
                recipient: address(this),
                amountIn: tokenAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        IWETH(WETH).withdraw(ethOut);
    }

    receive() external payable {}
}
