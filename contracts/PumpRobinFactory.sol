// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PumpRobinToken.sol";
import "./BondingCurve.sol";

/**
 * @title PumpRobinFactory
 * @notice Factory for tokens that launch straight into a Uniswap V3 pool.
 * @dev createToken: creation fee + seed ETH (≥ MIN_SEED). Excess seeds locked
 *      LP and optionally buys for the creator in the same tx (Bags create+buy).
 *      Optional antiSnipe arms an 80%→0% buy fee decay for 10s after launch.
 */
contract PumpRobinFactory {
    uint256 public constant CREATION_FEE = 0.0005 ether;
    uint256 public constant INITIAL_VIRTUAL_ETH = 1.3 ether;
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 1_073_000_000 * 1e18;
    uint256 public constant MIN_SEED_LIQUIDITY = 0.01 ether;

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
        string imageUri,
        bool antiSnipe
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
        string calldata description,
        bool antiSnipe
    ) external payable returns (address token, address bondingCurve) {
        require(msg.value >= CREATION_FEE + MIN_SEED_LIQUIDITY, "Need seed liquidity");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");

        PumpRobinToken newToken = new PumpRobinToken(
            name,
            symbol,
            imageUri,
            description,
            msg.sender,
            antiSnipe,
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

        newToken.setLauncher(address(curve));

        uint256 supply = newToken.totalSupply();
        newToken.transfer(address(curve), supply);

        token = address(newToken);
        bondingCurve = address(curve);

        allTokens.push(token);
        tokenToCurve[token] = bondingCurve;
        curveToToken[bondingCurve] = token;

        emit TokenCreated(
            token,
            bondingCurve,
            msg.sender,
            name,
            symbol,
            imageUri,
            antiSnipe
        );

        (bool feeSent, ) = feeCollector.call{value: CREATION_FEE}("");
        require(feeSent, "Fee transfer failed");

        uint256 seedEth = msg.value - CREATION_FEE;
        curve.seedAndGraduate{value: seedEth}(msg.sender, 0);
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

    function minSeedLiquidity() external pure returns (uint256) {
        return MIN_SEED_LIQUIDITY;
    }

    receive() external payable {}
}
