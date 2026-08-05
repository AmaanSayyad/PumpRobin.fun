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
 * @notice Launch vault: seeds a Uniswap V3 TOKEN/WETH pool (1%) at create time so
 *         GMGN / DEX Screener / Uniswap index liquidity immediately.
 * @dev Legacy buy/sell curve functions remain but revert after graduation. New
 *      launches call seedAndGraduate from the factory in the same create tx.
 */
contract BondingCurve is ReentrancyGuard {
    /// @dev Robinhood Chain Uniswap V3 + WETH (canonical deployments)
    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address public constant UNISWAP_V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address public constant POSITION_MANAGER = 0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address public constant SWAP_ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    /// @dev Matches VLAD-style Robinhood memecoin pools on DEX Screener / GMGN
    uint24 public constant POOL_FEE = 10_000; // 1%
    int24 public constant TICK_LOWER = -887_200; // full-range for tickSpacing 200
    int24 public constant TICK_UPPER = 887_200;
    address public constant LP_DEAD = 0x000000000000000000000000000000000000dEaD;
    /// @dev Minimum ETH that must seed the Uniswap pool (indexers need real liq)
    uint256 public constant MIN_SEED = 0.01 ether;

    PumpRobinToken public immutable token;
    address public immutable creator;
    address public immutable factory;
    /// @notice Receives dust / platform residual ETH
    address public immutable platformFeeRecipient;
    /// @notice Legacy constant (curve trade fees no longer used post day-0 pool)
    address public constant CREATOR_FEE_RECIPIENT =
        0x4654FE1e59547372Db57e9F6865aa7aC3A0C77a3;

    uint256 public virtualEthReserves;
    uint256 public virtualTokenReserves;
    uint256 public realEthReserves;
    uint256 public realTokenReserves;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant GRADUATION_THRESHOLD = 8 ether;
    uint256 public constant CREATOR_FEE_BPS = 100;
    uint256 public constant PLATFORM_FEE_BPS = 30;
    uint256 public constant FEE_BPS = CREATOR_FEE_BPS + PLATFORM_FEE_BPS;

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
    event Graduated(address indexed pool, uint256 ethLiquidity, uint256 tokenLiquidity, uint256 lpTokenId);

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

    /// @notice Legacy curve buy — disabled once the Uniswap pool exists
    function buy(uint256 minTokens) external payable nonReentrant {
        _buy(msg.sender, minTokens);
    }

    function buyFor(address recipient, uint256 minTokens) external payable nonReentrant {
        require(recipient != address(0), "Bad recipient");
        _buy(recipient, minTokens);
    }

    /**
     * @notice Factory-only: seed Uniswap V3 pool immediately + optional creator buy.
     * @dev Half of msg.value seeds locked LP (floored at MIN_SEED); the rest buys
     *      tokens for `recipient` on the new pool (Bags-style create+buy).
     */
    function seedAndGraduate(address recipient, uint256 minTokensOut)
        external
        payable
        nonReentrant
    {
        require(msg.sender == factory, "Only factory");
        require(!graduated, "Graduated");
        require(recipient != address(0), "Bad recipient");
        require(msg.value >= MIN_SEED, "Need seed liquidity");

        uint256 buyEth = msg.value / 2;
        uint256 lpEth = msg.value - buyEth;
        if (lpEth < MIN_SEED) {
            lpEth = MIN_SEED;
            require(msg.value > lpEth, "Need seed liquidity");
            buyEth = msg.value - lpEth;
        }

        _graduateWithEth(lpEth);

        if (buyEth > 0) {
            uint256 tokensOut = _swapEthForTokens(recipient, buyEth, minTokensOut);
            uint256 price = getPrice();
            // Prefer pool-implied price after graduation
            if (price == 0 && tokensOut > 0) {
                price = (buyEth * 1e18) / tokensOut;
            }
            emit Trade(recipient, true, buyEth, tokensOut, price);
        }
    }

    function _buy(address recipient, uint256 minTokens) internal {
        require(!graduated, "Graduated - trade on Uniswap");
        require(msg.value > 0, "No ETH sent");

        uint256 fee = (msg.value * FEE_BPS) / 10000;
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
            _distributeFee(fee);
        }

        emit Trade(recipient, true, msg.value, tokenAmount, getPrice());

        if (realEthReserves >= GRADUATION_THRESHOLD) {
            _graduateWithEth(address(this).balance);
        }
    }

    function sell(uint256 tokenAmount, uint256 minEth) external nonReentrant {
        require(!graduated, "Graduated - trade on Uniswap");
        require(tokenAmount > 0, "No tokens");

        uint256 ethReturn = _calculateSellReturn(tokenAmount);
        uint256 fee = (ethReturn * FEE_BPS) / 10000;
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
            _distributeFee(fee);
        }

        emit Trade(msg.sender, false, ethAfterFee, tokenAmount, getPrice());
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

    function _distributeFee(uint256 fee) internal {
        uint256 creatorFee = (fee * CREATOR_FEE_BPS) / FEE_BPS;
        uint256 platformFee = fee - creatorFee;

        if (creatorFee > 0) {
            (bool c, ) = CREATOR_FEE_RECIPIENT.call{value: creatorFee}("");
            require(c, "Creator fee failed");
        }
        if (platformFee > 0) {
            (bool p, ) = platformFeeRecipient.call{value: platformFee}("");
            require(p, "Platform fee failed");
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
                recipient: LP_DEAD,
                deadline: block.timestamp
            })
        );

        _sweepDust(token0, amount0 - used0);
        _sweepDust(token1, amount1 - used1);

        realEthReserves = 0;
        realTokenReserves = 0;
        uniswapPool = pool;
        lpTokenId = tokenId;

        emit Graduated(pool, ethLiq, tokenLiq, tokenId);
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
            (bool ok, ) = platformFeeRecipient.call{value: amount}("");
            require(ok, "Dust ETH failed");
        } else {
            IERC20(asset).transfer(LP_DEAD, amount);
        }
    }

    receive() external payable {}
}
