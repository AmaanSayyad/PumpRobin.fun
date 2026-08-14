// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PumpRobinToken.sol";
import "./BondingCurve.sol";

/**
 * @title PumpRobinFactory
 * @notice Every launch seeds Uniswap V3 immediately with locked LP.
 * @dev Min seed ~$5 (0.002 ETH) + 0.004 ETH creation fee. BondingCurve buy/sell
 *      remain on-chain for legacy tokens only — new launches always call seedInstantUniswap.
 */
contract PumpRobinFactory {
    /// @notice ~$10 at $2.5k ETH — platform launch fee
    uint256 public constant CREATION_FEE = 0.004 ether;
    /// @notice Must match BondingCurve.MIN_INSTANT_SEED
    uint256 public constant MIN_INSTANT_SEED = 0.002 ether;
    uint256 public constant INITIAL_VIRTUAL_ETH = 1.3 ether;
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 1_073_000_000 * 1e18;

    address public owner;
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
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");
        require(
            msg.value >= CREATION_FEE + MIN_INSTANT_SEED,
            "Need creation fee + seed"
        );

        PumpRobinToken newToken = new PumpRobinToken(
            name,
            symbol,
            imageUri,
            description,
            msg.sender,
            feeCollector
        );

        BondingCurve curve = new BondingCurve(
            address(newToken),
            msg.sender,
            address(this),
            feeCollector,
            INITIAL_VIRTUAL_ETH,
            INITIAL_VIRTUAL_TOKENS
        );

        token = address(newToken);
        bondingCurve = address(curve);

        uint256 supply = newToken.totalSupply();
        newToken.transfer(bondingCurve, supply);

        allTokens.push(token);
        tokenToCurve[token] = bondingCurve;
        curveToToken[bondingCurve] = token;

        emit TokenCreated(
            token,
            bondingCurve,
            msg.sender,
            name,
            symbol,
            imageUri
        );

        (bool feeSent, ) = feeCollector.call{value: CREATION_FEE}("");
        require(feeSent, "Fee transfer failed");

        uint256 remainder = msg.value - CREATION_FEE;
        curve.seedInstantUniswap{value: remainder}(msg.sender, 0);
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
