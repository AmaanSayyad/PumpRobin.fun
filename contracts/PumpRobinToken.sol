// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PumpRobinToken
 * @notice Standard ERC-20 with on-chain image/description for indexers.
 * @dev Ownership is renounced at deploy (Bags / DEX Screener "Renounced" check).
 */
contract PumpRobinToken is ERC20, Ownable {
    address public immutable factory;
    address public immutable creator;
    string public imageUri;
    string public description;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageUri_,
        string memory description_,
        address creator_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        factory = msg.sender;
        creator = creator_;
        imageUri = imageUri_;
        description = description_;
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
        // Match Bags-style audit: no privileged owner after launch
        renounceOwnership();
    }
}
