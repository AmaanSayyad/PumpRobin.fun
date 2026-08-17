// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Permit2's allowance surface — the only path PositionManager will
///         pull ERC-20s through.
interface IAllowanceTransfer {
    function approve(
        address token,
        address spender,
        uint160 amount,
        uint48 expiration
    ) external;
}

/**
 * @notice Uniswap v4 PositionManager.
 * @dev Liquidity minted through here becomes an ERC-721 the owner holds, which
 *      is what block explorers and scanners read when they score whether LP is
 *      burned. Minting straight through PoolManager leaves no such token, so a
 *      permanently locked pool still reads as "LP not burnt".
 */
interface IPositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline)
        external
        payable;
}

/// @dev v4-periphery action ids used when encoding `modifyLiquidities`.
library V4Actions {
    uint8 internal constant MINT_POSITION = 0x02;
    uint8 internal constant SETTLE_PAIR = 0x0d;
}
