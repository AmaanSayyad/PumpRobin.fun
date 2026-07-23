// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/PumpRobinFactory.sol";
import "../contracts/BondingCurve.sol";
import "../contracts/interfaces/IUniswapV3.sol";

/**
 * @dev Fork test against Robinhood mainnet Uniswap V3.
 *      Run: forge test --match-contract GraduationFork -vvv
 *           (needs network; uses [rpc_endpoints].robinhood from foundry.toml)
 */
contract GraduationForkTest is Test {
    address constant FEE_COLLECTOR = address(0xFEE1);
    address constant BUYER = address(0xBEEF);

    function testGraduateSeedsUniswapV3Pool() public {
        vm.createSelectFork("robinhood");

        PumpRobinFactory factory = new PumpRobinFactory(FEE_COLLECTOR);

        vm.deal(BUYER, 30 ether);
        vm.startPrank(BUYER);
        (address token, address curveAddr) = factory.createToken{value: 0.0005 ether}(
            "PumpRobin Test",
            "PRT",
            "ipfs://test",
            "graduation fork test"
        );
        BondingCurve curve = BondingCurve(payable(curveAddr));

        // Buy past graduation threshold (1.3% fees reduce net, so send extra)
        curve.buy{value: 8.25 ether}(0);
        vm.stopPrank();

        assertTrue(curve.graduated(), "should be graduated");
        address pool = curve.uniswapPool();
        assertTrue(pool != address(0), "pool set");
        assertTrue(curve.lpTokenId() > 0, "lp nft minted");

        // Pool must exist on official V3 factory at 1% fee
        address expected = IUniswapV3Factory(curve.UNISWAP_V3_FACTORY()).getPool(
            token,
            curve.WETH(),
            curve.POOL_FEE()
        );
        assertEq(pool, expected, "pool address mismatch");
        assertGt(pool.code.length, 0, "pool has code");
    }
}
