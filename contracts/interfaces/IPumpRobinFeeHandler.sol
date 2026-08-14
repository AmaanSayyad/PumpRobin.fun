// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPumpRobinFeeHandler {
    function onTransferFee(uint256 feeAmount) external;
}
