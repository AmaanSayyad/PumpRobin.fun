// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/PumpRobinFactory.sol";
import "../contracts/BondingCurve.sol";
import "../contracts/PumpRobinToken.sol";

/**
 * @dev Fork test against Robinhood mainnet Uniswap v3.
 *      Run: forge test --match-contract GraduationFork -vvv
 */
contract GraduationForkTest is Test {
    address constant FEE_COLLECTOR = address(0xFEE1);
    address constant BUYER = address(0xBEEF);

    function testLaunchRejectsBelowMinSeed() public {
        PumpRobinFactory factory = new PumpRobinFactory(FEE_COLLECTOR, address(1));

        vm.deal(BUYER, 1 ether);
        vm.startPrank(BUYER);
        vm.expectRevert("Need creation fee + seed");
        factory.createToken{value: 0.004 ether}(
            "Too Small",
            "SML",
            "ipfs://test",
            "should fail",
            "",
            false,
            false,
            new address[](0),
            new uint16[](0)
        );
        vm.stopPrank();
    }
}
