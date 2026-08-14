// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IUniswapV3.sol";

/**
 * @title FoTUniswapSeller
 * @notice Sell fee-on-transfer tokens on Uniswap V3 without STF reverts.
 * @dev Pulls tokens from the user (tax may apply), then swaps the actual
 *      received balance via SwapRouter02. Required for older PumpRobin tokens
 *      where user→pool transfers are taxed and Uniswap exact-input reverts.
 */
contract FoTUniswapSeller {
    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address public constant SWAP_ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    uint24 public constant POOL_FEE = 10_000;

    event Sold(
        address indexed trader,
        address indexed token,
        uint256 tokensIn,
        uint256 tokensSwapped,
        uint256 ethOut
    );

    function sellTokenForEth(
        address token,
        uint256 tokenAmount,
        uint256 minEthOut
    ) external returns (uint256 ethOut) {
        require(tokenAmount > 0, "No tokens");

        IERC20 t = IERC20(token);
        uint256 beforeBal = t.balanceOf(address(this));
        require(t.transferFrom(msg.sender, address(this), tokenAmount), "Transfer failed");
        uint256 received = t.balanceOf(address(this)) - beforeBal;
        require(received > 0, "Zero received");

        t.approve(SWAP_ROUTER, received);
        uint256 wethOut = ISwapRouter02(SWAP_ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: token,
                tokenOut: WETH,
                fee: POOL_FEE,
                recipient: address(this),
                amountIn: received,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        require(wethOut >= minEthOut, "Slippage exceeded");

        IWETH(WETH).withdraw(wethOut);
        (bool sent, ) = msg.sender.call{value: wethOut}("");
        require(sent, "ETH transfer failed");

        emit Sold(msg.sender, token, tokenAmount, received, wethOut);
        return wethOut;
    }

    receive() external payable {}
}
