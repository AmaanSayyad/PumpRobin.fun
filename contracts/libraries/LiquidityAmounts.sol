// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Uniswap-style liquidity from token amounts (full-range v4 mint).
library LiquidityAmounts {
    uint256 internal constant Q96 = 2 ** 96;

    function getLiquidityForAmount0(
        uint160 sqrtA,
        uint160 sqrtB,
        uint256 amount0
    ) internal pure returns (uint128) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        if (sqrtA == 0) return 0;
        uint256 intermediate = Math.mulDiv(uint256(sqrtA), uint256(sqrtB), Q96);
        return uint128(Math.mulDiv(amount0, intermediate, uint256(sqrtB) - uint256(sqrtA)));
    }

    function getLiquidityForAmount1(
        uint160 sqrtA,
        uint160 sqrtB,
        uint256 amount1
    ) internal pure returns (uint128) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        return uint128(Math.mulDiv(amount1, Q96, uint256(sqrtB) - uint256(sqrtA)));
    }

    function getLiquidityForAmounts(
        uint160 sqrtRatioX96,
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        if (sqrtRatioAX96 > sqrtRatioBX96) {
            (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        }
        if (sqrtRatioX96 <= sqrtRatioAX96) {
            liquidity = getLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0);
        } else if (sqrtRatioX96 < sqrtRatioBX96) {
            uint128 liquidity0 = getLiquidityForAmount0(sqrtRatioX96, sqrtRatioBX96, amount0);
            uint128 liquidity1 = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioX96, amount1);
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        } else {
            liquidity = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1);
        }
    }
}
