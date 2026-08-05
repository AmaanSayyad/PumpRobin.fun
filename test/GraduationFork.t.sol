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

    function testCreateSeedsUniswapV3Pool() public {
        vm.createSelectFork("robinhood");

        PumpRobinFactory factory = new PumpRobinFactory(FEE_COLLECTOR);

        vm.deal(BUYER, 30 ether);
        vm.startPrank(BUYER);
        (address token, address curveAddr) = factory.createToken{
            value: 0.0005 ether + 0.05 ether
        }("PumpRobin Test", "PRT", "ipfs://test", "instant pool fork test", false);
        vm.stopPrank();

        BondingCurve curve = BondingCurve(payable(curveAddr));
        assertTrue(curve.graduated(), "should be graduated");
        address pool = curve.uniswapPool();
        assertTrue(pool != address(0), "pool set");
        assertTrue(curve.lpTokenId() > 0, "lp nft minted");
        assertFalse(PumpRobinToken(token).antiSnipeEnabled(), "anti-snipe off");
    }

    function testCreateWithAntiSnipeArmsDecay() public {
        vm.createSelectFork("robinhood");

        PumpRobinFactory factory = new PumpRobinFactory(FEE_COLLECTOR);

        vm.deal(BUYER, 30 ether);
        vm.startPrank(BUYER);
        (address token, address curveAddr) = factory.createToken{
            value: 0.0005 ether + 0.05 ether
        }("PumpRobin Snipe", "PRS", "ipfs://test", "anti-snipe fork test", true);
        vm.stopPrank();

        BondingCurve curve = BondingCurve(payable(curveAddr));
        PumpRobinToken t = PumpRobinToken(token);
        assertTrue(curve.graduated(), "graduated");
        assertTrue(t.antiSnipeEnabled(), "anti-snipe on");
        assertTrue(t.tradingOpenedAt() > 0, "armed");
        assertEq(t.uniswapPool(), curve.uniswapPool(), "pool wired");
        // Right after arm, fee should be near the start (same second => full 80%)
        assertEq(t.currentAntiSnipeBps(), 8_000, "start fee");
        vm.warp(block.timestamp + 10);
        assertEq(t.currentAntiSnipeBps(), 0, "decayed");
    }
}
