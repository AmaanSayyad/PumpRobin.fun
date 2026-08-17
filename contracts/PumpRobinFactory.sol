// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PumpRobinToken.sol";
import "./BondingCurve.sol";
import "./PumpRobinDeployer.sol";
import "./PumpRobinHook.sol";

/**
 * @title PumpRobinFactory
 * @notice Deploys a token + bonding curve pair and registers the future
 *         Uniswap v4 pool with the fee hook. 830M sells on the curve, the
 *         remaining 170M plus the raise migrate to v4 with locked liquidity.
 */
contract PumpRobinFactory {
    uint256 public constant DEFAULT_CREATION_FEE = 0.004 ether;

    address public owner;
    address public feeCollector;
    uint256 public creationFee;
    PumpRobinHook public immutable hook;
    PumpRobinDeployer public immutable deployer;

    address[] public allTokens;
    mapping(address => address) public tokenToCurve;
    mapping(address => address) public curveToToken;
    /// @notice Zero when the creator takes the full 1% themselves.
    mapping(address => address) public tokenToFeeShare;

    event TokenCreated(
        address indexed token,
        address indexed bondingCurve,
        address indexed creator,
        string name,
        string symbol,
        string imageUri
    );
    event TokenMetadata(address indexed token, string metadataURI, string description);
    event LaunchConfigured(
        address indexed token,
        bytes32 poolId,
        bool antiSnipe,
        uint256 antiSnipeEndsAt,
        bool maxWallet
    );
    event FeeCollectorUpdated(address indexed previous, address indexed next);
    event CreationFeeUpdated(uint256 previous, uint256 next);

    constructor(address feeCollector_, address hook_, address deployer_) {
        require(feeCollector_ != address(0), "Fee collector required");
        require(hook_ != address(0), "Hook required");
        require(deployer_ != address(0), "Deployer required");
        owner = msg.sender;
        feeCollector = feeCollector_;
        hook = PumpRobinHook(payable(hook_));
        deployer = PumpRobinDeployer(deployer_);
        creationFee = DEFAULT_CREATION_FEE;
    }

    /**
     * @notice Launch a token. Any ETH above `creationFee` becomes the creator's
     *         first buy on the curve, executed before anyone else can trade.
     */
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
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Bad name");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 16, "Bad symbol");
        require(bytes(description).length <= 2_000, "Description too long");
        require(msg.value >= creationFee, "Creation fee required");

        PumpRobinToken newToken = deployer.deployToken(
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
        token = address(newToken);

        BondingCurve curve = new BondingCurve(
            token,
            msg.sender,
            address(this),
            feeCollector,
            address(hook)
        );
        bondingCurve = address(curve);

        require(newToken.transfer(bondingCurve, newToken.totalSupply()), "Curve funding failed");

        // A splitter stands in as "creator" for both phases so the payout
        // address is the same before and after graduation.
        address creatorPayee = msg.sender;
        if (feeRecipients.length > 0) {
            creatorPayee = deployer.deployFeeShare(
                token,
                bondingCurve,
                address(hook),
                feeRecipients,
                feeShareBps
            );
            curve.setCreatorFeeRecipient(creatorPayee);
            tokenToFeeShare[token] = creatorPayee;
        }
        hook.register(curve.poolId(), bondingCurve, token, creatorPayee);

        allTokens.push(token);
        tokenToCurve[token] = bondingCurve;
        curveToToken[bondingCurve] = token;

        emit TokenCreated(token, bondingCurve, msg.sender, name, symbol, imageUri);
        emit TokenMetadata(token, metadataURI, description);
        emit LaunchConfigured(
            token,
            PoolId.unwrap(curve.poolId()),
            antiSnipe,
            newToken.antiSnipeEndsAt(),
            maxWallet
        );

        uint256 fee = creationFee;
        if (fee > 0) {
            (bool feeSent, ) = feeCollector.call{value: fee}("");
            require(feeSent, "Fee transfer failed");
        }

        uint256 initialBuy = msg.value - fee;
        if (initialBuy > 0) curve.buyFor{value: initialBuy}(msg.sender, 0);
    }

    function setFeeCollector(address next) external {
        require(msg.sender == owner, "Not owner");
        require(next != address(0), "Fee collector required");
        emit FeeCollectorUpdated(feeCollector, next);
        feeCollector = next;
    }

    function setCreationFee(uint256 next) external {
        require(msg.sender == owner, "Not owner");
        require(next <= 1 ether, "Fee too high");
        emit CreationFeeUpdated(creationFee, next);
        creationFee = next;
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    receive() external payable {}
}
