// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/PumpRobinFactory.sol";
import "../contracts/BondingCurve.sol";
import "../contracts/PumpRobinToken.sol";

/**
 * @dev Fork test against Robinhood mainnet Uniswap V3.
 *      Run: forge test --match-contract GraduationFork -vvv
 */
contract GraduationForkTest is Test {
    address constant FEE_COLLECTOR = address(0xFEE1);
    address constant BUYER = address(0xBEEF);

    function testLaunchAlwaysSeedsUniswap() public {
        vm.createSelectFork("robinhood");

        PumpRobinFactory factory = new PumpRobinFactory(FEE_COLLECTOR);

        vm.deal(BUYER, 30 ether);
        vm.startPrank(BUYER);
        (address token, address curveAddr) = factory.createToken{
            value: 0.004 ether + 0.003 ether
        }("PumpRobin Instant", "PRI", "ipfs://test", "instant fork test");
        vm.stopPrank();

        BondingCurve curve = BondingCurve(payable(curveAddr));
        assertTrue(curve.graduated(), "every launch graduates to Uniswap");
        assertTrue(curve.uniswapPool() != address(0), "pool set");
        assertTrue(curve.lpTokenId() > 0, "lp nft minted");
        assertGt(PumpRobinToken(token).balanceOf(BUYER), 0, "creator buy");
    }

    function testLaunchRejectsBelowMinSeed() public {
        vm.createSelectFork("robinhood");

        PumpRobinFactory factory = new PumpRobinFactory(FEE_COLLECTOR);

        vm.deal(BUYER, 1 ether);
        vm.startPrank(BUYER);
        vm.expectRevert("Need creation fee + seed");
        factory.createToken{value: 0.004 ether}(
            "Too Small",
            "SML",
            "ipfs://test",
            "should fail"
        );
        vm.stopPrank();
    }
}
