// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PumpRobinToken.sol";
import "./BondingCurve.sol";

/**
 * @title PumpRobinFactory
 * @notice Factory for tokens + bonding curves on Robinhood Chain.
 * @dev Matches Bags createAndBuy: send creation fee + optional buy ETH in one tx.
 *      Excess over CREATION_FEE buys on the new curve for the creator.
 */
contract PumpRobinFactory {
    uint256 public constant CREATION_FEE = 0.0005 ether;
    /// @dev Same AMM as bags.fm / pump.fun (virtual constant-product). Bags on Robinhood
    ///      calibrates ~1.3 ETH virtual → start FDV ~$2.3k so 0.044 ETH ≈ 3.5% supply.
    ///      (30 ETH was Solana-pump scaled wrong for $1.8k ETH.)
    uint256 public constant INITIAL_VIRTUAL_ETH = 1.3 ether;
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 1_073_000_000 * 1e18;

    address public owner;
    /// @notice Receives creation fees and platform trade-fee share
    address public feeCollector;
    address[] public allTokens;
    mapping(address => address) public tokenToCurve;
    mapping(address => address) public curveToToken;

    event TokenCreated(
        address indexed token,
        address indexed bondingCurve,
        address indexed creator,
        string name,
        string symbol,
        string imageUri
    );
    event FeeCollectorUpdated(address indexed previous, address indexed next);

    constructor(address feeCollector_) {
        require(feeCollector_ != address(0), "Fee collector required");
        owner = msg.sender;
        feeCollector = feeCollector_;
    }

    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata imageUri,
        string calldata description
    ) external payable returns (address token, address bondingCurve) {
        require(msg.value >= CREATION_FEE, "Insufficient fee");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");

        PumpRobinToken newToken = new PumpRobinToken(
            name,
            symbol,
            imageUri,
            description,
            msg.sender
        );

        BondingCurve curve = new BondingCurve(
            address(newToken),
            msg.sender,
            address(this),
            feeCollector,
            INITIAL_VIRTUAL_ETH,
            INITIAL_VIRTUAL_TOKENS
        );

        // Transfer all tokens to bonding curve
        uint256 supply = newToken.totalSupply();
        newToken.transfer(address(curve), supply);

        token = address(newToken);
        bondingCurve = address(curve);

        allTokens.push(token);
        tokenToCurve[token] = bondingCurve;
        curveToToken[bondingCurve] = token;

        emit TokenCreated(token, bondingCurve, msg.sender, name, symbol, imageUri);

        // Forward creation fee to collector
        (bool feeSent, ) = feeCollector.call{value: CREATION_FEE}("");
        require(feeSent, "Fee transfer failed");

        // Bags-style createAndBuy: any ETH above the creation fee buys on the curve
        // for the creator in the same transaction (no second wallet confirm).
        uint256 buyEth = msg.value - CREATION_FEE;
        if (buyEth > 0) {
            curve.buyFor{value: buyEth}(msg.sender, 0);
        }
    }

    function setFeeCollector(address next) external {
        require(msg.sender == owner, "Not owner");
        require(next != address(0), "Fee collector required");
        address prev = feeCollector;
        feeCollector = next;
        emit FeeCollectorUpdated(prev, next);
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function creationFee() external pure returns (uint256) {
        return CREATION_FEE;
    }

    receive() external payable {}
}
