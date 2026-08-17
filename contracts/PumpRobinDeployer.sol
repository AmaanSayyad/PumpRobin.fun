// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PumpRobinToken.sol";
import "./PumpRobinFeeShare.sol";

/**
 * @title PumpRobinDeployer
 * @notice Holds the token and fee-share creation code on the factory's behalf.
 * @dev Purely a code-size split: embedding both in the factory pushed it to
 *      24,099 bytes, inside a rounding error of the 24,576 EIP-170 limit.
 */
contract PumpRobinDeployer {
    address public immutable owner;
    address public factory;

    event FactorySet(address indexed factory);

    constructor() {
        owner = msg.sender;
    }

    function setFactory(address factory_) external {
        require(msg.sender == owner, "Not owner");
        require(factory == address(0) && factory_ != address(0), "Factory already set");
        factory = factory_;
        emit FactorySet(factory_);
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    /// @notice Deploys the token and forwards the entire supply to the factory.
    function deployToken(
        string calldata name,
        string calldata symbol,
        string calldata imageUri,
        string calldata description,
        string calldata metadataURI,
        address creator,
        address platformFeeRecipient,
        bool antiSnipe,
        bool maxWallet
    ) external onlyFactory returns (PumpRobinToken token) {
        token = new PumpRobinToken(
            name,
            symbol,
            imageUri,
            description,
            metadataURI,
            creator,
            platformFeeRecipient,
            antiSnipe,
            maxWallet
        );
        require(token.transfer(msg.sender, token.totalSupply()), "Supply transfer failed");
    }

    function deployFeeShare(
        address token,
        address curve,
        address hook,
        address[] calldata recipients,
        uint16[] calldata bps
    ) external onlyFactory returns (address) {
        return address(new PumpRobinFeeShare(token, curve, hook, recipients, bps));
    }
}
