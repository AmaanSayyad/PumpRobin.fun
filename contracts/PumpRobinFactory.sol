// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PumpRobinToken.sol";
import "./BondingCurve.sol";
import "./PumpRobinHook.sol";

/**
 * @title PumpRobinFactory
 * @notice Instant Uniswap V3 launch: 100% supply in LP, NFT burned to 0xdead.
 */
contract PumpRobinFactory {
    uint256 public constant CREATION_FEE = 0.004 ether;
    uint256 public constant MIN_INSTANT_SEED = 0.1 ether;
    uint256 public constant INITIAL_VIRTUAL_ETH = 1.3 ether;
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 1_073_000_000 * 1e18;

    address public owner;
    address public feeCollector;
    PumpRobinHook public immutable hook;
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

    constructor(address feeCollector_, address hook_) {
        require(feeCollector_ != address(0), "Fee collector required");
        require(hook_ != address(0), "Hook required");
        owner = msg.sender;
        feeCollector = feeCollector_;
        hook = PumpRobinHook(payable(hook_));
    }

    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata imageUri,
        string calldata description,
        string calldata metadataURI,
        bool antiSnipe,
        bool maxWallet,
        address[] calldata feeRecipients,
        uint16[] calldata feeShareBps
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
            metadataURI,
            msg.sender,
            feeCollector,
            antiSnipe,
            maxWallet
        );

        BondingCurve curve = new BondingCurve(
            address(newToken),
            msg.sender,
            address(this),
            feeCollector,
            address(hook),
            INITIAL_VIRTUAL_ETH,
            INITIAL_VIRTUAL_TOKENS
        );

        token = address(newToken);
        bondingCurve = address(curve);

        newToken.setBondingCurve(bondingCurve);
        if (feeRecipients.length > 0) {
            newToken.setFeeShares(feeRecipients, feeShareBps);
        }

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
