// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal sqrt-price helpers for Uniswap V3 pool initialization.
library SqrtPriceMath {
    /// @dev Returns sqrt(amount1 / amount0) * 2^96
    function encodeSqrtRatioX96(uint256 amount1, uint256 amount0) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "SqrtPrice: zero");
        uint256 sqrt0 = sqrt(amount0);
        uint256 sqrt1 = sqrt(amount1);
        return uint160((sqrt1 << 96) / sqrt0);
    }

    /// @dev Babylonian square root
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
